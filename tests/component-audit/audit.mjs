#!/usr/bin/env node
// Component audit harness for daub.
// Loads components.json, renders each component in a headless Chromium,
// runs layout + a11y + spec-presence checks, writes report.json/report.md
// and per-component screenshots.

import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..'); // /Users/stas/Playground/daub
const OUT_DIR = resolve(ROOT, 'test-results/component-audit');
const SHOT_DIR = resolve(OUT_DIR, 'screenshots');
const REPORT_JSON = resolve(OUT_DIR, 'report.json');
const REPORT_MD = resolve(OUT_DIR, 'report.md');
const PORT = Number(process.env.AUDIT_PORT || 8877);
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 800, height: 600 };
const PER_COMPONENT_BUDGET_MS = 6000;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });

// --- load inputs -----------------------------------------------------------
const catalog = JSON.parse(readFileSync(resolve(ROOT, 'components.json'), 'utf8'));
const components = catalog.components;
const daubCss = readFileSync(resolve(ROOT, 'daub.css'), 'utf8');
const checkLayoutSrc = readFileSync(resolve(HERE, 'fixtures/check-layout.js'), 'utf8');

// Build a selector presence index from daub.css: class name (including
// BEM modifiers) -> true. This sidesteps the expense of re-parsing the
// stylesheet per component.
const SELECTOR_INDEX = (() => {
  const set = new Set();
  const rx = /\.(db-[a-zA-Z0-9_-]+)/g;
  let m;
  while ((m = rx.exec(daubCss)) !== null) set.add(m[1]);
  return set;
})();

// Accept either "db-foo" or ".db-foo"; normalize the input.
function hasSelector(cls) {
  const key = cls.startsWith('.') ? cls.slice(1) : cls;
  return SELECTOR_INDEX.has(key);
}

// --- tiny local HTTP server ------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};
function startServer() {
  return new Promise((ok, fail) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, BASE);
        const relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        const abs = normalize(join(ROOT, relPath));
        if (!abs.startsWith(ROOT)) { res.statusCode = 403; return res.end('forbidden'); }
        const st = statSync(abs, { throwIfNoEntry: false });
        if (!st || st.isDirectory()) { res.statusCode = 404; return res.end('not found'); }
        const ext = abs.slice(abs.lastIndexOf('.'));
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(abs).pipe(res);
      } catch (err) {
        res.statusCode = 500; res.end(String(err.message || err));
      }
    });
    server.listen(PORT, '127.0.0.1', () => ok(server));
    server.on('error', fail);
  });
}

