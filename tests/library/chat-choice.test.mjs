import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const runtime = await readFile(new URL('../../daub.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../daub.css', import.meta.url), 'utf8');
const icons = await readFile(new URL('../../assets/lucide.min.js', import.meta.url), 'utf8');
let browser;
before(async () => { browser = await ({ chromium, firefox, webkit })[process.env.DAUB_TEST_BROWSER || 'chromium'].launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function fixture(options = {}) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  await page.setContent('<button id="outside">Outside</button>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: icons });
  await page.addScriptTag({ content: runtime });
  await page.evaluate(options => {
    window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;
    window.composerRoot = document.createElement('form'); composerRoot.className = 'db-chat-composer'; document.body.append(composerRoot);
    window.composer = DAUB.createChatComposer(composerRoot, options);
    window.configEvents = [];
    composerRoot.addEventListener('db:chat-config', event => configEvents.push(event.detail));
    DAUB.init(composerRoot);
  }, options);
  return { page, errors };
}

test('compact toolbar keeps secondary settings reachable through keyboard and reinitialization', async () => {
  const { page, errors } = await fixture();
  try {
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      assert.equal(await page.getByRole('combobox').count(), 2, 'only approval and model occupy the toolbar');
      const layout = await page.evaluate(() => {
        const toolbar = document.querySelector('.db-chat-composer__toolbar');
        const visible = [...toolbar.children].filter(el => el.getBoundingClientRect().height > 4);
        const centers = visible.map(el => { const r = el.getBoundingClientRect(); return r.y + r.height / 2; });
        return { spread: Math.max(...centers) - Math.min(...centers), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.ok(layout.spread < 2, JSON.stringify({ width, ...layout }));
      assert.equal(layout.overflow, false);
    }
    for (let pass = 0; pass < 2; pass++) {
      const trigger = page.getByRole('button', { name: 'Chat settings', exact: true });
      await trigger.click();
      const panel = page.getByRole('dialog', { name: 'Chat settings', exact: true });
      assert.equal(await panel.getByRole('combobox', { name: 'Effort', exact: true }).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await panel.getByRole('combobox', { name: 'Mode', exact: true }).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      await panel.getByRole('textbox', { name: 'Goal', exact: true }).fill('Ship the review');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => composer.getState().goal), 'Ship the review');
      await page.keyboard.press('Escape');
      assert.equal(await panel.isVisible(), false);
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      await page.evaluate(() => { composer.destroy(); composer = DAUB.createChatComposer(composerRoot); });
    }
    assert.equal(await page.locator('.db-chat-composer__settings').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('choices expose themed comboboxes and listboxes while preserving native form slots and controller setters', async () => {
  const { page, errors } = await fixture();
  try {
    for (const [field, label, option, value] of [['model', 'Model', 'Code reviewer (demo)', 'demo-code'], ['effort', 'Effort', 'Low', 'low'], ['approval', 'Approval', 'Auto-approve safe actions', 'auto'], ['mode', 'Mode', 'Plan', 'plan']]) {
      if (field === 'effort' || field === 'mode') await page.getByRole('button', { name: 'Chat settings', exact: true }).click();
      const wrap = page.locator('.db-chat-composer__choice[data-field="' + field + '"]');
      assert.equal(await wrap.count(), 1);
      const trigger = wrap.getByRole('combobox', { name: label, exact: true });
      assert.equal(await trigger.evaluate(el => el.tagName), 'BUTTON');
      assert.equal(await trigger.getAttribute('aria-haspopup'), 'listbox');
      assert.equal(await trigger.locator('svg.lucide-chevron-down').count(), 1);
      assert.equal(await wrap.locator('select').evaluate(el => el.hidden && el.tabIndex === -1 && el.getAttribute('aria-label') === el.name[0].toUpperCase() + el.name.slice(1) + ' value'), true);
      await trigger.click();
      const menu = wrap.getByRole('listbox', { name: label, exact: true });
      assert.equal(await menu.getAttribute('id'), await trigger.getAttribute('aria-controls'));
      assert.equal(await menu.locator('[aria-selected=true] svg.lucide-check').isVisible(), true);
      assert.equal(await menu.locator('[aria-selected=false] svg.lucide-check').first().evaluate(el => getComputedStyle(el).visibility), 'hidden');
      assert.equal(await menu.getByRole('option', { name: option, exact: true }).locator('span').textContent(), option);
      await menu.getByRole('option', { name: option, exact: true }).click();
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      assert.equal(await trigger.locator('.db-chat-composer__choice-label').textContent(), option);
      assert.equal(await page.evaluate(field => new FormData(composerRoot).get(field), field), value);
      assert.equal(await wrap.locator('[role=option][aria-selected=true]').textContent(), option);
    }
    await page.evaluate(() => { composer.setModel('demo-brief'); composer.setEffort('medium'); composer.setApproval('ask'); composer.setMode('chat'); });
    assert.deepEqual(await page.locator('.db-chat-composer__choice-label').allTextContents(), ['Ask for approval', 'Medium', 'Chat', 'Concise assistant (demo)']);
    assert.equal(await page.evaluate(() => configEvents.length), 8);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('choice keyboard arrows, Home, End, Enter, Escape, typeahead, Tab and focus exit work without submitting', async () => {
  const { page } = await fixture({ models: [{ id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' }, { id: 'bravo', label: 'Bravo' }, { id: 'charlie', label: 'Charlie' }] });
  try {
    await page.evaluate(() => {
      composer.setDraft('Keep draft'); window.sends = 0;
      composerRoot.addEventListener('db:chat-send', () => sends++);
      composerRoot.querySelector('select[name=model] option[value=beta]').disabled = true;
      composerRoot.querySelector('select[name=model]').dispatchEvent(new Event('change'));
    });
    const model = page.getByRole('combobox', { name: 'Model', exact: true });
    await model.press('ArrowDown');
    assert.equal(await page.getByRole('option', { name: 'Alpha', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.getByRole('option', { name: 'Bravo', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('End');
    assert.equal(await page.getByRole('option', { name: 'Charlie', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Home');
    await page.keyboard.press('b');
    assert.equal(await page.getByRole('option', { name: 'Bravo', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => composer.getState().model), 'bravo');
    assert.equal(await model.evaluate(el => el === document.activeElement), true);
    await model.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => composer.getState().model), 'bravo');
    assert.equal(await model.evaluate(el => el === document.activeElement), true);
    await model.press('c');
    assert.equal(await page.getByRole('option', { name: 'Charlie', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await model.getAttribute('aria-expanded'), 'false');
    await model.click();
    await page.getByRole('textbox', { name: 'Message', exact: true }).focus();
    assert.equal(await model.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => sends), 0);
    assert.equal(await page.evaluate(() => composer.getState().text), 'Keep draft');
  } finally { await page.close(); }
});

test('busy and deferred options sync choices; approval capability hides the wrapper and native change stays compatible', async () => {
  const { page } = await fixture();
  try {
    const model = page.getByRole('combobox', { name: 'Model', exact: true });
    await model.click();
    await page.evaluate(() => {
      composer.setBusy(true);
      composer.updateOptions({ models: [{ id: 'tiny', label: '<Tiny>', efforts: ['low'] }], model: 'tiny', capabilities: { approval: false } });
    });
    assert.equal(await model.getAttribute('aria-expanded'), 'false');
    assert.equal(await model.isDisabled(), true);
    assert.equal(await page.locator('.db-chat-composer__choice[data-field="effort"] button[role="combobox"]').isDisabled(), true);
    assert.equal(await model.locator('.db-chat-composer__choice-label').textContent(), 'Review assistant (demo)');
    await page.evaluate(() => composer.setBusy(false));
    assert.equal(await model.locator('.db-chat-composer__choice-label').textContent(), '<Tiny>');
    assert.equal(await page.locator('.db-chat-composer__choice[data-field="effort"] .db-chat-composer__choice-label').textContent(), 'Low');
    assert.equal(await page.locator('.db-chat-composer__choice[data-field=approval]').isVisible(), false);
    assert.equal(await page.locator('select[name=approval]').isVisible(), false);
    await page.evaluate(() => {
      composer.updateOptions({ capabilities: { approval: true } });
      const slot = composerRoot.querySelector('select[name=mode]'); slot.value = 'plan'; slot.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.equal(await page.locator('.db-chat-composer__choice[data-field=approval]').isVisible(), true);
    assert.equal(await page.locator('.db-chat-composer__choice[data-field="mode"] .db-chat-composer__choice-label').textContent(), 'Plan');
    assert.equal(await page.locator('.db-chat-composer__choice img').count(), 0);
    await model.click();
    assert.deepEqual(await page.getByRole('listbox', { name: 'Model', exact: true }).getByRole('option').allTextContents(), ['<Tiny>']);
  } finally { await page.close(); }
});

test('composer Add, choices and host popovers exclude sibling panels without closing unrelated popovers', async () => {
  const { page, errors } = await fixture();
  try {
    await page.evaluate(() => {
      function popover(label, parent) {
        const pop = document.createElement('div'); pop.className = 'db-popover';
        pop.innerHTML = '<button type="button" class="db-popover__trigger">' + label + '</button><div class="db-popover__content">Settings content</div>';
        parent.append(pop); return pop;
      }
      window.settings = composerRoot.querySelector('.db-chat-composer__settings');
      window.unrelated = popover('Unrelated settings', document.body);
      DAUB.init();
    });
    const add = page.getByRole('button', { name: 'Add', exact: true });
    const settings = page.getByRole('button', { name: 'Chat settings', exact: true });
    const unrelated = page.getByRole('button', { name: 'Unrelated settings', exact: true });
    const model = page.getByRole('combobox', { name: 'Model', exact: true });
    await unrelated.dispatchEvent('click');
    await settings.click();
    assert.equal(await unrelated.getAttribute('aria-expanded'), 'true');
    await add.click();
    assert.equal(await add.getAttribute('aria-expanded'), 'true');
    assert.equal(await settings.getAttribute('aria-expanded'), 'false');
    assert.equal(await unrelated.getAttribute('aria-expanded'), 'true');
    await settings.click();
    assert.equal(await add.getAttribute('aria-expanded'), 'false');
    await model.press('ArrowDown');
    assert.equal(await settings.getAttribute('aria-expanded'), 'false');
    await settings.click();
    await page.getByRole('combobox', { name: 'Effort', exact: true }).click();
    assert.equal(await model.getAttribute('aria-expanded'), 'false');
    assert.equal(await settings.getAttribute('aria-expanded'), 'true', 'ancestor keeps the nested choice reachable');
    await page.keyboard.press('Escape');
    assert.equal(await settings.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await settings.getAttribute('aria-expanded'), 'false');
    await model.click();
    await unrelated.click();
    assert.equal(await model.getAttribute('aria-expanded'), 'false', 'external triggers may stop click bubbling');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('destroy closes choices, drops listeners and supports reinitialization without duplicate controls or events', async () => {
  const { page } = await fixture();
  try {
    const model = page.getByRole('combobox', { name: 'Model', exact: true });
    await model.click();
    await page.evaluate(() => { composer.destroy(); composer.destroy(); });
    assert.equal(await model.getAttribute('aria-expanded'), 'false');
    await model.click();
    assert.equal(await model.getAttribute('aria-expanded'), 'false');
    await page.evaluate(() => { window.composer = DAUB.createChatComposer(composerRoot); DAUB.init(composerRoot); });
    assert.equal(await page.locator('.db-chat-composer__choice').count(), 4);
    await model.click();
    await page.getByRole('option', { name: 'Concise assistant (demo)', exact: true }).click();
    assert.equal(await page.evaluate(() => configEvents.length), 1);
    await model.click();
    await page.evaluate(() => composerRoot.remove());
    assert.equal(await page.evaluate(() => composerRoot.querySelector('.db-chat-composer__choice-trigger').getAttribute('aria-expanded')), 'false');
    assert.equal(await page.evaluate(() => composer.setModel('demo-code')), false);
  } finally { await page.close(); }
});
