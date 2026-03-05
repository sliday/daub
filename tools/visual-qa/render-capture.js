#!/usr/bin/env node
/**
 * Visual QA — Render specs via playground & capture screenshots + HTML
 *
 * Usage: node render-capture.js [--start N] [--end N] [--base-url URL]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LZString from 'lz-string';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, 'results');
const SPECS_DIR = path.join(RESULTS_DIR, 'specs');
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
const HTML_DIR = path.join(RESULTS_DIR, 'html');
const CSV_PATH = path.join(RESULTS_DIR, 'report.csv');
const MANIFEST_PATH = path.join(RESULTS_DIR, 'manifest.json');

// Parse CLI args
const args = process.argv.slice(2);
let startId = 1, endId = 100;
let baseUrl = 'https://daub.dev';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--start' && args[i + 1]) startId = parseInt(args[++i]);
  if (args[i] === '--end' && args[i + 1]) endId = parseInt(args[++i]);
  if (args[i] === '--base-url' && args[i + 1]) baseUrl = args[++i];
}

// Ensure dirs exist
[SCREENSHOTS_DIR, HTML_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

function escapeCSV(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function main() {
  // Load manifest for prompt info
  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {}
  const manifestById = Object.fromEntries(manifest.map(m => [m.id, m]));

  // Find all spec files
  const specFiles = fs.readdirSync(SPECS_DIR)
    .filter(f => f.match(/^\d+\.json$/))
    .sort()
    .map(f => ({
      num: parseInt(f.replace('.json', '')),
      file: f,
      path: path.join(SPECS_DIR, f),
    }))
    .filter(s => s.num >= startId && s.num <= endId);

  if (specFiles.length === 0) {
    console.error('No spec files found. Run generate.js first.');
    process.exit(1);
  }

  console.log(`Rendering ${specFiles.length} specs (${startId}-${endId}) against ${baseUrl}\n`);

  // Write CSV header
  const csvHeader = 'id,prompt,theme,component_count,spec_file,screenshot_file,html_file,has_duplicates,has_orphans,has_empty_containers,render_errors\n';
  // Load existing CSV rows if resuming
  let existingRows = new Map();
  try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = csvContent.trim().split('\n').slice(1); // skip header
    for (const line of lines) {
      const id = line.split(',')[0];
      existingRows.set(id, line);
    }
  } catch {}

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  let processed = 0;
  const csvRows = [];

  for (const spec of specFiles) {
    const num = String(spec.num).padStart(3, '0');

    // Skip if already captured
    if (existingRows.has(String(spec.num)) &&
        fs.existsSync(path.join(SCREENSHOTS_DIR, `${num}.png`))) {
      csvRows.push(existingRows.get(String(spec.num)));
      continue;
    }

    const manifestEntry = manifestById[spec.num] || {};
    const prompt = manifestEntry.prompt || '';
    console.log(`[${spec.num}] ${prompt.slice(0, 60)}...`);

    try {
      // Read and encode spec
      const specJson = fs.readFileSync(spec.path, 'utf-8');
      const specObj = JSON.parse(specJson);
      const compressed = LZString.compressToEncodedURIComponent(specJson);
      const url = `${baseUrl}/playground?s=${compressed}`;

      // Open page
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for render — look for data-spec-id elements in preview
      try {
        await page.waitForSelector('[data-spec-id]', { timeout: 10000 });
      } catch {
        console.log(`  ⚠ No data-spec-id elements found, capturing anyway`);
      }

      // Extra settle time for animations/icons
      await page.waitForTimeout(1500);

      // Force overlays (Modal, Sheet, Drawer) open for static capture
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

      // Get the preview panel
      const preview = await page.$('.pg-preview');
      if (!preview) {
        console.log(`  ✗ No preview panel found`);
        await page.close();
        continue;
      }

      // Capture screenshot of the preview panel
      const screenshotPath = path.join(SCREENSHOTS_DIR, `${num}.png`);
      await preview.screenshot({ path: screenshotPath });

      // Extract rendered HTML
      const innerHTML = await preview.evaluate(el => el.innerHTML);
      const htmlPath = path.join(HTML_DIR, `${num}.html`);
      fs.writeFileSync(htmlPath, innerHTML);

      // Analyze rendered output
      const analysis = await page.evaluate(() => {
        const specIds = document.querySelectorAll('[data-spec-id]');
        const ids = Array.from(specIds).map(el => el.getAttribute('data-spec-id'));
        const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
        const preview = document.querySelector('.pg-preview');
        const previewChildren = preview ? Array.from(preview.children) : [];
        // Orphans: direct children of preview without data-spec-id matching root
        const orphans = previewChildren.filter(el =>
          el.getAttribute('data-spec-id') &&
          !el.closest('[data-spec-id]')?.parentElement?.closest('[data-spec-id]')
        ).length;
        // Empty containers: elements with data-spec-id that have no content
        const emptyContainers = Array.from(specIds).filter(el => {
          const text = el.textContent?.trim();
          const children = el.children.length;
          return !text && children === 0;
        }).length;
        // Console errors
        return {
          totalElements: ids.length,
          duplicateIds: [...new Set(duplicates)],
          orphanCount: Math.max(0, previewChildren.filter(el => el.hasAttribute('data-spec-id')).length - 1),
          emptyContainers,
        };
      });

      // Collect render errors from console
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      const componentCount = Object.keys(specObj.elements || {}).length;
      const theme = specObj.theme || 'default';
      const hasDuplicates = analysis.duplicateIds.length > 0;
      const hasOrphans = analysis.orphanCount > 0;
      const hasEmpty = analysis.emptyContainers > 0;

      const row = [
        spec.num,
        escapeCSV(prompt),
        theme,
        componentCount,
        `specs/${num}.json`,
        `screenshots/${num}.png`,
        `html/${num}.html`,
        hasDuplicates,
        hasOrphans,
        hasEmpty,
        escapeCSV(analysis.duplicateIds.join(';') + (errors.length ? ' | ' + errors.join(';') : '')),
      ].join(',');

      csvRows.push(row);

      const issues = [];
      if (hasDuplicates) issues.push(`dupes:${analysis.duplicateIds.length}`);
      if (hasOrphans) issues.push(`orphans:${analysis.orphanCount}`);
      if (hasEmpty) issues.push(`empty:${analysis.emptyContainers}`);

      console.log(`  ✓ ${componentCount} components, ${analysis.totalElements} rendered` +
        (issues.length ? ` [${issues.join(', ')}]` : ''));

      await page.close();
      processed++;

    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
      csvRows.push([
        spec.num,
        escapeCSV(prompt),
        '',
        0,
        `specs/${num}.json`,
        '',
        '',
        false,
        false,
        false,
        escapeCSV(e.message),
      ].join(','));
    }
  }

  await browser.close();

  // Write CSV
  fs.writeFileSync(CSV_PATH, csvHeader + csvRows.join('\n') + '\n');

  console.log(`\nDone: ${processed} specs rendered`);
  console.log(`Report: ${CSV_PATH}`);

  // Print summary
  const dupeCount = csvRows.filter(r => r.includes(',true,')).length;
  console.log(`\nSummary:`);
  console.log(`  Total: ${csvRows.length}`);
  console.log(`  With issues: ${dupeCount}`);
}

main().catch(e => { console.error(e); process.exit(1); });