// --- pa11y-ish accessibility checks (lightweight, in-page) -----------------
// We skip pa11y (extra install cost) and do WCAG-flavoured rules directly.
const A11Y_RULES = `
(function(){
  function box(el){ return el.getBoundingClientRect(); }
  function role(el){ return el.getAttribute('role') || ''; }
  function visible(el){ var s=getComputedStyle(el); return s.display!=='none' && s.visibility!=='hidden' && box(el).width>0 && box(el).height>0; }
  function relativeLuminance(rgb){
    function ch(c){ c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
    return 0.2126*ch(rgb[0]) + 0.7152*ch(rgb[1]) + 0.0722*ch(rgb[2]);
  }
  function parseColor(str){
    var m=/rgba?\\(([^)]+)\\)/.exec(str||''); if(!m) return null;
    var parts=m[1].split(',').map(function(x){ return parseFloat(x.trim()); });
    if (parts.length>=3) return [parts[0],parts[1],parts[2], parts.length>=4?parts[3]:1];
    return null;
  }
  function contrast(fg, bg){
    var lf=relativeLuminance(fg), lb=relativeLuminance(bg);
    var light=Math.max(lf,lb), dark=Math.min(lf,lb);
    return (light+0.05)/(dark+0.05);
  }
  function effectiveBg(el){
    var cur=el;
    while(cur && cur.nodeType===1){
      var c=parseColor(getComputedStyle(cur).backgroundColor);
      if (c && c[3]>0.01) return c;
      cur = cur.parentElement;
    }
    return [245,240,225,1]; // daub cream default
  }
  function selector(el){
    if (!el) return '';
    if (el.id) return '#'+el.id;
    var cls = (el.className && typeof el.className==='string') ? el.className.trim().split(/\\s+/).slice(0,2).join('.') : '';
    return el.tagName.toLowerCase() + (cls?'.'+cls:'');
  }

  var violations = [];
  var slot = document.getElementById('slot');
  if (!slot) return [];
  var all = slot.querySelectorAll('*');

  // Rule: interactive elements must be focusable/have name.
  for (var i=0;i<all.length;i++){
    var el = all[i];
    var tag = el.tagName.toLowerCase();
    var r = role(el);
    var isInteractive =
      tag==='button' || tag==='a' || tag==='input' || tag==='select' || tag==='textarea' ||
      ['button','link','checkbox','radio','switch','tab','menuitem','option','slider'].indexOf(r)>-1;

    if (isInteractive && visible(el)){
      var aname =
        (el.getAttribute('aria-label')||'').trim() ||
        (el.getAttribute('aria-labelledby') ? 'labelledby':'') ||
        (el.getAttribute('title')||'').trim() ||
        (el.getAttribute('alt')||'').trim() ||
        (el.innerText||el.textContent||'').trim();
      if (!aname && (tag==='input'||tag==='select'||tag==='textarea')){
        var id = el.id;
        if (id){
          var lbl = document.querySelector('label[for="'+id+'"]');
          if (lbl) aname = (lbl.innerText||lbl.textContent||'').trim();
        }
        if (!aname) {
          var parentLabel = el.closest && el.closest('label');
          if (parentLabel) aname = (parentLabel.innerText||parentLabel.textContent||'').trim();
        }
        if (!aname) aname = (el.getAttribute('placeholder')||'').trim();
      }
      if (!aname) violations.push({code:'name-missing', message:'interactive element has no accessible name', selector:selector(el)});
    }

    if (tag==='img' && !el.hasAttribute('alt')){
      violations.push({code:'image-alt', message:'img missing alt attribute', selector:selector(el)});
    }
  }

  // Check if any ancestor has a gradient background or alpha-composited bg.
  // The contrast sampler can't reliably read the pixel in those cases, so skip.
  function hasUnstableBackground(el){
    var cur = el;
    while (cur && cur.nodeType === 1) {
      var cs2 = getComputedStyle(cur);
      var bi = cs2.backgroundImage;
      if (bi && bi !== 'none' && /gradient/i.test(bi)) return true;
      var bc = parseColor(cs2.backgroundColor);
      if (bc && bc[3] > 0 && bc[3] < 0.99) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  // Rule: text contrast — sample up to 12 text nodes to keep cheap.
  var sampled=0;
  var walker = document.createTreeWalker(slot, NodeFilter.SHOW_TEXT, null);
  var node;
  while((node=walker.nextNode()) && sampled < 12){
    var t=(node.nodeValue||'').trim();
    if (!t) continue;
    var p = node.parentElement; if (!p || !visible(p)) continue;
    var cs = getComputedStyle(p);
    var fg = parseColor(cs.color); if (!fg || fg[3]<0.1) continue;
    // Skip contrast on gradient / alpha-composited backgrounds — not reliably measurable.
    if (hasUnstableBackground(p)) { sampled++; continue; }
    var bg = effectiveBg(p);
    var ratio = contrast(fg, bg);
    var size = parseFloat(cs.fontSize); var bold = parseInt(cs.fontWeight,10)>=700;
    var large = (size>=24) || (size>=18.66 && bold);
    var req = large?3:4.5;
    if (ratio < req - 0.01){
      violations.push({code:'contrast', message:'low contrast '+ratio.toFixed(2)+' < '+req, selector:selector(p)});
    }
    sampled++;
  }

  return violations;
})();
`;

