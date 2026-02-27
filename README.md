# DAUB

**Warm, rustic neo-skeuomorphic CSS components.**

[![License: MIT](https://img.shields.io/badge/License-MIT-C67B5C.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-3D3832.svg)](https://daub.dev)
[![CSS Size](https://img.shields.io/badge/CSS-46KB-D4C4A8.svg)](daub.css)

[Live Demo](https://daub.dev) | [Layout Demos](https://daub.dev/demo.html) | [AI Docs](https://daub.dev/llms.txt)

---

## What is DAUB?

A drop-in CSS + JS component library with a tactile, handcrafted aesthetic. 28 components, 4 themes, zero build step. Looks like it was painted on with a brush.

## Quick Start

### CDN (recommended)

```html
<link rel="stylesheet" href="https://daub.dev/daub.css">
<script src="https://daub.dev/daub.js"></script>
```

### Download

Clone and include the files directly:

```bash
git clone https://github.com/sliday/daub.git
```

```html
<link rel="stylesheet" href="daub.css">
<script src="daub.js"></script>
```

### Optional: Fonts & Icons

```html
<!-- Google Fonts (falls back to Georgia/system-ui) -->
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@300..900&family=Source+Serif+4:wght@300..900&family=Cabin:wght@400;500;600;700&display=swap" rel="stylesheet">

<!-- Lucide Icons (used in demos, not required) -->
<script src="https://unpkg.com/lucide@latest"></script>
```

## Components (28)

| Component | Class | Variants |
|-----------|-------|----------|
| Button | `db-btn` | `--primary`, `--secondary`, `--sm`, `--lg`, `--icon`, `--loading` |
| Text Field | `db-field` | `--error` |
| Checkbox | `db-checkbox` | |
| Radio | `db-radio` | Group: `db-radio-group` |
| Switch | `db-switch` | Toggle via JS, `aria-checked` |
| Slider | `db-slider` | |
| Tabs | `db-tabs` | |
| Card | `db-card` | |
| Modal | `db-modal` | JS API: `DAUB.openModal()` |
| Toast | JS only | `DAUB.toast({ type, title, message })` |
| Alert | `db-alert` | `--info`, `--warning`, `--error`, `--success` |
| Badge | `db-badge` | `--new`, `--updated`, `--warning`, `--error` |
| Avatar | `db-avatar` | `--sm`, `--md`, `--lg` |
| Table | `db-table` | Sortable: `data-db-sort` |
| List | `db-list` | |
| Breadcrumbs | `db-breadcrumbs` | |
| Pagination | `db-pagination` | |
| Stepper | `db-stepper` | `--completed`, `--active`, `--pending` |
| Tooltip | `db-tooltip` | Wrap in `db-tooltip-wrap` |
| Progress | `db-progress` | `--indeterminate` |
| Skeleton | `db-skeleton` | `--text`, `--heading`, `--avatar`, `--btn` |
| Empty State | `db-empty` | |
| Surface | `db-surface` | `--raised`, `--inset`, `--pressed` |
| Typography | `db-h1`–`db-h4` | `db-body`, `db-label`, `db-caption` |
| Elevation | `db-elevation-1` | `1`, `2`, `3` |
| Layout | `db-container` | `db-flex`, `db-grid`, `db-gap-*` |
| Theme Switcher | `db-theme-switcher` | |
| Utilities | `db-sr-only` | `db-text-muted`, `db-rounded-*`, etc. |

## Themes

4 built-in themes:

| Theme | `data-theme` | Vibe |
|-------|-------------|------|
| Light | `light` | Warm cream, terracotta accents |
| Dark | `dark` | Deep charcoal, amber glow |
| Grunge Light | `grunge-light` | Rough textures, typewriter feel |
| Grunge Dark | `grunge-dark` | Dark + distressed, ink-stained |

### Switching themes

```html
<!-- Declarative -->
<html data-theme="dark">
```

```js
// Programmatic
DAUB.setTheme('grunge-dark');
DAUB.cycleTheme();        // cycles through all 4
DAUB.getTheme();           // returns current theme name
```

Theme persists across page loads via `localStorage`.

### FOUC Prevention

Add this before your CSS to prevent flash of unstyled content:

```html
<script>
  (function(){try{var t=localStorage.getItem('db-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})();
</script>
```

## Customization

Override CSS custom properties to adapt the palette:

```css
:root {
  --db-terracotta: #E07A5F;  /* change accent */
  --db-cream: #FAF8F0;       /* change background */
  --db-font-heading: 'Your Font', serif;
}
```

Key variables: `--db-cream`, `--db-sand`, `--db-terracotta`, `--db-clay`, `--db-charcoal`, `--db-ink`, `--db-white`.

## Accessibility

- WCAG AA color contrast across all 4 themes
- `aria-*` attributes on all interactive components
- Focus-visible outlines (keyboard navigation)
- Modal: focus trapping, Escape to close, return focus to trigger
- Tabs: arrow key navigation, proper `role="tablist"` / `role="tab"` / `role="tabpanel"`
- Switch: `role="switch"` + `aria-checked`
- Toast: `aria-live="polite"` region
- Screen reader utility: `db-sr-only`

## AI Integration

DAUB is optimized for AI agent consumption:

- **`/llms.txt`** — Plain-text component reference for LLMs ([spec](https://llmstxt.org))
- **`/.well-known/ai-plugin.json`** — AI plugin manifest
- **`SKILL.md`** — Claude Code skill for DAUB development

Point your AI at `https://daub.dev/llms.txt` for full component docs with HTML snippets.

## Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 15+
- Mobile Safari, Chrome for Android

No polyfills needed. Uses CSS custom properties, `:focus-visible`, `gap`, `grid`.

## License

MIT

---

Made with warmth by [Sliday](https://github.com/sliday).
