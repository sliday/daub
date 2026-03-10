#!/usr/bin/env node
/**
 * Block Screenshot — Render block specs as HTML and capture screenshots via Playwright
 *
 * Usage:
 *   node tools/block-screenshot.js [--category CATEGORY] [--id BLOCK_ID] [--base-url URL] [--force]
 *
 * Examples:
 *   node tools/block-screenshot.js                          # All blocks without screenshots
 *   node tools/block-screenshot.js --category dashboard     # Only dashboard blocks
 *   node tools/block-screenshot.js --id hero-01             # Specific block
 *   node tools/block-screenshot.js --force                  # Re-capture all
 *
 * Requires: npm install playwright (or use the one in tools/visual-qa/)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BLOCKS_DIR = path.join(ROOT, 'blocks');
const INDEX_PATH = path.join(BLOCKS_DIR, 'index.json');

// ---- CLI Args ----
const args = process.argv.slice(2);
function getFlag(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const filterCategory = getFlag('category', '');
const filterId = getFlag('id', '');
const baseUrl = getFlag('base-url', 'file://' + ROOT);
const force = args.includes('--force');
const viewport = { width: parseInt(getFlag('width', '1280')), height: parseInt(getFlag('height', '800')) };

// ---- Render spec to self-contained HTML ----

function renderToHTML(spec, specTheme) {
  const theme = specTheme || 'light';
  const specJSON = JSON.stringify(spec);
  return `<!DOCTYPE html>
<html data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAUB Block</title>
  <link rel="stylesheet" href="${baseUrl}/daub.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"><\/script>
  <style>
    body { margin: 0; padding: 16px; font-family: Inter, system-ui, sans-serif; background: var(--db-bg); color: var(--db-fg); }
    #app { max-width: 1200px; margin: 0 auto; }
    .db-nav-menu--vertical { flex-direction: column; align-items: flex-start; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="${baseUrl}/daub.js"><\/script>
  <script>
  (function() {
    var spec = ${specJSON};
    var s = document.createElement('script');
    s.src = '${baseUrl}/daub-render.js';
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
      }
    };
    document.body.appendChild(s);
  })();
  <\/script>
</body>
</html>`;
}

// ---- Main ----

async function main() {
  // Dynamic import playwright
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

  // Load index
  let index;
  try {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch {
    console.error('Error: blocks/index.json not found. Run block-generate.js first.');
    process.exit(1);
  }

  // Filter blocks
  let blocks = index;
  if (filterCategory) blocks = blocks.filter(b => b.category === filterCategory);
  if (filterId) blocks = blocks.filter(b => b.id === filterId);

  // Filter to only blocks without screenshots (unless --force)
  if (!force) {
    blocks = blocks.filter(b => {
      const pngPath = path.join(BLOCKS_DIR, b.category, `${b.id}.png`);
      return !fs.existsSync(pngPath);
    });
  }

  if (blocks.length === 0) {
    console.log('No blocks to screenshot. Use --force to re-capture all.');
    return;
  }

  console.log(`Screenshotting ${blocks.length} blocks (${viewport.width}x${viewport.height})\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
  });

  const tmpDir = path.join(ROOT, '.tmp-screenshots');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  let captured = 0;
  let failed = 0;

  for (const block of blocks) {
    const specPath = path.join(BLOCKS_DIR, block.file);
    const pngPath = path.join(BLOCKS_DIR, block.category, `${block.id}.png`);

    try {
      const specJson = fs.readFileSync(specPath, 'utf-8');
      const spec = JSON.parse(specJson);
      const html = renderToHTML(spec, 'light');

      // Write HTML to temp file so file:// resources load correctly
      const tmpHtml = path.join(tmpDir, `${block.id}.html`);
      fs.writeFileSync(tmpHtml, html);

      const page = await context.newPage();

      // Navigate to local file (file:// origin can load other file:// resources)
      await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for renderer to load and execute
      try {
        await page.waitForSelector('[data-spec-id]', { timeout: 15000 });
      } catch {
        console.log(`  ! [${block.id}] No rendered elements found, capturing anyway`);
      }

      // Wait for fonts and icons
      await page.waitForTimeout(2000);

      // Force overlays open for capture
      await page.evaluate(() => {
        document.querySelectorAll('.db-modal').forEach(el => {
          el.classList.add('db-modal--open');
          el.removeAttribute('aria-hidden');
        });
        document.querySelectorAll('.db-sheet').forEach(el => {
          el.classList.add('db-sheet--open');
          el.removeAttribute('aria-hidden');
        });
        document.querySelectorAll('.db-drawer').forEach(el => {
          el.classList.add('db-drawer--open');
          el.removeAttribute('aria-hidden');
        });
      });
      await page.waitForTimeout(300);

      // Capture the #app container
      const app = await page.$('#app');
      if (app) {
        await app.screenshot({ path: pngPath });
      } else {
        await page.screenshot({ path: pngPath, fullPage: true });
      }

      await page.close();
      captured++;
      console.log(`  + [${block.id}] → ${block.category}/${block.id}.png`);

    } catch (e) {
      failed++;
      console.log(`  x [${block.id}] Error: ${e.message}`);
    }
  }

  // Clean up temp files
  try { fs.rmSync(tmpDir, { recursive: true }); } catch {}

  await browser.close();

  // Update index with screenshot paths
  const fullIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  for (const block of blocks) {
    const pngPath = path.join(BLOCKS_DIR, block.category, `${block.id}.png`);
    if (fs.existsSync(pngPath)) {
      const entry = fullIndex.find(e => e.id === block.id);
      if (entry) entry.screenshot = `${block.category}/${block.id}.png`;
    }
  }
  fs.writeFileSync(INDEX_PATH, JSON.stringify(fullIndex, null, 2) + '\n');

  console.log(`\nDone: ${captured} captured, ${failed} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
