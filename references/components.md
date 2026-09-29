# DAUB components

Two catalogs describe the same library:

- **Spec types** are the element `type` values a json-render spec or OpenUI Lang can use. `daub-render.js`, the playground and the hosted MCP renderer turn them into DAUB markup. Props below come from `COMP_PROPS` in playground.html, the text the playground prompt shows a model.
- **HTML classes** are the 84 CSS components in `components.json`. Use them when you write markup by hand. Full HTML for each one: `https://daub.dev/llms.txt`.

Legend for spec types: _core_ means the Jev picker always keeps it, and _children first_ means the OpenUI signature starts with `children`.

Props that trip models up:

- `Text` reads `content` and `tag`. A `text` prop renders nothing.
- List-like props (`items`, `sections`, `tabs`, `options`, `steps`, `bars`, `columns`, `rows`, `avatars`, `slides`, `groups`) take arrays of plain objects, not element ids.
- `footer` on Card, Modal and AlertDialog is an array of child element ids. Leave it off to get the default buttons: Cancel and Confirm on a Modal, Cancel and Continue on an AlertDialog.
- `Tabs` renders one panel per child, in the order of `tabs`.
- `Grid` also accepts `columns: "sidebar-main"`, and a child with `props.span` spans that many columns.
- `Stack` wraps horizontal rows unless `wrap: false`. A horizontal Stack holding a Sidebar keeps the content beside it on desktop; see the layout traps below for phones.
- `Badge` variants: the signature lists `new`, `updated`, `warning` and `error`; renderers also accept `success`, `danger`, `info`, `gray` and the colors `red`, `green`, `blue`, `amber` and `purple`.
- `Field` and `Input` pass `type` straight to the `<input>`, so `date`, `time`, `tel` and `url` work as well as the listed types.

## Layout traps

Each of these renders without an error and still looks broken. They were measured in Chromium at 1280 and 390 px with the current `daub-render.js`, and the linter in `references/verify.md` warns about most of them.

- **No page gutters.** A root Stack or Grid without `container` runs edge to edge: text touches the screen edge on phones. Set `container: "wide"` (dashboards, landing pages) or `"narrow"` (forms, settings) on the root. It centers the page and adds 24 px side padding. Leave some top space in the host page too (`#app { padding-block: 24px }`); MCP `render_spec` pages add 16 px on their own.
- **Sidebar on phones.** Below 641 px the Sidebar turns into a 64 px icon rail with the labels hidden, and the content wraps below it, so the rail stands alone above the page. `Grid columns: "sidebar-main"` behaves the same way. That is fine for a desktop dashboard. For a phone-first screen use `BottomNav` instead.
- **Navbar actions.** Every Navbar child goes into its nav slot beside the brand, so action buttons sit next to the links, not on the right. Below 641 px the slot folds behind a menu button. For a site header with its actions on the right, use a horizontal Stack: `Stack([Text("Margin", "h3"), NavMenu([...]), Stack([Button("Sign in", "ghost"), Button("Start free", "primary")], "horizontal", 2)], "horizontal", 3, "between", "center")`. It spreads out on desktop and wraps on phones.
- **Wide tables.** `Table` and `DataTable` scroll sideways inside their own box, so a 6-column table does not widen the page. On a phone only 3 or 4 columns show at once; put the columns that matter first. Do not wrap a table in `ScrollArea`: it caps its height at 300 px, and the rows below scroll out of sight. `Card clip: true` cuts off anything wider than the card.
- **ChartCard in a mixed row.** In a Grid row next to a taller card, a ChartCard stretches to the row height while its chart stays 184 px tall, leaving an empty block inside the border. Wrap it, `Stack([chartCard], "vertical", span: 2)`, so it keeps its own height, or balance the row.
- **ToggleGroup labels.** Options share the width equally and a label with a space wraps onto two lines ("30 days", "Yearly (save 20%)"). Use one word per option ("Week", "Month", "Yearly") and put the saving in the text next to it. A ToggleGroup shows the selected option; it does not switch any content (see json-render.md for state).
- **Prefilled forms.** A `placeholder` is a hint in muted text, so an edit form written with placeholders looks empty. Put the current text in `value`: `Field([], "First name", value: "Maya")`, `Input("Search", value: "quarterly report")`, `Textarea("Tell teammates about you", 3, value: "Designer in Lisbon")`. A Field's `value` fills the input the Field draws itself; a child control takes its own: `Field([Textarea("", 3, value: "Designer in Lisbon")], "Bio")`, `Field([Select("", options, "lisbon")], "Time zone")`. Checkbox and Switch take `checked`.
- **Rows that never wrap.** In a horizontal Stack with `wrap: false`, a Button shrinks before the text beside it and its icon collapses to a few pixels ("Request export" lost its download icon at 1280 px). Drop the icon on buttons in such rows, or leave `wrap` on so the button drops below the text when space runs out.
- **Destructive buttons.** Use variant `icon-danger` for a destructive text button such as "Delete account": it keeps its label and icon, draws them in the error color and has no fill. `danger` and `destructive` map to it.
- **Dialog buttons.** Every button in a Modal `footer` or an AlertDialog's actions closes its dialog, the defaults (Cancel and Confirm, Cancel and Continue) and a custom "Delete account" included; the renderers mark them `data-db-dismiss` and daub.js closes the dialog after the click. A footer Button with `trigger` opens its overlay and leaves the dialog open under it. A footer Button with an `on` state action (a wizard's Back and Next) runs it and leaves the dialog open too. Any other button that must keep the dialog open belongs in the body. Escape closes the Modal, AlertDialog, Sheet or Drawer on top; the backdrop closes any of them.

