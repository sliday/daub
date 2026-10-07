# OpenUI Lang for DAUB

OpenUI Lang is a compact text form of a DAUB spec. A model writes it with about 67% fewer tokens than the same JSON. `daub-openui-parser.js` (browser global `DaubOpenUI`, or `require()` in Node) turns it into a json-render spec; `references/json-render.md` covers that format.

```js
const { openUItoSpec } = require('./daub-openui-parser.js'); // fetch it from https://daub.dev/daub-openui-parser.js
const spec = openUItoSpec(text); // { theme, root, elements, state? } or null
```

## Syntax

- One statement per line: `name = Expression`. The name becomes the element id.
- `root = ...` marks the root. Without it, the first component statement is the root.
- `__theme = "github"` sets the theme. Without it the parser writes `"bone"`, while a JSON spec without `theme` renders `light`. Set it every time.
- `__state = {tab: "overview", count: 0}` sets the initial state (see json-render.md). OpenUI Lang has no syntax for `on` or `visible`: `on:` and `visible:` arguments land in `props` and do nothing. For a UI that switches content, parse to JSON and add `on` and `visible` to the elements there.
- Expressions: `Component(args)`, `"string"` or `'string'`, numbers, `true`, `false`, `null`, `[arrays]`, `{key: value}` objects (keys bare or quoted).
- `// line comments` are allowed. Code fences around the whole text are stripped.

## Arguments

- **Positional** args map to props in the parser's order for that type (signatures below): `Button("Save", "primary", "sm")`.
- **Named** args work for any prop and win over positional ones: `Button(label: "Save", variant: "primary")`.
- **Mixed**: positional first, named after: `Stack([a, b], "horizontal", container: "wide")`.
- Positional args past the end of a signature are dropped without a warning. When a prop sits far down a signature, name it.

## Children and references

- For container types, `children` is the first argument: `Card([body, actions], "Plan", "Billed yearly")`. `CustomHTML` is the exception: `(html, css, js, children)`.
- A child can be an inline component, `Stack([Text("Hi", "h2"), Button("Go")])`, or a reference to another statement, `Stack([header, content])`.
- A reference to a statement that holds a component becomes a child id. A reference to a statement that holds data (an array, object, string or number) is replaced by that value, wherever the statement sits in the file: `cols = [{key: "name", label: "Name"}]` then `Table(cols, rows)`.
- A bare string in a children list becomes a `Text` element.
- Unknown component names are not an error in the parser: `Divider()` tokenizes as a plain identifier and turns into a dangling child reference. Use only the types listed below.

## Examples

A dashboard with a sidebar, KPIs, charts, a table and a modal:

```openui
__theme = "github"
root = Stack([nav, main], "horizontal", 5, container: "wide")
nav = Sidebar([{title: "Workspace", items: [{label: "Overview", icon: "layout-dashboard", active: true}, {label: "Customers", icon: "users"}, {label: "Invoices", icon: "receipt"}]}, {title: "Settings", items: [{label: "Billing", icon: "credit-card"}, {label: "Team", icon: "user-cog"}]}])
main = Stack([top, kpis, charts, recent, newInvoice], "vertical", 5)
top = Stack([Text("Overview", "h1"), Button("New invoice", "primary", icon: "plus", trigger: "new-invoice")], "horizontal", 3, "between", "center")
kpis = Grid([revenue, customers, overdue, churn], 4, 4)
revenue = StatCard("Revenue", "$84,120", "up", "+8.1%", "dollar-sign")
customers = StatCard("Customers", "1,284", "up", "+36", "users")
overdue = StatCard("Overdue", "$6,430", "down", "-12%", "clock")
churn = StatCard("Churn", "1.9%", "down", "-0.3 pts", "user-minus")
charts = Grid([ChartCard([monthly], "Revenue by month ($k)"), ChartCard([], "Signups by channel", bars: [{label: "Search", value: 420}, {label: "Referral", value: 310}, {label: "Social", value: 190}, {label: "Direct", value: 150}])], 2, 4)
monthly = Chart([{label: "Apr", value: 61}, {label: "May", value: 66}, {label: "Jun", value: 70}, {label: "Jul", value: 74}, {label: "Aug", value: 79}, {label: "Sep", value: 84}])
recent = Card([invoices], "Recent invoices")
invoices = Table(cols, rows, true)
cols = [{key: "customer", label: "Customer"}, {key: "amount", label: "Amount", numeric: true}, {key: "status", label: "Status"}, {key: "due", label: "Due"}]
rows = [{customer: "Northwind Traders", amount: "$4,200", status: "Paid", due: "Sep 12"}, {customer: "Globex", amount: "$1,850", status: "Open", due: "Oct 02"}, {customer: "Initech", amount: "$960", status: "Overdue", due: "Sep 20"}, {customer: "Umbrella Health", amount: "$7,300", status: "Paid", due: "Sep 08"}, {customer: "Stark Supply", amount: "$2,140", status: "Open", due: "Oct 09"}]
newInvoice = Modal([invoiceForm], "new-invoice", "New invoice")
invoiceForm = Stack([Field([], "Customer", "Company name"), Field([], "Amount", "0.00", "number"), Field([], "Due date", type: "date")], "vertical", 3)
```

