(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.DaubHybrid = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var limits = Object.freeze({ maxRequests: 18, maxDurationMs: 180000, maxRounds: 2, maxConcurrency: 3 });

  class Stop extends Error {
    constructor(reason) { super(reason); this.reason = reason; }
  }

  function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === null || Object.getPrototypeOf(proto) === null;
  }

  function copy(value, ancestors) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!Array.isArray(value) && !record(value)) throw new TypeError('Expected plain JSON data');
    ancestors = ancestors || new Set();
    if (ancestors.has(value)) throw new TypeError('Cyclic JSON data');
    ancestors.add(value);
    var array = Array.isArray(value), result = array ? [] : {};
    Reflect.ownKeys(value).forEach(function (key) {
      if (array && key === 'length') return;
      var property = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !property.enumerable || !Object.prototype.hasOwnProperty.call(property, 'value')) throw new TypeError('Expected JSON data properties');
      if (array && !/^(0|[1-9][0-9]*)$/.test(key)) throw new TypeError('Invalid JSON array');
      Object.defineProperty(result, key, { value: copy(property.value, ancestors), writable: true, enumerable: true, configurable: true });
    });
    if (array && Object.keys(result).length !== value.length) throw new TypeError('Sparse JSON array');
    ancestors.delete(value);
    return result;
  }

  function whole(value) {
    if (!record(value)) throw new TypeError('Expected a whole spec object');
    return copy(value);
  }

  function same(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    var keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(function (key) { return Object.prototype.hasOwnProperty.call(b, key) && same(a[key], b[key]); });
  }

  function id(value) { return typeof value === 'string' && value.trim().length > 0; }
  function identity(defect) {
    return id(defect.targetId) && id(defect.kind) ? JSON.stringify([defect.targetId, defect.kind]) : JSON.stringify([defect.id]);
  }

  function evidence(value) {
    try {
      value = copy(value);
      if (!record(value) || value.complete !== true || !Array.isArray(value.defects) || !Array.isArray(value.checks) || !value.checks.length) return null;
      var defects = new Set(), checks = new Set();
      if (!value.defects.every(function (defect) {
        if (!record(defect) || !(id(defect.id) || id(defect.targetId) && id(defect.kind)) || typeof defect.message !== 'string') return false;
        if (defect.targetId !== undefined && !id(defect.targetId) || defect.kind !== undefined && !id(defect.kind)) return false;
        var key = identity(defect);
        if (defects.has(key)) return false;
        defects.add(key); return true;
      })) return null;
      if (!value.checks.every(function (check) {
        if (!record(check) || !id(check.id) || typeof check.pass !== 'boolean' || checks.has(check.id)) return false;
        checks.add(check.id); return true;
      })) return null;
      return value;
    } catch (_) { return null; }
  }

  function regression(before, after, defect) {
    if (!before || !after) return 'unverified';
    if (defect && after.defects.some(function (item) { return identity(item) === identity(defect); })) return 'unresolved';
    var known = new Set(before.defects.map(identity));
    if (after.defects.some(function (item) { return !known.has(identity(item)); })) return 'new-defect';
    var passing = new Set(after.checks.filter(function (check) { return check.pass; }).map(function (check) { return check.id; }));
    if (before.checks.some(function (check) { return check.pass && !passing.has(check.id); })) return 'check-regression';
    return null;
  }

  function providerFailure(error) {
    if (!error) return false;
    if ([error.status, error.statusCode, error.code, error.response && error.response.status].some(function (status) { return Number(status) >= 400 && Number(status) <= 599; })) return true;
    if (error.name === 'SyntaxError' || error.name === 'ValidationError') return false;
    return /rate[ _-]?limit|quota|\bcredits?\b|unauthori[sz]ed|forbidden|authentication|insufficient[ _-]funds/i.test([error.code, error.type, error.message || String(error)].join(' '));
  }

  function errorMessage(error) {
    return (typeof (error && error.message) === 'string' ? error.message : 'Callback failed')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
      .replace(/\bsk-[A-Za-z0-9_-]+/g, '[redacted]')
      .replace(/\b(api[_-]?key|token|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').slice(0, 500);
  }

  /** run({draft, inspect, propose, apply, finish, onSpec?, onProgress?, signal?,
   *   conflicts?, repairKey?, limits?, maxRequests?, maxDurationMs?, maxRounds?, concurrency?}).
   * Model hooks receive {signal, request}; request(fn) calls fn(signal), counts only
   * dispatched provider calls, and shares a concurrency cap. Hooks must route all
   * provider calls through it. Limits may lower, but cannot exceed, exported caps.
   * Specs/patches are JSON objects/data; no renderer or provider schema is assumed.
   * Optional repairKey(spec, defect) receives detached JSON and must synchronously
   * return a nonblank string of at most 65536 code units without provider calls.
   * Each key permits one proposal per run; absent keys preserve round-based retries.
   * complete inspection evidence requires nonempty, uniquely named boolean checks.
   * Results: {spec, reason, assessment, requests, accepted, rejected}. Counts cover
   * repair candidates only; finish acceptance has its own progress event. assessment
   * describes the retained spec or is null. Only reason: complete means verified.
   * External cancellation rejects AbortError with partialSpec and assessment.
   * Timeout/provider failures resolve with the incumbent and stop further hooks.
   */
  async function run(options) {
    options = options || {};
    ['draft', 'inspect', 'propose', 'apply', 'finish'].forEach(function (name) {
      if (typeof options[name] !== 'function') throw new TypeError(name + ' must be a function');
    });
    ['onSpec', 'onProgress', 'conflicts', 'repairKey'].forEach(function (name) {
      if (options[name] !== undefined && typeof options[name] !== 'function') throw new TypeError(name + ' must be a function');
    });
    function limit(name, minimum, alias) {
      var value = options[alias || name];
      if (value === undefined && options.limits) value = options.limits[name];
      if (value === undefined) value = limits[name];
      if (!Number.isInteger(value) || value < minimum || value > limits[name]) throw new RangeError('Invalid ' + (alias || name));
      return value;
    }
    var maxRequests = limit('maxRequests', 2), duration = limit('maxDurationMs', 1);
    var maxRounds = limit('maxRounds', 0), concurrency = limit('maxConcurrency', 1, 'concurrency');
    var controller = new AbortController(), signal = controller.signal, external = options.signal;
    var now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? function () { return performance.now(); } : function () { return Date.now(); };
    var deadline = now() + duration, spec = null, assessment = null, requests = 0, accepted = 0, rejected = 0;
    var active = 0, queue = [], closed = false, budgetHit = false, round = 0, lastError = null;
    var rejectStopped, stopped = new Promise(function (_, reject) { rejectStopped = reject; });
    stopped.catch(function () {});
    signal.addEventListener('abort', function () { rejectStopped(signal.reason); }, { once: true });
    function stop(error) { if (!signal.aborted) controller.abort(error); }
    function report(error) {
      if (closed || error instanceof Stop || signal.aborted) return;
      var message = errorMessage(error);
      if (message === lastError) return;
      lastError = message;
      // Error reporting cannot delay a fatal stop or replace the original error.
      if (options.onProgress) {
        try { Promise.resolve(options.onProgress({ phase: 'error', round: round, requests: requests, accepted: accepted, rejected: rejected, reason: providerFailure(error) ? 'provider-error' : 'unverified', error: message })).catch(function () {}); }
        catch (_) {}
      }
    }
    function cancel() { var error = new Error('Hybrid run aborted'); error.name = 'AbortError'; stop(error); }
    function expire() { stop(new Stop('time-limit')); }
    function check() {
      if (now() >= deadline && !closed) expire();
      if (signal.aborted) throw signal.reason;
      if (closed) throw new Stop('closed');
    }
    async function bounded(fn) {
      check();
      var result = await Promise.race([stopped, Promise.resolve().then(function () { check(); return fn(); })]);
      check(); return result;
    }
    function pump() {
      if (closed || signal.aborted) {
        queue.splice(0).forEach(function (job) { job.reject(signal.reason || new Stop('closed')); });
        return;
      }
      while (active < concurrency && queue.length) queue.shift().start();
    }
    function request(fn, ceiling, scope) {
      var task = new Promise(function (resolve, reject) {
        try {
          check();
          if (!scope.open) throw new Stop('closed');
          if (typeof fn !== 'function') throw new TypeError('request expects a function');
        } catch (error) { reject(error); return; }
        queue.push({ reject: reject, start: function () {
          try {
            check();
            if (requests >= ceiling) { budgetHit = true; throw new Stop('request-limit'); }
            requests++; active++;
          } catch (error) { reject(error); return; }
          bounded(function () { return fn(signal); }).then(resolve, function (error) {
            report(error);
            if (providerFailure(error) && !signal.aborted) stop(new Stop('provider-error'));
            reject(signal.reason || error);
          }).finally(function () { active--; pump(); });
        } });
        pump();
      });
      // Observe even fire-and-forget requests; a hook cannot swallow a failed call.
      task.catch(function (error) { if (!scope.error) scope.error = error; });
      scope.tasks.push(task);
      return task;
    }
    async function call(name, args, ceiling) {
      var scope = { open: true, tasks: [], error: null };
      args = args || {};
      args.signal = signal;
      args.request = function (fn) { return request(fn, ceiling, scope); };
      try {
        var result = await bounded(function () { return options[name](args); });
        scope.open = false;
        await bounded(function () { return Promise.allSettled(scope.tasks); });
        if (scope.error && !(name === 'finish' && scope.error instanceof Stop && scope.error.reason === 'request-limit')) throw scope.error;
        return result;
      } catch (error) {
        report(error);
        if (providerFailure(error) && !signal.aborted) stop(new Stop('provider-error'));
        check(); throw error;
      } finally { scope.open = false; }
    }
    async function progress(phase, detail) {
      if (options.onProgress) await bounded(function () { return options.onProgress(Object.assign({ phase: phase, round: round, requests: requests, accepted: accepted, rejected: rejected }, copy(detail || {}))); });
    }
    async function publish() {
      if (options.onSpec) await bounded(function () { return options.onSpec(copy(spec)); });
    }
    async function inspect(candidate, ceiling) {
      try { return evidence(await call('inspect', { spec: copy(candidate) }, ceiling)); }
      catch (error) {
        check();
        if (error instanceof Stop) throw error;
        return null;
      }
    }
    async function repairs() {
      var dispatchedKeys = new Set();
      function finishSoon() { return deadline - now() <= duration / 3; }
      for (round = 1; round <= maxRounds; round++) {
        if (!assessment || !assessment.defects.length) break;
        if (finishSoon()) break;
        if (requests >= maxRequests - 2) { budgetHit = true; break; }
        var targets = [], targetKeys = [];
        for (var defect of assessment.defects) {
          if (targets.length >= concurrency) break;
          var key;
          if (options.repairKey) {
            key = await bounded(function () {
              var value = options.repairKey(copy(spec), copy(defect));
              if (typeof value !== 'string' || value.length > 65536 || !value.trim()) {
                // Observe invalid async returns without awaiting or accepting them.
                if (value && typeof value.then === 'function') Promise.resolve(value).catch(function () {});
                throw new TypeError('repairKey must return a nonblank string of at most 65536 code units');
              }
              return value;
            });
            if (dispatchedKeys.has(key) || targetKeys.includes(key)) continue;
          }
          var conflict = false;
          for (var other of targets) {
            if (!defect.targetId || !other.targetId || defect.targetId === other.targetId) { conflict = true; break; }
            if (options.conflicts) {
              var answer = await bounded(function () { return options.conflicts(copy(defect), copy(other), copy(spec)); });
              if (typeof answer !== 'boolean' || answer) { conflict = true; break; }
            }
          }
          if (!conflict) { targets.push(copy(defect)); targetKeys.push(key); }
        }
        if (!targets.length) break;
        await progress('round', { targets: targets });
        var captured = copy(spec);
        var jobs = targets.map(async function (target, index) {
          try {
            check();
            if (options.repairKey) dispatchedKeys.add(targetKeys[index]);
            var patch = await call('propose', { spec: copy(captured), defect: copy(target) }, maxRequests - 2);
            return { defect: target, patch: copy(patch) };
          } catch (error) {
            check();
            if (error instanceof Stop) throw error;
            report(error);
            return { defect: target, invalid: true };
          }
        });
        var proposals = await Promise.allSettled(jobs);
        check();
        var failed = proposals.find(function (job) { return job.status === 'rejected'; });
        if (failed) throw failed.reason;
        for (var job of proposals) {
          if (finishSoon()) return;
          var proposal = job.value, target = proposal.defect, candidate = null, next = null, reason = null;
          if (!assessment.defects.some(function (item) { return identity(item) === identity(target); })) reason = 'stale';
          else if (proposal.invalid) reason = 'invalid-patch';
          else {
            try {
              candidate = whole(await bounded(function () { return options.apply({ spec: copy(spec), patch: copy(proposal.patch), defect: copy(target) }); }));
            } catch (error) {
              check();
              report(error);
              if (providerFailure(error)) { stop(new Stop('provider-error')); check(); }
              reason = 'invalid-patch';
            }
            if (!reason) { next = await inspect(candidate, maxRequests - 2); reason = regression(assessment, next, target); }
          }
          if (reason) { rejected++; await progress('rejected', { defect: target, reason: reason }); }
          else {
            check(); spec = candidate; assessment = next; accepted++;
            await publish(); await progress('accepted', { defect: target });
          }
        }
      }
    }
    function result(reason) {
      var output = { spec: copy(spec), reason: reason, assessment: copy(assessment), requests: requests, accepted: accepted, rejected: rejected };
      if (lastError !== null) output.error = lastError;
      return output;
    }
    var timer = setTimeout(expire, duration);
    if (external) {
      if (external.aborted) cancel();
      else external.addEventListener('abort', cancel, { once: true });
    }
    try {
      await progress('draft');
      spec = whole(await call('draft', {}, maxRequests - 2));
      await publish();
      try {
        assessment = await inspect(spec, maxRequests - 2);
        await repairs();
      } catch (error) {
        if (!(error instanceof Stop) || error.reason !== 'request-limit') throw error;
        budgetHit = true;
      }
      await progress('finish');
      var finished;
      try { finished = whole(await call('finish', { spec: copy(spec) }, maxRequests - 1)); }
      catch (error) {
        if (error instanceof Stop || signal.aborted) throw error;
        report(error);
        finished = null;
      }
      // Finish stays private until fresh evidence covers the entire final candidate.
      var finalAssessment = await inspect(finished || spec, maxRequests);
      var finishReason = finished ? regression(assessment, finalAssessment) : 'invalid-spec';
      // New journey evidence can fail without discarding usable behavior. Existing
      // passing checks must still survive; repair candidates use the stricter gate.
      if (finished && assessment && finalAssessment) {
        var finalPassing = new Set(finalAssessment.checks.filter(function (item) { return item.pass; }).map(function (item) { return item.id; }));
        var knownDefects = new Set(assessment.defects.map(identity));
        var newDefects = finalAssessment.defects.filter(function (item) { return !knownDefects.has(identity(item)); });
        finishReason = newDefects.some(function (item) {
          var kind = (item.kind || '').split(':').pop();
          var behavior = /^behavior(?:-|$)/.test(kind) || kind === 'journey';
          var reachedLayout = item.scope === 'journey' && /^(horizontal-overflow|clipped-text|clipped-control|hidden-target|missing-target|broken-image)$/.test(kind);
          return !behavior && !reachedLayout;
        }) ? 'new-defect' : null;
        if (assessment.checks.some(function (item) { return item.pass && !finalPassing.has(item.id); })) finishReason = 'check-regression';
      }
      if (finished && !assessment && same(spec, finished)) finishReason = finalAssessment ? null : 'unverified';
      if (!finishReason) {
        var changed = !same(spec, finished);
        spec = finished; assessment = finalAssessment;
        if (changed) await publish();
      }
      await progress('finished', { accepted: !finishReason, reason: finishReason || 'accepted' });
      var complete = !finishReason && assessment && !assessment.defects.length && assessment.checks.every(function (item) { return item.pass; });
      var outcome = result(complete ? 'complete' : budgetHit ? 'request-limit' : finishReason === 'unverified' || !assessment ? 'unverified' : 'incomplete');
      if (finishReason) { outcome.finishRejection = finishReason; outcome.attemptedAssessment = copy(finalAssessment); }
      return outcome;
    } catch (error) {
      report(error);
      if (!signal.aborted && providerFailure(error)) stop(new Stop('provider-error'));
      var failure = signal.aborted ? signal.reason : error;
      if (failure && failure.name === 'AbortError') {
        failure.partialSpec = copy(spec); failure.assessment = copy(assessment);
        throw failure;
      }
      return result(failure instanceof Stop ? failure.reason : 'unverified');
    } finally {
      clearTimeout(timer);
      if (external) external.removeEventListener('abort', cancel);
      closed = true;
      stop(new Stop('closed'));
      pump();
    }
  }

  return { run: run, limits: limits };
}));
