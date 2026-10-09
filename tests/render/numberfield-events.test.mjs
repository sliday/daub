import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const source = await readFile(new URL('../../daub-render.js', import.meta.url), 'utf8');
let browser;
let page;

before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  page = await browser.newPage();
  page.setDefaultTimeout(3000);
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: source });
});

after(async () => { await browser?.close(); });

async function render(props = {}) {
  await page.evaluate(props => {
    const host = document.createElement('section');
    const field = renderElement({ quantity: { type: 'NumberField', props: { label: 'Quantity', value: 2, min: 1, max: 3, ...props } } }, 'quantity', 0);
    const input = field.querySelector('input');
    host.appendChild(field);
    document.body.replaceChildren(host);
    window.numberFieldEvents = [];
    window.cartTotal = input.valueAsNumber * 68;
    for (const type of ['input', 'change']) {
      host.addEventListener(type, event => {
        window.numberFieldEvents.push({ type: event.type, value: event.target.valueAsNumber, bubbles: event.bubbles, inputTarget: event.target === input });
        if (event.type === 'change') window.cartTotal = event.target.valueAsNumber * 68;
      });
    }
  }, props);
}

for (const [direction, value] of [['Increase', 3], ['Decrease', 1]]) {
  test(`NumberField ${direction.toLowerCase()} bubbles input then change with the updated value`, async () => {
    await render();
    await page.getByRole('button', { name: `${direction} quantity`, exact: true }).click();
    assert.equal(await page.getByRole('spinbutton', { name: 'Quantity' }).inputValue(), String(value));
    assert.deepEqual(await page.evaluate(() => window.numberFieldEvents), [
      { type: 'input', value, bubbles: true, inputTarget: true },
      { type: 'change', value, bubbles: true, inputTarget: true },
    ]);
    assert.equal(await page.evaluate(() => window.cartTotal), value * 68);
    assert.equal(await page.getByRole('button', { name: `${direction} quantity`, exact: true }).isDisabled(), true);
  });
}

test('NumberField disabled, read-only, and bounded steppers emit no events', async () => {
  for (const [props, directions] of [
    [{ disabled: true }, ['Increase', 'Decrease']],
    [{ readOnly: true }, ['Increase', 'Decrease']],
    [{ value: 1 }, ['Decrease']],
    [{ value: 3 }, ['Increase']],
  ]) {
    await render(props);
    for (const direction of directions) {
      const button = page.getByRole('button', { name: `${direction} quantity`, exact: true });
      assert.equal(await button.isDisabled(), true);
      await button.evaluate(element => element.click());
    }
    assert.deepEqual(await page.evaluate(() => window.numberFieldEvents), []);
    assert.equal(await page.getByRole('spinbutton', { name: 'Quantity' }).inputValue(), String(props.value ?? 2));
  }
});
