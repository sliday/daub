# DAUB Dev Brief — Visual QA Results

99 AI-generated layouts. Two independent analyses cross-referenced. This is the deduplicated, verified punch list.

---

## The Numbers

| Dimension | Avg / 5 | Broken (1-2) | Perfect (5) |
|-----------|---------|-------------|-------------|
| Intent | 4.20 | 11% | 60% |
| **Layout** | **3.62** | **24%** | **35%** |
| Component | 4.34 | 6% | 60% |
| Data | 4.66 | 4% | 79% |

24 of 99 outputs scored perfect. 15 are severely broken. Layout is the only dimension dragging quality down — everything else is solid.

Fault split: 29 spec, 26 render, 20 both, 24 none.

---

## Part 1: CSS / Render Engine Fixes

These are bugs where the JSON spec is correct but the visual output is wrong. Ordered by impact.

### P0 — Container Height Collapse ("Beige Block")

**Sessions:** #1, #2, #3, #9, #15, #19, #22, #29, #38, #39, #66, #76, #85, #89, #90, #95
**Count:** 16 sessions (11 severe, 5 subtle)
**Both analyses flagged this as the #1 issue.**

The root container / `db-container` fails to expand to fit its children. Page background bleeds through the bottom. On light themes it manifests as a beige block obscuring content. On dark themes (tokyo-night, nord, synthwave) the themed background simply stops, leaving content floating on raw white.

Two layers to fix:

1. **DAUB CSS** — `db-container` or the root layout wrapper needs `min-height: 100%` with no `overflow: hidden`. Background color must extend via `var(--db-bg)` on the body-level element.

2. **Capture pipeline** (`render-capture.js`) — The Playwright viewport is 900px tall. Content taller than that gets clipped. Measure actual rendered content height after `waitForSelector`, resize viewport to match, then screenshot. This alone eliminates the entire bug class without touching DAUB CSS.

**Estimated layout score impact:** +0.3-0.4 on the 3.62 average (moves ~16 sessions from 1-3 to 4-5).

---

### P1 — Navbar Hardcoded White Background

**Sessions:** #7, #9, #42, #80
**Affects every dark theme that uses Navbar.**

`.db-navbar` has a hardcoded white/light background. It ignores theme tokens entirely.

```css
/* current: something like background: #fff or background: white */
/* fix: */
.db-navbar {
  background: var(--db-surface);
  color: var(--db-text);
}
```

---

### P1 — Badge Stretches Full Width in Flex Columns

**Sessions:** #23, #26, #29, #40, #70 (5 sessions, confirmed in both analyses)

`.db-badge` inside `.db-card__body` (flex column) stretches to 100% width. Should be intrinsic.

```css
.db-badge {
  align-self: flex-start;
  width: fit-content;
}
```

---

### P1 — ChartCard Renders Empty

**Sessions:** #4, #6, #41

`.db-chart-card__body` renders as an empty div. No fallback, no placeholder, no default chart from the `bars` prop.

Fix: render a default bar visualization from the `bars` prop data, or show a styled empty state with min-height so the card doesn't collapse.

---

### P2 — Breadcrumbs Render Vertically

**Session:** #69
**Only in uploaded FINDINGS, missed in automated analysis.**

The `<ol>` inside `db-breadcrumbs` lacks `display: flex`.

```css
.db-breadcrumbs ol {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}
```

---

### P2 — BottomNav Invisible in Static/Embedded Contexts

**Session:** #91
**Only in uploaded FINDINGS.**

`db-bottom-nav` uses `position: fixed`, placing it outside the Playwright screenshot viewport and any non-viewport parent context (embedded preview, SSR).

Fix: add a `db-bottom-nav--static` variant, or detect non-viewport parents and fall back to `position: sticky`.

---

### P2 — Skeleton Low Contrast on Light Themes

**Session:** #53
**Only in uploaded FINDINGS.**

`db-skeleton` is nearly invisible against `nord-light` card backgrounds. Doesn't adapt to theme surface colors.

```css
.db-skeleton {
  background: var(--db-skeleton-bg, var(--db-border));
}
```

---