A pricing section with a billing toggle and three plans. The ToggleGroup shows yearly billing as selected; it does not change the prices, because OpenUI Lang cannot attach state actions:

```openui
__theme = "bone"
root = Stack([intro, period, plans], "vertical", 5, align: "center", container: "wide")
intro = Stack([Text("Plans that grow with your team", "h2"), Text("Start free. Save 20% when you pay yearly.", "p")], "vertical", 2, align: "center")
period = ToggleGroup([{label: "Monthly", value: "month"}, {label: "Yearly", value: "year"}], "year")
plans = Grid([starter, team, scale], 3, 4)
starter = Card([Text("$0", "h2"), List([{title: "3 projects"}, {title: "1 GB storage"}, {title: "Community support"}])], "Starter", "For side projects", footer: [starterCta])
starterCta = Button("Start free", "secondary")
team = Card([Text("$24 / seat", "h2"), List([{title: "Unlimited projects"}, {title: "100 GB storage"}, {title: "Email support in 24 h"}])], "Team", "For growing teams", footer: [teamCta])
teamCta = Button("Start 14-day trial", "primary")
scale = Card([Text("Custom", "h2"), List([{title: "SSO and audit log"}, {title: "Dedicated region"}, {title: "99.95% uptime SLA"}])], "Scale", "For regulated companies", footer: [scaleCta])
scaleCta = Button("Talk to sales", "ghost")
```

## Mistakes that break renders

| Wrong | Right | Why |
|---|---|---|
| `Text("h2", "Revenue")` | `Text("Revenue", "h2")` | Text is `(content, tag)` |
| `Card("Plan", [body])` | `Card([body], "Plan")` | Card takes children first |
| `ChartCard("Revenue")` | `ChartCard([chart], "Revenue")` | An empty ChartCard renders "No data" |
| `Sidebar([navMenu])` | `Sidebar([{title: "Main", items: [{label: "Home", icon: "house"}]}])` | Sidebar takes section data |
| `Toggle("Email alerts", true)` | `Switch("Email alerts", true)` | Toggle is a toolbar button |
| `Stack([a, b], "horizontal", 16)` | `Stack([a, b], "horizontal", 4)` | gap is a 0-6 token |
| `Divider()` | `Separator()` | Divider is not a parser type |
| `Button("Save", "outlined")` | `Button("Save", "secondary")` | Unknown variants render a plain button. Variants: primary, secondary, ghost, icon-danger, icon-success, icon-accent |
| `Stack([a, b], "vertical", 5)` as the page root | `Stack([a, b], "vertical", 5, container: "wide")` | Without `container` the page has no side gutters |
| `Button("Delete account", "secondary")` | `Button("Delete account", "icon-danger", icon: "trash-2")` | Destructive actions read red; `icon-danger` keeps its label |

