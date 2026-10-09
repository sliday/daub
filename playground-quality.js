(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DaubQuality = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function audit(spec) {
    if (!spec || !spec.elements || !spec.elements[spec.root]) return ['Missing page root'];
    return Object.keys(spec.elements).filter(function(id) {
      var node = spec.elements[id];
      return ['Stack', 'Grid'].includes(node.type) && !(node.children || node.props && node.props.children || []).length;
    }).map(function(id) { return 'Empty layout region: ' + id; });
  }

  function parseStateDefs(stateArray) {
    if (stateArray == null) return '';
    if (!Array.isArray(stateArray)) throw new Error('State definitions must be an array');
    var names = new Set(), definitions = [];
    for (var index = 0; index < stateArray.length; index++) {
      var entry = stateArray[index];
      var match = typeof entry === 'string' && entry.trim().match(/^\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s+([\s\S]+)\)$/);
      if (!match) throw new Error('Invalid state definition at index ' + index);
      var name = match[1], literal = match[2].trim();
      try { new Function('"use strict"; let ' + name + ';'); }
      catch (error) { throw new Error('Invalid state identifier at index ' + index); }
      if (name === 'await') throw new Error('Invalid state identifier at index ' + index);
      if (names.has(name)) throw new Error('Duplicate state identifier: ' + name);
      try {
        JSON.parse(literal, function(key, value) {
          if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite number');
          return value;
        });
      } catch (error) { throw new Error('State value must be a JSON literal at index ' + index); }
      names.add(name);
      // Parse again in the sandbox to preserve JSON object keys and negative zero.
      definitions.push('window.' + name + ' = JSON.parse(' + JSON.stringify(literal) + ');');
    }
    return definitions.join('\n');
  }

  // Shared declarations and chunk closures need one lexical scope inside the sandbox.
  function executeCustomJS(preview, items, reportError) {
    var shared = [], chunks = [], invalidShared = false;
    function reportItemError(error, index) {
      var id = index == null ? '_shared_state' : items[index].id || '#' + (index + 1);
      var contextual = new Error('CustomHTML ' + id + ': ' + String(error && error.message || error), { cause: error });
      contextual.name = error && error.name || 'Error';
      reportError(contextual);
    }
    items.forEach(function(item, index) {
      try {
        if (typeof item.code !== 'string') throw new TypeError('CustomHTML code must be a string');
        new Function('container', 'preview', item.code);
      } catch (error) {
        if (item.id === '_shared_state') invalidShared = true;
        reportItemError(error, index); return;
      }
      if (item.id === '_shared_state') shared.push(item.code);
      else chunks.push('try { (function(container, preview) {\n' + item.code + '\n})(getContainer(' + index + '), preview); } catch(error) { reportError(error, ' + index + '); }');
    });
    if (invalidShared) return;
    function getContainer(index) {
      var id = items[index].id;
      return id ? Array.from(preview.querySelectorAll('[data-spec-id]')).find(function(el) { return el.getAttribute('data-spec-id') === id; }) || preview : preview;
    }
    try {
      new Function('preview', 'container', 'getContainer', 'reportError', shared.join('\n') + '\n' + chunks.join('\n'))(preview, preview, getContainer, reportItemError);
    } catch (error) { reportItemError(error); }
  }

  function installHealthTracking(onError) {
    window.__pgRuntimeErrors = [];
    window.__pgReportError = function(error) {
      var message = String(error && error.message || error).slice(0, 300);
      if (window.__pgRuntimeErrors.length < 20 && !window.__pgRuntimeErrors.includes(message)) {
        window.__pgRuntimeErrors.push(message);
        if (onError) onError(message);
      }
    };
    window.addEventListener('error', function(event) { if (event.error) window.__pgReportError(event.error); });
    window.addEventListener('unhandledrejection', function(event) { window.__pgReportError(event.reason); });
  }

  return { audit: audit, executeCustomJS: executeCustomJS, installHealthTracking: installHealthTracking, parseStateDefs: parseStateDefs };
}));
