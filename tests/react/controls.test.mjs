import assert from 'node:assert/strict';
import { before, beforeEach, after, afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const reactRequire = createRequire(new URL('../../react/package.json', import.meta.url));
const { build } = reactRequire('esbuild');
const { chromium } = require('playwright');
const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
let browser, page, script, errors;

before(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./controls-fixture.tsx', import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    nodePaths: [fileURLToPath(new URL('../../react/node_modules', import.meta.url))],
  });
  script = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(2000);
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://daub-controls.test/**', (route) => route.fulfill({
    contentType: 'text/html', body: '<html data-theme="github"><body style="padding:16px"><div id="root"></div></body></html>',
  }));
  await page.goto('http://daub-controls.test/');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
});
afterEach(async () => { await page?.close(); assert.deepEqual(errors, [], 'React/browser errors'); });
after(async () => { await browser?.close(); });

const mount = (kind, props = {}) => page.evaluate(({ kind, props }) => window.mountControls(kind, props), { kind, props });
const events = () => page.evaluate(() => window.events);
const slotValues = () => page.locator('.db-otp__slot').evaluateAll((nodes) => nodes.map((node) => node.value));
const clickCheckbox = (name) => page.getByRole('checkbox', name ? { name } : {}).locator('..').click();
const resetForm = () => page.evaluate(() => document.querySelector('form').reset());
const paste = (slot, text) => slot.evaluate((node, text) => {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text', text);
  node.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
}, text);

test('Button renders icons, preserves its loading name, and defaults to a non-submit type', async () => {
  await mount('Button', { children: 'Save', icon: 'save', loading: true });
  const button = page.getByRole('button', { name: 'Save', exact: true });
  assert.equal(await button.getAttribute('aria-busy'), 'true');
  assert.equal(await button.isDisabled(), true);
  assert.equal(await button.getAttribute('type'), 'button');
  assert.equal(await button.locator('[data-lucide="save"][aria-hidden="true"]').count(), 1);
  await mount('Button', { children: 'Save', loading: false, nodeIcon: true });
  assert.equal(await button.locator('[data-testid="node-icon"]').count(), 1);
  await button.click();
  assert.deepEqual(await events(), []);
  await mount('Button', { children: 'Save', type: 'submit' });
  await button.click();
  assert.deepEqual(await events(), ['submit']);
});

test('ButtonGroup and multi-key Kbd preserve native semantics and props', async () => {
  await mount('ButtonGroup', { 'aria-label': 'Actions', children: 'Actions' });
  assert.equal(await page.getByRole('group', { name: 'Actions' }).count(), 1);
  await mount('Kbd', { keys: ['Ctrl', 'K'], id: 'shortcut', title: 'Search', 'aria-label': 'Control K' });
  assert.equal(await page.locator('#shortcut').getAttribute('title'), 'Search');
  assert.equal(await page.locator('#shortcut').getAttribute('aria-label'), 'Control K');
});

test('Field links nested labels and merged helper/error descriptions to the input', async () => {
  await mount('Field', { label: 'Email', error: 'Enter a valid email', nested: true, controlProps: { id: 'email', 'aria-describedby': 'external-help' } });
  const input = page.getByRole('textbox', { name: 'Email', exact: true });
  assert.equal(await input.getAttribute('id'), 'email');
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  const descriptions = await input.getAttribute('aria-describedby');
  assert.equal(descriptions.split(' ').length, 2);
  assert.equal(await page.locator('label.db-label').getAttribute('for'), 'email');
  assert.equal(await page.locator('.db-field__helper').getAttribute('id'), descriptions.split(' ')[1]);
  assert.equal(await page.locator('.db-input-icon > span').getAttribute('aria-hidden'), 'true');
  await page.getByText('Email', { exact: true }).click();
  assert.equal(await input.evaluate((node) => node === document.activeElement), true);
});

test('Input and Textarea expose error state while honoring explicit aria-invalid', async () => {
  for (const kind of ['Input', 'Textarea']) {
    await mount(kind, { error: true, 'aria-label': 'Entry' });
    assert.equal(await page.getByRole('textbox', { name: 'Entry' }).getAttribute('aria-invalid'), 'true');
    await mount(kind, { error: true, 'aria-invalid': false, 'aria-label': 'Entry' });
    assert.equal(await page.getByRole('textbox', { name: 'Entry' }).getAttribute('aria-invalid'), 'false');
  }
});

test('OTP filters pasted digits and distributes them across named slots', async () => {
  await mount('InputOTP', { length: 4, 'aria-label': 'Verification code' });
  await paste(page.locator('.db-otp__slot').first(), '1a2 3-4');
  assert.deepEqual(await slotValues(), ['1', '2', '3', '4']);
  assert.deepEqual(await events(), ['1234']);
  assert.equal(await page.getByRole('textbox', { name: 'Digit 1 of 4', exact: true }).count(), 1);
  assert.equal(await page.locator('.db-otp__slot').last().evaluate((node) => node === document.activeElement), true);
});