## Streaming

`createStreamingOpenUIParser().push(accumulatedText)` parses only complete lines and returns `{ spec, meta: { incomplete } }`, so you can render while a model streams. `detectFormat(text)` returns `"openui"`, `"json"` or `"unknown"`.

## Signatures

Positional order per type, with the prop types from the playground catalog. Props after `// named only` exist but have no positional slot. Renderers accept more than some of these lists show: `Field` and `Input` take any HTML input `type` (`date`, `time`, `tel`), and `Badge` also takes `success`, `danger`, `info` and `gray`. `references/components.md` lists the layout traps.

<!-- BEGIN GENERATED:signatures (tools/build-skill.mjs) -->
### Layout & Structure

```text
Stack(children: [refs], direction: "vertical"|"horizontal", gap: 0-6 (default 2=8px), justify: "center"|"end"|"between"|"evenly" (main-axis), align: "center"|"end"|"start"|"stretch" (cross-axis), wrap: bool (default true for horizontal), container: "wide"|"narrow"|true)
Grid(children: [refs], columns: 2-6, gap: 0-6 (default 2=8px), align: "center"|"end", container: "wide"|"narrow"|true)
Surface(children: [refs], variant: "raised"|"inset"|"pressed")
Text(content: string (the visible text), tag: "h1"|"h2"|"h3"|"h4"|"p"|"span", class: string | UX: tag is the HTML element)
Prose(content: string (HTML), size: "sm"|"lg"|"xl"|"2xl")
Separator(vertical: bool, dashed: bool, label: string)
Layout(children: [refs], direction, columns, gap, align, valign)
Divider(vertical, dashed: bool, label: string)
Icon(name: string (Lucide icon name), size: "xs"|"sm"|"md"|"lg"|"xl", variant: "branded"|"success")
Link(label: string, href: string (safe URL), class: string)
Frame(children: [body IDs], header: string|[childIds], footer: string|[childIds], flush: bool)
```

### Controls

```text
Button(label: string, variant: "primary"|"secondary"|"ghost"|"icon-danger"|"icon-success"|"icon-accent", size: "sm"|"lg"|"icon", loading:true during async, icon: string, trigger: "overlayId" (opens Modal/AlertDialog/Sheet/Drawer by id) | UX: one primary per view)
ButtonGroup(children: [refs])
Field(children: [refs], label: string, placeholder: string, type: "text"|"email"|"password"|"number", error: bool, helper: string, value: string (prefilled text; placeholder is only a hint) | UX: always include label)
Input(placeholder: string, size: "sm"|"lg", error: bool, type: "text"|"email"|"password"|"number"|"tel"|"url"|"search"|"date"|"time", value: string (prefilled text) | UX: wrap in Field for label+helper)
InputGroup(children: [refs], addonBefore: string, addonAfter: string (child is Input))
InputIcon(children: [refs], icon: string, right: bool (child is Input))
Search(placeholder: string)
Textarea(placeholder: string, rows: number, error: bool, value: string (prefilled text))
Checkbox(label: string (shown beside the box; leave it out when a Text in the same row names the item: Checkbox(checked: true)), checked: bool)
RadioGroup(options: [{label, value}], selected: string)
Switch(label: string (leave it out when a Text in the same row names the setting: Switch(checked: true)), checked: bool (on/off setting: notifications, preferences, feature flags))
Slider(min: number, max: number, value: number, step: number, label: string)
Toggle(label: string, pressed: bool, size: "sm" (pressable toolbar button: bold/italic, view filter — NOT for settings))
ToggleGroup(options: [{label, value}], selected: string)
Select(label: string, options: [{label, value}], selected: string)
CustomSelect(placeholder: string, options: [{label, value, selected: bool, disabled: bool}], searchable: bool)  // named only: selected
Kbd(keys: [string])
Label(text: string, required: bool, optional: bool)
Spinner(size: "sm"|"lg"|"xl")
InputOTP(length: number, separator: bool)
CheckboxGroup(children: [Checkbox IDs], label: string, helper: string, inline: bool)
Fieldset(children: [field IDs], legend: string, helper: string, disabled: bool)
Group(children: [control IDs], attached: bool, vertical: bool, label: string or aria-label: string)
NumberField(value: number, min: number, max: number, step: number (default 1), label: string or aria-label: string)  // named only: defaultValue, disabled, readOnly, name
Toolbar(children: [control IDs], vertical: bool, label: string or aria-label: string)
```

