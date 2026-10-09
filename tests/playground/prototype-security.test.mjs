import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let browser, server, base;

before(async () => {
  server = createServer(async (req, res) => {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root)) return res.writeHead(403).end();
    try {
      res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
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

const spec = {
  root: 'prototype',
  elements: {
    prototype: {
      type: 'CustomHTML', children: [],
      props: {
        html: '<main id="prototype-app"><label for="answer">Answer</label><input id="answer"><button id="move">Move</button><output id="keys">0</output></main>',
        css: '#prototype-app { max-width: 600px; padding: 16px; } #keys { display: block; }',
        js: 'let keys = 0; api.publish({keys}); api.on(window, "keydown", event => { if (event.key === "ArrowRight") { keys++; container.querySelector("#keys").textContent = String(keys); api.publish({keys}); } });',
      },
    },
  },
  prototype: { version: 1, title: 'Keyboard fixture', brief: ['Keep user answers local.'], interactive: true, smoke: [] },
};

async function open(t) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());
  const requests = [], errors = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      requests.push(url.href);
      return route.abort();
    }
    if (url.origin === base) return route.continue();
    if (url.origin === 'https://daub.dev' && ['/daub.js', '/daub.css'].includes(url.pathname)) {
      return route.fulfill({ contentType: mime[extname(url.pathname)], body: await readFile(resolve(root, '.' + url.pathname)) });
    }
    return route.abort();
  });
  await context.addInitScript(value => {
    window.__securityMessages = [];
    window.addEventListener('message', event => {
      if (event.data && typeof event.data.type === 'string') window.__securityMessages.push(event.data);
      if (window.__holdOutput && event.data?.type === 'prototype-output') {
        window.__blockedOutputRequest = event.data;
        event.stopImmediatePropagation();
      }
    });
    if (window === window.top && location.pathname === '/playground.html') {
      sessionStorage.setItem('pg-current-spec', JSON.stringify(value));
    }
  }, spec);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => {
    assert.deepEqual(errors, [], 'Uncaught browser errors');
    assert.deepEqual(requests, [], 'Tests must not call provider or application APIs');
  });
  await page.goto(base + '/playground.html');
  const frame = await childFrame(page, '#pg-preview-frame');
  await frame.waitForFunction(() => window.DaubPrototype?.getOutput()?.keys === 0);
  return page;
}

async function childFrame(page, selector) {
  return (await page.locator(selector).elementHandle()).contentFrame();
}

