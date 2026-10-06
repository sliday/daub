#!/usr/bin/env node
// Combo visual audit for DAUB json-render specs.
// Renders generated container x leaf pairs, random nested trees and the block
// library through daub-render.js + daub.css + daub.js (the hosted MCP HTML
// pipeline) across themes and viewports, then runs deterministic layout/visual
// checks in the page (see probe.js). Writes report.json, report.md, specs.json
// and element-focused screenshots for renders with findings.
//
//   node tests/combo-audit/audit.mjs [--seed 1] [--count 300] [--pairs] [--random] [--blocks] [--out dir]
//
// Exit code is always 0: it is an audit, not a gate.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve, join, normalize, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { genPairs, genRandom, loadBlocks, LEAF_TYPES } from './generate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

// ---- CLI ---------------------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name) { return argv.includes('--' + name); }
function opt(name, def) { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; }
if (flag('help') || flag('h')) {
  console.log(readFileSync(join(HERE, 'README.md'), 'utf8').split('\n## ')[0]);
  process.exit(0);
}
const SEED = Number(opt('seed', 1));
const COUNT = Number(opt('count', 300));
const kindFlags = ['pairs', 'random', 'blocks'].filter(flag);
const KINDS = new Set(kindFlags.length ? kindFlags : ['pairs', 'random', 'blocks']);
const OUT = resolve(opt('out', join(ROOT, 'test-results/combo-audit')));
const SHOTS = join(OUT, 'shots');
const THEMES = opt('themes', 'light,dark,synthwave,monospace-light').split(',').map(s => s.trim()).filter(Boolean);
const VIEWPORTS = opt('viewports', '1280x900,390x844').split(',').map(s => { const [w, h] = s.split('x').map(Number); return { width: w, height: h, key: `${w}x${h}` }; });
const WORKERS = Math.max(1, Number(opt('workers', Math.min(8, Math.max(2, cpus().length - 2)))));
const SHELL = opt('shell', 'fixed'); // fixed | mcp  (mcp = the body rule functions/api/mcp.js ships; see README)
const NET = opt('net', 'stub'); // stub | live
const ONLY = opt('only', null);
const EXTRA = opt('extra', null); // dir of saved specs (AI outputs): {root, elements} or {spec: {root, elements}}
const MAX_SHOTS = Number(opt('max-shots', 400));
const NO_SHOTS = flag('no-shots');
const ALL_PAIRS = flag('all-pairs');
// Default to the lucide build the hosted page loads (LUCIDE_SRC in functions/api/mcp.js),
// so broken_media mirrors production instead of whatever @latest ships today.
function pinnedLucide() {
  try { const m = /LUCIDE_SRC\s*=\s*['"][^'"]*lucide@([\d.]+)\//.exec(readFileSync(join(ROOT, 'functions/api/mcp.js'), 'utf8')); return m ? m[1] : 'latest'; } catch { return 'latest'; }
}
const LUCIDE = opt('lucide', pinnedLucide());
const ASSETS = opt('assets', null); // dir holding daub.css / daub.js / daub-render.js to serve instead of the repo copies
const RENDER_TIMEOUT_MS = 10000;
const RELOAD_EVERY = 250;
const PORT = Number(process.env.COMBO_AUDIT_PORT || 8878);
const BASE = `http://127.0.0.1:${PORT}`;

// ---- playwright (repo node_modules, or PLAYWRIGHT_MODULE=/abs/path/playwright/index.js) ----
async function loadChromium() {
  const spec = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const mod = await import(isAbsolute(spec) ? pathToFileURL(spec).href : spec);
  return mod.chromium || (mod.default && mod.default.chromium);
}

// ---- asset snapshot: freeze daub.* at start so concurrent edits can't split a run ----
const SNAP = {};
const HASHES = {};
for (const f of ['daub.css', 'daub.js', 'daub-render.js', 'tests/combo-audit/probe.js']) {
  const buf = readFileSync(ASSETS && !f.startsWith('tests/') ? join(resolve(ASSETS), f) : join(ROOT, f));
  SNAP['/' + f] = buf;
  HASHES[f] = createHash('sha1').update(buf).digest('hex').slice(0, 12);
}

async function ensureLucide() {
  const dir = join(OUT, 'vendor');
  const file = join(dir, `lucide-${LUCIDE}.min.js`);
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    try {
      const res = await fetch(`https://unpkg.com/lucide@${LUCIDE}/dist/umd/lucide.min.js`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      console.warn(`[combo-audit] could not fetch lucide@${LUCIDE} (${err.message}); icon checks will report every icon`);
      return { buf: Buffer.from('/* lucide unavailable */'), version: 'unavailable' };
    }
  }
  const buf = readFileSync(file);
  const m = /lucide v([\d.]+)/.exec(buf.slice(0, 200).toString());
  return { buf, version: m ? m[1] : LUCIDE };
}

// Mirrors renderToHTML() in functions/api/mcp.js with local assets. The only
// deliberate differences: body tokens (see --shell) and zeroed transitions so
// rects are measured at rest instead of mid-animation. --shell mcp copies the
// body rule from renderToHTML() verbatim (read once at start), so it tracks
// whatever the hosted page ships; --shell fixed pins the semantic tokens.
function hostedBodyCss() {
  const m = /function renderToHTML[\s\S]*?^\s*(body \{[^}]*\})/m.exec(readFileSync(join(ROOT, 'functions/api/mcp.js'), 'utf8'));
  if (!m) throw new Error('combo-audit: no body rule found in renderToHTML() in functions/api/mcp.js');
  return m[1];
}
const HOSTED_BODY_CSS = hostedBodyCss();
function shellHtml(shell) {
  const bodyCss = shell === 'mcp'
    ? HOSTED_BODY_CSS
    : 'body { margin: 0; padding: 16px; font-family: Inter, system-ui, sans-serif; background: var(--db-color-bg); color: var(--db-color-text); }';
  return `<!DOCTYPE html>
<html data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAUB combo audit</title>
  <link rel="stylesheet" href="/daub.css">
  <script src="/__vendor/lucide.js"></script>
  <style>
    ${bodyCss}
    #app { max-width: 1200px; margin: 0 auto; }
    *, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; caret-color: transparent !important; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="/daub.js"></script>
  <script src="/daub-render.js"></script>
  <script src="/tests/combo-audit/probe.js"></script>
</body>
</html>`;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
function startServer(lucideBuf) {
  return new Promise((ok, fail) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, BASE);
        const p = decodeURIComponent(url.pathname);
        res.setHeader('Cache-Control', 'max-age=3600');
        if (p === '/__combo/shell.html') { res.setHeader('Content-Type', MIME['.html']); return res.end(shellHtml(url.searchParams.get('shell') || SHELL)); }
        if (p === '/__vendor/lucide.js') { res.setHeader('Content-Type', MIME['.js']); return res.end(lucideBuf); }
        if (SNAP[p]) { res.setHeader('Content-Type', MIME[p.slice(p.lastIndexOf('.'))]); return res.end(SNAP[p]); }
        const abs = normalize(join(ROOT, p.replace(/^\/+/, '')));
        if (!abs.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
        const st = statSync(abs, { throwIfNoEntry: false });
        if (!st || st.isDirectory()) { res.statusCode = 404; return res.end('not found'); }
        res.setHeader('Content-Type', MIME[abs.slice(abs.lastIndexOf('.'))] || 'application/octet-stream');
        res.end(readFileSync(abs));
      } catch (err) { res.statusCode = 500; res.end(String(err.message || err)); }
    });
    server.listen(PORT, '127.0.0.1', () => ok(server));
    server.on('error', fail);
  });
}

