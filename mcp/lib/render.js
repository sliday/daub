import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LZString from 'lz-string';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(process.env.TMPDIR || '/tmp', 'daub-mcp');

// Ensure tmp directory exists
try { fs.mkdirSync(TMP_DIR, { recursive: true }); } catch {}

export function buildPreviewURL(spec) {
  const json = typeof spec === 'string' ? spec : JSON.stringify(spec);
  const compressed = LZString.compressToEncodedURIComponent(json);
  return `https://daub.dev/playground?s=${compressed}`;
}

export function renderToHTML(spec, outputPath) {
  const theme = spec.theme || 'light';
  const specJSON = JSON.stringify(spec, null, 2);

  // Read the renderer template — it's the bulk of the file
  const rendererCode = fs.readFileSync(path.join(__dirname, 'renderers.js'), 'utf-8');

  const html = `<!DOCTYPE html>
<html data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAUB UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daub-ui@3/daub.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"><\/script>
  <style>
    body { margin: 0; padding: 16px; font-family: Inter, system-ui, sans-serif; background: var(--db-bg); color: var(--db-fg); }
    #app { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/daub-ui@3/daub.js"><\/script>
  <script>
  (function() {
    var spec = ${specJSON};
${rendererCode}
    // ---- Render the spec ----
    var root = renderElement(spec.elements, spec.root, 0);
    if (root) document.getElementById('app').appendChild(root);

    // Render orphan elements (overlays etc.)
    var rendered = {};
    document.querySelectorAll('[data-spec-id]').forEach(function(n) { rendered[n.getAttribute('data-spec-id')] = true; });
    Object.keys(spec.elements).forEach(function(id) {
      if (id !== spec.root && !rendered[id]) {
        var orphan = renderElement(spec.elements, id, 0);
        if (orphan) document.getElementById('app').appendChild(orphan);
      }
    });

    // Init DAUB + Lucide icons
    if (typeof DAUB !== 'undefined') DAUB.init();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  })();
  <\/script>
</body>
</html>`;

  // Determine output path
  const filePath = outputPath || path.join(TMP_DIR, `daub-${Date.now()}.html`);
  const dir = path.dirname(filePath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  fs.writeFileSync(filePath, html);

  return filePath;
}

export function specSummary(spec) {
  if (!spec || !spec.elements) return 'Empty spec';
  const types = new Set();
  for (const def of Object.values(spec.elements)) {
    if (def.type) types.add(def.type);
  }
  const count = Object.keys(spec.elements).length;
  return `${count} elements, ${types.size} component types, theme: ${spec.theme || 'light'}`;
}
