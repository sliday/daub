import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { COMP_PROPS, COMP_CATEGORIES, buildSystemPrompt } from '../../mcp/lib/prompt.js';
import { validateSpec } from '../../mcp/lib/validate.js';
import { renderToHTML } from '../../mcp/lib/render.js';
import { onRequestPost } from '../../functions/api/mcp.js';
import { build, loadSources } from '../../tools/build-skill.mjs';

const require = createRequire(import.meta.url);
const { RENDERER_TYPES } = require('../../daub-render.js');
const { openUItoSpec, COMP_SCHEMA } = require('../../daub-openui-parser.js');
const source = await readFile(new URL('../../daub-render.js', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../../daub.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../daub.css', import.meta.url), 'utf8');
const args = ['models', 'model', 'effort', 'approval', 'mode', 'actions', 'capabilities', 'busy', 'placeholder', 'id'];
let browser, page;
before(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  page = await browser.newPage();
  await page.setContent('<main></main>');
  await page.addScriptTag({ content: source });
});
after(async () => { await browser?.close(); });

async function cloud(name, args) {
  const response = await onRequestPost({ request: new Request('https://daub.test/api/mcp', {
    method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), env: {} });
  const result = (await response.json()).result;
  assert.equal(result.isError, undefined, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

test('ChatComposer shares native options across renderer, local/cloud parser and catalogs', async () => {
  assert.ok(RENDERER_TYPES.includes('ChatComposer'));
  assert.deepEqual(COMP_SCHEMA.ChatComposer, args);
  assert.ok(COMP_CATEGORIES.flatMap(([, types]) => types).includes('ChatComposer'));
  const catalog = await cloud('get_component_catalog', {});
  assert.equal(catalog.categories.Chat.ChatComposer, COMP_PROPS.ChatComposer);
  assert.match(buildSystemPrompt([], 'Compose a message'), /- ChatComposer:/);
  const code = 'root = ChatComposer([{id: "demo", label: "Demo (simulated)", efforts: ["low", "high"]}], "demo", "high", "ask", "plan", [{id: "context", label: "Local context", icon: "file-text", disabled: true}], {queue: false, steer: false, attachments: true, folders: false, dictation: false, approval: true}, true, "Review a draft", "composer")';
  const spec = openUItoSpec(code);
  assert.equal(spec.elements[spec.root].props.model, 'demo');
  assert.equal(spec.elements[spec.root].props.capabilities.queue, false);
  assert.equal(validateSpec(spec).valid, true);
  const parsed = await cloud('parse_openui', { code });
  assert.deepEqual(parsed.spec, spec);
  assert.equal(parsed.validation.valid, true);
  assert.equal((await cloud('validate_spec', { spec: JSON.stringify(spec) })).valid, true);
  const named = openUItoSpec('root = ChatComposer(busy: false, mode: "chat", placeholder: "Draft")');
  assert.equal(named.elements[named.root].props.busy, false);
});

test('renderer emits an empty native form with escaped, round-trippable configuration', async () => {
  const attack = '\"><img src=x onerror="window.injected=true"></form><script>window.injected=true</script>&\u2028';
  const props = { models: [{ id: attack, label: attack, efforts: ['high'] }], model: attack, effort: 'high', approval: 'ask', mode: 'plan', actions: [{ id: attack, label: attack, icon: attack, disabled: true }], capabilities: { queue: false, dictation: false }, busy: true, placeholder: attack, id: attack, html: attack, onSend: attack };
  const result = await page.evaluate(props => {
    const spec = { root: 'composer', elements: { composer: { type: 'ChatComposer', props, children: ['child'] }, child: { type: 'Text', props: { content: 'Must not own native children' } } } };
    const root = renderElement(spec.elements, spec.root, 0);
    document.querySelector('main').replaceChildren(root);
    return { tag: root.tagName, id: root.id, children: root.childNodes.length, config: JSON.parse(root.getAttribute('data-db-chat-options')), html: root.outerHTML, react: root.hasAttribute('data-db-react'), injected: !!window.injected };
  }, props);
  assert.equal(result.tag, 'FORM');
  assert.equal(result.id, attack);
  assert.equal(result.children, 0);
  assert.equal(result.react, false);
  assert.equal(result.injected, false);
  assert.doesNotMatch(result.html, /<img|<script|onerror="/);
  assert.deepEqual(result.config, Object.fromEntries(args.filter(key => key !== 'id').map(key => [key, props[key]])));
});

test('HTML catalog and generated skill references expose ChatComposer with native dependency and demo labels', async () => {
  const sources = loadSources();
  assert.equal(sources.components.components.length, 90);
  const entry = sources.components.components.find(entry => entry.name === 'Chat Composer');
  assert.equal(entry.class, 'db-chat-composer');
  assert.equal(entry.element, 'form');
  assert.equal(entry.js, true);
  assert.match(entry.notes, /daub\.js/);
  assert.match(entry.notes, /simulated/);
  assert.match(entry.html, /data-db-chat-options=/);
  assert.match(sources.props.ChatComposer, /models:/);
  assert.ok(sources.renderers.includes('ChatComposer'));
  const generated = build();
  assert.match(generated.get('references/components.md'), /\*\*ChatComposer\*\*/);
  assert.match(generated.get('references/openui.md'), /ChatComposer\(/);
  for (const file of ['llms.txt', 'llms-compact.txt']) {
    const text = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    assert.match(text, /ChatComposer/);
    assert.match(text, /daub\.js/);
  }
});

test('AI-facing composition recipe validates and mounts the native workspace without nested cards', async () => {
  const doc = await readFile(new URL('../../references/components.md', import.meta.url), 'utf8');
  const recipe = doc.split('## Chat Composition Recipe\n')[1].split('## Spec types')[0];
  const spec = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(recipe)[1]);
  assert.equal(validateSpec(spec).valid, true);
  assert.match(recipe, /grants no permissions/);
  assert.match(recipe, /detail\.state/);
  assert.equal(spec.elements.composer.props.models[0].label, 'Demo model (simulated)');
  const workspace = await browser.newPage();
  try {
    await workspace.setContent('<main></main>');
    await workspace.addStyleTag({ content: css });
    await workspace.addScriptTag({ content: source });
    await workspace.evaluate(spec => document.querySelector('main').appendChild(renderElement(spec.elements, spec.root, 0)), spec);
    await workspace.addScriptTag({ content: runtime });
    await workspace.evaluate(() => DAUB.init(document));
    assert.equal(await workspace.locator('.db-sidebar__item').count(), 4);
    assert.equal(await workspace.locator('.db-navbar__nav .db-menubar').count(), 1);
    assert.equal(await workspace.locator('.db-menubar__dropdown .db-dropdown__item').count(), 6);
    assert.equal(await workspace.locator('.db-message-scroller__content .db-message').count(), 1);
    assert.equal(await workspace.locator('#chat-composer .db-chat-composer__panel').count(), 1);
    assert.equal(await workspace.locator('.db-card, form form').count(), 0);
  } finally { await workspace.close(); }
});

for (const mode of ['local', 'cloud']) {
  test(`${mode} exported HTML auto-initializes escaped native options and host events at desktop/mobile widths`, async () => {
    const attack = '\"><img src=x onerror="window.injected=true"></form><script>window.injected=true</script>';
    const props = { models: [{ id: 'custom', label: attack, efforts: ['low', 'high'] }], model: 'custom', effort: 'high', approval: 'auto', mode: 'plan', actions: [{ id: 'context', label: attack }], capabilities: { dictation: false, folders: false }, busy: true, placeholder: attack, id: 'compose' };
    const spec = { root: 'compose', elements: { compose: { type: 'ChatComposer', props } } };
    const work = await mkdtemp(join(tmpdir(), 'daub-composer-export-'));
    try {
      const html = mode === 'local' ? await readFile(renderToHTML(spec, join(work, 'composer.html')), 'utf8') : (await cloud('render_spec', { spec: JSON.stringify(spec) })).html;
      for (const width of [1280, 390]) {
        const exported = await browser.newPage({ viewport: { width, height: 900 } });
        exported.setDefaultTimeout(3000);
        const errors = [];
        exported.on('pageerror', error => errors.push(error.message));
        await exported.route('**/*', route => {
          const url = route.request().url();
          if (url === 'http://daub.test/') return route.fulfill({ contentType: 'text/html', body: html });
          if (url.includes('/daub.js')) return route.fulfill({ contentType: 'application/javascript', body: runtime });
          if (url.includes('/daub.css')) return route.fulfill({ contentType: 'text/css', body: css });
          if (url.includes('lucide')) return route.fulfill({ contentType: 'application/javascript', body: 'window.lucide = { createIcons() {} };' });
          return route.fulfill({ body: '' });
        });
        try {
          await exported.goto('http://daub.test/');
          const root = exported.locator('#compose');
          assert.equal(await root.locator('.db-chat-composer__panel').count(), 1);
          assert.equal(await root.locator('.db-chat-composer__input').getAttribute('placeholder'), attack);
          assert.equal(await root.locator('img,script,[onerror]').count(), 0);
          assert.equal(await root.locator('.db-chat-composer__model option').textContent(), attack);
          const state = await exported.evaluate(() => {
            window.handle = DAUB.createChatComposer(document.getElementById('compose'));
            return handle.getState();
          });
          assert.equal(state.model, 'custom');
          assert.equal(state.effort, 'high');
          assert.equal(state.busy, true);
          assert.equal(state.approval, 'auto');
          assert.equal(state.mode, 'plan');
          await exported.evaluate(() => {
            handle.setBusy(false);
            document.getElementById('compose').addEventListener('db:chat-send', event => { window.request = event.detail.request; event.preventDefault(); });
            handle.setDraft('Retain rejected draft');
            DAUB.init(document);
          });
          await exported.getByRole('button', { name: 'Send message', exact: true }).click();
          assert.equal(await exported.evaluate(() => request.text), 'Retain rejected draft');
          assert.equal(await exported.evaluate(() => handle.getState().text), 'Retain rejected draft');
          assert.equal(await exported.locator('.db-chat-composer__panel').count(), 1);
          assert.equal(await exported.evaluate(() => !!window.injected), false);
          assert.deepEqual(errors, []);
          await exported.evaluate(() => handle.destroy());
        } finally { await exported.close(); }
      }
    } finally { await rm(work, { recursive: true, force: true }); }
  });
}
