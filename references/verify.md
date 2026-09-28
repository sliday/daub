# Verify DAUB output

Check a UI in four steps, cheapest first: parse, lint, render, look. Fix every hard failure in code before you show the result. Report soft issues, or fix them in one guided revision; do not loop an automatic repair on them.

| Hard failure (fix it) | Soft signal (report it) |
|---|---|
| OpenUI parses to `null`, JSON does not parse | A reviewer score in the middle of the scale |
| Unknown type, missing root, dangling child id | Spacing or hierarchy the reviewer dislikes |
| `Unknown: <Type>` notice or `[data-render-error]` in the page | A theme that fits less well than another |
| Empty ChartCard, Chart without bars, Text with no `content` | Copy that could be sharper |
| Blank or near-blank page, horizontal overflow on a phone | |
| An `icon` name that renders nothing | |

## 1. Parse

```js
const { openUItoSpec } = require('./daub-openui-parser.js'); // https://daub.dev/daub-openui-parser.js
const spec = text.trim().startsWith('{') ? JSON.parse(text) : openUItoSpec(text);
if (!spec) throw new Error('nothing parsed');
```

Without local files, MCP `parse_openui` returns the spec plus `validation`.

## 2. Lint

`validate_spec` checks types and ids only. This linter adds the golden rules from SKILL.md. Pass the parser's type list and the theme names; set `mcp: true` for specs you will send to the hosted MCP.

```js
// lintSpec(spec, { types: Object.keys(DaubOpenUI.COMP_SCHEMA), themes: DAUB.THEMES, mcp }) -> { errors, warnings }
function lintSpec(spec, { types = [], themes = [], mcp = false } = {}) {
  const errors = [], warnings = [];
  const els = spec && spec.elements;
  if (!els || typeof els !== 'object') return { errors: ['spec has no elements'], warnings };
  if (!els[spec.root]) errors.push(`root "${spec.root}" is not an element`);
  if (spec.theme && themes.length && !themes.includes(spec.theme)) errors.push(`unknown theme "${spec.theme}"`);
  const refs = e => [...(e.children || []), ...(e.props && Array.isArray(e.props.footer) ? e.props.footer : [])];
  const reached = new Set();
  (function walk(id) { if (reached.has(id) || !els[id]) return; reached.add(id); refs(els[id]).forEach(walk); })(spec.root);
  const overlays = new Set(Object.values(els).filter(e => /^(Modal|AlertDialog|Sheet|Drawer)$/.test(e.type)).map(e => e.props && e.props.id));
  const isId = v => typeof v === 'string' && Object.prototype.hasOwnProperty.call(els, v);
  for (const [id, e] of Object.entries(els)) {
    const p = e.props || {}, at = `${id} (${e.type})`, kids = e.children || [];
    if (!types.includes(e.type)) errors.push(`${at}: unknown type`);
    if (mcp && /^(Icon|Link)$/.test(e.type)) errors.push(`${at}: the hosted MCP rejects this type; use icon props or a ghost Button`);
    for (const c of refs(e)) if (!isId(c)) errors.push(`${at}: "${c}" is not an element id`);
    if (!reached.has(id)) warnings.push(`${at}: not reachable from root, renders below the page`);
    if (e.type === 'Text' && p.content == null) errors.push(`${at}: Text reads "content"${p.text != null ? ', not "text"' : ''}`);
    if (e.type === 'Text' && /^(h[1-4]|p|span)$/.test(p.content) && !/^(h[1-4]|p|span)$/.test(p.tag)) errors.push(`${at}: content and tag are swapped; Text is (content, tag)`);
    if (e.type === 'ChartCard' && !kids.length && !(Array.isArray(p.bars) && p.bars.length)) errors.push(`${at}: add a Chart child or bars, or it renders "No data"`);
    if (e.type === 'Chart' && !(Array.isArray(p.bars) && p.bars.length)) errors.push(`${at}: Chart needs bars [{label, value}]`);
    if (e.type === 'Card' && p.footer != null && !Array.isArray(p.footer)) errors.push(`${at}: footer is an array of child ids`);
    if (e.type === 'Card' && p.media != null && typeof p.media !== 'string') errors.push(`${at}: media is an image URL`);
    if (/^(Stack|Grid)$/.test(e.type) && p.gap != null && !(Number.isInteger(p.gap) && p.gap >= 0 && p.gap <= 6)) warnings.push(`${at}: gap is a 0-6 token, got ${p.gap}`);
    if (e.type === 'Grid' && p.columns != null && p.columns !== 'sidebar-main' && !(p.columns >= 2 && p.columns <= 6)) warnings.push(`${at}: columns is 2-6`);
    const data = p.sections || p.items || p.groups;
    if (/^(Sidebar|NavMenu|BottomNav|Breadcrumbs|Menubar|DropdownMenu|CommandPalette)$/.test(e.type) && Array.isArray(data) && data.some(isId)) warnings.push(`${at}: takes data objects, not element ids`);
    if (e.type === 'Toggle' && /notif|alert|email|dark mode|enable|remember|public|sync|auto/i.test(String(p.label || ''))) warnings.push(`${at}: on/off settings use Switch`);
    if (e.type === 'Button' && p.trigger && !overlays.has(p.trigger)) warnings.push(`${at}: trigger "${p.trigger}" names no Modal, AlertDialog, Sheet or Drawer id`);
    if (e.type === 'Tabs' && Array.isArray(p.tabs) && kids.length && kids.length !== p.tabs.length) warnings.push(`${at}: one child panel per tab`);
  }
  return { errors, warnings };
}
```

