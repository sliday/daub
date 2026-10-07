import { before, after, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(new URL('../../react/package.json', import.meta.url));
const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../../daub.js', import.meta.url), 'utf8');
let browser, script, page;
before(async () => {
  const result = await require('esbuild').build({ entryPoints: [fileURLToPath(new URL('disclosures-fixture.tsx', import.meta.url))], bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', nodePaths: [fileURLToPath(new URL('../../react/node_modules', import.meta.url))] });
  script = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); });
beforeEach(async () => {
  page = await browser.newPage();
  page.setDefaultTimeout(2000);
  await page.setContent('<html><body><div id="root"></div></body></html>');
  await page.route('http://daub.test/og-image.png', route => route.fulfill({ contentType: 'image/png', body: readFileSync(new URL('../../og-image.png', import.meta.url)) }));
  await page.addStyleTag({ content: css });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  await page.addScriptTag({ content: script });
});
afterEach(async () => { await page?.close(); });
const mount = (kind, props = {}) => page.evaluate(({ kind, props }) => window.mountDisclosure(kind, props), { kind, props });

test('accordion links panels, retains input state, and displays long content', async () => {
  await mount('Accordion', { defaultOpenItems: [0] });
  const trigger = page.getByRole('button', { name: 'Profile', exact: true });
  const panelId = await trigger.getAttribute('aria-controls');
  assert.ok(panelId);
  const panel = page.locator(`[id="${panelId}"]`);
  assert.equal(await panel.getAttribute('aria-labelledby'), await trigger.getAttribute('id'));
  await page.getByRole('textbox', { name: 'Profile name' }).fill('Grace');
  await trigger.click();
  assert.equal(await panel.isVisible(), false);
  await trigger.click();
  assert.equal(await page.getByRole('textbox', { name: 'Profile name' }).inputValue(), 'Grace');
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  assert.equal(await page.getByRole('region', { name: 'Details', exact: true }).evaluate(element => element.scrollHeight <= element.clientHeight + 1), true);
  await trigger.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.includes('Details')), true);
});

test('controlled accordion emits requests and native init leaves React state intact', async () => {
  await mount('Accordion', { openItems: [] });
  await page.addScriptTag({ content: runtime });
  await page.evaluate(() => DAUB.init());
  const trigger = page.getByRole('button', { name: 'Profile', exact: true });
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(await page.evaluate(() => window.events), [[0]]);
});

test('collapsible retains state and has stable trigger/content relationships', async () => {
  await mount('Collapsible', { defaultOpen: true });
  const trigger = page.getByRole('button', { name: 'Show details' });
  assert.ok(await trigger.getAttribute('aria-controls'));
  await page.getByRole('textbox', { name: 'Notes' }).fill('Keep this value');
  await trigger.click();
  await trigger.click();
  assert.equal(await page.getByRole('textbox', { name: 'Notes' }).inputValue(), 'Keep this value');
});

test('fieldset composes existing and helper descriptions', async () => {
  await mount('Fieldset');
  const fieldset = page.getByRole('group', { name: 'Account', exact: true });
  const ids = (await fieldset.getAttribute('aria-describedby')).split(' ');
  assert.equal(ids[0], 'external');
  assert.equal(ids.length, 2);
  assert.equal(await page.locator(`[id="${ids[1]}"]`).textContent(), 'Visible to your team');
});

test('standalone radios use native group selection, reset, and DAUB input styling', async () => {
  await mount('Radio');
  await page.getByText('Team', { exact: true }).click();
  assert.equal(await page.getByRole('radio', { name: 'Team', exact: true }).isChecked(), true);
  await page.getByText('Free', { exact: true }).click();
  assert.equal(await page.getByRole('radio', { name: 'Free', exact: true }).isChecked(), true);
  await page.getByText('Team', { exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  assert.equal(await page.getByRole('radio', { name: 'Free', exact: true }).isChecked(), true);
  assert.equal(await page.locator('.db-radio__input').count(), 2);
});

test('Stack applies actual flex layout, alignment, wrapping, and zero gap', async () => {
  await mount('Stack', { direction: 'horizontal', justify: 'between', align: 'center', wrap: true, gap: 0 });
  const computed = await page.locator('.db-stack').evaluate(element => {
    const style = getComputedStyle(element);
    return { display: style.display, direction: style.flexDirection, justify: style.justifyContent, align: style.alignItems, wrap: style.flexWrap, gap: style.gap };
  });
  assert.deepEqual(computed, { display: 'flex', direction: 'row', justify: 'space-between', align: 'center', wrap: 'wrap', gap: '0px' });
  await mount('Stack', { direction: 'vertical', gap: 2 });
  assert.equal(await page.locator('.db-stack').evaluate(element => getComputedStyle(element).flexDirection), 'column');
  assert.equal(await page.locator('.db-stack').evaluate(element => getComputedStyle(element).gap), '8px');
});

test('Grid applies alignment and explicit zero spacing', async () => {
  await mount('Grid', { align: 'end', gap: 0 });
  assert.equal(await page.locator('.db-grid').evaluate(element => getComputedStyle(element).justifyItems), 'end');
  assert.equal(await page.locator('.db-grid').evaluate(element => getComputedStyle(element).gap), '0px');
});

test('Image fits its container while loading the actual library asset', async () => {
  await mount('Image');
  await page.waitForFunction(() => document.querySelector('img')?.complete);
  const image = await page.getByRole('img', { name: 'DAUB component library' }).evaluate(element => ({ natural: element.naturalWidth, width: element.getBoundingClientRect().width }));
  assert.ok(image.natural > 260);
  assert.equal(image.width, 260);
});
