import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { resolve, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { runInNewContext } from 'node:vm';
import { chromium } from 'playwright';

const home = dirname(fileURLToPath(import.meta.url));
const root = resolve(home, '../..');
const original = resolve(root, 'reports/direct-vs-hybrid-2026-10-08');
const baseline = resolve(home, 'baseline');
const evaluatorPath = 'reports/direct-vs-hybrid-2026-10-08/inspect.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const exists = async path => access(path).then(() => true, () => false);
const write = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value, { flag: 'wx' }); };
const inside = (parent, child) => child.startsWith(parent + sep);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function options(args) {
  const result = { widths: [390, 1200], cases: Array.from({ length: 10 }, (_, i) => i + 1) };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--help') { result.help = true; continue; }
    if (!['--out', '--source-snapshot', '--cases', '--compare'].includes(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Invalid argument: ' + key);
    const value = args[++i];
    if (key === '--cases') result.cases = value.split(',').map(Number);
    else result[key.slice(2)] = resolve(root, value);
  }
  if (!result.cases.length || result.cases.some(n => !Number.isInteger(n) || n < 1 || n > 10) || new Set(result.cases).size !== result.cases.length) throw new Error('--cases must contain distinct integers from 1 to 10');
  if (!result.help && (!result.out || !inside(home, result.out))) throw new Error('--out must be a NEW directory beneath reports/hybrid-improvements-2026-10-08');
  return result;
}

// Usable means complete structured fields and decodable state, not working JavaScript.
export function extractCandidate(result, saved) {
  const attempts = [];
  let selected = null;
  for (const [index, request] of (result.requests || []).entries()) {
    if (request.stage !== 'hybrid_behavior') continue;
    const attempt = { index, finishReason: request.finishReason ?? null, transportError: request.transportError ?? null, ms: request.ms, outputSha256: request.output == null ? null : digest(request.output) };
    try {
      if (request.finishReason !== 'stop' || request.transportError || request.error) throw new Error(request.transportError || JSON.stringify(request.error) || 'Incomplete response: ' + (request.finishReason || 'empty stream'));
      const raw = JSON.parse(request.output);
      if (!raw || !['initial', 'reduce', 'render', 'bind', 'output'].every(key => typeof raw[key] === 'string')) throw new Error('Missing structured behavior strings');
      const program = { ...raw, initial: JSON.parse(raw.initial) };
      attempt.status = 'structured-candidate';
      attempt.compileErrors = [];
      for (const [hook, parameters] of Object.entries({ reduce: 'state,action', render: 'state,ui', bind: 'ui,dispatch', output: 'state' })) {
        try { new Function(parameters, '"use strict";\n' + program[hook]); }
        catch (error) { attempt.compileErrors.push({ hook, message: error.message }); }
      }
      selected = { index, raw, program, output: request.output, compileErrors: attempt.compileErrors };
    } catch (error) { attempt.status = 'unusable'; attempt.reason = error.message; }
    attempts.push(attempt);
  }
  if (selected && saved.hybrid?.program && !isDeepStrictEqual(selected.program, saved.hybrid.program)) throw new Error('Raw candidate differs from retained controller; pairing requires review');
  const timeout = attempts.some(attempt => /timeout|timed out/i.test(attempt.transportError || ''));
  return { attempts, selected, status: selected ? (selected.compileErrors.length ? 'candidate/syntax-invalid' : 'candidate') : timeout ? 'timeout/no-program' : 'no-program' };
}

async function freezeCorpus() {
  const corpus = resolve(baseline, 'corpus');
  const manifestPath = resolve(corpus, 'manifest.json');
  if (!await exists(manifestPath)) {
    const hashes = {};
    for (let n = 1; n <= 10; n++) for (const name of ['result.json', 'spec.json']) {
      const path = `${String(n).padStart(2, '0')}-hybrid/${name}`;
      const bytes = await readFile(resolve(original, path));
      await write(resolve(corpus, path), bytes);
      hashes[path] = digest(bytes);
    }
    for (const name of ['manifest.json', 'environment.json', 'README.md']) {
      const bytes = await readFile(resolve(original, name));
      await write(resolve(corpus, 'original-' + name), bytes);
      hashes['original-' + name] = digest(bytes);
    }
    await write(manifestPath, json({ capturedAt: new Date().toISOString(), hashes }));
  }
  const manifest = JSON.parse(await readFile(manifestPath));
  for (const [path, hash] of Object.entries(manifest.hashes)) if (digest(await readFile(resolve(corpus, path))) !== hash) throw new Error('Frozen input changed: ' + path);
  return { path: corpus, ...manifest };
}

async function freezeSource(opts) {
  if (opts['source-snapshot']) {
    const source = opts['source-snapshot'];
    if (!inside(home, source)) throw new Error('Source snapshot must be under the replay report');
    const manifest = JSON.parse(await readFile(resolve(source, '../snapshot.json')));
    for (const [path, hash] of Object.entries(manifest.hashes)) if (digest(await readFile(resolve(source, path))) !== hash) throw new Error('Snapshot changed: ' + path);
    return { path: source, ...manifest };
  }
  const source = resolve(opts.out, 'source');
  const paths = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isFile() && /\.(js|css|html|json)$/.test(entry.name)).map(entry => entry.name);
  paths.push(evaluatorPath);
  const hashes = {};
  for (const path of paths) {
    const bytes = await readFile(resolve(root, path));
    await write(resolve(source, path), bytes);
    hashes[path] = digest(bytes);
  }
  // Refuse a mixed-version snapshot if another writer changed a source during capture.
  for (const [path, hash] of Object.entries(hashes)) if (digest(await readFile(resolve(root, path))) !== hash) throw new Error('Source changed during capture: ' + path + '; rerun into a new directory');
  const manifest = { path: source, capturedAt: new Date().toISOString(), hashes };
  await write(resolve(opts.out, 'snapshot.json'), json(manifest));
  return manifest;
}

