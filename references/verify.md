# Verify DAUB output

Check a UI in four steps, cheapest first: parse, lint, render, look. Fix every hard failure in code before you show the result. Report soft issues, or fix them in one guided revision; do not loop an automatic repair on them.

| Hard failure (fix it) | Soft signal (report it) |
|---|---|
| OpenUI parses to `null`, JSON does not parse | A reviewer composite of 8 or more with small complaints |
| Unknown type, missing root, dangling child id | Spacing or hierarchy the reviewer dislikes |
| `Unknown: <Type>` notice or `[data-render-error]` in the page | A theme that fits less well than another |
| Empty ChartCard, Chart without bars, Text with no `content` | Copy that could be sharper |
| Blank or near-blank page, horizontal overflow on a phone, content flush with the phone's edge | |
| An `icon` name Lucide lacks, an image that fails to load | |

## 1. Parse

```js
const { openUItoSpec } = require('./daub-openui-parser.js'); // https://daub.dev/daub-openui-parser.js
const spec = text.trim().startsWith('{') ? JSON.parse(text) : openUItoSpec(text);
if (!spec) throw new Error('nothing parsed');
```

Without local files, MCP `parse_openui` returns `spec`, `html` and `validation`.

## 2. Lint

`validate_spec` checks types and ids only. This linter adds the golden rules from SKILL.md and the layout traps in `references/components.md`. Pass the parser's type list and the theme names; set `mcp: true` for specs you will send to the hosted MCP. Errors break the render; warnings mark a trap that renders badly.

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
  const rootEl = els[spec.root];
  if (rootEl && /^(Stack|Grid)$/.test(rootEl.type) && !Object.values(els).some(e => e.props && e.props.container)) warnings.push(`root: no container, so content touches the screen edges on phones; set container "wide" or "narrow"`);
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
    // Layout traps (references/components.md)
    if (e.type === 'Navbar' && kids.length) warnings.push(`${at}: on phones the Navbar hides its children and draws no menu button; use a horizontal Stack as the top bar`);
    if (e.type === 'ToggleGroup' && Array.isArray(p.options) && p.options.some(o => o && /\s/.test(String(o.label || '').trim()))) warnings.push(`${at}: option labels with a space wrap onto two lines; use one word per option`);
    if (e.type === 'ScrollArea' && kids.some(c => els[c] && /^(Table|DataTable)$/.test(els[c].type))) warnings.push(`${at}: ScrollArea caps its height at 300 px and hides the rows below; tables scroll sideways on their own`);
    if (e.type === 'Stack' && p.wrap === false && kids.some(c => els[c] && els[c].type === 'Button' && els[c].props && els[c].props.icon)) warnings.push(`${at}: in a wrap:false row a Button shrinks and its icon collapses; drop the icon or keep wrap on`);
    if (p.on != null || p.visible != null) warnings.push(`${at}: "on" and "visible" belong on the element, not in props (OpenUI Lang cannot express them)`);
  }
  return { errors, warnings };
}
```

Icon names need the Lucide build to check; step 3 does it.

## 3. Render

Render in a real browser with the same files the playground and MCP use, then read the DOM. `renderAndCheck` runs inside the page:

```js
// Runs in the page: render the spec the way the playground does, then report what the DOM shows.
function renderAndCheck(spec) {
  document.documentElement.dataset.theme = spec.theme || 'light';
  const app = document.getElementById('app');
  const root = renderElement(spec.elements, spec.root, 0);
  if (root) app.appendChild(root);
  for (const id in spec.elements) // unreachable elements render after the root, as in the playground
    if (!app.querySelector(`[data-spec-id="${CSS.escape(id)}"]`)) app.appendChild(renderElement(spec.elements, id, 0));
  DAUB.init();
  lucide.createIcons();
  const names = [];
  (function scan(v) {
    if (Array.isArray(v)) return v.forEach(scan);
    if (v && typeof v === 'object') for (const k in v) (k === 'icon' && typeof v[k] === 'string' ? names.push(v[k]) : scan(v[k]));
  })(Object.values(spec.elements).map(e => e.props));
  for (const e of Object.values(spec.elements)) if (e.type === 'Icon' && e.props) names.push(e.props.name);
  // Exact Lucide names only. Renderers map a few aliases (refresh to refresh-cw); write the real name anyway.
  const key = n => String(n).trim().replace(/(^|[\s_-]+)(\w)/g, (m, a, b) => b.toUpperCase());
  const isIcon = n => !/[a-z]/i.test(n) || String(n).trim().toLowerCase() === 'google' || !!lucide.icons[key(n)];
  return {
    rootRendered: !!root && root.getBoundingClientRect().height > 0,
    unknownTypes: [...app.querySelectorAll('.db-alert__title')].map(n => n.textContent).filter(t => t.startsWith('Unknown: ')),
    renderErrors: [...app.querySelectorAll('[data-render-error]')].map(n => n.getAttribute('data-render-error')),
    missingIcons: names.filter(n => !isIcon(n)),
    emptyChartCards: app.querySelectorAll('.db-chart-card__body:empty').length,
  };
}
```

With Playwright:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const warnings = [];
page.on('console', m => { if (m.text().startsWith('[daub-render]')) warnings.push(m.text()); });
page.on('pageerror', e => warnings.push('pageerror: ' + e.message));
await page.setContent(`<!doctype html><html><head>
  <link rel="stylesheet" href="https://daub.dev/daub.css">
  <script src="https://cdn.jsdelivr.net/npm/lucide@0.576.0/dist/umd/lucide.min.js" integrity="sha384-b05ba3pt6xaC7F4r130arhf8cF18GH/gKu9JDz/NMf+BhLlBVwIWUdAZSpf1IWRZ" crossorigin="anonymous"></script>
