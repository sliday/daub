import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../react/package.json', import.meta.url));
const ts = require('typescript');

test('composer types accept native commands, local Files and object/string actions with optional requests', () => {
  const file = fileURLToPath(new URL('../../react/src/composer-type-check.ts', import.meta.url));
  const source = `import type { ChatComposerController, ChatComposerProps, ChatComposerActionDetail, ChatComposerRequest } from "./components/ChatComposer";
declare const controller: ChatComposerController;
declare const props: ChatComposerProps;
declare const request: ChatComposerRequest;
const cleared: boolean = controller.clearDraft();
const updated: boolean = controller.updateOptions({ placeholder: "Draft", capabilities: { queue: false } });
const files: File[] = controller.getState().files;
const configured: ChatComposerActionDetail = { action: { id: "context", label: "Context" } };
const side: ChatComposerActionDetail = { action: "side-chat", request };
const optional: ChatComposerActionDetail = { action: "host-action" };
props.onAction?.(new CustomEvent("db:chat-action", { detail: configured }));
props.onAction?.(new CustomEvent("db:chat-action", { detail: side }));
props.onAction?.(new CustomEvent("db:chat-action", { detail: optional }));
props.onChange?.(new CustomEvent("db:chat-change", { detail: { state: controller.getState() } }));
`;
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX };
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host);
  const exists = host.fileExists.bind(host);
  host.readFile = path => path === file ? source : read(path);
  host.fileExists = path => path === file || exists(path);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file], options, host));
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});
