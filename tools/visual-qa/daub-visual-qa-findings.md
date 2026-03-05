# Daub Visual QA: 100-Session Analysis

**Pipeline**: Gemini 3.1 Flash Lite → JSON spec → daub.dev playground render → Playwright screenshot → Gemini 3.1 Pro vision analysis

**Dataset**: 99 successfully analyzed sessions across 10 prompt categories (dashboards, forms, data-display, marketing, complex-layouts, edge-cases, component-stress, theme-combos, real-apps, responsive).

---

## Executive Summary

24% of outputs are perfect. 15% are severely broken (composite < 3.5/5). The single largest quality drag is **layout score (avg 3.62)** — everything else is above 4.2. Fault attribution splits roughly into thirds: 29% spec, 26% render, 20% both, 24% clean. The render engine has 5 discrete, fixable bugs that account for the majority of visual failures.

---

## Score Overview

| Dimension | Avg | Score 1-2 | Score 5 |
|-----------|-----|-----------|---------|
| Intent    | 4.20 | 11% | 60% |
| **Layout** | **3.62** | **24%** | **35%** |
| Component | 4.34 | 6% | 60% |
| Data      | 4.66 | 4% | 79% |

Layout is the weak link. One in four outputs has a layout score of 1-2.

---

## Render Engine Bugs (26% of all faults)

These are the highest-signal issues for the dev team. The spec is correct but the visual output is broken.

### 1. "Beige Block" Content Occlusion — CRITICAL, 11 occurrences

The single most impactful render bug. A solid beige/cream block obscures the bottom 30-50% of the rendered output, covering content that exists in the DOM. Visually confirmed on sessions 1, 2, 15, 19, 38, 66, 76, 89, 90, 95.

**Root cause hypothesis**: The playground preview container (`pg-preview`) has a fixed height or fails to grow with content. The beige area is the page background bleeding through where the container ends. Likely a missing `min-height: 100%` or `overflow: visible` on the preview wrapper, or the screenshot viewport (900px) is shorter than the rendered content.

**Fix**: Ensure the preview container expands to fit all child content. Consider `height: auto; min-height: 100%` on `.pg-preview` or measure actual content height before screenshot capture.

**Impact if fixed**: Would immediately improve layout scores for 11 sessions (11% of total).

### 2. Container Height / Background Termination — 16 occurrences

Broader version of the beige block: the root container's themed background ends before content does, leaving content floating on a raw page background. Especially bad on dark themes (tokyo-night, nord, synthwave) where the contrast between themed content area and raw background is stark.

**Fix**: Apply `min-height: 100vh` and `background-color: var(--db-bg)` to the root `.db-container` or body-level wrapper.

### 3. Badge Width Stretching — 4 occurrences (sessions 23, 26, 29, 40)

`.db-badge` components stretch to full container width when placed inside `.db-card__body`, which uses `display: flex; flex-direction: column`. Badges should be inline/intrinsic-width.

**Fix**: Add `align-self: flex-start` (or `width: fit-content`) to `.db-badge` base styles.

### 4. ChartCard Renders Empty — 3 occurrences (sessions 4, 6, 41)

`ChartCard` renders an empty `.db-chart-card__body` with no visualization. The spec includes the `ChartCard` with a title but the body never populates.

**Fix**: Either render a default bar chart from the `bars` prop, or show a meaningful empty state/placeholder.

### 5. Navbar Ignores Dark Themes — 4 occurrences (sessions 7, 9, 42, 80)

`.db-navbar` has a hardcoded white background that doesn't respond to dark themes (tokyo-night, nord, grunge-dark). Creates a jarring white bar at the top of otherwise dark UIs.

**Fix**: Change `.db-navbar` background to use `var(--db-surface)` or equivalent theme token instead of a hardcoded color.

---

## Spec Generation Issues (29% of all faults)

These are LLM prompt/system-prompt improvements.

### 1. Overlay Components Generated Hidden — 9 occurrences

Modals, Sheets, Drawers, CommandPalettes, and ContextMenus are generated in their default hidden state. In a static screenshot context, this means the prompt's primary ask (e.g., "modal containing a form") renders as nothing.

**Fix for system prompt**: Add a guideline: "When the prompt's primary subject IS an overlay component (Modal, Sheet, Drawer, CommandPalette, ContextMenu), generate it in its open/visible state by adding a `data-open` attribute or equivalent."

**Fix for render engine**: Force-open overlay components during screenshot capture if they are the root or direct child of root.

### 2. Complex Layouts Category — Worst Performer (overall 3.35)

The "complex-layouts" category (sessions 41-50) has the lowest composite score. The LLM struggles with: nesting content inside Tabs (places it as siblings instead), combining overlays with forms, and building multi-panel app shells. Intent score drops to 2.5 — the LLM fundamentally misunderstands what's being asked.

**System prompt improvement**: Add explicit examples for "content inside tabs" and "app shell with sidebar + main" patterns.

### 3. Carousel Slide Content — 3 occurrences (sessions 38, 50, 67)

The LLM passes raw HTML strings (`<img src="..."/>`) as Carousel slide content instead of using proper DAUB component children. The strings get escaped and render as literal text.

