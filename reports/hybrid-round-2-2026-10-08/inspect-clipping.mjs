import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const home = dirname(fileURLToPath(import.meta.url));
const root = resolve(home, '../..');
const input = resolve(root, process.env.CLIP_INPUT || 'reports/direct-vs-hybrid-2026-10-08');
const output = resolve(home, process.env.CLIP_OUTPUT || 'clipping');
if (!input.startsWith(root + '/reports/') || !output.startsWith(home + '/')) throw new Error('Use report directories');
await mkdir(output);
const source = await readFile(resolve(root, 'playground-hybrid-checks.js'), 'utf8');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const cases = (await readdir(input)).filter(name => /^\d{2}-(direct|hybrid)$/.test(name)).sort();
const results = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const id of cases) {
    let html;
    try { html = await readFile(resolve(input, id, 'generated.html'), 'utf8'); }
    catch { results.push({ id, skipped: 'No exported HTML' }); continue; }
    for (const width of [390, 1200]) {
      const dir = resolve(output, id, String(width));
      await mkdir(dir, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const blocked = [];
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'daub.test' && url.pathname === '/') return route.fulfill({ body: '<html></html>', contentType: 'text/html' });
        if (route.request().method() === 'GET' && ['daub.test', 'daub.dev'].includes(url.hostname) && /^\/(daub(?:-render)?\.(css|js))$/.test(url.pathname)) {
          return route.fulfill({ body: await readFile(resolve(root, '.' + url.pathname)), contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
        }
        blocked.push(url.origin + url.pathname);
        return route.abort();
      });
      try {
        const page = await context.newPage();
        await page.goto('http://daub.test/');
        await page.setContent(html, { waitUntil: 'load' });
        await page.waitForTimeout(150);
        await page.addScriptTag({ content: source });
        const evidence = await page.evaluate(() => window.DaubHybridChecks.probe(document.body, { requestId: 'clipping-audit', requirements: [] }, '*'));
        const clipping = evidence.defects.filter(defect => /^clipped-/.test(defect.kind));
        await writeFile(resolve(dir, 'evidence.json'), JSON.stringify({ evidence, blocked }, null, 2));
        await page.screenshot({ path: resolve(dir, 'initial.png') });
        results.push({ id, width, htmlSha256: hash(html), complete: evidence.complete, clipping });
        console.log(id, width, 'clipping', clipping.length);
      } finally { await context.close(); }
    }
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify({ input, sourceSha256: hash(source), results, limitations: 'Offline initial exported views only; external assets blocked. Not a generation or interaction benchmark.' }, null, 2));
}