## Spec types

<!-- BEGIN GENERATED:spec-types (tools/build-skill.mjs) -->
### Layout & Structure

- **Stack** _(core, children first)_: a flexbox row or column that lays out its children (the usual page root). Props: `direction: "vertical"|"horizontal", gap: 0-6 (default 2=8px), justify: "center"|"end"|"between"|"evenly" (main-axis), align: "center"|"end"|"start"|"stretch" (cross-axis), wrap: bool (default true for horizontal), container: "wide"|"narrow"|true`
- **Grid** _(core, children first)_: an equal-width CSS grid of 2-6 columns. Props: `columns: 2-6, gap: 0-6 (default 2=8px), align: "center"|"end", container: "wide"|"narrow"|true`
- **Surface** _(children first)_: a raised or inset background panel that groups content. Props: `variant: "raised"|"inset"|"pressed"`
- **Text** _(core)_: a heading, paragraph or inline text. Props: `tag: "h1"|"h2"|"h3"|"h4"|"p"|"span", content: string, class: string ("db-text-muted" for secondary text)`
- **Prose**: long-form rich text such as an article body. Props: `content: string (HTML), size: "sm"|"lg"|"xl"|"2xl"`
- **Separator** _(core)_: a horizontal or vertical divider line. Props: `vertical: bool, dashed: bool, label: string`
- **Icon** _(core)_: a standalone Lucide icon. Props: `name: string (Lucide icon name), size: "xs"|"sm"|"md"|"lg"|"xl", variant: "branded"|"success"`
- **Link**: an inline text hyperlink. Props: `label: string, class: string`

### Controls

- **Button** _(core)_: a clickable action; trigger opens an overlay by id. Props: `label: string, variant: "primary"|"secondary"|"ghost"|"icon-danger"|"icon-success"|"icon-accent", size: "sm"|"lg"|"icon", loading: bool, icon: string, trigger: "overlayId" (opens Modal/AlertDialog/Sheet/Drawer by id)`
- **ButtonGroup** _(children first)_: a row of joined buttons. Props: `(children are Buttons)`
- **Field** _(children first)_: a labeled form input with helper or error text. Props: `label: string, placeholder: string, type: "text"|"email"|"password"|"number", error: bool, helper: string, value: string (prefilled text; placeholder is only a hint)`
- **Input**: a single-line text input. Props: `placeholder: string, size: "sm"|"lg", error: bool, type: "text"|"email"|"password"|"number"|"tel"|"url"|"search"|"date"|"time", value: string (prefilled text)`
- **InputGroup** _(children first)_: an input with a prefix or suffix addon such as $ or .com. Props: `addonBefore: string, addonAfter: string (child is Input)`
- **InputIcon** _(children first)_: an input with an icon inside it. Props: `icon: string, right: bool (child is Input)`
- **Search**: a search box. Props: `placeholder: string`
- **Textarea**: a multi-line text input for comments, bios or messages. Props: `placeholder: string, rows: number, error: bool, value: string (prefilled text)`
- **Checkbox**: a checkbox for opting in, agreeing to terms or selecting items. Props: `label: string (shown beside the box; leave it out when a Text in the same row names the item: Checkbox(checked: true)), checked: bool`
- **RadioGroup**: a set of radio buttons to pick exactly one visible option. Props: `options: [{label, value}], selected: string`
- **Switch**: an on/off switch for a setting. Props: `label: string (leave it out when a Text in the same row names the setting: Switch(checked: true)), checked: bool (on/off setting: notifications, preferences, feature flags)`
- **Slider**: a draggable range control for volume, price or another number. Props: `min: number, max: number, value: number, step: number, label: string`
- **Toggle**: a single pressable on/off button. Props: `label: string, pressed: bool, size: "sm" (pressable toolbar button: bold/italic, view filter — NOT for settings)`
- **ToggleGroup**: a segmented control to pick one option, such as Monthly/Yearly or Grid/List. Props: `options: [{label, value}], selected: string`
- **Select**: a dropdown to choose one option from a list. Props: `label: string, options: [{label, value}], selected: string`
- **CustomSelect**: a searchable dropdown for long option lists. Props: `placeholder: string, options: [{label, value, selected: bool, disabled: bool}], searchable: bool, selected: string`
- **Kbd**: a keyboard shortcut hint such as Cmd+K. Props: `keys: [string]`
- **Label**: a standalone form label. Props: `text: string, required: bool, optional: bool`
- **Spinner**: a loading spinner. Props: `size: "sm"|"lg"|"xl"`
- **InputOTP**: one-time passcode boxes for entering a verification code. Props: `length: number, separator: bool`

