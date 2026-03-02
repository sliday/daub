# DAUB

**Considered CSS components for discerning interfaces.**

[![License: MIT](https://img.shields.io/badge/License-MIT-C67B5C.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.5.6-3D3832.svg)](https://daub.dev)
[![Components](https://img.shields.io/badge/components-74-D4C4A8.svg)](https://daub.dev)

[Live Demo](https://daub.dev) | [Layout Demos](https://daub.dev/demo.html) | [AI Docs](https://daub.dev/llms.txt)

---

## What is DAUB?

A drop-in CSS + JS component library with a tactile, handcrafted aesthetic. 74 components, 20 theme families (each with light & dark modes), zero build step. Thoughtfully composed, no ceremony required.

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

## Components (74)

### Foundations
| Component | Class | Notes |
|-----------|-------|-------|
| Surface | `db-surface` | `--raised`, `--inset`, `--pressed` |
| Typography | `db-h1`–`db-h4` | `db-body`, `db-label`, `db-caption` |
| Prose | `db-prose` | `--sm`, `--lg`, `--xl`, `--2xl` |
| Elevation | `db-elevation-1` | `1`, `2`, `3` |
| Separator | `db-separator` | `--vertical`, `--dashed`, `__label` |
| Layout | `db-container` | `--wide`, `--narrow`, `db-flex`, `db-grid--2`–`--6`, `db-gap-*` |
| Responsive | `db-hide-mobile` | `db-show-mobile`, `db-hide-tablet`, `db-show-tablet`, etc. |
| Utilities | `db-sr-only` | `db-text-muted`, `db-rounded-*`, etc. |

### Controls
| Component | Class | Notes |
|-----------|-------|-------|
| Button | `db-btn` | `--primary`, `--secondary`, `--ghost`, `--sm`, `--lg`, `--icon`, `--loading` |
| Button Group | `db-btn-group` | Groups buttons with connected borders |
| Text Field | `db-field` | `--error` |
| Input | `db-input` | `--sm`, `--lg`, `--error`, standalone |
| Input Group | `db-input-group` | Addons + inputs + buttons |
| Input Icon | `db-input-icon` | `--right`, icon prefix/suffix |
| Search | `db-search` | `__icon`, `__clear`, auto show/hide clear button |
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
| Navbar | `db-navbar` | `__brand`, `__nav`, `__actions`, `__toggle`, sticky mobile hamburger |
| Menubar | `db-menubar` | `__item`, `__dropdown` |
| Sidebar | `db-sidebar` | `__item`, `--active`, `--collapsed`, `__toggle` |
| Bottom Nav | `db-bottom-nav` | `__item`, `--active`, `__badge`, `--always` |

### Data Display
| Component | Class | Notes |
|-----------|-------|-------|
| Card | `db-card` | `--media` for edge-to-edge images |
| Table | `db-table` | `data-db-sort` |
| Data Table | `db-data-table` | Sortable, selectable rows |
| List | `db-list` | |
| Badge | `db-badge` | `--new`, `--updated`, `--warning`, `--error` |
| Avatar | `db-avatar` | `--sm`, `--md`, `--lg` |
| Avatar Group | `db-avatar-group` | Overlapping stack + `__overflow` counter |
| Calendar | `db-calendar` | Day selection, today highlight |
| Chart | `db-chart` | CSS-only bar chart |
| Carousel | `db-carousel` | `__track`, `__slide`, `__dots` |
| Aspect Ratio | `db-aspect` | `--16-9`, `--4-3`, `--1-1`, `--21-9` |
| Chip | `db-chip` | `--red`, `--green`, `--blue`, `--purple`, `--amber`, `--pink`, `--active`, `__close`, `data-db-chip-toggle` |
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
| Theme Switcher | `db-theme-switcher` | 20 families + scheme switcher |

## Themes

20 theme families in 4 categories, each with light and dark modes (40 variants total):

### Originals
| Family | Light | Dark | Character |
|--------|-------|------|-----------|
| Default | `light` | `dark` | Warm cream / deep charcoal |
| Grunge | `grunge-light` | `grunge-dark` | Typewriter / ink-stained |
| Solarized | `solarized` | `solarized-dark` | Warm tinted / dusky amber |
| Ink | `ink-light` | `ink` | Cool editorial / navy silver |
| Ember | `ember-light` | `ember` | Sunlit pottery / copper glow |
| Bone | `bone` | `bone-dark` | Stark white / grayscale brutalism |

### Classics
| Family | Light | Dark | Character |
|--------|-------|------|-----------|
| Dracula | `dracula-light` | `dracula` | Alucard warmth / vampire purple |
| Nord | `nord-light` | `nord` | Snow storm / arctic frost |
| One Dark | `one-dark-light` | `one-dark` | Soft atom / midnight code |
| Monokai | `monokai-light` | `monokai` | Warm latte / neon noir |
| Gruvbox | `gruvbox-light` | `gruvbox` | Retro cream / earthy dark |

### Modern
| Family | Light | Dark | Character |
|--------|-------|------|-----------|
| Night Owl | `night-owl-light` | `night-owl` | Soft dawn / deep twilight |
| GitHub | `github` | `github-dark` | Clean primer / dimmed slate |
| Catppuccin | `catppuccin` | `catppuccin-dark` | Latte pastel / mocha warmth |
| Tokyo Night | `tokyo-night-light` | `tokyo-night` | Storm light / city neon |
| Material | `material-light` | `material` | Lighter paper / palenight haze |

### Trending
| Family | Light | Dark | Character |
|--------|-------|------|-----------|
| Synthwave | `synthwave-light` | `synthwave` | Warm retro / neon purple |
| Shades of Purple | `shades-of-purple-light` | `shades-of-purple` | Soft lavender / deep violet |
| Ayu | `ayu` | `ayu-dark` | Warm light / mirage dark |
| Horizon | `horizon-light` | `horizon` | Soft rose / warm dusk |

### Switching themes

```html
<html data-theme="dark">
```

```js
// Family-based (recommended)
DAUB.setFamily('ink');       // sets ink-light or ink depending on scheme
DAUB.setScheme('dark');      // switches current family to dark mode
DAUB.cycleTheme();           // cycles through 20 families, preserving mode

// Direct theme (backward compatible)
DAUB.setTheme('ink');        // sets exact theme variant
DAUB.getTheme();             // returns current theme name

// Accent color
DAUB.setAccent('#6B7C3E');   // olive accent, overrides terracotta
DAUB.resetAccent();          // restore theme default
```

Theme, scheme, and accent persist across page loads via `localStorage`.

### FOUC Prevention

```html
<script>
  (function(){try{var t=localStorage.getItem('db-theme');if(t)document.documentElement.setAttribute('data-theme',t);var s=localStorage.getItem('db-scheme');if(s)document.documentElement.setAttribute('data-scheme',s);var a=localStorage.getItem('db-accent');if(a)document.documentElement.style.setProperty('--db-terracotta',a)}catch(e){}})();
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

Semantic tokens (theme-aware aliases): `--db-color-bg`, `--db-color-surface`, `--db-color-text`, `--db-color-text-secondary`, `--db-color-text-muted`, `--db-color-border`, `--db-color-accent`, `--db-color-success`, `--db-color-warning`, `--db-color-error`.

## Accessibility

- WCAG AA colour contrast across all 40 theme variants
- `aria-*` attributes on all interactive components
- Focus-visible outlines (keyboard navigation)
- Modal/Dialog: focus trapping, Escape to close
- Tabs: arrow key navigation
- Screen reader utility: `db-sr-only`
- Reduced motion support via `prefers-reduced-motion`

## AI Integration

DAUB speaks both human and machine:

- **`/llms.txt`** — Plain-text component reference for LLMs ([spec](https://llmstxt.org))
- **`/components.json`** — Machine-readable structured component reference (74 components with HTML examples)
- **`/daub.d.ts`** — TypeScript declarations for `window.DAUB` API
- **`/.well-known/ai-plugin.json`** — AI plugin manifest
- **`SKILL.md`** — Claude Code skill for DAUB development

Point your AI at `https://daub.dev/llms.txt` for complete component docs with HTML snippets, or fetch `https://daub.dev/components.json` for structured data.

## Use with AI

Drop these prompts into Claude, ChatGPT, Cursor, or any AI assistant. Each produces a complete, working HTML page. Add "Fetch docs from daub.dev/llms.txt first" for best results.

| Prompt | What You Get |
|--------|-------------|
| "Build an analytics dashboard using DAUB with sidebar, stat cards, sortable data table, and bar chart. Dark theme." | Full dashboard with `db-sidebar`, `db-card`, `db-data-table`, `db-chart` |
| "Create a user settings page with DAUB. Profile section with avatar, notification switches, danger zone with alert dialog. Nord theme." | Settings form with `db-field`, `db-switch`, `db-alert-dialog` |
| "Build a responsive product catalog with DAUB. Media cards in a grid, chip filters, pagination, navbar with search. Catppuccin theme." | E-commerce layout with `db-card--media`, `db-chip`, `db-pagination`, `db-search` |
| "Create a Kanban task board using DAUB. Three columns, priority badges, assignee avatars, command palette. Tokyo Night theme." | Project board with `db-grid--3`, `db-badge`, `db-avatar`, `db-command` |
| "Build a blog reading page with DAUB. Prose typography, breadcrumbs, author card, table of contents sidebar. GitHub theme." | Article layout with `db-prose`, `db-breadcrumbs`, `db-nav-menu` |
| "Create a multi-step onboarding form with DAUB's stepper. Account info, preferences, confirmation. Ember theme." | Wizard flow with `db-stepper`, `db-field`, `db-switch`, `db-card` |

### Minimal Complete Page

```html
<!DOCTYPE html>
<html data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://daub.dev/daub.css">
</head>
<body>
  <main class="db-container db-container--narrow" style="padding-top:var(--db-space-6)">
    <h1 class="db-h2">System Status</h1>
    <div class="db-card db-mb-4">
      <div class="db-card__header">
        <h3 class="db-card__title">API</h3>
        <span class="db-badge db-badge--new">Operational</span>
      </div>
      <div class="db-progress"><div class="db-progress__bar" style="--db-progress:99.9%"></div></div>
    </div>
    <div class="db-alert db-alert--warning">
      <div class="db-alert__content">
        <div class="db-alert__title">Scheduled Maintenance</div>
        <p>Database migration Sunday 2am UTC.</p>
      </div>
    </div>
  </main>
  <div class="db-theme-switcher"></div>
  <script src="https://daub.dev/daub.js"></script>
</body>
</html>
```

Save as `.html`, open in a browser. No build step.

## Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 15+
- Mobile Safari, Chrome for Android

No polyfills needed.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

**Latest: v2.5.6** — Fix nested border radius flattening form controls. 74 components, 20 theme families.

## License

MIT

---

Made with consideration by [Sliday](https://github.com/sliday).
