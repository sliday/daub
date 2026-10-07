# json-render specs for DAUB

A spec is one JSON object with a flat element map. The playground, `daub-render.js`, the hosted MCP server and OpenUI Lang (after parsing) all use this format.

```text
{
  "theme": "<theme name>",            optional, default "light"
  "root": "<element id>",             required
  "state": { ... },                   optional initial state
  "elements": {
    "<id>": {
      "type": "<Type>",               required, one of the spec types in components.md
      "props": { ... },               optional
      "children": ["<id>", ...],      optional, ids of other elements, in order
      "on": { "<event>": <action> },  optional
      "visible": <expression>         optional
    }
  }
}
```

## Rules

- Ids are unique strings. Keep them descriptive (`revenue-chart`, not `el-7`).
- `children` holds ids, never nested objects. Nesting lives only in the id graph.
- `root` must name an element. Every other element should be reachable from `root` through `children` or `footer`. Renderers append unreachable elements after the root, so a stray element shows up at the bottom of the page.
- `type` must be a spec type. Unknown types render an `Unknown: <Type>` warning notice in their place.
- Data props (`items`, `sections`, `columns`, `rows`, `bars`, `options`, `tabs`, `steps`, `files`) hold plain values. Only `children` and `footer` hold ids.

### ChangeSummary

`files` holds `{path: string, additions?: number, deletions?: number,
status?: "added"|"modified"|"deleted"}` objects. Paths render as plain text.
Counts floor finite numbers and clamp rows/totals to `0..Number.MAX_SAFE_INTEGER`;
other values become zero. Ignore malformed entries without string paths.
Optional props: title, description, undoLabel, undoDisabled. The default title
for host data is `Edited N file(s)`; empty files use `No files changed`.
Label fixtures `Prepared 2 demo files` / `Demo changes`.

Children are explicit host-wired action IDs, not file IDs. Renderers create no
implicit controls. `undoLabel` / `undoDisabled` configure React's callback-backed
Undo button only; set spec child button props and handlers through the host.
The component needs no `daub.js` controller and performs no file operations.
See `components.md` for the action-free JSON/OpenUI demo example.

## Example

```json
{
  "theme": "catppuccin",
  "root": "page",
  "elements": {
    "page": { "type": "Stack", "props": { "direction": "vertical", "gap": 5, "container": "narrow" }, "children": ["title", "course", "lessons"] },
    "title": { "type": "Text", "props": { "tag": "h1", "content": "Intro to Watercolor" } },
    "course": { "type": "Card", "props": { "title": "Your progress", "description": "Week 3 of 6" }, "children": ["progress", "steps"] },
    "progress": { "type": "Progress", "props": { "value": 45 } },
    "steps": { "type": "Stepper", "props": { "steps": [
      { "label": "Materials", "status": "completed" },
      { "label": "Washes", "status": "completed" },
      { "label": "Layering", "status": "active" },
      { "label": "Final piece", "status": "pending" }
    ] } },
    "lessons": { "type": "List", "props": { "items": [
      { "title": "Wet-on-wet skies", "secondary": "12 min video", "icon": "circle-play" },
      { "title": "Mixing greens", "secondary": "Worksheet, 2 pages", "icon": "file-text" },
      { "title": "Glazing a still life", "secondary": "Assignment due Friday", "icon": "palette" }
    ] } }
  }
}
```

## State, actions and visibility

Declarative state covers tabs, filters, counters and show/hide without JavaScript. Only JSON can express it: OpenUI Lang sets `__state` but has no syntax for `on` or `visible`. To switch content (monthly and yearly prices, week and month stats), use Buttons with `on` handlers as below; a ToggleGroup only shows which option is selected.

