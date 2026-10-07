import assert from 'node:assert/strict';
import { before, beforeEach, after, afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const reactRequire = createRequire(new URL('../../react/package.json', import.meta.url));
const { build } = reactRequire('esbuild');
const { chromium } = require('playwright');
const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
const nativeScript = readFileSync(new URL('../../daub.js', import.meta.url), 'utf8');
let browser;
let page;
let errors;
let script;

before(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./fixture.tsx', import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    nodePaths: [fileURLToPath(new URL('../../react/node_modules', import.meta.url))],
  });
  script = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(2000);
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent('<html data-theme="github"><body style="padding:32px"><div id="root"></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
});
afterEach(async () => {
  await page.close();
  assert.deepEqual(errors, [], 'React/browser errors');
});
after(async () => { await browser?.close(); });

const mount = (kind, props = {}) => page.evaluate(({ kind, props }) => window.mount(kind, props), { kind, props });
const events = () => page.evaluate(() => window.events);

const themePalettes = {
  dracula: { background: 'rgb(40, 42, 54)', surface: 'rgb(52, 55, 70)', text: 'rgb(248, 248, 242)', scheme: 'dark', buttonText: 'rgb(17, 17, 17)', surfaceGradient: 'linear-gradient(180deg, #343746 0%, #282A36 100%)', buttonGradient: 'linear-gradient(180deg, color-mix(in srgb, #BD93F9, #fff 0%) 0%, color-mix(in srgb, #A580E0, #fff 0%) 100%)' },
  'nord-light': { background: 'rgb(236, 239, 244)', surface: 'rgb(240, 243, 248)', text: 'rgb(46, 52, 64)', scheme: 'light', buttonText: 'rgb(255, 255, 255)', surfaceGradient: 'linear-gradient(180deg, #F0F3F8 0%, #ECEFF4 100%)', buttonGradient: 'linear-gradient(180deg, color-mix(in srgb, #5E81AC, #000 8%) 0%, color-mix(in srgb, #4C6C8F, #000 8%) 100%)' },
};
const computedGradient = (gradient) => page.evaluate((gradient) => {
  const probe = document.createElement('div');
  probe.style.backgroundImage = gradient;
  document.body.append(probe);
  const computed = getComputedStyle(probe).backgroundImage;
  probe.remove();
  return computed;
}, gradient);
const colors = (locator) => locator.evaluate(async (node) => {
  // Flush new styles before collecting their color-transition animations.
  void getComputedStyle(node).color;
  await Promise.allSettled(node.getAnimations().map((animation) => animation.finished));
  const style = getComputedStyle(node);
  return { background: style.backgroundColor, image: style.backgroundImage, color: style.color, scheme: style.colorScheme, font: style.fontFamily };
});

test('Switch composes consumer handlers and retains uncontrolled state', async () => {
  await mount('Switch', { label: 'Notifications', handlers: true });
  const control = page.getByRole('switch', { name: 'Notifications' });
  await control.click();
  assert.equal(await control.getAttribute('aria-checked'), 'true');
  await control.press('Space');
  assert.equal(await control.getAttribute('aria-checked'), 'false');
  assert.deepEqual(await events(), ['click', true, ' ', false]);
  assert.equal(await page.evaluate(() => window.refs.control === document.querySelector('[role="switch"]')), true);
});

test('Switch honors disabled and cancelled events', async () => {
  await mount('Switch', { label: 'Notifications', 'aria-disabled': true, handlers: true });
  const control = page.getByRole('switch');
  await control.dispatchEvent('click');
  await control.press('Enter');
  assert.equal(await control.getAttribute('aria-checked'), 'false');
  assert.equal(await control.getAttribute('tabindex'), '-1');
  assert.deepEqual(await events(), ['click', 'Enter']);
  await mount('Switch', { label: 'Notifications', handlers: true, cancel: true });
  await control.click();
  assert.equal(await control.getAttribute('aria-checked'), 'false');
});