### Navigation

- **Tabs** _(children first)_: tabs that switch between panels of content. Props: `tabs: [{label, id}], active: string, children: [childIds] (one child per tab — each child becomes a tab panel; order matches tabs array)`
- **Breadcrumbs**: a breadcrumb trail showing the page hierarchy. Props: `items: [{label, href}]`
- **Pagination**: page number controls for long lists or tables. Props: `current: number, total: number, perPage: number`
- **Stepper**: a multi-step progress indicator for wizards or checkout. Props: `steps: [{label, status: "completed"|"active"|"pending"}], vertical: bool`
- **NavMenu**: a horizontal row of navigation links. Props: `items: [{label, href, active: bool}]`
- **Navbar** _(children first)_: a top header bar with brand and navigation. Props: `brand: string, brandHref: string`
- **Menubar**: a desktop-app menu bar with File/Edit/View dropdowns. Props: `items: [{label, dropdown: [{label, href}]}]`
- **Sidebar**: a vertical side navigation with sections. Props: `sections: [{title, items: [{label, icon, active, href}]}], collapsed: bool`
- **BottomNav**: a mobile bottom tab bar. Props: `items: [{label, icon, active, badge}]`

### Data Display

- **Card** _(core, children first)_: a titled container for related content. Props: `title: string, description: string, media: string, footer: [childIds], interactive: bool, clip: bool`
- **Table**: a data table with columns and rows. Props: `columns: [{key, label, numeric}], rows: [{}] (a cell can list Button ids for row actions: {actions: [editBtn, deleteBtn]}), sortable: bool`
- **DataTable**: an interactive data table with selectable rows. Props: `columns: [{key, label}], rows: [{}] (a cell can list Button ids for row actions: {actions: [editBtn, deleteBtn]}), selectable: bool`
- **List**: a vertical list of items with title, secondary text and icon. Props: `items: [{title, secondary, icon}]`
- **Badge**: a small status label or count. Props: `text: string, variant: "new"|"updated"|"warning"|"error"`
- **Avatar**: a user profile picture or initials. Props: `initials: string, src: string (image URL only; skip it with size: "sm"), size: "sm"|"md"|"lg"`
- **AvatarGroup**: a stacked row of several user avatars. Props: `avatars: [{initials, src}], max: number`
- **Calendar**: a month calendar grid for picking or showing dates. Props: `selected: "YYYY-MM-DD" (date to highlight), today: "YYYY-MM-DD" (today override)`
- **Chart**: a bar chart. Props: `bars: [{label, value, max}]`
- **Carousel**: a sliding slideshow of images or cards. Props: `slides: [{content}]`
- **AspectRatio** _(children first)_: a fixed aspect-ratio frame for images or video. Props: `ratio: "16-9"|"4-3"|"1-1"|"21-9"`
- **Chip**: a tag or filter pill. Props: `label: string, color: "red"|"green"|"blue"|"purple"|"amber"|"pink", active: bool, closable: bool`
- **ScrollArea** _(children first)_: a scrollable region. Props: `direction: "horizontal"|"vertical"`
- **Image**: an image or photo. Props: `src: string (URL), alt: string, width: number, height: number`

