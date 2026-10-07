import assert from 'node:assert/strict';
import { before, beforeEach, after, afterEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(new URL('../../react/package.json', import.meta.url));
const { build } = require('esbuild');
const runtime = await readFile(new URL('../../daub.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../daub.css', import.meta.url), 'utf8');
let browser, page, script, errors;
const models = [{ id: 'demo', label: 'Demo model (simulated)', efforts: ['low', 'high'] }, { id: 'host', label: 'Host model', efforts: ['low', 'high'] }];
before(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./chat-composer-fixture.tsx', import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    nodePaths: [fileURLToPath(new URL('../../react/node_modules', import.meta.url))],
  });
  script = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
beforeEach(async () => {
  page = await browser.newPage();
  page.setDefaultTimeout(3000);
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: runtime });
  await page.evaluate(() => {
    window.creations = []; window.disposals = 0;
    const create = DAUB.createChatComposer;
    DAUB.createChatComposer = (root, options) => {
      creations.push({ options, reactOwned: root.hasAttribute('data-db-react'), empty: !root.childElementCount });
      const handle = create(root, options);
      if (handle) {
        const destroy = handle.destroy;
        handle.destroy = () => { disposals++; destroy(); };
      }
      return handle;
    };
  });
  await page.addScriptTag({ content: script });
});
afterEach(async () => { await page?.close(); assert.deepEqual(errors, []); });
after(async () => { await browser?.close(); });
const mount = (props = {}, cancel = false, version = 'first', strict = false) => page.evaluate(({ props, cancel, version, strict }) => mountComposer(props, cancel, version, strict), { props: { models, ...props }, cancel, version, strict });
const state = () => page.evaluate(() => composerHandles.at(-1).getState());

test('React initializes the native controller on an empty root and native auto-init leaves it alone', async () => {
  await mount({ id: 'compose', model: 'demo', effort: 'high', approval: 'auto', mode: 'plan', busy: true, placeholder: 'Review draft' });
  assert.deepEqual(await page.evaluate(() => creations.map(({ reactOwned, empty }) => ({ reactOwned, empty }))), [{ reactOwned: true, empty: true }]);
  assert.equal(await page.evaluate(() => composerRoot().id), 'compose');
  assert.equal(await page.locator('textarea.db-chat-composer__input').getAttribute('placeholder'), 'Review draft');
  assert.equal((await state()).busy, true);
  assert.equal((await state()).effort, 'high');
  assert.equal((await state()).approval, 'auto');
  await page.evaluate(() => DAUB.init(document));
  assert.equal(await page.evaluate(() => creations.length), 1);
  const declared = await page.locator('form').getAttribute('data-db-chat-options');
  assert.equal(JSON.parse(declared).model, 'demo');
  await page.evaluate(() => unmountComposer());
  assert.equal(await page.evaluate(() => disposals), 1);
  assert.equal(await page.evaluate(() => composerRoot()), null);
});

test('callbacks forward cancelable native requests and update without resetting drafts, files or queue', async () => {
  await mount({}, true);
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Keep this draft');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  assert.equal((await state()).text, 'Keep this draft');
  assert.equal(await page.evaluate(() => composerEvents.filter(event => event.type === 'db:chat-send').at(-1).cancelable), true);
  await page.evaluate(() => { window.localFile = new File(['private'], 'draft.txt'); composerHandles.at(-1).attachFiles([localFile]); });
  await mount({}, false, 'second');
  assert.equal(await page.evaluate(() => creations.length), 1);
  assert.equal(await page.evaluate(() => composerHandles.at(-1).getState().files[0] === localFile), true);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  assert.equal((await state()).text, '');
  assert.equal(await page.evaluate(() => composerEvents.filter(event => event.type === 'db:chat-send').at(-1).version), 'second');
  await mount({ busy: true });
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Queued draft');
  await page.getByRole('button', { name: 'Queue message', exact: true }).click();
  assert.equal((await state()).queue.length, 1);
  await mount({ busy: false, model: 'host', effort: 'high', mode: 'plan', approval: 'auto' });
  assert.equal(await page.evaluate(() => creations.length), 1);
  assert.equal((await state()).queue[0].text, 'Queued draft');
  assert.equal((await state()).model, 'host');
  assert.equal((await state()).effort, 'high');
  assert.equal((await state()).mode, 'plan');
  assert.equal((await state()).approval, 'auto');
});

