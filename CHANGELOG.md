# Changelog

All notable changes to DAUB are documented here.

## v3.0.16

**Fix orphan element duplication during streaming.**

- Bugfix: Stale orphan elements (overlays, pagination) no longer duplicate during streaming — previous-render orphans are cleaned up before re-scanning
- Bugfix: Removed redundant orphan scan from `diffUpdate()` — `renderSpec()` already handles orphan rendering after both full-render and diff paths

## v3.0.15

**Orphan overlay rendering + realistic playground prompts.**

- Bugfix: Overlay elements (Modal, AlertDialog, Sheet, Drawer) not in any parent's `children` array are now rendered as orphans appended to the preview root — fixes overlays never appearing when AI omits them from the tree
- Bugfix: Incremental diff updates (`diffUpdate`) also detect and render newly added orphan elements
- Enhancement: Playground example prompts rewritten to resemble real products (Stripe, Linear, Notion, Vercel, Dribbble style) with richer descriptions exercising overlays, sheets, alert dialogs, charts, data tables, and more components

## v3.0.14

**Component prop coverage + richer playground examples.**

- Enhancement: COMP_PROPS documents Input `type` (email, password, date, number, tel, url, search, time)
- Enhancement: COMP_PROPS documents Card `interactive` and `clip` props
- Enhancement: COMP_PROPS documents Button `icon-danger`, `icon-success`, `icon-accent` variants
- Enhancement: COMP_PROPS documents StatCard `horizontal`, Stepper `vertical` layout props
- Enhancement: COMP_PROPS documents DropdownMenu item `active` and CustomSelect option `selected`/`disabled`
- Enhancement: Card renderer applies `db-card--interactive` and `db-card--clip` CSS modifiers from props
- Enhancement: StatCard renderer applies `db-stat--horizontal` modifier from props
- Enhancement: Stepper renderer applies `db-stepper--vertical` modifier from props
- Enhancement: DropdownMenu renderer applies `db-dropdown__item--active` on active items
- Enhancement: CustomSelect renderer applies `--selected`/`--disabled` on options and shows selected value in trigger
- Enhancement: AI system prompt includes guidance for interactive cards, semantic input types, icon button variants, horizontal stats, vertical steppers, and CustomSelect usage
- Enhancement: Playground example prompts rewritten to exercise more component variety and new props

## v3.0.13

**Calendar: dynamic month navigation + date selection.**

- Feature: Calendar month navigation — prev/next buttons re-render grid with correct days-in-month and weekday alignment
- Feature: Outside days from adjacent months shown dimmed; clicking navigates to that month
- Feature: Day selection dispatches `db-date-select` CustomEvent with `{year, month, day}` detail
- Feature: DatePicker reuses Calendar renderer — updates trigger text on selection and closes dropdown
- Enhancement: Calendar renderer parses `YYYY-MM-DD` format for `selected` and `today` props
- Enhancement: `COMP_PROPS.Calendar` documents date format

## v3.0.12

**Overlay trigger system + code review fixes.**

- Feature: Generic `[data-db-trigger]` system — any element can open Modal/AlertDialog/Sheet/Drawer by target ID
- Feature: Button `trigger` prop — declarative overlay opening without CustomHTML JS hacks
- Enhancement: AI system prompt guides overlay usage: hidden by default, trigger prop, automatic DAUB behaviors
- Enhancement: Theme list in system prompt dynamically generated from `DAUB.THEME_FAMILIES` instead of hardcoded
- Fix: Anthropic streaming truncation — `message_delta` with `stop_reason: 'max_tokens'` now triggers auto-continuation
- Fix: BYOK modal uses `DAUB.openModal`/`closeModal` for proper scroll lock + focus trap
- Fix: `openModal` options use `textContent` instead of `innerHTML` for XSS safety
- Refactor: Consolidated duplicate `repairJson`/`repairJSON` into single `repairJSON(s, asString)` function

## v3.0.11

**Modal/AlertDialog footer children support + Tooltip fix.**

- Feature: Modal and AlertDialog now support `footer` prop — array of child IDs to render as footer buttons instead of hardcoded Cancel/Confirm
- Enhancement: Body content automatically excludes footer children, preventing duplicate buttons
- Enhancement: AI system prompt updated to guide `footer` usage for both components
- Fix: Tooltip initialization selectors corrected (`.db-tooltip-wrap` → `.db-tooltip`, inner `.db-tooltip` → `.db-tooltip__content`)

