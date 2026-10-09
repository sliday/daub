import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import behavior from '../../playground-behavior.js';

const root = resolve('.');
const spec = {
  root: 'page',
  elements: {
    page: { type: 'Stack', children: ['count', 'add'] },
    count: { type: 'Text', props: { content: 'Not started' } },
    add: { type: 'Button', props: { label: 'Add' } },
  },
  hybrid: { program: {
    initial: { count: 0 },
    reduce: 'return {count: state.count + 1};',
    render: 'ui.text("count", state.count);',
    bind: 'ui.preview.dataset.binds = String(Number(ui.preview.dataset.binds || 0) + 1); ui.on("add", "click", function() { dispatch({type:"ADD"}); });',
  } },
};
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
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? undefined : process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
});
after(async () => {
  await browser?.close();
  if (server?.listening) await new Promise(done => server.close(done));
});

async function open(t, value = spec) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route('**/*', route => {
    const url = route.request().url();
    return url.startsWith(base) && !url.includes('/api/') ? route.continue() : route.abort();
  });
  await context.addInitScript(() => {
    if (window !== window.top) {
      window.sharedRenders = [];
      window.addEventListener('message', event => {
        if (event.source === window.parent && event.data?.type === 'render') sharedRenders.push(event.data);
      });
      return;
    }
    // Isolate the external compression dependency; exercise the real URL loader and iframe.
    window.LZString = { compressToEncodedURIComponent: encodeURIComponent, decompressFromEncodedURIComponent: decodeURIComponent };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'Uncaught browser errors'));
  page.setDefaultTimeout(5000);
  await page.goto(base + '/playground.html#s=' + encodeURIComponent(JSON.stringify(value)));
  await page.locator('[data-share-notice]').waitFor();
  const frame = await page.locator('#pg-preview-frame').contentFrame();
  await frame.locator('[data-spec-id="count"]').waitFor();
  return { page, frame, context };
}

async function runtime(page) {
  const frame = await (await page.locator('#pg-preview-frame').elementHandle()).contentFrame();
  return frame.evaluate(() => {
    const root = document.getElementById('pg-iframe-root');
    return { active: !!root.__daubBehaviorController, binds: Number(root.dataset.binds || 0), text: root.querySelector('[data-spec-id="count"]').textContent };
  });
}

test('shared Hybrid program stays paused until Run code, preserving the original spec', async t => {
  const { page, frame } = await open(t);
  assert.deepEqual(await runtime(page), { active: false, binds: 0, text: 'Not started' });
  const iframe = await (await page.locator('#pg-preview-frame').elementHandle()).contentFrame();
  const payload = await iframe.evaluate(() => sharedRenders.at(-1));
  assert.equal(payload.inert, true);
  assert.equal(payload.spec.hybrid.program, undefined);
  assert.deepEqual(payload.js, []);
  assert.deepEqual(await page.locator('#pg-json').inputValue().then(JSON.parse), spec);
  await frame.getByRole('button', { name: 'Add', exact: true }).click();
  assert.deepEqual(await runtime(page), { active: false, binds: 0, text: 'Not started' });
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await frame.getByText('0', { exact: true }).waitFor();
  await frame.getByRole('button', { name: 'Add', exact: true }).click();
  assert.deepEqual(await runtime(page), { active: true, binds: 1, text: '1' });
  assert.equal(await page.locator('[data-share-notice]').count(), 0);
});

test('a new shared hash revokes the previous controller and requires fresh consent', async t => {
  const { page, frame } = await open(t);
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await frame.getByText('0', { exact: true }).waitFor();
  const iframe = await (await page.locator('#pg-preview-frame').elementHandle()).contentFrame();
  await iframe.evaluate(() => { window.previousController = document.getElementById('pg-iframe-root').__daubBehaviorController; });
  const next = structuredClone(spec);
  next.elements.count.props.content = 'Second shared design';
  next.hybrid.program.initial.count = 7;
  await page.evaluate(value => { location.hash = 's=' + LZString.compressToEncodedURIComponent(JSON.stringify(value)); }, next);
  await page.locator('[data-share-notice]').waitFor();
  await frame.getByText('Second shared design', { exact: true }).waitFor();
  await iframe.evaluate(() => previousController.dispatch({ type: 'ADD' }));
  assert.deepEqual(await runtime(page), { active: false, binds: 1, text: 'Second shared design' });
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await frame.getByText('7', { exact: true }).waitFor();
  await frame.getByRole('button', { name: 'Add', exact: true }).click();
  assert.deepEqual(await runtime(page), { active: true, binds: 2, text: '8' });
});

test('shared output API stays inert before consent and resets for another shared design', async t => {
  const value = structuredClone(spec);
  value.hybrid.program.output = 'return {count:state.count};';
  const { page, frame } = await open(t, value);
  assert.equal(await page.evaluate(() => window.DaubPlayground.getOutput()), null);
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await frame.getByText('0', { exact: true }).waitFor();
  await frame.getByRole('button', { name: 'Add', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.DaubPlayground.getOutput()), { count: 1 });
  value.elements.count.props.content = 'Waiting for consent';
  await page.evaluate(value => { location.hash = 's=' + LZString.compressToEncodedURIComponent(JSON.stringify(value)); }, value);
  await frame.getByText('Waiting for consent', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.DaubPlayground.getOutput()), null);
});