### Feedback

- **Alert**: an inline callout banner for info, warning, error or success messages. Props: `type: "info"|"warning"|"error"|"success", title: string, message: string`
- **Progress**: a progress bar. Props: `value: number, indeterminate: bool`
- **Skeleton**: loading placeholder shapes. Props: `variant: "text"|"heading"|"avatar"|"btn", lines: number`
- **EmptyState**: a placeholder message shown when there is no content or nothing was found. Props: `icon: string, title: string, message: string, children: [childIds] (action Buttons shown under the message)`
- **Tooltip** _(children first)_: a hint shown on hover. Props: `text: string, position: "top"|"bottom"|"left"|"right"`

### Overlays

- **Modal** _(children first)_: a dialog window over the page for forms or content. Props: `id: string, title: string, footer: [childIds] (buttons for modal footer; omit for default Cancel/Confirm)`
- **AlertDialog**: a confirmation dialog for destructive actions. Props: `id: string, title: string, description: string, footer: [childIds] (action buttons; omit for default Cancel/Continue)`
- **Sheet** _(children first)_: a side panel that slides over the page. Props: `id: string, position: "right"|"left"|"top"|"bottom"`
- **Drawer** _(children first)_: a bottom drawer that slides up. Props: `id: string`
- **Popover** _(children first)_: a small floating panel anchored to a button. Props: `position: "top"|"bottom"|"left"|"right", children: [childIds] (first child becomes the trigger when it is a Button or Link and there are 2+ children; other children are the content)`
- **HoverCard** _(children first)_: a preview card shown when hovering a link or user. Props: (no props)
- **DropdownMenu**: a menu of actions opened from a button. Props: `items: [{label, icon, separator, groupLabel, active: bool}]`
- **ContextMenu**: a right-click menu of actions. Props: `items: [{label, icon, separator}]`
- **CommandPalette**: a Cmd+K searchable command launcher. Props: `id: string, placeholder: string, groups: [{label, items: [{label, icon, shortcut}]}]`

### Layout Utilities

- **Accordion**: stacked expandable sections such as an FAQ. Props: `items: [{title, content, children: [childIds]}], multi: bool`
- **Collapsible** _(children first)_: a single show/hide section. Props: `label: string`
- **Resizable** _(children first)_: split panes with a draggable divider. Props: `direction: "horizontal"|"vertical"`
- **DatePicker**: a date input with a calendar popup. Props: `label: string, placeholder: string, selected: string`

### Dashboard

- **StatCard**: a KPI metric card with a value and trend. Props: `label: string, value: string, trend: "up"|"down" (direction only, never an icon), trendValue: string, icon: string (Lucide name, pass named: icon: "users"), horizontal: bool`
- **ChartCard** _(children first)_: a titled card that holds a chart. Props: `title: string, children: [Chart element] (empty ChartCard renders "No data"), bars: [{label, value, max}] (shortcut: renders a Chart when no children)`

### Custom

- **CustomHTML**: custom HTML and JS for anything no built-in component covers. Props: `html: string (raw HTML using DAUB classless CSS), css: string (CSS rules injected as a <style> tag), js: string (vanilla JS, receives "container" arg for this element and "preview" arg for the entire preview pane — use preview.querySelector('[data-spec-id="someId"]') to target other elements), children: [childIds] (standard DAUB component IDs rendered inside the container — html renders first, then children append after)`
<!-- END GENERATED:spec-types -->

## HTML classes

Class names follow BEM: a block (`db-card`), parts (`db-card__title`) and modifiers (`db-card--media`). Modifiers below appear as suffixes, so `--primary` on `db-btn` means `db-btn--primary`.

<!-- BEGIN GENERATED:html-classes (tools/build-skill.mjs) -->
### controls (23)

