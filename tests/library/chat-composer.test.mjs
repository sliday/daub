import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const runtime = await readFile(new URL('../../daub.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../daub.css', import.meta.url), 'utf8');
const icons = await readFile(new URL('../../assets/lucide.min.js', import.meta.url), 'utf8');
let browser;
before(async () => {
  browser = await ({ chromium, firefox, webkit })[process.env.DAUB_TEST_BROWSER || 'chromium'].launch({ headless: true });
});
after(async () => { await browser?.close(); });

async function fixture(options = {}, setup) {
  const page = await browser.newPage({ viewport: { width: 800, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'blob:') return route.continue();
    if (url.hostname === 'daub.test' && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<form class="db-chat-composer" data-db-react id="composer"></form>' });
    return route.abort();
  });
  await page.goto('http://daub.test/');
  await page.addStyleTag({ content: css });
  if (setup) await page.evaluate(setup);
  await page.addScriptTag({ content: icons });
  await page.addScriptTag({ content: runtime });
  await page.evaluate(options => {
    window.composerRoot = document.querySelector('#composer');
    window.composer = DAUB.createChatComposer(composerRoot, options);
    window.chatEvents = [];
    for (const name of ['send', 'steer', 'stop', 'queue', 'config', 'action', 'dictation']) {
      document.addEventListener('db:chat-' + name, event => {
        chatEvents.push({ name, detail: event.detail, cancelable: event.cancelable });
        if (window.cancelChat === name) event.preventDefault();
      });
    }
  }, options);
  return { page, errors };
}

test('empty roots self-populate once; native init skips React roots and respects explicit ownership', async () => {
  const { page, errors } = await fixture();
  try {
    assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => DAUB.createChatComposer(composerRoot) === composer), true);
    const result = await page.evaluate(() => {
      DAUB.init();
      const native = document.createElement('form');
      native.className = 'db-chat-composer';
      document.body.append(native);
      DAUB.init(native);
      const untouched = document.createElement('form');
      untouched.className = 'db-chat-composer';
      untouched.setAttribute('data-db-react', '');
      document.body.append(untouched);
      DAUB.init();
      return { state: composer.getState(), native: !!native.querySelector('textarea'), react: untouched.childElementCount };
    });
    assert.equal(result.native, true);
    assert.equal(result.react, 0);
    assert.equal(result.state.model, 'demo-review');
    assert.equal(result.state.effort, 'high');
    assert.equal(result.state.approval, 'ask');
    assert.equal(result.state.mode, 'chat');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('canceled sends retain draft, ID, and local files; Enter respects composition and Shift', async () => {
  const { page } = await fixture();
  try {
    await page.evaluate(() => { cancelChat = 'send'; composer.attachFiles([new File(['local'], 'draft.txt')]); });
    const input = page.getByRole('textbox', { name: 'Message', exact: true });
    await input.fill('<img src=x onerror=alert(1)>');
    await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
    await input.press('Shift+Enter');
    assert.equal(await page.evaluate(() => chatEvents.filter(event => event.name === 'send').length), 0);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    assert.match(await input.inputValue(), /<img/);
    await input.press('Enter');
    const result = await page.evaluate(() => {
      const sends = chatEvents.filter(event => event.name === 'send');
      return { ids: sends.map(event => event.detail.request.id), files: composer.getState().files.length, sameFile: sends[0].detail.request.files[0] === composer.getState().files[0], cancelable: sends[0].cancelable };
    });
    assert.equal(result.ids[0], result.ids[1]);
    assert.equal(result.files, 1);
    assert.equal(result.sameFile, true);
    assert.equal(result.cancelable, true);
    await page.evaluate(() => { cancelChat = null; });
    await input.press('Enter');
    assert.equal(await input.inputValue(), '');
    assert.equal(await page.evaluate(() => composer.getState().files.length), 0);
  } finally { await page.close(); }
});

test('busy requests queue immutable configuration; edit, canceled steer, remove, and explicit takeNext work', async () => {
  const { page } = await fixture();
  try {
    await page.evaluate(() => { composer.setBusy(true); composer.setDraft('First'); composer.attachFiles([new File(['x'], 'queue.txt')]); });
    assert.equal(await page.getByRole('combobox', { name: 'Model', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('combobox', { name: 'Effort', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    assert.equal(await page.locator('.db-chat-composer__queued-item').count(), 1);
    await page.getByRole('button', { name: 'Edit queued message', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit message', exact: true }).click();
    await page.getByRole('textbox', { name: 'Edit queued message', exact: true }).fill('Revised <script>');
    await page.getByRole('button', { name: 'Save edit', exact: true }).click();
    await page.evaluate(() => { cancelChat = 'steer'; });
    await page.getByRole('button', { name: 'Steer queued message', exact: true }).click();
    assert.equal(await page.evaluate(() => composer.getQueue()[0].text), 'Revised <script>');
    assert.equal(await page.locator('.db-chat-composer__queued-item script').count(), 0);
    await page.evaluate(() => { cancelChat = null; });
    await page.getByRole('button', { name: 'Steer queued message', exact: true }).click();
    assert.equal(await page.evaluate(() => composer.getQueue().length), 0);
    await page.evaluate(() => { composer.setDraft('Second'); });
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    await page.getByRole('button', { name: 'Stop response', exact: true }).click();
    assert.equal(await page.evaluate(() => composer.getState().busy), true, 'only host clears busy');
    await page.evaluate(() => composer.setBusy(false));
    assert.equal(await page.evaluate(() => composer.getQueue().length), 1, 'idle does not drain queue');
    const taken = await page.evaluate(() => {
      const copy = composer.getQueue();
      copy[0].text = 'Mutation';
      copy.length = 0;
      return composer.takeNext();
    });
    assert.equal(taken.text, 'Second');
    assert.equal(await page.evaluate(() => composer.takeNext()), null);
    await page.evaluate(() => composer.setBusy(true));
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Remove me');
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    await page.getByRole('button', { name: 'Remove queued message', exact: true }).click();
    assert.equal(await page.evaluate(() => composer.getQueue().length), 0);
  } finally { await page.close(); }
});

test('declarative options merge with explicit options; model efforts validate and busy locks configuration', async () => {
  const { page } = await fixture();
  try {
    const result = await page.evaluate(() => {
      const root = document.createElement('form'); root.className = 'db-chat-composer';
      root.setAttribute('data-db-chat-options', JSON.stringify({
        models: [{ id: 'custom', label: 'Custom', efforts: ['medium', 'high'] }, { id: 'small', label: 'Small', efforts: ['low'] }],
        model: 'custom', effort: 'medium', mode: 'plan', approval: 'auto', placeholder: 'Release notes'
      }));
      document.body.append(root);
      const controller = DAUB.createChatComposer(root, { effort: 'high' });
      DAUB.init(root);
      const same = controller === DAUB.createChatComposer(root, { effort: 'low' });
      const initial = controller.getState();
      const rejected = [controller.setModel('missing'), controller.setEffort('extreme'), controller.setMode('unknown'), controller.setApproval('root')];
      controller.setBusy(true);
      const locked = [controller.setModel('small'), controller.setEffort('medium')];
      controller.setBusy(false); controller.setModel('small'); controller.setGoal('Finish audit'); controller.setStatus('Waiting for host');
      const selected = controller.getState();
      const ui = { placeholder: root.querySelector('textarea').placeholder, status: root.querySelector('.db-chat-composer__status').textContent, effort: root.querySelector('select[name=effort]').value };
      controller.setGoal(null);
      return { same, initial, rejected, locked, selected, ui, goal: controller.getState().goal };
    });
    assert.equal(result.same, true);
    assert.equal(result.initial.effort, 'high');
    assert.equal(result.initial.mode, 'plan');
    assert.equal(result.initial.approval, 'auto');
    assert.deepEqual(result.rejected, [false, false, false, false]);
    assert.deepEqual(result.locked, [false, false]);
    assert.equal(result.selected.model, 'small');
    assert.equal(result.selected.effort, 'low');
    assert.equal(result.selected.goal, 'Finish audit');
    assert.equal(result.goal, null);
    assert.deepEqual(result.ui, { placeholder: 'Release notes', status: 'Waiting for host', effort: 'low' });
    await page.getByRole('combobox', { name: 'Model', exact: true }).first().selectOption('demo-code');
    await page.getByRole('combobox', { name: 'Effort', exact: true }).first().selectOption('low');
    await page.getByRole('combobox', { name: 'Approval', exact: true }).first().selectOption('auto');
    assert.equal(await page.locator('#composer .db-chat-composer__approval option:checked').textContent(), 'Auto-approve safe actions');
    await page.getByRole('combobox', { name: 'Mode', exact: true }).first().selectOption('plan');
    await page.getByRole('textbox', { name: 'Goal', exact: true }).first().fill('Ship review');
    await page.getByRole('textbox', { name: 'Goal', exact: true }).first().press('Tab');
    await page.evaluate(() => composer.setBusy(true));
    await page.getByRole('textbox', { name: 'Message', exact: true }).first().fill('Queued intent');
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    await page.evaluate(() => { composer.setMode('chat'); composer.setApproval('ask'); composer.setGoal(null); });
    const snapshot = await page.evaluate(() => composer.getQueue()[0]);
    assert.equal(snapshot.model, 'demo-code');
    assert.equal(snapshot.effort, 'low');
    assert.equal(snapshot.mode, 'plan');
    assert.equal(snapshot.approval, 'auto');
    assert.equal(snapshot.goal, 'Ship review');
    assert.equal(await page.evaluate(() => chatEvents.filter(event => event.name === 'config').every(event => !event.cancelable)), true);
  } finally { await page.close(); }
});

test('Add menu follows keyboard and disabled-item behavior; configured side-chat stays a host event', async () => {
  const { page } = await fixture({ actions: [{ id: 'context', label: 'Add context' }, { id: 'disabled', label: 'Unavailable', disabled: true }, { id: 'side-chat', label: 'Open in side chat' }] });
  try {
    const add = page.getByRole('button', { name: 'Add', exact: true });
    await add.press('ArrowDown');
    assert.equal(await add.getAttribute('aria-expanded'), 'true');
    await page.getByRole('menuitem', { name: 'Add context', exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.getByRole('menuitem', { name: 'Open in side chat', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await add.getAttribute('aria-expanded'), 'false');
    assert.equal(await add.evaluate(el => el === document.activeElement), true);
    await add.click();
    await page.getByRole('menuitem', { name: 'Add context', exact: true }).click();
    const action = await page.evaluate(() => chatEvents.find(event => event.name === 'action'));
    assert.equal(action.detail.action.id, 'context');
    assert.equal(action.cancelable, true);
    await add.click();
    assert.ok((await page.getByRole('menuitem', { name: 'Add files', exact: true }).boundingBox()).y >= 0);
    const picker = page.waitForEvent('filechooser').catch(error => error);
    await page.getByRole('menuitem', { name: 'Add files', exact: true }).click();
    const chooser = await picker;
    if (chooser instanceof Error) throw chooser;
    await chooser.setFiles({ name: 'context.txt', mimeType: 'text/plain', buffer: Buffer.from('local') });
    assert.equal(await page.evaluate(() => composer.getState().files[0].name), 'context.txt');
    assert.equal(await page.locator('.db-chat-composer__file-input').inputValue(), '');
    await page.evaluate(() => { composer.setBusy(true); composer.setDraft('Side request'); });
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    await page.getByRole('button', { name: 'Open in side chat', exact: true }).click();
    const sideChat = await page.evaluate(() => chatEvents.filter(event => event.name === 'action').at(-1));
    assert.equal(sideChat.detail.action, 'side-chat');
    assert.equal(sideChat.detail.request.text, 'Side request');
    assert.equal(await page.evaluate(() => composer.getQueue().length), 1);
  } finally { await page.close(); }
});

test('picker and drop keep Files local; image URLs survive shared draft/queue ownership and revoke once', async () => {
  const { page } = await fixture({}, () => {
    window.createdURLs = []; window.revokedURLs = [];
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = file => { const url = create(file); createdURLs.push(url); return url; };
    URL.revokeObjectURL = url => { revokedURLs.push(url); revoke(url); };
    File.prototype.text = File.prototype.arrayBuffer = () => { throw new Error('Runtime must not read files'); };
  });
  try {
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
      canvas.getContext('2d').fillRect(0, 0, 2, 2);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('.db-chat-composer__file-input').setInputFiles({ name: 'local.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(() => document.querySelector('.db-attachment img').naturalWidth > 0);
    assert.match(await page.locator('.db-attachment img').getAttribute('src'), /^blob:/);
    await page.evaluate(() => { window.sharedFile = composer.getState().files[0]; composer.setBusy(true); });
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    await page.evaluate(() => composer.attachFiles([sharedFile]));
    assert.equal(await page.evaluate(() => createdURLs.length), 1);
    await page.getByRole('button', { name: 'Remove local.png', exact: true }).click();
    assert.equal(await page.evaluate(() => revokedURLs.length), 0);
    await page.getByRole('button', { name: 'Remove queued message', exact: true }).click();
    assert.equal(await page.evaluate(() => revokedURLs.length), 1);
    const dropped = await page.evaluate(() => {
      const dataTransfer = new DataTransfer(); dataTransfer.items.add(new File(['x'], 'drop.txt', { type: 'text/plain' }));
      const drag = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }); composerRoot.dispatchEvent(drag);
      const visible = !composerRoot.querySelector('.db-chat-composer__dropzone').hidden;
      const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }); composerRoot.dispatchEvent(drop);
      return { dragPrevented: drag.defaultPrevented, prevented: drop.defaultPrevented, visible, hidden: composerRoot.querySelector('.db-chat-composer__dropzone').hidden, name: composer.getState().files[0].name };
    });
    assert.deepEqual(dropped, { dragPrevented: true, prevented: true, visible: true, hidden: true, name: 'drop.txt' });
    await page.evaluate(() => { composer.attachFiles([sharedFile]); composer.destroy(); composer.destroy(); });
    assert.equal(await page.evaluate(() => revokedURLs.length), 2);
    assert.equal(await page.evaluate(() => new Set(revokedURLs).size), 2);
  } finally { await page.close(); }
});

test('capability flags suppress UI and reject native attachments and queue without granting access', async () => {
  const { page } = await fixture({ approval: 'auto', capabilities: { queue: false, steer: false, attachments: false, dictation: false, approval: false } });
  try {
    assert.equal(await page.getByRole('button', { name: 'Add', exact: true }).isVisible(), false);
    assert.equal(await page.getByRole('combobox', { name: 'Approval', exact: true }).isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Start dictation', exact: true }).isDisabled(), true);
    const result = await page.evaluate(() => {
      const attached = composer.attachFiles([new File(['private'], 'private.txt')]);
      const approved = composer.setApproval('auto'); composer.setBusy(true); composer.setDraft('Wait');
      return { attached, approved, state: composer.getState() };
    });
    assert.equal(result.attached, false);
    assert.equal(result.approved, false);
    assert.equal(result.state.approval, 'ask');
    assert.deepEqual(result.state.files, []);
    assert.equal(result.state.dictation, 'unsupported');
    assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true);
    await page.getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
    assert.deepEqual(await page.evaluate(() => composer.getQueue()), []);
  } finally { await page.close(); }
});

function fakeRecognition() {
  window.speechStarts = 0;
  window.SpeechRecognition = class {
    constructor() { window.fakeSpeech = this; }
    start() { speechStarts++; }
    stop() { this.stopping = true; }
    abort() { this.aborted = true; }
  };
}

test('disabling dictation aborts recognition immediately during an active response', async () => {
  const { page } = await fixture({}, fakeRecognition);
  try {
    await page.evaluate(() => composer.setBusy(true));
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    await page.evaluate(() => composer.updateOptions({ capabilities: { dictation: false } }));
    assert.equal(await page.evaluate(() => composer.getState().dictation), 'unsupported');
    assert.equal(await page.getByRole('button', { name: 'Start dictation', exact: true }).isDisabled(), true);
    assert.equal(await page.evaluate(() => window.fakeSpeech.aborted), true);
  } finally { await page.close(); }
});

test('dictation requires a trusted click and reconciles changing interim results without duplicating final text', async () => {
  const { page, errors } = await fixture({}, fakeRecognition);
  try {
    assert.equal(await page.evaluate(() => speechStarts), 0);
    assert.equal(await page.evaluate(() => composer.startDictation()), false);
    await page.evaluate(() => { composer.setDraft('Base'); composerRoot.querySelector('.db-chat-composer__dictation').click(); });
    assert.equal(await page.evaluate(() => speechStarts), 0);
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    assert.equal(await page.evaluate(() => composer.getState().dictation), 'listening');
    assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true);
    await page.evaluate(() => fakeSpeech.onresult({ resultIndex: 0, results: [{ 0: { transcript: 'draft' }, length: 1, isFinal: false }] }));
    assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Base draft');
    await page.evaluate(() => fakeSpeech.onresult({ resultIndex: 0, results: [{ 0: { transcript: 'Final ' }, length: 1, isFinal: true }, { 0: { transcript: 'maybe' }, length: 1, isFinal: false }] }));
    assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Base Final maybe');
    await page.evaluate(() => fakeSpeech.onresult({ resultIndex: 1, results: [{ 0: { transcript: 'Final ' }, length: 1, isFinal: true }, { 0: { transcript: 'done' }, length: 1, isFinal: true }] }));
    assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Base Final done');
    await page.locator('.db-chat-composer__dictation-stop').click();
    await page.evaluate(() => fakeSpeech.onend());
    assert.equal(await page.evaluate(() => composer.getState().dictation), 'stopped');
    assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Base Final done');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('dictation cancel restores draft; errors do not retry, and disposal aborts recognition and removes listeners', async () => {
  const { page } = await fixture({}, fakeRecognition);
  try {
    await page.evaluate(() => composer.setDraft('Original'));
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    await page.evaluate(() => fakeSpeech.onresult({ resultIndex: 0, results: [{ 0: { transcript: 'temporary' }, length: 1, isFinal: false }] }));
    await page.getByRole('button', { name: 'Cancel dictation', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Original');
    assert.equal(await page.evaluate(() => fakeSpeech.aborted), true);
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    await page.evaluate(() => fakeSpeech.onerror({ error: 'not-allowed' }));
    assert.equal(await page.evaluate(() => composer.getState().dictation), 'error');
    const error = await page.evaluate(() => chatEvents.filter(event => event.name === 'dictation').at(-1));
    assert.deepEqual(error.detail, { state: 'error', error: 'not-allowed' });
    assert.equal(error.cancelable, false);
    assert.equal(await page.evaluate(() => speechStarts), 2);
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    const disposed = await page.evaluate(() => {
      const callback = fakeSpeech.onresult;
      composer.destroy(); composer.destroy();
      callback({ resultIndex: 0, results: [{ 0: { transcript: 'late' }, length: 1, isFinal: true }] });
      return { aborted: fakeSpeech.aborted, removed: fakeSpeech.onresult === null, rejected: composer.setDraft('after destroy') };
    });
    assert.deepEqual(disposed, { aborted: true, removed: true, rejected: false });
    assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Original');
    const count = await page.evaluate(() => chatEvents.length);
    await page.getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
    assert.equal(await page.evaluate(() => chatEvents.length), count);
    await page.evaluate(() => { window.composer = DAUB.createChatComposer(composerRoot); composer.setDraft('Reinitialized'); });
    await page.getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
    assert.equal(await page.evaluate(() => chatEvents.filter(event => event.name === 'send').length), 1);
  } finally { await page.close(); }
});

test('detaching a root cancels dictation and native ownership handoff disposes its controller', async () => {
  const { page } = await fixture({}, fakeRecognition);
  try {
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    await page.evaluate(() => composerRoot.remove());
    assert.equal(await page.evaluate(() => fakeSpeech.aborted), true);
    assert.equal(await page.evaluate(() => composer.startDictation()), false);
    const native = await page.evaluate(async () => {
      const root = document.createElement('form'); root.className = 'db-chat-composer'; document.body.append(root);
      DAUB.init(root); const controller = DAUB.createChatComposer(root);
      root.setAttribute('data-db-react', ''); await Promise.resolve();
      const rejected = controller.setDraft('ownership lost');
      const explicit = DAUB.createChatComposer(root);
      return { rejected, fresh: explicit !== controller, accepted: explicit.setDraft('React-owned draft') };
    });
    assert.deepEqual(native, { rejected: false, fresh: true, accepted: true });
  } finally { await page.close(); }
});

test('long drafts, attachments, menus, and edit controls fit mobile and desktop with visible icons', async () => {
  const { page, errors } = await fixture({ actions: [{ id: 'context', label: 'Add context' }] });
  try {
    for (const width of [320, 375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => {
        composer.setBusy(false); composer.setDraft('Review ' + 'release'.repeat(100));
        composer.attachFiles([new File(['x'], 'long-'.repeat(45) + '.txt')]);
      });
      await page.waitForFunction(size => {
        const rect = document.querySelector('.db-chat-composer__send').getBoundingClientRect();
        return rect.width >= size && rect.height >= size;
      }, width <= 480 ? 44 : 32);
      const bounds = await page.locator('.db-chat-composer__send').boundingBox();
      assert.ok(bounds.width >= (width <= 480 ? 44 : 32), JSON.stringify({ width, bounds, style: await page.locator('.db-chat-composer__send').evaluate(el => ({ minWidth: getComputedStyle(el).minWidth, target: getComputedStyle(el).getPropertyValue('--db-chat-composer-target'), transition: getComputedStyle(el).transition })) }));
      assert.ok(bounds.height >= (width <= 480 ? 44 : 32));
      assert.equal(await page.locator('.db-chat-composer__send svg').count(), 1);
      assert.equal(await page.locator('.db-chat-composer__dictation svg').count(), 1);
      await page.evaluate(() => composer.setBusy(true));
      await page.getByRole('button', { name: 'Queue message', exact: true }).click();
      await page.getByRole('button', { name: 'Edit queued message', exact: true }).last().click();
      await page.getByRole('menuitem', { name: 'Edit message', exact: true }).click();
      const editor = await page.getByRole('textbox', { name: 'Edit queued message', exact: true }).boundingBox();
      assert.ok(editor.height <= 160);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: '/private/tmp/daub-chat-composer-' + width + '.png', fullPage: true });
      await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
      await page.evaluate(() => { while (composer.takeNext()) {} });
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('clearDraft leaves queue intact; queue edits preserve pending draft and change events expose local counts', async () => {
  const { page } = await fixture();
  try {
    await page.evaluate(() => {
      window.chatChanges = [];
      composerRoot.addEventListener('db:chat-change', event => chatChanges.push({ state: event.detail.state, cancelable: event.cancelable }));
      composer.setBusy(true); composer.setDraft('Queued original');
    });
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    await page.evaluate(() => { composer.setDraft('Pending text'); composer.attachFiles([new File(['private'], 'pending.txt')]); });
    await page.getByRole('button', { name: 'Edit queued message', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit message', exact: true }).click();
    await page.getByRole('textbox', { name: 'Edit queued message', exact: true }).fill('Queued revised');
    await page.getByRole('button', { name: 'Save edit', exact: true }).click();
    const pending = await page.evaluate(() => ({ text: composer.getState().text, file: composer.getState().files[0].name, queued: composer.getQueue()[0].text }));
    assert.deepEqual(pending, { text: 'Pending text', file: 'pending.txt', queued: 'Queued revised' });
    const cleared = await page.evaluate(() => { composer.clearDraft(); return composer.getState(); });
    assert.equal(cleared.text, '');
    assert.deepEqual(cleared.files, []);
    assert.equal(cleared.queue[0].text, 'Queued revised');
    await page.evaluate(() => composer.setBusy(false));
    await page.getByRole('button', { name: 'Send queued message now', exact: true }).click();
    assert.equal(await page.evaluate(() => composer.getQueue().length), 0);
    const changes = await page.evaluate(() => chatChanges.map(change => ({ text: change.state.text, files: change.state.files.length, queue: change.state.queue.length, cancelable: change.cancelable })));
    assert.ok(changes.some(change => change.text === 'Pending text' && change.files === 1 && change.queue === 1));
    assert.ok(changes.some(change => change.text === '' && change.files === 0 && change.queue === 1));
    assert.equal(changes.at(-1).queue, 0);
    assert.equal(changes.every(change => change.cancelable === false), true);
  } finally { await page.close(); }
});

test('send and steer reject synchronous reentry, retain canceled requests, and release guards afterward', async () => {
  const { page, errors } = await fixture();
  try {
    const result = await page.evaluate(() => {
      composer.setDraft('Retain send');
      let sends = 0, reenteredSend = false;
      const send = event => {
        sends++;
        if (!reenteredSend) { reenteredSend = true; composerRoot.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
        event.preventDefault();
      };
      composerRoot.addEventListener('db:chat-send', send);
      composerRoot.requestSubmit();
      const firstId = chatEvents.filter(event => event.name === 'send').at(-1).detail.request.id;
      composerRoot.requestSubmit();
      const secondId = chatEvents.filter(event => event.name === 'send').at(-1).detail.request.id;
      composerRoot.removeEventListener('db:chat-send', send);
      composer.setBusy(true); composerRoot.requestSubmit();
      const id = composer.getQueue()[0].id;
      let steers = 0, nested, reenteredSteer = false;
      const steer = event => {
        steers++;
        if (!reenteredSteer) { reenteredSteer = true; nested = composer.steerQueued(id); }
        event.preventDefault();
      };
      composerRoot.addEventListener('db:chat-steer', steer);
      const canceled = composer.steerQueued(id), retained = composer.getQueue()[0].text;
      composerRoot.removeEventListener('db:chat-steer', steer);
      const accepted = composer.steerQueued(id);
      return { sends, sameId: firstId === secondId, steers, nested, canceled, retained, accepted, length: composer.getQueue().length };
    });
    assert.deepEqual(result, { sends: 2, sameId: true, steers: 1, nested: false, canceled: false, retained: 'Retain send', accepted: true, length: 0 });
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('option updates preserve draft, queued Files, preview URLs, and unsaved inline edit text', async () => {
  const { page } = await fixture();
  try {
    await page.evaluate(() => {
      window.ownedFile = new File(['image'], 'preview.png', { type: 'image/png' });
      composer.attachFiles([ownedFile]); composer.setDraft('Queued'); composer.setBusy(true);
    });
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    await page.getByRole('button', { name: 'Edit queued message', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit message', exact: true }).click();
    await page.getByRole('textbox', { name: 'Edit queued message', exact: true }).fill('Unsaved edit');
    const result = await page.evaluate(() => {
      composer.setDraft('Pending'); composer.attachFiles([ownedFile]);
      const input = composerRoot.querySelector('.db-chat-composer__input');
      const preview = composerRoot.querySelector('.db-chat-composer__attachments img').src;
      const accepted = composer.updateOptions({
        models: [{ id: 'replacement', label: 'Replacement', efforts: ['low'] }],
        actions: [{ id: 'fresh', label: 'New action' }], capabilities: { attachments: false, steer: false }, placeholder: 'Updated placeholder'
      });
      const deferred = { model: composer.getState().model, label: composerRoot.querySelector('.db-chat-composer__model option:checked').textContent, placeholder: input.placeholder };
      composer.setBusy(false);
      return { accepted, deferred, state: composer.getState(), sameInput: input === composerRoot.querySelector('.db-chat-composer__input'), sameFiles: composer.getState().files[0] === ownedFile && composer.getQueue()[0].files[0] === ownedFile, sameURL: preview === composerRoot.querySelector('.db-chat-composer__attachments img').src };
    });
    assert.equal(result.accepted, true);
    assert.deepEqual(result.deferred, { model: 'demo-review', label: 'Review assistant (demo)', placeholder: 'Updated placeholder' });
    assert.equal(result.state.text, 'Pending');
    assert.equal(result.state.queue[0].text, 'Queued');
    assert.equal(result.state.model, 'replacement');
    assert.equal(result.state.effort, 'low');
    assert.equal(result.sameInput && result.sameFiles && result.sameURL, true);
    assert.equal(await page.getByRole('textbox', { name: 'Edit queued message', exact: true }).inputValue(), 'Unsaved edit');
    assert.equal(await page.locator('.db-chat-composer__steer').count(), 0);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('menuitem', { name: 'New action', exact: true }).click();
    assert.equal(await page.evaluate(() => chatEvents.filter(event => event.name === 'action').at(-1).detail.action.id), 'fresh');
    assert.equal(await page.evaluate(() => composer.attachFiles([new File(['x'], 'blocked.txt')])), false);
    await page.getByRole('button', { name: 'Save edit', exact: true }).click();
    assert.equal(await page.evaluate(() => composer.getQueue()[0].text), 'Unsaved edit');
    assert.equal(await page.getByRole('textbox', { name: 'Edit queued message', exact: true }).isVisible(), false);
    await page.evaluate(() => { composer.updateOptions({ actions: [], capabilities: { attachments: true, steer: true } }); });
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    assert.equal(await page.getByRole('menuitem', { name: 'Add files', exact: true }).count(), 1);
    assert.equal(await page.getByRole('menuitem', { name: 'New action', exact: true }).count(), 0);
  } finally { await page.close(); }
});

test('placeholder updates do not rebuild UI; deferred options coalesce and destroyed handles reject updates', async () => {
  const { page } = await fixture();
  try {
    const result = await page.evaluate(() => {
      const input = composerRoot.querySelector('textarea'), model = composerRoot.querySelector('.db-chat-composer__model');
      const accepted = composer.updateOptions({ placeholder: 'First placeholder' });
      const unchanged = input === composerRoot.querySelector('textarea') && model.firstChild === composerRoot.querySelector('.db-chat-composer__model').firstChild;
      composer.setBusy(true);
      composer.updateOptions({ actions: [{ id: 'old', label: 'Old action' }], capabilities: { queue: false } });
      composer.updateOptions({ actions: [{ id: 'new', label: 'New action' }], capabilities: { steer: false }, placeholder: 'Latest placeholder' });
      composer.setBusy(false); composer.setDraft('Keep'); composer.setBusy(true);
      const disabled = composerRoot.querySelector('.db-chat-composer__send').disabled;
      const actions = Array.from(composerRoot.querySelectorAll('.db-chat-composer__add-menu button')).map(el => el.textContent);
      composer.destroy();
      return { accepted, unchanged, disabled, actions, rejected: composer.updateOptions({ placeholder: 'Disposed' }), placeholder: input.placeholder };
    });
    assert.equal(result.accepted && result.unchanged && result.disabled, true);
    assert.ok(result.actions.includes('New action'));
    assert.equal(result.actions.includes('Old action'), false);
    assert.equal(result.rejected, false);
    assert.equal(result.placeholder, 'Latest placeholder');
  } finally { await page.close(); }
});

test('pagehide aborts fake dictation even for bfcache while retaining controller, draft, and queue', async () => {
  const { page, errors } = await fixture({}, fakeRecognition);
  try {
    await page.evaluate(() => { composer.setBusy(true); composer.setDraft('Queued before hide'); });
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    await page.evaluate(() => composer.setDraft('Pending before hide'));
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    const result = await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      return { aborted: fakeSpeech.aborted, same: DAUB.createChatComposer(composerRoot) === composer, state: composer.getState(), starts: speechStarts };
    });
    assert.equal(result.aborted && result.same, true);
    assert.equal(result.state.dictation, 'stopped');
    assert.equal(result.state.text, 'Pending before hide');
    assert.equal(result.state.queue[0].text, 'Queued before hide');
    assert.equal(result.starts, 1);
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    assert.equal(await page.evaluate(() => speechStarts), 2);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