test('OTP clearing a middle slot preserves later digits', async () => {
  await mount('InputOTP', { length: 4, defaultValue: '1234' });
  await page.locator('.db-otp__slot').nth(1).press('Backspace');
  assert.deepEqual(await slotValues(), ['1', '', '3', '4']);
  await page.locator('.db-otp__slot').nth(1).fill('9');
  assert.deepEqual(await slotValues(), ['1', '9', '3', '4']);
  assert.deepEqual(await events(), ['134', '1934']);
});

test('OTP keeps controlled requests separate from supplied state', async () => {
  await mount('InputOTP', { length: 4, value: '1234' });
  await page.locator('.db-otp__slot').nth(1).press('Backspace');
  assert.deepEqual(await slotValues(), ['1', '2', '3', '4']);
  assert.deepEqual(await events(), ['134']);
  await mount('InputOTP', { length: 4, value: '9876' });
  assert.deepEqual(await slotValues(), ['9', '8', '7', '6']);
});

test('ToggleGroup coordinates single selection and controlled change requests', async () => {
  await mount('ToggleGroup', { defaultValue: 'a', 'aria-label': 'Format' });
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Beta' }).click();
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'true');
  await mount('ToggleGroup', { value: 'a' });
  await page.getByRole('button', { name: 'Beta' }).click();
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await events(), ['b', 'b']);
});

test('CheckboxGroup associates labels/helpers and coordinates controlled values', async () => {
  await mount('CheckboxGroup', { label: 'Channels', helper: 'Choose channels', value: ['a'] });
  const group = page.getByRole('group', { name: 'Channels' });
  assert.equal(await group.count(), 1);
  assert.ok(await group.getAttribute('aria-describedby'));
  await clickCheckbox('Beta');
  assert.equal(await page.getByRole('checkbox', { name: 'Beta' }).isChecked(), false);
  assert.equal(await page.getByRole('checkbox', { name: 'Alpha' }).isChecked(), true);
  assert.deepEqual(await events(), [['a', 'b']]);
});

test('RadioGroup supplies a unique native name and skips disabled options with arrow keys', async () => {
  await mount('RadioGroup', { defaultValue: 'a', options: [{ label: 'Alpha', value: 'a' }, { label: 'Beta', value: 'b', disabled: true }, { label: 'Gamma', value: 'c' }] });
  const radios = page.getByRole('radio');
  const names = await radios.evaluateAll((nodes) => nodes.map((node) => node.name));
  assert.ok(names[0]);
  assert.equal(new Set(names).size, 1);
  await radios.first().press('ArrowRight');
  assert.equal(await page.getByRole('radio', { name: 'Gamma' }).isChecked(), true);
  assert.deepEqual(await events(), ['c']);
});

test('Pagination clamps invalid bounds and never submits an enclosing form', async () => {
  await mount('Pagination', { current: 99, total: 20, perPage: 10 });
  assert.equal(await page.getByRole('button', { name: 'Next page' }).isDisabled(), true);
  assert.equal(await page.locator('[aria-current="page"]').textContent(), '2');
  await page.getByRole('button', { name: 'Previous page' }).click();
  assert.deepEqual(await events(), [1]);
  await mount('Pagination', { current: -1, total: 20, perPage: 0 });
  assert.equal(await page.getByRole('button', { name: 'Previous page' }).isDisabled(), true);
  assert.equal(await page.locator('[aria-current="page"]').textContent(), '1');
});

test('Toolbar maps orientation and moves focus around disabled or hidden controls', async () => {
  await mount('Toolbar', { vertical: true, 'aria-label': 'Editor' });
  assert.equal(await page.getByRole('toolbar').getAttribute('aria-orientation'), 'vertical');
  await page.getByRole('button', { name: 'Alpha' }).focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByRole('button', { name: 'Beta' }).evaluate((node) => node === document.activeElement), true);
  await page.keyboard.press('Home');
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).evaluate((node) => node === document.activeElement), true);
  assert.deepEqual(await events(), ['ArrowDown', 'Home']);
});

test('Calendar labels dates, exposes selection, and moves focus across month boundaries', async () => {
  await mount('Calendar', { selected: '2026-10-31', month: '2026-10-01' });
  const selected = page.locator('.db-calendar__day--selected');
  assert.equal(await selected.getAttribute('aria-selected'), 'true');
  assert.match(await selected.getAttribute('aria-label'), /October.*31.*2026/);
  await selected.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-date')), '2026-11-01');
  await page.keyboard.press('Enter');
  assert.deepEqual(await events(), ['2026-11-01']);
  assert.equal(await page.getByRole('button', { name: 'Previous month' }).count(), 1);
});

test('Calendar responds to a month prop update without discarding local navigation', async () => {
  await mount('Calendar', { month: '2026-10-01' });
  await mount('Calendar', { month: '2027-01-01' });
  assert.match(await page.locator('.db-calendar__title').textContent(), /January 2027/);
});

