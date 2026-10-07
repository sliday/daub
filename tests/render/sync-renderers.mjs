import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { DAUB_RENDER_BODY, RENDERER_TYPES, THEMES, normalizeTheme, serializeSpec } = require('../../daub-render.js');
const target = new URL('../../mcp/lib/renderers.js', import.meta.url);

export function buildRendererModule() {
  return '// Generated from daub-render.js. Run node tests/render/sync-renderers.mjs --write.\n'
    + 'export const DAUB_RENDER_BODY = [\n'
    + DAUB_RENDER_BODY.split('\n').map(line => '  ' + JSON.stringify(line)).join(',\n')
    + "\n].join('\\n');\n"
    + 'export const RENDERER_TYPES = ' + JSON.stringify(RENDERER_TYPES) + ';\n'
    + 'export const THEMES = ' + JSON.stringify(THEMES) + ';\n'
    + 'export ' + normalizeTheme.toString() + '\n'
    + 'export ' + serializeSpec.toString() + '\n';
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const generated = buildRendererModule();
  if (process.argv.includes('--write')) await writeFile(target, generated);
  else if (await readFile(target, 'utf8') !== generated) {
    throw new Error('MCP renderer snapshot differs from daub-render.js; run with --write.');
  }
}
