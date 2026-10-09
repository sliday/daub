import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.env.BENCH_OUTPUT ? resolve(root, process.env.BENCH_OUTPUT) : dirname(fileURLToPath(import.meta.url));
await mkdir(output, { recursive: true });
const selected = process.env.BENCH_CASES?.split(',').map(Number);
const selectedRuns = process.env.BENCH_RUNS?.split(',');
const selectedModes = process.env.BENCH_MODES?.split(',');
const alternateModes = process.env.BENCH_ALTERNATE === '1';
const prompts = [
  '10-step personality test, mobile-optimized.',
  'Email and password sign-in form with a forgot-password link.',
  'Three-plan pricing page with a monthly/annual toggle.',
  'Simple to-do list with add, complete, and delete actions.',
  'Profile settings form with name, email, and a save button.',
  'Recipe search page with a search field and six recipe cards.',
  'Weekly habit tracker with seven daily checkboxes per habit.',
  'Support inbox with a message list and a reading pane.',
  'Shopping cart with item quantities and an order total.',
  'Event registration form with name, email, and ticket quantity.'
];
const handlers = {};
for (const name of ['generate', 'choose', 'refine-judge']) handlers['/api/' + name] = (await import(pathToFileURL(resolve(root, 'functions/api', name + '.js')))).onRequestPost;
const results = [];
let active = null, circuit = null, base;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, base);
    if (url.pathname === '/api/figma') { res.setHeader('Content-Type', 'application/json'); res.end('{"connected":false}'); return; }
    if (url.pathname.startsWith('/api/')) {
      if (!handlers[url.pathname] || req.method !== 'POST') { res.writeHead(404).end(); return; }
      if (circuit) { res.writeHead(429, { 'Content-Type': 'application/json' }).end('{"error":"Benchmark stopped after quota or rate limit"}'); return; }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const input = JSON.parse(body);
      const record = { route: url.pathname, stage: input.response_format?.json_schema?.name || input.messages?.[0]?.content?.slice(0, 100) || 'judge', started: Date.now(), requestedModel: input.model || null, format: input.response_format || null, reasoning: input.reasoning || null };
      record.messageCharacters = (input.messages || []).reduce((sum, message) => sum + JSON.stringify(message.content || '').length, 0);
      record.schemaCharacters = JSON.stringify(input.response_format || null).length;
      if (record.format) record.format = { type: record.format.type, name: record.format.json_schema?.name };
      const owner = active;
      owner?.requests.push(record);
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      let text = '';
      try {
        const response = await handlers[url.pathname]({ request: new Request(url, { method: 'POST', headers: req.headers, body, signal: controller.signal }), env: { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY, ALLOW_LOCAL_REFINEMENT: 'true' } });
        record.status = response.status;
        if ([402, 429].includes(response.status)) circuit = { run: owner?.id, status: response.status, route: url.pathname };
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) for await (const chunk of response.body) { text += Buffer.from(chunk).toString(); res.write(chunk); }
        res.end();
      } catch (error) {
        record.transportError = error.name + ': ' + error.message;
        if (!res.headersSent) res.writeHead(502);
        res.end();
      } finally {
        record.ms = Date.now() - record.started;
        const packets = text.trim().startsWith('{') ? [JSON.parse(text)] : text.split('\n').filter(line => line.startsWith('data:')).flatMap(line => { try { return [JSON.parse(line.slice(5))]; } catch { return []; } });
        for (const packet of packets) {
          if (packet.model) record.model = packet.model;
          if (packet.usage) record.usage = packet.usage;
          if (packet.error) {
            record.error = packet.error;
            if ([402, 429].includes(Number(packet.error.code || packet.error.status)) || /rate.?limit|quota|credits/i.test(JSON.stringify(packet.error))) circuit = { run: owner?.id, route: url.pathname, error: packet.error };
          }
          const choice = packet.choices?.[0];
          if (input.response_format?.json_schema?.name?.startsWith('hybrid_') && choice?.delta?.content) record.output = (record.output || '') + choice.delta.content;
          if (choice?.finish_reason) record.finishReason = choice.finish_reason;
        }
      }
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/playground.html' : url.pathname));
    if (!path.startsWith(root + '/') || /(?:^|\/)\.[^/]/.test(url.pathname)) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch (error) { if (!res.headersSent) res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const hashes = {};
for (const file of ['playground.html', 'playground-snowflake.js', 'playground-quality.js', 'playground-hybrid.js', 'playground-hybrid-ui.js', 'playground-hybrid-checks.js', 'playground-behavior.js', 'playground-behavior-recipes.js', 'functions/api/generate.js', 'functions/api/refine-judge.js', 'daub.css', 'daub-render.js']) hashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ date: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), dirty: true, hashes, prompts, modes: selectedModes || ['direct', 'snowflake'], protocol: 'One sample per mode, fresh context, serial designs, ' + (!selectedModes || alternateModes ? 'alternate order' : 'fixed order') + ', live providers, 240s per run', base }, null, 2));

