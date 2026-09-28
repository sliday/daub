# OpenUI Lang for DAUB

OpenUI Lang is a compact text form of a DAUB spec. A model writes it with about 67% fewer tokens than the same JSON. `daub-openui-parser.js` (browser global `DaubOpenUI`, or `require()` in Node) turns it into a json-render spec; `references/json-render.md` covers that format.

```js
const { openUItoSpec } = require('./daub-openui-parser.js'); // fetch it from https://daub.dev/daub-openui-parser.js
const spec = openUItoSpec(text); // { theme, root, elements, state? } or null
```

## Syntax

- One statement per line: `name = Expression`. The name becomes the element id.
- `root = ...` marks the root. Without it, the first component statement is the root.
- `__theme = "github"` sets the theme. Without it the parser writes `"bone"`.
- `__state = {tab: "overview", count: 0}` sets the initial state (see json-render.md).
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
root = Stack([nav, main], "horizontal", 5)
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

A pricing section with a billing toggle and three plans:

```openui
__theme = "bone"
root = Stack([intro, period, plans], "vertical", 5, align: "center", container: "wide")
intro = Stack([Text("Plans that grow with your team", "h2"), Text("Start free. Upgrade when you need more seats.", "p")], "vertical", 2, align: "center")
period = ToggleGroup([{label: "Monthly", value: "month"}, {label: "Yearly (save 20%)", value: "year"}], "year")
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

## Streaming

`createStreamingOpenUIParser().push(accumulatedText)` parses only complete lines and returns `{ spec, meta: { incomplete } }`, so you can render while a model streams. `detectFormat(text)` returns `"openui"`, `"json"` or `"unknown"`.

## Signatures

Positional order per type, with the prop types from the playground catalog. Props after `// named only` exist but have no positional slot.

<!-- BEGIN GENERATED:signatures (tools/build-skill.mjs) -->
### Layout & Structure

```text
Stack(children: [refs], direction: "vertical"|"horizontal", gap: 0-6 (default 2=8px), justify: "center"|"end"|"between"|"evenly" (main-axis), align: "center"|"end"|"start"|"stretch" (cross-axis), wrap: bool (default true for horizontal), container: "wide"|"narrow"|true)
Grid(children: [refs], columns: 2-6, gap: 0-6 (default 2=8px), align: "center"|"end", container: "wide"|"narrow"|true)
Surface(children: [refs], variant: "raised"|"inset"|"pressed")
Text(content: string, tag: "h1"|"h2"|"h3"|"h4"|"p"|"span", class: string)
Prose(content: string (HTML), size: "sm"|"lg"|"xl"|"2xl")
Separator(vertical: bool, dashed: bool, label: string)
Icon(name: string (Lucide icon name), size: "xs"|"sm"|"md"|"lg"|"xl", variant: "branded"|"success")
Link(label: string, class: string)
```

### Controls

```text
Button(label: string, variant: "primary"|"secondary"|"ghost"|"icon-danger"|"icon-success"|"icon-accent", size: "sm"|"lg"|"icon", loading: bool, icon: string, trigger: "overlayId" (opens Modal/AlertDialog/Sheet/Drawer by id))
ButtonGroup(children: [refs])
Field(children: [refs], label: string, placeholder: string, type: "text"|"email"|"password"|"number", error: bool, helper: string)
Input(placeholder: string, size: "sm"|"lg", error: bool, type: "text"|"email"|"password"|"number"|"tel"|"url"|"search"|"date"|"time")
InputGroup(children: [refs], addonBefore: string, addonAfter: string (child is Input))
InputIcon(children: [refs], icon: string, right: bool (child is Input))
Search(placeholder: string)
Textarea(placeholder: string, rows: number, error: bool)
Checkbox(label: string, checked: bool)
RadioGroup(options: [{label, value}], selected: string)
Switch(label: string, checked: bool (on/off setting: notifications, preferences, feature flags))
Slider(min: number, max: number, value: number, step: number, label: string)
Toggle(label: string, pressed: bool, size: "sm" (pressable toolbar button: bold/italic, view filter — NOT for settings))
ToggleGroup(options: [{label, value}], selected: string)
Select(label: string, options: [{label, value}], selected: string)
CustomSelect(placeholder: string, options: [{label, value, selected: bool, disabled: bool}], searchable: bool)
Kbd(keys: [string])
Label(text: string, required: bool, optional: bool)
Spinner(size: "sm"|"lg"|"xl")
InputOTP(length: number, separator: bool)
```