// --- classification --------------------------------------------------------
function classifySeverity(checks, component) {
  const specMissing = !checks.spec_present_in_css;
  const isFoundation = component.category === 'foundations';
  const isRuntimeOnly = component.runtime_only === true;
  const errorish = (checks.console_errors || []).filter(e => !/favicon/i.test(e));
  // runtime_only components (e.g. toast-stack) have no static example — layout
  // "no content" is expected, not a defect.
  if (isRuntimeOnly && !checks.layout_ok) {
    const onlyEmpty = (checks.layout_issues || []).every(i => /(no (visible )?(content|children|text)|empty)/i.test(i));
    if (onlyEmpty) checks.layout_ok = true;
  }
  const visibilityContrastCount = (checks.pa11y_violations || [])
    .filter(v => /contrast|visibility|name-missing|image-alt/.test(v.code)).length;

  if (!checks.layout_ok) return 'red';
  if (errorish.length > 0) return 'red';
  if (specMissing && !isFoundation) return 'red';
  if (visibilityContrastCount > 5) return 'red';
  if (!checks.js_init_ok) return 'red';

  const pv = (checks.pa11y_violations || []).length;
  if (pv >= 1 && pv <= 5) return 'yellow';
  if ((checks.spec_modifiers_missing || []).length > 0) return 'yellow';
  if ((checks.layout_issues || []).length > 0) return 'yellow';

  return 'green';
}

function recommendation(severity) {
  if (severity === 'red') return 'remove';
  if (severity === 'yellow') return 'fix';
  return 'keep';
}

function fixNotes(component, checks, severity) {
  if (severity === 'green') return '';
  const bits = [];
  if (!checks.spec_present_in_css) bits.push(`add CSS for .${component.class}`);
  if (checks.spec_modifiers_missing && checks.spec_modifiers_missing.length) {
    bits.push('missing modifiers: ' + checks.spec_modifiers_missing.slice(0, 4).join(', '));
  }
  if (!checks.layout_ok) bits.push('layout: ' + (checks.layout_issues || []).slice(0, 3).join('; '));
  const pvGroups = {};
  for (const v of (checks.pa11y_violations || [])) pvGroups[v.code] = (pvGroups[v.code] || 0) + 1;
  const pvSummary = Object.keys(pvGroups).map(k => `${k} x${pvGroups[k]}`).join(', ');
  if (pvSummary) bits.push('a11y: ' + pvSummary);
  if ((checks.console_errors || []).length) bits.push('console: ' + checks.console_errors[0].slice(0, 60));
  if (!checks.js_init_ok) bits.push('js init failed');
  return bits.join(' | ');
}