**System prompt improvement**: Add: "Carousel slides must use children array with DAUB components. Never pass raw HTML strings as slide content."

### 4. Horizontal Scroll Misuse — 4 occurrences (sessions 46, 56, 84, 94)

When horizontal scrolling is needed, the LLM applies `flex-flow: wrap` to card containers, causing them to stack vertically instead of scrolling. It also wraps content in `ScrollArea` incorrectly.

**System prompt improvement**: Add: "For horizontal scrolling, use ScrollArea with direction:'horizontal' wrapping a Layout with direction:'horizontal'. The inner Layout must NOT wrap — set no wrap behavior."

### 5. Missing Prompt Elements — 14 sessions flagged "missing-content"

The LLM omits explicitly requested elements: avatars when "avatars" is in the prompt (session 27), question labels in surveys (session 17), Field wrappers around inputs (session 18). 14% of outputs are missing significant content the prompt asked for.

**System prompt improvement**: Add a self-check instruction: "Before outputting, verify every noun in the user prompt has a corresponding component in your spec."

---

## Theme Performance

| Theme | n | Avg Composite |
|-------|---|---------------|
| nord | 12 | 3.73 |
| tokyo-night | 7 | 4.07 |
| light | 15 | 4.12 |
| nord-light | 10 | 4.15 |
| github | 19 | 4.21 |
| material-light | 2 | 4.38 |
| bone | 26 | 4.50 |

Nord and tokyo-night underperform. The Navbar white-background bug disproportionately affects dark themes. Gemini also over-selects `bone` (26%) and `github` (19%) while underusing the theme palette — 7 themes were never used despite being available. The theme selection heuristics in the system prompt are being partially ignored.

---

## Category Performance

| Category | Composite | Weakest Dimension |
|----------|-----------|-------------------|
| complex-layouts | 3.35 | intent (2.50) |
| real-apps | 3.92 | layout (3.30) |
| responsive | 4.20 | layout (3.60) |
| theme-combos | 4.25 | layout (3.60) |
| edge-cases | 4.28 | layout (4.00) |
| data-display | 4.35 | layout (3.70) |
| marketing | 4.40 | layout (3.80) |
| forms | 4.44 | layout (3.67) |
| component-stress | 4.38 | layout (3.80) |
| dashboards | 4.50 | layout (3.20) |

Dashboards score 5.0 on intent, component, and data — but 3.2 on layout. This is entirely the render engine (8/10 dashboard faults are "render"). The LLM generates correct dashboard specs; the rendering breaks them.

---

## Automated Flags

| Flag | Count |
|------|-------|
| empty_containers | 17 |
| duplicates | 1 |
| orphans | 1 |
| render_errors | 1 |

17% of specs have empty containers. This is a spec-side issue — the LLM creates container elements (Layout, Card) without populating them with children.

---

## Priority Action Items

### Render Team — Immediate

1. **Fix container height / beige block** — Affects 16+ sessions. The preview container must expand to content height. This alone would shift avg layout score from 3.62 to ~4.0.
2. **Badge `align-self: flex-start`** — 4 sessions, trivial CSS fix.
3. **Navbar theme tokens** — 4 sessions, replace hardcoded white with `var(--db-surface)`.
4. **ChartCard empty state** — 3 sessions, render a placeholder or default chart.
5. **ScrollArea clipping** — Session 84 and others: ensure ScrollArea shows scrollbar and doesn't hard-clip content.

### Spec Team — System Prompt

1. **Overlay open-state for previews** — Add guideline for static screenshot context.
2. **Carousel children** — Prohibit raw HTML strings in slide content.
3. **Horizontal scroll pattern** — Document the correct Layout+ScrollArea combination.
4. **Tab content nesting** — Add explicit example showing children inside tab panels.
5. **Self-check instruction** — "Verify every noun in the prompt maps to a component."
6. **Theme diversity** — Strengthen heuristics or add "vary themes" instruction to reduce bone/github over-selection.

### Capture Pipeline

1. **Dynamic viewport height** — Measure content height after render and resize viewport before screenshot. This eliminates the entire class of "content below fold" bugs.
2. **Force-open overlays** — Inject JS to open all Modal/Sheet/Drawer/CommandPalette components before capture.
3. **Missing session** — Analysis has 99/100 rows. Identify and re-run the missing session.

---

## Fault × Score Matrix

|  | intent | layout | component | data |
|--|--------|--------|-----------|------|
| **none** (n=24) | 5.00 | 5.00 | 5.00 | 5.00 |
| **render** (n=26) | 4.65 | 2.92 | 4.92 | 4.96 |
| **spec** (n=29) | 3.66 | 3.55 | 3.72 | 4.41 |
| **both** (n=20) | 3.45 | 2.95 | 3.70 | 4.20 |

Render-fault items have near-perfect intent/component/data but collapse on layout. This confirms the render bugs are discrete, isolated issues — the specs feeding them are good.

Spec-fault items drag down all dimensions, especially intent (3.66) and component (3.72). The LLM is choosing wrong components and missing requested content.

---

*Generated from 99 analyzed sessions. Data: `results/analysis.csv`. Pipeline code: `generate.js`, `render-capture.js`, `analyze.js`.*