test('Switch accepts a disabled prop without forwarding it to the div', async () => {
  await mount('Switch', { label: 'Notifications', disabled: true });
  const control = page.getByRole('switch');
  await control.dispatchEvent('click');
  await control.press('Enter');
  assert.equal(await control.getAttribute('aria-checked'), 'false');
  assert.equal(await control.getAttribute('aria-disabled'), 'true');
  assert.equal(await control.getAttribute('disabled'), null);
  assert.deepEqual(await events(), []);
});

test('Toggle composes consumer click handlers without submitting forms', async () => {
  await mount('Toggle', { children: 'Bold', handlers: true });
  const control = page.getByRole('button', { name: 'Bold' });
  await control.click();
  assert.equal(await control.getAttribute('aria-pressed'), 'true');
  assert.equal(await control.getAttribute('type'), 'button');
  assert.deepEqual(await events(), ['click', true]);
  await mount('Toggle', { children: 'Bold', handlers: true, cancel: true });
  await control.click();
  assert.equal(await control.getAttribute('aria-pressed'), 'true');
});

test('controlled Switch and Toggle report requests without mutating state', async () => {
  for (const [kind, prop, attribute] of [['Switch', 'checked', 'aria-checked'], ['Toggle', 'pressed', 'aria-pressed']]) {
    await mount(kind, { [prop]: false, label: 'Control', children: 'Control' });
    const control = page.locator(kind === 'Switch' ? '[role="switch"]' : '.db-toggle');
    await control.click();
    assert.equal(await control.getAttribute(attribute), 'false');
    await mount(kind, { [prop]: true, label: 'Control', children: 'Control' });
    assert.equal(await control.getAttribute(attribute), 'true');
  }
  assert.deepEqual(await events(), [true, true]);
});