test('DatePicker opens with keyboard and native CSS, then restores focus after Escape', async () => {
  await mount('DatePicker', { label: 'Appointment', defaultValue: '2026-10-06' });
  const input = page.getByRole('combobox', { name: 'Appointment' });
  await input.press('ArrowDown');
  assert.equal(await input.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.getByRole('dialog', { name: 'Appointment' }).isVisible(), true);
  assert.equal(await page.locator('.db-calendar__day--selected').evaluate((node) => node === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  assert.equal(await input.evaluate((node) => node === document.activeElement), true);
});

test('NumberField permits an empty draft and clamps typed bounds on blur', async () => {
  await mount('NumberField', { defaultValue: 5, min: 1, max: 10 });
  const input = page.getByRole('spinbutton');
  await input.fill('');
  assert.equal(await input.inputValue(), '');
  assert.deepEqual(await events(), []);
  await input.fill('20');
  assert.equal(await input.inputValue(), '20');
  await page.locator('#outside').click();
  assert.equal(await input.inputValue(), '10');
  assert.deepEqual(await events(), [10, 'blur']);
});

test('Navbar exposes a React mobile toggle and a non-link brand without href', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mount('Navbar');
  assert.equal(await page.getByRole('link', { name: 'DAUB' }).count(), 0);
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  assert.equal(await toggle.isVisible(), true);
  assert.equal(await page.getByRole('link', { name: 'Account' }).isVisible(), false);
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.getByRole('link', { name: 'Account' }).isVisible(), true);
  await page.getByRole('link', { name: 'Account' }).press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await toggle.evaluate((node) => node === document.activeElement), true);
});

test('ToggleGroup supports legacy multiple strings and the additive array API', async () => {
  await mount('ToggleGroup', { multiple: true, defaultValue: 'a' });
  await page.getByRole('button', { name: 'Beta' }).click();
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Alpha' }).click();
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'false');
  await mount('ToggleGroup', { multiple: true, values: ['a'] });
  await page.getByRole('button', { name: 'Beta' }).click();
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.getByRole('button', { name: 'Gamma' }).isDisabled(), true);
  assert.deepEqual(await events(), [
    { values: ['a', 'b'] }, 'a,b', { a: false }, { values: ['b'] }, 'b', { values: ['a', 'b'] }, 'a,b',
  ]);
});

test('CheckboxGroup supports uncontrolled changes, child callbacks, and group disabling', async () => {
  await mount('CheckboxGroup', { defaultValue: ['b'] });
  await clickCheckbox('Alpha');
  assert.equal(await page.getByRole('checkbox', { name: 'Alpha' }).isChecked(), true);
  assert.equal(await page.getByRole('checkbox', { name: 'Beta' }).isChecked(), true);
  assert.deepEqual(await events(), [{ a: true }, ['b', 'a']]);
  await mount('CheckboxGroup', { disabled: true });
  assert.deepEqual(await page.getByRole('checkbox').evaluateAll((nodes) => nodes.map((node) => node.disabled)), [true, true, true]);
});

test('Checkbox exposes indeterminate state and preserves its native ref', async () => {
  await mount('Checkbox', { label: 'Select all', indeterminate: true });
  const checkbox = page.getByRole('checkbox', { name: 'Select all' });
  assert.equal(await checkbox.evaluate((node) => node.indeterminate), true);
  assert.equal(await checkbox.getAttribute('aria-checked'), 'mixed');
  assert.equal(await checkbox.evaluate((node) => window.refs.control === node), true);
  await clickCheckbox('Select all');
  assert.deepEqual(await events(), [true]);
});

test('OTP handles numeric typing, autofill-sized input, and disabled/read-only states', async () => {
  await mount('InputOTP', { length: 4, name: 'otp' });
  const first = page.locator('.db-otp__slot').first();
  await first.fill('a');
  assert.deepEqual(await slotValues(), ['', '', '', '']);
  await first.fill('9876');
  assert.deepEqual(await slotValues(), ['9', '8', '7', '6']);
  assert.equal(await page.evaluate(() => new FormData(document.querySelector('form')).get('otp')), '9876');
  await page.locator('.db-otp__slot').nth(2).press('Delete');
  assert.deepEqual(await slotValues(), ['9', '8', '', '6']);
  await page.keyboard.press('Home');
  assert.equal(await first.evaluate((node) => node === document.activeElement), true);
  for (const prop of ['disabled', 'readOnly']) {
    await mount('InputOTP', { length: 4, value: '1234', [prop]: true });
    await paste(first, '9876');
    assert.deepEqual(await slotValues(), ['1', '2', '3', '4']);
  }
  assert.deepEqual(await events(), ['9876', '986']);
});

test('Field links textarea and number controls without changing their ref targets', async () => {
  for (const control of ['Textarea', 'NumberField']) {
    await mount('Field', { control, label: 'Entry', helper: 'Hint' });
    const input = page.getByLabel('Entry', { exact: true });
    assert.equal(await input.count(), 1);
    assert.equal(await input.evaluate((node) => node === window.refs.control), true);
    assert.ok(await input.getAttribute('aria-describedby'));
  }
});

test('Label keeps htmlFor and caller attributes with required and optional indicators', async () => {
  await mount('Label', { required: true, 'data-testid': 'account-label' });
  assert.equal(await page.getByTestId('account-label').getAttribute('for'), 'label-input');
  await page.getByTestId('account-label').click();
  assert.equal(await page.locator('#label-input').evaluate((node) => node === document.activeElement), true);
  await mount('Label', { optional: true });
  assert.match(await page.locator('label').textContent(), /optional/);
});

