# COSS Particle Matchups

Source: https://coss.com/ui/particles, checked May 11, 2026. COSS lists 484 particles across 52 component types.

## Coverage Summary

Daub now covers every COSS particle type through an exact component, a named component family, or a documented composition.

| COSS particle type | Daub match | Coverage |
|---|---|---|
| accordion | Accordion | Exact |
| alert | Alert | Exact |
| alert-dialog | Alert Dialog | Exact |
| autocomplete | Search Input, Custom Select | Composition |
| avatar | Avatar | Exact |
| badge | Badge | Exact |
| breadcrumb | Breadcrumbs | Exact |
| button | Button | Exact |
| calendar | Calendar | Exact |
| card | Card | Exact |
| checkbox | Checkbox | Exact |
| checkbox-group | Checkbox Group | New |
| collapsible | Collapsible | Exact |
| combobox | Custom Select, Command Palette | Composition |
| command | Command Palette | Exact |
| date-picker | Date Picker | Exact |
| dialog | Modal | Exact |
| drawer | Drawer | Exact |
| empty | Empty State | Exact |
| field | Text Field, Field | Exact |
| fieldset | Fieldset | New |
| form | Field, Fieldset, Input, Button | Composition |
| frame | Frame | New |
| group | Group, Button Group | New |
| input | Input | Exact |
| input-group | Input Group | Exact |
| kbd | Kbd | Exact |
| menu | Dropdown Menu, Menubar, Context Menu | Component family |
| meter | Meter | New |
| number-field | Number Field | New |
| otp-field | Input OTP | Exact |
| pagination | Pagination | Exact |
| popover | Popover | Exact |
| preview-card | Preview Card | New |
| progress | Progress | Exact |
| radio-group | Radio Group | Exact |
| scroll-area | Scroll Area | Exact |
| select | Native Select, Custom Select | Exact |
| separator | Separator, Divider | Exact |
| sheet | Sheet | Exact |
| skeleton | Skeleton | Exact |
| slider | Slider | Exact |
| spinner | Spinner | Exact |
| switch | Switch | Exact |
| table | Table, Data Table | Exact |
| tabs | Tabs | Exact |
| textarea | Textarea | Exact |
| toast | Toast, Toast Stack | Exact |
| toggle | Toggle | Exact |
| toggle-group | Toggle Group | Exact |
| toolbar | Toolbar | New |
| tooltip | Tooltip | Exact |

## New Components

Daub adds these components to close named COSS particle categories without inventing alternate behavior:

| Component | Class | Notes |
|---|---|---|
| Checkbox Group | `db-checkbox-group` | Vertical or inline checkbox sets with label and helper text. |
| Fieldset | `db-fieldset` | Native field grouping with legend, content, and helper slots. |
| Frame | `db-frame` | Framed preview, canvas, screenshot, or inspector surface. |
| Group | `db-group` | Generic grouped controls, with attached and vertical variants. |
| Meter | `db-meter` | Bounded measurement bar for quota, strength, or health states. |
| Number Field | `db-number-field` | Numeric input with increment and decrement controls. |
| Preview Card | `db-preview-card` | Hover and focus preview for inline references. |
| Toolbar | `db-toolbar` | Editor or dashboard action rail with groups and separators. |

## Composition Notes

Autocomplete and combobox particles map to existing Daub building blocks because Daub already separates search input styling from popup behavior. Use `db-search` for filtered text entry, `db-custom-select` for selectable options, and `db-command` for command style filtering.

Menu particles map to the Daub menu family. Use `db-dropdown` for compact action menus, `db-menubar` for desktop application menus, and `db-context-menu` for right click menus.