async function measurements(page) {
  return page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'; };
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).map(el => ({ tag: el.tagName, text: el.innerText.trim(), x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y }));
    const overflow = [...document.querySelectorAll('body *')].filter(el => visible(el) && el.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(el).position !== 'fixed').slice(0, 20).map(el => ({ tag: el.tagName, id: el.dataset.specId, text: (el.innerText || '').slice(0, 100), right: el.getBoundingClientRect().right }));
    return { viewport: { width: innerWidth, height: innerHeight }, scrollWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2, headings, overflow,
      text: document.body.innerText, buttons: [...document.querySelectorAll('button')].filter(visible).map(el => ({ text: el.innerText, label: el.getAttribute('aria-label'), disabled: el.disabled })), inputs: [...document.querySelectorAll('input,textarea,select')].filter(visible).map(el => ({ type: el.type, placeholder: el.placeholder, value: el.value })),
      brokenImages: [...document.images].filter(el => !el.complete || !el.naturalWidth).map(el => el.src), renderErrors: [...document.querySelectorAll('[data-render-error]')].map(el => el.textContent), emptyLayoutNodes: [...document.querySelectorAll('[data-spec-id]')].filter(el => visible(el) && !el.children.length && !el.textContent.trim() && ['flex', 'grid'].includes(getComputedStyle(el).display)).map(el => el.dataset.specId) };
  });
}