## v3.0.10

**Playground: CustomHTML now accepts children for DAUB component nesting.**

- Feature: CustomHTML supports `children` array — nest standard DAUB components (Button, Modal, Layout, etc.) inside CustomHTML containers
- Enhancement: Children render as real DAUB components with theming, diffability, and `data-spec-id` attributes
- Enhancement: `html` renders first, then children append after — both can be combined
- Enhancement: System prompt guides AI to use `children` for content and `html` only for truly custom markup (SVG, canvas, decorative elements)

## v3.0.9

**Playground: CustomHTML gains CSS support and preview-wide JS scope.**

- Feature: New `css` prop on CustomHTML — inject `<style>` rules for custom styling
- Feature: CustomHTML JS now receives `preview` as a second argument, enabling cross-component interactions via `preview.querySelector('[data-spec-id="..."]')`
- Enhancement: System prompt guides AI to prefer standard DAUB components and use CustomHTML only as an escape hatch for interactivity, animations, or custom widgets

## v3.0.8

**Playground: merged Structure panel into Preview as tabs.**

- Feature: Preview panel now has Design / Structure / Code tabs — 2-panel layout instead of 3
- Feature: Code tab shows rendered HTML source with monospace formatting
- Enhancement: Simplified layout — more horizontal space for chat and preview
- Enhancement: Toolbar buttons adapt per mode (viewport/share/download in Design, Copy JSON in Structure, Copy HTML in Code)
- Enhancement: Mobile bottom nav simplified to 2 tabs (Chat / Preview)
- Enhancement: Single resizable divider, cleaner collapse/expand behavior
- Change: API generate endpoint now passes `reasoning` parameter for supported models

## v3.0.7

**Playground: flicker-free streaming, Gemini 3.1 Flash Lite default.**

- Enhancement: Diff-only preview updates during streaming — no more full DOM redraws on follow-up prompts
- Enhancement: Progressive renders now diff against previous render instead of rebuilding from scratch
- Enhancement: Preview preserves scroll position and animations during streaming
- Enhancement: Existing preview stays visible on follow-ups (DOM only cleared on first generation)
- Change: Default built-in model switched from Gemini 2.5 Flash Lite to `google/gemini-3.1-flash-lite-preview`

## v3.0.6

**Playground: AI-driven theme selection from prompt content.**

- Feature: AI picks an appropriate DAUB theme based on prompt (dashboards → github, dark UIs → dracula, etc.)
- Feature: Users can request themes explicitly ("make it dark", "use nord theme")
- Enhancement: Theme applied to preview via `data-theme` on container — page UI unaffected
- Enhancement: Downloaded HTML includes `data-theme` on `<html>` element
- Enhancement: New Chat clears theme state

## v3.0.5

**Playground: multi-image upload, incremental diff rendering, UI polish.**

- Feature: Multi-image upload — attach up to 10 images per chat message with thumbnail strip
- Enhancement: Incremental diff rendering — follow-up prompts only re-render changed elements with flash animation
- Enhancement: Cleaner preview toolbar — icon-only buttons with proper grouping
- Enhancement: Historical chat bubbles show Revert button instead of Download
- Fix: Collapsed panel layout — added max-width constraint, blocked drag while collapsed

## v3.0.4

**Playground: share links, versioning, viewport toggle, image upload, custom HTML, download.**

- Feature: Share link — compress spec to URL via lz-string, paste to restore UI
- Feature: Version history — each generation tracked with timestamp, revert to any version
- Feature: Mobile/Desktop viewport toggle in preview panel (375px mobile view)
- Feature: Collapsible panel dividers with chevron indicators
- Feature: Image upload in chat — attach screenshots as base64 for multimodal prompts
- Feature: Download HTML — export current preview as standalone HTML file
- Feature: CustomHTML component — AI can generate raw HTML + vanilla JS using DAUB CSS classes
- Enhancement: Result bubbles show version number, timestamp, component count, revert/download actions

## v3.0.3

**Nav consistency & BYOK reset.**

- Fix: Synced navigation across all pages — added missing Roadmap link to demo.html and playground.html
- Fix: Normalized playground.html nav — added `role`/`aria-label` attrs, matched GitHub SVG to canonical
- Fix: "Use Free DAUB AI" now fully clears stored API keys from localStorage
- Fix: BYOK mode shows visible "Change / Remove Key" link instead of hiding it
- Fix: Updated stale `?v=3.0.0` cache busters to `?v=3.0.3` across all HTML pages
- Fix: Updated hero announcement badge and tagline on landing page to reflect v3.0.3