- **Button**: `.db-btn` on `<button>`; modifiers `--primary` `--secondary` `--ghost` `--sm` `--lg` `--icon` `--loading` `--disabled` `--pressed` `--icon-danger` `--icon-success` `--icon-accent`. Icon-only: add --icon. Loading: add --loading (disables pointer events). Ghost: transparent bg with hover fill.
- **Button Group**: `.db-btn-group` on `<div>`. Groups buttons with connected borders. Children should be db-btn elements.
- **Text Field**: `.db-field` on `<div>`; modifiers `--error`; parts `db-field__label` `db-field__input`* `db-field__helper`. Error state: add db-field--error to wrapper.
- **Input**: `.db-input` on `<input>`; modifiers `--sm` `--lg` `--error`. Standalone text input. Use db-field for label+helper combos.
- **Input Group**: `.db-input-group` on `<div>`; parts `db-input-group__addon`. Combine addon spans and db-input/db-btn children.
- **Input with Icon**: `.db-input-icon` on `<div>`; modifiers `--right`; parts `db-input-icon__icon`*. Icon highlights on :focus-within. Use --right for trailing icon.
- **Search Input**: `.db-search` on `<div>`; parts `db-search__icon` `db-search__clear`. Clear button auto-shows when input has text.
- **Textarea**: `.db-textarea` on `<textarea>`; modifiers `--error`. Error state: add db-textarea--error.
- **Checkbox**: `.db-checkbox` on `<label>`; parts `db-checkbox__input`* `db-checkbox__box`*; needs daub.js. JS handles visual state sync. Indeterminate: set input.indeterminate = true — the box shows a dash (used by data-table select-all).
- **Radio**: `.db-radio` on `<label>`; parts `db-radio__input`* `db-radio__circle`*; needs daub.js. Wrap in db-radio-group for grouped radios.
- **Radio Group**: `.db-radio-group` on `<div>`. Groups db-radio children with consistent spacing.
- **Switch**: `.db-switch` on `<div>`; parts `db-switch__track`* `db-switch__thumb`*; needs daub.js. JS toggles aria-checked on click/keypress.
- **Slider**: `.db-slider` on `<div>`; parts `db-slider__label` `db-slider__value` `db-slider__input`*; needs daub.js. JS syncs __value text with range input. Single-thumb only — for a dual-thumb range (e.g. price filter), compose two sliders for min/max.
- **Toggle**: `.db-toggle` on `<button>`; modifiers `--active` `--sm`; needs daub.js. Active state via aria-pressed="true" or db-toggle--active.
- **Toggle Group**: `.db-toggle-group` on `<div>`; needs daub.js. Segmented control: inset track with raised active segment. Single select by default. Add data-multi for multi-select.
- **Native Select**: `.db-select` on `<div>`; parts `db-select__input`*. Styled native select element.
- **Custom Select**: `.db-custom-select` on `<div>`; modifiers `--open`; parts `db-custom-select__trigger`* `db-custom-select__dropdown`* `db-custom-select__option`* `db-custom-select__search`; needs daub.js; aliases `combobox` `autocomplete`. JS auto-initializes. Optional search filter via __search child turns it into a combobox / autocomplete.
- **Input OTP**: `.db-otp` on `<div>`; parts `db-otp__input`* `db-otp__separator`; needs daub.js. JS auto-focuses next input and handles paste.
- **Date Picker**: `.db-date-picker` on `<div>`; parts `db-date-picker__trigger`* `db-date-picker__dropdown`*; needs daub.js. Wraps Calendar in a trigger/dropdown. Click trigger to open calendar.
- **Checkbox Group**: `.db-checkbox-group` on `<div>`; modifiers `--inline`; parts `db-checkbox-group__label` `db-checkbox-group__helper`. Use --inline for horizontal checkbox sets.
- **Fieldset**: `.db-fieldset` on `<fieldset>`; parts `db-fieldset__legend` `db-fieldset__content` `db-fieldset__helper`. Groups related form fields with a legend and helper text.
- **Number Field**: `.db-number-field` on `<div>`; parts `db-number-field__btn` `db-input`*. Combines a numeric input with increment and decrement controls.
- **Accent Picker**: `.db-accent-picker` on `<div>`; parts `db-accent-picker__dot`*; needs daub.js. Color dots for accent override. data-accent="reset" restores theme default.

### foundations (5)

- **Label**: `.db-label` on `<label>`; modifiers `--required` `--optional`. --required appends *, --optional appends (optional).
- **Kbd**: `.db-kbd` on `<kbd>`; modifiers `--sm`. Keyboard key display. Use --sm for smaller inline size.
- **Surface**: `.db-surface` on `<div>`; modifiers `--raised` `--inset` `--pressed`. Base surface with variants for depth/shadow effects.
- **Elevation**: `.db-elevation` on `<div>`; modifiers `-1` `-2` `-3`. Shadow utility classes. Three levels of elevation.
- **Prose**: `.db-prose` on `<article>`; modifiers `--sm` `--lg` `--xl` `--2xl`. Typographic defaults for long-form content. Scale: --sm, --lg, --xl, --2xl.

### feedback (8)