try {
  for (let index = 0; index < prompts.length && !circuit; index++) {
    if (selected && !selected.includes(index + 1)) continue;
    for (const mode of selectedModes ? (alternateModes && index % 2 ? selectedModes.slice().reverse() : selectedModes) : (index % 2 ? ['snowflake', 'direct'] : ['direct', 'snowflake'])) {
      if (circuit) break;
      const id = String(index + 1).padStart(2, '0') + '-' + (mode === 'snowflake' ? 'recursive' : mode);
      if (selectedRuns && !selectedRuns.includes(id)) continue;
      const dir = resolve(output, id);
      await mkdir(dir, { recursive: true });
      const result = { id, prompt: prompts[index], mode, requests: [], branchErrors: [], consoleErrors: [], started: Date.now() };
      active = result;
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', acceptDownloads: true });
      await context.route('https://daub.dev/daub.css*', route => route.fulfill({ path: resolve(root, 'daub.css'), contentType: 'text/css' }));
      await context.route('https://daub.dev/daub.js*', route => route.fulfill({ path: resolve(root, 'daub.js'), contentType: 'text/javascript' }));
      await context.route('**/*', route => route.request().method() !== 'GET' && !route.request().url().startsWith(base) ? route.abort() : route.fallback());
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => result.consoleErrors.push(error.message));
      page.on('console', message => { if (message.text().startsWith('BENCH_BRANCH ')) result.branchErrors.push(message.text().slice(13)); });
      console.log('START', id, result.prompt);
      try {
        await page.goto(base + '/playground.html', { waitUntil: 'domcontentloaded' });
        if (await page.locator('#pg-generation-mode').count()) await page.locator('#pg-generation-mode').selectOption(mode);
        else if (mode !== 'hybrid') throw new Error('This host only supports Hybrid; historical modes require their archived revision.');
        await page.evaluate(() => {
          const original = window.DaubSnowflake;
          window.DaubSnowflake = { ...original, run(options) { const progress = options.onProgress; return original.run({ ...options, onProgress(event) { if (event.phase === 'branch-error') console.log('BENCH_BRANCH ' + JSON.stringify(event)); return progress(event); } }); } };
        });
        await page.locator('#pg-prompt').fill(result.prompt);
        await page.locator('#pg-prompt').press('Enter');
        await page.waitForFunction(() => document.querySelector('.pg-chat').getAttribute('aria-busy') === 'true', null, { timeout: 5000 });
        const until = Date.now() + 240000;
        while (await page.locator('.pg-chat').getAttribute('aria-busy') === 'true') {
          if (circuit || Date.now() > until) {
            result.stopped = circuit ? 'circuit-breaker' : 'benchmark-240s-limit';
            await page.locator('#pg-stop-btn').click().catch(() => page.evaluate(() => { if (typeof _abortCtrl !== 'undefined' && _abortCtrl) _abortCtrl.abort(); }));
            break;
          }
          await page.waitForTimeout(500);
        }
        result.ms = Date.now() - result.started;
        result.status = await page.locator('.pg-result-meta').allTextContents();
        result.chat = await page.locator('#pg-chat-messages').innerText();
        result.error = await page.locator('#pg-json-error').isVisible() ? await page.locator('#pg-json-error-msg').textContent() : null;
        if (mode === 'hybrid') result.hybrid = await page.evaluate(() => window.__hybridLastRun || null);
        const spec = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec') || 'null'));
        result.hasSpec = !!spec?.elements;
        await page.screenshot({ path: resolve(dir, 'playground.png') });
        if (spec?.elements) {
          await writeFile(resolve(dir, 'spec.json'), JSON.stringify(spec, null, 2));
          const types = {};
          for (const node of Object.values(spec.elements)) types[node.type] = (types[node.type] || 0) + 1;
          result.types = types; result.elements = Object.keys(spec.elements).length;
          const pending = page.waitForEvent('download');
          await page.locator('#pg-download').click();
          const download = await pending;
          await download.saveAs(resolve(dir, 'generated.html'));
          result.htmlBytes = (await readFile(resolve(dir, 'generated.html'))).length;
          result.views = {};
          for (const width of [1200, 390]) {
            const exported = await context.newPage();
            await exported.setViewportSize({ width, height: 900 });
            const errors = []; exported.on('pageerror', error => errors.push(error.message));
            await exported.goto(base + '/' + relative(root, dir) + '/generated.html', { waitUntil: 'domcontentloaded' });
            await exported.waitForTimeout(1200);
            result.views[width] = { ...await measurements(exported), errors };
            await exported.screenshot({ path: resolve(dir, 'render-' + width + '.png'), fullPage: true, animations: 'disabled' });
            await exported.close();
          }
        }
      } catch (error) { result.harnessError = error.message; }
      finally {
        result.ms ??= Date.now() - result.started;
        await context.close();
        await writeFile(resolve(dir, 'result.json'), JSON.stringify(result, null, 2));
        results.push(result);
        await writeFile(resolve(output, 'results.json'), JSON.stringify({ circuit, results }, null, 2));
        console.log('END', id, Math.round(result.ms / 1000) + 's', result.elements || 0, result.harnessError || result.status?.join(' | ') || result.error || 'no status');
      }
    }
  }
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
  console.log('FINISHED', results.length, circuit ? 'CIRCUIT BREAKER' : '');
}