export async function main(args = process.argv.slice(2)) {
  const opts = options(args);
  if (opts.help) {
    console.log('Baseline: node reports/hybrid-improvements-2026-10-08/replay.mjs --source-snapshot reports/hybrid-improvements-2026-10-08/baseline/source --out reports/hybrid-improvements-2026-10-08/baseline/replay-new');
    console.log('Current:  node reports/hybrid-improvements-2026-10-08/replay.mjs --out reports/hybrid-improvements-2026-10-08/after-01 --compare reports/hybrid-improvements-2026-10-08/baseline/replay-02');
    console.log('Optional: --cases 2,3,4. Existing outputs are never overwritten. No generation or provider requests.');
    return;
  }
  if (await exists(opts.out)) throw new Error('Output exists; choose a new --out directory: ' + opts.out);
  await mkdir(opts.out, { recursive: true });
  let browser, server;
  const records = [], network = [], served = new Set();
  const runnerSource = await readFile(fileURLToPath(import.meta.url));
  const protocol = { startedAt: new Date().toISOString(), root, output: opts.out, options: opts, widths: opts.widths, cases: opts.cases,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    runnerSha256: digest(runnerSource), modelCalls: 0,
    method: 'Original saved retained layout + last complete raw hybrid_behavior response. Use captured product normalizeProgram when available; otherwise JSON decode initial only. No replay-owned hook rewrites. Existing host restore/download path, frozen independent evaluateCase, fresh contexts, external/API traffic denied.' };
  try {
    const source = await freezeSource(opts);
    const corpus = await freezeCorpus();
    protocol.source = source;
    protocol.corpus = corpus;
    const ui = {};
    runInNewContext(await readFile(resolve(source.path, 'playground-hybrid-ui.js'), 'utf8'), ui, { timeout: 1000 });
    const hybridUI = ui.DaubHybridUI.create({});
    protocol.normalization = typeof hybridUI.normalizeProgram === 'function' ? 'DaubHybridUI.create({}).normalizeProgram(raw)' : 'captured legacy product: JSON.parse(raw.initial); preserve hooks';
    protocol.baselineQualification = 'Captured source snapshot, not a claim of byte-identical original benchmark source. See originalSourceDrift. Frozen independent evaluator does not invoke changed generated-contract probes.';
    const priorHashes = { ...JSON.parse(await readFile(resolve(corpus.path, 'original-manifest.json'))).hashes, ...JSON.parse(await readFile(resolve(corpus.path, 'original-environment.json'))).hashes };
    protocol.originalSourceDrift = Object.entries(source.hashes).filter(([path, hash]) => priorHashes[path] && priorHashes[path] !== hash).map(([path, hash]) => ({ path, original: priorHashes[path], replay: hash }));
    const frozenEvaluator = resolve(baseline, 'source', evaluatorPath);
    const expectedEvaluator = JSON.parse(await readFile(resolve(baseline, 'snapshot.json'))).hashes[evaluatorPath];
    protocol.evaluatorSha256 = digest(await readFile(frozenEvaluator));
    if (protocol.evaluatorSha256 !== expectedEvaluator) throw new Error('Frozen independent evaluator changed');
    const { evaluateCase, observe, installGuards } = await import(pathToFileURL(frozenEvaluator));
    const exports = new Map();
    server = createServer(async (req, res) => {
      try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (req.method !== 'GET' || path.startsWith('/api/')) { res.writeHead(403).end(); return; }
        if (exports.has(path)) { res.setHeader('Content-Type', 'text/html'); res.end(exports.get(path)); return; }
        const name = path.slice(1), file = resolve(source.path, name);
        if (!inside(source.path, file) || !source.hashes[name] || !types[extname(file)]) { res.writeHead(403).end(); return; }
        served.add(name);
        res.setHeader('Content-Type', types[extname(file)]); res.end(await readFile(file));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    protocol.browser = browser.version();
    async function routeOffline(context, log) {
      await context.route('**/*', async route => {
        const request = route.request(), target = new URL(request.url());
        if (request.method() === 'GET' && target.origin === 'https://daub.dev' && ['/daub.css', '/daub.js'].includes(target.pathname)) {
          const name = target.pathname.slice(1); served.add(name);
          await route.fulfill({ path: resolve(source.path, name), contentType: types[extname(name)] }); return;
        }
        if (request.method() === 'GET' && target.origin === base && (exports.has(target.pathname) || source.hashes[target.pathname.slice(1)]) && !target.pathname.startsWith('/api/')) { await route.continue(); return; }
        const denied = { url: request.url(), method: request.method(), type: request.resourceType() };
        log.push(denied); network.push(denied);
        await route.abort('blockedbyclient');
      });
    }
    let consecutiveFailures = 0;
    for (const number of opts.cases) {
      const id = String(number).padStart(2, '0') + '-hybrid', dir = resolve(opts.out, id);
      const saved = JSON.parse(await readFile(resolve(corpus.path, id, 'spec.json')));
      const result = JSON.parse(await readFile(resolve(corpus.path, id, 'result.json')));
      const candidate = extractCandidate(result, saved);
      const spec = structuredClone(saved);
      let normalizationError = null;
      if (candidate.selected) {
        try { spec.hybrid.program = typeof hybridUI.normalizeProgram === 'function' ? structuredClone(hybridUI.normalizeProgram(candidate.selected.raw)) : candidate.selected.program; }
        catch (error) { normalizationError = error.message; delete spec.hybrid.program; }
      }
      else delete spec.hybrid.program;
      let contractValidation;
      try { hybridUI.validateContract(structuredClone(saved.hybrid.contract)); contractValidation = { accepted: true }; }
      catch (error) { contractValidation = { accepted: false, error: error.message }; }
      if (!isDeepStrictEqual(spec.elements, saved.elements) || spec.root !== saved.root || !isDeepStrictEqual(spec.hybrid.contract, saved.hybrid.contract)) throw new Error('Replay changed frozen layout/contract: ' + id);
      const info = { id, number, prompt: result.prompt, status: normalizationError ? 'normalization-rejected' : candidate.selected && typeof hybridUI.normalizeProgram === 'function' ? 'candidate/normalized' : candidate.status, rawCandidateStatus: candidate.status, normalizationError, contractValidation, selectedRequest: candidate.selected?.index ?? null, attempts: candidate.attempts,
        original: { reason: result.hybrid?.reason, finishRejection: result.hybrid?.finishRejection, error: result.hybrid?.error, retainedProgram: !!saved.hybrid?.program },
        pairing: 'Saved spec.json contains the final pre-behavior layout (or the same retained layout for successful finishes). No layout edits occur after behavior generation in the saved pipeline. Preserve contract/status; attach decoded raw controller.',
        originalSpecSha256: corpus.hashes[id + '/spec.json'], originalResultSha256: corpus.hashes[id + '/result.json'],
        rawProgramSha256: candidate.selected ? digest(json(candidate.selected.program)) : null,
        programSha256: spec.hybrid.program ? digest(json(spec.hybrid.program)) : null, specSha256: digest(json(spec)), views: {}, blockedRequests: [], hostErrors: [] };
      records.push(info);
      await write(resolve(dir, 'spec.json'), json(spec));
      if (candidate.selected) {
        await write(resolve(dir, 'behavior-response.txt'), candidate.selected.output);
        if (spec.hybrid.program) await write(resolve(dir, 'program.json'), json(spec.hybrid.program));
      }
      const hostContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', serviceWorkers: 'block', acceptDownloads: true });
      try {
        await routeOffline(hostContext, info.blockedRequests);
        await hostContext.addInitScript(value => {
          if (window === window.top) sessionStorage.setItem('pg-current-spec', JSON.stringify(value));
          window.fetch = () => Promise.reject(new Error('Offline replay: fetch disabled'));
          window.WebSocket = window.EventSource = window.Worker = window.SharedWorker = function() { throw new Error('Offline replay: network/worker disabled'); };
          navigator.sendBeacon = () => false;
        }, spec);
        const host = await hostContext.newPage();
        host.on('pageerror', error => info.hostErrors.push(error.message));
        host.setDefaultTimeout(10000);
        await host.goto(base + '/playground.html', { waitUntil: 'load', timeout: 15000 });
        await host.locator('#pg-download').waitFor({ state: 'visible' });
        await host.frameLocator('#pg-preview-frame').locator('[data-spec-id]').first().waitFor({ state: 'attached' });
        const pending = host.waitForEvent('download', { timeout: 10000 });
        await host.locator('#pg-download').click();
        const download = await pending;
        await download.saveAs(resolve(dir, 'generated.html'));
        const html = await readFile(resolve(dir, 'generated.html'));
        info.htmlSha256 = digest(html);
        exports.set('/specimen/' + id + '/generated.html', html);
      } catch (error) { info.exportError = error.message; }
      finally { await hostContext.close(); }
      for (const width of opts.widths) {
        const view = { id, case: number, mode: 'hybrid-candidate', width, candidateStatus: info.status, checks: [], observations: [], screenshots: [], errors: [], warnings: [], blockedRequests: [], dialogs: [], evaluatorSha256: protocol.evaluatorSha256, htmlSha256: info.htmlSha256 };
        info.views[width] = view;
        if (info.exportError) { view.status = 'error'; view.harnessError = info.exportError; continue; }
        const viewDir = resolve(dir, String(width));
        await mkdir(viewDir);
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light', serviceWorkers: 'block', acceptDownloads: false });
        try {
          await routeOffline(context, view.blockedRequests);
          await context.addInitScript(installGuards);
          const page = await context.newPage();
          page.setDefaultTimeout(2500);
          page.on('pageerror', error => view.errors.push(error.message));
          page.on('console', message => { if (['error', 'warning'].includes(message.type())) view.warnings.push(message.text()); });
          page.on('dialog', dialog => { view.dialogs.push({ type: dialog.type(), message: dialog.message() }); void dialog.dismiss(); });
          const checkpoint = async label => {
            const name = String(view.screenshots.length).padStart(2, '0') + '-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 90) + '.png';
            const path = resolve(viewDir, name);
            await page.screenshot({ path, fullPage: true, animations: 'disabled', timeout: 10000 });
            view.screenshots.push({ label, path: relative(opts.out, path), sha256: digest(await readFile(path)) });
          };
          await page.goto(base + '/specimen/' + id + '/generated.html', { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(350);
          view.before = await observe(page); await checkpoint('before');
          await evaluateCase(page, number, view, checkpoint);
          view.after = await observe(page); await checkpoint('after');
          view.hiddenButVisible = await page.locator('[hidden]').evaluateAll(elements => elements.filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map(el => ({ specId: el.dataset.specId, tag: el.tagName, display: getComputedStyle(el).display, text: el.innerText })));
          view.errors = [...new Set([...view.errors, ...view.after.exportRuntime.errors, ...view.after.exportRuntime.outgoingMessages.filter(message => message.type === 'runtime-error' && message.error).map(message => message.error)])];
          const checks = view.checks.filter(check => !check.optional);
          view.uiStatus = checks.some(check => check.status === 'error') ? 'error' : checks.some(check => check.status === 'fail') ? 'fail' : !checks.length || checks.some(check => check.status === 'untestable') ? 'untestable' : 'pass';
          view.controllerStatus = !candidate.selected ? 'no-program' : view.errors.length || !view.after.prototype.available || view.after.prototype.output == null ? 'fail' : 'available';
          view.status = normalizationError ? 'normalization-rejected' : !candidate.selected ? candidate.status : view.uiStatus;
        } catch (error) { view.status = 'error'; view.harnessError = error.message; }
        finally { await context.close(); await write(resolve(viewDir, 'interaction.json'), json(view)); }
        console.log(id, width, view.status, 'controller=' + view.controllerStatus);
      }
      await write(resolve(dir, 'result.json'), json(info));
      consecutiveFailures = Object.values(info.views).some(view => view.status === 'error') ? consecutiveFailures + 1 : 0;
      if (consecutiveFailures >= 3) throw new Error('Circuit breaker: three consecutive replay infrastructure/evaluator failures; inspect per-case artifacts');
    }
    if (opts.compare) {
      const before = JSON.parse(await readFile(resolve(opts.compare, 'summary.json')));
      if (before.evaluatorSha256 !== protocol.evaluatorSha256 || !isDeepStrictEqual(before.corpusHashes, corpus.hashes)) throw new Error('Comparison requires identical evaluator and saved inputs');
      protocol.comparison = records.map(record => ({ id: record.id, widths: Object.fromEntries(opts.widths.map(width => {
        const previous = before.cases.find(item => item.id === record.id)?.views[width], current = record.views[width];
        const old = before.cases.find(item => item.id === record.id);
        return [width, { before: previous || null, after: { status: current.status, uiStatus: current.uiStatus, controllerStatus: current.controllerStatus }, sameRawProgram: (old?.rawProgramSha256 ?? old?.programSha256) === record.rawProgramSha256, sameProgram: old?.programSha256 === record.programSha256 }];
      })) }));
      await write(resolve(opts.out, 'comparison.json'), json(protocol.comparison));
    }
    if (records.some(record => Object.values(record.views).some(view => view.status === 'error'))) { protocol.hasReplayErrors = true; process.exitCode = 1; }
  } catch (error) { protocol.blocker = error.message; process.exitCode = 1; console.error(error.message); }
  finally {
    if (browser) await browser.close();
    if (server?.listening) await new Promise(done => server.close(done));
    protocol.finishedAt = new Date().toISOString(); protocol.servedSnapshotFiles = [...served].sort(); protocol.blockedRequests = network;
    await write(resolve(opts.out, 'protocol.json'), json(protocol));
    await write(resolve(opts.out, 'summary.json'), json({ startedAt: protocol.startedAt, finishedAt: protocol.finishedAt, blocker: protocol.blocker || null, evaluatorSha256: protocol.evaluatorSha256, corpusHashes: protocol.corpus?.hashes, sourceHashes: protocol.source?.hashes,
      cases: records.map(record => ({ id: record.id, status: record.status, rawCandidateStatus: record.rawCandidateStatus, selectedRequest: record.selectedRequest, original: record.original, normalizationError: record.normalizationError, contractValidation: record.contractValidation, rawProgramSha256: record.rawProgramSha256, programSha256: record.programSha256, htmlSha256: record.htmlSha256, exportError: record.exportError,
        views: Object.fromEntries(Object.entries(record.views).map(([width, view]) => [width, { status: view.status, uiStatus: view.uiStatus, controllerStatus: view.controllerStatus, errors: view.errors, harnessError: view.harnessError, checks: view.checks.map(({ name, optional, status, reason }) => ({ name, optional, status, reason })) }])) })) }));
    await write(resolve(opts.out, 'runner.mjs.txt'), runnerSource);
    console.log('Replay evidence:', opts.out);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