- **Spinner**: `.db-spinner` on `<span>`; modifiers `--sm` `--lg` `--xl`. Animated loading spinner. Inherits current text color.
- **Toast**: `.db-toast` on `<div>`; modifiers `--success` `--error` `--warning` `--removing`; parts `db-toast__icon` `db-toast__content` `db-toast__title` `db-toast__message` `db-toast__close`; needs daub.js. Created via JS API only. String shorthand: DAUB.toast('msg'). Types: info, success, warning, error.
- **Toast Stack**: `.db-toast-stack` on `<div>`; needs daub.js; created at runtime. Container auto-created by JS when first toast fires. Fixed bottom-right.
- **Alert**: `.db-alert` on `<div>`; modifiers `--info` `--warning` `--error` `--success`; parts `db-alert__icon` `db-alert__content` `db-alert__title`. Static inline alert. Variants: --info, --warning, --error, --success.
- **Progress**: `.db-progress` on `<div>`; modifiers `--indeterminate`; parts `db-progress__bar`*. Set progress via --db-progress custom property. Add --indeterminate for animated state.
- **Skeleton**: `.db-skeleton` on `<div>`; modifiers `--text` `--heading` `--avatar` `--btn`. Placeholder loading shapes. Animated shimmer effect.
- **Empty State**: `.db-empty` on `<div>`; parts `db-empty__icon` `db-empty__title` `db-empty__message`. Centered empty state with icon, title, description, and optional CTA.
- **Meter**: `.db-meter` on `<div>`; modifiers `--warning` `--error`; parts `db-meter__bar`*. Use for bounded measurements such as quota, health, or strength.

### navigation (11)

- **Tabs**: `.db-tabs` on `<div>`; parts `db-tabs__list`* `db-tabs__tab`* `db-tabs__panel`*; needs daub.js. JS handles tab switching and panel visibility.
- **Breadcrumbs**: `.db-breadcrumbs` on `<nav>`. Use ol/li children. Mark current page with aria-current="page".
- **Pagination**: `.db-pagination` on `<nav>`; parts `db-pagination__btn`* `db-pagination__ellipsis`. Mark current page with aria-current="page".
- **Stepper**: `.db-stepper` on `<div>`; modifiers `--vertical`; parts `db-stepper__step`* `db-stepper__indicator`* `db-stepper__label`; needs daub.js. Step states: --completed, --active. Use --vertical for vertical layout.
- **Nav Menu**: `.db-nav-menu` on `<nav>`; parts `db-nav-menu__item`*. Horizontal navigation links. Use --active for current item.
- **Navbar**: `.db-navbar` on `<nav>`; modifiers `--open`; parts `db-navbar__brand` `db-navbar__nav` `db-navbar__spacer` `db-navbar__actions` `db-navbar__toggle`; needs daub.js. Sticky top bar. At 640px and below db-navbar__nav collapses and db-navbar__toggle opens it; daub.js keeps the toggle's aria-expanded in step. JS: DAUB.toggleNavbar(el) or DAUB.toggleNavbar(el, open). The menu closes on outside click and Escape.
- **Menubar**: `.db-menubar` on `<div>`; parts `db-menubar__item`* `db-menubar__dropdown`; needs daub.js. Desktop menu bar. Dropdown items use db-dropdown__item class.
- **Sidebar**: `.db-sidebar` on `<aside>`; modifiers `--collapsed`; parts `db-sidebar__header` `db-sidebar__section` `db-sidebar__label` `db-sidebar__item`* `db-sidebar__footer` `db-sidebar__toggle`; needs daub.js. Collapsible via --collapsed. Items need data-tooltip for collapsed hover labels. JS: DAUB.toggleSidebar(el).
- **Bottom Navigation**: `.db-bottom-nav` on `<nav>`; modifiers `--always`; parts `db-bottom-nav__item`* `db-bottom-nav__badge`. Fixed mobile bottom bar. Hidden on desktop unless --always. Safe-area aware.
- **Toolbar**: `.db-toolbar` on `<div>`; modifiers `--vertical`; parts `db-toolbar__group` `db-toolbar__separator`. Groups action buttons and segmented controls in editor or dashboard surfaces.
- **Theme Switcher**: `.db-theme-switcher` on `<div>`; parts `db-theme-switcher__toggle` `db-theme-switcher__popover`; needs daub.js. Auto-populates toggle + popover if empty. Popover shows 21 families in 4 categories + scheme buttons.

### data-display (15)