test('event mapping forwards steer, stop, action, queue, config, dictation and change with cancellation intact', async () => {
  await mount({}, true);
  const results = await page.evaluate(() => {
    composerEvents.length = 0;
    const root = composerRoot();
    const data = {
      send: { request: { id: 'r', text: 'Draft', files: [] } },
      steer: { request: { id: 'q', text: 'Queue', files: [] } },
      stop: undefined, action: { action: { id: 'context', label: 'Local context' } },
      queue: { request: null, queue: [] },
      config: { model: 'demo', effort: 'low', approval: 'ask', mode: 'chat', goal: null },
      dictation: { state: 'error', error: 'denied' },
      change: { state: { text: 'Draft', files: [], queue: [], busy: false, model: 'demo', effort: 'low', approval: 'ask', mode: 'chat', goal: null, dictation: 'unsupported' } },
    };
    return Object.entries(data).map(([name, detail]) => {
      const event = new CustomEvent('db:chat-' + name, { bubbles: true, cancelable: ['send', 'steer', 'stop', 'action'].includes(name), detail });
      return [name, root.dispatchEvent(event)];
    });
  });
  assert.deepEqual(results, [['send', false], ['steer', false], ['stop', false], ['action', false], ['queue', true], ['config', true], ['dictation', true], ['change', true]]);
  assert.deepEqual(await page.evaluate(() => composerEvents.map(event => event.type)), ['db:chat-send', 'db:chat-steer', 'db:chat-stop', 'db:chat-action', 'db:chat-queue', 'db:chat-config', 'db:chat-dictation', 'db:chat-change']);
  await page.evaluate(() => { window.detached = composerRoot(); unmountComposer(); composerEvents.length = 0; detached.dispatchEvent(new CustomEvent('db:chat-send')); });
  assert.deepEqual(await page.evaluate(() => composerEvents), []);
});

test('clearDraft removes pending text and files while retaining the native queue and informing sidebar counts', async () => {
  await mount({ busy: true });
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Keep queued');
  await page.getByRole('button', { name: 'Queue message', exact: true }).click();
  const result = await page.evaluate(() => {
    const handle = composerHandles.at(-1);
    handle.setDraft('Discard pending');
    handle.attachFiles([new File(['local'], 'pending.txt')]);
    composerEvents.length = 0;
    const cleared = handle.clearDraft();
    return { cleared, state: handle.getState(), events: composerEvents.filter(event => event.type === 'db:chat-change') };
  });
  assert.equal(result.cleared, true);
  assert.equal(result.state.text, '');
  assert.deepEqual(result.state.files, []);
  assert.equal(result.state.queue[0].text, 'Keep queued');
  assert.equal(result.events.at(-1).detail.state.files.length, 0);
  assert.equal(result.events.at(-1).detail.state.queue.length, 1);
});

test('StrictMode and setup updates keep one live native instance without duplicate panels or callbacks', async () => {
  await mount({ placeholder: 'First' }, false, 'first', true);
  assert.equal(await page.evaluate(() => creations.length - disposals), 1);
  const created = await page.evaluate(() => creations.length);
  const disposed = await page.evaluate(() => disposals);
  const ready = await page.evaluate(() => composerHandles.length);
  assert.equal(await page.locator('.db-chat-composer__panel').count(), 1);
  await mount({ placeholder: 'Second' }, false, 'second', true);
  assert.equal(await page.evaluate(() => creations.length), created);
  assert.equal(await page.evaluate(() => disposals), disposed);
  assert.equal(await page.evaluate(() => composerHandles.length), ready);
  assert.equal(await page.evaluate(() => creations.length - disposals), 1);
  assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).getAttribute('placeholder'), 'Second');
  await page.evaluate(() => { composerEvents.length = 0; composerRoot().dispatchEvent(new CustomEvent('db:chat-config', { detail: { model: 'host' } })); });
  assert.equal(await page.evaluate(() => composerEvents.length), 1);
  await page.evaluate(() => unmountComposer());
  assert.equal(await page.evaluate(() => creations.length), await page.evaluate(() => disposals));
});