// ---- network policy ------------------------------------------------------------
// stub: known placeholder-image hosts answer with a same-size SVG (fast, deterministic);
// anything else external is aborted, so fabricated hosts (images.example.com) show up as
// broken media. live: real network (slow; finds dead placeholder URLs too).
const PLACEHOLDER_HOSTS = new Set(['picsum.photos', 'fastly.picsum.photos', 'i.pravatar.cc', 'placehold.co', 'via.placeholder.com', 'images.unsplash.com', 'source.unsplash.com', 'randomuser.me', 'ui-avatars.com', 'dummyimage.com', 'loremflickr.com', 'placekitten.com']);
function placeholderSize(u) {
  const q = u.searchParams;
  if (q.get('w') && q.get('h')) return [Number(q.get('w')), Number(q.get('h'))];
  const wx = /(\d{2,4})x(\d{2,4})/.exec(u.pathname);
  if (wx) return [Number(wx[1]), Number(wx[2])];
  const nums = u.pathname.split('/').filter(s => /^\d{2,4}$/.test(s)).map(Number);
  if (nums.length >= 2) return nums.slice(-2);
  if (nums.length === 1) return [nums[0], nums[0]];
  if (q.get('w')) return [Number(q.get('w')), Math.round(Number(q.get('w')) * 0.66)];
  return [800, 600];
}
async function routeExternal(route) {
  const req = route.request();
  let u;
  try { u = new URL(req.url()); } catch { return route.abort('failed'); }
  if (NET === 'live') return route.continue();
  if (req.resourceType() === 'image' && PLACEHOLDER_HOSTS.has(u.hostname)) {
    const [w, h] = placeholderSize(u);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#9c9486"/><path d="M0 0L${w} ${h}M${w} 0L0 ${h}" stroke="#c9c2b4" stroke-width="2"/></svg>`;
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
  }
  return route.abort('failed');
}

