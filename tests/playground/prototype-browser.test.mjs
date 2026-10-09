import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
let browser, server, base;
before(async () => {
  server = createServer(async (req, res) => {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/')) return res.writeHead(403).end();
    try {
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    headless: true, timeout: 15000,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? undefined : process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
});
after(async () => {
  await browser?.close();
  if (server?.listening) await new Promise(done => server.close(done));
});

const counter = {
  title: 'Counter', brief: ['Count local clicks.'], interactive: true,
  html: '<main id="prototype-app"><h1>Counter</h1><button id="increment" class="db-btn">Add one</button><output id="count">0</output></main>',
  css: '#prototype-app { max-width: 40rem; padding: 16px; } #count { display: block; }',
  js: 'let count = 0; function render() { container.querySelector("#count").textContent = String(count); api.publish({count}); } api.on("#increment", "click", () => { count++; render(); }); render();',
  smoke: [
    { action: 'remember', selector: '#count', value: '' },
    { action: 'click', selector: '#increment', value: '' },
    { action: 'assertChanged', selector: '#count', value: '' },
    { action: 'assertText', selector: '#count', value: '1' },
    { action: 'assertOutput', selector: 'count', value: '1' },
  ],
};
const form = {
  title: 'Contact form', brief: ['Collect a name and show the local result.'], interactive: true,
  html: '<main id="prototype-app"><form id="contact"><label for="name">Name</label><input id="name" class="db-input"><button id="save" class="db-btn" type="submit">Save</button></form><output id="result">No submission</output></main>',
  css: '#prototype-app { padding: 16px; } #contact { display: grid; gap: 12px; } #result { display: block; }',
  js: 'api.publish({name:"",completed:false}); api.on("#contact", "submit", event => { event.preventDefault(); const name = container.querySelector("#name").value; container.querySelector("#result").textContent = "Saved " + name; api.publish({name,completed:true}); });',
  smoke: [
    { action: 'fill', selector: '#name', value: 'Ada' },
    { action: 'click', selector: '#save', value: '' },
    { action: 'assertText', selector: '#result', value: 'Saved Ada' },
    { action: 'assertOutput', selector: 'name', value: '"Ada"' },
    { action: 'assertOutput', selector: 'completed', value: 'true' },
  ],
};
const staticPage = {
  title: 'Studio hours', brief: ['Open Monday to Friday.'], interactive: false,
  html: '<main id="prototype-app"><h1>Studio hours</h1><p>Monday to Friday, 09:00 to 17:00</p></main>',
  css: '#prototype-app { padding: 16px; }', js: '', smoke: [],
};
function sse(value, finishReason = 'stop') {
  return { contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{
    delta: { content: typeof value === 'string' ? value : JSON.stringify(value) }, finish_reason: finishReason,
  }] }) + '\n\ndata: [DONE]\n\n' };
}