### Navigation

```text
Tabs(children: [childIds] (one child per tab — each child becomes a tab panel; order matches tabs array), tabs: [{label, id}], active: string)
Breadcrumbs(items: [{label, href}])
Pagination(current: number, total: number, perPage: number)
Stepper(steps: [{label, status: "completed"|"active"|"pending"}], vertical: bool | UX: one active step at a time)
NavMenu(items: [{label, href, active: bool}])
Navbar(children: [refs], brand: string, brandHref: string)
Menubar(items: [{label, dropdown: [{label, href}]}])
Sidebar(sections: [{title, items: [{label, icon, active, href}]}] (inline objects, NOT element ID references), collapsed: bool)
BottomNav(items: [{label, icon, active, badge}] | UX: max 5 items)
```

### Data Display

```text
Card(children: [refs], title: string, description: string, media: string (image URL only, NOT element IDs), footer: [childIds] (element IDs rendered in card footer area, NOT a boolean), interactive: bool, clip: bool | UX: footer is an array of element IDs not a boolean)
Table(columns: [{key, label, numeric}], rows: [{}] (a cell can list Button ids for row actions: {actions: [editBtn, deleteBtn]}), sortable: bool)
DataTable(columns: [{key, label}], rows: [{}] (a cell can list Button ids for row actions: {actions: [editBtn, deleteBtn]}), selectable: bool)
List(items: [{title, secondary, icon}])
Badge(text: string, variant: "new"|"updated"|"success"|"warning"|"error")
Avatar(initials: string, src: string (image URL only; skip it with size: "sm"), size: "sm"|"md"|"lg")
AvatarGroup(avatars: [{initials, src}], max: number)
Calendar(selected: "YYYY-MM-DD" (date to highlight), today: "YYYY-MM-DD" (today override))
Chart(bars: [{label, value, max}])
Carousel(slides: [{content}])
AspectRatio(children: [refs], ratio: "16-9"|"4-3"|"1-1"|"21-9")
Chip(label: string, color: "red"|"green"|"blue"|"purple"|"amber"|"pink", active: bool, closable: bool)
ScrollArea(children: [refs], direction: "horizontal"|"vertical")
Image(src: string (URL), alt: string, width: number, height: number)
```

### Feedback

```text
Alert(type: "info"|"warning"|"error"|"success", title: string, message: string)
Progress(value: number, indeterminate: bool)
Skeleton(variant: "text"|"heading"|"avatar"|"btn", lines: number)
EmptyState(icon: string, title: string, message: string, children: [childIds] (action Buttons shown under the message))
Tooltip(children: [refs], text: string, position: "top"|"bottom"|"left"|"right")
Meter(value: number (default 0), min: number (default 0), max: number (default 100), status: "success"|"warning"|"error", label: string or aria-label: string)
```

### Overlays

```text
Modal(children: [refs], id: string, title: string, footer: [childIds] (buttons for modal footer; omit for default Cancel/Confirm) | UX: clear close affordance)
AlertDialog(id: string, title: string, description: string, footer: [childIds] (action buttons; omit for default Cancel/Continue))
Sheet(children: [refs], id: string, position: "right"|"left"|"top"|"bottom")
Drawer(children: [refs], id: string)
Popover(children: [childIds] (first child becomes the trigger when it is a Button and there are 2+ children; other children are the content), position: "top"|"bottom"|"left"|"right")
HoverCard(children: [refs])
DropdownMenu(items: [{label, icon, separator, groupLabel, active: bool}])
ContextMenu(items: [{label, icon, separator}])
CommandPalette(id: string, placeholder: string, groups: [{label, items: [{label, icon, shortcut}]}] (inline objects, NOT element ID references))
PreviewCard(children: [childIds], trigger: string|[childIds], title: string, description: string, media: string (safe image URL)|[childIds], mediaAlt: string)
```