// ---- specs ---------------------------------------------------------------------
function buildSpecs() {
  const blocks = loadBlocks(ROOT);
  let specs = [];
  if (KINDS.has('pairs')) {
    // Solo baseline: each leaf alone, so pair findings can be split into combo-only vs inherent.
    const surfacePairs = genPairs(SEED, blocks, { allPairs: true }).filter(p => p.container === 'surface');
    const solo = LEAF_TYPES.map(t => {
      const pairLike = surfacePairs.find(p => p.leaf === t);
      const els = JSON.parse(JSON.stringify(pairLike.spec.elements));
      delete els.C;
      return { id: `solo--${t}`, kind: 'solo', leaf: t, spec: { root: 'L0', elements: els }, open: [] };
    });
    specs.push(...solo, ...genPairs(SEED, blocks, { allPairs: ALL_PAIRS }));
  }
  if (KINDS.has('random') && COUNT > 0) specs.push(...genRandom(SEED, COUNT, blocks));
  if (KINDS.has('blocks')) specs.push(...blocks);
  if (EXTRA) {
    const dir = resolve(EXTRA);
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
      try {
        const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        const spec = j && j.elements ? j : j && j.spec;
        if (spec && spec.root && spec.elements) specs.push({ id: `extra--${f.replace(/\.json$/, '')}`, kind: 'extra', file: join(dir, f), spec: { root: spec.root, elements: spec.elements }, open: [] });
      } catch { /* skip malformed */ }
    }
  }
  if (ONLY) { const rx = new RegExp(ONLY); specs = specs.filter(s => rx.test(s.id)); }
  return specs;
}