test('placeholder and structural prop updates preserve draft text, File identity and queued requests', async () => {
  await mount({ busy: true });
  await page.evaluate(() => {
    window.queuedFile = new File(['queued'], 'queued.txt');
    composerHandles.at(-1).attachFiles([queuedFile]);
    composerHandles.at(-1).setDraft('Queued request');
  });
  await page.getByRole('button', { name: 'Queue message', exact: true }).click();
  await page.evaluate(() => {
    window.pendingFile = new File(['pending'], 'pending.txt');
    composerHandles.at(-1).attachFiles([pendingFile]);
    composerHandles.at(-1).setDraft('Pending draft');
    window.queuedId = composerHandles.at(-1).getQueue()[0].id;
  });
  const options = {
    busy: false, placeholder: 'Updated placeholder',
    models: [...models, { id: 'extra', label: 'Extra host model', efforts: ['high'] }],
    actions: [{ id: 'context', label: 'Local context' }],
    capabilities: { folders: false, dictation: false, attachments: false, queue: false, steer: false },
  };
  await mount(options, true, 'updated');
  assert.equal(await page.evaluate(() => creations.length), 1);
  assert.equal(await page.evaluate(() => disposals), 0);
  assert.equal(await page.evaluate(() => composerHandles.length), 1);
  assert.deepEqual(await page.evaluate(() => {
    const current = composerHandles.at(-1).getState();
    return { text: current.text, pending: current.files[0] === pendingFile, queued: current.queue[0].files[0] === queuedFile, id: current.queue[0].id === queuedId, queueText: current.queue[0].text };
  }), { text: 'Pending draft', pending: true, queued: true, id: true, queueText: 'Queued request' });
  assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).getAttribute('placeholder'), options.placeholder);
  assert.deepEqual(await page.locator('.db-chat-composer__model option').allTextContents(), models.map(model => model.label).concat('Extra host model'));
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'Local context', exact: true }).count(), 1);
  assert.equal(await page.getByRole('menuitem', { name: 'Add files', exact: true }).count(), 0);
  await page.getByRole('menuitem', { name: 'Local context', exact: true }).click();
  assert.equal(await page.evaluate(() => composerEvents.filter(event => event.type === 'db:chat-action').at(-1).version), 'updated');
  await mount({ ...options, busy: true });
  assert.equal(await page.getByRole('button', { name: 'Queue message', exact: true }).count(), 0);
});

test('model and effort apply the latest requested values after busy unlocks with unchanged props', async () => {
  await mount({ model: 'demo', effort: 'low', busy: true });
  await mount({ model: 'host', effort: 'high', busy: true });
  assert.equal((await state()).model, 'demo');
  assert.equal((await state()).effort, 'low');
  await mount({ model: 'host', effort: 'high', busy: false });
  assert.equal((await state()).model, 'host');
  assert.equal((await state()).effort, 'high');
  assert.equal(await page.evaluate(() => creations.length), 1);
  await mount({ model: 'demo', effort: 'high', busy: false });
  assert.equal((await state()).model, 'demo');
  assert.equal((await state()).effort, 'high');
});

