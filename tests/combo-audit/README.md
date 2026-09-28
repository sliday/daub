# Combo visual audit

Finds layout and visual defects that appear when DAUB components are combined and nested, the way AI-generated json-render specs combine them. The single-component rig (`tests/component-audit/`) renders each component alone. This one renders specs.

```bash
node tests/combo-audit/audit.mjs [--seed 1] [--count 300] [--pairs] [--random] [--blocks] [--out dir]
```

Exit code is always 0. The last line prints a summary and the report path.

## What it renders

Each spec goes through `daub-render.js` + `daub.css` + `daub.js` in a page that mirrors `renderToHTML()` in `functions/api/mcp.js`: `renderElement(root)`, orphan elements appended, `DAUB.init()`, `lucide.createIcons()`. Then the harness opens overlays through the DAUB API (`openModal`, `openSheet`, `openDrawer`) or the classes the DAUB click handlers toggle (`db-popover--open`, `db-dropdown--open`, `db-collapsible--open`).

Three generators, all seeded (`--seed`), so the same seed gives byte-identical specs:

| Kind | What | Default size |
| --- | --- | --- |
| `solo` | every leaf type alone (baseline, runs with pairs) | 52 |
| `pair` | 23 container variants x leaf types | ~1000 |
| `random` | random trees, depth 2-3, 4-12 elements | `--count` (300) |
| `block` | `blocks/<category>/*.json` as-is | 266 |

Container variants: Stack vertical and horizontal, Grid 2/3/4, Card with title and footer, Surface, Tabs, Accordion, Collapsible (opened), ScrollArea vertical and horizontal, ChartCard, Modal/Sheet/Drawer/Popover/DropdownMenu (opened), Sidebar + content row, Navbar, Field, InputGroup, InputIcon. Leaf props come from the `COMP_PROPS` shapes in `functions/api/mcp.js`. Half the time a leaf instead copies a props object from a real block spec, so the generator exercises the prop shapes AI writes. Content pools mix short labels, long sentences and unbreakable tokens (emails, URLs, API keys).

Every spec renders in 4 themes (`light`, `dark`, `synthwave`, `monospace-light`) at 2 viewports (`1280x900`, `390x844`). Change them with `--themes a,b` and `--viewports 1280x900,390x844`.

`--pairs`, `--random` and `--blocks` pick generator kinds. With none of them, all run. `--only '<regex>'` filters spec ids, which is how you re-run one finding.

## Checks

All checks run in the page (`probe.js`) and report the nearest element with `data-spec-id` as `id` and its spec `type`, plus `sel`, a short CSS path to the offending box.

