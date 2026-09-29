import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LZString from 'lz-string';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(process.env.TMPDIR || '/tmp', 'daub-mcp');

// Ensure tmp directory exists
try { fs.mkdirSync(TMP_DIR, { recursive: true }); } catch {}

// First-party daub.dev assets always match the deployed site (npm can lag a release); ?v= busts caches per release.
// Version comes from the repo's package.json; outside the repo (no root package.json) fall back to the last known release
let DAUB_VERSION = '3.20.5';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8'));
  if (pkg.name === 'daub-ui' && pkg.version) DAUB_VERSION = pkg.version;
} catch {}
// Same pinned build + SRI as the playground export
const LUCIDE_SRC = 'https://cdn.jsdelivr.net/npm/lucide@0.576.0/dist/umd/lucide.min.js';
const LUCIDE_SRI = 'sha384-b05ba3pt6xaC7F4r130arhf8cF18GH/gKu9JDz/NMf+BhLlBVwIWUdAZSpf1IWRZ';

export function buildPreviewURL(spec) {
  const json = typeof spec === 'string' ? spec : JSON.stringify(spec);
  const compressed = LZString.compressToEncodedURIComponent(json);
  return `https://daub.dev/playground#s=${compressed}`;
}

// \u-escape chars that could close the inline <script> or break JS parsing
function scriptSafeJSON(value) {
  return JSON.stringify(value, null, 2).replace(/[<>&\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderToHTML(spec, outputPath) {
  const theme = escAttr(spec.theme || 'light');
  const specJSON = scriptSafeJSON(spec);

  // Read the renderer template — it's the bulk of the file
  const rendererCode = fs.readFileSync(path.join(__dirname, 'renderers.js'), 'utf-8');

  const html = `<!DOCTYPE html>
<html data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAUB UI</title>
  <link rel="stylesheet" href="https://daub.dev/daub.css?v=${DAUB_VERSION}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="${LUCIDE_SRC}" integrity="${LUCIDE_SRI}" crossorigin="anonymous"><\/script>
  <style>
    body { margin: 0; padding: 16px; font-family: Inter, system-ui, sans-serif; background: var(--db-color-bg); color: var(--db-color-text); }
    #app { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="https://daub.dev/daub.js?v=${DAUB_VERSION}"><\/script>
  <script>
  (function() {
    var spec = ${specJSON};
${rendererCode}
    // ---- Render the spec ----
    var root = renderElement(spec.elements, spec.root, 0);
    if (root) document.getElementById('app').appendChild(root);

    // Render orphan elements (overlays etc.)
    renderOrphans(spec, document.getElementById('app'));

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
