# DAUB

**Considered CSS components for discerning interfaces.**

[![License: MIT](https://img.shields.io/badge/License-MIT-C67B5C.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-3D3832.svg)](https://daub.dev)
[![Components](https://img.shields.io/badge/components-64-D4C4A8.svg)](https://daub.dev)

[Live Demo](https://daub.dev) | [Layout Demos](https://daub.dev/demo.html) | [AI Docs](https://daub.dev/llms.txt)

---

## What is DAUB?

A drop-in CSS + JS component library with a tactile, handcrafted aesthetic. 64 components, 8 themes, zero build step. Thoughtfully composed, no ceremony required.

## Quick Start

### CDN (recommended)

```html
<link rel="stylesheet" href="https://daub.dev/daub.css">
<script src="https://daub.dev/daub.js"></script>
```

### Download

```bash
git clone https://github.com/sliday/daub.git
```

### Optional: Fonts & Icons

DAUB uses system font stacks by default. For richer typography:

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@300..900&family=Source+Serif+4:wght@300..900&family=Cabin:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --db-font-heading: 'Fraunces', Georgia, serif;
    --db-font-body: 'Source Serif 4', Georgia, serif;
    --db-font-ui: 'Cabin', system-ui, sans-serif;
  }
</style>

<!-- Lucide Icons (used in demos, not required) -->
<script src="https://unpkg.com/lucide@latest"></script>
```

## Components (64)

### Foundations
| Component | Class | Notes |
|-----------|-------|-------|
| Surface | `db-surface` | `--raised`, `--inset`, `--pressed` |
| Typography | `db-h1`–`db-h4` | `db-body`, `db-label`, `db-caption` |
| Prose | `db-prose` | `--sm`, `--lg`, `--xl`, `--2xl` |
| Elevation | `db-elevation-1` | `1`, `2`, `3` |
| Separator | `db-separator` | `--vertical`, `--dashed`, `__label` |
| Layout | `db-container` | `db-flex`, `db-grid`, `db-gap-*` |
| Utilities | `db-sr-only` | `db-text-muted`, `db-rounded-*`, etc. |

### Controls
| Component | Class | Notes |
|-----------|-------|-------|
| Button | `db-btn` | `--primary`, `--secondary`, `--sm`, `--lg`, `--icon`, `--loading` |
| Button Group | `db-btn-group` | Groups buttons with connected borders |
| Text Field | `db-field` | `--error` |
| Input | `db-input` | `--sm`, `--lg`, `--error`, standalone |
| Input Group | `db-input-group` | Addons + inputs + buttons |
| Textarea | `db-textarea` | `--error`, standalone |
| Checkbox | `db-checkbox` | |
| Radio | `db-radio` | `db-radio-group` |
| Switch | `db-switch` | `aria-checked` |
| Slider | `db-slider` | |
| Toggle | `db-toggle` | `--sm`, `aria-pressed` |
| Toggle Group | `db-toggle-group` | Single/multi select |
| Native Select | `db-select` | `__input` with chevron |
| Custom Select | `db-custom-select` | Search, selection, combobox |
| Kbd | `db-kbd` | `--sm` |
| Label | `db-label` | `--required`, `--optional` |
| Spinner | `db-spinner` | `--sm`, `--lg`, `--xl` |
| Input OTP | `db-otp` | `__input`, `__separator` |

### Navigation
| Component | Class | Notes |
|-----------|-------|-------|
| Tabs | `db-tabs` | |
| Breadcrumbs | `db-breadcrumbs` | |
| Pagination | `db-pagination` | |
| Stepper | `db-stepper` | `--completed`, `--active`, `--pending` |
| Nav Menu | `db-nav-menu` | `__item`, `--active` |
| Menubar | `db-menubar` | `__item`, `__dropdown` |
| Sidebar | `db-sidebar` | `__item`, `--active`, `__section` |

### Data Display
| Component | Class | Notes |
|-----------|-------|-------|
| Card | `db-card` | |
| Table | `db-table` | `data-db-sort` |
| Data Table | `db-data-table` | Sortable, selectable rows |
| List | `db-list` | |
| Badge | `db-badge` | `--new`, `--updated`, `--warning`, `--error` |
| Avatar | `db-avatar` | `--sm`, `--md`, `--lg` |
| Calendar | `db-calendar` | Day selection, today highlight |
| Chart | `db-chart` | CSS-only bar chart |
| Carousel | `db-carousel` | `__track`, `__slide`, `__dots` |
| Aspect Ratio | `db-aspect` | `--16-9`, `--4-3`, `--1-1`, `--21-9` |
| Scroll Area | `db-scroll-area` | `--horizontal`, `--vertical` |

### Feedback
| Component | Class | Notes |
|-----------|-------|-------|
| Toast | JS only | `DAUB.toast({ type, title, message })` |
| Alert | `db-alert` | `--info`, `--warning`, `--error`, `--success` |
| Progress | `db-progress` | `--indeterminate` |
| Skeleton | `db-skeleton` | `--text`, `--heading`, `--avatar`, `--btn` |
| Empty State | `db-empty` | |
| Tooltip | `db-tooltip` | `--top`, `--bottom`, `--left`, `--right` |

### Overlays
| Component | Class | Notes |
|-----------|-------|-------|
| Modal | `db-modal` | `DAUB.openModal()`, `DAUB.closeModal()` |
| Alert Dialog | `db-alert-dialog` | `DAUB.openAlertDialog()` |
| Sheet | `db-sheet` | `--right`, `--left`, `--top`, `--bottom` |
| Drawer | `db-drawer` | Mobile-friendly bottom panel |
| Popover | `db-popover` | `--top`, `--bottom`, `--left`, `--right` |
| Hover Card | `db-hover-card` | CSS hover trigger |
| Dropdown Menu | `db-dropdown` | `__item`, `__separator`, `__label` |
| Context Menu | `db-context-menu` | Right-click, `data-context-menu` |
| Command Palette | `db-command` | `DAUB.openCommand()`, Ctrl+K |

### Layout & Utility
| Component | Class | Notes |
|-----------|-------|-------|
| Accordion | `db-accordion` | Single/multi mode via `data-multi` |
| Collapsible | `db-collapsible` | Progressive disclosure |
| Resizable | `db-resizable` | `__handle--right`, `--bottom`, `--corner` |
| Date Picker | `db-date-picker` | Wraps Calendar in popover |
| Theme Switcher | `db-theme-switcher` | 4x2 grid for 8 themes |

## Themes

8 built-in themes:

| Theme | `data-theme` | Character |
|-------|-------------|-----------|
| Light | `light` | Warm cream, terracotta accents |
| Dark | `dark` | Deep charcoal, amber glow |
| Grunge Light | `grunge-light` | Rough textures, typewriter feel |
| Grunge Dark | `grunge-dark` | Dark + distressed, ink-stained |
| Parchment | `parchment` | Aged paper, gold accents |
| Ink | `ink` | Navy/silver, editorial |
| Ember | `ember` | Copper glow, warm dark |
| Bone | `bone` | Stark white, monochrome |

### Switching themes

```html
<html data-theme="dark">
```

```js
DAUB.setTheme('ink');
DAUB.cycleTheme();    // cycles through all 8
DAUB.getTheme();      // returns current theme name
```

Theme persists across page loads via `localStorage`.

### FOUC Prevention

```html
<script>
  (function(){try{var t=localStorage.getItem('db-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})();
</script>
```

## Prose Typography

The `.db-prose` class provides considered typographic defaults for long-form content:

```html
<div class="db-prose">
  <h2>Title</h2>
  <p>Body text with comfortable 1.75 line-height and 65ch max-width.</p>
</div>
```

Scale variants: `db-prose--sm`, `db-prose--lg`, `db-prose--xl`, `db-prose--2xl`.

## Customization

Override CSS custom properties:

```css
:root {
  --db-terracotta: #E07A5F;
  --db-cream: #FAF8F0;
  --db-font-heading: 'Your Font', serif;
}
```

Key variables: `--db-cream`, `--db-sand`, `--db-terracotta`, `--db-clay`, `--db-charcoal`, `--db-ink`, `--db-white`.

## Accessibility

- WCAG AA colour contrast across all 8 themes
- `aria-*` attributes on all interactive components
- Focus-visible outlines (keyboard navigation)
- Modal/Dialog: focus trapping, Escape to close
- Tabs: arrow key navigation
- Screen reader utility: `db-sr-only`
- Reduced motion support via `prefers-reduced-motion`

## AI Integration

DAUB speaks both human and machine:

- **`/llms.txt`** — Plain-text component reference for LLMs ([spec](https://llmstxt.org))
- **`/.well-known/ai-plugin.json`** — AI plugin manifest
- **`SKILL.md`** — Claude Code skill for DAUB development

Point your AI at `https://daub.dev/llms.txt` for complete component docs with HTML snippets.

## Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 15+
- Mobile Safari, Chrome for Android

No polyfills needed.

## Changelog

### v2.0.0

**64 components. 8 themes. Zero build step.**

- 36 new components: Data Table, Custom Select, Command Palette, Carousel, OTP Input, Resizable panels, Hover Card, Context Menu, Menubar, Sidebar, Drawer, Sheet, Alert Dialog, Toggle Group, Button Group, Input Group, Spinner, Kbd, Separator, Native Select, Aspect Ratio, Scroll Area, Date Picker, Chart, Nav Menu, Label, and more
- 4 new themes: Parchment, Ink, Ember, Bone (total: 8)
- CSS-only components: Separator, Spinner, Kbd, Input, Toggle, Button Group, Native Select
- Prose typography system with scale variants
- Layout utilities: `db-container`, `db-flex`, `db-grid`, `db-gap-*`
- Warmth slider: adjust page warmth via CSS custom property with persistence
- Theme switcher: dark-glass treatment for universal legibility across all themes
- Calendar today highlight: visible background tint + strong border
- 8px grid alignment throughout
- Nested border-radius fix for cards and modals

### v1.1.0

- Initial release: 28 components, 4 themes

## License

MIT

---

Made with consideration by [Sliday](https://github.com/sliday).