### Layout Utilities

```text
Accordion(items: [{title, content, children: [childIds]}], multi: bool)
Collapsible(children: [refs], label: string)
Resizable(children: [refs], direction: "horizontal"|"vertical")
DatePicker(label: string, placeholder: string, selected: string)
```

### Dashboard

```text
StatCard(label: string, value: string, trend: "up"|"down" (direction only, never an icon), trendValue: string, icon: string (Lucide name, pass named: icon: "users"), horizontal: bool)
ChartCard(children: [Chart element] (empty ChartCard renders "No data"), title: string)  // named only: bars
```

### Chat

```text
MessageScroller(children: [row IDs], height: number (default 360px), autoScroll: bool (default true), defaultScrollPosition: "start"|"end"|"last-anchor" (default "end"), peek: nonnegative number (default 0))  // named only: label
Message(children: [content IDs], align: "start"|"end", avatar: string (initials)|{initials, src: safe image URL}, name: string, timestamp: string, messageId: string (defaults to element ID), scrollAnchor: bool, footer: string)
Bubble(children: [content IDs], content: string (plain text), variant: "primary"|"default"|"secondary"|"muted"|"tinted"|"outline"|"ghost"|"destructive", align: "start"|"end", reactions: [{label, count, pressed}] (app-controlled))
Attachment(children: [action IDs] (separate from overlay link), name: string, description: string, src: safe image URL, alt: string, href: safe URL, size: "sm"|"xs", state: "idle"|"uploading"|"processing"|"error"|"done" (default "idle"), progress: 0-100, orientation: "horizontal"|"vertical")
Marker(children: [content IDs], content: string (plain text), icon: string (Lucide), variant: "border"|"separator", status: bool (polite live region), busy: bool)
ChangeSummary(children: [action IDs] (explicit host-provided actions), files: [{path: string, additions?: number, deletions?: number, status?: "added"|"modified"|"deleted"}], title: string (default "Edited N file(s)"; empty: "No files changed"), description: string, undoLabel: string, undoDisabled: bool. Static markup)
ChatComposer(models: [{id, label, efforts?: string[]}], model: string, effort: string, approval: "ask"|"auto", mode: "chat"|"plan", actions: [{id, label, icon?, disabled?}], capabilities: {queue?, steer?, attachments?, folders?, dictation?, approval?} (boolean flags), busy: bool, placeholder: string, id: string. Empty native form; requires daub.js and daub.css. Default model labels are demo-only (simulated). Host handles db:chat-send/steer/stop/action; configuration grants no access rights)
```

### Custom

```text
CustomHTML(html: string (raw HTML using DAUB classless CSS), css: string (CSS rules injected as a <style> tag), js: string (vanilla JS, receives "container" arg for this element and "preview" arg for the entire preview pane — use preview.querySelector('[data-spec-id="someId"]') to target other elements), children: [childIds] (standard DAUB component IDs rendered inside the container — html renders first, then children append after))
```

Children-first types (34): Stack, Grid, Surface, Layout, ButtonGroup, Field, InputGroup, InputIcon, CheckboxGroup, Fieldset, Group, Tabs, Navbar, Toolbar, Card, Frame, AspectRatio, ScrollArea, MessageScroller, Message, Bubble, Attachment, Marker, ChangeSummary, Tooltip, Modal, Sheet, Drawer, Popover, HoverCard, PreviewCard, Collapsible, Resizable, ChartCard.

Children elsewhere: EmptyState (position 4), CustomHTML (position 4).

Parser types: 89. Any other PascalCase name tokenizes as a plain identifier and becomes a dangling child reference.
<!-- END GENERATED:signatures -->
