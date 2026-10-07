import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { COMP_PROPS, COMP_CATEGORIES, buildSystemPrompt } from '../../mcp/lib/prompt.js';
import { validateSpec } from '../../mcp/lib/validate.js';
import { renderToHTML } from '../../mcp/lib/render.js';
import { DAUB_RENDER_BODY } from '../../mcp/lib/renderers.js';
import { onRequestPost } from '../../functions/api/mcp.js';
import { build, loadSources } from '../../tools/build-skill.mjs';

const require = createRequire(import.meta.url);
const { RENDERER_TYPES } = require('../../daub-render.js');
const { COMP_SCHEMA, openUItoSpec } = require('../../daub-openui-parser.js');
const source = await readFile(new URL('../../daub-render.js', import.meta.url), 'utf8');
const files = [{ path: 'src/app.ts', additions: 6, deletions: 4, status: 'modified' }, { path: 'src/summary.ts', additions: 42, deletions: 0, status: 'added' }];
const spec = props => ({ root: 'summary', elements: { summary: { type: 'ChangeSummary', props } } });
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }); });
after(async () => { await browser?.close(); });

async function cloud(name, args) {
  const response = await onRequestPost({ request: new Request('https://daub.test/api/mcp', {
    method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), env: {} });
  const result = (await response.json()).result;
  assert.equal(result.isError, undefined, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

test('ChangeSummary exposes the confirmed props across local/cloud catalogs and OpenUI', async () => {
  assert.ok(RENDERER_TYPES.includes('ChangeSummary'));
  assert.equal(RENDERER_TYPES.length, 89);
  assert.deepEqual(COMP_SCHEMA.ChangeSummary, ['children', 'files', 'title', 'description', 'undoLabel', 'undoDisabled']);
  assert.ok(COMP_CATEGORIES.flatMap(([, types]) => types).includes('ChangeSummary'));
  assert.match(buildSystemPrompt([], 'Show changed files'), /- ChangeSummary:/);
  const catalog = await cloud('get_component_catalog', {});
  assert.equal(catalog.categories.Chat.ChangeSummary, COMP_PROPS.ChangeSummary);
  const code = 'root = ChangeSummary([Button("View changes", "ghost")], [{path: "src/app.ts", additions: 6, deletions: 4, status: "modified"}], "Edited 1 file", "Simulated changes", "Revert", true)';
  const parsed = openUItoSpec(code);
  assert.deepEqual(parsed.elements[parsed.root].props, { files: [files[0]], title: 'Edited 1 file', description: 'Simulated changes', undoLabel: 'Revert', undoDisabled: true });
  assert.equal(parsed.elements[parsed.elements[parsed.root].children[0]].type, 'Button');
  assert.equal(validateSpec(parsed).valid, true);
  assert.deepEqual((await cloud('parse_openui', { code })).spec, parsed);
  assert.equal((await cloud('validate_spec', { spec: JSON.stringify(parsed) })).valid, true);
  const named = openUItoSpec('root = ChangeSummary(files: [], description: "Simulated changes")');
  assert.equal(named.elements[named.root].type, 'ChangeSummary');
  assert.deepEqual(named.elements[named.root].props.files, []);
});

for (const [name, script] of [['browser', source], ['MCP mirror', DAUB_RENDER_BODY]]) {
  test(`${name} renders reference totals, labelled counts and explicit host actions`, async () => {
    const page = await browser.newPage();
    try {
      await page.setContent('<main></main>');
      await page.addScriptTag({ content: script });
      await page.evaluate(files => {
        const elements = { summary: { type: 'ChangeSummary', props: { files, description: 'Simulated changes' }, children: ['undo', 'view'] }, undo: { type: 'Button', props: { label: 'Undo', variant: 'ghost', icon: 'undo-2' } }, view: { type: 'Button', props: { label: 'View changes', variant: 'ghost', icon: 'diff' } } };
        document.querySelector('main').appendChild(renderElement(elements, 'summary', 0));
        document.querySelector('[data-spec-id="undo"]').addEventListener('click', () => { window.hostUndo = true; });
      }, files);
      assert.equal(await page.locator('.db-change-summary__title').textContent(), 'Edited 2 files');
      assert.equal(await page.locator('.db-change-summary__description').textContent(), 'Simulated changes');
      assert.equal(await page.locator('.db-change-summary__heading > .db-change-summary__totals').count(), 1);
      assert.equal(await page.locator('.db-change-summary__header > .db-change-summary__totals').count(), 0);
      assert.deepEqual(await page.locator('.db-change-summary__totals > span').allTextContents(), ['+48', '-4']);
      assert.equal(await page.locator('.db-change-summary__totals .db-change-summary__additions').getAttribute('aria-label'), '48 additions');
      assert.equal(await page.locator('.db-change-summary__totals .db-change-summary__deletions').getAttribute('aria-label'), '4 deletions');
      assert.equal(await page.getByRole('img', { name: '48 additions', exact: true }).count(), 1);
      assert.equal(await page.getByRole('img', { name: '4 deletions', exact: true }).count(), 2);
      assert.deepEqual(await page.locator('.db-change-summary__file').evaluateAll(rows => rows.map(row => [row.querySelector('.db-change-summary__path').textContent, row.querySelector('.db-change-summary__counts').textContent])), [['src/app.ts', '+6-4'], ['src/summary.ts', '+42-0']]);
      assert.equal(await page.locator('.db-change-summary__icon [data-lucide="files"]').count(), 1);
      assert.equal(await page.locator('.db-change-summary__files').evaluate(el => el.tagName), 'UL');
      assert.deepEqual(await page.locator('.db-change-summary__file').evaluateAll(rows => rows.map(row => row.getAttribute('data-status'))), ['modified', 'added']);
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      assert.equal(await page.evaluate(() => window.hostUndo), true);
    } finally { await page.close(); }
  });

  test(`${name} escapes hostile strings, clamps counts and creates no implicit actions`, async () => {
    const page = await browser.newPage();
    try {
      await page.setContent('<main></main>');
      await page.addScriptTag({ content: script });
      const attack = '"><img src=x onerror="window.injected=true"><script>attack</script>&';
      const result = await page.evaluate(attack => {
        const props = { title: attack, description: attack, undoLabel: attack, undoDisabled: true, files: [
          { path: attack, additions: -3, deletions: Infinity, status: attack },
          { path: 'fraction.ts', additions: 6.9, deletions: NaN },
          { path: 'large.ts', additions: Number.MAX_VALUE, deletions: '4', status: 'deleted' },
          { path: 'omitted.ts' }, null, [], { additions: 9 },
        ] };
        const root = renderElement({ root: { type: 'ChangeSummary', props } }, 'root', 0);
        document.querySelector('main').appendChild(root);
        return { title: root.querySelector('.db-change-summary__title')?.textContent, paths: [...root.querySelectorAll('.db-change-summary__path')].map(el => el.textContent), counts: [...root.querySelectorAll('.db-change-summary__counts')].map(el => el.textContent), totals: root.querySelector('.db-change-summary__totals')?.textContent, unsafe: root.querySelectorAll('img,script,[onerror],button,a,.db-change-summary__actions').length, status: root.querySelector('.db-change-summary__file')?.getAttribute('data-status') };
      }, attack);
      assert.equal(result.title, attack);
      assert.equal(result.paths[0], attack);
      assert.deepEqual(result.counts, ['+0-0', '+6-0', `+${Number.MAX_SAFE_INTEGER}-0`, '+0-0']);
      assert.equal(result.totals, `+${Number.MAX_SAFE_INTEGER}-0`);
      assert.equal(result.unsafe, 0);
      assert.equal(result.status, null);
      assert.equal(await page.evaluate(() => !!window.injected), false);
    } finally { await page.close(); }
  });

  test(`${name} uses honest empty titles and singular file labels`, async () => {
    const page = await browser.newPage();
    try {
      await page.setContent('<main></main>');
      await page.addScriptTag({ content: script });
      for (const props of [{}, { files: [] }, { files: {} }, { files: [null, {}] }]) {
        const title = await page.evaluate(props => renderElement({ root: { type: 'ChangeSummary', props } }, 'root', 0).querySelector('.db-change-summary__title')?.textContent, props);
        assert.equal(title, 'No files changed');
      }
      const title = await page.evaluate(() => renderElement({ root: { type: 'ChangeSummary', props: { files: [{ path: 'a.ts', additions: 1 }] } } }, 'root', 0).querySelector('.db-change-summary__title')?.textContent);
      assert.equal(title, 'Edited 1 file');
    } finally { await page.close(); }
  });
}

test('local and cloud HTML exports retain escaped summaries without network access', async () => {
  const work = await mkdtemp(join(tmpdir(), 'daub-change-summary-'));
  const attack = '</script><img src=x onerror="window.injected=true">';
  try {
    const input = spec({ files: [{ path: attack, additions: 6, deletions: 4 }] });
    for (const html of [await readFile(renderToHTML(input, join(work, 'summary.html')), 'utf8'), (await cloud('render_spec', { spec: JSON.stringify(input) })).html]) {
      const page = await browser.newPage();
      try {
        await page.route('**/*', route => route.abort());
        await page.setContent(html);
        assert.equal(await page.locator('.db-change-summary__path').textContent(), attack);
        assert.equal(await page.locator('.db-change-summary__title').textContent(), 'Edited 1 file');
        assert.equal(await page.locator('#app img, #app script, #app button').count(), 0);
        assert.equal(await page.evaluate(() => !!window.injected), false);
      } finally { await page.close(); }
    }
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('native catalog and generated references document the static contract and host boundary', async () => {
  const sources = loadSources();
  assert.equal(sources.components.components.length, 91);
  const entry = sources.components.components.find(entry => entry.name === 'Change Summary');
  assert.ok(entry);
  assert.equal(entry.class, 'db-change-summary');
  assert.equal(entry.js, false);
  assert.match(entry.html, /Prepared 2 demo files/);
  assert.match(entry.html, /Demo changes/);
  assert.doesNotMatch(entry.html, /<button|<a\b/);
  assert.match(entry.html, /aria-label="48 additions"/);
  assert.match(entry.html, /aria-label="4 deletions"/);
  assert.match(entry.notes, /host/i);
  const generated = build();
  assert.match(generated.get('references/components.md'), /\*\*ChangeSummary\*\*/);
  assert.match(generated.get('references/openui.md'), /ChangeSummary\(/);
  const card = JSON.parse(await readFile(new URL('../../.well-known/mcp/server-card.json', import.meta.url), 'utf8'));
  assert.match(card.serverInfo.description, /89 spec renderer types/);
  for (const file of ['README.md', 'SKILL.md', 'llms.txt', 'llms-compact.txt']) {
    const text = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    assert.match(text, /91 components|Components: 91/);
    assert.match(text, /89 renderer types|renderer types: 89/);
    assert.doesNotMatch(text, /90 components|88 renderer types|renderer types: 88/);
  }
});