- `state` at the spec root holds initial values: `{ "tab": "week", "cart": [] }`.
- Paths are slash paths into state: `/tab`, `/form/email`.
- `on` maps a DOM event to an action: `{ "click": { "action": "setState", "params": { "path": "/tab", "value": "month" } } }`.
- Actions: `setState` (sets `value`, or the event target's value when `value` is absent), `toggleState` (flips a boolean), `pushState` (appends `value` to an array), `removeState` (deletes the key).
- `visible` hides an element unless its expression is truthy: `{ "$state": "/tab", "eq": "week" }` (also `neq`).
- Expression props: `{ "$state": "/count" }` reads a value, `{ "$template": "Cart (${/count})" }` interpolates, `{ "$cond": <expr>, "$then": a, "$else": b }` picks one, `{ "$bindState": "/form/email" }` two-way binds an input.

```json
{
  "theme": "light",
  "state": { "tab": "week" },
  "root": "page",
  "elements": {
    "page": { "type": "Stack", "props": { "direction": "vertical", "gap": 4, "container": "narrow" }, "children": ["switcher", "week", "month"] },
    "switcher": { "type": "ButtonGroup", "children": ["show-week", "show-month"] },
    "show-week": { "type": "Button", "props": { "label": "This week", "variant": "secondary" }, "on": { "click": { "action": "setState", "params": { "path": "/tab", "value": "week" } } } },
    "show-month": { "type": "Button", "props": { "label": "This month", "variant": "secondary" }, "on": { "click": { "action": "setState", "params": { "path": "/tab", "value": "month" } } } },
    "week": { "type": "StatCard", "props": { "label": "Orders this week", "value": "318", "trend": "up", "trendValue": "+9%" }, "visible": { "$state": "/tab", "eq": "week" } },
    "month": { "type": "StatCard", "props": { "label": "Orders this month", "value": "1,402", "trend": "up", "trendValue": "+4%" }, "visible": { "$state": "/tab", "eq": "month" } }
  }
}
```

### Where state runs

- The playground preview runs state, actions, visibility and expression props.
- `daub-render.js` writes them onto the DOM as `data-ds-on`, `data-ds-visible` and `data-ds-props` and exposes `createStateStore`, `collectStateConfig`, `resolveExpr` and `dispatchAction`, but wires nothing.
- MCP `render_spec` and `generate_ui` HTML does not wire state: every element shows, and expression props print as `[object Object]`. Keep specs you export through MCP static, or wire state yourself.

Wiring for a page that rendered `spec` into `app` with `daub-render.js`. It updates visibility, text props and bound inputs:

```js
const cfg = collectStateConfig(spec);
const store = createStateStore(JSON.parse(JSON.stringify(cfg.initialState)));
const read = e => (e && e.$bindState != null ? store.get(e.$bindState) : resolveExpr(e, store));
app.querySelectorAll('[data-ds-on]').forEach(el => {
  const on = JSON.parse(el.dataset.dsOn);
  for (const evt in on) el.addEventListener(evt, e => dispatchAction(on[evt], store, e));
});
cfg.bindings.forEach(b => {
  const input = app.querySelector(`[data-spec-id="${b.id}"]`)?.querySelector('input, textarea, select');
  input?.addEventListener('input', e => store.set(b.path, e.target.value));
});
function refresh() {
  app.querySelectorAll('[data-ds-visible]').forEach(el => {
    el.style.display = read(JSON.parse(el.dataset.dsVisible)) ? '' : 'none';
  });
  app.querySelectorAll('[data-ds-props]').forEach(el => {
    const props = JSON.parse(el.dataset.dsProps);
    for (const k in props) {
      const v = read(props[k]);
      const input = el.matches('input, textarea') ? el : el.querySelector('input, textarea');
      if (k === 'value' && input) input.value = v ?? '';
      else if (['label', 'text', 'title', 'content', 'description'].includes(k)) el.textContent = v ?? '';
    }
  });
}
store.subscribe(refresh);
refresh();
```

For games, canvas drawing or anything state cannot express, `CustomHTML` takes `html`, `css` and `js`. Its `js` receives `container` (the element) and `preview` (the page root). The playground runs shared custom JS only after the viewer clicks Run code.

## Validation

`validate_spec` on the hosted MCP server (and `validateSpec()` in `functions/api/mcp.js`) reports:

- issues (the spec is invalid): not an object, no `elements`, no `root`, `root` not in `elements`, an element without `type`, an unknown `type`, a child id that names no element;
- warnings: `Card` with `footer: true`, `Card` with an array `media`, `ChartCard` with no Chart child and no `bars`.

`generate_ui` also runs `autoFixSpec()` on model output: it drops child ids that name no element, swaps a `Text` whose `tag` and `content` are reversed, and points a missing `root` at the first element.

Neither checks props against the golden rules in SKILL.md. The linter in `references/verify.md` does.

## What renderers tolerate

`daub-render.js`, the playground and `mcp/lib/renderers.js` share one renderer and accept common malformed props, so a slightly wrong spec still renders. Write canonical props anyway; the playground prompt, the MCP prompt and other tools read the canonical names.

- **Lists**: an array passes through; `{items|data|rows|options|list: [...]}` unwraps; an object of objects becomes its values; a scalar becomes a one-item list. Option lists accept bare strings (`["S", "M", "L"]`).
- **Tables**: a `{columns, rows}` object in `columns`, a `{key: "Label"}` column map, string columns (`["Name", "Email"]`), array rows, and a matrix `Table([[head...], [row...]])`. A scalar `columns` or `rows` renders nothing.
- **Charts**: chart.js-style `{labels, data}` and `{labels, datasets: [{data}]}`; values like `"$12k"` parse as numbers.
- **Kbd**: `"Ctrl+K"` splits into keys.
- **Sidebar**: flat items `[{label, icon}]` become one untitled section; a child id renders that element in place.
- **Footer**: a string footer is one id; ids that name no element are dropped, and Modal/AlertDialog fall back to default buttons.
- **Prop aliases**: Badge and Label `label` or `content` fill `text`; Alert `description` fills `message` and a `variant` of info/success/warning/error fills `type`; EmptyState `description` fills `message`; StatCard `title` fills `label`; List item `primary`/`label`/`text` fill `title` and `description`/`subtitle` fill `secondary`; ToggleGroup `items` fill `options` and `defaultValue`/`value` fill `selected`; Tabs `items` fill `tabs`.
- **Variant aliases**: Button `outline`/`default` to secondary, `link` to ghost, `destructive`/`danger` to icon-danger; Badge takes `success`, `danger`, `info`, `gray`, `red`, `green`, `blue`, `amber` and `purple` besides its four listed variants, maps `secondary`/`default`/`neutral`/`muted`/`outline` to gray, `primary`/`accent` to new and `destructive` to red; Alert `danger`/`destructive` to error and `warn` to warning; Surface `bordered`/`card`/`elevated` to raised and `sunken` to inset; Avatar pixel sizes to sm/md/lg. Any other unknown value renders no modifier class.
- **Children as content**: List, Avatar, AvatarGroup and Table render child elements when their data prop is empty.
- **Icons**: common names from other sets map to Lucide (`refresh`, `chart`, `close`, `gear`, `email`, `profile`...); `google` draws an inline G; emoji render as text; unknown names render nothing.
- **Guard**: an element whose renderer throws shows "Couldn't render <Type>" with `data-render-error`, and its siblings still render.
