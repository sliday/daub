(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.DaubPrototypeRuntime = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  /**
   * mount(container, code, reportError?) -> { getOutput, subscribe, dispose }
   * Call inside the container's opaque child window. The host owns sandbox/CSP.
   * Remounting disposes the previous instance in that window, even if the new
   * code fails. Code receives (container, api) and may return a cleanup function.
   * Initialization must be synchronous; cleanup may return a promise.
   *
   * api.on(targetOrSelector, event, fn) -> cancel
   *   Binds all current selector matches inside container (no delegation), or
   *   container, a descendant, window/document, or "window"/"document".
   *   Calls fn(event) with this set to the target. Missing targets throw.
   * api.every(ms, fn) -> cancel
   *   Repeats fn() for finite 0 < ms <= 2147483647; skips hidden-document ticks.
   * api.frame(fn) -> cancel
   *   Repeats fn(timestamp) via requestAnimationFrame; pauses while hidden.
   * api.publish(object) -> undefined
   *   Accepts plain JSON objects with finite numbers and dense arrays. Rejects
   *   cycles, accessors, functions, undefined, symbols and non-JSON values.
   *   Copies data without invoking toJSON or interpreting strings as HTML.
   *
   * window.DaubPrototype exposes getOutput() and subscribe(fn) -> unsubscribe.
   * Reads and notifications return detached, deeply frozen snapshots. Output
   * starts as null; subscribe replays existing output once before returning.
   * Each publish notifies subscribers, including equal values. Reentrant
   * publications queue in order, with a 1000-publication limit per drain.
   *
   * window.__daubPrototypeDispose() is idempotent. It cancels managed resources,
   * clears output/subscriptions without notifying, and calls cleanup once.
   * Old instances cannot publish. Native timers/listeners outside api are not
   * managed; release those in cleanup. Cancel functions are idempotent.
   * Callback throws/rejections (including subscribers) dispose the instance.
   * Reports use reportError, then window.__pgReportError, then console.error,
   * with Error.phase and Error.cause. Cleanup errors cannot dispose a successor.
   * The api adds no network or storage helpers.
   */
  // Keep mount self-contained for CustomHTML and exported sandbox documents.
  function mount(container, code, reportError) {
    'use strict';
    var view, doc, cleanup, publicAPI;
    var active = true, publishing = false, snapshot = null;
    var resources = new Set(), subscribers = new Set(), pending = [];

    function report(error, phase) {
      var contextual = new Error('DaubPrototype ' + phase + ': ' + String(error && error.message || error));
      contextual.cause = error;
      contextual.phase = phase;
      try {
        if (typeof reportError === 'function') reportError(contextual);
        else if (view && typeof view.__pgReportError === 'function') view.__pgReportError(contextual);
        else if (typeof console !== 'undefined') console.error(contextual);
      } catch (_) {}
    }

    function clone(value, seen) {
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (!value || typeof value !== 'object') throw new TypeError('Expected plain JSON');
      var array = Array.isArray(value), proto = Object.getPrototypeOf(value);
      if (!array && proto !== null && Object.getPrototypeOf(proto) !== null) throw new TypeError('Expected plain JSON');
      seen = seen || new Set();
      if (seen.has(value)) throw new TypeError('Circular JSON');
      seen.add(value);
      var result = array ? [] : {};
      var keys = Reflect.ownKeys(value).filter(function(name) { return !array || name !== 'length'; });
      if (array && keys.length !== value.length) throw new TypeError('Expected a dense JSON array');
      keys.forEach(function(name, index) {
        var descriptor = Object.getOwnPropertyDescriptor(value, name);
        if (typeof name !== 'string' || !descriptor.enumerable || !('value' in descriptor) ||
            (array && name !== String(index))) throw new TypeError('Expected plain JSON properties');
        Object.defineProperty(result, name, {
          value: clone(descriptor.value, seen), enumerable: true, writable: true, configurable: true
        });
      });
      seen.delete(value);
      return Object.freeze(result);
    }

    function runCleanup() {
      if (typeof cleanup !== 'function') return;
      var fn = cleanup;
      cleanup = null;
      try {
        var result = fn();
        if (result && typeof result.then === 'function') Promise.resolve(result).catch(function(error) { report(error, 'cleanup'); });
      } catch (error) { report(error, 'cleanup'); }
    }

    function dispose() {
      if (!active) return;
      active = false;
      pending.length = 0;
      snapshot = null;
      subscribers.clear();
      Array.from(resources).forEach(function(cancel) {
        try { cancel(); } catch (error) { report(error, 'cleanup'); }
      });
      resources.clear();
      if (view && Object.getOwnPropertyDescriptor(view, 'DaubPrototype')?.value === publicAPI) delete view.DaubPrototype;
      if (view && Object.getOwnPropertyDescriptor(view, '__daubPrototypeDispose')?.value === dispose) delete view.__daubPrototypeDispose;
      runCleanup();
    }

    function fail(error, phase) {
      if (!active) return;
      dispose();
      report(error, phase);
    }

    function invoke(fn, receiver, args, phase, valid) {
      if (!active || (valid && !valid())) return;
      try {
        var result = fn.apply(receiver, args);
        if (result && typeof result.then === 'function') Promise.resolve(result).catch(function(error) {
          if (active && (!valid || valid())) fail(error, phase);
        });
      } catch (error) { fail(error, phase); }
    }

    function getOutput() {
      return snapshot === null ? null : clone(snapshot);
    }

    function notify(entry) {
      invoke(entry.fn, undefined, [getOutput()], 'subscribe', function() { return subscribers.has(entry); });
    }

    function subscribe(fn) {
      if (!active) return function() {};
      if (typeof fn !== 'function') throw new TypeError('Expected an output listener');
      var entry = { fn: fn };
      subscribers.add(entry);
      if (snapshot !== null) notify(entry);
      return function() { subscribers.delete(entry); };
    }

    function publish(value) {
      if (!active) return;
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('publish expects a plain JSON object');
      var next = clone(value);
      if (!active) return;
      pending.push(next);
      if (publishing) return;
      publishing = true;
      var count = 0;
      try {
        while (active && pending.length) {
          if (++count > 1000) throw new Error('Exceeded 1000 queued publications');
          snapshot = pending.shift();
          Array.from(subscribers).forEach(function(entry) {
            if (active && subscribers.has(entry)) notify(entry);
          });
        }
      } catch (error) { fail(error, 'publish'); }
      finally { publishing = false; }
    }

    function on(targetOrSelector, event, fn) {
      if (!active) return function() {};
      if (typeof event !== 'string' || !event || typeof fn !== 'function') throw new TypeError('Expected an event name and handler');
      var targets;
      if (targetOrSelector === 'window' || targetOrSelector === view) targets = [view];
      else if (targetOrSelector === 'document' || targetOrSelector === doc) targets = [doc];
      else if (typeof targetOrSelector === 'string') targets = Array.from(container.querySelectorAll(targetOrSelector));
      else targets = [targetOrSelector];
      if (!targets.length) throw new Error('Missing event target: ' + targetOrSelector);
      targets.forEach(function(target) {
        if (!target || typeof target.addEventListener !== 'function' ||
            (target !== view && target !== doc && target !== container && !container.contains(target))) {
          throw new TypeError('Expected an event target inside container, window, or document');
        }
      });
      var attached = true;
      function wrapped(eventObject) {
        invoke(fn, this, [eventObject], 'event ' + event, function() { return attached; });
      }
      function cancel() {
        if (!attached) return;
        attached = false;
        targets.forEach(function(target) { target.removeEventListener(event, wrapped); });
        resources.delete(cancel);
      }
      resources.add(cancel);
      targets.forEach(function(target) { target.addEventListener(event, wrapped); });
      return cancel;
    }

    function every(ms, fn) {
      if (!active) return function() {};
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0 || ms > 2147483647 || typeof fn !== 'function') {
        throw new TypeError('Expected a positive timer delay and callback');
      }
      var attached = true;
      var id = view.setInterval(function() {
        if (!doc.hidden) invoke(fn, undefined, [], 'every', function() { return attached; });
      }, ms);
      function cancel() {
        if (!attached) return;
        attached = false;
        view.clearInterval(id);
        resources.delete(cancel);
      }
      resources.add(cancel);
      return cancel;
    }

    function frame(fn) {
      if (!active) return function() {};
      if (typeof fn !== 'function') throw new TypeError('Expected an animation callback');
      var attached = true, id = null;
      function schedule() {
        if (active && attached && !doc.hidden && id === null) id = view.requestAnimationFrame(tick);
      }
      function tick(time) {
        id = null;
        if (!doc.hidden) invoke(fn, undefined, [time], 'frame', function() { return attached; });
        schedule();
      }
      function visibility() {
        if (doc.hidden && id !== null) { view.cancelAnimationFrame(id); id = null; }
        else schedule();
      }
      function cancel() {
        if (!attached) return;
        attached = false;
        if (id !== null) view.cancelAnimationFrame(id);
        id = null;
        doc.removeEventListener('visibilitychange', visibility);
        resources.delete(cancel);
      }
      resources.add(cancel);
      doc.addEventListener('visibilitychange', visibility);
      schedule();
      return cancel;
    }

    var controller = Object.freeze({ getOutput: getOutput, subscribe: subscribe, dispose: dispose });
    var api = Object.freeze({ on: on, every: every, frame: frame, publish: publish });
    var phase = 'initialize';
    try {
      if (!container || typeof container.querySelectorAll !== 'function') throw new TypeError('Expected a container element');
      doc = container.ownerDocument;
      view = doc && doc.defaultView;
      // The host owns iframe sandbox/CSP policy; never evaluate in the host realm.
      if (!view || typeof window === 'undefined' || view !== window || view === view.top ||
          view.origin !== 'null' || view.frameElement !== null) {
        throw new Error('Expected an opaque sandbox window');
      }
      var previous = view.__daubPrototypeDispose;
      publicAPI = Object.freeze({ getOutput: getOutput, subscribe: subscribe });
      Object.defineProperty(view, 'DaubPrototype', { value: publicAPI, configurable: true, writable: false });
      Object.defineProperty(view, '__daubPrototypeDispose', { value: dispose, configurable: true, writable: false });
      if (typeof previous === 'function') previous();
      if (!active) return controller;
      phase = 'execute';
      if (typeof code !== 'string') throw new TypeError('Expected prototype code as a string');
      var result = new Function('container', 'api', code)(container, api);
      if (result && typeof result.then === 'function') {
        Promise.resolve(result).catch(function() {});
        throw new TypeError('Prototype code must return cleanup synchronously');
      }
      if (result != null && typeof result !== 'function') throw new TypeError('Prototype code must return a cleanup function or nothing');
      cleanup = result;
      // Code can dispose or remount itself before returning its cleanup.
      if (!active) runCleanup();
    } catch (error) { fail(error, phase); }
    return controller;
  }

  // Returns a JS body for CustomHTML, not a script tag. Safe to construct in the
  // host: execution still requires the opaque child guard. Resolves container,
  // then preview, then document.body; embeds mount without external dependencies.
  function toScript(code) {
    if (typeof code !== 'string') throw new TypeError('Expected prototype code as a string');
    var literal = JSON.stringify(code).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return '(' + mount.toString() + ')(typeof container !== "undefined" ? container : '
      + '(typeof preview !== "undefined" ? preview : document.body), ' + literal + ', '
      + 'typeof window !== "undefined" && typeof window.__pgReportError === "function" ? window.__pgReportError : '
      + '(typeof reportError === "function" ? reportError : undefined));';
  }

  return { mount: mount, toScript: toScript };
}));