### P2 — "midnight" Theme Not Applied

**Session:** #72
**Only in uploaded FINDINGS.**

Spec says `theme: "midnight"` but render used a light theme. Either `midnight` isn't in the theme registry, or `json-render` doesn't map `spec.theme` to the `data-theme` attribute correctly.

Fix: verify theme registry includes midnight. Check that the render pipeline reads and applies `spec.theme`.

---

### P2 — ScrollArea Clips Without Visible Scrollbar

**Session:** #84

`db-scroll-area` clips content but shows no scrollbar. Looks like a layout bug rather than a scrollable region.

Fix: ensure the custom scrollbar thumb is visible when content overflows. Consider `scrollbar-gutter: stable`.

---

### P2 — StatCard Horizontal Variant Broken

**Session:** #78
**Only in uploaded FINDINGS.**

`db-stat` with `horizontal: true` doesn't produce a compact inline layout. Icon, label, value, trend all stack vertically with excessive spacing.

Fix: ensure `db-stat--horizontal` uses `flex-direction: row` with proper gap and alignment.

---

### Summary Table — Render Fixes

| Priority | Bug | Sessions Hit | Effort |
|----------|-----|-------------|--------|
| **P0** | Container height collapse / beige block | 16 | Medium (CSS + capture pipeline) |
| **P1** | Navbar ignores dark themes | 4 + all dark navbar usage | Tiny (CSS variable swap) |
| **P1** | Badge stretches in flex columns | 5 | Tiny (2 CSS lines) |
| **P1** | ChartCard empty body | 3 | Small (fallback state) |
| **P2** | Breadcrumbs vertical | 1 | Tiny (CSS flex) |
| **P2** | BottomNav position:fixed | 1 | Small (CSS variant) |
| **P2** | Skeleton contrast | 1 | Tiny (CSS variable) |
| **P2** | midnight theme missing | 1 | Small (registry check) |
| **P2** | ScrollArea no scrollbar | 1 | Small (CSS) |
| **P2** | StatCard horizontal | 1 | Small (CSS flex) |

**The P0 + three P1 fixes cover 28 of the 46 render-fault sessions (61%).**

---

## Part 2: System Prompt / LLM Spec Fixes

These are patterns where Gemini Flash Lite consistently generates broken specs. Each fix is a guideline addition to the system prompt in `generate.js` → `buildSystemPrompt()`.

### High Priority

