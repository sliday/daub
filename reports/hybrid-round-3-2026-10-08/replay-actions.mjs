import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const home = dirname(fileURLToPath(import.meta.url)), root = resolve(home, '../..');
const output = resolve(home, process.env.ACTION_OUTPUT || 'saved-actions');
if (!output.startsWith(home + '/')) throw new Error('Output must stay within this report');
await mkdir(output);
const source = await readFile(resolve(root, 'playground-hybrid-checks.js'), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const cases = [
  ['quiz', 'reports/hybrid-round-2-2026-10-08/live/01-hybrid'],
  ['filter', 'reports/hybrid-round-2-2026-10-08/filter-binding-canary/06-hybrid'],
  ['cart', 'reports/hybrid-round-2-2026-10-08/live/09-hybrid']
];
const results = [], browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [name, path] of cases) {
    const spec = JSON.parse(await readFile(resolve(root, path, 'spec.json'), 'utf8'));
    const html = await readFile(resolve(root, path, 'generated.html'), 'utf8');
    const covered = new Set(spec.hybrid.contract.journeys.flatMap(journey => journey.steps.filter(step => step.action === 'click').map(step => step.targetId)));
    const ids = Object.keys(spec.elements).filter(id => spec.elements[id].type === 'Button' && !covered.has(id)).slice(0, 6);
    for (const width of [390, 1200]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.href === 'http://daub.test/') return route.fulfill({ body: '<html></html>', contentType: 'text/html' });
        if (route.request().method() === 'GET' && ['daub.test', 'daub.dev'].includes(url.hostname) && /^\/daub(?:-render)?\.(js|css)$/.test(url.pathname)) {
          return route.fulfill({ body: await readFile(resolve(root, '.' + url.pathname)), contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
        }
        return route.abort();
      });
      try {
        for (const id of ids.length ? ids : [null]) {
          const page = await context.newPage();
          await page.goto('http://daub.test/');
          await page.setContent(html, { waitUntil: 'load' });
          await page.addScriptTag({ content: source });
          const evidence = await page.evaluate(id => window.DaubHybridChecks.probe(document.body, {
            requestId: 'saved-actions', requirements: [], action: id ? { targetId: id } : null
          }, '*'), id);
          if (name === 'cart' && id === 'checkoutBtn') assert.ok(evidence.defects.some(defect => defect.kind === 'behavior-no-effect'));
          if (name !== 'cart') assert.ok(!evidence.defects.some(defect => defect.kind === 'behavior-no-effect'));
          await writeFile(resolve(output, `${name}-${width}-${id || 'initial'}.json`), JSON.stringify(evidence, null, 2));
          if (id === 'checkoutBtn') await page.screenshot({ path: resolve(output, `cart-${width}.png`) });
          results.push({ name, width, id, complete: evidence.complete, actions: evidence.actions || [], defects: evidence.defects, htmlSha256: hash(html) });
          await page.close();
        }
      } finally { await context.close(); }
    }
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify({ sourceSha256: hash(source), modelCalls: 0, results,
    limitation: 'Saved exports with local assets and blocked external requests. No fresh model generation or semantic certification.' }, null, 2));
}
console.log(JSON.stringify(results.map(({ name, width, id, actions }) => ({ name, width, id, actions }))));