- **Card**: `.db-card` on `<div>`; modifiers `--clip` `--media`; parts `db-card__header` `db-card__title` `db-card__desc` `db-card__body` `db-card__media` `db-card__footer`. Default allows overflow (tooltips/dropdowns). Add --clip for overflow:hidden. --media for edge-to-edge images.
- **Badge**: `.db-badge` on `<span>`; modifiers `--new` `--updated` `--success` `--warning` `--error` `--danger` `--info`. Small status indicator. Color variants for different states.
- **Avatar**: `.db-avatar` on `<div>`; modifiers `--sm` `--md` `--lg`. Sizes: --sm (32px), --md (40px), --lg (56px). Supports img or text initials.
- **Avatar Group**: `.db-avatar-group` on `<div>`; parts `db-avatar-group__overflow`. Overlapping avatar stack with optional overflow counter.
- **Table**: `.db-table` on `<table>`. Sortable columns: add data-db-sort to th.
- **Data Table**: `.db-data-table` on `<table>`; parts `db-data-table__check`; needs daub.js. JS wires the thead checkbox to row checkboxes (select-all with indeterminate state) and click-to-sort on th[data-sortable] / th[data-db-sort] (toggles aria-sort, reorders tbody rows).
- **List**: `.db-list` on `<div>`; parts `db-list__item`* `db-list__content` `db-list__title` `db-list__secondary`. Vertical list of items with optional title and secondary text.
- **Chip**: `.db-chip` on `<span>`; modifiers `--red` `--green` `--blue` `--purple` `--amber` `--pink` `--active`; parts `db-chip__close`; needs daub.js. Color presets or custom via --db-chip-h/s/l. --active for selected state. Removable via __close button. Toggle group: wrap in container with data-db-chip-toggle.
- **Accordion**: `.db-accordion` on `<div>`; parts `db-accordion__item`* `db-accordion__trigger`* `db-accordion__icon` `db-accordion__content`*; needs daub.js. Single-open by default. Add data-multi for multi-open.
- **Collapsible**: `.db-collapsible` on `<div>`; modifiers `--open`; parts `db-collapsible__trigger`* `db-collapsible__icon` `db-collapsible__content`*; needs daub.js. JS toggles open state and aria-expanded.
- **Calendar**: `.db-calendar` on `<div>`; parts `db-calendar__header`* `db-calendar__title`* `db-calendar__nav`* `db-calendar__grid`* `db-calendar__day-label`* `db-calendar__day`*; needs daub.js. Day states: --today, --selected, --outside. JS handles month navigation.
- **Carousel**: `.db-carousel` on `<div>`; parts `db-carousel__track`* `db-carousel__slide`* `db-carousel__btn` `db-carousel__dots` `db-carousel__dot`; needs daub.js. JS handles slide navigation, dot sync, and swipe.
- **CSS Bar Chart**: `.db-chart` on `<div>`; parts `db-chart__bar`* `db-chart__labels`. Pure CSS bar chart. Set bar height via inline style. --secondary modifier for alt color.
- **Stat Card**: `.db-stat` on `<div>`; modifiers `--horizontal`; parts `db-stat__label`* `db-stat__value`* `db-stat__change` `db-stat__icon`. KPI/metric card. --horizontal for row layout. __change--up (green) / --down (red). Optional __icon slot.
- **Chart Card**: `.db-chart-card` on `<div>`; parts `db-chart-card__header` `db-chart-card__title` `db-chart-card__actions` `db-chart-card__body`*. Card wrapper for any chart. Header with title/actions. Body auto-sizes canvas to 100% width.

### overlays (12)