test('NumberField disables stepping at bounds and when disabled or read-only', async () => {
  await mount('NumberField', { defaultValue: 1, min: 1, max: 2 });
  assert.equal(await page.getByRole('button', { name: 'Decrease' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Increase' }).click();
  assert.equal(await page.getByRole('spinbutton').inputValue(), '2');
  assert.equal(await page.getByRole('button', { name: 'Increase' }).isDisabled(), true);
  for (const prop of ['disabled', 'readOnly']) {
    await mount('NumberField', { value: 1, [prop]: true });
    assert.equal(await page.getByRole('button', { name: 'Decrease' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Increase' }).isDisabled(), true);
  }
  assert.deepEqual(await events(), [2]);
});

const tabs = [{ label: 'Account', content: 'Account details' }, { label: 'Security', content: 'Security details' }, { label: 'Billing', content: 'Billing details' }];
test('Tabs supports roving focus, wraparound, Home/End, and panel associations', async () => {
  await mount('Tabs', { tabs });
  assert.deepEqual(await page.getByRole('tab').evaluateAll((nodes) => nodes.map((node) => node.tabIndex)), [0, -1, -1]);
  const account = page.getByRole('tab', { name: 'Account' });
  await account.focus();
  await account.press('ArrowLeft');
  assert.equal(await page.getByRole('tab', { name: 'Billing' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tabpanel', { name: 'Billing' }).textContent(), 'Billing details');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('End');
  assert.deepEqual(await events(), [2, 0, 1, 2]);
  const target = await page.getByRole('tab', { name: 'Billing' }).getAttribute('aria-controls');
  assert.equal(await page.getByRole('tabpanel').getAttribute('id'), target);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Billing');
});

test('controlled Tabs stays on the supplied selection until rerender', async () => {
  await mount('Tabs', { tabs, activeTab: 0 });
  await page.getByRole('tab', { name: 'Security' }).click();
  assert.equal(await page.getByRole('tab', { name: 'Account' }).getAttribute('aria-selected'), 'true');
  assert.deepEqual(await events(), [1]);
  await mount('Tabs', { tabs, activeTab: 1 });
  assert.equal(await page.getByRole('tabpanel', { name: 'Security' }).textContent(), 'Security details');
});

test('Select links its visible label to its native input and forwards its ref', async () => {
  await mount('Select', { label: 'Frequency', options: [{ value: 'weekly', label: 'Weekly' }] });
  assert.equal(await page.getByLabel('Frequency').inputValue(), 'weekly');
  assert.equal(await page.evaluate(() => window.refs.control === document.querySelector('select')), true);
});

test('Slider links the label to the range input', async () => {
  await mount('Slider', { label: 'Volume', defaultValue: 30 });
  await page.getByRole('slider', { name: 'Volume' }).press('ArrowRight');
  assert.deepEqual(await events(), [31]);
  assert.equal(await page.evaluate(() => window.refs.control === document.querySelector('input')), true);
});

test('Slider sends disabled and accessible-name props to the native range input', async () => {
  await mount('Slider', { 'aria-label': 'Volume', disabled: true, defaultValue: 30 });
  const control = page.getByRole('slider', { name: 'Volume' });
  assert.equal(await control.isDisabled(), true);
  assert.deepEqual(await events(), []);
});

test('Popover opens with native CSS and closes outside when using callback refs', async () => {
  await mount('Popover');
  await page.getByRole('button', { name: 'Open popover' }).click();
  assert.equal(await page.getByRole('button', { name: 'Popover action' }).isVisible(), true);
  assert.equal(await page.evaluate(() => window.refs.popover === document.querySelector('.db-popover')), true);
  await page.getByRole('button', { name: 'Outside', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Popover action' }).count(), 0);
  assert.deepEqual(await events(), [true, false]);
});

const options = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }, { value: 'c', label: 'Cherry' }];
test('CustomSelect exposes listbox semantics and keyboard selection', async () => {
  await mount('CustomSelect', { options, defaultValue: 'b', 'aria-label': 'Fruit' });
  const trigger = page.getByRole('combobox', { name: 'Fruit' });
  await trigger.press('ArrowDown');
  const cherry = page.getByRole('option', { name: 'Cherry' });
  assert.equal(await cherry.getAttribute('id'), await trigger.getAttribute('aria-activedescendant'));
  await trigger.press('Enter');
  assert.equal(await trigger.textContent(), 'Cherry');
  assert.deepEqual(await events(), ['c']);
  await trigger.press('Space');
  assert.equal(await page.getByRole('option', { name: 'Cherry' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('option', { name: 'Cherry' }).evaluate((node) => node.classList.contains('db-custom-select__option--selected')), true);
  await trigger.press('Escape');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
});

test('searchable CustomSelect filters, selects, resets search and restores trigger focus', async () => {
  await mount('CustomSelect', { options, searchable: true, 'aria-label': 'Fruit' });
  await page.getByRole('combobox', { name: 'Fruit' }).click();
  const search = page.getByRole('textbox', { name: 'Search options' });
  assert.equal(await search.evaluate((node) => document.activeElement === node), true);
  await search.fill('ban');
  assert.equal(await page.getByRole('option').count(), 1);
  await search.press('ArrowDown');
  await search.press('Enter');
  assert.deepEqual(await events(), ['b']);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Banana');
  await page.getByRole('combobox').click();
  assert.equal(await page.getByRole('textbox').inputValue(), '');
});

for (const kind of ['Modal', 'AlertDialog', 'Sheet', 'Drawer']) {
  test(`${kind} renders with native CSS, traps focus and restores it on Escape`, async () => {
    await mount(kind);
    await page.locator('#opener').click();
    const dialog = page.getByRole(kind === 'AlertDialog' ? 'alertdialog' : 'dialog');
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    if (kind !== 'Drawer') assert.ok(await dialog.getAttribute('aria-labelledby'));
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true);
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert.deepEqual(await events(), ['close']);
  });
}

test('Modal skips disabled/hidden controls and refreshes the focusable list', async () => {
  await mount('Modal');
  await page.locator('#opener').click();
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close');
  await page.getByRole('button', { name: 'Done', exact: true }).focus();
  await page.getByRole('button', { name: 'Dialog action' }).evaluate((node) => { node.disabled = true; });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close');
});

test('Modal without focusable children focuses its panel and contains Tab', async () => {
  await mount('Modal', { empty: true });
  await page.locator('#opener').click();
  const dialog = page.getByRole('dialog');
  assert.equal(await dialog.evaluate((node) => document.activeElement === node), true);
  await page.keyboard.press('Tab');
  assert.equal(await dialog.evaluate((node) => document.activeElement === node), true);
});

test('nested overlays dismiss only the top dialog and retain the outer scroll lock', async () => {
  await mount('NestedOverlay');
  await page.locator('#opener').click();
  await page.locator('#inner-opener').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.deepEqual(await events(), ['inner-close']);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'inner-opener');
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['inner-close', 'outer-close']);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
});

test('Escape dismisses a nested Popover before its Modal', async () => {
  await mount('Modal', { popover: true });
  await page.locator('#opener').click();
  await page.getByRole('button', { name: 'Open popover' }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Popover action' }).count(), 0);
  assert.deepEqual(await events(), []);
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['close']);
});

test('activation order owns focus and Escape despite sibling DOM order and rerenders', async () => {
  await mount('SiblingOverlays');
  await page.locator('#opener').click();
  await page.locator('#earlier-opener').click();
  const earlier = page.getByRole('dialog', { name: 'Earlier DOM sibling' });
  assert.equal(await earlier.evaluate((node) => node.compareDocumentPosition(document.querySelector('[role="dialog"]:last-child')) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false), true);
  await earlier.getByRole('button', { name: 'Rerender 0' }).evaluate((node) => node.click());
  await earlier.getByRole('button', { name: 'Rerender 1' }).focus();
  await page.keyboard.press('Tab');
  assert.equal(await earlier.evaluate((node) => node.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['earlier-close']);
  assert.equal(await page.getByRole('dialog', { name: 'Later DOM sibling' }).count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'earlier-opener');
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['earlier-close', 'later-close']);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
});

test('simultaneous nested activation survives child-before-parent effects', async () => {
  await mount('SimultaneousNestedOverlay');
  await page.locator('#opener').click();
  const inner = page.getByRole('dialog', { name: 'Inner' });
  assert.equal(await inner.evaluate((node) => node.contains(document.activeElement)), true);
  await page.keyboard.press('Tab');
  assert.equal(await inner.evaluate((node) => node.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['inner-close']);
  assert.equal(await page.getByRole('dialog', { name: 'Outer' }).count(), 1);
  assert.equal(await page.getByRole('dialog', { name: 'Outer' }).evaluate((node) => node.contains(document.activeElement)), true);
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['inner-close', 'outer-close']);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
});

test('sibling activation in DOM order retains focus across close and reopen', async () => {
  await mount('SiblingOverlays');
  await page.locator('#first-opener').click();
  await page.locator('#later-opener').click();
  const later = page.getByRole('dialog', { name: 'Later DOM sibling' });
  await later.getByRole('button', { name: 'Rerender 0' }).click();
  await page.keyboard.press('Tab');
  assert.equal(await later.evaluate((node) => node.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['later-close']);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'later-opener');
  await page.locator('#later-opener').click();
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['later-close', 'later-close']);
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['later-close', 'later-close', 'earlier-close']);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'first-opener');
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
});

test('StrictMode nested overlays preserve activation order and clean up locks', async () => {
  await page.evaluate(() => window.mountStrict('SimultaneousNestedOverlay'));
  await page.locator('#opener').click();
  const inner = page.getByRole('dialog', { name: 'Inner' });
  assert.equal(await inner.evaluate((node) => node.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['inner-close']);
  await page.keyboard.press('Escape');
  assert.deepEqual(await events(), ['inner-close', 'outer-close']);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
});

test('CustomSelect skips disabled options, reports controlled requests and honors disabled state', async () => {
  await mount('CustomSelect', { options: [{ ...options[0], disabled: true }, ...options.slice(1)], value: 'b', 'aria-label': 'Fruit' });
  const trigger = page.getByRole('combobox', { name: 'Fruit' });
  await trigger.press('ArrowDown');
  await trigger.press('ArrowDown');
  await trigger.press('Enter');
  assert.deepEqual(await events(), ['b']);
  assert.equal(await trigger.textContent(), 'Banana');
  await mount('CustomSelect', { options, value: 'c', 'aria-label': 'Fruit' });
  assert.equal(await trigger.textContent(), 'Cherry');
  await mount('CustomSelect', { options, disabled: true, 'aria-label': 'Fruit' });
  assert.equal(await trigger.isDisabled(), true);
});

test('overlay cleanup restores an existing body overflow setting', async () => {
  await page.evaluate(() => { document.body.style.overflow = 'scroll'; });
  await mount('Modal');
  await page.locator('#opener').click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'scroll');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
});

test('open overlays are safe to render on the server', async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../../react/src/index.ts', import.meta.url))],
    bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  });
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: reactRequire });
  const { createElement } = reactRequire('react');
  const { renderToString } = reactRequire('react-dom/server');
  for (const kind of ['Modal', 'AlertDialog', 'Sheet', 'Drawer', 'CommandPalette']) {
    assert.equal(renderToString(createElement(module.exports[kind], { open: true, onClose() {}, title: 'Title', groups: [] })), '');
  }
});

