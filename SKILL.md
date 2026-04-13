---
name: daub-ui
description: "Build UI with DAUB, a drop-in CSS + JS component library (76 components, 20 theme families) from daub.dev. Use when the user asks to create interfaces, pages, or dashboards using DAUB components, apply db- prefixed CSS classes, configure DAUB themes, use the DAUB MCP server tools, or integrate daub-ui via CDN or npm. Trigger on mentions of 'daub', 'daub.dev', 'daub-ui', 'db- components', 'considered components', 'tactile UI kit', or 'DAUB theme'. Do NOT use for general CSS questions unrelated to DAUB."
allowed-tools: "Read, Write, Edit, Bash, WebFetch, mcp__daub__generate_ui, mcp__daub__get_component_catalog, mcp__daub__validate_spec, mcp__daub__render_spec"
---

# DAUB UI — Component Library

DAUB is a drop-in CSS + JS library with 76 considered components and 20 theme families (40 variants). Thoughtfully composed, no ceremony required.

npm: `daub-ui` | CDN: `cdn.jsdelivr.net/npm/daub-ui@latest/daub.css`
Machine-readable component reference: `https://daub.dev/components.json`
TypeScript declarations: `https://daub.dev/daub.d.ts`

## Workflow

1. **Check MCP availability**: If the DAUB MCP server is connected, prefer MCP tools (`generate_ui`, `get_component_catalog`, `validate_spec`, `render_spec`) over manual HTML construction.
2. **With MCP**: Call `generate_ui` with a natural language prompt → iterate with `existing_spec` → `validate_spec` → `render_spec` for preview URL.
3. **Without MCP**: Build HTML manually using `db-` prefixed classes from the component reference below. Consult `https://daub.dev/llms.txt` for complete HTML examples.
4. **Theming**: Apply themes via `<html data-theme="dark">` or JS API (`DAUB.setFamily()`, `DAUB.setTheme()`).