| Check | Fires when |
| --- | --- |
| `console_error` | `console.error`, page error, a renderer throw (`[daub-render]` warning, `data-render-error`), or an `Unknown: <Type>` notice |
| `lint` (info) | DAUB dev-mode structure warnings from `daub.js` `_validate()` (`DAUB: .db-tabs missing __list child`). It only runs on localhost, so hosted users never see it. A Field that wraps `.db-input`, `.db-select`, `.db-textarea`, `.db-custom-select` or a native control does not count |
| `zero_size` | a leaf that should be visible renders 0 wide or 0 high and has no visible descendant. Hidden-by-design parts (closed overlays, inactive tabs, closed accordion items, `<option>`) are skipped |
| `page_overflow` | `side: right`: `documentElement.scrollWidth > clientWidth`; `culprits` lists the boxes that first cross the right edge. `side: left`: an in-flow box (no clipping or positioned ancestor) starts left of the viewport, where nobody can scroll to it (a centred row wider than its column) |
| `child_overflow` | an in-flow box sticks out of its parent's border box by more than 1px. `spill` = parent is `overflow: visible`. `clip` = parent cuts it off (>2px). Scroll containers and boxes that clip on purpose (carousel, avatar, progress) are skipped |
| `offscreen` | an absolute or fixed box (opened popover, menu, panel) runs past the viewport edge |
| `escaped_fixed` (info) | a `position: fixed` component (BottomNav) nested inside a Card, Grid, Tabs and similar. It renders glued to the viewport, detached from its container. Info because BottomNav is fixed by design and the generator does the nesting |
| `overlap` | two in-flow siblings of a flex or grid container intersect by more than 4px² and more than a shared 1px border |
| `text_clip` | a text run extends past its block box. `clipped` = an ancestor cuts it off without `text-overflow: ellipsis` or `line-clamp`. `scroll-clipped` = cut off inside a box that scrolls horizontally but is not a scroller by design. `spills` = the text runs over its neighbours. Vertical overflow counts only from ~half a line |
| `contrast` | WCAG AA (4.5, or 3 for large text), sampler reused from the component audit. Additions: foreground alpha and ancestor opacity blend in, the fallback background is the real canvas colour, and disabled controls are exempt. So are outside-month calendar days, the CustomSelect placeholder and text inside CustomHTML (the block author picks those colours) |
| `contrast_near` (info) | a contrast miss within 0.25 of the threshold (4.25-4.49 for body text) |
| `empty_region` | a container of 200x120 or larger that paints its own box (background, border or shadow) where content covers under 15% of the area. Content means text line boxes, replaced elements and painted boxes, each dilated by 12px so normal gaps count as used. Transparent layout boxes (Stack, Grid) are skipped: their whitespace reads as page whitespace. Sidebars and EmptyState panels are exempt |
| `broken_media` | `<img>` that failed or timed out, and `<i data-lucide>` placeholders that lucide never replaced (unknown icon name) |
| `unknown_variant` | an element carries a `db-block--modifier` or `db-block__elem--modifier` class that no rule in `daub.css` mentions. The renderer passed a prop value through verbatim (`db-btn--outline` renders as the chrome-less `.db-btn` base, `db-grid--sidebar-main` as one column). `--md` (the default size) is skipped |
| `dropped_content` | a text prop (`content`, `title`, `description`, `label`, `message`, `primary`, `secondary`, `helper`, `meta` and a few more, also inside `items[]`, `steps[]`, `sections[].items[]`) appears nowhere in the element's rendered text or attributes. The renderer ignored that prop name. HTML props compare by their text |
| `orphaned` | a spec element the hosted orphan pass appended at the bottom of `#app`. `dropped-by-parent` (reported on the parent): a parent lists the child but its renderer never placed it (List, Avatar, AvatarGroup children). `unreferenced`: nothing lists it. `duplicate-render`: rendered twice |
| `touching_text` | two adjacent items of a flex row whose text runs sit less than 2px apart on the same line ("Remember meForgot password?"). Joined controls (button, input and toggle groups) and carousel tracks are skipped |

Each check reports at most 12 findings per render. `totals` in `report.json` holds the uncapped counts when a cap hit.

## Reading the report

- `report.md`: the summary. It has counts by check and generator kind, by theme and viewport, the top (check, type) pairs with example renders and screenshot links, a check x type matrix, the worst container x leaf pairs and the worst blocks.
- `report.json`: `meta` (seed, runtime, asset hashes, shell probe), `summary` (the aggregates) and `results`, one entry per render: `id`, `spec`, `kind`, `theme`, `viewport`, `findings[]`, and `shot` when one was taken.
- `specs.json`: every generated spec by id (blocks point at their file). Paste one into the playground or re-run it with `--only`.
- `shots/<spec>__<theme>__<viewport>.png`: element-focused crops with the offending boxes outlined in magenta. The harness only captures renders with findings, capped by `--max-shots` (400). Selection is deterministic and round-robins across (check, type) groups, so the cap covers every kind of problem before it repeats one.

**Combo-only.** Each finding carries `solo_repro: true` when the same (check, type) also fires for that leaf rendered alone at the same theme and viewport. The "Combo-only" / "Not reproduced solo" columns count the rest. Those are the defects that exist only because of the nesting.

## Design decisions