for (const width of [320, 390, 1280]) {
  test(`overlay panels fit a ${width}px viewport with native DAUB CSS`, async () => {
    await page.setViewportSize({ width, height: 800 });
    for (const kind of ['Modal', 'AlertDialog', 'Sheet', 'Drawer']) {
      await mount(kind);
      await page.locator('#opener').click();
      const dialog = page.getByRole(kind === 'AlertDialog' ? 'alertdialog' : 'dialog');
      const box = await dialog.boundingBox();
      assert.ok(box && box.width > 0 && box.height > 0, `${kind} has a visible panel`);
      assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `${kind} fits horizontally`);
      if (process.env.REACT_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.REACT_SCREENSHOT_DIR, `${kind}-${width}.png`) });
      await page.keyboard.press('Escape');
    }
  });
}

test('DropdownMenu uses native visibility, composed triggers, menu keys and safe form actions', async () => {
  await mount('DropdownMenu');
  const trigger = page.getByRole('button', { name: 'Actions' });
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.getByRole('menu').isVisible(), true);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Save');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Delete');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  assert.deepEqual(await events(), ['trigger', 'save']);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Actions');
  await trigger.press('ArrowUp');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Delete');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('menu').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Actions');
});

test('DropdownMenu honors a trigger cancellation', async () => {
  await mount('DropdownMenu', { cancel: true });
  await page.getByRole('button', { name: 'Actions' }).click();
  assert.equal(await page.getByRole('menu').count(), 0);
  assert.deepEqual(await events(), ['trigger']);
});

