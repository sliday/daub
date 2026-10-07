import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(new URL('../../react/package.json', import.meta.url));
const { build } = require('esbuild');
const bundle = await build({ entryPoints: [fileURLToPath(new URL('../../react/src/index.ts', import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime'] });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, module, module.exports);
const { createElement: h } = require('react');
const { renderToString } = require('react-dom/server');
const render = props => {
  assert.ok(module.exports.ChangeSummary, 'Missing public ChangeSummary export');
  return renderToString(h(module.exports.ChangeSummary, props));
};
const files = [{ path: 'app.ts', additions: 6, deletions: 4, status: 'modified' }, { path: 'summary.ts', additions: 42 }];

test('React summary renders labelled totals and file rows without implicit actions or native globals', () => {
  const html = render({ files, id: 'changes', className: 'custom', description: 'Simulated changes' });
  assert.match(html, /class="db-change-summary custom"/);
  assert.match(html, /data-db-react=""/);
  assert.match(html, /Edited 2 files/);
  assert.match(html, /<p class="db-change-summary__description">Simulated changes<\/p><span class="db-change-summary__totals">/);
  assert.match(render({ files }), /<div class="db-change-summary__title">Edited 2 files<\/div><span class="db-change-summary__totals">/);
  assert.match(html, /aria-label="48 additions">\+48/);
  assert.match(html, /aria-label="4 deletions">-4/);
  assert.match(html, /data-status="modified"/);
  assert.match(html, /data-lucide="files"/);
  assert.doesNotMatch(html, /<button|db-change-summary__actions|files=|undoDisabled=|description=/);
});

test('React summary escapes text and uses safe integers and honest empty states', () => {
  const attack = '"><script>attack</script>&';
  const html = render({ files: [{ path: attack, additions: NaN, deletions: -4 }, { path: 'large.ts', additions: Number.MAX_VALUE, deletions: Infinity }, { path: 'fraction.ts', additions: 6.8 }], title: attack, description: attack });
  assert.doesNotMatch(html, /<script|NaN|Infinity/);
  assert.match(html, /&lt;script&gt;attack&lt;\/script&gt;/);
  assert.match(html, new RegExp(`aria-label="${Number.MAX_SAFE_INTEGER} additions"`));
  assert.match(html, /aria-label="6 additions"/);
  assert.match(render({ files: [] }), /No files changed/);
  assert.doesNotMatch(render({ files: [] }), /Edited/);
  assert.match(render({ files: [{ path: 'a.ts' }] }), /Edited 1 file/);
});

test('React buttons require callbacks, respect undoDisabled and preserve arbitrary children', () => {
  const html = render({ files, onUndo() {}, onViewChanges() {}, undoLabel: 'Revert', undoDisabled: true, children: h('button', { type: 'button' }, 'Apply patch') });
  assert.match(html, /disabled=""/);
  assert.match(html, /Revert/);
  assert.match(html, /View changes/);
  assert.match(html, /Apply patch/);
  assert.equal((html.match(/<button/g) || []).length, 3);
  assert.doesNotMatch(html, /onUndo=|onViewChanges=|undoLabel=/);
  assert.doesNotMatch(render({ files, undoLabel: 'Revert', undoDisabled: true }), /<button/);
});

test('React places a numeric zero child inside the action slot', () => {
  const html = render({ files: [], children: 0 });
  assert.match(html, /class="db-change-summary__actions">0<\/div>/);
});

test('React callbacks, child actions and forwarded ref work without daub.js', async () => {
  assert.ok(module.exports.ChangeSummary, 'Missing public ChangeSummary export');
  const script = await build({ entryPoints: [fileURLToPath(new URL('change-summary-fixture.tsx', import.meta.url))], bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', nodePaths: [fileURLToPath(new URL('../../react/node_modules', import.meta.url))] });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: script.outputFiles[0].text });
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.getByRole('button', { name: 'View changes', exact: true }).click();
    await page.getByRole('button', { name: 'Apply patch', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.summaryEvents), ['undo', 'view', 'child']);
    assert.equal(await page.evaluate(() => window.summaryRef.current instanceof HTMLDivElement), true);
    await page.evaluate(() => window.disableUndo());
    await page.waitForFunction(() => document.querySelector('.db-change-summary__actions button').disabled);
    assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled(), true);
    await page.evaluate(() => window.unmountSummary());
    assert.equal(await page.evaluate(() => window.summaryRef.current), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('public file, callback and native spec types match the confirmed contract', () => {
  const ts = require('typescript');
  const file = fileURLToPath(new URL('../../react/src/change-summary-type-check.tsx', import.meta.url));
  const source = `import { createRef } from "react";
import { ChangeSummary, type ChangeSummaryFile, type ChangeSummaryProps } from "./index";
const files: ChangeSummaryFile[] = [{path: "app.ts", additions: 6, deletions: 4, status: "modified"}];
const props: ChangeSummaryProps = {files, title: "Edited 1 file", description: "Host changes", undoLabel: "Revert", undoDisabled: true,
  onUndo(event) { const button: HTMLButtonElement = event.currentTarget; },
  onViewChanges(event) { const button: HTMLButtonElement = event.currentTarget; }};
const summary = <ChangeSummary {...props} ref={createRef<HTMLDivElement>()}><button type="button">Apply patch</button></ChangeSummary>;
const native: DAUBChangeSummaryProps = {files, children: ["host-undo", "host-view"]};
// @ts-expect-error counts require numbers
const badCount: ChangeSummaryFile = {path: "app.ts", additions: "6"};
// @ts-expect-error status uses the confirmed enum
const badStatus: ChangeSummaryFile = {path: "app.ts", status: "renamed"};
`;
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX };
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.readFile = path => path === file ? source : read(path);
  host.fileExists = path => path === file || exists(path);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file, fileURLToPath(new URL('../../daub.d.ts', import.meta.url))], options, host));
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});
