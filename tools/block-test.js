#!/usr/bin/env node
/**
 * Block Test — Structural + Render + Visual regression tests for DAUB block specs
 *
 * Usage:
 *   node tools/block-test.js                                  # Structural tests only
 *   node tools/block-test.js --render                         # + Playwright render tests
 *   node tools/block-test.js --visual                         # + visual regression (implies --render)
 *   node tools/block-test.js --category auth --render         # Filter by category
 *   node tools/block-test.js --id login-page-minimal-01       # Filter by block ID
 *
 * Outputs: blocks/test-results.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BLOCKS_DIR = path.join(ROOT, 'blocks');
const INDEX_PATH = path.join(BLOCKS_DIR, 'index.json');
const RESULTS_PATH = path.join(BLOCKS_DIR, 'test-results.json');

// ---- CLI Args ----
const args = process.argv.slice(2);
function getFlag(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const filterCategory = getFlag('category', '');
const filterId = getFlag('id', '');
const doRender = args.includes('--render') || args.includes('--visual');
const doVisual = args.includes('--visual');

// ---- Valid component types (mirrors mcp.js) ----
const VALID_TYPES = new Set([
  'Stack', 'Grid', 'Surface', 'Text', 'Prose', 'Separator', 'Link', 'Icon',
  'Button', 'ButtonGroup', 'Field', 'Input', 'InputGroup', 'InputIcon', 'Search',
  'Textarea', 'Checkbox', 'RadioGroup', 'Switch', 'Slider', 'Toggle', 'ToggleGroup',
  'Select', 'CustomSelect', 'Kbd', 'Label', 'Spinner', 'InputOTP',
  'Tabs', 'Breadcrumbs', 'Pagination', 'Stepper', 'NavMenu', 'Navbar', 'Menubar',
  'Sidebar', 'BottomNav',
  'Card', 'Table', 'DataTable', 'List', 'Badge', 'Avatar', 'AvatarGroup', 'Calendar',
  'Chart', 'Carousel', 'AspectRatio', 'Chip', 'ScrollArea', 'Image',
  'Alert', 'Progress', 'Skeleton', 'EmptyState', 'Tooltip',
  'Modal', 'AlertDialog', 'Sheet', 'Drawer', 'Popover', 'HoverCard', 'DropdownMenu',
  'ContextMenu', 'CommandPalette',
  'Accordion', 'Collapsible', 'Resizable', 'DatePicker',
  'StatCard', 'ChartCard',
  'CustomHTML',
]);

// ---- Required props per component type ----
const REQUIRED_PROPS = {
  Text: ['content'],
  Button: ['label'],
  Field: ['label'],
  Badge: ['text'],
  Card: ['title'],
  Select: ['options'],
  Tabs: ['tabs'],
  Table: ['columns', 'rows'],
};

// ---- Stale branding patterns ----
const STALE_BRANDING = ['Untitled UI', '@untitledui.com'];
const VALID_TAGS = ['h1', 'h2', 'h3', 'h4', 'p', 'span'];

// ---- Layer 1: Structural Tests ----

function runStructuralTests(spec, blockId) {
  const issues = [];

  // 1. Valid JSON shape
  if (!spec || typeof spec !== 'object') { issues.push('Spec is not an object'); return issues; }
  if (!spec.root) issues.push('Missing "root"');
  if (!spec.elements || typeof spec.elements !== 'object') { issues.push('Missing "elements" object'); return issues; }

  // 2. Root exists in elements
  if (spec.root && !spec.elements[spec.root]) issues.push(`Root "${spec.root}" not found in elements`);

  // 3. Tree integrity — children resolve, detect orphans
  const referenced = new Set();
  if (spec.root) referenced.add(spec.root);

  for (const [id, el] of Object.entries(spec.elements)) {
    if (!el.type) { issues.push(`Element "${id}" missing "type"`); continue; }

    // 4. Component type valid
    if (!VALID_TYPES.has(el.type)) issues.push(`Unknown type "${el.type}" on "${id}"`);

    // Children resolve
    for (const cid of (el.children || [])) {
      referenced.add(cid);
      if (!spec.elements[cid]) issues.push(`"${id}" references missing child "${cid}"`);
    }

    // Footer children on Card/Modal/AlertDialog
    if (el.props && Array.isArray(el.props.footer)) {
      for (const fid of el.props.footer) {
        referenced.add(fid);
        if (!spec.elements[fid]) issues.push(`"${id}" footer references missing "${fid}"`);
      }
    }

    const p = el.props || {};

    // 5. Text prop issues — detect swapped or duplicated tag/content
    if (el.type === 'Text') {
      if (VALID_TAGS.includes(p.content) && !VALID_TAGS.includes(p.tag)) {
        issues.push(`Text "${id}" has swapped tag/content: content="${p.content}", tag="${p.tag}"`);
      }
      if (VALID_TAGS.includes(p.content) && p.content === p.tag) {
        issues.push(`Text "${id}" has duplicated tag as content: tag="${p.tag}", content="${p.content}"`);
      }
    }

    // 6. Required props (with exemptions for valid alternative patterns)
    if (REQUIRED_PROPS[el.type]) {
      for (const req of REQUIRED_PROPS[el.type]) {
        if (p[req] === undefined || p[req] === null) {
          // Avatar: initials OR src
          if (el.type === 'Avatar' && (p.initials || p.src)) continue;
          // Button: icon-only buttons have no label (variant starts with "icon" or size is "icon")
          if (el.type === 'Button' && req === 'label' && (p.icon || (p.variant && p.variant.startsWith('icon')) || p.size === 'icon')) continue;
          // Card: used as container with children instead of title prop
          if (el.type === 'Card' && req === 'title' && (el.children || []).length > 0) continue;
          // Badge: used as dot/indicator with no text
          if (el.type === 'Badge' && req === 'text' && (p.variant || p.class)) continue;
          // Select: options provided as items prop, via children, or just placeholder (empty dropdown)
          if (el.type === 'Select' && req === 'options' && (p.items || p.placeholder || (el.children || []).length > 0)) continue;
          // Tabs: accepts items or tabs prop, or children with tab structure
          if (el.type === 'Tabs' && req === 'tabs' && (p.items || (el.children || []).length > 0)) continue;
          issues.push(`${el.type} "${id}" missing required prop "${req}"`);
        }
      }
    }

    // 7. Stale branding
    for (const pattern of STALE_BRANDING) {
      const propsStr = JSON.stringify(p);
      if (propsStr.includes(pattern)) {
        issues.push(`"${id}" contains stale branding: "${pattern}"`);
        break;
      }
    }

    // 8. Children vs props-only
    if (el.type === 'Carousel' && (el.children || []).length > 0 && (!p.slides || p.slides.length === 0)) {
      issues.push(`Carousel "${id}" uses children instead of props.slides`);
    }
    // AvatarGroup: children pattern is valid (renders Avatar children directly)

  }

  return issues;
}

// ---- Layer 2: Render Tests (Playwright) ----

function renderToHTML(spec) {
  const specJSON = JSON.stringify(spec);
  const rootDir = ROOT.replace(/'/g, "\\'");
  return `<!DOCTYPE html>
<html data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="file://${rootDir}/daub.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"><\/script>
  <style>
    body { margin: 0; padding: 16px; font-family: Inter, system-ui, sans-serif; background: var(--db-bg); color: var(--db-fg); }
    #app { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="file://${rootDir}/daub.js"><\/script>
  <script>
  (function() {
    var spec = ${specJSON};
    var s = document.createElement('script');
    s.src = 'file://${rootDir}/daub-render.js';
    s.onload = function() {
      if (typeof renderElement === 'function') {
        var root = renderElement(spec.elements, spec.root, 0);
        if (root) document.getElementById('app').appendChild(root);
        var rendered = {};
        document.querySelectorAll('[data-spec-id]').forEach(function(n) { rendered[n.getAttribute('data-spec-id')] = true; });
        Object.keys(spec.elements).forEach(function(id) {
          if (id !== spec.root && !rendered[id]) {
            var orphan = renderElement(spec.elements, id, 0);
            if (orphan) document.getElementById('app').appendChild(orphan);
          }
        });
        if (typeof DAUB !== 'undefined') DAUB.init();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        window.__DAUB_RENDER_DONE = true;
      }
    };
    document.body.appendChild(s);
  })();
  <\/script>
</body>
</html>`;
}

async function runRenderTests(browser, spec, blockId, tmpDir) {
  const issues = [];
  const html = renderToHTML(spec);
  const tmpHtml = path.join(tmpDir, `${blockId}.html`);
  fs.writeFileSync(tmpHtml, html);

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for renderer
    try {
      await page.waitForFunction(() => window.__DAUB_RENDER_DONE === true, { timeout: 15000 });
    } catch {
      issues.push('Renderer did not complete within 15s');
    }

    await page.waitForTimeout(1000);

    // JS console errors (filter network errors for external resources)
    const realErrors = consoleErrors.filter(e => !e.includes('net::ERR_') && !e.includes('Failed to load resource'));
    if (realErrors.length > 0) {
      issues.push(`Console errors: ${realErrors.slice(0, 3).join('; ')}`);
    }

    // All spec IDs rendered
    const renderedIds = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-spec-id]')).map(n => n.getAttribute('data-spec-id'));
    });
    const renderedSet = new Set(renderedIds);
    const expectedIds = Object.keys(spec.elements);
    const missing = expectedIds.filter(id => !renderedSet.has(id));
    if (missing.length > 0) {
      issues.push(`Missing rendered elements: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`);
    }

    // No literal tag names as sole content (swapped Text props)
    const literalTags = await page.evaluate(() => {
      const tags = ['h1', 'h2', 'h3', 'h4'];
      const found = [];
      document.querySelectorAll('[data-spec-id]').forEach(el => {
        const text = el.textContent.trim();
        if (tags.includes(text.toLowerCase())) found.push(`${el.getAttribute('data-spec-id')}="${text}"`);
      });
      return found;
    });
    if (literalTags.length > 0) {
      issues.push(`Literal tag names as content: ${literalTags.join(', ')}`);
    }

    // No zero-height root
    const appHeight = await page.evaluate(() => {
      const app = document.getElementById('app');
      return app ? app.getBoundingClientRect().height : 0;
    });
    if (appHeight === 0) {
      issues.push('#app has zero height');
    }

    // Broken images
    const brokenImgs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).filter(img => img.complete && img.naturalWidth === 0).length;
    });
    if (brokenImgs > 0) {
      issues.push(`${brokenImgs} broken image(s)`);
    }

  } catch (e) {
    issues.push(`Render error: ${e.message}`);
  } finally {
    await page.close();
  }

  return issues;
}

// ---- Layer 3: Visual Regression ----

async function runVisualTests(browser, spec, block, tmpDir) {
  const issues = [];
  const baselinePath = path.join(BLOCKS_DIR, block.category, `${block.id}.png`);

  if (!fs.existsSync(baselinePath)) {
    issues.push('No baseline screenshot for comparison');
    return issues;
  }

  const html = renderToHTML(spec);
  const tmpHtml = path.join(tmpDir, `${block.id}-visual.html`);
  fs.writeFileSync(tmpHtml, html);

  const page = await browser.newPage();
  try {
    await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle', timeout: 30000 });
    try { await page.waitForFunction(() => window.__DAUB_RENDER_DONE === true, { timeout: 15000 }); } catch {}
    await page.waitForTimeout(2000);

    const app = await page.$('#app');
    if (app) {
      const freshPath = path.join(tmpDir, `${block.id}-fresh.png`);
      await app.screenshot({ path: freshPath });

      // Simple size comparison (full pixel diff requires sharp/pixelmatch — keep it lightweight)
      const baselineStat = fs.statSync(baselinePath);
      const freshStat = fs.statSync(freshPath);
      const sizeDiff = Math.abs(baselineStat.size - freshStat.size) / Math.max(baselineStat.size, 1);
      if (sizeDiff > 0.3) {
        issues.push(`Screenshot size diff: ${(sizeDiff * 100).toFixed(1)}% (baseline: ${baselineStat.size}B, fresh: ${freshStat.size}B)`);
      }
    }
  } catch (e) {
    issues.push(`Visual test error: ${e.message}`);
  } finally {
    await page.close();
  }

  return issues;
}

// ---- Main ----

async function main() {
  // Load index
  let index;
  try {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch {
    console.error('Error: blocks/index.json not found.');
    process.exit(1);
  }

  // Filter blocks
  let blocks = index;
  if (filterCategory) blocks = blocks.filter(b => b.category === filterCategory);
  if (filterId) blocks = blocks.filter(b => b.id === filterId);

  console.log(`Testing ${blocks.length} blocks${doRender ? ' (+ render)' : ''}${doVisual ? ' (+ visual)' : ''}\n`);

  const results = {};
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  // Layer 1: Structural tests
  for (const block of blocks) {
    const specPath = path.join(BLOCKS_DIR, block.file);
    const result = { id: block.id, category: block.category, structural: [], render: [], visual: [], pass: true };

    try {
      const specJson = fs.readFileSync(specPath, 'utf-8');
      const spec = JSON.parse(specJson);
      result.structural = runStructuralTests(spec, block.id);
    } catch (e) {
      result.structural = [`Failed to load spec: ${e.message}`];
    }

    if (result.structural.length > 0) result.pass = false;
    results[block.id] = result;
  }

  // Layer 2: Render tests
  if (doRender) {
    let chromium;
    try {
      ({ chromium } = await import('playwright'));
    } catch {
      try {
        ({ chromium } = await import(path.join(__dirname, 'visual-qa', 'node_modules', 'playwright', 'index.mjs')));
      } catch {
        console.error('Error: playwright not installed. Run: npm install playwright');
        process.exit(1);
      }
    }

    const browser = await chromium.launch({ headless: true });
    const tmpDir = path.join(ROOT, '.tmp-test');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    for (const block of blocks) {
      const specPath = path.join(BLOCKS_DIR, block.file);
      try {
        const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
        results[block.id].render = await runRenderTests(browser, spec, block.id, tmpDir);
        if (results[block.id].render.length > 0) results[block.id].pass = false;

        // Layer 3: Visual regression
        if (doVisual) {
          results[block.id].visual = await runVisualTests(browser, spec, block, tmpDir);
          if (results[block.id].visual.length > 0) results[block.id].pass = false;
        }
      } catch (e) {
        results[block.id].render = [`Error: ${e.message}`];
        results[block.id].pass = false;
      }
    }

    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
    await browser.close();
  }

  // Report
  for (const [id, r] of Object.entries(results)) {
    const allIssues = [...r.structural, ...r.render, ...r.visual];
    if (allIssues.length === 0) {
      passCount++;
    } else {
      failCount++;
      const icon = r.structural.length > 0 ? 'x' : '!';
      console.log(`  ${icon} [${id}]`);
      for (const issue of allIssues) console.log(`    - ${issue}`);
    }
  }

  console.log(`\n${passCount} passed, ${failCount} failed out of ${blocks.length} blocks`);

  // Write results
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2) + '\n');
  console.log(`Results written to blocks/test-results.json`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
