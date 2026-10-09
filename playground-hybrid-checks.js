(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DaubHybridChecks = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // Keep helpers inside probe: the sandbox injects probe.toString() without this module.
  async function probe(root, request, replyOrigin) {
    var doc = root.ownerDocument || root, win = doc.defaultView;
    var viewport = { width: win.innerWidth, height: win.innerHeight };
    var evidence = { complete: true, defects: [], checks: [], geometry: { viewport: viewport, elements: [] }, text: '', screenshot: null };
    var defectIds = new Set(), memory = new Map(), restore = [], blocked = [];
    var activeTarget = 'document';

    function defect(kind, targetId, message) {
      var id = JSON.stringify([viewport.width, kind, targetId]);
      if (defectIds.has(id)) return;
      defectIds.add(id);
      evidence.defects.push({ id: id, targetId: targetId, kind: kind, message: String(message).slice(0, 2000) });
    }
    function bounded(value, name, limit, empty) {
      if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > limit) throw new Error('Invalid ' + name + ' (maximum ' + limit + ' characters)');
    }
    function nodes(selector) {
      var result = Array.from(root.querySelectorAll(selector));
      if (root.matches && root.matches(selector)) result.unshift(root);
      return result;
    }
    function identified() { return nodes('[data-spec-id]'); }
    function target(id) {
      var found = identified().filter(function(el) { return el.getAttribute('data-spec-id') === id; });
      if (found.length !== 1) throw new Error((found.length ? 'Ambiguous' : 'Missing') + ' target: ' + id);
      return found[0];
    }
    function owner(el) {
      var parent = el.closest('[data-spec-id]');
      return parent && (parent === root || root.contains(parent)) ? parent.getAttribute('data-spec-id') : 'document';
    }
    function text(el) {
      return String(typeof el.innerText === 'string' ? el.innerText : el.textContent || '').trim();
    }
    function visible(el) {
      for (var node = el; node && node.nodeType === 1; node = node.parentElement) {
        var style = win.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) return false;
        if (node.tagName === 'DETAILS' && !node.open && el !== node) {
          var summary = node.querySelector('summary');
          if (!summary || !summary.contains(el)) return false;
        }
      }
      return Array.from(el.getClientRects()).some(function(rect) { return rect.width > 0 && rect.height > 0; }) ||
        win.getComputedStyle(el).display === 'contents' && Array.from(el.children).some(visible);
    }
    async function tick() {
      await new Promise(function(resolve) { win.setTimeout(resolve, 32); });
    }
    async function settle() {
      var deadline = Date.now() + 1000;
      while ((doc.fonts && doc.fonts.status === 'loading' || nodes('img').some(function(img) { return !img.complete; })) && Date.now() < deadline) {
        await new Promise(function(resolve) { win.setTimeout(resolve, Math.min(25, Math.max(0, deadline - Date.now()))); });
      }
      if (doc.fonts && doc.fonts.status === 'loading') {
        evidence.complete = false;
        defect('unsettled-fonts', 'document', 'Fonts did not settle within 1000ms');
      }
      nodes('img').forEach(function(img) {
        if (!img.complete) {
          evidence.complete = false;
          defect('unsettled-image', owner(img), 'Image did not settle within 1000ms');
        }
      });
      await tick();
    }
    function inspectClipping(documentOverflows) {
      var styles = new Map(), tolerance = 2;
      function styleOf(el) {
        if (!styles.has(el)) styles.set(el, win.getComputedStyle(el));
        return styles.get(el);
      }
      function check(el, rects, isText) {
        if (!visible(el)) return;
        var chain = [], truncated = false, fixed = false;
        for (var node = el; node; node = node.parentElement) {
          var style = styleOf(node);
          // Non-rectangular paint and transformed coordinate systems need a visual check.
          if (node.namespaceURI !== 'http://www.w3.org/1999/xhtml' || style.transform !== 'none' ||
              style.rotate && style.rotate !== 'none' || style.scale && style.scale !== 'none' ||
              style.translate && style.translate !== 'none' || style.zoom && Number(style.zoom) !== 1 ||
              style.clip !== 'auto' || style.clipPath !== 'none' || style.maskImage && style.maskImage !== 'none') return;
          if (style.textOverflow === 'ellipsis' || parseInt(style.webkitLineClamp, 10) > 0 || parseInt(style.lineClamp, 10) > 0) truncated = true;
          if (style.position === 'fixed') fixed = true;
          chain.push(node);
        }
        if (isText && truncated) return;
        rects.forEach(function(rect) {
          if (rect.width <= tolerance || rect.height <= tolerance) return;
          var left = rect.left, right = rect.right, top = rect.top, bottom = rect.bottom;
          var loss = '', scrollX = false, scrollY = false, containingBlock = null, escaped = false;
          function clip(box, x, y, reportX, reportY, label) {
            if (reportX && (left < box.left - tolerance || right > box.right + tolerance) ||
                reportY && (top < box.top - tolerance || bottom > box.bottom + tolerance)) loss = loss || label;
            if (x) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
            if (y) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
          }
          chain.forEach(function(ancestor) {
            var style = styleOf(ancestor);
            if (ancestor === containingBlock) containingBlock = null;
            // Positioned descendants can escape clips between them and their containing block.
            if (!escaped && !containingBlock && (isText || ancestor !== el) && ancestor !== doc.body && ancestor !== doc.documentElement &&
                style.display !== 'inline' && style.display !== 'contents') {
              var xScroll = /^(auto|scroll|overlay)$/.test(style.overflowX);
              var yScroll = /^(auto|scroll|overlay)$/.test(style.overflowY);
              var xClip = /^(hidden|clip)$/.test(style.overflowX);
              var yClip = /^(hidden|clip)$/.test(style.overflowY);
              // A nonzero clip margin changes the paint edge; leave it to visual review.
              if (parseFloat(style.overflowClipMargin) > 0) {
                if (style.overflowX === 'clip') xClip = false;
                if (style.overflowY === 'clip') yClip = false;
              }
              if (xClip || yClip || xScroll || yScroll) {
                var bounds = ancestor.getBoundingClientRect();
                var box = { left: bounds.left + ancestor.clientLeft, top: bounds.top + ancestor.clientTop };
                box.right = box.left + ancestor.clientWidth;
                box.bottom = box.top + ancestor.clientHeight;
                clip(box, xClip || xScroll, yClip || yScroll, xClip && !scrollX, yClip && !scrollY, 'box of ' + owner(ancestor));
              }
              scrollX = scrollX || xScroll;
              scrollY = scrollY || yScroll;
            }
            if (style.position === 'fixed') escaped = true;
            if (style.position === 'absolute') containingBlock = ancestor.offsetParent;
          });
          // Normal vertical document scrolling is not a layout defect. Only inspect painted fragments.
          clip({ left: 0, top: 0, right: doc.documentElement.clientWidth || viewport.width, bottom: viewport.height },
            true, true, !documentOverflows && !scrollX, fixed && !scrollY, 'viewport');
          if (loss && right - left > tolerance && bottom - top > tolerance) {
            defect(isText ? 'clipped-text' : 'clipped-control', owner(el), (isText ? 'Text' : 'Control') + ' clipped by ' + loss + ' (more than ' + tolerance + 'px)');
          }
        });
      }
      nodes('*').forEach(function(el) {
        if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || el.closest('svg, script, style, noscript, template')) return;
        if (el.matches('button, input:not([type="hidden"]), textarea, select, a[href], [role="button"]')) check(el, Array.from(el.getClientRects()), false);
        if (el.closest('input, textarea, select')) return;
        var rects = [];
        Array.from(el.childNodes).forEach(function(child) {
          if (child.nodeType !== 3 || !child.textContent.trim()) return;
          var range = doc.createRange(), value = child.textContent;
          range.setStart(child, value.length - value.trimStart().length);
          range.setEnd(child, value.trimEnd().length);
          rects.push.apply(rects, Array.from(range.getClientRects()));
        });
        if (rects.length) check(el, rects, true);
      });
    }
    function inspect() {
      var width = doc.documentElement.clientWidth || viewport.width;
      var scrollWidth = Math.max(doc.documentElement.scrollWidth, doc.body ? doc.body.scrollWidth : 0);
      if (scrollWidth - width > 1) defect('horizontal-overflow', 'document', 'Document overflows by ' + (scrollWidth - width) + 'px');
      inspectClipping(scrollWidth - width > 1);
      var seen = new Set();
      identified().forEach(function(el) {
        var id = el.getAttribute('data-spec-id');
        if (seen.has(id)) defect('duplicate-id', id, 'Duplicate data-spec-id: ' + id);
        seen.add(id);
      });
      nodes('img').forEach(function(img) {
        if (img.complete && img.naturalWidth === 0) defect('broken-image', owner(img), 'Image failed to load: ' + (img.getAttribute('src') || img.getAttribute('srcset') || '(empty source)'));
      });
      nodes('[data-render-error]').forEach(function(el) { defect('render-error', owner(el), el.getAttribute('data-render-error') || 'Render failed'); });
      var errors = win.__pgRuntimeErrors;
      if (Array.isArray(errors) && errors.length) defect('runtime-error', 'document', errors.map(function(error) { return String(error && error.message || error); }).join('\n'));
    }
    function measure() {
      evidence.geometry.elements = identified().map(function(el) {
        var bounds = el.getBoundingClientRect(), style = win.getComputedStyle(el);
        var parent = el.parentElement && el.parentElement.closest('[data-spec-id]');
        return {
          id: el.getAttribute('data-spec-id'),
          parentId: parent && (parent === root || root.contains(parent)) ? parent.getAttribute('data-spec-id') : null,
          bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
          text: text(el).slice(0, 2000), visible: visible(el),
          layout: { display: style.display, position: style.position, overflowX: style.overflowX, overflowY: style.overflowY, flexDirection: style.flexDirection, gap: style.gap, gridTemplateColumns: style.gridTemplateColumns }
        };
      });
      evidence.text = text(root.nodeType === 9 ? doc.body : root).slice(0, 20000);
    }
    function control(el, selector) {
      if (el.matches(selector)) return el;
      var found = el.querySelectorAll(selector);
      if (found.length !== 1) throw new Error('Expected one ' + selector + ' control in ' + activeTarget);
      return found[0];
    }
    function enabled(el) {
      if (el.matches(':disabled') || el.closest('[inert], [aria-disabled="true"]')) throw new Error('Disabled target: ' + activeTarget);
    }
    function state(el) {
      var controls = el.matches('input, textarea, select') ? [el] : Array.from(el.querySelectorAll('input, textarea, select'));
      return JSON.stringify({ text: text(el), values: controls.map(function(input) {
        return { value: input.value, checked: input.matches('input[type="checkbox"], input[type="radio"]') ? input.checked : null };
      }) });
    }
    function emit(el) {
      el.dispatchEvent(new win.Event('input', { bubbles: true }));
      el.dispatchEvent(new win.Event('change', { bubbles: true }));
    }
    function guard(object, key, replacement) {
      if (!object || typeof object[key] !== 'function') return;
      var descriptor = Object.getOwnPropertyDescriptor(object, key), original = object[key];
      Object.defineProperty(object, key, { configurable: true, writable: true, value: replacement });
      restore.push(function() {
        if (object[key] !== replacement) return;
        if (descriptor) Object.defineProperty(object, key, descriptor);
        else { delete object[key]; if (object[key] !== original) object[key] = original; }
      });
    }
    function deny(name) {
      return function() {
        var message = 'External action blocked during probe: ' + name;
        blocked.push(message);
        throw new Error(message);
      };
    }
    function protect() {
      function navigation(event) {
        var el = event.target && event.target.closest ? event.target : event.target && event.target.parentElement;
        var link = el && el.closest('a[href], area[href]');
        if (event.type === 'submit' || link) {
          event.preventDefault();
          if (request.action != null && (link || el && el.matches('form[action], form[target]'))) {
            blocked.push('External action blocked during probe: ' + (link ? 'link navigation' : 'form navigation'));
          }
        }
      }
      doc.addEventListener('click', navigation, true);
      doc.addEventListener('submit', navigation, true);
      restore.push(function() { doc.removeEventListener('click', navigation, true); doc.removeEventListener('submit', navigation, true); });
      ['fetch', 'open', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker'].forEach(function(key) { guard(win, key, deny(key)); });
      guard(win.navigator, 'sendBeacon', deny('sendBeacon'));
      ['writeText', 'write'].forEach(function(key) { guard(win.navigator.clipboard, key, deny('clipboard.' + key)); });
      guard(win.XMLHttpRequest && win.XMLHttpRequest.prototype, 'send', deny('XMLHttpRequest.send'));
      guard(win.HTMLFormElement && win.HTMLFormElement.prototype, 'submit', deny('form.submit'));
    }
    function checkRequirements(phase) {
      var passed = true;
      request.requirements.forEach(function(requirement) {
        var when = requirement.when || 'initial';
        if (when !== phase && !(when === 'present' && phase === 'initial')) return;
        var pass = false;
        try {
          var el = target(requirement.targetId);
          pass = when === 'present' || visible(el);
          if (!pass) defect('hidden-target', requirement.targetId, 'Required target is not visible at ' + phase + ': ' + requirement.text);
        } catch (error) { defect('missing-target', requirement.targetId, error.message); }
        evidence.checks.push({ id: 'requirement:' + requirement.id + (phase === 'complete' ? ':complete' : ''), pass: pass });
        if (!pass) passed = false;
      });
      return passed;
    }
    function jsonValue(value, ancestors) {
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
      if (typeof value === 'number') return Number.isFinite(value);
      if (typeof value !== 'object') return false;
      var proto = Object.getPrototypeOf(value), array = Array.isArray(value);
      if (proto !== (array ? Array.prototype : Object.prototype) && proto !== null) return false;
      ancestors = ancestors || new Set();
      if (ancestors.has(value)) return false;
      ancestors.add(value);
      var keys = Reflect.ownKeys(value).filter(function(key) { return !array || key !== 'length'; });
      var valid = (!array || keys.length === value.length) && keys.every(function(key, index) {
        if (typeof key !== 'string' || array && key !== String(index)) return false;
        var descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor.enumerable && Object.prototype.hasOwnProperty.call(descriptor, 'value') && jsonValue(descriptor.value, ancestors);
      });
      ancestors.delete(value);
      return valid;
    }
    function outputPath(path) {
      if (typeof path !== 'string' || !path.trim()) throw new Error('Invalid output path');
      var parts = path.split('.');
      if (parts.some(function(key) { return !key || ['__proto__', 'prototype', 'constructor'].includes(key); })) throw new Error('Unsafe output path: ' + path);
      return parts;
    }
    function equalJSON(actual, expected) {
      if (actual === expected) return true;
      if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
      var keys = Object.keys(actual);
      return keys.length === Object.keys(expected).length && keys.every(function(key) {
        return Object.prototype.hasOwnProperty.call(expected, key) && equalJSON(actual[key], expected[key]);
      });
    }
    function actionSnapshot() {
      var dom = [];
      nodes('*').forEach(function(el) {
        if (el.closest('script, style, noscript, template') || !visible(el)) return;
        var value = {};
        var words = Array.from(el.childNodes).filter(function(child) { return child.nodeType === 3; })
          .map(function(child) { return child.textContent.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
        if (words.length) value.text = words;
        if (el.matches('input:not([type="hidden"]), textarea, select')) {
          value.value = el.value;
          if (el.matches('input[type="checkbox"], input[type="radio"]')) value.checked = el.checked;
        }
        ['aria-label', 'aria-expanded', 'aria-pressed', 'aria-selected', 'aria-checked', 'aria-current', 'aria-valuenow', 'aria-valuetext'].forEach(function(key) {
          if (el.hasAttribute(key)) value[key] = el.getAttribute(key);
        });
        if (el.matches('details, dialog')) value.open = el.open;
        if (el.matches('[popover]')) value.open = el.matches(':popover-open');
        if (el.matches('img')) { value.src = el.currentSrc || el.getAttribute('src'); value.alt = el.alt; }
        if (Object.keys(value).length || el.matches('button, input:not([type="hidden"]), textarea, select, a[href], [role]')) {
          dom.push([el.tagName, el.getAttribute('role'), value]);
        }
      });
      var api = root.__daubBehaviorController;
      if (!api || typeof api.getOutput !== 'function') api = win.DaubPrototype;
      var output = api && typeof api.getOutput === 'function' ? api.getOutput() : undefined;
      if (output !== undefined && !jsonValue(output)) throw new Error('Malformed JSON output');
      function canonical(value) {
        if (!value || typeof value !== 'object') return JSON.stringify(value);
        if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
        return '{' + Object.keys(value).sort().map(function(key) {
          return JSON.stringify(key) + ':' + canonical(Object.getOwnPropertyDescriptor(value, key).value);
        }).join(',') + '}';
      }
      return JSON.stringify([dom, output === undefined ? null : canonical(output)]);
    }
    function actionSkip(el) {
      if (!(el instanceof win.HTMLButtonElement)) return 'Target is not a native button';
      if (!visible(el)) return 'Hidden target';
      if (el.matches(':disabled') || el.closest('[inert], [aria-disabled="true"]')) return 'Disabled or inert target';
      if (el.type === 'reset') return 'Reset button';
      if (el.matches('[aria-selected="true"], [aria-pressed="true"]')) return 'Already selected or pressed';
      if (el.hasAttribute('aria-current') && !['', 'false'].includes(el.getAttribute('aria-current'))) return 'Already current';
      if (el.closest('a[href], area[href], [download]') || el.matches('[href], [formaction], [formtarget]')) return 'Navigation or external action';
      if (el.matches('[data-db-trigger], [popovertarget], [commandfor], .db-dropdown__trigger, .db-popover__trigger, .db-preview-card__trigger')) return 'Native trigger';
      if (el.type === 'submit' && el.form && !el.formNoValidate && !el.form.noValidate &&
          Array.from(el.form.elements).some(function(input) { return input.willValidate && !input.validity.valid; })) return 'Invalid form controls';
      if (el.type === 'submit' && el.form && (el.form.hasAttribute('action') || el.form.hasAttribute('target'))) return 'Navigation or external form';
      return null;
    }
    async function runAction(action) {
      activeTarget = action.targetId;
      var result = { targetId: activeTarget, status: 'unchanged' }, pass = false;
      evidence.actions.push(result);
      try {
        var el = target(activeTarget), reason = actionSkip(el);
        if (reason) { result.status = 'skipped'; result.reason = reason; return; }
        var before = actionSnapshot();
        if (blocked.length) throw new Error(blocked[0]);
        el.click();
        await settle();
        var after = actionSnapshot();
        if (blocked.length) throw new Error(blocked[0]);
        pass = before !== after;
        if (pass) result.status = 'changed';
        else {
          result.reason = 'No observable response after one click';
          defect('behavior-no-effect', activeTarget, result.reason);
        }
      } catch (error) {
        result.reason = String(error.message);
        defect('behavior', activeTarget, result.reason);
      }
      evidence.checks.push({ id: 'action:' + activeTarget, pass: pass });
    }
    function checkOutput(assertions) {
      if (!assertions || !assertions.length) return;
      activeTarget = 'document';
      var api = root.__daubBehaviorController;
      if (!api || typeof api.getOutput !== 'function') api = win.DaubPrototype;
      if (!api || typeof api.getOutput !== 'function') throw new Error('Missing output API');
      var output = api.getOutput();
      if (blocked.length) throw new Error(blocked[0]);
      if (!output || typeof output !== 'object' || !jsonValue(output)) throw new Error('Malformed or missing JSON output');
      assertions.forEach(function(assertion) {
        var actual = output;
        outputPath(assertion.path).forEach(function(key) {
          if (!actual || typeof actual !== 'object' || !Object.prototype.hasOwnProperty.call(actual, key)) throw new Error('Missing own output path: ' + assertion.path);
          actual = Object.getOwnPropertyDescriptor(actual, key).value;
        });
        var expected = JSON.parse(assertion.value);
        if (assertion.operator === 'length') {
          if (!(Array.isArray(actual) || typeof actual === 'string') || actual.length !== expected) throw new Error('Output ' + assertion.path + ': expected length ' + expected);
        } else if (!equalJSON(actual, expected)) throw new Error('Output ' + assertion.path + ': expected ' + assertion.value + ' (' + typeof expected + '), received ' + JSON.stringify(actual) + ' (' + typeof actual + ')');
      });
    }
    function validateJourney(journey) {
      bounded(journey.id, 'journey id', 160);
      if (journey.title != null) bounded(journey.title, 'journey title', 240, true);
      if (journey.complete !== undefined && typeof journey.complete !== 'boolean') throw new Error('Journey complete must be a boolean');
      if (!Array.isArray(journey.steps) || journey.steps.length < 1 || journey.steps.length > 40) throw new Error('Journey must contain 1 to 40 steps');
      var assertions = 0;
      if (journey.outputAssertions !== undefined) {
        if (!Array.isArray(journey.outputAssertions) || journey.outputAssertions.length > 8) throw new Error('Output assertions must be an array of at most 8 items');
        journey.outputAssertions.forEach(function(assertion) {
          if (!assertion || typeof assertion !== 'object') throw new Error('Invalid output assertion');
          outputPath(assertion.path);
          if (!['equals', 'length'].includes(assertion.operator)) throw new Error('Unknown output assertion operator');
          if (typeof assertion.value !== 'string') throw new Error('Output assertion value must be JSON encoded');
          var expected = JSON.parse(assertion.value);
          if (!jsonValue(expected)) throw new Error('Output assertion value must be valid JSON');
          if (assertion.operator === 'length' && !(Number.isSafeInteger(expected) && expected >= 0)) throw new Error('Output length requires a nonnegative integer');
          assertions++;
        });
      }
      journey.steps.forEach(function(step) {
        if (!step || !['click', 'fill', 'check', 'select', 'assertText', 'assertValue', 'remember', 'assertChanged', 'assertCount', 'assertVisible', 'assertHidden'].includes(step.action)) throw new Error('Unknown journey action');
        bounded(step.targetId, 'step targetId', 160);
        if (['fill', 'select', 'assertText'].includes(step.action)) bounded(step.value, 'step value', 2000, step.action !== 'assertText');
        if (step.action === 'assertValue' && !(typeof step.value === 'string' && step.value.length <= 2000 || typeof step.value === 'number' && Number.isFinite(step.value))) throw new Error('assertValue requires a string or finite number');
        if (step.action === 'check' && step.value != null && typeof step.value !== 'boolean') bounded(step.value, 'check value', 2000, true);
        if (step.action === 'click' && step.value != null) bounded(step.value, 'click label or index', 2000, true);
        if (step.action === 'assertCount' && !(Number.isSafeInteger(step.value) && step.value >= 0)) throw new Error('assertCount requires a nonnegative integer');
        if (step.action.indexOf('assert') === 0) assertions++;
      });
      if (!assertions) throw new Error('Journey requires at least one assertion');
    }
    async function runJourney(journey) {
      var passed = false;
      try {
        validateJourney(journey);
        for (var step of journey.steps) {
          activeTarget = step.targetId;
          var el = target(step.targetId), input;
          if (['click', 'fill', 'check', 'select'].includes(step.action)) enabled(el);
          switch (step.action) {
            case 'click':
              if (step.value != null && /^(0|[1-9]\d*)$/.test(step.value)) {
                input = el.querySelectorAll('.db-list__item')[Number(step.value)];
                if (!input) throw new Error('Missing List row at index ' + step.value);
              } else {
                var numberInput = !step.value && el.querySelector('.db-number-field input[type="number"], input.db-input[type="number"]');
                var clickSelector = 'button, input[type="button"], input[type="submit"], a, [role="button"]';
                var buttons = el.matches(clickSelector) ? [el] : Array.from(el.querySelectorAll(clickSelector));
                buttons = buttons.filter(function(button) { return visible(button) && (!step.value || (button.getAttribute('aria-label') || text(button) || button.value) === step.value); });
                if (!numberInput && (buttons.length > 1 || step.value && !buttons.length)) throw new Error('Missing or ambiguous click target; provide a unique label: ' + activeTarget);
                input = numberInput || buttons[0] || el;
              }
              enabled(input);
              if (input.matches('input[type="file"]')) throw new Error('File input actions are unsupported');
              input.click();
              break;
            case 'fill':
              input = control(el, 'input, textarea'); enabled(input);
              if (input.readOnly || input.matches('input[type="file"], input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"], input[type="reset"], input[type="image"]')) throw new Error('Target is not an editable text control');
              input.value = step.value; emit(input);
              break;
            case 'check':
              var selector = 'input[type="checkbox"], input[type="radio"]';
              var choices = el.matches(selector) ? [el] : Array.from(el.querySelectorAll(selector));
              var desired = step.value == null || step.value === '' ? true : step.value;
              if (step.value === '') input = choices[0];
              else if (typeof step.value === 'string' && (choices.some(function(item) { return item.type === 'radio'; }) || step.value !== 'true' && step.value !== 'false')) {
                var matches = choices.filter(function(item) { return item.value === step.value; });
                if (!matches.length) matches = choices.filter(function(item) {
                  return Array.from(item.labels || []).some(function(label) {
                    return visible(label) && label.textContent.trim() === step.value;
                  });
                });
                if (matches.length !== 1) throw new Error('Missing or ambiguous ' + (choices.some(function(item) { return item.type === 'radio'; }) ? 'radio' : 'check') + ' option: ' + step.value);
                input = matches[0]; desired = true;
              } else {
                input = control(el, selector);
                if (typeof step.value === 'string') {
                  if (step.value !== 'true' && step.value !== 'false') throw new Error('Checkbox value must be true or false');
                  desired = step.value === 'true';
                }
              }
              if (!input) throw new Error('Missing check input in ' + activeTarget);
              enabled(input);
              if (input.checked !== desired) input.click();
              if (input.checked !== desired) throw new Error('Checked state did not change to ' + desired);
              break;
            case 'select':
              input = control(el, 'select'); enabled(input);
              var option = Array.from(input.options).find(function(item) { return item.value === step.value; });
              if (!option || option.disabled || option.parentElement.matches('optgroup:disabled')) throw new Error('Missing or disabled select option: ' + step.value);
              input.value = step.value; emit(input);
              break;
            case 'assertText':
              if (!visible(el)) throw new Error('Expected visible text in ' + activeTarget);
              if (!text(el).includes(step.value)) throw new Error('Expected text containing ' + JSON.stringify(step.value));
              break;
            case 'assertVisible':
              if (!visible(el)) throw new Error('Expected visible target: ' + activeTarget);
              break;
            case 'assertHidden':
              if (visible(el)) throw new Error('Expected hidden target: ' + activeTarget);
              break;
            case 'assertValue':
              input = control(el, 'input, textarea, select');
              if (input.value !== String(step.value)) throw new Error('Expected value ' + JSON.stringify(step.value) + ', received ' + JSON.stringify(input.value));
              break;
            case 'remember': memory.set(step.targetId, state(el)); break;
            case 'assertChanged':
              if (!memory.has(step.targetId)) throw new Error('No remembered state for ' + step.targetId);
              if (memory.get(step.targetId) === state(el)) throw new Error('Target text/value did not change');
              break;
            case 'assertCount':
              if (el.matches('input, textarea, select')) throw new Error('assertCount requires an input wrapper');
              if (el.querySelectorAll('input').length !== step.value) throw new Error('Expected ' + step.value + ' descendant inputs');
              break;
          }
          await tick();
          if (blocked.length) throw new Error(blocked[0]);
        }
        checkOutput(journey.outputAssertions);
        passed = true;
      } catch (error) {
        defect('behavior', activeTarget, 'Journey ' + String(journey.id || '(invalid)') + ': ' + error.message);
      }
      if (journey.complete === true) {
        await settle();
        if (!checkRequirements('complete')) {
          passed = false;
          defect('behavior', 'document', 'Journey ' + journey.id + ': completion requirements failed');
        }
      }
      evidence.checks.push({ id: 'journey:' + String(journey.id || '(invalid)'), pass: passed });
    }

    try {
      if (!request || typeof request !== 'object') throw new Error('Missing probe request');
      if (!(typeof request.requestId === 'string' && request.requestId.length > 0 && request.requestId.length <= 160 || Number.isSafeInteger(request.requestId))) throw new Error('Invalid requestId');
      if (!Array.isArray(request.requirements) || request.requirements.length > 100) throw new Error('Requirements must be an array of at most 100 items');
      var requirementIds = new Set();
      request.requirements.forEach(function(requirement) {
        if (!requirement) throw new Error('Invalid requirement');
        bounded(requirement.id, 'requirement id', 160);
        bounded(requirement.targetId, 'requirement targetId', 160);
        bounded(requirement.text, 'requirement text', 2000, true);
        if (requirement.when !== undefined && !['initial', 'complete', 'present'].includes(requirement.when)) throw new Error('Invalid requirement phase');
        if (requirementIds.has(requirement.id)) throw new Error('Duplicate requirement id: ' + requirement.id);
        requirementIds.add(requirement.id);
      });
      if (request.action != null) {
        if (request.journey != null) throw new Error('Action and journey are mutually exclusive');
        if (typeof request.action !== 'object' || Array.isArray(request.action)) throw new Error('Invalid action');
        bounded(request.action.targetId, 'action targetId', 160);
        evidence.actions = [];
      }
      protect();
      await settle();
      inspect();
      checkRequirements('initial');
      if (request.journey != null) {
        await runJourney(request.journey);
        await settle();
        inspect();
      }
      if (request.action != null) {
        await runAction(request.action);
        inspect();
      }
      measure();
    } catch (error) {
      evidence.complete = false;
      defect('probe-error', activeTarget, error.message);
    } finally {
      restore.reverse().forEach(function(undo) { undo(); });
    }
    win.parent.postMessage({ type: 'hybrid-probe-result', requestId: request && request.requestId, evidence: evidence }, replyOrigin);
    return evidence;
  }

  return { probe: probe };
}));
