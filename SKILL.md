---
name: daub-ui
description: |
  Use when building UI with DAUB, the neo-skeuomorphic CSS component library from daub.dev.
  Trigger phrases: "daub", "daub.dev", "neo-skeuomorphic", "db- components", "warm UI kit"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
---

# DAUB UI — Component Library

DAUB is a drop-in CSS + JS library with 28 neo-skeuomorphic components and 4 themes.

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
Options: `light`, `dark`, `grunge-light`, `grunge-dark`

## Components Quick Reference

- **Button**: `db-btn db-btn--primary` / `--secondary` / `--sm` / `--lg` / `--loading`
- **Field**: `db-field` > `db-field__label` + `db-field__input` + `db-field__helper`
- **Checkbox**: `db-checkbox` > `db-checkbox__input` + `db-checkbox__box`
- **Radio**: `db-radio-group` > `db-radio` > `db-radio__input` + `db-radio__circle`
- **Switch**: `db-switch` (role="switch", JS-managed)
- **Slider**: `db-slider` > `db-slider__input` + `db-slider__value`
- **Tabs**: `db-tabs` > `db-tabs__list` > `db-tabs__tab` + `db-tabs__panel`
- **Card**: `db-card` > `db-card__header` + `db-card__title` + `db-card__footer`
- **Modal**: `DAUB.openModal('id')` / `DAUB.closeModal(el)` / `data-db-modal-trigger="id"`
- **Toast**: `DAUB.toast({ type: 'success', title: 'Done', message: '...' })`
- **Alert**: `db-alert db-alert--warning` > `db-alert__icon` + `db-alert__content`
- **Badge**: `db-badge` / `--new` / `--updated` / `--warning` / `--error`
- **Avatar**: `db-avatar db-avatar--md` (sm=32px, md=40px, lg=56px)
- **Table**: `db-table` (sortable with `data-db-sort` on th)
- **List**: `db-list` > `db-list__item` > `db-list__title` + `db-list__secondary`
- **Breadcrumbs**: `db-breadcrumbs` > ol > li > a
- **Pagination**: `db-pagination` > `db-pagination__btn`
- **Stepper**: `db-stepper` > `db-stepper__step--completed/--active/--pending`
- **Tooltip**: `db-tooltip-wrap` > trigger + `db-tooltip`
- **Progress**: `db-progress` > `db-progress__bar` style="--db-progress: 65%"
- **Skeleton**: `db-skeleton--text` / `--heading` / `--avatar` / `--btn`
- **Empty State**: `db-empty` > `db-empty__icon` + `db-empty__title` + `db-empty__message`
- **Surface**: `db-surface--raised` / `--inset` / `--pressed`
- **Layout**: `db-container`, `db-flex`, `db-grid--2`, `db-gap-3`, `db-mt-4`

## Full Docs

For complete HTML examples: `https://daub.dev/llms.txt`