test('ContextMenu keeps its content visible and supports keyboard invocation and restoration', async () => {
  await mount('ContextMenu');
  const target = page.getByRole('button', { name: 'Document' });
  assert.equal(await target.isVisible(), true);
  await target.press('Shift+F10');
  assert.equal(await page.getByRole('menu').isVisible(), true);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Copy');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Paste');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Document');
  await target.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy' }).click();
  assert.deepEqual(await events(), ['copy']);
});

test('HoverCard associates focus preview and dismisses it with Escape', async () => {
  await mount('HoverCard');
  const trigger = page.getByRole('button', { name: 'Profile' });
  await trigger.focus();
  assert.equal(await page.getByText('Profile preview').isVisible(), true);
  const description = await trigger.getAttribute('aria-describedby');
  assert.ok(description.includes('old-description'));
  assert.equal(await page.locator(`[id="${description.split(' ').at(-1)}"]`).textContent(), 'Profile preview');
  await trigger.press('Escape');
  assert.equal(await page.getByText('Profile preview').count(), 0);
});

test('Popover supplies trigger semantics and restores focus from content', async () => {
  await mount('Popover');
  const trigger = page.getByRole('button', { name: 'Open popover' });
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.ok(await trigger.getAttribute('aria-controls'));
  await page.getByRole('button', { name: 'Popover action' }).focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Open popover');
});