test('Tabs supports named vertical lists, disabled skipping, and invalid selection fallback', async () => {
  const tabs = [{ label: 'Alpha', content: 'A' }, { label: 'Beta', content: 'B', disabled: true }, { label: 'Gamma', content: 'C' }];
  await mount('Tabs', { tabs, activeTab: 99, orientation: 'vertical', tabListProps: { 'aria-label': 'Settings' } });
  assert.equal(await page.getByRole('tablist', { name: 'Settings' }).getAttribute('aria-orientation'), 'vertical');
  assert.equal(await page.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tab', { name: 'Beta' }).isDisabled(), true);
  await page.getByRole('tab', { name: 'Alpha' }).press('ArrowDown');
  assert.equal(await page.getByRole('tab', { name: 'Gamma' }).evaluate((node) => node === document.activeElement), true);
  assert.deepEqual(await events(), [2]);
  await mount('Tabs', { tabs: tabs.map((tab) => ({ ...tab, disabled: true })) });
  assert.deepEqual(await page.getByRole('tab').evaluateAll((nodes) => nodes.map((node) => node.tabIndex)), [-1, -1, -1]);
});

test('Slider forwards form integration and native input props without changing its ref', async () => {
  await mount('Slider', { label: 'Volume', name: 'volume', defaultValue: 25, inputProps: { id: 'volume-range', 'aria-describedby': 'volume-hint' } });
  const input = page.getByRole('slider', { name: 'Volume' });
  assert.equal(await input.getAttribute('id'), 'volume-range');
  assert.equal(await input.getAttribute('aria-describedby'), 'volume-hint');
  assert.equal(await input.evaluate((node) => node === window.refs.control), true);
  assert.equal(await page.evaluate(() => new FormData(document.querySelector('form')).get('volume')), '25');
});

test('Calendar keyboard month/year moves clamp day-of-month and respect limits', async () => {
  await mount('Calendar', { defaultSelected: '2026-01-31', min: '2026-01-01', max: '2026-03-31' });
  await page.locator('[data-date="2026-01-31"]').focus();
  await page.keyboard.press('PageDown');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.date), '2026-02-28');
  await page.keyboard.press('Shift+PageDown');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.date), '2026-03-31');
  assert.equal(await page.getByRole('button', { name: 'Next month' }).isDisabled(), true);
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.date), '2026-03-29');
  await page.keyboard.press('Space');
  assert.deepEqual(await events(), ['2026-03-29']);
  await mount('Calendar', { disabled: true });
  assert.equal(await page.locator('.db-calendar button:enabled').count(), 0);
});

test('DatePicker selection closes the dropdown and submits the selected native value', async () => {
  await mount('DatePicker', { label: 'Appointment', name: 'date', defaultValue: '2026-10-06' });
  const input = page.getByRole('combobox', { name: 'Appointment' });
  await input.click();
  await page.locator('[data-date="2026-10-08"]').click();
  assert.equal(await input.inputValue(), '2026-10-08');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  assert.equal(await input.evaluate((node) => node === document.activeElement), true);
  assert.equal(await page.evaluate(() => new FormData(document.querySelector('form')).get('date')), '2026-10-08');
  assert.deepEqual(await events(), ['2026-10-08']);
});

test('DatePicker keeps controlled requests, disabled state, and outside/Tab dismissal', async () => {
  await mount('DatePicker', { label: 'Appointment', value: '2026-10-06' });
  const input = page.getByRole('combobox', { name: 'Appointment' });
  await input.press('Enter');
  await page.locator('[data-date="2026-10-08"]').click();
  assert.equal(await input.inputValue(), '2026-10-06');
  await input.click();
  await page.locator('#outside').click();
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  await input.click();
  await page.locator('.db-calendar__day[tabindex="0"]').focus();
  await page.keyboard.press('Tab');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  await mount('DatePicker', { label: 'Appointment', disabled: true });
  assert.equal(await input.isDisabled(), true);
  assert.deepEqual(await events(), ['2026-10-08']);
});

test('Toolbar composes cancellation and has one keyboard tab stop', async () => {
  await mount('Toolbar', { 'data-cancel': true });
  await page.getByRole('button', { name: 'Alpha' }).press('ArrowRight');
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).evaluate((node) => node === document.activeElement), true);
  assert.deepEqual(await page.locator('.db-toolbar button:not([disabled]):not([hidden])').evaluateAll((nodes) => nodes.map((node) => node.tabIndex)), [0, -1]);
  assert.deepEqual(await events(), ['ArrowRight']);
});

test('disabled Pagination cannot request a page change', async () => {
  await mount('Pagination', { current: 2, total: 100, disabled: true });
  assert.equal(await page.locator('.db-pagination button:enabled').count(), 0);
  assert.deepEqual(await events(), []);
});

