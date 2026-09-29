---
name: daub-ui
description: >-
  Build, preview and verify UI with DAUB (daub.dev), a drop-in CSS + JS component library
  with 84 components and 21 theme families. Covers three paths: plain HTML with db-* classes,
  json-render or OpenUI Lang specs rendered by daub-render.js, and the hosted DAUB MCP server
  (generate_ui, validate_spec, render_spec, parse_openui, get_block_library). Includes the rules
  that prevent broken renders, 266 ready-made blocks, playground share links, a verify loop, and
  Jev recipes for picking components, blocks and themes. Use when the user mentions DAUB,
  daub.dev, daub-ui, db- classes, the DAUB playground or MCP, json-render or OpenUI specs, or
  asks for a themed dashboard, landing page, form or settings screen without a build step.
license: MIT
compatibility: Any agent that reads files and runs shell or HTTP. The MCP path needs network access to daub.dev. Jev recipes need an OpenRouter API key.
metadata:
  daub-version: "3.20.5"
  homepage: https://daub.dev
---

# DAUB UI

DAUB is a drop-in CSS + JS component library. `daub.css` styles 84 components through `db-*` classes, `daub.js` wires the interactive ones (tabs, overlays, switches, dropdowns), and 21 theme families give 42 light and dark themes. No build step and no framework.

| Path | You write | Good for |
|---|---|---|
| 1. Plain HTML | `<button class="db-btn db-btn--primary">` | Existing HTML, JSX or template code, static sites |
| 2. Specs | json-render JSON or OpenUI Lang, rendered by `daub-render.js` | LLM output, streaming, UI as data, playground previews |
| 3. Hosted MCP | Tool calls to `https://daub.dev/api/mcp` | Drafting from a prompt, validating and rendering without local tooling |

## Pick a path

- The user has HTML, JSX, Vue or template files: path 1. Look up each component in `references/components.md` (HTML classes) or `https://daub.dev/llms.txt` before you write markup.
- You generate UI from a prompt, or a program consumes the UI: path 2. Write OpenUI Lang when a model writes the spec (about 67% fewer tokens than JSON). Write JSON when code edits the spec.
- You want a server to draft or check a spec: path 3, then edit the returned spec under path 2 rules.
- The user wants React: `npm install daub-react daub-ui` (React section of llms.txt).

## Path 1: plain HTML

```html
<link rel="stylesheet" href="https://daub.dev/daub.css">
<script src="https://daub.dev/daub.js"></script>

<main class="db-container db-container--narrow">
  <div class="db-card">
    <div class="db-card__header">
      <h3 class="db-card__title">Notifications</h3>
      <p class="db-card__desc">Choose what reaches you.</p>
    </div>
    <div class="db-flex db-flex--col db-gap-4">
      <div class="db-field">
        <label class="db-field__label" for="email">Email</label>
        <input class="db-field__input" id="email" type="email" placeholder="you@acme.com">
        <span class="db-field__helper">We send one digest a week.</span>
      </div>
      <div class="db-switch" role="switch" tabindex="0" aria-checked="true">
        <span class="db-switch__track"><span class="db-switch__thumb"></span></span>
        Mentions
      </div>
    </div>
    <div class="db-card__footer">
      <button class="db-btn db-btn--primary" data-db-modal-trigger="saved">Save</button>
    </div>
  </div>
</main>
<div class="db-modal-overlay" id="saved" aria-hidden="true">
  <div class="db-modal" role="dialog" aria-modal="true">
    <div class="db-modal__header">
      <h2 class="db-modal__title">Saved</h2>
      <button class="db-modal__close" aria-label="Close">&times;</button>
    </div>
    <div class="db-modal__body">Your preferences are live.</div>
  </div>
</div>
```

- Set the theme on the root: `<html data-theme="nord-light">`, or call `DAUB.setFamily('nord')` and `DAUB.setScheme('dark')`.
- `daub.js` runs `DAUB.init()` on load. After you insert markup later, call `DAUB.init(container)`.
- Overlays (`db-modal-overlay`, `db-alert-dialog`, `db-sheet`, `db-drawer`, `db-command`) need an `id`. Open them with `DAUB.openModal('id')` and friends, or a `data-db-modal-trigger="id"` button.
- Toasts are JS only: `DAUB.toast({ type: 'success', title: 'Saved', message: 'Changes are live.' })`.
- CDN copies: `cdn.jsdelivr.net/npm/daub-ui@latest/daub.css` and `/daub.js`. npm can lag the site; `https://daub.dev/daub.css?v=3.20.5` is the current build.

