(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.DaubBehavior = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // Keep mount self-contained: exported pages embed this function without the module.
  function mount(preview, program, reportError) {
    'use strict';
    var key = '__daubBehaviorController';
    var state, reduce, render, output, cleanup, view, publicAPI, visibilityStyle, visibilityClass;
    var active = true, busy = true, queue = [], listeners = [];
    var snapshot = null, subscribers = new Set();

    function report(error, phase) {
      var contextual = new Error('DaubBehavior ' + phase + ': ' + String(error && error.message || error));
      contextual.cause = error;
      contextual.phase = phase;
      try {
        if (typeof reportError === 'function') reportError(contextual);
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

    function synchronous(value, phase) {
      if (value && typeof value.then === 'function') {
        Promise.resolve(value).catch(function(error) { if (active) report(error, phase); });
        throw new TypeError(phase + ' must be synchronous');
      }
      return value;
    }

    function dispose() {
      if (!active) return;
      active = false;
      queue.length = 0;
      snapshot = null;
      subscribers.clear();
      if (visibilityStyle) visibilityStyle.remove();
      if (visibilityClass) preview.classList.remove(visibilityClass);
      listeners.splice(0).forEach(function(remove) { remove(); });
      if (preview && preview[key] === controller) delete preview[key];
      if (view && Object.getOwnPropertyDescriptor(view, 'DaubPrototype')?.value === publicAPI) delete view.DaubPrototype;
      if (typeof cleanup === 'function') {
        var fn = cleanup;
        cleanup = null;
        try {
          var result = fn();
          if (result && typeof result.then === 'function') Promise.resolve(result).catch(function(error) { report(error, 'cleanup'); });
        } catch (error) { report(error, 'cleanup'); }
      }
    }

    function get(id) {
      if (!active) return null;
      if (typeof id !== 'string') throw new TypeError('UI id must be a string');
      if (preview.getAttribute && preview.getAttribute('data-spec-id') === id) return preview;
      var element = Array.from(preview.querySelectorAll('[data-spec-id]')).find(function(element) {
        return element.getAttribute('data-spec-id') === id;
      });
      if (!element) throw new Error('Missing UI element: ' + id);
      return element;
    }

    var ui = Object.freeze({
      preview: preview,
      get: get,
      input: function(id) {
        var element = get(id);
        if (!element) return null;
        var input = element.matches('input,select,textarea') ? element : element.querySelector('input,select,textarea');
        if (!input) throw new Error('Missing native input: ' + id);
        return input;
      },
      text: function(id, value) {
        var element = get(id);
        if (element) element.textContent = value == null ? '' : String(value);
      },
      on: function(id, event, handler) {
        if (!active) return function() {};
        var element = get(id);
        if (!element) throw new Error('Missing UI element: ' + id);
        if (typeof event !== 'string' || !event || typeof handler !== 'function') throw new TypeError('Expected an event name and handler');
        var attached = true;
        function wrapped(e) {
          if (!active || !attached) return;
          try {
            var result = handler.call(element, e);
            if (result && typeof result.then === 'function') Promise.resolve(result).catch(function(error) {
              if (active && attached) report(error, 'event ' + event);
            });
          } catch (error) { report(error, 'event ' + event); }
        }
        function remove() {
          if (!attached) return;
          attached = false;
          element.removeEventListener(event, wrapped);
          var index = listeners.indexOf(remove);
          if (index !== -1) listeners.splice(index, 1);
        }
        element.addEventListener(event, wrapped);
        listeners.push(remove);
        return remove;
      }
    });

    function getOutput() {
      return snapshot === null ? null : clone(snapshot);
    }

    function notify(listener) {
      try { synchronous(listener(getOutput()), 'subscribe'); }
      catch (error) { report(error, 'subscribe'); }
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Expected an output listener');
      if (!active) return function() {};
      var entry = function(value) { return listener(value); };
      subscribers.add(entry);
      if (snapshot !== null) notify(entry);
      return function() { subscribers.delete(entry); };
    }

    function publish() {
      Array.from(subscribers).forEach(function(listener) {
        if (active && subscribers.has(listener)) notify(listener);
      });
    }

    function draw() {
      snapshot = null;
      var phase = 'render';
      try {
        synchronous(render(state, ui), 'render');
        if (!active) return false;
        if (output) {
          phase = 'output';
          var value = synchronous(output(state), 'output');
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('output must return a plain JSON object');
          var next = clone(value);
          if (!active) return false;
          snapshot = next;
          publish();
        }
        return true;
      } catch (error) {
        snapshot = null;
        report(error, phase);
        if (active) publish();
        return false;
      }
    }

    function drain() {
      if (busy || !active) return;
      busy = true;
      var transitions = 0;
      try {
        while (active && queue.length) {
          if (++transitions > 1000) {
            dispose();
            report(new Error('Exceeded 1000 queued transitions'), 'dispatch');
            break;
          }
          var action = queue.shift(), next;
          try { next = clone(synchronous(reduce(state, action), 'reduce')); }
          catch (error) { report(error, 'reduce'); continue; }
          if (!active) break;
          state = next;
          draw();
        }
      } finally { busy = false; }
    }

    function dispatch(action) {
      if (!active) return;
      try { queue.push(clone(action)); }
      catch (error) { report(error, 'dispatch'); return; }
      drain();
    }

    var controller = Object.freeze({
      dispatch: dispatch,
      getState: function() { return state === undefined ? undefined : clone(state); },
      getOutput: getOutput,
      subscribe: subscribe,
      dispose: dispose
    });

    var phase = 'initialize';
    try {
      if (!preview || typeof preview.querySelectorAll !== 'function') throw new TypeError('Expected a preview element');
      var previous = preview[key];
      Object.defineProperty(preview, key, { value: controller, configurable: true });
      view = preview.ownerDocument && preview.ownerDocument.defaultView;
      publicAPI = Object.freeze({ getOutput: getOutput, subscribe: subscribe });
      if (view) Object.defineProperty(view, 'DaubPrototype', { value: publicAPI, configurable: true, writable: false });
      if (previous) previous.dispose();
      if (!active) return controller;
      if (!program || typeof program !== 'object') throw new TypeError('Expected a behavior program');
      state = clone(program.initial);
      function compile(name, parameters) {
        if (typeof program[name] !== 'string') throw new TypeError(name + ' must be a function body string');
        return new Function(parameters, '"use strict";\n' + program[name]);
      }
      reduce = compile('reduce', 'state,action');
      render = compile('render', 'state,ui');
      var bind = compile('bind', 'ui,dispatch');
      if ('output' in program) {
        phase = 'output';
        output = compile('output', 'state');
      }
      if (preview.ownerDocument && preview.classList) {
        visibilityClass = 'db-behavior-' + Math.random().toString(36).slice(2);
        preview.classList.add(visibilityClass);
        visibilityStyle = preview.ownerDocument.createElement('style');
        visibilityStyle.textContent = '.' + visibilityClass + '[hidden],.' + visibilityClass + ' [hidden]{display:none!important}';
        (preview.ownerDocument.head || preview).appendChild(visibilityStyle);
      }
      phase = 'render';
      if (!draw()) {
        dispose();
        return controller;
      }
      if (active) {
        phase = 'bind';
        var bound = synchronous(bind(ui, dispatch), 'bind');
        if (bound != null && typeof bound !== 'function') throw new TypeError('bind must return a cleanup function or nothing');
        cleanup = bound;
        // A binding can synchronously remount the preview before returning its cleanup.
        if (!active && cleanup) {
          var lateCleanup = cleanup;
          cleanup = null;
          phase = 'cleanup';
          synchronous(lateCleanup(), 'cleanup');
        }
      }
      busy = false;
      drain();
    } catch (error) {
      dispose();
      report(error, phase);
    }
    return controller;
  }

  // Evaluate in a scope with preview (or default to document.body) and optional reportError.
  function toScript(program) {
    var json = JSON.stringify(program);
    if (json === undefined) throw new TypeError('Expected a behavior program');
    var literal = JSON.stringify(json).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return '(' + mount.toString() + ')(typeof preview !== "undefined" ? preview : document.body, JSON.parse(' + literal + '), '
      + 'typeof window !== "undefined" && typeof window.__pgReportError === "function" ? window.__pgReportError : '
      + '(typeof reportError === "function" ? reportError : undefined))';
  }

  return { mount: mount, toScript: toScript };
}));