## v3.0.2

**Card media variant visual fixes.**

- Fix: Media card images no longer bleed past rounded corners — added `overflow: hidden` to `.db-card--media`
- Fix: Media card header content now has proper horizontal padding — added `.db-card--media .db-card__header` rule

## v3.0.1

**Roadmap nav fix.**

- Fix: Roadmap page nav updated to match index.html styling and links

## v3.0.0

**Classless CSS layer, ROADMAP, documentation expansion.**

- Feature: `daub-classless.css` — plain HTML looks good with zero classes. Drop-in classless layer for semantic markup.
- Feature: `ROADMAP.md` — public roadmap documenting the intent-to-interface vision, architecture layers, and near/mid-term plans.
- Feature: `llms-compact.txt` — condensed AI documentation for token-constrained contexts.
- Updated: `llms.txt` — expanded with classless layer docs, chip toggle semantics, badge variants, grid breakpoints.
- Updated: `daub.css` — classless CSS foundation styles, additional utility refinements.
- Updated: `daub.js` — initialization improvements for classless compatibility.

## v2.9.2

**Playground streaming & rendering fixes.**

- Fix: Structure tree now updates progressively during streaming — `refreshJsonTree()` called alongside `tryProgressiveRender()` on the 300ms render timer
- Fix: Checkbox icon in Playground renderer now renders correctly — added missing `fill="none"`, `stroke`, `stroke-linecap`, `stroke-linejoin` SVG attributes matching the demo markup

## v2.9.1

**Code review fixes — bugs, security, robustness.**

- Fix: Removed duplicate `.db-tooltip` class collision — old v1 tooltip system removed, v2 tooltip is canonical
- Fix: Six `init*` functions no longer stack duplicate `document` event listeners on repeated `DAUB.init()` calls
- Fix: Context menu positioning now uses `pageX/pageY` — correct when viewport is scrolled
- Fix: `initTexture`, `initTemperature`, `initNoise` now guard against duplicate click handlers on re-init
- Fix: `setAccent()` validates hex input — rejects invalid values that would produce NaN CSS vars
- Fix: Modal focus trap re-queries focusable elements dynamically and excludes `[disabled]` elements
- Fix: `propagateRadius` separated read/write passes to avoid layout thrashing
- Fix: Data table `border-collapse: separate` preserves `border-radius` rendering
- Fix: Vertical stepper connector uses `transform: translateY(-100%)` for reliable positioning
- Fix: Added `-webkit-text-size-adjust: 100%` for iOS Safari
- Fix: Dark themes now use deboss shadow direction (`0 1px 0`) for `--db-text-emboss`
- Fix: Documented `::after` pseudo-element override chain between texture overlay and loading spinner
- Fix: Removed invalid JSON-LD `SearchAction` from index.html
- Fix: Added `og:image:alt` to demo.html and playground.html
- Security: Pinned renderjson CDN to v0.6.0 with SRI integrity hash
- Security: Added `isSafeUrl()` guard for AI-generated image URLs in Card and Avatar renderers
- Security: API key input now has `autocomplete="off"`
- Security: Grid column layout from localStorage validated before CSS injection
- Improvement: StatCard icon rendering uses `createElement` instead of `innerHTML` for consistency

## v2.9.0

**Playground streaming & UX.**

- Feature: Tree view renders progressively during streaming via partial JSON repair — tree builds live as data arrives
- Improvement: JSON panel now tree-only — removed Code/Tree toggle
- Improvement: Chat prompt textarea auto-expands as you type, max-height 85% of panel
- Improvement: Landing page prompt cards — "Code This" button now first, "Copy Prompt" second
- Fix: "New Chat" now clears the Structure tree panel along with Preview
- Fix: Status text ("Rendering…", "Streaming…") moved above chat input to prevent layout shift
- Fix: Active nav links no longer change font-weight (was 500→600), preventing layout shift
- Cache-bust: `?v=2.9.0` query strings on CSS/JS assets

## v2.8.9

**Playground UX polish (superseded by v2.9.0).**

## v2.8.8

**Renderer spacing & data fixes.**