## Path 2: specs

A spec is a flat element map. json-render JSON:

```json
{
  "theme": "github",
  "root": "page",
  "elements": {
    "page": { "type": "Stack", "props": { "direction": "vertical", "gap": 5, "container": "wide" }, "children": ["header", "kpis", "revenue"] },
    "header": { "type": "Stack", "props": { "direction": "horizontal", "justify": "between", "align": "center" }, "children": ["title", "export"] },
    "title": { "type": "Text", "props": { "tag": "h1", "content": "Revenue" } },
    "export": { "type": "Button", "props": { "label": "Export CSV", "variant": "secondary", "icon": "download" } },
    "kpis": { "type": "Grid", "props": { "columns": 3, "gap": 4 }, "children": ["mrr", "churn", "arpu"] },
    "mrr": { "type": "StatCard", "props": { "label": "MRR", "value": "$48,210", "trend": "up", "trendValue": "+6.2%", "icon": "dollar-sign" } },
    "churn": { "type": "StatCard", "props": { "label": "Churn", "value": "2.1%", "trend": "down", "trendValue": "-0.4 pts", "icon": "user-minus" } },
    "arpu": { "type": "StatCard", "props": { "label": "ARPU", "value": "$38.40", "trend": "up", "trendValue": "+$1.10", "icon": "wallet" } },
    "revenue": { "type": "ChartCard", "props": { "title": "Monthly revenue ($k)" }, "children": ["revenue-chart"] },
    "revenue-chart": { "type": "Chart", "props": { "bars": [
      { "label": "Apr", "value": 39 }, { "label": "May", "value": 41 }, { "label": "Jun", "value": 44 },
      { "label": "Jul", "value": 43 }, { "label": "Aug", "value": 46 }, { "label": "Sep", "value": 48 }
    ] } }
  }
}
```

A settings page in OpenUI Lang, one statement per line:

```openui
__theme = "nord-light"
root = Stack([header, prefs, account, confirm], "vertical", 5, container: "narrow")
header = Stack([Text("Settings", "h1"), Text("Manage how Acme reaches you.", "p")], "vertical", 1)
prefs = Card([mentions, push, digest], "Notifications", "Choose what reaches you and where.")
mentions = Switch("Email me when a teammate mentions me", true)
push = Switch("Push notifications on this device", false)
digest = Select("Weekly digest", [{label: "Monday 9:00", value: "mon"}, {label: "Friday 16:00", value: "fri"}, {label: "Never", value: "off"}], "mon")
account = Card([deleteBtn], "Delete account", "Removes all 14 projects and their files.")
deleteBtn = Button("Delete account", "icon-danger", icon: "trash-2", trigger: "confirm-delete")
confirm = AlertDialog("confirm-delete", "Delete your account?", "You cannot undo this.", footer: [keepBtn, confirmBtn])
keepBtn = Button("Keep account", "secondary")
confirmBtn = Button("Delete account", "primary")
```

Render either one in any page. The parser and renderer ship only on daub.dev (the npm package has neither):

```html
<link rel="stylesheet" href="https://daub.dev/daub.css?v=3.20.5">
<script src="https://cdn.jsdelivr.net/npm/lucide@0.576.0/dist/umd/lucide.min.js" integrity="sha384-b05ba3pt6xaC7F4r130arhf8cF18GH/gKu9JDz/NMf+BhLlBVwIWUdAZSpf1IWRZ" crossorigin="anonymous"></script>
<div id="app" style="padding-block: 24px"></div>
<script src="https://daub.dev/daub.js?v=3.20.5"></script>
<script src="https://daub.dev/daub-render.js?v=3.20.5"></script>
<script src="https://daub.dev/daub-openui-parser.js?v=3.20.5"></script>
<script>
  const spec = DaubOpenUI.openUItoSpec(openuiText); // or JSON.parse(jsonText)
  document.documentElement.dataset.theme = spec.theme || 'light';
  const app = document.getElementById('app');
  app.appendChild(renderElement(spec.elements, spec.root, 0));
  for (const id in spec.elements) // elements the tree never reached render after it
    if (!app.querySelector('[data-spec-id="' + id + '"]')) app.appendChild(renderElement(spec.elements, id, 0));
  DAUB.init(); lucide.createIcons();
</script>
```