test('NumberField restores an empty draft and keeps controlled valid edits as requests', async () => {
  await mount('NumberField', { value: 5, min: 1, max: 10 });
  const input = page.getByRole('spinbutton');
  await input.fill('6');
  assert.equal(await input.inputValue(), '5');
  await input.fill('');
  await page.locator('#outside').click();
  assert.equal(await input.inputValue(), '5');
  assert.deepEqual(await events(), [6, 'blur']);
});

test('interactive roots mark React ownership for native initialization', async () => {
  const roots = {
    Button: '.db-btn', ButtonGroup: '.db-btn-group', Field: '.db-field', Input: '.db-input', Textarea: '.db-textarea',
    InputOTP: '.db-otp', Checkbox: '.db-checkbox', Toggle: '.db-toggle', CheckboxGroup: '.db-checkbox-group', RadioGroup: '.db-radio-group',
    ToggleGroup: '.db-toggle-group', Pagination: '.db-pagination', Tabs: '.db-tabs', Slider: '.db-slider', Select: '.db-select',
    NumberField: '.db-number-field', Toolbar: '.db-toolbar', Calendar: '.db-calendar', DatePicker: '.db-date-picker', Navbar: '.db-navbar',
  };
  for (const [kind, selector] of Object.entries(roots)) {
    await mount(kind, kind === 'Tabs' ? { tabs: [] } : kind === 'Pagination' ? { current: 1, total: 0 } : {});
    assert.equal(await page.locator(selector).first().getAttribute('data-db-react'), '', kind);
  }
});

test('native initialization leaves controlled groups, OTP, and calendar markup under React ownership', async () => {
  await mount('ToggleGroup', { value: 'a' });
  await page.addScriptTag({ content: readFileSync(new URL('../../daub.js', import.meta.url), 'utf8') });
  await page.evaluate(() => { window.DAUB.init(); window.DAUB.init(); });
  await page.getByRole('button', { name: 'Beta' }).click();
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'false');
  await mount('InputOTP', { length: 4, value: '1234' });
  await page.evaluate(() => window.DAUB.init());
  await page.locator('.db-otp__slot').nth(1).press('Backspace');
  assert.deepEqual(await slotValues(), ['1', '2', '3', '4']);
  await mount('Calendar', { month: '2026-10-01', selected: '2026-10-06' });
  await page.evaluate(() => window.DAUB.init());
  assert.equal(await page.locator('[data-date="2026-10-06"]').getAttribute('aria-selected'), 'true');
  await page.locator('[data-date="2026-10-08"]').click();
  assert.equal(await page.locator('[data-date="2026-10-06"]').getAttribute('aria-selected'), 'true');
  assert.deepEqual(await events(), ['b', '134', '2026-10-08']);
});

test('Calendar and DatePicker fit narrow and desktop viewports with native CSS', async () => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await mount('Calendar', { month: '2026-10-01' });
    const calendar = await page.locator('.db-calendar').boundingBox();
    assert.ok(calendar.x >= 0 && calendar.x + calendar.width <= width, `Calendar at ${width}`);
    await mount('DatePicker', { label: 'Appointment', defaultValue: '2026-10-06' });
    await page.getByRole('combobox', { name: 'Appointment' }).press('ArrowDown');
    const picker = await page.getByRole('dialog').boundingBox();
    assert.ok(picker.x >= 0 && picker.x + picker.width <= width, `DatePicker at ${width}`);
    assert.equal(await page.locator('.db-calendar__day[tabindex="0"]').isVisible(), true);
  }
});

test('Calendar gives its selected date the single grid tab stop after a month update', async () => {
  await mount('Calendar', { month: '2026-10-01', selected: '2026-10-31' });
  assert.equal(await page.locator('.db-calendar__day[tabindex="0"]').getAttribute('data-date'), '2026-10-31');
  await mount('Calendar', { month: '2026-11-01', selected: '2026-11-20' });
  assert.equal(await page.locator('.db-calendar__day[tabindex="0"]').getAttribute('data-date'), '2026-11-20');
});

test('controlled Checkbox keeps its indeterminate DOM state after an unaccepted click', async () => {
  await mount('Checkbox', { label: 'Select all', checked: false, indeterminate: true });
  await clickCheckbox('Select all');
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  assert.equal(await page.getByRole('checkbox').evaluate((node) => node.indeterminate), true);
  assert.deepEqual(await events(), [true]);
});

test('OTP composes consumer keyboard/paste cancellation before changing slots', async () => {
  await mount('InputOTP', { length: 4, defaultValue: '1234', 'data-cancel': true });
  await page.locator('.db-otp__slot').nth(1).press('Backspace');
  await paste(page.locator('.db-otp__slot').first(), '9876');
  assert.deepEqual(await slotValues(), ['1', '2', '3', '4']);
  assert.deepEqual(await events(), ['Backspace', 'paste']);
});