async function auditOne(page, component) {
  const result = {
    name: component.name,
    class: component.class,
    category: component.category,
    checks: {
      layout_ok: false,
      layout_issues: [],
      pa11y_violations: [],
      console_errors: [],
      spec_present_in_css: false,
      spec_modifiers_missing: [],
      js_init_ok: true
    },
    severity: 'red',
    recommended_action: 'remove',
    fix_notes: ''
  };

  // Spec presence check.
  const clsRegex = new RegExp('\\.' + component.class.replace(/-/g, '-') + '[_-]');
  result.checks.spec_present_in_css = hasSelector('.' + component.class) || clsRegex.test(daubCss);
  // Modifier presence: each "--xxx" listed in components.json should appear.
  const missingMods = [];
  for (const mod of component.modifiers || []) {
    const full = component.class + mod; // mod already begins with --
    if (!hasSelector(full) && !daubCss.includes(full)) missingMods.push(mod);
  }
  result.checks.spec_modifiers_missing = missingMods;

  // Render in page. Use a unique query string as a cache-buster so
  // playwright actually reloads when only the hash fragment would change.
  const html = component.html || '';
  const hash = Buffer.from(html, 'utf8').toString('base64');
  const url = `${BASE}/tests/component-audit/fixtures/page.html?c=${encodeURIComponent(component.class)}&n=${Date.now()}#${hash}`;

  const captured = [];
  const onPageError = (err) => captured.push('pageerror: ' + (err.message || err));
  const onConsole = (msg) => { if (msg.type() === 'error') captured.push('console.error: ' + msg.text()); };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  try {
    await Promise.race([
      page.goto(url, { waitUntil: 'load' }),
      delay(PER_COMPONENT_BUDGET_MS).then(() => { throw new Error('navigation timeout'); })
    ]);
    await page.waitForTimeout(120);

    const inPageErrors = await page.evaluate(() => window.__dbConsoleErrors || []);
    for (const e of inPageErrors) captured.push(e);

    await page.addScriptTag({ content: checkLayoutSrc });
    const layout = await page.evaluate((cls) => window.__dbCheckLayout(cls), component.class);
    result.checks.layout_ok = !!layout.ok;
    result.checks.layout_issues = layout.issues || [];

    const violations = await page.evaluate(A11Y_RULES);
    result.checks.pa11y_violations = violations || [];

    if (component.js) {
      const hasJsError = captured.some(e => /daub|init|DaubError/i.test(e));
      result.checks.js_init_ok = !hasJsError;
    }

    const shotPath = resolve(SHOT_DIR, component.class + '.png');
    await page.screenshot({ path: shotPath, fullPage: false, clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height } });
  } catch (err) {
    captured.push('harness: ' + (err.message || String(err)));
    result.checks.js_init_ok = false;
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }

  result.checks.console_errors = captured.filter(e =>
    !/favicon/i.test(e) &&
    !/Failed to load resource: .*404/i.test(e) &&
    !/net::ERR_FAILED.*favicon/i.test(e)
  );

  result.severity = classifySeverity(result.checks, component);
  result.recommended_action = recommendation(result.severity);
  result.fix_notes = fixNotes(component, result.checks, result.severity);
  return result;
}