test('cleanup remount output stays private after an inert shared hash replacement', async t => {
  const cleanupProgram = {
    initial: { count: 99, source: 'previous cleanup' },
    reduce: 'return state;', render: '', bind: '', output: 'return state;',
  };
  const value = structuredClone(spec);
  value.hybrid.program.output = 'return {count:state.count};';
  value.hybrid.program.bind += ' return function() { var preview = ui.preview; window.cleanupController = ' + behavior.toScript(cleanupProgram) + '; };';
  const { page, frame } = await open(t, value);
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await frame.getByText('0', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.DaubPlayground.getOutput()), { count: 0 });

  const next = structuredClone(spec);
  next.elements.count.props.content = 'Replacement awaiting consent';
  next.hybrid.program.initial.count = 7;
  next.hybrid.program.output = 'return {count:state.count};';
  await page.evaluate(value => { location.hash = 's=' + LZString.compressToEncodedURIComponent(JSON.stringify(value)); }, next);
  await frame.getByText('Replacement awaiting consent', { exact: true }).waitFor();
  await page.locator('[data-share-notice]').waitFor();
  const iframe = await (await page.locator('#pg-preview-frame').elementHandle()).contentFrame();
  assert.deepEqual(await iframe.evaluate(() => ({
    remounted: document.getElementById('pg-iframe-root').__daubBehaviorController === window.cleanupController,
    output: window.cleanupController.getOutput(),
    inert: sharedRenders.at(-1).inert,
    program: sharedRenders.at(-1).spec.hybrid.program,
  })), { remounted: true, output: { count: 99, source: 'previous cleanup' }, inert: true, program: undefined });
  assert.equal(await page.evaluate(() => window.DaubPlayground.getOutput()), null);

  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await frame.getByText('7', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.DaubPlayground.getOutput()), { count: 7 });
  assert.equal(await iframe.evaluate(() => window.cleanupController.getOutput()), null);
});

test('output bridge ignores a matching reply whose source is another window', async t => {
  const value = structuredClone(spec);
  value.hybrid.program.output = 'return {count:state.count};';
  const { page, frame } = await open(t, value);
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await frame.getByText('0', { exact: true }).waitFor();
  const iframe = await (await page.locator('#pg-preview-frame').elementHandle()).contentFrame();
  const seq = await iframe.evaluate(() => sharedRenders.at(-1).seq);
  const output = await page.evaluate(async seq => {
    const other = document.createElement('iframe');
    document.body.append(other);
    const original = crypto.randomUUID;
    const requestId = 'unrelated-window-output';
    crypto.randomUUID = () => requestId;
    try {
      const pending = window.DaubPlayground.getOutput();
      // Deliver before the real iframe's asynchronous reply, with matching correlation fields.
      window.dispatchEvent(new MessageEvent('message', {
        source: other.contentWindow, origin: 'null',
        data: { type: 'prototype-output-result', requestId, seq, output: { count: 999 } },
      }));
      return await pending;
    } finally {
      crypto.randomUUID = original;
      other.remove();
    }
  }, seq);
  assert.deepEqual(output, { count: 0 });
});

test('inert iframe messages reject supplied Hybrid and legacy code even without sanitization', async t => {
  const { page } = await open(t);
  await page.evaluate(({ spec, code }) => {
    document.getElementById('pg-preview-frame').contentWindow.postMessage({
      type: 'render', inert: true, spec, html: '', js: [
        { id: spec.root, code },
        { id: spec.root, code: 'preview.dataset.legacyRan = "yes";' },
      ],
    }, '*');
  }, { spec, code: behavior.toScript(spec.hybrid.program) });
  const iframe = await (await page.locator('#pg-preview-frame').elementHandle()).contentFrame();
  // A health reply follows the preceding render message on the same message queue.
  await page.evaluate(() => new Promise(resolve => {
    const frame = document.getElementById('pg-preview-frame').contentWindow;
    function receive(event) {
      if (event.source !== frame || event.data?.type !== 'health' || event.data.requestId !== 'inert-barrier') return;
      window.removeEventListener('message', receive); resolve();
    }
    window.addEventListener('message', receive);
    frame.postMessage({ type: 'health', requestId: 'inert-barrier' }, '*');
  }));
  assert.deepEqual(await runtime(page), { active: false, binds: 0, text: 'Not started' });
  assert.equal(await iframe.evaluate(() => document.getElementById('pg-iframe-root').dataset.legacyRan), undefined);
});

test('download after consent preserves and runs the Hybrid program', async t => {
  const { page, frame, context } = await open(t);
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await frame.getByText('0', { exact: true }).waitFor();
  const pending = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await pending).path(), 'utf8');
  await context.route('https://daub.dev/**', async route => {
    const path = resolve(root, '.' + new URL(route.request().url()).pathname);
    if (!path.startsWith(root + '/')) return route.abort();
    try { await route.fulfill({ body: await readFile(path), contentType: path.endsWith('.js') ? 'text/javascript' : 'text/css' }); }
    catch { await route.abort(); }
  });
  await context.route(base + '/shared-export.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  const exported = await context.newPage();
  await exported.goto(base + '/shared-export.html');
  await exported.getByText('0', { exact: true }).waitFor();
  await exported.getByRole('button', { name: 'Add', exact: true }).click();
  assert.equal(await exported.locator('[data-spec-id="count"]').textContent(), '1');
  assert.equal(await exported.evaluate(() => document.getElementById('pg-iframe-root').dataset.binds), '1');
});