test('Checkbox uses the native hidden-input class and displays its checked indicator', async () => {
  await mount('Checkbox', { label: 'Notifications', defaultChecked: false });
  const checkbox = page.getByRole('checkbox', { name: 'Notifications' });
  assert.equal(await checkbox.getAttribute('class'), 'db-checkbox__input');
  assert.deepEqual(await checkbox.evaluate((node) => {
    const style = getComputedStyle(node);
    return { opacity: style.opacity, width: style.width, height: style.height, position: style.position };
  }), { opacity: '0', width: '0px', height: '0px', position: 'absolute' });
  const tick = page.locator('.db-checkbox__box svg');
  assert.equal(await tick.getAttribute('aria-hidden'), 'true');
  assert.equal(await tick.evaluate((node) => getComputedStyle(node).opacity), '0');
  await clickCheckbox('Notifications');
  assert.equal(await checkbox.isChecked(), true);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.db-checkbox__box svg')).opacity === '1');
  assert.match(await page.locator('.db-checkbox__box').evaluate((node) => getComputedStyle(node).backgroundImage), /linear-gradient/);
});

test('CheckboxGroup coordinates fragment, DOM, and child-bearing custom wrappers', async () => {
  await mount('CheckboxGroup', { nested: true, defaultValue: ['a'] });
  assert.equal(await page.getByRole('checkbox', { name: 'Alpha' }).isChecked(), true);
  await clickCheckbox('Beta');
  assert.equal(await page.getByRole('checkbox', { name: 'Beta' }).isChecked(), true);
  await clickCheckbox('Alpha');
  assert.deepEqual(await events(), [['a', 'b'], { a: false }, ['b']]);
  await mount('CheckboxGroup', { nested: true, value: ['a'] });
  await clickCheckbox('Beta');
  assert.equal(await page.getByRole('checkbox', { name: 'Beta' }).isChecked(), false);
  await mount('CheckboxGroup', { nested: true, disabled: true });
  assert.equal(await page.locator('.db-checkbox input:enabled').count(), 0);
  await mount('CheckboxGroup', { nested: true, disabled: false, value: ['a'], cancelChild: true });
  await clickCheckbox('Beta');
  assert.equal(await page.getByRole('checkbox', { name: 'Beta' }).isChecked(), false);
  assert.deepEqual(await events(), [['a', 'b'], { a: false }, ['b'], ['a', 'b'], 'child-click']);
});

test('ToggleGroup coordinates fragment, DOM, and child-bearing custom wrappers', async () => {
  await mount('ToggleGroup', { nested: true, defaultValue: 'a' });
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Beta' }).click();
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'true');
  await mount('ToggleGroup', { nested: true, value: 'a' });
  await page.getByRole('button', { name: 'Beta' }).click();
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'true');
  await mount('ToggleGroup', { nested: true, disabled: true });
  assert.equal(await page.locator('.db-toggle:enabled').count(), 0);
  await mount('ToggleGroup', { nested: true, disabled: false, value: 'a', cancelChild: true });
  await page.getByRole('button', { name: 'Beta' }).click();
  assert.deepEqual(await events(), ['b', 'b', 'child-click']);
});

test('uncontrolled Checkbox resets to its default without emitting a change request', async () => {
  await mount('Checkbox', { label: 'Notifications', defaultChecked: true });
  await clickCheckbox('Notifications');
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  await resetForm();
  await mount('Checkbox', { label: 'Notifications', defaultChecked: true });
  assert.equal(await page.getByRole('checkbox').isChecked(), true);
  assert.deepEqual(await events(), [false]);
});

test('uncontrolled OTP resets slots and submitted form value to its default', async () => {
  await mount('InputOTP', { length: 4, defaultValue: '1234', name: 'otp' });
  await paste(page.locator('.db-otp__slot').first(), '9876');
  await page.locator('.db-otp__slot').nth(1).press('Delete');
  await resetForm();
  await mount('InputOTP', { length: 4, defaultValue: '1234', name: 'otp' });
  assert.deepEqual(await slotValues(), ['1', '2', '3', '4']);
  assert.equal(await page.evaluate(() => new FormData(document.querySelector('form')).get('otp')), '1234');
  assert.deepEqual(await events(), ['9876', '976']);
});

test('uncontrolled CheckboxGroup resets its wrapped selection to default values', async () => {
  await mount('CheckboxGroup', { nested: true, defaultValue: ['a'] });
  await clickCheckbox('Beta');
  await resetForm();
  await mount('CheckboxGroup', { nested: true, defaultValue: ['a'] });
  assert.equal(await page.getByRole('checkbox', { name: 'Alpha' }).isChecked(), true);
  assert.equal(await page.getByRole('checkbox', { name: 'Beta' }).isChecked(), false);
  assert.deepEqual(await events(), [['a', 'b']]);
});

test('uncontrolled ToggleGroup resets both legacy strings and array selections', async () => {
  await mount('ToggleGroup', { nested: true, defaultValue: 'a' });
  await page.getByRole('button', { name: 'Beta' }).click();
  await resetForm();
  await page.waitForFunction(() => document.querySelector('.db-toggle[value="a"]').getAttribute('aria-pressed') === 'true' && document.querySelector('.db-toggle[value="b"]').getAttribute('aria-pressed') === 'false');
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'false');
  await mount('ToggleGroup', { nested: true, multiple: true, defaultValues: ['a'] });
  await page.getByRole('button', { name: 'Beta' }).click();
  await resetForm();
  await page.waitForFunction(() => document.querySelector('.db-toggle[value="a"]').getAttribute('aria-pressed') === 'true' && document.querySelector('.db-toggle[value="b"]').getAttribute('aria-pressed') === 'false');
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'false');
  assert.deepEqual(await events(), ['b', { values: ['a', 'b'] }, 'a,b']);
});