- Fix: Layout gap default changed from `space-4` (16px) to `space-2` (8px) — proper 8px rhythm for vertical/horizontal flows
- Fix: Layout gap clamped to 0-6 range (max 32px) to prevent oversized gaps from AI output
- Fix: DataTable cell values that are objects (e.g. Badge specs) now extract `label`/`text`/`content` instead of rendering as `[object Object]`
- Improvement: SYSTEM_PROMPT now documents spacing token scale (0-6) and recommends gap:2-3 for tight rhythm
- Cache-bust: `?v=2.8.8` query strings on CSS/JS assets

## v2.8.7

**Playground UI refinement.**

- Improvement: JSON panel renamed to "Structure" — consistent bold headers across all three panels (Chat, Structure, Preview)
- Improvement: Code/Tree toggle and Render button moved to toolbar — clean editor area
- Improvement: "Use Your Own Key" link moved next to Examples trigger for cleaner layout
- Improvement: Example chip prompts expanded to 10x longer, detailed UI descriptions (short pill labels preserved)
- Improvement: Preview empty state shows inspiring Eames quote instead of dashed placeholder border
- Improvement: Removed send button — Enter glyph (⏎) hint in textarea corner, Enter key to send
- Improvement: System prompt now instructs AI to use dummyimage.com for placeholder images instead of via.placeholder.com
- Feature: Retry + fallback — retries default model up to 3 times on JSON errors, then falls back to `xiaomi/mimo-vl-7b-flash:free`
- Fix: Renderer now handles `children` inside `props` — AI sometimes nests children in props instead of element level
- Fix: Proxy accepts optional `model` parameter for fallback routing
- Cache-bust: `?v=2.8.7` query strings on CSS/JS assets

## v2.8.6

**Playground & landing page polish.**

- Feature: "Code This" buttons on all 6 landing page prompt cards — opens Playground with prompt pre-filled and auto-generates
- Feature: `?prompt=` URL parameter support in Playground — enables deep-linking to pre-filled prompts
- Feature: "Try the Playground — It's Free" CTA below Minimal Example section with json-render attribution
- Improvement: Playground toolbar cleanup — removed sparkles icon, bold "Chat" label, BYOK mode shows "Chat · ProviderName"
- Improvement: JSON panel uses native `db-toggle--sm` for Code/Tree instead of custom styled buttons, removed "JSON Spec" label
- Improvement: Removed panel collapse buttons from Chat and JSON toolbars
- Improvement: Removed Playground footer (attribution moved to landing page CTA)
- Improvement: `max_tokens` increased from 4096 to 16384 across all 7 API call sites (Playground + proxy worker)
- Feature: Auto-continuation for large layouts — detects `finish_reason: "length"` and chains up to 2 follow-up prompts to complete truncated JSON
- Feature: `repairJSON()` — force-closes open brackets/strings on truncated responses as final fallback
- Improvement: `cleanJSON()` now strips JS-style comments (`//`, `/* */`) and trailing commas
- Improvement: Stronger system prompt — explicit JSON validity rules (no trailing commas, no comments, escaped strings)
- Improvement: Consistent bold toolbar headers (Chat, Preview) — same size, no icons
- Improvement: Square send button with send icon, larger chat input area (80px min-height)
- Improvement: Theme picker popover opens to the left when switcher is in bottom-right corner
- Feature: Chat result bubbles are clickable — expand to show DAUB component type chips with counts
- Cache-bust: `?v=2.8.6` query strings on CSS/JS assets

## v2.8.5

**Progressive streaming render + Card body spacing.**

- Feature: Progressive render now force-closes incomplete JSON during streaming — preview updates live as the AI generates, instead of waiting for completion
- Fix: Card body (`db-card__body`) now uses `flex-column` with `gap: var(--db-space-3)` for consistent vertical spacing between children
- Fix: Surface renderer now applies `border-radius: var(--db-radius-2, 8px)` inline to ensure rounded corners
- Cache-bust: `?v=2.8.5` query strings on CSS/JS assets

## v2.8.4

**Dynamic AI system prompt generation.**

- Feature: `SYSTEM_PROMPT` is now built dynamically from `RENDERERS` + `COMP_PROPS` + `COMP_CATEGORIES` at page load
- Feature: `COMP_PROPS` lookup — single source of truth mapping 67 component types to their props documentation
- Feature: `COMP_CATEGORIES` — 8-category grouping for organized AI prompt output
- Feature: `if (RENDERERS[t])` guard ensures only registered renderers appear in the prompt
- Refactor: Removed static ~3KB `SYSTEM_PROMPT` string — adding a new renderer now auto-updates the AI prompt
- Cache-bust: `?v=2.8.4` query strings on CSS/JS assets