Full formats: `references/json-render.md` (state, actions, visibility) and `references/openui.md` (syntax, every signature).

## Path 3: hosted MCP

- Claude Code: `claude mcp add daub --transport http https://daub.dev/api/mcp`
- Cursor and other Streamable HTTP clients: `{ "mcpServers": { "daub": { "url": "https://daub.dev/api/mcp" } } }`
- stdio-only clients: `npx -y mcp-remote https://daub.dev/api/mcp`
- No MCP client (pi, scripts): POST JSON-RPC `tools/call` to the same URL (curl recipe in `references/mcp.md`).

Tools: `generate_ui` (prompt to spec + HTML), `get_component_catalog`, `validate_spec`, `render_spec`, `parse_openui`, `get_block_library`. `validate_spec` and `render_spec` take the spec as a JSON string or an object. `generate_ui` picks components with Jev first; `routing.picked_components` shows the pick. Rate limit: 60 requests per minute per IP.

## Golden rules

These rules prevent the failures seen most in generated DAUB UIs.

1. OpenUI arguments are positional in parser order. Check the signature in `references/openui.md`, or pass named args: `Button(label: "Save", variant: "primary")`.
2. Containers take children first: `Stack([a, b], "horizontal")`, `Card([body], "Title")`, `ChartCard([chart], "Revenue")`, `Field([input], "Email")`, `Modal([form], "edit-user", "Edit user")`. `Text` is `(content, tag)`: `Text("Revenue", "h2")`. In JSON, `Text` reads `content`, never `text`.
3. Use `Switch` for on/off settings (notifications, dark mode, feature flags). `Toggle` is a pressable toolbar button (bold, italic, grid view).
4. `ChartCard` needs a `Chart` child with 4-8 bars of realistic data, or a `bars` prop. An empty ChartCard renders "No data". `Chart` takes `bars: [{label, value, max?}]`.
5. `Sidebar`, `NavMenu`, `BottomNav`, `Breadcrumbs`, `Menubar`, `DropdownMenu` and `CommandPalette` take data arrays of plain objects, not element ids: `Sidebar([{title: "Workspace", items: [{label: "Inbox", icon: "inbox", active: true}]}])`.
6. Icons are Lucide 0.576.0 names in kebab-case (`layout-dashboard`, `circle-check`, `github`). Put them in props: `Button icon`, `StatCard icon`, `EmptyState icon`, and `icon` on List, Sidebar, BottomNav and menu items. Renderers map common aliases (`refresh` to `refresh-cw`) and drop unknown names. Stay on 0.x: Lucide 1.x removed brand icons.
7. `Icon` draws one standalone Lucide icon, `Icon("star", "lg")`, and `Link` draws an inline text link. Both parse, validate and render in the playground, with `daub-render.js` and on the hosted MCP. An icon beside a label belongs in the owning component's icon prop (rule 6).
8. `gap` on Stack and Grid is a token 0-6 (0, 4, 8, 12, 16, 24, 32 px), never pixels. Grid `columns` is 2-6. Space between groups should be at least twice the space inside them. Give the root `container: "wide"` (dashboards, landing pages) or `"narrow"` (forms, settings); without it the page has no side gutters.
9. Themes are exact names. Light and dark names differ per family: `solarized` is light, `ink` and `material` are dark. `paper`, `material-dark`, `solarized-light` and `gruvbox-dark` do not exist and fall back to the default light theme. Table: `references/themes.md`.
10. Overlays (`Modal`, `AlertDialog`, `Sheet`, `Drawer`) need an `id`, and a `Button` with `trigger: "<id>"` opens one. They start hidden, so place them anywhere in the tree. `CommandPalette` also needs an `id`; it opens with Cmd+K or `DAUB.openCommand(id)`.
11. `Card.footer` is an array of child ids and `Card.media` is an image URL. Use `Separator`, not `Divider`; `Layout` is deprecated (use `Stack` or `Grid`).
12. Write real content: names, prices, dates, 5-8 table rows. No lorem ipsum, no "Item 1". `references/design.md` covers layout and density.
13. Some specs render without errors and still look broken: ToggleGroup labels with a space wrap, a ChartCard stretches beside a taller card, a ScrollArea around a Table hides rows, a Button icon collapses in a `wrap: false` row, and an edit form written with placeholders instead of `value` looks empty. A destructive button uses variant `icon-danger`. Fixes: "Layout traps" in `references/components.md`.