test('form reset leaves supplied controlled Checkbox, OTP, and group values unchanged', async () => {
  await mount('Checkbox', { checked: true, defaultChecked: false, label: 'Notifications' });
  await resetForm();
  assert.equal(await page.getByRole('checkbox').isChecked(), true);
  await mount('InputOTP', { length: 4, value: '9876', defaultValue: '1234' });
  await resetForm();
  assert.deepEqual(await slotValues(), ['9', '8', '7', '6']);
  await mount('CheckboxGroup', { nested: true, value: ['b'], defaultValue: ['a'] });
  await resetForm();
  assert.equal(await page.getByRole('checkbox', { name: 'Beta' }).isChecked(), true);
  assert.equal(await page.getByRole('checkbox', { name: 'Alpha' }).isChecked(), false);
  await mount('ToggleGroup', { nested: true, value: 'b', defaultValue: 'a' });
  await resetForm();
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await events(), []);
});

test('cancelled form reset preserves uncontrolled selection', async () => {
  await mount('Checkbox', { label: 'Notifications', defaultChecked: true, cancelReset: true });
  await clickCheckbox('Notifications');
  await resetForm();
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  assert.deepEqual(await events(), [false]);
});

test('OTP retains legacy slot hooks while matching native dimensions and focus styling', async () => {
  await page.setViewportSize({ width: 390, height: 900 });
  await mount('InputOTP', { length: 6, defaultValue: '123456' });
  const slot = page.locator('.db-otp__slot').first();
  assert.equal(await slot.evaluate((node) => node.classList.contains('db-otp__input')), true);
  assert.deepEqual(await slot.evaluate((node) => {
    const style = getComputedStyle(node);
    return { width: style.width, height: style.height, textAlign: style.textAlign, fontSize: style.fontSize };
  }), { width: '40px', height: '48px', textAlign: 'center', fontSize: '20px' });
  const beforeFocus = await slot.evaluate((node) => getComputedStyle(node).boxShadow);
  await slot.focus();
  assert.equal(await slot.evaluate((node) => node === document.activeElement), true);
  await page.waitForFunction((shadow) => getComputedStyle(document.querySelector('.db-otp__slot')).boxShadow !== shadow, beforeFocus);
  const bounds = await page.locator('.db-otp').boundingBox();
  const last = await page.locator('.db-otp__slot').last().boundingBox();
  assert.ok(last.x + last.width <= bounds.x + bounds.width && last.x + last.width <= 390);
});

test('Select retains legacy hooks and native field/focus styling', async () => {
  await mount('Select', { label: 'Frequency', options: [{ label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }] });
  const select = page.getByRole('combobox', { name: 'Frequency' });
  assert.equal(await select.evaluate((node) => node.classList.contains('db-select__input') && node.classList.contains('db-select__native')), true);
  assert.equal(await select.evaluate((node) => getComputedStyle(node).appearance), 'none');
  assert.match(await select.evaluate((node) => getComputedStyle(node).backgroundImage), /data:image\/svg/);
  const beforeFocus = await select.evaluate((node) => getComputedStyle(node).boxShadow);
  await select.focus();
  assert.equal(await select.evaluate((node) => node === document.activeElement), true);
  await page.waitForFunction((shadow) => getComputedStyle(document.querySelector('select')).boxShadow !== shadow, beforeFocus);
  assert.equal(await select.evaluate((node) => window.refs.control === node), true);
  assert.equal(await page.locator('.db-select').getAttribute('data-db-react'), '');
});

test('Pagination retains legacy hooks and native active, disabled, and focus styling', async () => {
  await mount('Pagination', { current: 1, total: 30 });
  assert.equal(await page.locator('.db-pagination button:not(.db-pagination__btn)').count(), 0);
  assert.deepEqual(await page.locator('.db-pagination button').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).height)), ['36px', '36px', '36px', '36px', '36px']);
  assert.equal(await page.getByRole('button', { name: 'Previous page' }).evaluate((node) => getComputedStyle(node).opacity), '0.4');
  const active = await page.locator('[aria-current="page"]').evaluate((node) => getComputedStyle(node).backgroundImage);
  const inactive = await page.getByRole('button', { name: 'Page 2', exact: true }).evaluate((node) => getComputedStyle(node).backgroundImage);
  assert.notEqual(active, inactive);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[aria-current="page"]').evaluate((node) => node.matches(':focus-visible')), true);
  assert.notEqual(await page.locator('[aria-current="page"]').evaluate((node) => getComputedStyle(node).boxShadow), 'none');
});