for (const kind of ['Modal', 'AlertDialog', 'Sheet', 'Drawer', 'Toast', 'CommandPalette']) {
  test(`${kind} portal inherits the nearest ThemeProvider and updates its theme`, async () => {
    await mount('ThemedPortals', { kind, theme: 'dracula', nested: true });
    if (kind === 'Toast') await page.getByRole('button', { name: 'Show toast' }).click();
    else if (kind !== 'CommandPalette') await page.locator('#opener').click();
    const portal = page.locator(kind === 'Toast' ? '.db-toast-stack' : kind === 'CommandPalette' ? '.db-command' : kind === 'Modal' ? '.db-modal-overlay' : `.db-${kind.replace(/[A-Z]/g, (c, i) => (i ? '-' : '') + c.toLowerCase())}`);
    assert.equal(await (kind === 'Sheet' ? portal.locator('.db-sheet__panel') : portal).isVisible(), true);
    assert.equal(await portal.getAttribute('data-theme'), 'dracula');
    const surface = kind === 'Toast' ? portal.locator('.db-toast') : kind === 'Modal' ? portal.locator('.db-modal') : kind === 'CommandPalette' ? portal.locator('.db-command__panel') : portal.locator(`.db-${kind.replace(/[A-Z]/g, (c, i) => (i ? '-' : '') + c.toLowerCase())}__panel`);
    const dark = await colors(surface);
    assert.equal(dark.scheme, themePalettes.dracula.scheme);
    assert.equal(dark.color, themePalettes.dracula.text);
    if (kind === 'Modal' || kind === 'Toast') assert.equal(dark.image, await computedGradient(themePalettes.dracula.surfaceGradient));
    else assert.equal(dark.background, themePalettes.dracula.surface);
    const primary = surface.locator('.db-btn--primary');
    if (await primary.count()) {
      assert.equal((await colors(primary)).image, await computedGradient(themePalettes.dracula.buttonGradient));
      assert.equal((await colors(primary)).color, themePalettes.dracula.buttonText);
    }
    await mount('ThemedPortals', { kind, theme: 'nord-light', nested: true });
    assert.equal(await portal.getAttribute('data-theme'), 'nord-light');
    const light = await colors(surface);
    assert.equal(light.scheme, themePalettes['nord-light'].scheme);
    assert.equal(light.color, themePalettes['nord-light'].text);
    if (kind === 'Modal' || kind === 'Toast') assert.equal(light.image, await computedGradient(themePalettes['nord-light'].surfaceGradient));
    else assert.equal(light.background, themePalettes['nord-light'].surface);
    if (await primary.count()) {
      assert.equal((await colors(primary)).image, await computedGradient(themePalettes['nord-light'].buttonGradient));
      assert.equal((await colors(primary)).color, themePalettes['nord-light'].buttonText);
    }
  });
}

test('ThemeProvider applies computed scoped colors and font to plain children and component fills', async () => {
  for (const theme of ['dracula', 'nord-light']) {
    await mount('ThemedPortals', { kind: 'Modal', theme, nested: true });
    const expected = themePalettes[theme];
    const plain = page.getByTestId('plain-themed-child');
    const scope = plain.locator('..');
    assert.equal((await colors(scope)).background, expected.background);
    assert.equal((await colors(plain)).color, expected.text);
    assert.equal((await colors(plain)).scheme, expected.scheme);
    assert.equal((await colors(page.getByTestId('themed-card'))).image, await computedGradient(expected.surfaceGradient));
    const button = await colors(page.getByTestId('themed-primary'));
    assert.equal(button.image, await computedGradient(expected.buttonGradient));
    assert.equal(button.color, expected.buttonText);
    await scope.evaluate((node) => node.style.setProperty('--db-font-body', '"Courier New", monospace'));
    assert.equal((await colors(plain)).font, '"Courier New", monospace');
  }
});

test('computed-color gates detect the original root-only semantic alias regression', async () => {
  await mount('ThemedPortals', { kind: 'Modal', theme: 'dracula' });
  await page.locator('#opener').click();
  const expected = await computedGradient(themePalettes.dracula.surfaceGradient);
  assert.equal((await colors(page.getByRole('dialog'))).image, expected);
  const changed = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSStyleRule && rule.selectorText.includes(':root') && rule.style.getPropertyValue('--db-modal-bg')) {
          rule.selectorText = ':root';
          return true;
        }
      }
    }
    return false;
  });
  assert.equal(changed, true, 'locate the shared semantic/component token rule');
  assert.notEqual((await colors(page.getByRole('dialog'))).image, expected);
  assert.notEqual((await colors(page.getByTestId('themed-primary'))).image, await computedGradient(themePalettes.dracula.buttonGradient));
});