## v2.8.3

**Structured output enforcement for AI Playground.**

- Feature: OpenAI/OpenRouter API calls now include `response_format: { type: 'json_object' }` to guarantee valid JSON output
- Feature: Anthropic API calls now include `output_config: { format: { type: 'json' } }` for JSON mode
- Feature: New `cleanJSON()` helper — robust client-side fallback that strips markdown fences and extracts JSON between first `{` and last `}`
- Refactor: All three parse locations (progressive render, blocking fallback, streaming onDone) use `cleanJSON()` instead of inline regex
- Cache-bust: `?v=2.8.3` query strings on CSS/JS assets

## v2.8.2

**Layout renderer gap spacing fix.**

- Fix: Layout renderer maps `gap` prop to DAUB spacing scale (`--db-space-N`) instead of raw pixels
- Fix: Grid layout gap uses direct `db-gap-N` class mapping (clamped 1–6) instead of broken division formula
- Fix: Flex layout gap defaults to `--db-space-4` (16px) when no gap specified
- Cache-bust: `?v=2.8.2` query strings on CSS/JS assets

## v2.8.1

**Playground renderer fixes and improvements.**

- Fix: Prose renderer now renders rich HTML content via DOMParser-based sanitizer instead of escaping tags as text
- Fix: Search renderer uses correct `db-search` class with `__icon` and `__clear` button
- Fix: Card renderer supports `footer` prop — children listed in footer render in `db-card__footer`
- Fix: StatCard renderer supports `icon` prop — Lucide icon in `db-stat__icon`
- Fix: Accordion items accept `children` array for rich nested content
- Fix: Layout gap snaps to valid DAUB gap scale (1-8) instead of producing non-existent classes
- Fix: Surface padding uses `var(--db-space-4)` instead of hardcoded `16px`
- Improved: DataTable badge regex expanded with 14 additional status words (draft, scheduled, live, archived, etc.)
- Improved: System prompt documents new Card footer, StatCard icon, Accordion children props
- Cache-bust: `?v=2.8.1` query strings on CSS/JS assets

## v2.8.0

**AI Playground page, json-render Generative UI, nav UX improvements.**

- New: `playground.html` — three-panel AI playground for json-render Generative UI with DAUB components
- Playground: 67 DAUB component renderers mapped to json-render flat spec format
- Playground: BYOK AI integration — OpenAI, Anthropic, OpenRouter with current model lists
- Playground: 5 pre-built templates (Dashboard, Login Form, Settings, Profile Card, Data Table)
- Playground: resizable panels with drag dividers, mobile/tablet bottom nav via `db-bottom-nav`
- Nav: larger clickable zones (`padding: 6px 12px`), active color indication with terracotta tint background
- Nav: added Playground link to index.html, demo.html, playground.html
- llms.txt: added json-render integration recipe with full component catalog mapping
- Cache-bust: `?v=2.8.0` query strings on CSS/JS assets

## v2.7.0

**Overlay skeletons, tooltip fix, dropdown alias, better warnings.**

- SKILL.md: overlay section now shows required HTML nesting structure (skeletons) — AI agents no longer guess wrong on overlays
- components.json: added `skeleton` field to all overlay/complex components for instant AI parsing
- llms.txt: added Quick Reference Skeletons table after Quick Start for scannable overlay structures
- CSS fix: `.db-tooltip` changed from `display: inline-block` to `inline-flex` — no longer breaks flex container sizing
- CSS: `.db-dropdown__menu` added as alias for `.db-dropdown__content` (all rules, glass texture)
- JS: `initDropdowns` now recognises `.db-dropdown__menu` as fallback for `.db-dropdown__content`
- JS: new dev-mode warning for `.db-dropdown` missing `__content` child
- JS: improved `.db-field` warning — now mentions input, textarea, select wrapper, or custom control
- JS: new warning for `.db-tabs` tab/panel count mismatch
- JS: new warnings for `.db-modal-overlay` missing `id` or `aria-hidden` attributes
- JS: modal id check moved from `.db-modal` to `.db-modal-overlay` (JS API targets the overlay)
- README: Lucide icons now "recommended" (was "not required"), version badge updated
- SKILL.md: added Notes section covering `db-field__input` usage, Lucide pairing, overlay BEM naming
- Cache-bust: `?v=2.7.0` query strings on CSS/JS assets

## v2.6.1

**npm publish, CDN discoverability, metadata sync.**

