# DAUB

**Considered CSS components for discerning interfaces.**

[![License: MIT](https://img.shields.io/badge/License-MIT-C67B5C.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.2.0-3D3832.svg)](https://daub.dev)
[![Components](https://img.shields.io/badge/components-67-D4C4A8.svg)](https://daub.dev)

[Live Demo](https://daub.dev) | [Layout Demos](https://daub.dev/demo.html) | [AI Docs](https://daub.dev/llms.txt)

---

## What is DAUB?

A drop-in CSS + JS component library with a tactile, handcrafted aesthetic. 67 components, 6 theme families (each with light & dark modes), zero build step. Thoughtfully composed, no ceremony required.

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

## Components (67)

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
| Button | `db-btn` | `--primary`, `--secondary`, `--ghost`, `--sm`, `--lg`, `--icon`, `--loading` |
| Button Group | `db-btn-group` | Groups buttons with connected borders |
| Text Field | `db-field` | `--error` |
| Input | `db-input` | `--sm`, `--lg`, `--error`, standalone |
| Input Group | `db-input-group` | Addons + inputs + buttons |
| Input Icon | `db-input-icon` | `--right`, icon prefix/suffix |
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
| Sidebar | `db-sidebar` | `__item`, `--active`, `--collapsed`, `__toggle` |
| Bottom Nav | `db-bottom-nav` | `__item`, `--active`, `__badge`, `--always` |

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
| Chip | `db-chip` | `--red`, `--green`, `--blue`, `--purple`, `--amber`, `--pink`, `__close` |
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
| Theme Switcher | `db-theme-switcher` | 6 families + scheme switcher |

## Themes

6 theme families, each with light and dark modes (12 variants total):

| Family | Light | Dark | Character |
|--------|-------|------|-----------|
| Default | `light` | `dark` | Warm cream / deep charcoal |
| Grunge | `grunge-light` | `grunge-dark` | Typewriter / ink-stained |
| Solarized | `solarized` | `solarized-dark` | Warm tinted / dusky amber |
| Ink | `ink-light` | `ink` | Cool editorial / navy silver |
| Ember | `ember-light` | `ember` | Sunlit pottery / copper glow |
| Bone | `bone` | `bone-dark` | Stark white / grayscale brutalism |

### Switching themes

```html
<html data-theme="dark">
```

```js
// Family-based (recommended)
DAUB.setFamily('ink');       // sets ink-light or ink depending on scheme
DAUB.setScheme('dark');      // switches current family to dark mode
DAUB.cycleTheme();           // cycles through 6 families, preserving mode

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

- WCAG AA colour contrast across all 12 theme variants
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

### v2.2.0

**Theme families + accent color picker.**

- Theme families: 6 families (Default, Grunge, Solarized, Ink, Ember, Bone) × light/dark = 12 variants
- Solarized theme: replaces Parchment with warm tinted / dusky amber palette
- New palettes: `solarized-dark`, `ink-light`, `ember-light`, `bone-dark`
- Scheme control: `DAUB.setScheme('auto'|'light'|'dark')` — separate from family selection
- Family API: `DAUB.setFamily('ink')`, `DAUB.getFamily()`, `DAUB.cycleTheme()` cycles 6 families
- Accent color picker: 12 curated natural colors + reset, persisted to localStorage
- `DAUB.setAccent(hex)` / `DAUB.resetAccent()` / `DAUB.getAccent()` API
- FOUC prevention: now restores scheme and accent color before paint
- Theme switcher: 3×2 family grid + 3-button scheme row (replaces 4×2 theme grid)
- Backward compatible: `DAUB.setTheme('dark')` still works directly
- Bug fixes: modal centering on all viewports, toast visibility in dark themes, sheet/drawer height consistency, tooltip positioning edge-case corrections

### v2.1.1

**"Daub" definition + housekeeping.**

- Hero: dictionary-style "daub" definition below the headline
- Fixed component count across meta tags, structured data, and showcase stats (64 → 67)
- Updated JSON-LD version to 2.1.1

### v2.1.0

**67 components. Semantic tokens, ghost buttons, input icons, chips, bottom nav, sidebar collapse.**

- Semantic design tokens: theme-aware aliases (`--db-color-bg`, `--db-color-text`, `--db-color-accent`, etc.) that auto-resolve across all 12 theme variants
- Ghost button: transparent `db-btn--ghost` variant for subtle actions
- Icon button colors: `db-btn--icon-danger`, `--icon-success`, `--icon-accent` with tinted hover backgrounds
- Input with icon: `db-input-icon` with prefix/suffix icon positions and `:focus-within` highlight
- Chip/Tag: `db-chip` with 6 color presets and arbitrary HSL color support via `--db-chip-h/s/l`
- Bottom navigation: `db-bottom-nav` for mobile apps with badge support and safe-area padding
- Sidebar collapse: `db-sidebar--collapsed` mode with hover tooltips and `db-sidebar__toggle` button
- `DAUB.toggleSidebar()` JS API for programmatic sidebar collapse

### v2.0.3

**Noise texture, grunge corners & bug fixes.**

- Noise texture slider: adjustable grain overlay via `--db-noise` CSS variable with persistence
- Grunge themes: sharp corners (2-3px radius) for typewriter/rough aesthetic
- Vertical stepper: new `db-stepper--vertical` modifier for timeline layouts
- Primary button hover/active fix: `<a>` elements no longer lose white text on hover
- Tooltip wrapping: long text wraps gracefully instead of clipping
- Card overflow: `overflow: hidden` prevents child elements from bleeding
- Card border-radius uses `--db-radius-4` variable (theme-aware)
- Showcase panel radius uses CSS variables for theme adaptability

### v2.0.2

**Nested border-radius & card refinement.**

- Nested border-radius JS utility: auto-calculates `innerRadius = outerRadius - padding` for cards, modals, sheets, drawers
- Showcase frame: generous 36px radius with auto-computed inner radii
- Card border-radius: increased from 12px to 20px for softer, more premium feel
- `DAUB.fixNestedRadius()` exposed in public API for dynamic content

### v2.0.1

**Polish pass — 10 quality fixes.**

- Install snippet: 2-line layout showing both CSS and JS files
- Button active state: instant press feedback, no light-color blink
- Calendar hover: selected day keeps terracotta gradient on hover
- Theme switcher: nested border-radius (12px outer - 4px padding = 8px inner)
- Theme switcher: mobile-friendly 8x1 horizontal toolbar on small screens
- Warmth slider: 3x stronger visual effect (saturate + sepia range increased)
- Showcase: replaced fake Email/Subscribe with "Try it live" demo controls
- Component index: centered tabs with gap below sticky nav
- Copy button: absolute positioning for consistent visibility on all screens

### v2.0.0

**64 components. 6 theme families (12 variants). Zero build step.**

- 36 new components: Data Table, Custom Select, Command Palette, Carousel, OTP Input, Resizable panels, Hover Card, Context Menu, Menubar, Sidebar, Drawer, Sheet, Alert Dialog, Toggle Group, Button Group, Input Group, Spinner, Kbd, Separator, Native Select, Aspect Ratio, Scroll Area, Date Picker, Chart, Nav Menu, Label, and more
- 4 new themes: Solarized, Ink, Ember, Bone
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