- **Modal**: `.db-modal` on `<div>`; parts `db-modal__header` `db-modal__title` `db-modal__close` `db-modal__body` `db-modal__footer`; needs daub.js. Wrap in db-modal-overlay with id. Open: DAUB.openModal('id'). Close: DAUB.closeModal('id'). The close button, the backdrop, Escape and any button with data-db-dismiss close it too.
- **Modal Overlay**: `.db-modal-overlay` on `<div>`; needs daub.js. Container for db-modal. Must have an id attribute for JS API.
- **Alert Dialog**: `.db-alert-dialog` on `<div>`; modifiers `--open`; parts `db-alert-dialog__overlay`* `db-alert-dialog__panel`* `db-alert-dialog__title` `db-alert-dialog__desc` `db-alert-dialog__actions`; needs daub.js. Open: DAUB.openAlertDialog('id'). data-action="cancel" auto-closes and takes focus on open. data-db-dismiss closes it from any button, a confirm action included; so do the backdrop and Escape.
- **Sheet**: `.db-sheet` on `<div>`; modifiers `--open` `--right` `--left` `--top` `--bottom`; parts `db-sheet__overlay`* `db-sheet__panel`* `db-sheet__header` `db-sheet__title` `db-sheet__close` `db-sheet__body`; needs daub.js. Sides: --right (default), --left, --top, --bottom. Open: DAUB.openSheet('id'). The close button, the backdrop, Escape and any button with data-db-dismiss close it.
- **Drawer**: `.db-drawer` on `<div>`; modifiers `--open`; parts `db-drawer__overlay`* `db-drawer__panel`* `db-drawer__handle` `db-drawer__body`; needs daub.js. Mobile-friendly bottom panel. Open: DAUB.openDrawer('id'). The backdrop, Escape and any button with data-db-dismiss close it.
- **Tooltip**: `.db-tooltip` on `<div>`; modifiers `--open`; parts `db-tooltip__content`*; needs daub.js. Positions: __content--top, --bottom, --left, --right.
- **Popover**: `.db-popover` on `<div>`; modifiers `--open`; parts `db-popover__trigger`* `db-popover__content`*; needs daub.js. Positions: __content--top, --bottom, --left, --right.
- **Hover Card**: `.db-hover-card` on `<div>`; parts `db-hover-card__content`*. Content appears on hover or keyboard focus (:focus-within).
- **Dropdown Menu**: `.db-dropdown` on `<div>`; modifiers `--open`; parts `db-dropdown__trigger`* `db-dropdown__content`* `db-dropdown__item`* `db-dropdown__separator` `db-dropdown__label`; needs daub.js. JS auto-initializes toggle. Right-aligned: add db-dropdown__content--right. __menu is an alias for __content.
- **Context Menu**: `.db-context-menu` on `<div>`; modifiers `--open`; parts `db-context-menu__label` `db-context-menu__item`* `db-context-menu__separator`; needs daub.js. Triggered by data-context-menu attribute on right-click target.
- **Command Palette**: `.db-command` on `<div>`; modifiers `--open`; parts `db-command__overlay`* `db-command__panel`* `db-command__input-wrap`* `db-command__input`* `db-command__list`* `db-command__group-label` `db-command__item`* `db-command__shortcut` `db-command__empty`; needs daub.js. Opens with Ctrl+K / Cmd+K. JS: DAUB.openCommand('id'), DAUB.closeCommand('id').
- **Preview Card**: `.db-preview-card` on `<div>`; parts `db-preview-card__trigger`* `db-preview-card__content`* `db-preview-card__media` `db-preview-card__title` `db-preview-card__desc`. Hover and focus preview surface for rich inline references.

### layout-utility (10)

- **Resizable**: `.db-resizable` on `<div>`; parts `db-resizable__handle`*; needs daub.js. Handle positions: --right, --bottom. JS enables drag-to-resize.
- **Separator**: `.db-separator` on `<hr>`; modifiers `--vertical` `--dashed`; parts `db-separator__label`. Horizontal divider. --vertical for flex row separators. --dashed for dashed style.
- **Divider**: `.db-divider` on `<hr>`. Simple horizontal divider line.
- **Scroll Area**: `.db-scroll-area` on `<div>`; modifiers `--horizontal` `--vertical`. Styled scrollbar container. --horizontal for horizontal scroll only.
- **Aspect Ratio**: `.db-aspect` on `<div>`; modifiers `--16-9` `--4-3` `--1-1` `--21-9`. Aspect ratio container. Children fill the box.
- **Container**: `.db-container` on `<div>`; modifiers `--wide` `--narrow`. Centered max-width container. Default 960px, --wide 1200px, --narrow 640px.
- **Flex**: `.db-flex` on `<div>`; modifiers `--col` `--wrap` `--center`. Flexbox layout utility. Combine with db-gap-* for spacing.
- **Grid**: `.db-grid` on `<div>`; modifiers `--2` `--3` `--4` `--5` `--6`. CSS grid utility. 2-6 columns. Auto-responsive: collapses at smaller screens.
- **Frame**: `.db-frame` on `<div>`; modifiers `--flush`; parts `db-frame__header` `db-frame__body`* `db-frame__footer`. Use for embedded previews, canvases, screenshots, and inspector panels.
- **Group**: `.db-group` on `<div>`; modifiers `--attached` `--vertical`. Generic control grouping. Use --attached for connected controls.

`*` marks a required part.
<!-- END GENERATED:html-classes -->