// ---- worker pool ---------------------------------------------------------------
async function openShell(page, shell = SHELL) {
  await page.goto(`${BASE}/__combo/shell.html?shell=${shell}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__combo && window.__combo.ready, null, { timeout: 10000 });
}

function withTimeout(p, ms, label) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + ' timeout')), ms); })]).finally(() => clearTimeout(t));
}

async function runPool(context, jobs, handler, label) {
  let next = 0, done = 0;
  const started = Date.now();
  const total = jobs.length;
  const workers = Array.from({ length: Math.min(WORKERS, total) }, async (_, w) => {
    const page = await context.newPage();
    await openShell(page);
    let vpKey = null, n = 0;
    for (;;) {
      const i = next++;
      if (i >= total) break;
      const job = jobs[i];
      if (job.vp.key !== vpKey) { await page.setViewportSize({ width: job.vp.width, height: job.vp.height }); vpKey = job.vp.key; }
      if (n > 0 && n % RELOAD_EVERY === 0) await openShell(page);
      n++;
      try {
        await handler(page, job);
      } catch (err) {
        job.error = String(err.message || err).slice(0, 300);
        try { await openShell(page); vpKey = null; } catch { /* next job retries */ }
      }
      done++;
      if (done % 1000 === 0 || done === total) {
        const el = (Date.now() - started) / 1000;
        console.log(`[combo-audit] ${label} ${done}/${total} (${el.toFixed(0)}s, eta ${((total - done) * el / done).toFixed(0)}s)`);
      }
    }
    await page.close();
  });
  await Promise.all(workers);
}

function payload(job) { return { spec: job.spec.spec, theme: job.theme, open: job.spec.open }; }

async function renderJob(page, job) {
  const res = await withTimeout(page.evaluate((j) => window.__combo.render(j), payload(job)), RENDER_TIMEOUT_MS, 'render');
  job.result = res;
}

function renderId(job) { return `${job.spec.id}__${job.theme}__${job.vp.key}`; }

async function shotJob(page, job) {
  await renderJob(page, job);
  const hl = await page.evaluate((f) => window.__combo.highlight(f), job.findings);
  let clip;
  if (hl.rects.length) {
    const x0 = Math.min(...hl.rects.map(r => r.x)), y0 = Math.min(...hl.rects.map(r => r.y));
    const x1 = Math.max(...hl.rects.map(r => r.x + r.w)), y1 = Math.max(...hl.rects.map(r => r.y + r.h));
    const pad = 24;
    let x = Math.max(0, x0 - pad), y = Math.max(0, y0 - pad);
    let w = Math.max(360, x1 - x0 + pad * 2), h = Math.max(220, y1 - y0 + pad * 2);
    w = Math.min(w, Math.max(hl.docW, job.vp.width) - x);
    h = Math.min(h, 1800, Math.max(hl.docH, job.vp.height) - y);
    clip = { x, y, width: Math.max(1, w), height: Math.max(1, h) };
  } else {
    clip = { x: 0, y: 0, width: job.vp.width, height: job.vp.height };
  }
  const file = join(SHOTS, renderId(job) + '.png');
  await page.screenshot({ path: file, fullPage: true, clip });
  job.shot = 'shots/' + renderId(job) + '.png';
}

// ---- shell probe: what the verbatim hosted shell does per theme ------------------
async function shellProbe(context, specs) {
  const sample = specs.find(s => s.kind === 'block' && /dashboard/.test(s.id)) || specs.find(s => s.kind === 'block') || specs[0];
  if (!sample) return null;
  const out = { sample: sample.id, body_css: HOSTED_BODY_CSS, themes: {} };
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const shell of ['mcp', 'fixed']) {
    await openShell(page, shell);
    for (const theme of THEMES) {
      const res = await page.evaluate((j) => window.__combo.render(j), { spec: sample.spec, theme, open: [] });
      const body = await page.evaluate(() => { const s = getComputedStyle(document.body); return { bg: s.backgroundColor, color: s.color, bgImage: s.backgroundImage.slice(0, 40) }; });
      const shot = `shots/shell-probe__${shell}__${theme}.png`;
      if (!NO_SHOTS && theme !== 'light') await page.screenshot({ path: join(OUT, shot), clip: { x: 0, y: 0, width: 1280, height: 900 } });
      (out.themes[theme] ||= {})[shell] = { body, contrast: res.totals.contrast || 0, ...(!NO_SHOTS && theme !== 'light' ? { shot } : {}) };
    }
  }
  await page.close();
  return out;
}

// ---- reporting ------------------------------------------------------------------
function inc(o, k, n = 1) { o[k] = (o[k] || 0) + n; }
// Real but not a visual defect of the hosted page: daub.js dev lint (localhost only),
// contrast within 0.25 of AA, and position:fixed components (BottomNav) the generator nests.
const INFO_CHECKS = new Set(['lint', 'contrast_near', 'escaped_fixed']);
const isVisual = f => !INFO_CHECKS.has(f.check);

function aggregate(jobs) {
  // Solo baseline lookup: theme|vp|leafType|check
  const solo = new Set();
  for (const j of jobs) if (j.spec.kind === 'solo') for (const f of j.findings) solo.add(`${j.theme}|${j.vp.key}|${f.type}|${f.check}`);
  const byCheck = {}, byType = {}, byCheckType = {}, byKind = {}, byTheme = {}, byVp = {}, rendersByCheck = {}, comboOnly = {}, pairCombos = {}, unique = {};
  for (const j of jobs) {
    const checksHere = new Set();
    for (const f of j.findings) {
      f.solo_repro = j.spec.kind !== 'solo' && solo.has(`${j.theme}|${j.vp.key}|${f.type}|${f.check}`);
      inc(byCheck, f.check); inc(byType, f.type);
      // One defect per (spec, check, element, box), however many themes/viewports repeat it.
      if (j.spec.kind !== 'solo') (unique[f.check] ||= new Set()).add(`${j.spec.id}|${f.id}|${f.sel}|${f.cls || f.props || f.child || f.side || ''}`);
      const ct = `${f.check}|${f.type}`;
      (byCheckType[ct] ||= { check: f.check, type: f.type, findings: 0, renders: new Set(), specs: new Set(), examples: [], combo_only: 0 });
      const e = byCheckType[ct];
      e.findings++; e.renders.add(renderId(j)); e.specs.add(j.spec.id);
      if (!f.solo_repro && j.spec.kind !== 'solo') { e.combo_only++; inc(comboOnly, f.check); }
      if (e.examples.length < 4 && !e.examples.includes(renderId(j))) e.examples.push(renderId(j));
      inc(byKind, `${j.spec.kind}|${f.check}`); inc(byTheme, `${j.theme}|${f.check}`); inc(byVp, `${j.vp.key}|${f.check}`);
      checksHere.add(f.check);
      // Worst pairs rank on combo-only findings; inherent leaf problems show up in the solo rows.
      if (j.spec.kind === 'pair' && !f.solo_repro) { const k = `${j.spec.container} x ${j.spec.leaf}`; (pairCombos[k] ||= { checks: {}, renders: new Set() }); inc(pairCombos[k].checks, f.check); pairCombos[k].renders.add(renderId(j)); }
    }
    for (const c of checksHere) inc(rendersByCheck, c);
  }
  const ctList = Object.values(byCheckType).map(e => ({ check: e.check, type: e.type, findings: e.findings, renders: e.renders.size, specs: e.specs.size, combo_only: e.combo_only, examples: e.examples }))
    .sort((a, b) => b.renders - a.renders || b.findings - a.findings);
  const pairList = Object.entries(pairCombos).map(([k, v]) => ({ pair: k, renders: v.renders.size, checks: v.checks }))
    .sort((a, b) => b.renders - a.renders || Object.keys(b.checks).length - Object.keys(a.checks).length || Object.values(b.checks).reduce((s, x) => s + x, 0) - Object.values(a.checks).reduce((s, x) => s + x, 0));
  const uniqueByCheck = Object.fromEntries(Object.entries(unique).map(([k, v]) => [k, v.size]));
  return { byCheck, byType, rendersByCheck, comboOnly, uniqueByCheck, byCheckType: ctList, byKind, byTheme, byVp, pairCombos: pairList };
}

function selectShots(jobs) {
  const withF = jobs.filter(j => j.findings.some(isVisual) && j.spec.kind !== 'solo');
  const groups = new Map();
  const tIdx = Object.fromEntries(THEMES.map((t, i) => [t, i]));
  const vIdx = Object.fromEntries(VIEWPORTS.map((v, i) => [v.key, i]));
  for (const j of withF) for (const f of j.findings) {
    if (!isVisual(f)) continue;
    const k = `${f.check}|${f.type}`;
    if (!groups.has(k)) groups.set(k, []);
    const g = groups.get(k);
    if (g[g.length - 1] !== j) g.push(j);
  }
  // Within a group: one render per spec first (earliest theme/viewport), then the rest.
  const ordered = [...groups.keys()].sort().map(k => {
    const g = [...new Set(groups.get(k))].sort((a, b) => a.spec.id.localeCompare(b.spec.id) || tIdx[a.theme] - tIdx[b.theme] || vIdx[a.vp.key] - vIdx[b.vp.key]);
    const firsts = [], rest = [], seen = new Set();
    for (const j of g) (seen.has(j.spec.id) ? rest : (seen.add(j.spec.id), firsts)).push(j);
    return [...firsts, ...rest];
  });
  const picked = new Set();
  for (let round = 0; picked.size < MAX_SHOTS; round++) {
    let any = false;
    for (const g of ordered) {
      if (round < g.length) { any = true; picked.add(g[round]); if (picked.size >= MAX_SHOTS) break; }
    }
    if (!any) break;
  }
  return { picked: [...picked], candidates: withF.length };
}

function md(report) {
  const { meta, summary } = report;
  const L = [];
  const checks = Object.keys(summary.byCheck).sort((a, b) => INFO_CHECKS.has(a) - INFO_CHECKS.has(b) || summary.byCheck[b] - summary.byCheck[a]);
  L.push('# DAUB Combo Visual Audit', '');
  L.push(`Seed **${meta.seed}**, ${meta.specs.total} specs (${Object.entries(meta.specs.byKind).map(([k, v]) => `${k} ${v}`).join(', ')}), ${meta.renders} renders across themes ${meta.themes.join(', ')} and viewports ${meta.viewports.join(', ')}. Runtime ${meta.runtime_s}s with ${meta.workers} workers. Shell: \`${meta.shell}\`, lucide ${meta.lucide}, network \`${meta.net}\`.`, '');
  L.push(`Renders with visual findings: **${meta.renders_with_findings}** of ${meta.renders}. Visual findings: **${meta.findings}**, **${meta.unique_defects}** unique (spec, check, element) after collapsing themes and viewports. Info: ${meta.info_findings} (${[...INFO_CHECKS].join(', ')}; not counted above). Per-render cap ${12} per check; totals below count everything. Screenshots: ${meta.screenshots.taken}${meta.screenshots.capped ? ` (capped at ${meta.screenshots.cap}; ${meta.screenshots.candidates} renders had findings)` : ''}.`, '');
  L.push('Asset hashes: ' + Object.entries(meta.hashes).map(([k, v]) => `\`${k}\` ${v}`).join(', '), '');
  if (meta.shell_probe) {
    L.push('## Hosted shell probe', '');
    L.push(`\`functions/api/mcp.js\` renderToHTML() body rule: \`${meta.shell_probe.body_css}\`. Sample: \`${meta.shell_probe.sample}\` at 1280x900.`, '');
    L.push('| Theme | mcp body bg | mcp body color | mcp contrast findings | fixed body bg | fixed contrast findings |', '| --- | --- | --- | ---: | --- | ---: |');
    for (const [t, v] of Object.entries(meta.shell_probe.themes)) L.push(`| ${t} | ${v.mcp.body.bg} | ${v.mcp.body.color} | ${v.mcp.contrast}${v.mcp.shot ? ` ([shot](${v.mcp.shot}))` : ''} | ${v.fixed.body.bg} | ${v.fixed.contrast}${v.fixed.shot ? ` ([shot](${v.fixed.shot}))` : ''} |`);
    L.push('');
  }
  L.push('## Findings by check', '');
  L.push('| Check | Findings | Renders | Unique | Not reproduced solo | ' + Object.keys(meta.specs.byKind).join(' | ') + ' |');
  L.push('| --- | ---: | ---: | ---: | ---: | ' + Object.keys(meta.specs.byKind).map(() => '---:').join(' | ') + ' |');
  for (const c of checks) L.push(`| ${c}${INFO_CHECKS.has(c) ? ' (info)' : ''} | ${summary.byCheck[c]} | ${summary.rendersByCheck[c]} | ${summary.uniqueByCheck[c] || 0} | ${summary.comboOnly[c] || 0} | ` + Object.keys(meta.specs.byKind).map(k => summary.byKind[`${k}|${c}`] || 0).join(' | ') + ' |');
  L.push('');
  L.push('## By theme and viewport', '');
  const cols = [...meta.themes, ...meta.viewports];
  L.push('| Check | ' + cols.join(' | ') + ' |', '| --- | ' + cols.map(() => '---:').join(' | ') + ' |');
  for (const c of checks) L.push(`| ${c} | ` + meta.themes.map(t => summary.byTheme[`${t}|${c}`] || 0).concat(meta.viewports.map(v => summary.byVp[`${v}|${c}`] || 0)).join(' | ') + ' |');
  L.push('');
  L.push('## Top (check, component type) pairs', '');
  L.push('Type = spec type of the nearest element carrying `data-spec-id`. "Combo-only" = findings whose (check, type) did not occur when the leaf rendered alone at the same theme and viewport.', '');
  L.push('| # | Check | Type | Renders | Specs | Findings | Combo-only | Examples |', '| ---: | --- | --- | ---: | ---: | ---: | ---: | --- |');
  const shotOf = Object.fromEntries(report.results.filter(r => r.shot).map(r => [r.id, r.shot]));
  summary.byCheckType.slice(0, 40).forEach((e, i) => {
    const ex = e.examples.slice(0, 2).map(x => shotOf[x] ? `[${x}](${shotOf[x]})` : `\`${x}\``).join('<br>');
    L.push(`| ${i + 1} | ${e.check} | ${e.type} | ${e.renders} | ${e.specs} | ${e.findings} | ${e.combo_only} | ${ex} |`);
  });
  L.push('');
  L.push('## Check x type matrix (top 25 types by findings)', '');
  const types = Object.keys(summary.byType).sort((a, b) => summary.byType[b] - summary.byType[a]).slice(0, 25);
  const cell = {};
  for (const e of summary.byCheckType) cell[`${e.check}|${e.type}`] = e.findings;
  L.push('| Type | ' + checks.join(' | ') + ' |', '| --- | ' + checks.map(() => '---:').join(' | ') + ' |');
  for (const t of types) L.push(`| ${t} | ` + checks.map(c => cell[`${c}|${t}`] || '').join(' | ') + ' |');
  L.push('');
  if (summary.pairCombos.length) {
    L.push('## Worst container x leaf pairs (combo-only findings)', '');
    L.push('| Pair | Renders with combo-only findings (of ' + meta.themes.length * meta.viewports.length + ') | Checks |', '| --- | ---: | --- |');
    for (const p of summary.pairCombos.slice(0, 30)) L.push(`| ${p.pair} | ${p.renders} | ${Object.entries(p.checks).map(([c, n]) => `${c} ${n}`).join(', ')} |`);
    L.push('');
  }
  L.push('## Worst blocks', '');
  const blockRows = {};
  for (const r of report.results) if (r.kind === 'block') { (blockRows[r.spec] ||= { renders: 0, checks: {} }); if (r.findings.length) blockRows[r.spec].renders++; for (const f of r.findings) inc(blockRows[r.spec].checks, f.check); }
  L.push('| Block | Renders with findings | Checks |', '| --- | ---: | --- |');
  Object.entries(blockRows).filter(([, v]) => v.renders).sort((a, b) => b[1].renders - a[1].renders || Object.values(b[1].checks).reduce((s, x) => s + x, 0) - Object.values(a[1].checks).reduce((s, x) => s + x, 0)).slice(0, 25)
    .forEach(([k, v]) => L.push(`| ${k} | ${v.renders} | ${Object.entries(v.checks).map(([c, n]) => `${c} ${n}`).join(', ')} |`));
  L.push('');
  if (meta.errors.length) { L.push('## Harness errors', ''); meta.errors.slice(0, 20).forEach(e => L.push(`- \`${e.id}\`: ${e.error}`)); L.push(''); }
  L.push('Reproduce one spec: `node tests/combo-audit/audit.mjs --only \'<spec id regex>\' --out /tmp/x` (specs.json holds every generated spec).', '');
  return L.join('\n');
}