**1. Ban `flex-flow: wrap` on app shells** (6 sessions: #24, #42, #46, #56, #90, #99)

The LLM wraps sidebar + main content layouts, causing main content to drop below the sidebar.

> Add: "For sidebar + main content layouts, NEVER use flex-wrap. Use `flex-wrap: nowrap` and apply `flex: 1` to the main content area so it fills remaining space."

**2. Force overlays open for static preview** (5+ sessions: #44, #45, #47, #48, #49)

Modal, Sheet, Drawer, CommandPalette, ContextMenu are generated hidden. Static screenshots show nothing.

> Add: "When the prompt's PRIMARY subject is an overlay (Modal, Sheet, Drawer, CommandPalette, ContextMenu), generate it in its visible/open state."

Also fixable in the capture pipeline: inject JS to force-open all overlay components before screenshot.

**3. Mandate Avatar when prompt says "avatar"** (5 sessions: #27, #30, #82, #84, #89)

Prompt says "user avatars" → LLM uses plain text instead.

> Add: "When the prompt mentions avatars, profile photos, or user images, ALWAYS use the Avatar component."

### Medium Priority

**4. Tab content nesting** (4 sessions: #37, #41, #74, #85)

LLM places tab-panel content as siblings to the Tabs component instead of children.

> Add: "Tab panel content MUST be children of the Tabs component. NEVER place tab content as a sibling."

**5. Carousel slides: no raw HTML** (3 sessions: #38, #50, #67)

LLM passes `<img>` strings as slide content. Gets escaped, renders as literal text.

> Add: "Carousel slides must reference component IDs in the children array. Never pass raw HTML strings as slide content. Use CustomHTML with the `html` prop for images."

**6. Grid column spanning** (3 sessions: #58, #75, #79)

LLM creates multi-column grids but doesn't assign col-span to main content, leaving it cramped.

> Add: Document col-span or equivalent in the Layout component props reference.

**7. Empty containers** (17 sessions flagged by automated check)

LLM creates Layout/Card wrappers with no children. 17% of specs.

> Add: "Every Layout and Card must have at least one child. Never create empty container elements."

### Summary Table — Spec Fixes

| Priority | Issue | Sessions | Fix |
|----------|-------|----------|-----|
| **High** | flex-wrap on app shells | 6 | 1 guideline |
| **High** | Overlays hidden in preview | 5+ | 1 guideline + capture JS |
| **High** | Avatar omission | 5 | 1 guideline |
| **Medium** | Tab content as siblings | 4 | 1 guideline |
| **Medium** | Raw HTML in Carousel | 3 | 1 guideline |
| **Medium** | Grid col-span undocumented | 3 | Prop docs |
| **Medium** | Empty containers | 17 | 1 guideline |

---

## Part 3: Capture Pipeline Fixes

These are `render-capture.js` changes, not DAUB CSS.

**1. Dynamic viewport height** — After `waitForSelector('[data-spec-id]')`, measure the actual content height of `.pg-preview`, then resize the Playwright viewport to match before screenshotting. This eliminates the entire "beige block" class of bugs even without CSS changes.

**2. Force-open overlays** — Before screenshot, inject:
```js
document.querySelectorAll('[data-overlay]').forEach(el => el.setAttribute('data-open', 'true'));
```
(Adjust selector to match DAUB's overlay implementation.)

**3. Re-run missing session** — 99/100 analyzed. Find and re-run the gap.

---

## Part 4: Theme Issues

**Theme usage is heavily skewed.** Gemini over-selects `bone` (26%) and `github` (19%). 7 available themes were never used: `dracula` (1), `synthwave` (1), `catppuccin-dark` (1), `solarized-light` (1), `grunge-dark` (1), `paper` (1), `midnight` (1), and several with 0 usage.

**Dark themes score worse** — `nord` averages 3.73 composite vs `bone` at 4.50. Part of this is the Navbar bug (hardcoded white), part is the container height bug being more visible on dark backgrounds.

Fix the Navbar + container bugs first, then re-evaluate. The remaining gap may be a theme CSS completeness issue or just noise from low sample sizes on dark themes.

---

## Worst 5 Sessions (for regression testing)

| # | Score | Fault | What Broke |
|---|-------|-------|------------|
| 45 | 1.0 | both | Sheet renders as empty dark bar. Content completely missing. |
| 67 | 1.8 | spec | Carousel slides contain escaped HTML text instead of images. |
| 38 | 2.2 | both | Product detail missing right column + carousel broken. |
| 50 | 2.2 | spec | Gallery carousel shows raw HTML + modal hidden. |
| 41 | 2.8 | both | Tab content placed outside tabs + ChartCard empty. |

Use these 5 as regression tests after fixes. If they pass, the tail will follow.

---

## Category Insights

| Category | Composite | Main Problem |
|----------|-----------|-------------|
| **Dashboards** | 4.50 | Render engine (8/10 faults are render). Specs are great. Fix CSS. |
| **Complex Layouts** | 3.35 | LLM can't nest (tabs > cards > charts). Fix system prompt. |
| **Real Apps** | 3.92 | Both sides fail. Complex UIs expose every bug simultaneously. |
| **Forms** | 4.44 | Strongest category. Simple patterns, well-understood by LLM. |

---

## Confidence Notes

Both analyses were performed by Gemini Pro vision scoring screenshots against specs. The scoring model itself may have biases — it has no access to interactivity, hover states, or scroll behavior. The "beige block" detection is high-confidence (visually confirmed on actual screenshots). Component-level CSS fixes (Badge, Breadcrumbs, Navbar) are high-confidence — the selectors and fix CSS are specific. System prompt fixes are medium-confidence — they're based on pattern analysis of LLM output, but actual improvement depends on how Gemini Flash Lite responds to guideline additions. Run the QA pipeline again after fixes to measure.
