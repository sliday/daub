import { createServer } from 'node:http';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.env.BENCH_OUTPUT ? resolve(root, process.env.BENCH_OUTPUT) : dirname(fileURLToPath(import.meta.url));
const reexport = process.env.BENCH_REEXPORT === '1';
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/') || req.method !== 'GET') { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' })[extname(path)] || 'text/plain');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const id of (await readdir(output)).filter(id => /^\d\d-(direct|recursive)$/.test(id)).sort()) {
    try { await readFile(resolve(output, id, 'generated.html')); } catch { continue; }
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
    await context.route('https://daub.dev/daub.css*', route => route.fulfill({ path: resolve(root, 'daub.css'), contentType: 'text/css' }));
    await context.route('https://daub.dev/daub.js*', route => route.fulfill({ path: resolve(root, 'daub.js'), contentType: 'text/javascript' }));
    await context.route('**/*', route => route.request().method() !== 'GET' ? route.abort() : route.fallback());
    const page = await context.newPage();
    page.setDefaultTimeout(2500);
    const record = { id, errors: [], warnings: [], checks: [] };
    page.on('pageerror', e => record.errors.push(e.message));
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) record.warnings.push(m.text()); });
    page.on('dialog', d => { record.checks.push({ dialog: d.message() }); d.dismiss(); });
    const text = () => page.locator('body').innerText();
    const toggleInput = async input => {
      if (await input.isVisible()) {
        try { await input.click({ timeout: 500 }); return; } catch {}
      }
      const label = input.locator('xpath=ancestor::label[1]');
      if (await label.count()) await label.click();
      else await input.press('Space');
    };
    const check = async (name, fn) => {
      try { record.checks.push({ name, ...await fn() }); }
      catch (error) { record.checks.push({ name, error: error.message.split('\n')[0] }); }
    };
    try {
      if (reexport) {
        const spec = JSON.parse(await readFile(resolve(output, id, 'spec.json'), 'utf8'));
        await page.addInitScript(spec => {
          if (window === window.top) sessionStorage.setItem('pg-current-spec', JSON.stringify(spec));
        }, spec);
        await page.goto(base + '/playground.html');
        const pending = page.waitForEvent('download');
        await page.locator('#pg-download').click();
        await (await pending).saveAs(resolve(output, id, 'reexported.html'));
      }
      await page.goto(base + '/' + relative(root, output) + '/' + id + (reexport ? '/reexported.html' : '/generated.html'));
      await page.waitForTimeout(600);
      record.controls = await page.locator('input,button,select,a,[role=radio],[role=checkbox],[role=tab]').evaluateAll(els => els.map(e => ({ tag: e.tagName, type: e.type, role: e.getAttribute('role'), specId: e.dataset.specId || e.closest('[data-spec-id]')?.dataset.specId, text: e.textContent.trim().slice(0,100), placeholder: e.getAttribute('placeholder'), label: e.getAttribute('aria-label'), href: e.getAttribute('href'), value: e.value, checked: e.checked, visible: !!(e.getBoundingClientRect().width && e.getBoundingClientRect().height) })));
      const number = Number(id.slice(0,2));
      if (number === 1) await check('Select answer and advance question', async () => {
        const options = page.locator('input[type=radio],[role=radio]');
        const count = await options.count();
        if (count) await toggleInput(options.first());
        const before = await text();
        await page.getByRole('button', { name: /^Next(?: question)?$/i }).click();
        await page.waitForTimeout(150);
        return { options: count, changed: before !== await text(), before, after: await text() };
      });
      if (number === 2) await check('Recovery link destination', async () => ({ links: await page.getByText('Forgot password?', { exact: true }).evaluateAll(els => els.map(e => ({ href: e.getAttribute('href'), tag: e.tagName }))) }));
      if (number === 3) await check('Annual billing changes prices', async () => {
        const initial = (await text()).match(/\$[\d,.]+/g);
        const monthly = page.getByRole('button', { name: 'Monthly', exact: true });
        for (let i = 0; i < await monthly.count(); i++) await monthly.nth(i).click();
        const before = (await text()).match(/\$[\d,.]+/g);
        const annual = page.getByRole('button', { name: 'Annual', exact: true });
        const states = [];
        for (let i = 0; i < await annual.count(); i++) { await annual.nth(i).click(); await page.waitForTimeout(150); states.push((await text()).match(/\$[\d,.]+/g)); }
        return { initial, before, afterEachToggle: states, changed: states.some(s => JSON.stringify(s) !== JSON.stringify(before)) };
      });
      if (number === 4) {
        await check('Add task', async () => { await page.locator('input[type=text]').first().fill('Benchmark task'); await page.getByRole('button', { name: /^Add(?: task)?$/ }).last().click(); await page.waitForTimeout(100); return { added: (await text()).includes('Benchmark task') }; });
        await check('Complete task', async () => { const cb = page.locator('input[type=checkbox]'); const before = await text(); const checked = await cb.first().isChecked(); await toggleInput(cb.first()); return { checkedChanged: await cb.first().isChecked() !== checked, counterOrTextChanged: before !== await text() }; });
        await check('Delete task', async () => { const before = await text(); await page.getByRole('button', { name: 'Delete task', exact: true }).first().click(); return { changed: before !== await text(), after: await text() }; });
      }
      if (number === 5) await check('Save edited profile', async () => { await page.locator('input[type=text]').first().fill('Benchmark Person'); await page.locator('input[type=email]').first().fill('benchmark@example.com'); const before = await text(); await page.getByRole('button', { name: 'Save changes', exact: true }).last().click(); await page.waitForTimeout(200); return { changed: before !== await text(), after: await text() }; });
      if (number === 6) await check('Search filters recipes', async () => { const before = await text(); const headings = await page.locator('h2,h3,h4').allTextContents(); const search = page.locator('input[type=search],input[placeholder*="Search"]'); const afterEachSearch = []; for (let i = 0; i < await search.count(); i++) { await search.nth(i).fill('zzzxq-no-recipe'); await search.nth(i).press('Enter'); await page.waitForTimeout(200); afterEachSearch.push(await text()); } return { before, headings, afterEachSearch, contentChanged: afterEachSearch.some(s => s.replace(/×/g, '').replace(/\s+/g, ' ') !== before.replace(/×/g, '').replace(/\s+/g, ' ')) }; });
      if (number === 7) await check('Toggle habit checkbox', async () => { const cb = page.locator('input[type=checkbox]'); const count = await cb.count(); const before = await text(); const checked = await cb.first().isChecked(); await toggleInput(cb.first()); return { count, checkedChanged: await cb.first().isChecked() !== checked, textChanged: before !== await text() }; });
      if (number === 8) await check('Select another support message', async () => {
        const list = page.locator('.db-list__item');
        if (await list.count() < 2) return { tested: false, reason: 'Fewer than two native List rows; inspect custom markup before concluding.' };
        const before = await text();
        await list.nth(1).click();
        await page.waitForTimeout(150);
        return { before, after: await text(), changed: before !== await text(), selectedRow: await list.nth(1).innerText() };
      });
      if (number === 9) await check('Quantity changes order totals', async () => {
        const before = (await text()).match(/\$[\d,.]+/g);
        const quantity = await page.locator('input[type=number]').first().inputValue();
        await page.getByRole('button', { name: /^Increase/ }).first().click();
        await page.waitForTimeout(150);
        const after = (await text()).match(/\$[\d,.]+/g);
        return { before, after, quantityBefore: quantity, quantityAfter: await page.locator('input[type=number]').first().inputValue(), totalsChanged: JSON.stringify(before) !== JSON.stringify(after) };
      });
      if (number === 10) await check('Registration fields and ticket stepper', async () => {
        const name = page.locator('input[type=text]');
        const email = page.locator('input[type=email]');
        const quantity = page.locator('input[type=number]');
        const counts = { names: await name.count(), emails: await email.count(), quantities: await quantity.count() };
        await name.first().fill('Benchmark Person');
        await email.first().fill('benchmark@example.com');
        const before = await quantity.first().inputValue();
        await page.getByRole('button', { name: /^Increase/ }).first().click();
        return { counts, editable: await name.first().inputValue() === 'Benchmark Person' && await email.first().inputValue() === 'benchmark@example.com', quantityBefore: before, quantityAfter: await quantity.first().inputValue(), note: 'No registration submitted and no external backend tested.' };
      });
      record.finalText = await text();
    } catch (error) { record.error = error.message; }
    await writeFile(resolve(output, id, reexport ? 'interaction-reexported.json' : 'interaction.json'), JSON.stringify(record, null, 2));
    results.push(record);
    await context.close();
    console.log(id, JSON.stringify(record.checks), record.warnings.filter(w => !w.includes('Failed to load resource')).slice(0,3));
  }
  await writeFile(resolve(output, reexport ? 'interactions-reexported.json' : 'interactions.json'), JSON.stringify(results, null, 2));
} finally { await browser.close(); await new Promise(done => server.close(done)); }