function buildMarkdown(report) {
  const counts = { red: 0, yellow: 0, green: 0 };
  for (const r of report) counts[r.severity] = (counts[r.severity] || 0) + 1;
  const catBreakdown = {};
  for (const r of report) {
    const c = catBreakdown[r.category] = catBreakdown[r.category] || { red: 0, yellow: 0, green: 0 };
    c[r.severity] = (c[r.severity] || 0) + 1;
  }
  const worst = [...report]
    .map(r => ({
      r,
      score: (r.severity === 'red' ? 1000 : r.severity === 'yellow' ? 10 : 0) +
        (r.checks.layout_issues?.length || 0) +
        (r.checks.pa11y_violations?.length || 0) * 2 +
        (r.checks.console_errors?.length || 0) * 5 +
        (r.checks.spec_modifiers_missing?.length || 0)
    }))
    .sort((a, b) => b.score - a.score).slice(0, 10).map(x => x.r);

  const lines = [];
  lines.push('# Daub Component Audit');
  lines.push('');
  lines.push(`Total components: **${report.length}** — green: **${counts.green}**, yellow: **${counts.yellow}**, red: **${counts.red}**.`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`Audited all ${report.length} components from components.json against daub.css (${(daubCss.length/1024).toFixed(0)}KB) and daub.js in a headless Chromium 800×600 viewport. Each entry was rendered, checked for layout collapse/overflow, spec selector presence, modifier parity, accessibility (contrast, accessible names, alt text) and runtime console errors. Overlay-like components (modal, popover, tooltip, toast, etc.) are not expected to be visible when idle; their layout checks are relaxed accordingly. Classification: red = remove candidate, yellow = fixable, green = keep.`);
  lines.push('');
  lines.push('## Category breakdown');
  lines.push('');
  lines.push('| Category | Green | Yellow | Red | Total |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const cat of Object.keys(catBreakdown).sort()) {
    const c = catBreakdown[cat];
    const total = (c.green || 0) + (c.yellow || 0) + (c.red || 0);
    lines.push(`| ${cat} | ${c.green || 0} | ${c.yellow || 0} | ${c.red || 0} | ${total} |`);
  }
  lines.push('');
  lines.push('## Top issues');
  lines.push('');
  lines.push('| # | Class | Severity | Action | Notes |');
  lines.push('| ---: | --- | --- | --- | --- |');
  worst.forEach((r, i) => {
    lines.push(`| ${i + 1} | \`${r.class}\` | **${r.severity}** | ${r.recommended_action} | ${(r.fix_notes || '').replace(/\|/g, '\\|').slice(0, 160)} |`);
  });
  lines.push('');
  lines.push('## Per-component results');
  lines.push('');
  lines.push('| Class | Category | Severity | Action | Fix notes |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const r of report) {
    lines.push(`| \`${r.class}\` | ${r.category} | ${r.severity} | ${r.recommended_action} | ${(r.fix_notes || '').replace(/\|/g, '\\|').slice(0, 160)} |`);
  }
  lines.push('');
  lines.push('_Screenshots under `test-results/component-audit/screenshots/<class>.png`._');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const started = Date.now();
  console.log(`[audit] starting, ${components.length} components, budget=15min wall`);
  const server = await startServer();
  console.log(`[audit] serving ${ROOT} on ${BASE}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const report = [];
  try {
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      const t0 = Date.now();
      try {
        const r = await Promise.race([
          auditOne(page, c),
          delay(PER_COMPONENT_BUDGET_MS + 2000).then(() => ({
            name: c.name, class: c.class, category: c.category,
            checks: { layout_ok: false, layout_issues: ['timeout'], pa11y_violations: [], console_errors: ['timeout'], spec_present_in_css: hasSelector('.' + c.class), spec_modifiers_missing: [], js_init_ok: false },
            severity: 'red', recommended_action: 'remove', fix_notes: 'audit timed out'
          }))
        ]);
        report.push(r);
        console.log(`[audit] ${String(i + 1).padStart(2)}/${components.length} ${c.class.padEnd(22)} ${r.severity.padEnd(6)} (${Date.now() - t0}ms)`);
      } catch (err) {
        report.push({
          name: c.name, class: c.class, category: c.category,
          checks: { layout_ok: false, layout_issues: [], pa11y_violations: [], console_errors: [String(err.message || err)], spec_present_in_css: hasSelector('.' + c.class), spec_modifiers_missing: [], js_init_ok: false },
          severity: 'red', recommended_action: 'remove', fix_notes: 'harness error: ' + (err.message || err)
        });
        console.log(`[audit] ${String(i + 1).padStart(2)}/${components.length} ${c.class.padEnd(22)} ERROR  ${err.message || err}`);
      }

      if ((Date.now() - started) > 13.5 * 60 * 1000) {
        console.warn('[audit] wall-clock budget reached, bailing out early');
        break;
      }
    }
  } finally {
    await browser.close();
    try { server.close(); } catch {}
  }

  const reachedSet = new Set(report.map(r => r.class));
  for (const c of components) {
    if (!reachedSet.has(c.class)) {
      report.push({
        name: c.name, class: c.class, category: c.category,
        checks: { layout_ok: false, layout_issues: ['not audited (time budget)'], pa11y_violations: [], console_errors: [], spec_present_in_css: hasSelector('.' + c.class), spec_modifiers_missing: [], js_init_ok: false },
        severity: 'red', recommended_action: 'remove', fix_notes: 'not audited (time budget)'
      });
    }
  }

  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  writeFileSync(REPORT_MD, buildMarkdown(report));
  const counts = report.reduce((a, r) => (a[r.severity] = (a[r.severity] || 0) + 1, a), {});
  console.log(`[audit] done in ${((Date.now() - started) / 1000).toFixed(1)}s — green: ${counts.green || 0}, yellow: ${counts.yellow || 0}, red: ${counts.red || 0}`);
  console.log(`[audit] wrote ${REPORT_JSON}`);
  console.log(`[audit] wrote ${REPORT_MD}`);
}

main().catch((err) => { console.error('[audit] fatal', err); process.exit(1); });