</head><body><div id="app" style="padding-block: 24px"></div>
  <script src="https://daub.dev/daub.js"></script>
  <script src="https://daub.dev/daub-render.js"></script>
</body></html>`, { waitUntil: 'networkidle' });

const report = await page.evaluate(renderAndCheck, spec);
await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 10000 }).catch(() => {});
report.brokenImages = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.src));
await page.screenshot({ path: 'desktop.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
report.phone = await page.evaluate(() => {
  const h = document.querySelector('#app h1, #app h2');
  return { overflows: document.documentElement.scrollWidth > innerWidth + 1, headingLeft: h ? Math.round(h.getBoundingClientRect().left) : null };
});
await page.screenshot({ path: 'phone.png', fullPage: true });
await browser.close();
```

Pass when `rootRendered` is true, every list and `warnings` is empty, `emptyChartCards` is 0, `phone.overflows` is false and `phone.headingLeft` is at least 12 (a smaller value means the root has no `container`). The check reads only public globals (`renderElement`, `DAUB`, `lucide`), so it works against any deployed build. Pin the files with `?v=<version>` when you compare runs.

Inside the DAUB repo, `tests/combo-audit/` runs deeper probes (overflow, clipping, overlap, contrast, dropped content, broken icons) across themes and viewports. For your own specs: `node tests/combo-audit/audit.mjs --extra <dir of specs> --only '^extra--'` (without `--only` it also renders its 1,500 generated specs).

## 4. Look

Review the desktop screenshot against the request with a vision model. The setup below was validated in this project against two blind screenshot judges on 116 generated pages: it separated the pages they rated good from the rest with an AUC of 0.90, and a rerun agreed with the first run at rank correlation 0.92. Text-only judges, including Jev reading an outline, did not work: an outline cannot show a broken image, an empty icon slot or a wall of whitespace.

- Model `google/gemini-3-flash-preview` on OpenRouter, `temperature: 0`, about $0.002 per page.
- Input: the full desktop page at 1280 px wide, cut top to bottom into slices of at most 896 px, each sent as an image.
- Score: `composite = (fulfillment + visual_quality + data_realism) / 3`. Flag the page when the composite is below 8: that caught 83% of the pages the judges rated not good, and 78% of the flags were right. Its `pass` field flags more pages wrongly; use the composite.
- It is lenient on layout (its mean composite ran 1.4 points above the judges'), and it saw only desktop pages. Check phones with step 3.

System prompt:

```text
You are a demanding senior product designer. You review first-draft screens produced by an AI UI generator and grade them strictly and consistently. Judge only what is visible in the screenshots. Reply with one JSON object and nothing else.
```

User message, in this order: the text `USER REQUEST (what the person typed into the generator):\n"<request>"`, then `SCREENSHOT: the generated page as rendered in a desktop browser, 1280px wide, <height>px tall, shown as <n> consecutive slices from top to bottom (no overlap; each slice continues exactly where the previous one ends).`, then `slice 1 of n:` and its image for each slice, then `The page is a static first render: nothing has been clicked or hovered. Menus, modals and toasts that need an interaction are not expected to be visible unless the request asks for them to show.`, then this rubric:

```text
Grade the page against the request. Use the full 0-10 range; 10 is rare.

fulfillment (0-10): does the page deliver what was asked? Check every screen type, section, feature and piece of data the request names. When the request is terse, check what a competent designer would treat as essential for that kind of screen.
  10 = everything asked for is present, prominent and correct
  7-8 = the core is there; one minor requested element is missing, hard to find or weak
  4-6 = the right kind of page, but a requested section or feature is missing, broken or stubbed
  1-3 = mostly wrong, or most requested parts are missing
  0 = blank, an error, or a different product

visual_quality (0-10): layout, hierarchy, alignment, spacing rhythm, density, consistency, contrast and legibility, sensible use of the 1280px width, images that fit their slots.
  9-10 = polished; would pass a design review at a strong product company
  7-8 = clean and coherent, small nitpicks only
  4-6 = usable with visible problems (awkward empty regions, cramped or misaligned blocks, inconsistent sizing, weak hierarchy, overflowing or clipped text, mismatched imagery)
  1-3 = messy or broken layout
  0 = blank

data_realism (0-10): is the content believable for this product? Specific names; plausible numbers, prices, dates and units; internal consistency (totals add up, counts match the list shown, dates in a sensible order); imagery that matches the subject. Penalize lorem ipsum, "Item 1", "Label", placeholder or default text, zeros, obviously repeated rows and broken images. A blank page scores 0.

broken_or_missing: every concrete problem you see, each one short phrase that names the place, e.g. "Revenue chart card has an empty body", "no timestamps on messages (requested)", "hero image fails to load", "table shows a header but no rows". Include requested things that are absent. Use an empty list only if you find nothing.

pass: true only if a demanding product designer would ship this as the first draft for this request: every core requested part present and working, nothing visibly broken or empty, credible content, coherent layout. When unsure, false.

Return exactly this JSON object, writing broken_or_missing first and the scores after it:
{"broken_or_missing": ["..."], "fulfillment": 0, "visual_quality": 0, "data_realism": 0, "pass": false}
```

Send `response_format: { type: "json_schema", json_schema: { name: "ui_judgement", strict: true, schema } }` with a schema that requires `broken_or_missing` (array of strings), `fulfillment`, `visual_quality`, `data_realism` (integers) and `pass` (boolean).

A composite below 8 with a concrete item in `broken_or_missing` is worth one targeted revision. Leave the rest to the user.