async function open(t, { response = counter, respond, chooseRespond, ignoreAbort = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());
  const calls = [], picks = [], unexpected = [], errors = [];
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url === base + '/api/choose') {
      const body = route.request().postDataJSON();
      picks.push(body);
      return chooseRespond ? chooseRespond(route, body) : route.fulfill({ json: {
        model: 'fixture-jev', scores: Object.fromEntries(Object.keys(body.components).map(key => [key, ['Button', 'RadioGroup', 'Progress'].includes(key) ? 0.9 : 0.1])),
      } });
    }
    if (url === base + '/api/generate') {
      const body = route.request().postDataJSON();
      calls.push(body);
      if (calls.length > 2 || body.response_format?.json_schema?.name !== 'playground_prototype') {
        unexpected.push(body.response_format?.json_schema?.name);
        return route.fulfill({ status: 500, json: { error: 'Unexpected generation request' } });
      }
      return respond ? respond(route, body, calls.length) : route.fulfill(sse(response));
    }
    if (url.includes('/api/') || /api\.(openai|anthropic)\.com|openrouter\.ai/.test(url)) unexpected.push(url);
    return url.startsWith(base + '/') && !url.includes('/api/') ? route.continue() : route.abort();
  });
  await context.addInitScript(ignoreAbort => {
    if (window !== window.top || !ignoreAbort) return;
    // Let a canceled request finish to exercise the stale-result guard.
    const fetch = window.fetch;
    window.fetch = (url, options) => fetch(url, url === '/api/generate' ? { ...options, signal: undefined } : options);
  }, ignoreAbort);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => {
    assert.deepEqual(errors, [], 'Uncaught browser errors');
    assert.deepEqual(unexpected, [], 'Unexpected provider requests');
  });
  await page.goto(base + '/playground.html');
  return { page, calls, picks };
}
async function submit(page, prompt = 'Build a working counter.') {
  await page.locator('#pg-prompt').fill(prompt);
  await page.locator('#pg-prompt').press('Enter');
}
async function finished(page) {
  try {
    await page.waitForFunction(() => window.__prototypeLastRun && document.querySelector('.pg-chat').getAttribute('aria-busy') === 'false', null, { timeout: 12000 });
  } catch (error) {
    throw new Error(error.message + '\n' + JSON.stringify(await page.evaluate(() => ({
      run: window.__prototypeLastRun, chat: document.querySelector('#pg-chat-messages').textContent,
      probes: document.querySelectorAll('[data-prototype-probe]').length,
    }))));
  }
  assert.equal(await page.locator('[data-prototype-probe]').count(), 0);
  assert.equal(await page.locator('#pg-stop-btn').isVisible(), false);
  return page.evaluate(() => window.__prototypeLastRun);
}
function ready(run, requests, checks) {
  assert.deepEqual(Object.keys(run).sort(), ['error', 'ms', 'reason', 'requests', 'views']);
  assert.equal(run.reason, 'complete', JSON.stringify(run));
  assert.equal(run.requests, requests);
  assert.equal(run.error, null);
  assert.ok(Number.isFinite(run.ms) && run.ms >= 0);
  assert.deepEqual(run.views.map(view => ({ width: view.width, checks: view.checks, failures: view.failures })), [
    { width: 1200, checks, failures: [] }, { width: 390, checks, failures: [] },
  ]);
}

test('one strict response builds a counter and checks both widths without consuming visible clicks', async t => {
  const { page, calls, picks } = await open(t);
  await submit(page);
  ready(await finished(page), 1, 3);
  assert.equal(calls.length, 1);
  assert.equal(picks.length, 1);
  assert.equal(picks[0].prompt, 'Build a working counter.');
  assert.equal(Object.keys(picks[0].components).length, 91);
  const request = calls[0], schema = request.response_format.json_schema;
  assert.match(request.messages[0].content, /Jev selected these DAUB components/);
  assert.match(request.messages[0].content, /db-radio-group/);
  assert.match(request.messages[0].content, /db-progress/);
  assert.ok(!request.messages[0].content.includes('db-calendar'));
  assert.equal(request.model, 'openrouter/auto');
  assert.ok(!request.messages[0].content.includes('Available engine:'));
  assert.equal(schema.name, 'playground_prototype');
  assert.equal(schema.strict, true);
  assert.equal(schema.schema.additionalProperties, false);
  assert.deepEqual(schema.schema.required, ['title', 'brief', 'interactive', 'html', 'css', 'js', 'smoke']);
  assert.equal(schema.schema.properties.smoke.items.additionalProperties, false);
  assert.deepEqual(schema.schema.properties.smoke.items.required, ['action', 'selector', 'value']);
  assert.ok(request.messages.every(message => !message.content.includes(JSON.stringify(schema.schema))));
  const timing = await page.evaluate(() => window.__prototypeLastTiming);
  assert.equal(timing.requests.length, 1);
  assert.equal(timing.requests[0].inputChars, request.messages.reduce((sum, message) => sum + message.content.length, 0));
  assert.equal(timing.requests[0].outputChars, JSON.stringify(counter).length);
  assert.ok(timing.requests[0].firstByteMs >= 0);
  assert.ok(timing.requests[0].responseMs >= timing.requests[0].firstByteMs);
  assert.ok(timing.previewPublishedMs >= timing.requests[0].responseMs);
  assert.ok(timing.checksMs > 0);
  assert.equal(timing.selection.status, 'selected');
  assert.equal(timing.selection.model, 'fixture-jev');
  assert.deepEqual(timing.selection.components, ['Button', 'Progress', 'Radio Group']);
  const spec = JSON.parse(await page.locator('#pg-json').inputValue());
  assert.equal(spec.root, 'prototype');
  assert.deepEqual(spec.elements.prototype, { type: 'CustomHTML', props: { html: counter.html, css: counter.css, js: counter.js }, children: [] });
  assert.deepEqual(spec.prototype, { version: 1, title: counter.title, brief: counter.brief, interactive: true, smoke: counter.smoke, status: 'Prototype ready' });
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.locator('#count').textContent(), '0');
  assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { count: 0 });
  await frame.getByRole('button', { name: 'Add one' }).click();
  assert.equal(await frame.locator('#count').textContent(), '1');
  assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { count: 1 });
});