- **Shell.** `--shell mcp` reads the `body` rule from `renderToHTML()` in `functions/api/mcp.js` at start, so it reproduces the hosted page exactly. `--shell fixed` (the default) pins `--db-color-bg` / `--db-color-text`. The hosted template used to style `body` with `var(--db-bg)` / `var(--db-fg)`, which `daub.css` never defined, so body went transparent with black text in every theme; the fixed shell kept that bug from drowning the combo findings in contrast noise, and the hosted shell now uses the same tokens. The shell probe renders a block in both shells per theme and reports the difference in `report.md`. Any gap there means the hosted shell has drifted from the fixed one.
- **One page, many specs.** Each worker loads the shell once and renders specs in place. It clears `#app`, stray body children, inline body/html styles and localStorage, and reloads every 250 renders. That gets ~100 renders/s instead of ~5 with a navigation per spec. The harness serves `daub.*` and `probe.js` from a snapshot taken at start, so concurrent edits cannot split a run. `meta.hashes` records which versions ran.
- **Plausible pairs.** Field, InputGroup and InputIcon get form leaves only. DropdownMenu gets trigger leaves, and Navbar gets nav-ish leaves. A Table inside an InputGroup tells you nothing. `--all-pairs` crosses everything.
- **Transitions zeroed.** A style rule sets transition and animation durations to 0s, so every rect gets measured at rest, never mid-slide.
- **Network.** Default `--net stub`: known placeholder hosts (picsum, pravatar, unsplash, placehold.co and a few more) answer with a same-size SVG. The harness aborts every other external request, so fabricated hosts (`images.example.com`) show up as `broken_media`. Google Fonts get aborted too, and text falls back to system fonts. `--net live` uses the real network.
- **Lucide.** The harness loads the version pinned in `LUCIDE_SRC` in `functions/api/mcp.js` (0.576.0 at the time of writing), so `broken_media` matches the hosted page. `--lucide latest` loads 1.x, which ships no brand icons (`github`, `twitter`, `linkedin`). The harness caches the build under `<out>/vendor/`.
- **Info tier.** `lint`, `contrast_near` and `escaped_fixed` stay in `report.json` and get their own rows in `report.md`, but the headline totals (`meta.findings`, `meta.renders_with_findings`) and screenshot selection count only visual checks. `meta.unique_defects` collapses the same (spec, check, element) across themes and viewports.
- **Frozen assets.** `--assets DIR` serves `daub.css`, `daub.js` and `daub-render.js` from a directory, so two runs (a harness change, a CSS change) compare against the same bytes while other work edits the repo copies.

## Options

| Flag | Default | |
| --- | --- | --- |
| `--seed N` | 1 | RNG seed for pairs and random trees |
| `--count N` | 300 | random trees (0 disables) |
| `--pairs --random --blocks` | all | generator kinds to run |
| `--all-pairs` | off | cross every container with every leaf |
| `--only REGEX` | | filter spec ids |
| `--themes`, `--viewports` | see above | comma lists |
| `--out DIR` | `test-results/combo-audit` | output directory (wiped `shots/` each run) |
| `--workers N` | min(8, cpus-2) | parallel pages |
| `--max-shots N` / `--no-shots` | 400 | screenshot cap |
| `--shell fixed\|mcp` | fixed | body styling, see above |
| `--net stub\|live` | stub | external requests |
| `--lucide VERSION` | `LUCIDE_SRC` pin in `functions/api/mcp.js` | lucide build to cache and load |
| `--assets DIR` | repo root | serve `daub.css` / `daub.js` / `daub-render.js` from this directory |
| `--extra DIR` | | also audit every `*.json` in DIR as spec `extra--<name>` (a bare `{root, elements}` or a saved AI output with `.spec`). Pair with `--only '^extra--'` to audit real model output alone |

Playwright resolves from the repo's `node_modules`. Set `PLAYWRIGHT_MODULE=/abs/path/to/playwright/index.js` to use another install.