test('native initialization does not acquire controlled React switches or tabs', async () => {
  await mount('Switch', { checked: false, label: 'Notifications' });
  assert.equal(await page.getByRole('switch', { name: 'Notifications' }).evaluate((node) => node.hasAttribute('data-db-react')), true);
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<div id="native-switch" class="db-switch" role="switch" aria-checked="false" tabindex="0">Native switch</div>');
  });
  await page.addScriptTag({ content: nativeScript });
  await page.evaluate(() => { window.DAUB.init(); window.DAUB.init(); });
  await page.getByRole('switch', { name: 'Notifications' }).click();
  assert.equal(await page.getByRole('switch', { name: 'Notifications' }).getAttribute('aria-checked'), 'false');
  assert.deepEqual(await events(), [true]);
  await mount('Tabs', { tabs, activeTab: 0 });
  await page.evaluate(() => window.DAUB.init());
  await page.getByRole('tab', { name: 'Security' }).click();
  assert.equal(await page.getByRole('tab', { name: 'Account' }).getAttribute('aria-selected'), 'true');
  assert.deepEqual(await events(), [true, 1]);
  await page.locator('#native-switch').click();
  assert.equal(await page.locator('#native-switch').getAttribute('aria-checked'), 'true');
});

test('CommandPalette filters, skips disabled commands, resets on reopen and reports keyboard actions', async () => {
  await mount('Commands');
  const input = page.getByRole('combobox', { name: 'Search commands' });
  assert.equal(await page.getByRole('dialog', { name: 'Commands' }).isVisible(), true);
  await input.press('ArrowDown');
  assert.equal(await page.getByRole('option', { name: 'Save', exact: true }).getAttribute('id'), await input.getAttribute('aria-activedescendant'));
  await input.press('ArrowUp');
  assert.equal(await page.getByRole('option', { name: 'Delete' }).getAttribute('id'), await input.getAttribute('aria-activedescendant'));
  await input.press('Enter');
  assert.deepEqual(await events(), ['delete', 'close']);
  await input.fill('missing');
  assert.equal(await page.getByRole('status').textContent(), 'No commands found');
  await mount('Commands', { open: false });
  assert.equal(await page.getByRole('combobox').count(), 0);
  await mount('Commands');
  await input.waitFor({ state: 'visible' });
  assert.equal(await input.inputValue(), '');
  assert.equal(await page.getByRole('option').count(), 3);
});

for (const kind of ['Modal', 'AlertDialog', 'Sheet', 'Drawer', 'CommandPalette']) {
  test(`${kind} forwards its panel ref and accepts caller-provided accessible names`, async () => {
    await mount('RefOverlay', { kind, title: kind === 'AlertDialog' ? 'Fallback title' : undefined, 'aria-label': 'Named overlay', id: 'named-panel' });
    const dialog = page.getByRole(kind === 'AlertDialog' ? 'alertdialog' : 'dialog', { name: 'Named overlay', exact: true });
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await dialog.getAttribute('id'), 'named-panel');
    assert.equal(await dialog.evaluate((node) => node === window.refs.panel), true);
    assert.equal(await dialog.evaluate((node) => node.closest('[data-db-react]') !== null), true);
  });
}

for (const kind of ['PreviewCard', 'Tooltip']) {
  test(`${kind} links descriptions and dismisses its focused content`, async () => {
    await mount(kind);
    const trigger = page.getByRole('button', { name: kind === 'Tooltip' ? 'Tooltip target' : 'Profile' });
    await trigger.focus();
    const content = kind === 'Tooltip' ? page.getByRole('tooltip') : page.getByText('Preview description');
    assert.equal(await content.isVisible(), true);
    assert.ok((await trigger.getAttribute('aria-describedby')).includes('old-description'));
    await trigger.press('Escape');
    assert.equal(await content.count(), 0);
  });
}