test('form smoke checks leave the visible form and output pristine', async t => {
  const { page, calls } = await open(t, { response: form });
  await submit(page, 'Build a contact form with a local result.');
  ready(await finished(page), 1, 3);
  assert.equal(calls.length, 1);
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.getByLabel('Name', { exact: true }).inputValue(), '');
  assert.equal(await frame.locator('#result').textContent(), 'No submission');
  assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { name: '', completed: false });
  await frame.getByLabel('Name', { exact: true }).fill('Grace');
  await frame.getByRole('button', { name: 'Save', exact: true }).click();
  assert.equal(await frame.locator('#result').textContent(), 'Saved Grace');
  assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { name: 'Grace', completed: true });
});

for (const state of ['radio', 'checkbox', 'disabled', 'hidden']) test('native choice checks use visible labels and honor ' + state, async t => {
  const response = {
    ...counter,
    html: '<main id="prototype-app"><fieldset' + (state === 'disabled' ? ' disabled' : '') + '><label' + (state === 'hidden' ? ' hidden' : '') + '><input id="choice" type="' + (state === 'checkbox' ? 'checkbox' : 'radio') + '"><span>Answer</span></label></fieldset></main>',
    css: '#choice { position: absolute; opacity: 0; width: 0; height: 0; }',
    js: 'api.publish({selected:false}); api.on("#choice", "change", e => api.publish({selected:e.target.checked}));',
    smoke: [{ action: 'click', selector: '#choice', value: '' }, { action: 'assertOutput', selector: 'selected', value: 'true' }],
  };
  const { page } = await open(t, { response });
  await submit(page);
  const run = await finished(page);
  if (state === 'disabled' || state === 'hidden') {
    assert.equal(run.reason, 'incomplete');
    assert.match(run.error, /Control is unavailable/);
  } else ready(run, 1, 1);
  assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { selected: false });
});

for (const property of ['--progress', '--unused', 'color', 'border-color']) test('style-only progress checks ' + property, async t => {
  const response = { ...counter,
    html: '<main id="prototype-app"><button id="advance">Advance</button><div id="bar"></div></main>',
    css: '#bar { width: var(--progress, 10px); height: 10px; background: red; }',
    js: 'api.on("#advance", "click", () => container.querySelector("#bar").style.setProperty("' + property + '", "' + (property.startsWith('--') ? '80px' : 'blue') + '"));',
    smoke: [{ action: 'remember', selector: '#bar', value: '' }, { action: 'click', selector: '#advance', value: '' }, { action: 'assertChanged', selector: '#bar', value: '' }],
  };
  const { page } = await open(t, { response });
  await submit(page);
  const run = await finished(page);
  if (property === '--progress') ready(run, 1, 1);
  else { assert.equal(run.reason, 'incomplete'); assert.match(run.error, /No visible change/); }
});

test('Tetris engine context survives follow-up edits without a game keyword', async t => {
  const response = { ...counter, js: counter.js + ' const engine = DaubPrototypeEngines.tetris(); return () => engine.dispose();' };
  const { page, calls } = await open(t, { response });
  await submit(page, 'Tetris game.');
  ready(await finished(page), 1, 3);
  assert.match(calls[0].messages[0].content, /Available engine:/);
  await page.evaluate(() => { delete window.__prototypeLastRun; });
  await submit(page, 'Make the buttons larger.');
  ready(await finished(page), 1, 3);
  assert.equal(calls.length, 2);
  assert.match(calls[1].messages[0].content, /Available engine:/);
  assert.match(JSON.parse(calls[1].messages[1].content).currentSpec.elements.prototype.props.js, /DaubPrototypeEngines/);
  assert.equal((await page.evaluate(() => window.__prototypeLastTiming)).requests.length, 1);
});