## Include (CDN)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daub-ui@latest/daub.css">
<script src="https://cdn.jsdelivr.net/npm/daub-ui@latest/daub.js"></script>
```

Alternative CDN:
```html
<link rel="stylesheet" href="https://unpkg.com/daub-ui@latest/daub.css">
<script src="https://unpkg.com/daub-ui@latest/daub.js"></script>
```

npm install:
```bash
npm install daub-ui
```

Optional fonts (falls back gracefully):
```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@300..900&family=Source+Serif+4:wght@300..900&family=Cabin:wght@400;500;600;700&display=swap" rel="stylesheet">
```

## Class Convention

All classes: `db-` prefix. All CSS variables: `--db-` prefix.

## Themes

Set: `<html data-theme="dark">`
Family API: `DAUB.setFamily('ink')` / `DAUB.setScheme('dark')` / `DAUB.getFamily()`
Direct API: `DAUB.setTheme('dark')` / `DAUB.cycleTheme()` / `DAUB.getTheme()`
Accent: `DAUB.setAccent('#6B7C3E')` / `DAUB.resetAccent()`
Families (20): default, grunge, solarized, ink, ember, bone, dracula, nord, one-dark, monokai, gruvbox, night-owl, github, catppuccin, tokyo-night, material, synthwave, shades-of-purple, ayu, horizon (each with light + dark)
Categories: originals, classics, modern, trending
Category API: `DAUB.THEME_CATEGORIES`, `DAUB.getCategory('dracula')`

## Components Quick Reference

### Foundations
- **Surface**: `db-surface--raised` / `--inset` / `--pressed`
- **Typography**: `db-h1`–`db-h4`, `db-body`, `db-label`, `db-caption`
- **Prose**: `db-prose` / `--sm` / `--lg` / `--xl` / `--2xl`
- **Elevation**: `db-elevation-1` / `-2` / `-3`
- **Separator**: `db-separator` / `--vertical` / `--dashed` / `__label`
- **Stack**: flexbox layout — `direction`, `gap`, `justify`, `align`, `wrap`, `container`
- **Grid**: CSS grid layout — `columns` (2-6), `gap`, `align`, `container`; classes: `db-grid--2` through `--6`, `db-gap-3`
- **Responsive**: `db-hide-mobile`, `db-show-mobile`, `db-hide-tablet`, `db-show-tablet`, `db-hide-desktop`, `db-show-desktop`
- **Utilities**: `db-sr-only`, `db-text-muted`, `db-rounded-*`

### Controls
- **Button**: `db-btn db-btn--primary` / `--secondary` / `--ghost` / `--sm` / `--lg` / `--icon` / `--loading`
- **Icon Button Colors**: `db-btn--icon-danger` / `--icon-success` / `--icon-accent`
- **Button Group**: `db-btn-group` — groups buttons with connected borders
- **Field**: `db-field` > `db-field__label` + `db-field__input` + `db-field__helper`
- **Input**: `db-input` / `--sm` / `--lg` / `--error` (standalone)
- **Input Group**: `db-input-group` > `__addon` + `db-input` + `db-btn`
- **Input Icon**: `db-input-icon` > `db-input-icon__icon` + `db-input` / `--right`
- **Search**: `db-search` > `db-search__icon` + `db-input` + `db-search__clear`
- **Textarea**: `db-textarea` / `--error` (standalone)
- **Checkbox**: `db-checkbox` > `db-checkbox__input` + `db-checkbox__box`
- **Radio**: `db-radio-group` > `db-radio` > `db-radio__input` + `db-radio__circle`
- **Switch**: `db-switch` (role="switch", JS-managed)
- **Slider**: `db-slider` > `db-slider__input` + `db-slider__value`
- **Toggle**: `db-toggle` / `--sm` (aria-pressed)
- **Toggle Group**: `db-toggle-group` — single/multi select
- **Native Select**: `db-select` > `db-select__input`
- **Custom Select**: `db-custom-select` — search, selection, combobox
- **Kbd**: `db-kbd` / `--sm`
- **Label**: `db-label` / `--required` / `--optional`
- **Spinner**: `db-spinner` / `--sm` / `--lg` / `--xl`
- **Input OTP**: `db-otp` > `db-otp__input` + `db-otp__separator`

### Navigation
- **Tabs**: `db-tabs` > `db-tabs__list` > `db-tabs__tab` + `db-tabs__panel`
- **Breadcrumbs**: `db-breadcrumbs` > ol > li > a
- **Pagination**: `db-pagination` > `db-pagination__btn`
- **Stepper**: `db-stepper` > `db-stepper__step--completed/--active/--pending`
- **Nav Menu**: `db-nav-menu` > `db-nav-menu__item` / `--active`
- **Navbar**: `db-navbar` > `__brand` + `__nav` + `__spacer` + `__actions` + `__toggle` (sticky, mobile hamburger)
- **Menubar**: `db-menubar` > `db-menubar__item` + `db-menubar__dropdown`
- **Sidebar**: `db-sidebar` > `db-sidebar__section` > `db-sidebar__item` / `--active` / `--collapsed` / `__toggle`
- **Bottom Nav**: `db-bottom-nav` > `db-bottom-nav__item` / `--active` / `__badge` / `--always`

### Data Display
- **Card**: `db-card` > `db-card__header` + `db-card__title` + `db-card__footer` / `--media` (edge-to-edge images)
- **Table**: `db-table` (sortable with `data-db-sort` on th)
- **Data Table**: `db-data-table` — sortable, selectable rows
- **List**: `db-list` > `db-list__item` > `db-list__title` + `db-list__secondary`
- **Badge**: `db-badge` / `--new` / `--updated` / `--warning` / `--error`
- **Chip**: `db-chip` / `--red` / `--green` / `--blue` / `--purple` / `--amber` / `--pink` / `--active` / `__close` / `data-db-chip-toggle`
- **Avatar**: `db-avatar db-avatar--md` (sm=32px, md=40px, lg=56px)
- **Avatar Group**: `db-avatar-group` > `db-avatar` + `db-avatar-group__overflow` (overlapping stack)
- **Calendar**: `db-calendar` — day selection, today highlight
- **Chart**: `db-chart` — CSS-only bar chart
- **Carousel**: `db-carousel` > `__track` + `__slide` + `__dots`
- **Aspect Ratio**: `db-aspect` / `--16-9` / `--4-3` / `--1-1` / `--21-9`
- **Scroll Area**: `db-scroll-area` / `--horizontal` / `--vertical`

### Feedback
- **Toast**: `DAUB.toast('Quick message')` or `DAUB.toast({ type: 'success', title: 'Done', message: '...' })`
- **Alert**: `db-alert db-alert--warning` > `db-alert__icon` + `db-alert__content`
- **Progress**: `db-progress` > `db-progress__bar` style="--db-progress: 65%"
- **Skeleton**: `db-skeleton--text` / `--heading` / `--avatar` / `--btn`
- **Empty State**: `db-empty` > `db-empty__icon` + `db-empty__title` + `db-empty__message`
- **Tooltip**: `db-tooltip` / `--top` / `--bottom` / `--left` / `--right`

### Overlays (always use JS API — handles backdrop, focus trap, scroll lock)
- **Modal**: `db-modal-overlay#id[aria-hidden] > db-modal > __header + __body + __footer`
  JS: `DAUB.openModal('id')` / `DAUB.closeModal('id')` / `data-db-modal-trigger="id"`