test('wrapper orders busy, structural updates and controlled setters against a locking controller', async () => {
  await page.evaluate(() => {
    window.calls = [];
    DAUB.createChatComposer = (root, options) => {
      creations.push({ options });
      let configured = options, deferred = null;
      const current = { text: '', files: [], queue: [], busy: !!options.busy, model: options.model, effort: options.effort };
      return {
        getState: () => current,
        getQueue: () => current.queue,
        setDraft: text => { current.text = text; return true; },
        attachFiles: files => { current.files.push(...files); return true; },
        setBusy: value => {
          calls.push(['busy', value]); current.busy = value;
          if (!value && deferred) { configured = { ...configured, ...deferred }; deferred = null; }
        },
        updateOptions: value => {
          calls.push(['options', value]);
          if (current.busy) deferred = value;
          else configured = { ...configured, ...value };
          return true;
        },
        setModel: value => {
          calls.push(['model', value, current.busy]);
          if (current.busy || !configured.models.some(model => model.id === value)) return false;
          current.model = value; current.effort = configured.models.find(model => model.id === value).efforts[0]; return true;
        },
        setEffort: value => {
          calls.push(['effort', value, current.busy]);
          if (current.busy || !configured.models.find(model => model.id === current.model).efforts.includes(value)) return false;
          current.effort = value; return true;
        },
        destroy: () => { disposals++; },
      };
    };
  });
  await mount({ model: 'demo', effort: 'low', busy: true });
  await page.evaluate(() => {
    window.file = new File(['local'], 'local.txt');
    const handle = composerHandles.at(-1);
    handle.setDraft('Keep pending'); handle.attachFiles([file]);
    handle.getQueue().push({ id: 'queued', text: 'Keep queued', files: [file] });
  });
  const requested = { models: [...models, { id: 'new', label: 'New model', efforts: ['low', 'high'] }], placeholder: 'Changed', actions: [{ id: 'context', label: 'Context' }], capabilities: { queue: false }, model: 'new', effort: 'high', busy: true };
  await mount(requested);
  assert.equal((await state()).model, 'demo');
  await page.evaluate(() => { calls.length = 0; });
  await mount({ ...requested, busy: false });
  assert.deepEqual(await page.evaluate(() => calls), [['busy', false], ['model', 'new', false], ['effort', 'high', false]]);
  assert.equal((await state()).model, 'new');
  assert.equal((await state()).effort, 'high');
  assert.equal((await state()).text, 'Keep pending');
  assert.equal(await page.evaluate(() => composerHandles.at(-1).getState().files[0] === file), true);
  assert.equal((await state()).queue[0].text, 'Keep queued');
  assert.equal(await page.evaluate(() => creations.length), 1);
  assert.equal(await page.evaluate(() => composerHandles.length), 1);
  await page.evaluate(() => unmountComposer());
  assert.equal(await page.evaluate(() => disposals), 1);
});

test('structural updates while busy keep queued files and apply the latest options before controlled unlock setters', async () => {
  await mount({ model: 'demo', effort: 'low', busy: true });
  await page.evaluate(() => {
    window.savedFile = new File(['local'], 'local.txt');
    composerHandles.at(-1).attachFiles([savedFile]);
    composerHandles.at(-1).setDraft('Keep the queue');
  });
  await page.getByRole('button', { name: 'Queue message', exact: true }).click();
  await mount({ busy: true, models: [...models, { id: 'new', label: 'Deferred model', efforts: ['low', 'high'] }], model: 'new', effort: 'low', actions: [{ id: 'old', label: 'Old action' }] });
  const latest = { busy: true, models: [...models, { id: 'new', label: 'Latest model', efforts: ['low', 'high'] }], model: 'new', effort: 'high', actions: [{ id: 'latest', label: 'Latest action' }], capabilities: { dictation: false }, placeholder: 'Latest prompt' };
  await mount(latest);
  assert.equal((await state()).model, 'demo');
  assert.equal(await page.evaluate(() => creations.length), 1);
  await mount({ ...latest, busy: false });
  assert.equal((await state()).model, 'new');
  assert.equal((await state()).effort, 'high');
  assert.equal((await state()).queue[0].text, 'Keep the queue');
  assert.equal(await page.evaluate(() => composerHandles.at(-1).getQueue()[0].files[0] === savedFile), true);
  assert.equal(await page.locator('.db-chat-composer__model option[value="new"]').textContent(), 'Latest model');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'Latest action', exact: true }).count(), 1);
  assert.equal(await page.getByRole('menuitem', { name: 'Old action', exact: true }).count(), 0);
});

test('missing runtime and null initialization report the native dependency without orphan listeners', async () => {
  await page.evaluate(() => { window.savedRuntime = window.DAUB; delete window.DAUB; });
  await mount();
  assert.match(await page.locator('#error').textContent(), /requires daub.js/);
  await page.evaluate(() => {
    unmountComposer(); remountComposer(); window.DAUB = savedRuntime;
    DAUB.createChatComposer = root => { window.failedRoot = root; return null; };
  });
  await mount();
  assert.match(await page.locator('#error').textContent(), /could not initialize/);
  await page.evaluate(() => { composerEvents.length = 0; failedRoot.dispatchEvent(new CustomEvent('db:chat-send')); });
  assert.deepEqual(await page.evaluate(() => composerEvents), []);
});