for (const name of ['', ' init']) test('function' + name + ' wrapper runs without spending a repair request', async t => {
  const response = { ...counter, js: 'function' + name + '(container, api) { ' + counter.js + ' };' };
  const { page, calls } = await open(t, { response });
  await submit(page);
  ready(await finished(page), 1, 3);
  assert.equal(calls.length, 1);
  const spec = JSON.parse(await page.locator('#pg-json').inputValue());
  assert.match(spec.elements[spec.root].props.js, /^return \(function(?: init)?\(container, api\)/);
  await page.frameLocator('#pg-preview-frame').getByRole('button', { name: 'Add one' }).click();
  assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { count: 1 });
});

for (const js of ['const count = ;', 'function(container, api) { const count = ; }']) {
  test('malformed ' + (js.startsWith('function') ? 'wrapper' : 'body') + ' stops after one repair without publishing a prototype', async t => {
    const { page, calls } = await open(t, { response: { ...counter, js } });
    await submit(page);
    const run = await finished(page);
    assert.equal(run.reason, 'incomplete');
    assert.equal(run.requests, 2);
    assert.equal(calls.length, 2);
    assert.deepEqual(run.views, []);
    assert.match(run.error, /Unexpected token|SyntaxError/i);
    assert.match(JSON.parse(calls[1].messages[1].content).failures, /Unexpected token|SyntaxError/i);
    assert.equal(await page.locator('#pg-json').inputValue(), '');
    assert.equal(await page.evaluate(() => DaubPlayground.getOutput()), null);
  });
}

test('finishing isolated checks preserves clicks made in the visible preview during checking', async t => {
  const response = { ...counter, smoke: [{ action: 'wait', selector: '', value: '1000' }, ...counter.smoke] };
  const { page } = await open(t, { response });
  await submit(page);
  await page.waitForFunction(() => document.querySelectorAll('[data-prototype-probe]').length === 2);
  const scripts = await page.locator('[data-prototype-probe]').evaluateAll(frames => frames.map(frame => {
    const doc = new DOMParser().parseFromString(frame.srcdoc, 'text/html');
    return Array.from(doc.querySelectorAll('script[src]'), script => script.getAttribute('src'));
  }));
  for (const sources of scripts) {
    assert.ok(sources.some(src => src.includes('lucide')));
    assert.ok(sources.some(src => src.includes('daub.js')));
    assert.ok(!sources.some(src => /html2canvas|html-to-image/.test(src)));
  }
  assert.match(await page.locator('#pg-preview-frame').getAttribute('srcdoc'), /src="https:[^"]+html2canvas/);
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.getByRole('button', { name: 'Add one' }).click({ clickCount: 2 });
  assert.equal(await frame.locator('#count').textContent(), '2');
  ready(await finished(page), 1, 3);
  assert.equal(await frame.locator('#count').textContent(), '2');
  assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { count: 2 });
});

test('downloaded prototype keeps an opaque preview and exposes live output through its async bridge', async t => {
  const { page, calls } = await open(t, { response: form });
  await submit(page, 'Build a contact form.');
  ready(await finished(page), 1, 3);
  const pending = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await pending).path(), 'utf8');
  await page.setContent(html);
  const frame = page.frameLocator('#prototype-preview');
  await frame.getByLabel('Name', { exact: true }).waitFor();
  assert.equal(await page.locator('#prototype-preview').getAttribute('sandbox'), 'allow-scripts allow-forms');
  assert.equal(await page.locator('#prototype-preview').evaluate(el => el.contentDocument), null);
  assert.deepEqual(await page.evaluate(async () => await DaubPrototype.getOutput()), { name: '', completed: false });
  await frame.getByLabel('Name', { exact: true }).fill('Lin');
  await frame.getByRole('button', { name: 'Save', exact: true }).click();
  assert.equal(await frame.locator('#result').textContent(), 'Saved Lin');
  assert.deepEqual(await page.evaluate(async () => await DaubPrototype.getOutput()), { name: 'Lin', completed: true });
  assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { name: 'Lin', completed: true });
  assert.equal(calls.length, 1);
});