Renderers tolerate many malformed props (see `references/json-render.md`). Treat that as a safety net and write the canonical props.

## Preview

- Playground link: `https://daub.dev/playground#s=` + `LZString.compressToEncodedURIComponent(JSON.stringify(spec))` (npm `lz-string`). The payload must be a JSON spec; the playground does not read OpenUI text, so parse it first. One link per UI is enough. Old `?s=` links still open. A shared spec with custom JS stays paused until the viewer clicks Run code.
- Set the theme in every spec (`"theme"` or `__theme`). Without it a JSON spec renders `light` and OpenUI parses to `bone`.
- Static file: MCP `render_spec` returns self-contained HTML. Save it and open it or screenshot it.
- Local: the page in path 2, served from any static server.

## Verify

Run these before you hand a UI over. Details and a copy-paste linter: `references/verify.md`.

1. Parse: `DaubOpenUI.openUItoSpec(text)` returns `null` when nothing parsed. MCP `parse_openui` does the same remotely.
2. Check: every element's `type` is known, `root` and every child id exist, and the golden rules hold (`validate_spec` covers types and ids).
3. Render: load the spec in a headless browser at 1280 and 390 px. Fail on an `Unknown: <Type>` notice, a `[data-render-error]` element, a `[daub-render]` console warning, an empty root or ChartCard, an icon name Lucide lacks, a broken image, or a phone view that overflows or has text flush with the edge.
4. Look: send the desktop screenshot to a vision model with the rubric in `references/verify.md` (validated here: gemini-3-flash-preview, temperature 0, flag a composite below 8). Text-only judges, Jev on an outline included, did not work.

Fix hard failures (parse errors, unknown types, render errors, blank regions) in code, deterministically. Do not auto-repair on soft signals such as a middling score.

## Jev

Jev (`typesafe/jev-1.13-20260917` on OpenRouter; pin a versioned id, not the `~typesafe/jev-latest` alias) answers typed questions with probabilities in about 300 ms. It cannot write text or specs. Use it to decide, then let a writer model or your own code produce the UI:

- Pick components: one `noul` question per component with its one-line purpose, keep p(yes) >= 0.45 plus the core layout types and the types your page formula needs (Jev can miss Sidebar on a dashboard). The playground uses this to shorten the prompt.
- Pick a block or a theme family: one `choice` question.

Call `https://openrouter.ai/api/alpha/decisions` with your own OpenRouter key. Do not call `daub.dev/api/choose` or `/api/generate`: they accept only daub.dev origins and spend the site's quota. Request JSON, purpose map and limits: `references/jev.md`.

## Reference map

| File | Read it when |
|---|---|
| `references/components.md` | You need a type's props, purpose, or the `db-*` classes and parts for HTML |
| `references/openui.md` | You write or debug OpenUI Lang |
| `references/json-render.md` | You write JSON specs, add state or interactivity, or wonder why a prop was ignored |
| `references/blocks.md` | You want a proven section (hero, pricing, auth, dashboard) to adapt |
| `references/themes.md` | You pick or switch a theme |
| `references/mcp.md` | You call the hosted MCP server, with or without an MCP client |
| `references/jev.md` | You route decisions through Jev |
| `references/verify.md` | You check output before handing it over |
| `references/design.md` | You plan layout, density and hierarchy |

Full component docs with HTML for all 84 components: `https://daub.dev/llms.txt`. Machine-readable catalog: `https://daub.dev/components.json`.

## Install this skill

```bash
mkdir -p ~/.claude/skills/daub-ui/references && cd ~/.claude/skills/daub-ui
curl -fsSLO https://daub.dev/SKILL.md
for f in components openui json-render blocks themes mcp jev verify design; do curl -fsSL "https://daub.dev/references/$f.md" -o "references/$f.md"; done
```

Other agents: copy `SKILL.md` and `references/` into their skills folder, or point them at `https://daub.dev/SKILL.md`.