// ---- main -------------------------------------------------------------------------
async function main() {
  const started = Date.now();
  mkdirSync(OUT, { recursive: true });
  if (existsSync(SHOTS)) rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const specs = buildSpecs();
  const byKind = {};
  for (const s of specs) inc(byKind, s.kind);
  writeFileSync(join(OUT, 'specs.json'), JSON.stringify(Object.fromEntries(specs.map(s => [s.id, s.file ? { kind: s.kind, file: s.file } : { kind: s.kind, open: s.open, spec: s.spec }])), null, 1));

  const jobs = [];
  for (const vp of VIEWPORTS) for (const s of specs) for (const theme of THEMES) jobs.push({ spec: s, theme, vp });
  console.log(`[combo-audit] seed=${SEED} specs=${specs.length} (${Object.entries(byKind).map(([k, v]) => `${k}:${v}`).join(' ')}) renders=${jobs.length} workers=${WORKERS} shell=${SHELL}`);

  const lucide = await ensureLucide();
  const server = await startServer(lucide.buf);
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height }, reducedMotion: 'reduce' });
  await context.route((u) => !u.href.startsWith(BASE), routeExternal);

  let probe = null;
  jobs.shotMeta = { taken: 0, cap: MAX_SHOTS, capped: false, candidates: 0 };
  try {
    await runPool(context, jobs, renderJob, 'render');
    for (const j of jobs) j.findings = (j.result && j.result.findings) || (j.error ? [{ check: 'harness_error', id: null, type: '(harness)', sel: '', msg: j.error }] : []);

    const { picked, candidates } = NO_SHOTS ? { picked: [], candidates: 0 } : selectShots(jobs);
    if (picked.length) {
      const shotJobs = picked.map(j => ({ ...j, result: null, error: null }));
      await runPool(context, shotJobs, shotJob, 'screenshot');
      const shotById = new Map(shotJobs.filter(j => j.shot).map(j => [renderId(j), j.shot]));
      for (const j of jobs) { const s = shotById.get(renderId(j)); if (s) j.shot = s; }
    }
    if (candidates > MAX_SHOTS) console.log(`[combo-audit] screenshots capped at ${MAX_SHOTS} (${candidates} renders had findings)`);
    jobs.shotMeta = { taken: picked.length, cap: MAX_SHOTS, capped: candidates > MAX_SHOTS, candidates };
    if (SHELL !== 'mcp' && KINDS.has('blocks')) probe = await shellProbe(context, specs);
  } finally {
    await browser.close();
    server.close();
  }

  const summary = aggregate(jobs);
  const results = jobs.map(j => {
    const r = { id: renderId(j), spec: j.spec.id, kind: j.spec.kind, theme: j.theme, viewport: j.vp.key, findings: j.findings };
    if (j.spec.kind === 'pair') { r.container = j.spec.container; r.leaf = j.spec.leaf; }
    if (j.spec.kind === 'block') r.file = j.spec.file;
    if (j.result && j.result.totals && Object.values(j.result.totals).some(n => n > 12)) r.totals = j.result.totals;
    if (j.shot) r.shot = j.shot;
    return r;
  });
  const totalFindings = Object.entries(summary.byCheck).reduce((a, [c, n]) => a + (INFO_CHECKS.has(c) ? 0 : n), 0);
  const infoFindings = Object.entries(summary.byCheck).reduce((a, [c, n]) => a + (INFO_CHECKS.has(c) ? n : 0), 0);
  const uniqueDefects = Object.entries(summary.uniqueByCheck).reduce((a, [c, n]) => a + (INFO_CHECKS.has(c) ? 0 : n), 0);
  const meta = {
    seed: SEED, count: COUNT, kinds: [...KINDS], generated_at: new Date().toISOString(),
    runtime_s: Math.round((Date.now() - started) / 1000), workers: WORKERS, shell: SHELL, net: NET, lucide: lucide.version,
    themes: THEMES, viewports: VIEWPORTS.map(v => v.key), hashes: HASHES,
    specs: { total: specs.length, byKind }, renders: jobs.length,
    renders_with_findings: jobs.filter(j => j.findings.some(isVisual)).length, findings: totalFindings, unique_defects: uniqueDefects, info_findings: infoFindings, info_checks: [...INFO_CHECKS],
    screenshots: jobs.shotMeta, shell_probe: probe,
    errors: jobs.filter(j => j.error).map(j => ({ id: renderId(j), error: j.error })),
  };
  const report = { meta, summary, results };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report));
  writeFileSync(join(OUT, 'report.md'), md(report));

  const top = summary.byCheckType.slice(0, 5).map(e => `${e.check}x${e.type}:${e.renders}`).join(' ');
  console.log(`[combo-audit] done: ${jobs.length} renders / ${specs.length} specs in ${meta.runtime_s}s | ${totalFindings} visual findings (${uniqueDefects} unique) in ${meta.renders_with_findings} renders, ${infoFindings} info | ${Object.entries(summary.byCheck).map(([k, v]) => `${k}=${v}`).join(' ')} | top ${top} | shots ${meta.screenshots.taken} | ${join(OUT, 'report.json')}`);
}

main().catch((err) => { console.error('[combo-audit] fatal', err); process.exitCode = 0; });