for (const hasWrapperId of [false, true]) {
  test((hasWrapperId ? 'an existing' : 'a missing') + ' prototype wrapper ID keeps scoped styles in preview and export', async t => {
    const response = {
      ...counter,
      html: '<main' + (hasWrapperId ? ' id="prototype-app"' : '') + '><h1>Counter</h1><button id="increment" class="db-btn">Add one</button><output id="count">0</output></main>',
      css: '#prototype-app { padding: 17px; } #prototype-app #count { display: block; background-color: rgb(19, 71, 103); color: rgb(242, 244, 248); padding: 13px; }',
    };
    const { page, calls } = await open(t, { response });
    await submit(page);
    ready(await finished(page), 1, 3);
    const spec = JSON.parse(await page.locator('#pg-json').inputValue());
    assert.equal(spec.elements[spec.root].props.html, response.html, 'Rendering must preserve the generated HTML in the spec');

    async function assertScopedStyles(selector) {
      const frame = page.frameLocator(selector);
      await frame.locator('#count').waitFor();
      assert.equal(await frame.locator('#prototype-app').count(), 1, 'Do not duplicate an existing wrapper ID');
      assert.deepEqual(await frame.locator('#prototype-app').evaluate(el => ({
        tag: el.tagName, customHTML: el.classList.contains('pg-custom-html'), padding: getComputedStyle(el).padding,
      })), { tag: hasWrapperId ? 'MAIN' : 'DIV', customHTML: !hasWrapperId, padding: '17px' });
      assert.deepEqual(await frame.locator('#count').evaluate(el => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, color: style.color, padding: style.padding, display: style.display };
      }), { background: 'rgb(19, 71, 103)', color: 'rgb(242, 244, 248)', padding: '13px', display: 'block' });
      await frame.getByRole('button', { name: 'Add one' }).click();
      assert.equal(await frame.locator('#count').textContent(), '1');
    }

    await assertScopedStyles('#pg-preview-frame');
    const pending = page.waitForEvent('download');
    await page.locator('#pg-download').click();
    const html = await readFile(await (await pending).path(), 'utf8');
    await page.setContent(html);
    assert.equal(await page.locator('#prototype-preview').getAttribute('sandbox'), 'allow-scripts allow-forms');
    await assertScopedStyles('#prototype-preview');
    assert.deepEqual(await page.evaluate(async () => await DaubPrototype.getOutput()), { count: 1 });
    assert.equal(calls.length, 1);
  });
}

test('one repair fixes broken behavior while preserving the original smoke checks', async t => {
  const broken = { ...counter, js: 'api.publish({count:0});' };
  const weaker = [{ action: 'click', selector: '#increment', value: '' }, { action: 'assertVisible', selector: '#increment', value: '' }];
  const { page, calls, picks } = await open(t, { respond: (route, body, call) => route.fulfill(sse(call === 1 ? broken : { ...counter, smoke: weaker })) });
  await submit(page);
  ready(await finished(page), 2, 3);
  assert.equal(calls.length, 2);
  assert.equal(picks.length, 1, 'Repairs reuse the same selection');
  assert.equal(calls[0].messages[0].content, calls[1].messages[0].content);
  const repair = JSON.parse(calls[1].messages[1].content);
  assert.deepEqual(repair.smoke, counter.smoke);
  assert.match(JSON.stringify(repair.failures), /No visible change/);
  assert.deepEqual(JSON.parse(await page.locator('#pg-json').inputValue()).prototype.smoke, counter.smoke);
  await page.frameLocator('#pg-preview-frame').getByRole('button', { name: 'Add one' }).click();
  assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { count: 1 });
});