- **Alert Dialog**: `db-alert-dialog#id > __overlay + __panel > __title + __desc + __actions`
  JS: `DAUB.openAlertDialog('id')` / `data-action="cancel"` auto-closes
- **Sheet**: `db-sheet.db-sheet--right#id > __overlay + __panel > __header + __body`
  JS: `DAUB.openSheet('id')` — modifiers: `--right` / `--left` / `--top` / `--bottom`
- **Drawer**: `db-drawer#id > __overlay + __panel > __handle + __body`
  JS: `DAUB.openDrawer('id')` — mobile-friendly bottom panel
- **Command Palette**: `db-command#id > __overlay + __panel > __input-wrap + __list`
  JS: `DAUB.openCommand('id')` — Ctrl+K / Cmd+K shortcut
- **Dropdown Menu**: `db-dropdown > __trigger + __content > __item + __separator + __label`
  JS auto-initializes click toggle. `__content--right` for right-aligned. `__menu` is an alias for `__content`.
- **Context Menu**: `db-context-menu` — right-click, `data-context-menu`
- **Popover**: `db-popover` / `--top` / `--bottom` / `--left` / `--right`
- **Hover Card**: `db-hover-card` — CSS hover trigger

### Layout & Utility
- **Accordion**: `db-accordion` — single/multi mode via `data-multi`
- **Collapsible**: `db-collapsible` — progressive disclosure
- **Resizable**: `db-resizable` > `__handle--right` / `--bottom` / `--corner`
- **Date Picker**: `db-date-picker` — wraps Calendar in popover
- **Theme Switcher**: `db-theme-switcher` — toggle button + categorized popover with 20 families + scheme row

### Dashboard Primitives
- **Stat Card**: `db-stat` > `db-stat__label` + `db-stat__value` + `db-stat__trend` / `--up` / `--down`
- **Chart Card**: `db-chart-card` > `db-chart-card__header` + `db-chart-card__body`
- **Table Utilities**: `db-table--compact`, `db-table--hover`, `db-td--number`, `db-td--actions`

### JS Helpers
- **getColor**: `DAUB.getColor('primary')` — returns current theme's CSS variable value as hex
- **Theme Events**: `document.addEventListener('daub:theme-change', e => e.detail.theme)`

## Notes

- **Field inputs**: `db-field__input` goes on the wrapper element (not just `<input>`) — applies to input, textarea, select wrappers, or custom control elements.
- **Icons**: DAUB pairs well with [Lucide](https://lucide.dev) icons (`<script src="https://unpkg.com/lucide@latest"></script>`). All demos use Lucide.
- **Overlay BEM**: Overlay components use hyphenated block names (e.g. `db-modal-overlay`, `db-alert-dialog`) with `__` children (e.g. `__panel`, `__body`). The outer wrapper gets the `id` and `aria-hidden` attributes that JS targets.

## MCP Server

DAUB has a remote MCP server — if it's connected, use the tools instead of manually building HTML.

**Setup** (one-time):
```bash
claude mcp add daub --transport http https://daub.dev/api/mcp
```

**Tools available:**

| Tool | When to use |
|------|-------------|
| `generate_ui` | Generate a full DAUB spec from a natural language prompt. Returns a JSON spec with components, props, layout, and theme. |
| `get_component_catalog` | Look up available components, their props, valid themes, and the spec format. Use before hand-building specs. |
| `validate_spec` | Check a spec for broken references, unknown types, missing children. Run after editing specs manually. |
| `render_spec` | Get a playground preview URL for any spec. |

**Workflow with MCP:**
1. Call `generate_ui` with a prompt like "Admin dashboard with sidebar, stat cards, and data table. Dracula theme."
2. The tool returns a flat JSON spec — iterate by calling `generate_ui` again with `existing_spec` + modification instructions
3. Call `validate_spec` to verify the spec is clean
4. Call `render_spec` to get a preview URL

**Without MCP** (fallback): Build HTML manually using the component classes documented above, or point the LLM at `https://daub.dev/llms.txt`.

## Full Docs

For complete HTML examples: `https://daub.dev/llms.txt`
For json-render (Vercel Generative UI) integration: see the catalog+registry recipe in `llms.txt`.