Icon names need the Lucide build to check; step 3 does it.

## 3. Render

Render in a real browser with the same files the playground and MCP use, then read the DOM. With Playwright:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const warnings = [];
page.on('console', m => { if (m.text().startsWith('[daub-render]')) warnings.push(m.text()); });
await page.setContent(`<!doctype html><html><head>
  <link rel="stylesheet" href="https://daub.dev/daub.css">
  <script src="https://cdn.jsdelivr.net/npm/lucide@0.576.0/dist/umd/lucide.min.js" integrity="sha384-b05ba3pt6xaC7F4r130arhf8cF18GH/gKu9JDz/NMf+BhLlBVwIWUdAZSpf1IWRZ" crossorigin="anonymous"></script>
</head><body><div id="app"></div>
  <script src="https://daub.dev/daub.js"></script>
  <script src="https://daub.dev/daub-render.js"></script>
</body></html>`, { waitUntil: 'networkidle' });

const report = await page.evaluate(spec => {
  document.documentElement.dataset.theme = spec.theme || 'light';
  const app = document.getElementById('app');
  const root = renderElement(spec.elements, spec.root, 0);
  if (root) app.appendChild(root);
  for (const id in spec.elements)
    if (!app.querySelector(`[data-spec-id="${CSS.escape(id)}"]`)) app.appendChild(renderElement(spec.elements, id, 0));
  DAUB.init(); lucide.createIcons();
  const icons = [];
  (function scan(v) {
    if (Array.isArray(v)) return v.forEach(scan);
    if (v && typeof v === 'object') for (const k in v) (k === 'icon' && typeof v[k] === 'string' ? icons.push(v[k]) : scan(v[k]));
  })(Object.values(spec.elements).map(e => e.props));
  const known = n => { const k = n.toLowerCase(), a = ICON_ALIASES[k] || n; return k === 'google' || !/[a-z]/.test(k) || !!(lucide.icons[lucideKey(a)] || lucide.icons[lucideKey(k)]); };
  return {
    rootRendered: !!root && root.getBoundingClientRect().height > 0,
    unknownTypes: [...app.querySelectorAll('.db-alert__title')].map(n => n.textContent).filter(t => t.startsWith('Unknown: ')),
    renderErrors: [...app.querySelectorAll('[data-render-error]')].map(n => n.getAttribute('data-render-error')),
    missingIcons: icons.filter(n => !known(n)),
  };
}, spec);

await page.screenshot({ path: 'desktop.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
report.overflowsOnPhone = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
await page.screenshot({ path: 'phone.png', fullPage: true });
await browser.close();
```

`ICON_ALIASES` and `lucideKey` are globals from `daub-render.js`. Pass when `rootRendered` is true and every list and `warnings` is empty. Pin the files with `?v=<version>` when you compare runs.

Inside the DAUB repo, `tests/combo-audit/` runs deeper probes (overflow, clipping, overlap, contrast, dropped content, broken icons) across themes and viewports: `node tests/combo-audit/audit.mjs --extra <dir of specs>`.

## 4. Look

Review the two screenshots against the request. In this project's benchmarks a cheap vision model with a rubric (gemini-3-flash-preview) graded pages reliably, while text-only judges, including Jev reading an outline, did not: an outline cannot show a broken image, an empty icon slot or a wall of whitespace.

Reviewer prompt:

```text
You review a web UI built with the DAUB component library. You get the user's request and two screenshots
(1280 px and 390 px wide). Score each item 1-10 and list concrete defects, naming the section they are in.

1. Fulfillment: every part the request asks for is present with realistic content (no lorem ipsum, no "Item 1").
2. Hierarchy: one clear focal point per view; headings, then supporting content, then actions.
3. Layout: aligned edges, consistent spacing, more space between groups than inside them, nothing clipped
   or overflowing, the phone view stacks cleanly.
4. Density: no empty cards, charts without data or blank regions; no walls of text.
5. Polish: icons and images render, text contrast is readable, one primary button per view.

Reply as JSON: {"scores": {"fulfillment": n, "hierarchy": n, "layout": n, "density": n, "polish": n},
"defects": ["..."], "ship": true|false}
```

Treat `ship: false` with a concrete defect in fulfillment or density as a hard failure worth one targeted revision. Leave the rest to the user.