for (const drawPiece of [true, false]) {
  test('canvas checks ' + (drawPiece ? 'accept a moving primary board with a small blank secondary canvas' : 'reject a solid primary board after Start'), async t => {
    const response = {
      title: 'Canvas board', brief: ['Move a piece on the board.'], interactive: true,
      html: '<main id="prototype-app"><button id="start" type="button">Start</button><canvas id="next" width="32" height="32"></canvas><canvas id="board" width="200" height="200" tabindex="0"></canvas></main>',
      css: '#prototype-app canvas { display: block; }',
      js: 'const canvas = container.querySelector("#board"), ctx = canvas.getContext("2d"); let started = false, x = 5;'
        + 'function draw() { ctx.fillStyle = "rgb(10, 20, 30)"; ctx.fillRect(0, 0, 200, 200);'
        + (drawPiece ? 'ctx.fillStyle = "rgb(240, 250, 255)"; ctx.fillRect(x, 5, 10, 10);' : '')
        + 'api.publish({started,x}); } api.publish({started,x});'
        + 'api.on("#start", "click", () => { started = true; draw(); });'
        + 'api.on(window, "keydown", event => { if (started && event.key === "ArrowRight") { x += 15; draw(); } });',
      smoke: [
        { action: 'remember', selector: '#board', value: '' },
        { action: 'click', selector: '#start', value: '' },
        { action: 'assertChanged', selector: '#board', value: '' },
        ...(drawPiece ? [
          { action: 'key', selector: '#board', value: 'ArrowRight' },
          { action: 'assertChanged', selector: '#board', value: '' },
        ] : []),
        { action: 'assertOutput', selector: 'started', value: 'true' },
      ],
    };
    const { page, calls } = await open(t, { response });
    await submit(page, 'Build a canvas board with Start and keyboard movement.');
    const run = await finished(page);
    if (drawPiece) {
      ready(run, 1, 3);
      assert.equal(calls.length, 1);
    } else {
      assert.equal(run.reason, 'incomplete');
      assert.equal(run.requests, 2);
      assert.equal(calls.length, 2);
      assert.deepEqual(run.views.map(view => ({ width: view.width, checks: view.checks, failures: view.failures })), [
        { width: 1200, checks: 2, failures: ['Canvas is blank or a single solid color'] },
        { width: 390, checks: 2, failures: ['Canvas is blank or a single solid color'] },
      ]);
    }
    const frame = page.frameLocator('#pg-preview-frame');
    assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { started: false, x: 5 });
    assert.equal(await frame.locator('#board').evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, 200, 200).data.every(value => value === 0)), true);
    await frame.getByRole('button', { name: 'Start', exact: true }).click();
    if (drawPiece) {
      await frame.locator('#board').press('ArrowRight');
      assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { started: true, x: 20 });
      assert.deepEqual(await frame.locator('#board').evaluate(canvas => {
        const ctx = canvas.getContext('2d');
        return [Array.from(ctx.getImageData(5, 5, 1, 1).data), Array.from(ctx.getImageData(20, 5, 1, 1).data)];
      }), [[10, 20, 30, 255], [240, 250, 255, 255]]);
    }
    assert.deepEqual(await frame.locator('#next').evaluate(canvas => ({
      width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height,
      blank: canvas.getContext('2d').getImageData(0, 0, 32, 32).data.every(value => value === 0),
    })), { width: 32, height: 32, blank: true });
  });
}

for (const changeAgain of [false, true]) {
  test('successive assertChanged ' + (changeAgain ? 'passes after a new change' : 'rejects a reused pre-click baseline'), async t => {
    const response = {
      ...counter,
      smoke: [
        { action: 'remember', selector: '#count', value: '' },
        { action: 'click', selector: '#increment', value: '' },
        { action: 'assertChanged', selector: '#count', value: '' },
        { action: 'wait', selector: '', value: '100' },
        ...(changeAgain ? [{ action: 'click', selector: '#increment', value: '' }] : []),
        { action: 'assertChanged', selector: '#count', value: '' },
        { action: 'assertOutput', selector: 'count', value: '2' },
      ],
    };
    const { page, calls } = await open(t, { response });
    await submit(page);
    const run = await finished(page);
    if (changeAgain) {
      ready(run, 1, 3);
      assert.equal(calls.length, 1);
    } else {
      assert.equal(run.reason, 'incomplete');
      assert.equal(run.requests, 2);
      assert.equal(calls.length, 2);
      assert.deepEqual(run.views.map(view => ({ width: view.width, checks: view.checks, failures: view.failures })), [
        { width: 1200, checks: 1, failures: ['No visible change: #count'] },
        { width: 390, checks: 1, failures: ['No visible change: #count'] },
      ]);
      assert.match(run.error, /No visible change: #count/);
      assert.deepEqual(JSON.parse(calls[1].messages[1].content).smoke, response.smoke);
    }
    assert.equal(await page.frameLocator('#pg-preview-frame').locator('#count').textContent(), '0');
    assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { count: 0 });
  });
}