- npm: published `daub-ui@2.6.0` to npm — enables jsdelivr and unpkg CDN delivery
- package.json: synced to v2.6.0 (was stuck at v2.0.3), added `types`, `jsdelivr`, `unpkg` fields, expanded `keywords` and `files`
- CDN: added jsdelivr/unpkg install snippets to README.md and llms.txt Quick Start
- CORS: `_headers` now serves `Access-Control-Allow-Origin: *` on CSS, JS, JSON, and llms.txt for cross-origin CDN consumers
- Copy buttons: replaced custom CSS with DAUB's own `db-btn--ghost` and `db-btn--secondary` — readable on all themes
- ai-plugin.json: fixed component count 74 → 76 in `description_for_model`
- README: fixed component count 74 → 76
- index.html: added `<link rel="alternate" type="text/plain" href="/llms.txt">` for LLM discovery
- Cache-bust: `?v=2.6.1` query strings on CSS/JS assets

## v2.6.0

**Dashboard primitives, table utilities, getColor helper.**

- New component: `db-stat` — KPI/stat card with label, value, change indicator, icon slot; horizontal variant
- New component: `db-chart-card` — card wrapper for Chart.js canvas or db-chart with title/actions header
- Table utilities: `db-data-table--numeric`, `.db-numeric` (right-aligned), `.db-truncate` (ellipsis overflow)
- JS API: `DAUB.getColor(token)` — returns computed value of any `--db-*` CSS variable for chart lib integration
- `RADIUS_SKIP`: added `stat`, `chart-card` to prevent nested radius flattening
- llms.txt: synced new components, table utilities, getColor API, Chart.js integration recipe
- Updated component count: 74 → 76
- Cache-bust: `?v=2.6.0` query strings on CSS/JS assets

## v2.5.6

**Fix nested border radius flattening inner components.**

- `fixNestedRadius()`: added `RADIUS_SKIP` regex to skip DAUB form controls (buttons, inputs, selects, switches, avatars, badges, etc.) when propagating inner radius
- Previously, containers with `padding > radius` would flatten all child components to `border-radius: 0px`
- Structural sub-containers (card-in-card) still receive correct nested radius
- Cache-bust: `?v=2.5.6` query strings on CSS/JS assets

## v2.5.5

**Sample prompts & AI use cases.**

- Website: new "Copy. Paste. Ship." section with 6 sample prompts (dashboard, settings, catalog, task board, blog, onboarding) — each with copy-to-clipboard button
- Website: minimal 25-line code example showing a complete DAUB page
- README: "Use with AI" section with prompt table and minimal code example
- Cache-bust: `?v=2.5.5` query strings on CSS/JS assets

## v2.5.4

**Unified demo page header & version sync.**

- Demo page (`demo.html`) navbar: replaced custom `.demo-page-nav` with unified `.db-nav` component matching index.html (DAUB brand, Components, Layouts, AI Docs, GitHub links)
- Demo page FOUC prevention: now restores `db-scheme` and `db-accent` in addition to `db-theme`
- Demo page theme switcher: replaced hardcoded paint-roller SVG with empty `.db-theme-switcher` wrapper — daub.js auto-creates the v2.5 palette toggle with 20 families and category tabs
- Demo page footer: updated from "v1.1 — 28 Components, 4 Themes" to current version info
- Demo page responsive: added `overflow-x: hidden` on body, 640px nav breakpoint
- Cache-bust: `?v=2.5.4` query strings on CSS/JS assets across all pages
- Version sync: llms.txt updated from v2.3 to v2.5.4

## v2.5.3

**Letterpress fix, dark theme buttons, mobile layout audit.**