### Navigation

```text
Tabs(children: [childIds] (one child per tab — each child becomes a tab panel; order matches tabs array), tabs: [{label, id}], active: string)
Breadcrumbs(items: [{label, href}])
Pagination(current: number, total: number, perPage: number)
Stepper(steps: [{label, status: "completed"|"active"|"pending"}], vertical: bool)
NavMenu(items: [{label, href, active: bool}])
Navbar(children: [refs], brand: string, brandHref: string)
Menubar(items: [{label, dropdown: [{label, href}]}])
Sidebar(sections: [{title, items: [{label, icon, active, href}]}], collapsed: bool)
BottomNav(items: [{label, icon, active, badge}])
```

### Data Display

```text
Card(children: [refs], title: string, description: string, media: string, footer: [childIds], interactive: bool, clip: bool)
Table(columns: [{key, label, numeric}], rows: [{}], sortable: bool)
DataTable(columns: [{key, label}], rows: [{}], selectable: bool)
List(items: [{title, secondary, icon}])
Badge(text: string, variant: "new"|"updated"|"warning"|"error")
Avatar(initials: string, src: string, size: "sm"|"md"|"lg")
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
EmptyState(icon: string, title: string, message: string)
Tooltip(children: [refs], text: string, position: "top"|"bottom"|"left"|"right")
```

### Overlays

```text
Modal(children: [refs], id: string, title: string, footer: [childIds] (buttons for modal footer; omit for default Cancel/Confirm))
AlertDialog(id: string, title: string, description: string, footer: [childIds] (action buttons; omit for default Cancel/Continue))
Sheet(children: [refs], id: string, position: "right"|"left"|"top"|"bottom")
Drawer(children: [refs], id: string)
Popover(children: [childIds] (first child becomes the trigger when it is a Button or Link and there are 2+ children; other children are the content), position: "top"|"bottom"|"left"|"right")
HoverCard(children: [refs])
DropdownMenu(items: [{label, icon, separator, groupLabel, active: bool}])
ContextMenu(items: [{label, icon, separator}])
CommandPalette(id: string, placeholder: string, groups: [{label, items: [{label, icon, shortcut}]}])
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
StatCard(label: string, value: string, trend: "up"|"down", trendValue: string, icon: string, horizontal: bool)
ChartCard(children: [Chart element] (empty ChartCard renders "No data"), title: string)  // named only: bars
```

### Custom

```text
CustomHTML(html: string (raw HTML using DAUB classless CSS), css: string (CSS rules injected as a <style> tag), js: string (vanilla JS, receives "container" arg for this element and "preview" arg for the entire preview pane — use preview.querySelector('[data-spec-id="someId"]') to target other elements), children: [childIds] (standard DAUB component IDs rendered inside the container — html renders first, then children append after))
```

Children-first types (21): Stack, Grid, Surface, ButtonGroup, Field, InputGroup, InputIcon, Tabs, Navbar, Card, AspectRatio, ScrollArea, Tooltip, Modal, Sheet, Drawer, Popover, HoverCard, Collapsible, Resizable, ChartCard.

Children elsewhere: CustomHTML (position 4).

Parser types: 72. Any other PascalCase name tokenizes as a plain identifier and becomes a dangling child reference.
<!-- END GENERATED:signatures -->