test('a repair cannot bypass failed original checks by replacing them with a weaker assertion', async t => {
  const broken = { ...counter, js: 'api.publish({count:0});' };
  const { page, calls } = await open(t, { respond: (route, body, call) => route.fulfill(sse(call === 1 ? broken : {
    ...broken, smoke: [{ action: 'click', selector: '#increment', value: '' }, { action: 'assertVisible', selector: '#increment', value: '' }],
  })) });
  await submit(page);
  const run = await finished(page);
  assert.equal(run.reason, 'incomplete');
  assert.equal(run.requests, 2);
  assert.equal(calls.length, 2);
  assert.match(run.error, /No visible change/);
  assert.deepEqual(JSON.parse(await page.locator('#pg-json').inputValue()).prototype.smoke, counter.smoke);
});

for (const status of [402, 429]) test('HTTP ' + status + ' stops after one request without repair', async t => {
  const { page, calls } = await open(t, { respond: route => route.fulfill({ status, json: { error: 'Fixture quota exceeded' } }) });
  await submit(page);
  const run = await finished(page);
  assert.equal(run.reason, 'provider-error');
  assert.equal(run.requests, 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(run.views, []);
  assert.match(run.error, /quota|402|429/i);
  assert.equal(await page.locator('#pg-chat-messages .pg-result-meta').innerText(), 'Provider limit reached: Fixture quota exceeded');
});

test('a streamed quota error stops after one request', async t => {
  const { page, calls } = await open(t, { respond: route => route.fulfill({
    contentType: 'text/event-stream', body: 'data: {"error":{"message":"Fixture quota exceeded","code":429}}\n\n',
  }) });
  await submit(page);
  const run = await finished(page);
  assert.equal(run.reason, 'provider-error');
  assert.equal(run.requests, 1);
  assert.equal(calls.length, 1);
  assert.match(run.error, /quota|429/i);
  assert.equal(await page.locator('#pg-chat-messages .pg-result-meta').innerText(), 'Provider limit reached: Fixture quota exceeded');
});

for (const recover of [false, true]) test('truncation ' + (recover ? 'can recover with one complete repair' : 'stops after two incomplete responses'), async t => {
  const { page, calls } = await open(t, { respond: (route, body, call) => route.fulfill(recover && call === 2 ? sse(counter) : sse('{"title":"Partial', 'length')) });
  await submit(page);
  const run = await finished(page);
  assert.equal(calls.length, 2);
  assert.equal(run.requests, 2);
  const repair = JSON.parse(calls[1].messages[1].content);
  assert.match(repair.failures, /incomplete|shorter/i);
  if (recover) ready(run, 2, 3);
  else {
    assert.equal(run.reason, 'incomplete');
    assert.deepEqual(run.views, []);
    assert.match(run.error, /incomplete|shorter/i);
    assert.equal(await page.locator('#pg-json').inputValue(), '');
  }
});

test('Stop removes active probe frames and restores the composer without repair', async t => {
  const { page, calls } = await open(t, { response: { ...counter, smoke: [{ action: 'wait', selector: '', value: '1500' }, ...counter.smoke] } });
  await submit(page);
  await page.waitForFunction(() => document.querySelectorAll('[data-prototype-probe]').length === 2);
  await page.locator('#pg-stop-btn').click();
  const run = await finished(page);
  assert.equal(run.reason, 'stopped');
  assert.equal(run.requests, 1);
  assert.equal(calls.length, 1);
  assert.equal(await page.locator('#pg-prompt').isEnabled(), true);
});

test('probe setup failures remove concurrent siblings before the bounded repair', async t => {
  const { page, calls } = await open(t);
  await page.evaluate(() => {
    const append = document.body.appendChild;
    document.body.appendChild = function(node) {
      if (node.matches?.('[data-prototype-probe]') && node.style.width === '390px') throw new Error('Fixture probe setup failure');
      return append.call(this, node);
    };
  });
  await submit(page);
  const run = await finished(page);
  assert.equal(run.reason, 'incomplete');
  assert.equal(calls.length, 2);
  assert.match(run.error, /Fixture probe setup failure/);
  assert.deepEqual(run.views, []);
});

test('a late canceled response cannot overwrite a newer successful prototype', async t => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const { page, calls } = await open(t, { ignoreAbort: true, respond: async (route, body, call) => {
    if (call === 1) await waiting;
    await route.fulfill(sse(call === 1 ? counter : staticPage));
  } });
  t.after(release);
  const started = page.waitForRequest(request => request.url() === base + '/api/generate');
  await submit(page);
  await started;
  await page.waitForFunction(() => document.querySelector('.pg-chat').getAttribute('aria-busy') === 'true');
  await page.locator('#pg-stop-btn').click();
  await page.waitForFunction(() => document.querySelector('.pg-chat').getAttribute('aria-busy') === 'false', null, { timeout: 3000 });
  await submit(page, 'Build the studio hours page.');
  await page.waitForFunction(() => window.__prototypeLastRun?.reason === 'complete');
  const completed = await finished(page);
  ready(completed, 1, 0);
  const lateResponse = page.waitForEvent('response', response => response.url() === base + '/api/generate');
  release();
  await (await lateResponse).finished();
  await page.waitForTimeout(300);
  assert.equal(calls.length, 2);
  assert.deepEqual(await page.evaluate(() => window.__prototypeLastRun), completed);
  assert.equal(JSON.parse(await page.locator('#pg-json').inputValue()).prototype.title, 'Studio hours');
  await page.frameLocator('#pg-preview-frame').getByRole('heading', { name: 'Studio hours' }).waitFor();
  assert.equal(await page.locator('[data-prototype-probe]').count(), 0);
});

