(function(root) {
  'use strict';
  var actions = ['click', 'fill', 'key', 'wait', 'remember', 'assertChanged', 'assertText', 'assertVisible', 'assertHidden', 'assertOutput'];
  function object(properties) { return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties: properties }; }
  function format() {
    var text = { type: 'string' };
    return { type: 'json_schema', json_schema: { name: 'playground_prototype', strict: true, schema: object({
      title: text, brief: { type: 'array', maxItems: 5, items: text }, interactive: { type: 'boolean' },
      html: text, css: text, js: text,
      smoke: { type: 'array', maxItems: 12, items: object({ action: { type: 'string', enum: actions }, selector: text, value: text }) }
    }) } };
  }
  function validate(value) {
    if (!value || typeof value !== 'object') throw new Error('Expected a prototype object');
    for (var pair of [['title', 120], ['html', 60000], ['css', 24000], ['js', 60000]]) {
      if (typeof value[pair[0]] !== 'string' || value[pair[0]].length > pair[1]) throw new Error('Invalid prototype ' + pair[0]);
    }
    if (!value.html.trim() || !value.title.trim()) throw new Error('Prototype needs visible content and a title');
    if (!Array.isArray(value.brief) || value.brief.length > 5 || value.brief.some(function(item) { return typeof item !== 'string' || item.length > 500; })) throw new Error('Keep the brief to five short points');
    if (typeof value.interactive !== 'boolean' || !Array.isArray(value.smoke) || value.smoke.length > 12) throw new Error('Invalid prototype smoke checks');
    if (/<\s*(?:script|iframe|object|embed|base|meta|link)\b|\son\w+\s*=|javascript\s*:/i.test(value.html)) throw new Error('Put behavior in js; HTML cannot contain scripts, frames, embedded handlers or active URLs');
    if (/test\s*:\s*force|test[- ]only|test[- ]hook/i.test(value.html)) throw new Error('Remove test-only controls from the interface');
    value = JSON.parse(JSON.stringify(value));
    if (/^\s*function(?:\s+[A-Za-z_$][\w$]*)?\s*\(/.test(value.js)) {
      var body = value.js.trim().replace(/;$/, '');
      try {
        new Function('return (' + body + ');');
        value.js = 'return (' + body + ')(container, api);';
      } catch (error) {
        if (/^\s*function\s*\(/.test(value.js)) throw error;
        // Named helper declarations may have initialization statements after them.
      }
    }
    new Function('container', 'api', value.js);
    var waited = 0;
    value.smoke.forEach(function(step) {
      if (!step || !actions.includes(step.action) || typeof step.selector !== 'string' || step.selector.length > 200 || typeof step.value !== 'string' || step.value.length > 1000) throw new Error('Invalid smoke step');
      if (step.action === 'wait') {
        var delay = Number(step.value);
        if (!Number.isFinite(delay) || delay < 0 || delay > 1500) throw new Error('Smoke waits must be between 0 and 1500 ms');
        waited += delay;
      } else if (step.action === 'assertOutput') {
        if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(step.selector) || step.selector.split('.').some(function(key) { return ['__proto__', 'constructor', 'prototype'].includes(key); })) throw new Error('Invalid output path');
        JSON.parse(step.value);
      } else if (!step.selector.trim()) throw new Error('Smoke controls need a selector');
      if (step.action === 'assertText' && !step.value.trim()) throw new Error('Text checks need meaningful expected text');
    });
    if (waited > 3000) throw new Error('Smoke checks must finish within a short interaction');
    if (value.interactive && (!value.js.trim() || !value.smoke.some(function(step) { return ['click', 'fill', 'key'].includes(step.action); }) || !value.smoke.some(function(step) { return /^assert/.test(step.action); }))) throw new Error('Interactive prototypes need behavior and a core interaction check');
    return JSON.parse(JSON.stringify(value));
  }
  function specOf(value) {
    return { root: 'prototype', elements: { prototype: { type: 'CustomHTML', props: { html: value.html, css: value.css, js: value.js }, children: [] } },
      prototype: { version: 1, title: value.title, brief: value.brief, interactive: value.interactive, smoke: value.smoke } };
  }
  var componentCatalog;
  async function selectComponents(prompt, previous, signal) {
    var started = Date.now();
    try {
      var boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
      if (!componentCatalog) {
        var catalogResponse = await fetch('components.json', { signal: boundedSignal });
        if (!catalogResponse.ok) throw new Error('Component catalog unavailable');
        var catalog = await catalogResponse.json();
        if (!Array.isArray(catalog.components) || !catalog.components.length || catalog.components.length > 120) throw new Error('Invalid component catalog');
        componentCatalog = catalog.components.map(function(component) {
          var id = component.name.replace(/[^A-Za-z0-9]/g, '');
          if (!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(id) || typeof component.html !== 'string' || typeof component.class !== 'string') throw new Error('Invalid catalog entry');
          return { id: id, name: component.name, class: component.class, html: component.html, notes: String(component.notes || '').slice(0, 400) };
        });
      }
      var components = Object.fromEntries(componentCatalog.map(function(component) { return [component.id, (component.name + ': ' + component.notes).slice(0, 400)]; }));
      var context = previous && previous.prototype ? '\nExisting prototype: ' + previous.prototype.title + '. ' + (previous.prototype.brief || []).join(' ') : '';
      var response = await fetch('/api/choose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: boundedSignal,
        body: JSON.stringify({ prompt: (prompt + context).slice(0, 4000), components: components }) });
      if (!response.ok) { var failure = new Error('Component selection HTTP ' + response.status); failure.status = response.status; throw failure; }
      var data = await response.json();
      if (!data || !data.scores || componentCatalog.some(function(component) { var score = data.scores[component.id]; return !Number.isFinite(score) || score < 0 || score > 1; })) throw new Error('Invalid component scores');
      var selected = componentCatalog.filter(function(component) { return data.scores[component.id] >= 0.45; })
        .sort(function(a, b) { return data.scores[b.id] - data.scores[a.id] || a.id.localeCompare(b.id); }).slice(0, 8);
      var examples = selected.map(function(component) {
        return { name: component.name, class: component.class, notes: component.notes };
      });
      var remaining = 12000 - JSON.stringify(examples).length;
      examples.forEach(function(example, index) {
        var size = JSON.stringify(selected[index].html).length + 8;
        if (size <= remaining) { example.html = selected[index].html; remaining -= size; }
      });
      return { status: 'selected', model: data.model || '~typesafe/jev-latest', components: selected.map(function(component) { return component.name; }), examples: examples, ms: Date.now() - started };
    } catch (error) {
      if (signal.aborted || [402, 429].includes(Number(error.status))) throw error;
      return { status: 'fallback', model: null, components: [], examples: [], ms: Date.now() - started };
    }
  }
  // Runs only inside an opaque probe frame. The model supplies actions, never test code.
  async function probe(container, request, origin) {
    var failures = [], memory = new Map(), checks = 0;
    function visible(el) {
      for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
        var style = getComputedStyle(n);
        if (n.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      }
      return !!(el.getBoundingClientRect().width && el.getBoundingClientRect().height);
    }
    function target(selector) {
      var matches = container.querySelectorAll(selector);
      if (matches.length !== 1) throw new Error('Expected one target: ' + selector);
      return matches[0];
    }
    function snapshot(el, requireContent) {
      var pixels = '';
      if (el.tagName === 'CANVAS') {
        var ctx = el.getContext('2d');
        if (!ctx || !el.width || !el.height || el.width * el.height > 2000000) throw new Error('Canvas is unavailable or too large');
        var bytes = ctx.getImageData(0, 0, el.width, el.height).data, hash = 2166136261;
        var varied = false;
        for (var p = 4; p < bytes.length; p += 4) {
          if (bytes[p] !== bytes[0] || bytes[p + 1] !== bytes[1] || bytes[p + 2] !== bytes[2] || bytes[p + 3] !== bytes[3]) { varied = true; break; }
        }
        if (requireContent && !varied) throw new Error('Canvas is blank or a single solid color');
        for (var i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
        pixels = String(hash);
      }
      var bounds = el.getBoundingClientRect(), style = getComputedStyle(el);
      return JSON.stringify([el.innerText, el.value, el.checked, el.innerHTML, pixels, bounds.width, bounds.height,
        style.backgroundColor, style.opacity, style.transform]);
    }
    function inspect(afterInteraction) {
      if (document.documentElement.scrollWidth > innerWidth + 2) failures.push('Horizontal page overflow at ' + innerWidth + 'px');
      if (!container.textContent.trim() && !container.querySelector('canvas,svg,img')) failures.push('Empty prototype');
      var canvases = Array.from(container.querySelectorAll('canvas')).filter(visible).sort(function(a, b) { return b.width * b.height - a.width * a.height; });
      canvases.forEach(function(canvas, index) {
        try { snapshot(canvas, afterInteraction && index === 0); if (index === 0 && (canvas.getBoundingClientRect().width < 80 || canvas.getBoundingClientRect().height < 80)) failures.push('Canvas is too small'); }
        catch (error) { failures.push(error.message); }
      });
      container.querySelectorAll('img').forEach(function(img) {
        if (visible(img) && img.complete && img.getAttribute('src') && !img.naturalWidth) failures.push('Image failed to load: ' + img.getAttribute('src'));
      });
      (window.__pgRuntimeErrors || []).forEach(function(error) { if (!failures.includes(error)) failures.push(error); });
    }
    try {
      await new Promise(function(resolve) { setTimeout(resolve, 100); });
      inspect(false);
      for (var step of request.steps || []) {
        if (step.action === 'wait') { await new Promise(function(resolve) { setTimeout(resolve, Number(step.value)); }); continue; }
        if (step.action === 'assertOutput') {
          var value = window.DaubPrototype && window.DaubPrototype.getOutput();
          step.selector.split('.').forEach(function(key) { value = value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined; });
          if (JSON.stringify(value) !== JSON.stringify(JSON.parse(step.value))) throw new Error('Output mismatch: ' + step.selector);
          checks++; continue;
        }
        var el = target(step.selector);
        var clickTarget = el;
        if (step.action === 'click' && el.matches('input[type="radio"],input[type="checkbox"]') && !visible(el)) {
          clickTarget = Array.from(el.labels || []).find(function(label) { return container.contains(label) && visible(label); }) || el;
        }
        if (['click', 'fill', 'key'].includes(step.action) && (!visible(clickTarget) || el.matches(':disabled'))) throw new Error('Control is unavailable: ' + step.selector);
        switch (step.action) {
          case 'click': clickTarget.click(); break;
          case 'fill': el.value = step.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); break;
          case 'key': el.dispatchEvent(new KeyboardEvent('keydown', { key: step.value, code: step.value === ' ' ? 'Space' : step.value, bubbles: true, cancelable: true })); el.dispatchEvent(new KeyboardEvent('keyup', { key: step.value, bubbles: true })); break;
          case 'remember': memory.set(step.selector, snapshot(el)); break;
          case 'assertChanged': {
            var current = snapshot(el);
            if (!memory.has(step.selector) || memory.get(step.selector) === current) throw new Error('No visible change: ' + step.selector);
            memory.set(step.selector, current); checks++; break;
          }
          case 'assertText': if (!visible(el) || !el.innerText.includes(step.value)) throw new Error('Expected visible text in ' + step.selector); checks++; break;
          case 'assertVisible': if (!visible(el)) throw new Error('Expected visible ' + step.selector); checks++; break;
          case 'assertHidden': if (visible(el)) throw new Error('Expected hidden ' + step.selector); checks++; break;
        }
        if (['click', 'fill', 'key'].includes(step.action)) await new Promise(function(resolve) { setTimeout(resolve, 32); });
      }
      inspect(true);
    } catch (error) { failures.push(error.message); }
    parent.postMessage({ type: 'prototype-probe-result', requestId: request.requestId, evidence: { width: innerWidth, checks: checks, failures: failures } }, origin);
  }
  async function inspect(host, spec, signal) {
    var controller = new AbortController();
    signal = AbortSignal.any([signal, controller.signal]);
    var jobs = [1200, 390].map(async function(width) {
      if (signal.aborted) throw new DOMException('Canceled', 'AbortError');
      var frame = document.createElement('iframe'), id = crypto.randomUUID();
      frame.setAttribute('sandbox', 'allow-scripts allow-forms'); frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
      frame.dataset.prototypeProbe = '';
      frame.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1;border:0;width:' + width + 'px;height:900px';
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() { cleanup(); resolve({ width: width, checks: 0, failures: ['Browser check timed out'] }); }, 8000);
        function cleanup() { clearTimeout(timer); window.removeEventListener('message', receive); signal.removeEventListener('abort', cancel); frame.remove(); }
        function cancel() { cleanup(); reject(new DOMException('Canceled', 'AbortError')); }
        function receive(event) {
          if (event.source !== frame.contentWindow || !event.data) return;
          if (event.data.type === 'html' && event.data.seq === id) frame.contentWindow.postMessage({ type: 'prototype-probe', requestId: id, steps: spec.prototype.smoke }, '*');
          if (event.data.type === 'prototype-probe-result' && event.data.requestId === id) { var evidence = event.data.evidence; cleanup(); resolve(evidence); }
        }
        function fail(error) { cleanup(); reject(error); }
        try {
          window.addEventListener('message', receive); signal.addEventListener('abort', cancel, { once: true });
          frame.addEventListener('load', function() {
            try { if (!signal.aborted) frame.contentWindow.postMessage({ type: 'render', seq: id, spec: spec, html: '', js: host.collectCustomJS(spec) }, '*'); }
            catch (error) { fail(error); }
          }, { once: true });
          frame.srcdoc = host.buildIframeSrcdoc(spec.theme, undefined, false, true).replace('</head>', '<meta http-equiv="Content-Security-Policy" content="connect-src \'none\'; form-action \'none\'"></head>');
          document.body.appendChild(frame);
        } catch (error) { fail(error); }
      });
    });
    try { return await Promise.all(jobs); }
    catch (error) { controller.abort(); await Promise.allSettled(jobs); throw error; }
  }
  function create(host) {
    async function generate(prompt) {
      if (!host.isDefaultMode || host.hasAttachments) { host.showJsonError('The Playground accepts text prompts through DAUB AI.'); return; }
      if (!prompt.trim() || prompt.length > 4000) { host.showJsonError('Use a prompt of 1 to 4,000 characters.'); return; }
      var controller = new AbortController(), started = Date.now(), count = 0, candidate = null, accepted = null, views = [], errorText = '', phase = 'Choosing components', bytes = 0, providerLimited = false;
      var previous = host.currentSpec;
      var timing = { requests: [], previewPublishedMs: null, checksMs: 0 };
      var needsEngine = /\btetris\b/i.test(prompt) || Object.values(previous && previous.elements || {}).some(function(element) { return /DaubPrototypeEngines/.test(element.props && element.props.js || ''); });
      host.controller = controller;
      function active() { return host.controller === controller && !controller.signal.aborted; }
      host.applyPromptViewport(prompt); host.chatHistory.push({ role: 'user', content: prompt }); host.addChatBubble('user', prompt); host.updateChatState();
      host.$prompt.value = ''; host.$prompt.style.height = ''; host.hideJsonError(); host.setLoading(true);
      var bubble = host.addChatBubble('ai', phase); host.stream.streamBubble = bubble;
      var lastProgress = 0, lastPhase = '';
      function progress() {
        var now = Date.now();
        if (!active() || (phase === lastPhase && now - lastProgress < 250)) return;
        lastProgress = now; lastPhase = phase;
        var text = phase + ' · ' + Math.floor((now - started) / 1000) + 's' + (bytes ? ' · ' + Math.ceil(bytes / 1024) + ' KB received' : '');
        if (bubble.textContent !== text) bubble.textContent = text;
      }
      var timer = setInterval(progress, 1000);
      function publish(spec) { if (!active()) return; host.currentSpec = spec; host.renderSpec(spec); host.$json.value = JSON.stringify(spec, null, 2); host.refreshJsonTree(); host.updatePreviewToolbar(); host.saveChatState(); if (timing.previewPublishedMs === null) timing.previewPublishedMs = Date.now() - started; }
      var system = 'Build a polished, working interactive prototype from the request in ONE response. Return the structured object: title, brief (up to five concise points), interactive, html (body fragment), css, js (function body with container and api), smoke (at most12 short browser actions). Use DAUB CSS classes for buttons and form controls; use custom responsive CSS, canvas or SVG when the domain needs them. All layout AND behavior must work together immediately. No placeholder board, fake data-only game, unfinished TODO, test-only controls or debug output. Keep scope small but preserve the requested core workflow. Design completion/results screens for forms/quizzes and wire them. Use sentence case. Prioritize the actual usable interface, no marketing hero or instructions explaining the UI. Responsive at390 and1200px; stable board/media aspect ratios; readable text; no clipping or nested decorative cards. Use a domain-appropriate palette and realistic visible content. Games must show actual gameplay with touch controls and keyboard controls. Use available trusted engines for core game rules. Other prototypes can use real images from https://images.unsplash.com with explicit dimensions. HTML contains no scripts, inline handlers, remote scripts or frames. CSS is scoped under #prototype-app; root HTML element has id="prototype-app". JS runs in an isolated iframe, after DOM insertion. Use standard DOM/canvas APIs within container. api.on(elementOrSelector,event,handler) tracks listeners and accepts window/document for keyboard. api.every(milliseconds,callback) and api.frame(callback) manage timers/animation with disposal; return cancel functions. api.publish(plainJSONobject) exposes current meaningful output via window.DaubPrototype.getOutput()/subscribe; publish initially and after state changes. Local variables can hold mutable state. Do not use network, storage, remote navigation or real submissions. Bind handlers once and clean up through api. Timers are allowed through api. Keep code compact, use loops for repeated content. Never replace markup with a text description of requested interaction. For a quiz include all requested distinct questions and return all answers with completed flag. For smoke use selectors that match exactly one real control, steps click/fill/key/wait/remember/assertChanged/assertText/assertVisible/assertHidden/assertOutput, each with action,selector,value strings. Test ONE meaningful core interaction, not full exhaustive lifecycle. Remember before action then assertChanged on same selector; canvas snapshots include pixels. Games: Start, remember canvas, movement key, assertChanged, short wait then assertChanged. wait uses empty selector and milliseconds<=1500, total waits<=3000. assertOutput selector is a dot path, value is JSON-encoded expectation. Other unused values are empty strings. Static pages may have js:"" and smoke:[]. Do not invent fake test buttons to reach edge cases. Keep behavior in JS, never event attributes.';
      system += '\nDAUB classes are db-btn, db-btn--primary, db-input and db-label (not daub-btn). Keep hover position stable. Use zero letter spacing and fixed font sizes with responsive wrapping, not viewport-scaled fonts. Keep framed-item corners at most 8px and avoid nested cards. Use a varied palette instead of a purple-only or dark-blue-only theme. Show the product name or domain in the first viewport. For games, keep the board and primary touch controls visible together at 390x844; put secondary statistics beside or above the board, not in a tall stack underneath. Do not add keyboard-instruction paragraphs.';
      if (needsEngine && root.DaubPrototypeEngines) system += '\nAvailable engine: ' + root.DaubPrototypeEngines.prompt;
      system += '\nThe js field is executable function-body code, not a function declaration. Initialize the UI and publish its initial output before returning; merely defining init() does not run it.';
      try {
        var selection = await selectComponents(prompt, previous, controller.signal);
        if (!active()) return;
        timing.selection = { status: selection.status, model: selection.model, components: selection.components, ms: selection.ms };
        if (selection.examples.length) system += '\nJev selected these DAUB components for this request. Reuse their class names and HTML patterns when they fit the workflow; adapt example text and IDs, preserve accessibility, and wire behavior with api. Do not add unrelated UI just to use a selected component. Custom layout/canvas remains available.\n' + JSON.stringify(selection.examples);
        for (var attempt = 0; attempt < 2; attempt++) {
          phase = attempt ? 'Repairing prototype' : 'Building prototype'; bytes = 0; progress(); count++;
          var input = { request: prompt, currentSpec: attempt ? null : previous };
          if (attempt) Object.assign(input, { prototype: candidate, failures: errorText || views, smoke: accepted && accepted.prototype.smoke, instruction: 'Return one complete corrected prototype. Preserve the original smoke checks and user-visible scope. Fix the blocking errors; do not weaken checks or hide failing controls.' });
          var content = JSON.stringify(input), requestStarted = Date.now();
          var requestTiming = { inputChars: system.length + content.length, firstByteMs: null, responseMs: null, outputChars: 0 };
          timing.requests.push(requestTiming);
          var response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(75000)]),
            body: JSON.stringify(Object.assign({}, host.mainGenOpts(), { model: host.AUTO_MODEL, max_tokens: 16384, reasoning: { effort: 'low' }, response_format: format(), messages: [{ role: 'system', content: system }, { role: 'user', content: content }] })) });
          if (!response.ok) throw await host.recursiveRequestError(response);
          if (response.body) response = new Response(response.body.pipeThrough(new TransformStream({ transform: function(chunk, stream) { if (requestTiming.firstByteMs === null) requestTiming.firstByteMs = Date.now() - requestStarted; bytes += chunk.byteLength; progress(); stream.enqueue(chunk); } })), { status: response.status, headers: response.headers });
          var result = await host.parseSseResponse(response);
          requestTiming.responseMs = Date.now() - requestStarted; requestTiming.outputChars = typeof result.content === 'string' ? result.content.length : 0;
          try {
            if (!result.completed || result.refused || result.finishReason !== 'stop') throw new Error(result.refused ? 'The model declined this request' : 'The model response was incomplete; return a shorter complete prototype');
            candidate = validate(JSON.parse(result.content));
            if (/\btetris\b/i.test(prompt) && !/DaubPrototypeEngines/.test(candidate.js)) throw new Error('Use the provided DaubPrototypeEngines.tetris() core and draw its board and active piece');
            if (accepted) { candidate.smoke = accepted.prototype.smoke; candidate.interactive = accepted.prototype.interactive; }
            var spec = specOf(candidate);
            phase = 'Checking interactions'; progress();
            if (!accepted) { accepted = spec; publish(accepted); }
            var checkStarted = Date.now(), checked;
            try { checked = await inspect(host, spec, controller.signal); }
            finally { timing.checksMs += Date.now() - checkStarted; }
            if (!active()) break;
            if (!checked.some(function(view) { return view.failures.length; })) { views = checked; if (accepted !== spec) { accepted = spec; publish(accepted); } errorText = ''; break; }
            if (!views.length) views = checked;
            errorText = JSON.stringify(checked);
          } catch (error) {
            if (controller.signal.aborted || result.refused) throw error;
            errorText = error.message;
          }
        }
      } catch (error) { errorText = error.message; providerLimited = [402, 429].includes(Number(error.status)); }
      finally {
        clearInterval(timer);
        if (host.controller !== controller) return;
        var complete = accepted && views.length === 2 && views.every(function(view) { return !view.failures.length; }) && !errorText;
        var stopped = controller.signal.aborted && !providerLimited;
        var label = providerLimited ? 'Provider limit reached' : stopped ? 'Stopped' : complete ? 'Prototype ready' : accepted ? 'Prototype needs review' : 'Could not build prototype';
        var statusText = label + (!complete && errorText && !stopped ? ': ' + errorText.slice(0, 250) : '');
        if (timing.selection && timing.selection.status === 'fallback') statusText += '. Component selection unavailable; used base DAUB controls.';
        if (accepted) {
          accepted.prototype.status = label;
          host.currentSpec = accepted; host.$json.value = JSON.stringify(accepted, null, 2);
          host.pushVersion(accepted, prompt); host.specVersions[host.specVersions.length - 1].ms = Date.now() - started;
          host.buildResultBubble(bubble, accepted);
          host.chatHistory.push({ role: 'assistant', content: label, refinementStatus: statusText, versionIdx: host.specVersions.length - 1 });
        } else { bubble.textContent = ''; host.chatHistory.push({ role: 'assistant', content: statusText }); }
        var note = document.createElement('p'); note.className = 'pg-result-meta'; note.textContent = statusText; bubble.appendChild(note);
        window.__prototypeLastRun = { reason: complete ? 'complete' : providerLimited ? 'provider-error' : stopped ? 'stopped' : 'incomplete', requests: count, views: views, error: errorText || null, ms: Date.now() - started };
        window.__prototypeLastTiming = timing;
        host.saveChatState(); host.$status.textContent = ''; host.setLoading(false); host.controller = null;
      }
    }
    return { generate: generate };
  }
  root.DaubPrototypeUI = { create: create, validate: validate, format: format, probe: probe };
}(globalThis));