test('nested tooltips and menus consume Escape before their modal', async () => {
  await mount('Modal', { tooltip: true, dropdown: true });
  await page.locator('#opener').click();
  await page.getByRole('button', { name: 'Tooltip target' }).focus();
  assert.equal(await page.getByRole('tooltip').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.equal(await page.getByRole('tooltip').count(), 0);
  await page.getByRole('button', { name: 'Actions' }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('menu').count(), 0);
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.deepEqual(await events(), []);
});

test('owned menus, selects and modal portals survive repeated native initialization', async () => {
  await mount('DropdownMenu');
  await page.addScriptTag({ content: nativeScript });
  await page.evaluate(() => { window.DAUB.init(); window.DAUB.init(); });
  await page.getByRole('button', { name: 'Actions' }).click();
  assert.equal(await page.getByRole('menu').isVisible(), true);
  await page.keyboard.press('Escape');
  await mount('CustomSelect', { options, searchable: true, value: 'b', 'aria-label': 'Fruit' });
  await page.evaluate(() => window.DAUB.init());
  await page.getByRole('combobox', { name: 'Fruit' }).click();
  await page.getByRole('textbox').fill('ch');
  await page.getByRole('option', { name: 'Cherry' }).click();
  assert.equal(await page.getByRole('combobox').textContent(), 'Banana');
  assert.deepEqual(await events(), ['trigger', 'c']);
  await mount('Modal');
  await page.locator('#opener').click();
  await page.evaluate(() => window.DAUB.init());
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
  assert.deepEqual(await events(), ['trigger', 'c', 'close']);
});

test('React modals isolate background siblings and restore prior inert state', async () => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<aside id="background"><button>Outside</button></aside><aside id="inert-background" inert>Inert before opening</aside>');
  });
  await mount('Modal');
  await page.locator('#opener').click();
  assert.equal(await page.locator('#root').evaluate((node) => node.inert), true);
  assert.equal(await page.locator('#background').evaluate((node) => node.inert), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#root').evaluate((node) => node.inert), false);
  assert.equal(await page.locator('#background').evaluate((node) => node.inert), false);
  assert.equal(await page.locator('#inert-background').evaluate((node) => node.inert), true);
});

test('forwarded panel refs execute returned cleanup callbacks on unmount', async () => {
  await mount('RefCleanup');
  assert.equal(await page.getByRole('dialog').evaluate((node) => window.refs.panel === node), true);
  await mount('Popover');
  assert.equal(await page.evaluate(() => window.refs.panel), null);
  assert.deepEqual(await events(), ['panel-cleanup']);
});

test('trigger slots retain consumer key/click handlers and ref cleanup', async () => {
  await mount('TriggerCallbacks', { cancel: true });
  const trigger = page.getByRole('button', { name: 'Actions' });
  assert.equal(await trigger.evaluate((node) => window.refs.trigger === node), true);
  await trigger.press('ArrowDown');
  assert.equal(await page.getByRole('menu').count(), 0);
  await trigger.click();
  assert.deepEqual(await events(), ['ArrowDown', 'click']);
  assert.equal(await page.getByRole('menu').count(), 0);
  await mount('Popover');
  assert.equal(await page.evaluate(() => window.refs.trigger), null);
  assert.deepEqual(await events(), ['ArrowDown', 'click', 'trigger-cleanup']);
});

test('CommandPalette honors consumer keyboard cancellation before command selection', async () => {
  await mount('Commands', { cancel: true });
  const input = page.getByRole('combobox');
  await input.press('ArrowDown');
  assert.equal(await input.getAttribute('aria-activedescendant'), null);
  await input.press('Enter');
  assert.deepEqual(await events(), []);
});

test('fragment-wrapped triggers preserve native ids and menu semantics', async () => {
  await mount('DropdownMenu', { fragment: true });
  const trigger = page.getByRole('button', { name: 'Actions' });
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.getByRole('menu').getAttribute('aria-labelledby'), 'fragment-trigger');
  await page.keyboard.press('Escape');
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
});

test('destructive alert confirmations use the supported native button class', async () => {
  await mount('RefOverlay', { kind: 'AlertDialog', title: 'Delete profile', variant: 'danger', confirmLabel: 'Delete profile' });
  const confirm = page.getByRole('button', { name: 'Delete profile', exact: true });
  assert.equal(await confirm.evaluate((node) => node.classList.contains('db-btn--primary')), true);
  assert.equal(await confirm.evaluate((node) => node.classList.contains('db-btn--danger')), false);
});
