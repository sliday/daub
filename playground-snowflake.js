(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.DaubSnowflake = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var limits = Object.freeze({ maxDepth: 5, maxRequests: 24, maxElements: 160, maxTargets: 12, maxDurationMs: 120000, maxConcurrency: 4 });
  var defaultTypes = ('Stack Grid Surface Text Prose Separator Layout Divider Icon Link CheckboxGroup Fieldset Frame Group Meter NumberField PreviewCard Toolbar Button ButtonGroup Field Input InputGroup InputIcon Search Textarea Checkbox RadioGroup Switch Slider Toggle ToggleGroup Select CustomSelect Kbd Label Spinner InputOTP Tabs Breadcrumbs Pagination Stepper NavMenu Navbar Menubar Sidebar BottomNav Card Table DataTable List Badge Avatar AvatarGroup Calendar Chart Carousel AspectRatio Chip ScrollArea MessageScroller Message Bubble Attachment Marker ChangeSummary ChatComposer Image Alert Progress Skeleton EmptyState Tooltip Modal AlertDialog Sheet Drawer Popover HoverCard DropdownMenu ContextMenu CommandPalette Accordion Collapsible Resizable DatePicker StatCard ChartCard CustomHTML').split(' ');
  var presentation = new Set(('direction gap columns justify align valign wrap container variant size class className style width height ratio vertical horizontal flush clip attached inline position tag').split(' '));
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  var forbidden = function (key) { return key === '__proto__' || key === 'prototype' || key === 'constructor'; };

  class Stop extends Error {
    constructor(reason) { super(reason); this.reason = reason; }
  }

  function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === null || (Object.getPrototypeOf(proto) === null && own(proto, 'constructor') && proto.constructor.name === 'Object');
  }

  // Validate before copying: JSON.stringify would discard unsupported values and keys.
  function copy(value, ancestors) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!Array.isArray(value) && !record(value)) throw new Error('Spec values must be plain JSON data');
    ancestors = ancestors || new Set();
    if (ancestors.has(value)) throw new Error('Cyclic JSON data');
    ancestors.add(value);
    var array = Array.isArray(value), output = array ? [] : {};
    Reflect.ownKeys(value).forEach(function (key) {
      if (array && key === 'length') return;
      if (typeof key !== 'string' || forbidden(key)) throw new Error('Prototype or symbol keys are forbidden');
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !own(descriptor, 'value')) throw new Error('Spec properties must be enumerable data');
      if (array && !/^(0|[1-9][0-9]*)$/.test(key)) throw new Error('Invalid array property');
      output[key] = copy(descriptor.value, ancestors);
    });
    if (array && Object.keys(output).length !== value.length) throw new Error('Sparse arrays are invalid');
    ancestors.delete(value);
    return output;
  }

  function same(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    var keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(function (key) { return own(b, key) && same(a[key], b[key]); });
  }

  function id(value) { return typeof value === 'string' && value.trim().length > 0 && !forbidden(value); }

  function references(node, elements) {
    var props = node.props || {}, refs = [];
    function add(list) {
      if (!Array.isArray(list) || !list.every(id)) throw new Error('Children must be an array of valid IDs');
      refs.push.apply(refs, list);
    }
    if (own(node, 'children')) add(node.children);
    if (own(props, 'children')) {
      if (own(node, 'children')) {
        if (!same(node.children, props.children)) throw new Error('Conflicting children definitions');
      } else add(props.children);
    }
    var slots = node.type === 'Frame' ? ['header', 'footer'] : node.type === 'PreviewCard' ? ['trigger', 'media'] : ['Card', 'Modal', 'AlertDialog'].includes(node.type) ? ['footer'] : [];
    slots.forEach(function (slot) {
      if (!own(props, slot)) return;
      if (Array.isArray(props[slot])) add(props[slot]);
      else if (typeof props[slot] !== 'string' || ['Card', 'Modal', 'AlertDialog'].includes(node.type)) throw new Error('Invalid child slot: ' + slot);
    });
    if (node.type === 'Accordion' && own(props, 'items')) {
      if (!Array.isArray(props.items)) throw new Error('Accordion items must be an array');
      props.items.forEach(function (item) {
        if (!record(item)) throw new Error('Invalid Accordion item');
        if (own(item, 'children')) add(item.children);
      });
    }
    if (node.type === 'Table' || node.type === 'DataTable') {
      (Array.isArray(props.rows) ? props.rows : []).forEach(function (row) {
        if (!record(row) && !Array.isArray(row)) throw new Error('Invalid table row');
        Object.values(row).forEach(function (cell) {
          if (Array.isArray(cell) && cell.some(function (value) { return typeof value === 'string' && own(elements, value); })) add(cell);
        });
      });
    }
    return refs;
  }

  function validate(input, types) {
    var spec = copy(input);
    if (!record(spec) || !record(spec.elements) || !id(spec.root) || !own(spec.elements, spec.root)) throw new Error('Spec root must exist in elements');
    var ids = Object.keys(spec.elements), graph = new Map();
    if (ids.length > limits.maxElements) throw new Stop('element-limit');
    ids.forEach(function (key) {
      var node = spec.elements[key];
      if (!id(key) || !record(node) || typeof node.type !== 'string' || !types.has(node.type)) throw new Error('Invalid or unsupported element type: ' + key);
      if (own(node, 'props') && !record(node.props)) throw new Error('Element props must be an object: ' + key);
      if (node.type === 'Stack' && node.props && own(node.props, 'direction') && !['vertical', 'horizontal'].includes(node.props.direction)) throw new Error('Stack direction must be vertical or horizontal');
      var refs = references(node, spec.elements);
      refs.forEach(function (child) { if (!own(spec.elements, child)) throw new Error('Missing child: ' + child); });
      graph.set(key, refs);
    });
    var seen = new Set(), pending = [spec.root];
    while (pending.length) {
      var current = pending.pop();
      if (seen.has(current)) throw new Error('Spec must be a tree: cycle or duplicate parent at ' + current);
      seen.add(current);
      pending.push.apply(pending, graph.get(current));
    }
    if (seen.size !== ids.length) throw new Error('Spec contains orphan elements');
    return { spec: spec, graph: graph };
  }

  function descendants(graph, target) {
    var found = new Set(), pending = [target];
    while (pending.length) {
      var current = pending.pop();
      found.add(current);
      pending.push.apply(pending, graph.get(current));
    }
    return found;
  }

  // Existing content may gain detail, but must survive in order; presentation can change.
  function preserves(before, after) {
    if (before === null || before === '') return true;
    if (typeof before === 'string') return typeof after === 'string' && after.includes(before);
    if (Array.isArray(before)) {
      if (!Array.isArray(after)) return false;
      var cursor = 0;
      return before.every(function (value) {
        while (cursor < after.length && !preserves(value, after[cursor])) cursor++;
        return cursor++ < after.length;
      });
    }
    if (record(before)) return record(after) && Object.keys(before).every(function (key) { return own(after, key) && preserves(before[key], after[key]); });
    return before === after;
  }

  function merge(current, target, input, types) {
    var patch = copy(input), subtree = descendants(current.graph, target);
    if (!record(patch) || patch.root !== target || !record(patch.elements) || !own(patch.elements, target)) throw new Error('Refinement must include the unchanged target root ID');
    if (Object.keys(patch).some(function (key) { return key !== 'root' && key !== 'elements'; })) throw new Error('Scoped patches cannot change global metadata');
    var candidate = copy(current.spec);
    Object.keys(patch.elements).forEach(function (key) {
      if (own(candidate.elements, key) && !subtree.has(key)) throw new Error('Patch touches an element outside its target subtree: ' + key);
      candidate.elements[key] = patch.elements[key];
    });
    var validated = validate(candidate, types), nextSubtree = descendants(validated.graph, target);
    subtree.forEach(function (key) {
      if (!nextSubtree.has(key)) throw new Error('Patch removes an existing node: ' + key);
      var before = current.spec.elements[key], after = candidate.elements[key];
      if (before.type !== after.type) throw new Error('Patch changes an existing node type: ' + key);
      var children = validated.graph.get(key), cursor = 0;
      current.graph.get(key).forEach(function (child) {
        var index = children.indexOf(child, cursor);
        if (index < 0) throw new Error('Patch must preserve existing child order: ' + key);
        cursor = index + 1;
      });
      Object.keys(before.props || {}).forEach(function (prop) {
        if (prop === 'children' || presentation.has(prop)) return;
        if (prop === 'type' && ['Input', 'Field'].includes(before.type) && after.props && typeof after.props.type === 'string' && after.props.type.trim()) return;
        if (!preserves(before.props[prop], (after.props || {})[prop])) throw new Error('Patch removes existing content: ' + key + '.' + prop);
      });
      Object.keys(before).forEach(function (prop) {
        if (!['type', 'props', 'children'].includes(prop) && !preserves(before[prop], after[prop])) throw new Error('Patch removes existing node metadata: ' + key + '.' + prop);
      });
    });
    if (same(current.spec, validated.spec)) return current;
    return validated;
  }

  function decisions(answer, targets) {
    if (!record(answer) || !Array.isArray(answer.decisions) || answer.decisions.length !== targets.length) throw new Error('Judge must return one decision per target');
    var found = new Map();
    answer.decisions.forEach(function (decision) {
      if (!record(decision) || !targets.includes(decision.id) || found.has(decision.id) || typeof decision.needsDetail !== 'boolean' || !Number.isFinite(decision.probability) || decision.probability < 0 || decision.probability > 1) throw new Error('Invalid judge decision or probability');
      found.set(decision.id, decision.needsDetail);
    });
    return targets.filter(function (target) { return found.get(target); });
  }

  function fatal(error) {
    if (error instanceof Stop || error && error.name === 'AbortError') return true;
    if (!error) return false;
    if ([error.status, error.statusCode, error.code, error.response && error.response.status].some(function (status) { return [401, 402, 403, 429].includes(Number(status)); })) return true;
    var providerFailure = /rate[ _-]?limit|quota|\bcredits?\b|unauthori[sz]ed|forbidden|authentication|invalid[ _-]?(?:api[ _-]?)?key|insufficient[ _-]funds/i;
    if (providerFailure.test([error.code, error.type].join(' '))) return true;
    if (error.name === 'SyntaxError' || error.name === 'ValidationError') return false;
    return providerFailure.test(error.message || String(error));
  }

  /** measure({spec, targets, depth, signal}) runs after onSpec; errors carry partialSpec.
   * initialSpec starts at the root; fresh layouts start at root children when present.
   * Limit exits resolve; external aborts reject. No completion hook runs after abort/deadline.
   * Each callback receives a detached snapshot. No hook starts after cancellation.
   * Each flagged target gets one repair and a same-depth batch recheck, then children.
   * Up to three independent branches share a level snapshot; merge/publication is serial.
   * No measure/judge hook runs during that batch, keeping host-captured geometry stable.
   * Branch events: refine (start), refined (including no-op), branch-error (reason).
   * Isolated generator/patch failures return failedTargets and reason: partial; no retries.
   * Fatal provider/hook errors abort and drain workers; errors also carry failedTargets.
   * maxTargets caps each judge batch, not the breadth of a level.
   * Final ancestor audits use the same judge/measure callbacks and 24-request budget.
   * scheduling: queue expands independent branches without a level barrier. concurrency
   * defaults to three (1-4); judge and generator jobs share these slots. Preview capture
   * and publication share a lock, while provider calls run outside it.
   */
  async function run(options) {
    options = options || {};
    var prompt = options.prompt, generate = options.generate, judge = options.judge;
    var measure = options.measure, onProgress = options.onProgress, onSpec = options.onSpec;
    var external = options.signal, controller = new AbortController(), signal = controller.signal;
    var now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? function () { return performance.now(); } : function () { return Date.now(); };
    var deadline = now() + limits.maxDurationMs, current = null, depth = 0, requests = 0, failedTargets = new Set();
    function stop(error) { if (!signal.aborted) controller.abort(error); }
    function cancel() {
      var error = new Error('Snowflake run aborted'); error.name = 'AbortError';
      controller.abort(error);
    }
    function expire() { if (!signal.aborted) controller.abort(new Stop('time-limit')); }
    var timer = setTimeout(expire, limits.maxDurationMs);
    if (external) {
      if (external.aborted) cancel();
      else external.addEventListener('abort', cancel, { once: true });
    }
    function check() {
      if (now() >= deadline) expire();
      if (signal.aborted) throw signal.reason;
    }
    async function invoke(callback, args) {
      check();
      var onAbort;
      try {
        var value = await Promise.race([
          new Promise(function (_, reject) {
            onAbort = function () { reject(signal.reason); };
            signal.addEventListener('abort', onAbort, { once: true });
          }),
          Promise.resolve().then(function () {
            check();
            try { return callback(args); }
            catch (error) { if (fatal(error)) stop(error); throw error; }
          }).catch(function (error) { if (fatal(error)) stop(error); throw error; }),
        ]);
        check();
        return value;
      } catch (error) { check(); throw error; }
      finally { signal.removeEventListener('abort', onAbort); }
    }
    async function progress(phase, targetId, reason, eventDepth) {
      check();
      if (!onProgress) return;
      var event = { phase: phase, depth: eventDepth == null ? depth : eventDepth, requests: requests };
      if (targetId != null) event.targetId = targetId;
      if (reason) event.reason = reason;
      await invoke(onProgress, event);
    }
    async function publish(validated) {
      check();
      current = validated;
      if (onSpec) await invoke(onSpec, copy(current.spec));
      check();
    }
    function reserve() {
      check();
      if (requests >= limits.maxRequests) throw new Stop('request-limit');
      requests++;
    }
    async function request(callback, args) {
      reserve();
      return invoke(callback, args);
    }
    function snapshot() { return current ? copy(current.spec) : null; }
    async function refineBatch(targets, targetDepth, types) {
      var common = snapshot(), cursor = 0, exhausted = false, publication = Promise.resolve();
      async function refine(target) {
        await progress('refine', target, null, targetDepth);
        try {
          var patch = copy(await invoke(generate, { stage: 'refine', prompt: prompt, spec: copy(common), targetId: target, depth: targetDepth, signal: signal }));
          var committed = publication.then(async function () {
            check();
            var refined;
            try { refined = merge(current, target, patch, types); }
            catch (error) { if (error instanceof Stop) stop(error); throw error; }
            try { if (refined !== current) await publish(refined); }
            catch (error) { stop(error); throw error; }
          });
          // A rejected patch must release the queue so independent siblings can commit.
          publication = committed.catch(function () {});
          await committed;
        } catch (error) {
          check();
          failedTargets.add(target);
          await progress('branch-error', target, error && error.message || String(error), targetDepth);
          return;
        }
        await progress('refined', target, null, targetDepth);
      }
      async function worker() {
        try {
          while (cursor < targets.length) {
            check();
            if (requests >= limits.maxRequests) { exhausted = true; return; }
            var target = targets[cursor++];
            reserve();
            await refine(target);
          }
        } catch (error) { stop(error); }
      }
      var workers = [];
      for (var index = 0; index < Math.min(3, targets.length); index++) workers.push(worker());
      // invoke races signal-ignoring hooks; drain managed workers and queued commits.
      await Promise.all(workers);
      await publication;
      check();
      if (exhausted) throw new Stop('request-limit');
      return targets.filter(function (target) { return !failedTargets.has(target); });
    }
    async function assess(targets, targetDepth) {
      var selected = [];
      for (var offset = 0; offset < targets.length; offset += limits.maxTargets) {
        check();
        if (requests >= limits.maxRequests) throw new Stop('request-limit');
        var batch = targets.slice(offset, offset + limits.maxTargets);
        await progress('judge', null, null, targetDepth);
        var geometry = measure ? await invoke(measure, { spec: snapshot(), targets: batch.slice(), depth: targetDepth, signal: signal }) : null;
        if (geometry != null) {
          geometry = copy(geometry);
          if (!record(geometry) || geometry.stable === false) throw new Error('Measured geometry must be stable');
        } else geometry = null;
        var answer = await request(judge, { prompt: prompt, spec: snapshot(), targets: batch.slice(), depth: targetDepth, geometry: geometry, signal: signal });
        selected.push.apply(selected, decisions(answer, batch));
      }
      return selected;
    }
    async function refineQueue(frontier, startDepth, types, ancestors, unresolved) {
      var queue = [], activeJobs = new Set(), visited = new Set(), sequence = Promise.resolve();
      var concurrency = options.concurrency == null ? 3 : options.concurrency;
      var exhausted = false, depthLimited = false;
      function exclusive(callback) {
        var pending = sequence.then(function () { check(); return callback(); });
        sequence = pending.catch(function () {});
        return pending;
      }
      async function report() {
        if (onProgress) await invoke(onProgress, { phase: 'queue', depth: depth, requests: requests, queued: queue.length, active: activeJobs.size, concurrency: concurrency });
      }
      function enqueue(phase, targets, targetDepth) {
        for (var offset = 0; offset < targets.length; offset += limits.maxTargets) {
          queue.push({ phase: phase, targets: targets.slice(offset, offset + limits.maxTargets), depth: targetDepth });
        }
      }
      async function capture(job) {
        return exclusive(async function () {
          var spec = snapshot();
          var geometry = measure ? await invoke(measure, { spec: copy(spec), targets: job.targets.slice(), depth: job.depth, signal: signal }) : null;
          if (geometry != null) {
            geometry = copy(geometry);
            if (!record(geometry) || geometry.stable === false) throw new Error('Measured geometry must be stable');
          }
          return { spec: spec, geometry: geometry };
        });
      }
      async function execute(job) {
        depth = Math.max(depth, job.depth);
        if (job.phase === 'refine') {
          var target = job.targets[0];
          await progress('refine', target, null, job.depth);
          try {
            var patch = await invoke(generate, { stage: 'refine', prompt: prompt, spec: copy(job.spec), targetId: target, depth: job.depth, geometry: copy(job.geometry), signal: signal });
            await exclusive(async function () {
              var refined;
              try { refined = merge(current, target, patch, types); }
              catch (error) { if (error instanceof Stop) stop(error); throw error; }
              try { if (refined !== current) await publish(refined); }
              catch (error) { stop(error); throw error; }
            });
          } catch (error) {
            check();
            failedTargets.add(target);
            await progress('branch-error', target, error && error.message || String(error), job.depth);
            return;
          }
          await progress('refined', target, null, job.depth);
          enqueue('recheck', [target], job.depth);
          return;
        }
        await progress('judge', null, null, job.depth);
        var captured = await capture(job);
        var answer = await invoke(judge, { prompt: prompt, spec: copy(captured.spec), targets: job.targets.slice(), depth: job.depth, geometry: copy(captured.geometry), signal: signal });
        var selected = decisions(answer, job.targets);
        if (job.phase === 'judge') {
          selected.forEach(function (target) {
            if (visited.has(target)) return;
            visited.add(target);
            queue.push({ phase: 'refine', targets: [target], depth: job.depth, spec: captured.spec, geometry: captured.geometry });
          });
        } else {
          job.targets.forEach(function (target) {
            if (selected.includes(target)) unresolved.add(target);
            else unresolved.delete(target);
            var children = current.graph.get(target);
            if (!children.length) return;
            ancestors.set(target, job.depth);
            if (job.depth >= limits.maxDepth) { depthLimited = true; return; }
            enqueue('judge', children, job.depth + 1);
          });
        }
      }
      enqueue('judge', frontier, startDepth);
      try {
        while (queue.length || activeJobs.size) {
          check();
          while (queue.length && activeJobs.size < concurrency && requests < limits.maxRequests) {
            var job = queue.shift();
            reserve();
            var token = {};
            token.promise = Promise.resolve().then(execute.bind(null, job)).catch(function (error) { stop(error); }).finally(function (finished) {
              activeJobs.delete(finished);
            }.bind(null, token));
            activeJobs.add(token);
          }
          await report();
          if (!activeJobs.size) {
            if (queue.length && requests < limits.maxRequests) continue;
            exhausted = queue.length > 0;
            break;
          }
          await Promise.race(Array.from(activeJobs, function (task) { return task.promise; }));
        }
        check();
        if (exhausted) throw new Stop('request-limit');
        if (depthLimited) throw new Stop('depth-limit');
      } catch (error) { stop(error); throw error; }
      finally {
        await Promise.all(Array.from(activeJobs, function (task) { return task.promise; }));
        await sequence;
      }
    }
    try {
      check();
      if (typeof prompt !== 'string' || !prompt.trim() || typeof generate !== 'function' || typeof judge !== 'function') throw new Error('prompt, generate and judge are required');
      [measure, onProgress, onSpec].forEach(function (hook) { if (hook != null && typeof hook !== 'function') throw new Error('Hooks must be functions'); });
      if (options.scheduling != null && !['queue', 'level'].includes(options.scheduling)) throw new Error('scheduling must be queue or level');
      if (options.concurrency != null && (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > limits.maxConcurrency)) throw new Error('concurrency must be an integer from 1 to 4');
      var supplied = options.validTypes == null ? defaultTypes : options.validTypes;
      if (!Array.isArray(supplied) && Object.prototype.toString.call(supplied) !== '[object Set]') throw new Error('validTypes must be an array or Set');
      var types = new Set(supplied);
      if (!types.size || !Array.from(types).every(id)) throw new Error('validTypes must contain supported type names');
      var reason;
      try {
        await progress('layout');
        var initial = options.initialSpec == null ? await request(generate, { stage: 'layout', prompt: prompt, spec: null, targetId: null, depth: 0, signal: signal }) : options.initialSpec;
        await publish(validate(initial, types));
        var frontier = [current.spec.root], ancestors = new Map(), unresolved = new Set();
        if (options.initialSpec == null && current.graph.get(current.spec.root).length) {
          ancestors.set(current.spec.root, 0);
          frontier = current.graph.get(current.spec.root).slice();
          depth = 1;
        }
        if (options.scheduling === 'queue') {
          await refineQueue(frontier, depth, types, ancestors, unresolved);
        } else while (frontier.length) {
          check();
          var selected = await assess(frontier, depth);
          if (!selected.length) break;
          var next = [];
          var succeeded = await refineBatch(selected, depth, types);
          for (var target of succeeded) {
            var children = current.graph.get(target);
            if (children.length) ancestors.set(target, depth);
            next.push.apply(next, children);
          }
          var remaining = succeeded.length ? await assess(succeeded, depth) : [];
          remaining.forEach(function (target) { unresolved.add(target); });
          if (depth === limits.maxDepth && next.length) throw new Stop('depth-limit');
          if (!next.length) break;
          frontier = next;
          depth++;
        }
        // Descendant repairs can clear an earlier parent flag. Audit each ancestor once.
        for (var auditDepth = 0; auditDepth <= limits.maxDepth; auditDepth++) {
          var targets = Array.from(ancestors.keys()).filter(function (target) { return ancestors.get(target) === auditDepth; });
          if (!targets.length) continue;
          var pending = new Set(await assess(targets, auditDepth));
          targets.forEach(function (target) {
            if (pending.has(target)) unresolved.add(target);
            else unresolved.delete(target);
          });
        }
        reason = failedTargets.size ? 'partial' : unresolved.size ? 'no-progress' : 'complete';
      } catch (error) {
        if (!(error instanceof Stop)) throw error;
        reason = error.reason;
      }
      if (!signal.aborted) {
        try { await progress('done', null, reason); }
        catch (error) { if (!(error instanceof Stop)) throw error; reason = error.reason; }
      }
      return { spec: snapshot(), reason: reason, depth: depth, requests: requests, failedTargets: Array.from(failedTargets) };
    } catch (error) {
      stop(error);
      if (!error || typeof error !== 'object') error = new Error(String(error));
      if (!Object.isExtensible(error)) error = Object.assign(new Error(error.message), { name: error.name, cause: error, status: error.status });
      error.partialSpec = snapshot(); error.depth = depth; error.requests = requests;
      error.failedTargets = Array.from(failedTargets);
      throw error;
    } finally {
      clearTimeout(timer);
      if (external) external.removeEventListener('abort', cancel);
    }
  }

  return Object.freeze({ run: run, limits: limits });
}));
