import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const reactDirectory = fileURLToPath(new URL('../../react', import.meta.url));
const require = createRequire(new URL('../../react/package.json', import.meta.url));

test('package bundles the MIT headless engine and loads ESM/CJS with SSR on the current Node runtime', async () => {
  const directory = mkdtempSync('/private/tmp/daub-chat-package-');
  try {
    execFileSync(process.execPath, [join(dirname(require.resolve('tsup')), 'cli-default.js'), '--out-dir', directory], {
      cwd: reactDirectory, encoding: 'utf8', stdio: 'pipe', timeout: 90000,
    });
    symlinkSync(join(reactDirectory, 'node_modules'), join(directory, 'node_modules'), 'dir');
    const cjs = readFileSync(join(directory, 'index.js'), 'utf8');
    const esm = readFileSync(join(directory, 'index.mjs'), 'utf8');
    assert.doesNotMatch(cjs, /require\(["']@shadcn\/react/);
    assert.doesNotMatch(esm, /from\s*["']@shadcn\/react/);
    const modules = [require(join(directory, 'index.js')), await import(pathToFileURL(join(directory, 'index.mjs')).href)];
    const { createElement: h } = require('react');
    const { renderToString } = require('react-dom/server');
    for (const chat of modules) {
      assert.equal(typeof chat.useMessageScroller, 'function');
      const html = renderToString(h(chat.MessageScrollerProvider, null, h(chat.MessageScroller, null,
        h(chat.MessageScrollerViewport, null, h(chat.MessageScrollerContent, null,
          h(chat.MessageScrollerItem, { messageId: 'package-row' }, 'Packaged reply'))), h(chat.MessageScrollerButton))));
      assert.match(html, /data-db-message-id="package-row"/);
      assert.match(html, /Packaged reply/);
    }
    assert.match(readFileSync(join(directory, 'index.d.ts'), 'utf8'), /MessageScrollerProviderProps/);
    assert.match(readFileSync(join(directory, 'index.d.mts'), 'utf8'), /AttachmentState/);
    const upstreamLicense = readFileSync(join(reactDirectory, 'node_modules/@shadcn/react/LICENSE.md'), 'utf8');
    assert.ok(readFileSync(join(reactDirectory, 'THIRD_PARTY_NOTICES.md'), 'utf8').includes(upstreamLicense.trim()));
    const manifest = JSON.parse(readFileSync(join(reactDirectory, 'package.json'), 'utf8'));
    assert.equal(manifest.peerDependencies.react, '>=19');
    assert.equal(manifest.peerDependencies['react-dom'], '>=19');
    const packs = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--cache', '/private/tmp/daub-react-npm-cache'], {
      cwd: reactDirectory, encoding: 'utf8', stdio: 'pipe', timeout: 30000,
    }));
    const pack = Array.isArray(packs) ? packs[0] : packs[manifest.name];
    assert.ok(pack.files.some(file => file.path === 'THIRD_PARTY_NOTICES.md'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