- `--db-on-accent` variable: new CSS custom property ensures text/icons on accent backgrounds are always visible in dark themes (#fff) instead of invisible dark `--db-white`. Applied to: primary buttons, checkbox checkmarks, pagination, stepper, toggle, calendar, bottom-nav badges. Passes WCAG AA large text (3.08:1)
- Letterpress text-shadow: reversed direction (`0 -1px 0`) for pushed-in emboss effect. Removed hardcoded dark theme emboss override — `--db-glow-rgb` now handles all themes dynamically. Boosted emboss opacity (0.4→0.5, 0.15→0.25)
- Primary button emboss: uses `rgba(var(--db-shadow-rgb), 0.35)` — always dark shadow for always-light text, correct letterpress across all themes
- Loading spinner fix: centered via `inset:0; margin:auto` instead of `transform:translate(-50%,-50%)` which conflicted with spin animation. Uses `--db-on-accent` for visibility. Text and text-shadow hidden during loading state
- Hero "verb" label: uses `--db-terracotta` (theme-aware accent) instead of `--db-terracotta-text` for visibility in all dark themes
- Mobile configurator (640px): theme picker tabs shrink, texture segment buttons wrap to 3×2 grid, reduced padding. Fixed popover `transform`/`left` offset leaking from mobile centering styles
- Responsive demo containers: all hardcoded `max-width` >300px clamped with `min(XXXpx, 100%)` to prevent overflow at 375px
- Cache-bust: `?v=2.5.3` query strings on CSS/JS assets

## v2.5.2

**Temperature control, letterpress text & bug fixes.**

- Temperature slider: replaces Warmth, range -100 (cold) to +100 (warm), default 0 (neutral). Negative desaturates + cool hue-rotate, positive adds saturation + sepia
- Letterpress text-shadow: primary buttons get deeper dark shadow (0.35 alpha), secondary buttons get light emboss via `--db-text-emboss-subtle`
- Loading spinner fix: texture `::after` no longer conflicts with spinner `::after` on `.db-btn--loading`
- Tooltip width fix: `width: max-content` prevents text squashing in narrow parent contexts
- Copy Config Code: upgraded to full-size primary CTA button using DAUB's own `db-btn` classes
- Texture multipliers boosted: grain 1.5x, paper 2.0x, metal 1.8x, wood 2.0x (up from 0.5-0.7x) for visible texture at moderate noise levels
- Cache-bust: `?v=2.5.2` query strings on CSS/JS assets

## v2.5.1

**Configurator polish & cache-bust.**

- Copy Config Code: full-width CTA button replaces small icon-only copy button for better visibility
- Elegant configurator: compact snippet (smaller font, tighter padding, 140px max-height), simplified preview card (avatar + chips + buttons only)
- CTA refinement: uppercase text, reduced spacing, 0.75rem font for cleaner look
- Cache-bust: `?v=2.5.1` query strings on `daub.css` and `daub.js` to ensure browsers load latest per-element texture and family/scheme API
- Cache-Control headers: CSS/JS now served with 5-minute `max-age` + `must-revalidate` to prevent stale assets

## v2.5.0

**Skeuomorphism & configurator redesign. 74 components, 20 theme families.**

- Letterpress text shadows: `--db-text-emboss` and `--db-text-emboss-subtle` CSS variables for crisp pressed-in type on headings, buttons, and labels
- Per-element texture overlay: `::after` pseudo-elements apply grain/paper/metal/wood texture to cards, buttons, navbars, modals, alerts, and surfaces
- Enhanced inner shadows: `--db-shadow-inset` adds bottom inner glow for realistic recessed surfaces
- Beveled edges: inset top-glow + bottom-shadow on cards, buttons, and raised surfaces for 3D lit-from-above effect
- Configurator redesign: tab-based theme selector (Originals/Classics/Modern/Trending), always-visible code snippet with integrated copy button
- Theme switcher: palette icon replaces paint roller, category tabs in popover, inline popover variant for configurator
- Texture system: body background texture + per-element texture with blend mode and opacity controls
- Fix: void elements (`<input>`, `<textarea>`, `<select>`) texture via wrapper elements instead of pseudo-elements

## v2.4.0

**20 theme families (40 variants) in 4 categories.**

- 14 new theme families: Dracula, Nord, One Dark, Monokai, Gruvbox, Night Owl, GitHub, Catppuccin, Tokyo Night, Material, Synthwave, Shades of Purple, Ayu, Horizon
- Theme categories: Originals, Classics, Modern, Trending — organized in `DAUB.THEME_CATEGORIES`
- Category API: `DAUB.getCategory('dracula')` returns category name
- Theme switcher: categorized popover with 3-segment accent swatches (light/accent/dark)
- Scheme row: Auto/Light/Dark toggle in theme switcher popover
- AI integration: `components.json` (74 components with HTML examples), `daub.d.ts` TypeScript declarations
- Backward compatible: all v2.3.0 APIs unchanged

## v2.3.0

**Layout system, navbar & developer experience. 74 components.**

- Navbar: sticky top app bar with brand, nav links, spacer, actions, and mobile hamburger toggle
- Grid 4/5/6 columns: `db-grid--4`, `db-grid--5`, `db-grid--6` with tablet breakpoint (1024px)
- Responsive visibility: `db-hide-mobile`, `db-show-mobile`, `db-hide-tablet`, `db-show-tablet`, `db-hide-desktop`, `db-show-desktop`
- Container variants: `db-container--wide` (1200px), `db-container--narrow` (640px)
- Card media variant: `db-card--media` removes padding for edge-to-edge images
- Chip active state: `db-chip--active` with `data-db-chip-toggle` container for filter chips
- Avatar group: `db-avatar-group` with overlapping stack and `__overflow` counter
- Search input: `db-search` with icon prefix and auto-show clear button
- Modal API: both `openModal` and `closeModal` now accept string ID or element reference
- Icon integration: `DAUB.refreshIcons()` helper for Lucide re-initialization after dynamic content
- Full-page recipes: Dashboard, Pinterest grid, and Settings form templates in llms.txt
- Data attributes reference: complete table of all `data-*` attributes in llms.txt

## v2.2.0

**Theme families + accent color picker.**

- Theme families: 6 families (Default, Grunge, Solarized, Ink, Ember, Bone) x light/dark = 12 variants
- Solarized theme: replaces Parchment with warm tinted / dusky amber palette
- New palettes: `solarized-dark`, `ink-light`, `ember-light`, `bone-dark`
- Scheme control: `DAUB.setScheme('auto'|'light'|'dark')` — separate from family selection
- Family API: `DAUB.setFamily('ink')`, `DAUB.getFamily()`, `DAUB.cycleTheme()` cycles 6 families
- Accent color picker: 12 curated natural colors + reset, persisted to localStorage
- `DAUB.setAccent(hex)` / `DAUB.resetAccent()` / `DAUB.getAccent()` API
- FOUC prevention: now restores scheme and accent color before paint
- Theme switcher: 3x2 family grid + 3-button scheme row (replaces 4x2 theme grid)
- Backward compatible: `DAUB.setTheme('dark')` still works directly
- Bug fixes: modal centering on all viewports, toast visibility in dark themes, sheet/drawer height consistency, tooltip positioning edge-case corrections

## v2.1.1

**"Daub" definition + housekeeping.**

- Hero: dictionary-style "daub" definition below the headline
- Fixed component count across meta tags, structured data, and showcase stats (64 -> 67)
- Updated JSON-LD version to 2.1.1

## v2.1.0

**67 components. Semantic tokens, ghost buttons, input icons, chips, bottom nav, sidebar collapse.**

- Semantic design tokens: theme-aware aliases (`--db-color-bg`, `--db-color-text`, `--db-color-accent`, etc.) that auto-resolve across all 12 theme variants
- Ghost button: transparent `db-btn--ghost` variant for subtle actions
- Icon button colors: `db-btn--icon-danger`, `--icon-success`, `--icon-accent` with tinted hover backgrounds
- Input with icon: `db-input-icon` with prefix/suffix icon positions and `:focus-within` highlight
- Chip/Tag: `db-chip` with 6 color presets and arbitrary HSL color support via `--db-chip-h/s/l`
- Bottom navigation: `db-bottom-nav` for mobile apps with badge support and safe-area padding
- Sidebar collapse: `db-sidebar--collapsed` mode with hover tooltips and `db-sidebar__toggle` button
- `DAUB.toggleSidebar()` JS API for programmatic sidebar collapse

## v2.0.3

**Noise texture, grunge corners & bug fixes.**

- Noise texture slider: adjustable grain overlay via `--db-noise` CSS variable with persistence
- Grunge themes: sharp corners (2-3px radius) for typewriter/rough aesthetic
- Vertical stepper: new `db-stepper--vertical` modifier for timeline layouts
- Primary button hover/active fix: `<a>` elements no longer lose white text on hover
- Tooltip wrapping: long text wraps gracefully instead of clipping
- Card overflow: `overflow: hidden` prevents child elements from bleeding
- Card border-radius uses `--db-radius-4` variable (theme-aware)
- Showcase panel radius uses CSS variables for theme adaptability

## v2.0.2

**Nested border-radius & card refinement.**

- Nested border-radius JS utility: auto-calculates `innerRadius = outerRadius - padding` for cards, modals, sheets, drawers
- Showcase frame: generous 36px radius with auto-computed inner radii
- Card border-radius: increased from 12px to 20px for softer, more premium feel
- `DAUB.fixNestedRadius()` exposed in public API for dynamic content

## v2.0.1

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

## v2.0.0

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

## v1.1.0

- Initial release: 28 components, 4 themes
