---
name: daub-ui
description: |
  Use when building UI with DAUB, the considered CSS component library from daub.dev.
  Trigger phrases: "daub", "daub.dev", "considered components", "db- components", "tactile UI kit"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
---

# DAUB UI — Component Library

DAUB is a drop-in CSS + JS library with 67 considered components and 8 themes. Thoughtfully composed, no ceremony required.

## Include

```html
<link rel="stylesheet" href="https://daub.dev/daub.css">
<script src="https://daub.dev/daub.js"></script>
```

Optional fonts (falls back gracefully):
```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@300..900&family=Source+Serif+4:wght@300..900&family=Cabin:wght@400;500;600;700&display=swap" rel="stylesheet">
```

## Class Convention

All classes: `db-` prefix. All CSS variables: `--db-` prefix.

## Themes

Set: `<html data-theme="dark">`
JS: `DAUB.setTheme('dark')` / `DAUB.cycleTheme()` / `DAUB.getTheme()`
Options: `light`, `dark`, `grunge-light`, `grunge-dark`, `parchment`, `ink`, `ember`, `bone`

## Components Quick Reference

### Foundations
- **Surface**: `db-surface--raised` / `--inset` / `--pressed`
- **Typography**: `db-h1`–`db-h4`, `db-body`, `db-label`, `db-caption`
- **Prose**: `db-prose` / `--sm` / `--lg` / `--xl` / `--2xl`
- **Elevation**: `db-elevation-1` / `-2` / `-3`
- **Separator**: `db-separator` / `--vertical` / `--dashed` / `__label`
- **Layout**: `db-container`, `db-flex`, `db-grid--2`, `db-gap-3`, `db-mt-4`
- **Utilities**: `db-sr-only`, `db-text-muted`, `db-rounded-*`

### Controls
- **Button**: `db-btn db-btn--primary` / `--secondary` / `--ghost` / `--sm` / `--lg` / `--icon` / `--loading`
- **Icon Button Colors**: `db-btn--icon-danger` / `--icon-success` / `--icon-accent`
- **Button Group**: `db-btn-group` — groups buttons with connected borders
- **Field**: `db-field` > `db-field__label` + `db-field__input` + `db-field__helper`
- **Input**: `db-input` / `--sm` / `--lg` / `--error` (standalone)
- **Input Group**: `db-input-group` > `__addon` + `db-input` + `db-btn`
- **Input Icon**: `db-input-icon` > `db-input-icon__icon` + `db-input` / `--right`
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
- **Menubar**: `db-menubar` > `db-menubar__item` + `db-menubar__dropdown`
- **Sidebar**: `db-sidebar` > `db-sidebar__section` > `db-sidebar__item` / `--active` / `--collapsed` / `__toggle`
- **Bottom Nav**: `db-bottom-nav` > `db-bottom-nav__item` / `--active` / `__badge` / `--always`

### Data Display
- **Card**: `db-card` > `db-card__header` + `db-card__title` + `db-card__footer`
- **Table**: `db-table` (sortable with `data-db-sort` on th)
- **Data Table**: `db-data-table` — sortable, selectable rows
- **List**: `db-list` > `db-list__item` > `db-list__title` + `db-list__secondary`
- **Badge**: `db-badge` / `--new` / `--updated` / `--warning` / `--error`
- **Chip**: `db-chip` / `--red` / `--green` / `--blue` / `--purple` / `--amber` / `--pink` / `__close`
- **Avatar**: `db-avatar db-avatar--md` (sm=32px, md=40px, lg=56px)
- **Calendar**: `db-calendar` — day selection, today highlight
- **Chart**: `db-chart` — CSS-only bar chart
- **Carousel**: `db-carousel` > `__track` + `__slide` + `__dots`
- **Aspect Ratio**: `db-aspect` / `--16-9` / `--4-3` / `--1-1` / `--21-9`
- **Scroll Area**: `db-scroll-area` / `--horizontal` / `--vertical`

### Feedback
- **Toast**: `DAUB.toast({ type: 'success', title: 'Done', message: '...' })`
- **Alert**: `db-alert db-alert--warning` > `db-alert__icon` + `db-alert__content`
- **Progress**: `db-progress` > `db-progress__bar` style="--db-progress: 65%"
- **Skeleton**: `db-skeleton--text` / `--heading` / `--avatar` / `--btn`
- **Empty State**: `db-empty` > `db-empty__icon` + `db-empty__title` + `db-empty__message`
- **Tooltip**: `db-tooltip` / `--top` / `--bottom` / `--left` / `--right`

### Overlays
- **Modal**: `DAUB.openModal('id')` / `DAUB.closeModal(el)` / `data-db-modal-trigger="id"`
- **Alert Dialog**: `DAUB.openAlertDialog('id')` / `DAUB.closeAlertDialog(el)`
- **Sheet**: `db-sheet` / `--right` / `--left` / `--top` / `--bottom`
- **Drawer**: `db-drawer` — mobile-friendly bottom panel
- **Popover**: `db-popover` / `--top` / `--bottom` / `--left` / `--right`
- **Hover Card**: `db-hover-card` — CSS hover trigger
- **Dropdown Menu**: `db-dropdown` > `__item` + `__separator` + `__label`
- **Context Menu**: `db-context-menu` — right-click, `data-context-menu`
- **Command Palette**: `DAUB.openCommand('id')` — Ctrl+K shortcut

### Layout & Utility
- **Accordion**: `db-accordion` — single/multi mode via `data-multi`
- **Collapsible**: `db-collapsible` — progressive disclosure
- **Resizable**: `db-resizable` > `__handle--right` / `--bottom` / `--corner`
- **Date Picker**: `db-date-picker` — wraps Calendar in popover
- **Theme Switcher**: `db-theme-switcher` — 4x2 grid for 8 themes

## Full Docs

For complete HTML examples: `https://daub.dev/llms.txt`