for (const status of [402, 429]) test('component selection quota stops before generation ' + status, async t => {
  const { page, calls, picks } = await open(t, { chooseRespond: route => route.fulfill({ status, json: { error: 'Fixture quota' } }) });
  await submit(page);
  const run = await finished(page);
  assert.equal(run.reason, 'provider-error');
  assert.equal(run.requests, 0);
  assert.equal(calls.length, 0);
  assert.equal(picks.length, 1);
});

for (const failure of ['unavailable', 'partial', 'invalid']) test('component selection ' + failure + ' uses a visible bounded fallback', async t => {
  const { page, calls, picks } = await open(t, { chooseRespond: (route, body) => {
    if (failure === 'unavailable') return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    return route.fulfill({ json: { model: 'fixture', scores: failure === 'partial' ? { Button: 0.9 } : Object.fromEntries(Object.keys(body.components).map(key => [key, 9])) } });
  } });
  await submit(page);
  ready(await finished(page), 1, 3);
  assert.equal(picks.length, 1);
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].messages[0].content.includes('Jev selected'));
  assert.equal(await page.evaluate(() => __prototypeLastTiming.selection.status), 'fallback');
  assert.match(await page.locator('#pg-chat-messages').textContent(), /Component selection unavailable/);
});

test('Stop during selection never starts generation', async t => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const { page, calls, picks } = await open(t, { chooseRespond: async (route, body) => {
    await waiting;
    await route.fulfill({ json: { model: 'fixture', scores: Object.fromEntries(Object.keys(body.components).map(key => [key, 0.9])) } });
  } });
  t.after(release);
  const started = page.waitForRequest(request => request.url() === base + '/api/choose');
  await submit(page);
  await started;
  await page.locator('#pg-stop-btn').click();
  const run = await finished(page);
  assert.equal(run.reason, 'stopped');
  assert.equal(calls.length, 0);
  assert.equal(picks.length, 1);
  release();
});

test('component guidance keeps at most eight ranked choices within its character budget', async t => {
  const { page, calls } = await open(t, { chooseRespond: (route, body) => route.fulfill({ json: {
    model: 'fixture', scores: Object.fromEntries(Object.keys(body.components).map((key, index) => [key, 1 - index / 1000])),
  } }) });
  await submit(page);
  ready(await finished(page), 1, 3);
  const examples = JSON.parse(calls[0].messages[0].content.split('\n').at(-1));
  assert.equal(examples.length, 8);
  assert.equal(examples[0].name, 'Button');
  assert.ok(JSON.stringify(examples).length <= 12000);
});

test('static prototypes need one response, no behavior and no interaction assertions', async t => {
  const { page, calls } = await open(t, { response: staticPage });
  await submit(page, 'Build the studio hours page.');
  ready(await finished(page), 1, 0);
  assert.equal(calls.length, 1);
  await page.frameLocator('#pg-preview-frame').getByRole('heading', { name: 'Studio hours' }).waitFor();
  const spec = JSON.parse(await page.locator('#pg-json').inputValue());
  assert.equal(spec.prototype.interactive, false);
  assert.equal(spec.elements[spec.root].props.js, '');
  assert.deepEqual(spec.prototype.smoke, []);
  assert.equal(await page.evaluate(() => DaubPlayground.getOutput()), null);
});