test('export navigation never resends the spec and rejects pending and forged foreign output', async t => {
  const page = await open(t);
  const downloading = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const exportHtml = await readFile(await (await downloading).path(), 'utf8');
  await page.route(base + '/__security-export', route => route.fulfill({ contentType: 'text/html', body: exportHtml }));
  await page.goto(base + '/__security-export');
  const frame = await childFrame(page, '#prototype-preview');
  await frame.waitForFunction(() => window.DaubPrototype?.getOutput()?.keys === 0);
  await page.waitForFunction(() => __securityMessages.some(message => message.type === 'html'));
  assert.equal(await page.locator('#prototype-preview').getAttribute('sandbox'), 'allow-scripts');
  assert.equal(await page.locator('#prototype-preview').evaluate(el => el.contentDocument), null);
  assert.deepEqual(await page.evaluate(() => DaubPrototype.getOutput()), { keys: 0 });
  const bootstrap = await frame.evaluate(() => __securityMessages.filter(message => message.type === 'render').map(message => ({ seq: message.seq, title: message.spec.prototype.title })));
  assert.equal(bootstrap.length, 1);
  assert.equal(bootstrap[0].title, 'Keyboard fixture');
  assert.match(bootstrap[0].seq, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

  // Hold one real bridge request so navigation must reject it, not time out.
  await frame.evaluate(() => { window.__holdOutput = true; });
  await page.evaluate(() => {
    window.__pendingRead = DaubPrototype.getOutput().then(
      value => ({ status: 'resolved', value }),
      error => ({ status: 'rejected', message: error.message }),
    );
  });
  await frame.waitForFunction(() => window.__blockedOutputRequest);
  const request = await frame.evaluate(() => __blockedOutputRequest);
  const foreignUrl = 'https://foreign.invalid/prototype-security';
  await page.route(foreignUrl, route => route.fulfill({ contentType: 'text/html', body: `
    <!doctype html><title>Foreign document</title><script>
      window.received = [];
      addEventListener('message', function(event) {
        received.push(event.data);
        if (event.data.type === 'render') parent.postMessage({type:'html',seq:event.data.seq}, '*');
        if (event.data.type === 'prototype-output') parent.postMessage({type:'prototype-output-result',seq:event.data.seq,requestId:event.data.requestId,output:{foreign:true}}, '*');
        if (event.data.type === 'security-barrier') parent.postMessage({type:'security-barrier-complete'}, '*');
      });
    </script>` }));
  await frame.evaluate(url => { window.location.href = url; }, foreignUrl);
  await frame.waitForURL(foreignUrl);
  await frame.waitForLoadState('load');
  assert.deepEqual(await page.evaluate(() => __pendingRead), { status: 'rejected', message: 'Prototype navigated away' });

  // A round trip drains parent-to-child messages queued by the load handler.
  await page.evaluate(() => document.getElementById('prototype-preview').contentWindow.postMessage({ type: 'security-barrier' }, '*'));
  await page.waitForFunction(() => __securityMessages.some(message => message.type === 'security-barrier-complete'));
  assert.deepEqual(await frame.evaluate(() => received.filter(message => message.type === 'render')), []);

  // Even knowing the old sequence and request ID must not revive the bridge.
  await frame.evaluate(request => {
    parent.postMessage({ type: 'html', seq: request.seq }, '*');
    parent.postMessage({ type: 'prototype-output-result', seq: request.seq, requestId: request.requestId, output: { foreign: true } }, '*');
    parent.postMessage({ type: 'security-forgery-complete' }, '*');
  }, request);
  await page.waitForFunction(() => __securityMessages.some(message => message.type === 'security-forgery-complete'));
  assert.deepEqual(await page.evaluate(async () => {
    try { return { status: 'resolved', value: await DaubPrototype.getOutput() }; }
    catch (error) { return { status: 'rejected', message: error.message }; }
  }), { status: 'rejected', message: 'Prototype is not ready' });
  assert.deepEqual(await frame.evaluate(() => received.filter(message => message.type === 'prototype-output')), []);
});

for (const surface of ['composer', 'preview']) {
  test(`hidden keyboard checks preserve ${surface} focus, selection, and visible state`, async t => {
    const page = await open(t);
    const visible = await childFrame(page, '#pg-preview-frame');
    const payload = await visible.evaluate(() => __securityMessages.find(message => message.type === 'render'));
    await page.evaluate(payload => {
      const frame = document.createElement('iframe');
      frame.id = 'security-hidden-probe';
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1;border:0;width:1200px;height:900px';
      frame.addEventListener('load', () => frame.contentWindow.postMessage({ ...payload, seq: 'security-render' }, '*'), { once: true });
      frame.srcdoc = document.getElementById('pg-preview-frame').srcdoc;
      document.body.append(frame);
    }, payload);
    const hidden = await childFrame(page, '#security-hidden-probe');
    await hidden.waitForFunction(() => window.DaubPrototype?.getOutput()?.keys === 0);
    const input = surface === 'composer' ? page.locator('#pg-prompt') : visible.locator('#answer');
    await input.fill('Keep my answer');
    await input.focus();
    await input.evaluate(el => {
      el.setSelectionRange(5, 7);
      el.dataset.blurCount = '0';
      el.addEventListener('blur', () => { el.dataset.blurCount = String(Number(el.dataset.blurCount) + 1); });
    });
    await page.evaluate(() => document.getElementById('security-hidden-probe').contentWindow.postMessage({
      type: 'prototype-probe', requestId: 'security-key', steps: [
        { action: 'key', selector: '#move', value: 'ArrowRight' },
        { action: 'assertOutput', selector: 'keys', value: '1' },
      ],
    }, '*'));
    await page.waitForFunction(() => __securityMessages.some(message => message.type === 'prototype-probe-result' && message.requestId === 'security-key'));
    assert.deepEqual(await page.evaluate(() => __securityMessages.find(message => message.type === 'prototype-probe-result' && message.requestId === 'security-key').evidence), {
      width: 1200, checks: 1, failures: [],
    });
    assert.deepEqual(await input.evaluate(el => ({
      focused: el.ownerDocument.activeElement === el, value: el.value,
      selection: [el.selectionStart, el.selectionEnd], blurs: Number(el.dataset.blurCount),
    })), { focused: true, value: 'Keep my answer', selection: [5, 7], blurs: 0 });
    assert.equal(await page.evaluate(() => document.activeElement.id), surface === 'composer' ? 'pg-prompt' : 'pg-preview-frame');
    assert.deepEqual(await page.evaluate(() => DaubPlayground.getOutput()), { keys: 0 });
    assert.deepEqual(await hidden.evaluate(() => DaubPrototype.getOutput()), { keys: 1 });
    await page.keyboard.type('X');
    assert.equal(await input.inputValue(), 'Keep X answer');
  });
}