test('Checkbox exposes its native keyboard focus ring and indeterminate dash', async () => {
  await mount('Checkbox', { label: 'Notifications' });
  const checkbox = page.getByRole('checkbox', { name: 'Notifications' });
  const beforeFocus = await page.locator('.db-checkbox__box').evaluate((node) => getComputedStyle(node).boxShadow);
  await page.keyboard.press('Tab');
  assert.equal(await checkbox.evaluate((node) => node === document.activeElement && node.matches(':focus-visible')), true);
  await page.waitForFunction((shadow) => getComputedStyle(document.querySelector('.db-checkbox__box')).boxShadow !== shadow, beforeFocus);
  await page.keyboard.press('Space');
  assert.equal(await checkbox.isChecked(), true);
  await mount('Checkbox', { label: 'Notifications', indeterminate: true });
  assert.equal(await page.locator('.db-checkbox__box svg').evaluate((node) => getComputedStyle(node).display), 'none');
  assert.deepEqual(await page.locator('.db-checkbox__box').evaluate((node) => {
    const dash = getComputedStyle(node, '::after');
    return { width: dash.width, height: dash.height };
  }), { width: '10px', height: '2px' });
});

test('cancelled reset preserves OTP and wrapped group state without change requests', async () => {
  await mount('InputOTP', { length: 4, defaultValue: '1234', cancelReset: true });
  await paste(page.locator('.db-otp__slot').first(), '9876');
  await resetForm();
  await mount('InputOTP', { length: 4, defaultValue: '1234', cancelReset: true });
  assert.deepEqual(await slotValues(), ['9', '8', '7', '6']);
  await mount('CheckboxGroup', { nested: true, defaultValue: ['a'], cancelReset: true });
  await clickCheckbox('Beta');
  await resetForm();
  await mount('CheckboxGroup', { nested: true, defaultValue: ['a'], cancelReset: true });
  assert.equal(await page.getByRole('checkbox', { name: 'Beta' }).isChecked(), true);
  await mount('ToggleGroup', { nested: true, defaultValue: 'a', cancelReset: true });
  await page.getByRole('button', { name: 'Beta' }).click();
  await resetForm();
  await mount('ToggleGroup', { nested: true, defaultValue: 'a', cancelReset: true });
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await events(), ['9876', ['a', 'b'], 'b']);
});

test('wrapped controlled multiple ToggleGroup preserves supplied arrays through reset', async () => {
  await mount('ToggleGroup', { nested: true, multiple: true, values: ['b'], defaultValues: ['a'] });
  await page.getByRole('button', { name: 'Alpha' }).click();
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'false');
  await resetForm();
  await mount('ToggleGroup', { nested: true, multiple: true, values: ['b'], defaultValues: ['a'] });
  assert.equal(await page.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await events(), [{ a: true }, { values: ['b', 'a'] }, 'b,a']);
});

test('reset-aware controls preserve returned callback-ref cleanup on unmount', async () => {
  for (const kind of ['Checkbox', 'CheckboxGroup', 'ToggleGroup', 'InputOTP']) {
    await mount(kind, { refCleanup: true });
    assert.equal(await page.evaluate(() => !!window.refs.control), true);
    await mount('Button', { children: 'Unmount control' });
  }
  assert.deepEqual(await events(), ['ref-cleanup', 'ref-cleanup', 'ref-cleanup', 'ref-cleanup']);
});

test('standalone controlled Toggle marks React ownership and survives native initialization', async () => {
  await mount('Toggle', { children: 'Bold', pressed: false });
  const toggle = page.getByRole('button', { name: 'Bold' });
  assert.equal(await toggle.getAttribute('data-db-react'), '');
  await page.addScriptTag({ content: readFileSync(new URL('../../daub.js', import.meta.url), 'utf8') });
  await page.evaluate(() => { window.DAUB.init(); window.DAUB.init(); });
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(await events(), [true]);
});

test('recursive group helpers preserve scoped light/dark themes and semantic variable resolution', async () => {
  for (const kind of ['CheckboxGroup', 'ToggleGroup']) {
    const selected = kind === 'CheckboxGroup' ? ['a'] : 'a';
    for (const theme of ['github-dark', 'github']) {
      await mount(kind, { nested: true, defaultValue: selected, 'data-theme': 'nord-light', scopeTheme: theme });
      assert.equal(await page.getByTestId('custom-wrap').getAttribute('data-theme'), theme);
      const node = kind === 'CheckboxGroup' ? page.getByRole('checkbox', { name: 'Beta' }) : page.getByRole('button', { name: 'Beta' });
      const colors = await node.evaluate((node) => {
        const style = getComputedStyle(node);
        return { white: style.getPropertyValue('--db-white').trim(), surface: style.getPropertyValue('--db-color-surface').trim(), scheme: style.colorScheme };
      });
      assert.equal(colors.white, theme === 'github-dark' ? '#161B22' : '#FFFFFF');
      assert.equal(colors.surface, colors.white);
      assert.equal(colors.scheme, theme === 'github-dark' ? 'dark' : 'light');
      const wrapperWhite = await page.locator(kind === 'CheckboxGroup' ? '.db-checkbox-group' : '.db-toggle-group').evaluate((node) => getComputedStyle(node).getPropertyValue('--db-white').trim());
      assert.notEqual(colors.white, wrapperWhite);
    }
  }
});
