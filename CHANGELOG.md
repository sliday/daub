# Changelog

All notable changes to DAUB are documented here.

## v3.17.0

**Auto-temperature, block test suite, landing page refresh.**

- Feature: `DAUB.setTemperature('auto')` — auto-adjusts UI warmth based on time of day and estimated daylight hours for the current date (solar declination at ~45°N). Warm golden tones at sunrise/sunset, cool neutral at midday, candlelight warmth at night. Updates every 15 minutes.
- Feature: Auto toggle button in configurator panel next to the Temperature slider
- Feature: `tools/block-test.js` — 3-layer test suite (structural, render via Playwright, visual regression) for all 230+ block specs
- Fix: Text renderer handles duplicated tag/content (`tag:"h2", content:"h2"` no longer renders literal "h2" text)
- Fix: MCP `autoFixSpec()` server-side auto-corrects both swapped and duplicated Text tag/content
- Fix: MCP Text prop documentation clarified to prevent AI generation errors
- UI: Landing page hero simplified to "UI for AI"
- UI: GitHub stars counter with count-up animation in nav bar
- UI: json-render and OpenUI compatibility mentioned in spec format section

## v3.16.1

**Text renderer resilience — auto-corrects swapped tag/content props.**

- Fix: Text renderer auto-detects and swaps reversed `tag`/`content` props (e.g. `{"content": "h1", "tag": "Create Account"}` now renders correctly as `<h1>`)
- Fix: block spec improvements — simplified SVG illustrations to Icon components, improved carousel and gallery layouts

## v3.16.0

**Link component, 48 auth blocks, Icon renderer — 230+ blocks total.**

- Feature: new `Link` component — inline text CTA that inherits font size, renders as bold terracotta `<a>`. CSS class `.db-link`, renderer in `daub-render.js`
- Feature: new `Icon` renderer — Lucide icons via `data-lucide` attributes with size variants (xs/sm/md/lg/xl), inline-flex alignment
- Feature: 48 auth blocks — 15 login variants, 4 forgot-password flows, 26 signup screens, plus register/reset/social-login/two-factor
- Feature: all auth blocks use inline SVG data URIs for images (dashboard mockups, geometric patterns, charts)
- Fix: replaced all "Untitled UI" references with "Daub" branding across auth blocks
- Fix: CTA Download layout switched from broken horizontal Stack to Grid
- Fix: CTA With Form AvatarGroup migrated from children to `props.avatars` array
- Fix: renamed "Cta" to "CTA" in 7 block display names
- Fix: Icon vertical alignment in flex containers (inline-flex + align-items center)
- Fix: Link font-size/line-height inherit from parent for consistent inline text
- Refactor: 59 ghost sm Buttons → Link conversions across 46 blocks (auth + non-auth)
- Docs: updated component count 76→73, block count 189→230+ across all docs, meta tags, and AI files

## v3.15.4

- Fix: regenerate 31 block screenshots with aspect ratio constraints (min-height padding, max-height clipping)
- Fix: screenshot tool enforces min 0.3 and max 2.5 aspect ratios for consistent gallery display
- Fix: 6 unrenderable blocks (CommandPalette, Drawer, Lightbox, Modal, BottomNav) set to null screenshot

## v3.15.3

- Fix: block card image background changed to neutral #f1f0f0 for consistent tile appearance

## v3.15.2

- Fix: active tab text contrast in block gallery (white on terracotta)
- Fix: block card screenshots use contain fitting instead of cover

## v3.15.1

- Feature: block gallery with category tabs, card previews, and lz-string share links in demo page

## v3.15.0

**OpenUI Lang integration — 67% fewer tokens for AI-generated UI.**

- Feature: full OpenUI Lang pipeline — parser, system prompts, streaming, MCP tools
- Feature: `daub-openui-parser.js` — standalone streaming parser (vanilla JS, no dependencies)
- Feature: playground auto-detects OpenUI vs JSON format during streaming and renders progressively
- Feature: MCP `generate_ui` tool accepts `format: "openui"` for token-efficient generation
- Feature: new MCP tool `parse_openui` — converts OpenUI Lang code to DAUB JSON specs
- Feature: dual-mode system prompts (OpenUI Lang default in playground, JSON default in MCP)
- Feature: 135 TDD tests covering all 70 component types, streaming, error recovery, edge cases
- Fix: root selection when `__theme` precedes first component statement
- Fix: `response_format: json_object` conditionally skipped for OpenUI mode across all providers

## v3.14.6

**OpenUI streaming parser, playground mobile intent sync.**

- Feature: added `daub-openui-parser.js` — streaming OpenUI Lang parser with format auto-detection
- Feature: playground auto-detects OpenUI vs JSON format during streaming and renders progressively
- Fix: synced mobile intent regex in playground with backend (`bottom-nav`, `app shell` triggers)

## v3.14.5

**Agent skill, mobile design rules, README refresh.**

- Feature: added Agent Skill install section to README (`npx skills add sliday/daub`)
- Feature: mobile app design rules in MCP — BottomNav, touch targets, app shell patterns
- Fix: mobile intent detection expanded with `bottom-nav` and `app shell` triggers
- Chore: updated version badge and changelog reference in README

## v3.14.4

**Accordion polish — content padding and easing.**

- Fix: added top padding (`--db-space-3`) between trigger and content text
- Fix: reduced `max-height` from 50em to 20em for proportional easing feel
- Fix: switched to `cubic-bezier(0.4, 0, 0.2, 1)` easing for snappy open, gentle settle

## v3.14.3

**Hotfix — accordion animation for bare text nodes.**

- Fix: accordion `grid-template-rows: 0fr` technique broke when content was bare text (no wrapper element). Switched to `max-height`/`overflow` approach that works with any content structure.

## v3.14.2

**UX polish — navbar hover contrast, smooth accordion animation.**

- Fix: navbar hover text now uses `--db-ink` instead of `--db-charcoal` for visibility across all themes
- Fix: accordion open/close animates smoothly via CSS grid `grid-template-rows` transition (300ms ease) instead of abrupt `display` toggle
- Fix: separate AI docs into clickable pill links in quick-install
- Fix: wrap long URLs in quick-install code blocks

## v3.14.1

**Landing page polish — testimonial, install options, case study quote.**

- Fix: compact horizontal testimonial layout on landing page (avatar left, quote right)
- Feature: Marat testimonial quote added to case studies page
- Feature: replaced hero install snippet with quick-install grid after configurator (classless 1-line + full 2-line options with AI docs links)
- Removed: redundant code snippet from hero section

## v3.14.0

**Developer feedback batch — badge aliases, CSS-only tabs, docs, testimonial.**

- Feature: badge semantic aliases `--success` (= `--updated`), `--danger` (= `--error`), `--info` (= `--blue`) for consistency with alert naming
- Feature: `db-tabs--static` CSS-only tab variant using radio inputs — no JS required, ideal for React Server Components / Astro / SSR
- Docs: navbar responsive toggle mechanism explained in llms.txt (built-in at ≤640px, auto-initializes)
- Docs: stat card docs expanded with all slots (`__icon`, `__change--up/--down`, `--horizontal`)
- Docs: llms-compact.txt and components.json updated with new badge/tab variants
- Feature: testimonial section on landing page (Marat / Dashrock case study)

## v3.13.2

**Theme switcher nudge cleanup.**

- Removed: bouncing arrow SVG from theme switcher nudge tooltip — bubble and close button remain

## v3.13.1

**Roadmap refresh — positioning, architecture, and timeline update.**

- Feature: "What Makes This Different" section in ROADMAP.md and roadmap.html — zero ceremony, opinionated beauty, AI-native architecture, structured specs, rendering layer positioning
- Update: "Where We Are" bumped from v3.9 to v3.13.0 with shipped capabilities (189 blocks, QA audit, case studies, mergeSpecFixes, theme nudge)
- Update: Architecture stack in roadmap.html — added AI Playground and MCP Server as shipped layers (4 and 5), renumbered to 9 layers
- Update: Release timeline replaced fictional v3.1-v3.4 with actual shipped versions (v3.5, v3.8, v3.9, v3.11, v3.13)
- Update: Near-term roadmap refreshed — Action Bindings → v3.14, Persistence → v3.15
- Update: Resolved "MCP streaming" and "Multi-modal input" open questions
- Update: README "What is DAUB?" section now highlights AI-native positioning
- Update: Intent Engine status corrected to "In Progress" on roadmap.html

## v3.13.0

**Playground UI simplification and case studies.**

- Removed: Verify toggle from Playground chat toolbar — pipeline already makes per-step quality decisions
- Removed: `verifyGeneratedCode()`, `retryCodeGeneration()`, and `_runVerifyLoop()` verify/retry logic
- Feature: case studies page featuring Dashrock (first production use case)

## v3.12.0

**QA audit — fixed block rendering across all 189 blocks.**

- Fix: converted 170 blocks from flat property format to props wrapper — text was invisible in all flat-format blocks
- Fix: repaired 24 input elements in 18 blocks where duplicate JSON `type` key caused `Input` to parse as `email`/`password` component types
- Fix: List renderer now accepts plain string items (previously required `{title, icon, secondary}` objects)
- Fix: Field renderer now renders child elements (Input) instead of ignoring them and creating an internal-only input
- Enhancement: all 184 screenshots regenerated with corrected rendering
- Tool: `block-format-convert.js` — batch flat→props conversion
- Tool: `block-fix-input-types.js` — batch input type key repair
- Audit: `blocks/qa-results.json` with full QA trail across 189 blocks (108 PASS, 62 FLAG, 19 FAIL pre-fix)

## v3.11.0

**189 blocks across 34 categories — full taxonomy coverage with multimodal RAG.**

- Feature: expanded block library from 22 to 189 pre-made layout patterns across 34 categories
- Feature: 170-block taxonomy with variants covering navigation, hero, features, social proof, pricing, CTA, content, newsletter, FAQ, team, stats, blog, portfolio, contact, footer, auth, error pages, ecommerce, dashboard, forms, modals/overlays, timeline, how-it-works, integrations, banners, event schedule, media, comparison, app-specific, and misc
- Feature: 183 Playwright screenshots and 187 Gemini multimodal embeddings for RAG retrieval
- Feature: batch block generation toolchain (`block-batch-generate.js`) for taxonomy-driven generation
- Enhancement: all blocks are self-contained sections with realistic data — no cross-contamination
- Enhancement: updated MCP edge function BLOCK_INDEX with full 189-block catalog

## v3.10.0

**Block library with RAG-powered generation and design knowledge integration.**

- Feature: 22 pre-made block specs across 7 categories (landing, dashboard, forms, ecommerce, data-display, auth, mobile)
- Feature: multimodal RAG retrieval — Gemini embeddings + cosine similarity retrieves top-5 blocks as few-shot examples during generation
- Feature: condensed design knowledge injected into system prompt — 8pt grid rules, grouping, visual hierarchy, typography, color, component guidelines
- Feature: conditional landing page patterns — headline-awareness mapping, page formulas by product type, visitor monologue sequence, CTA rules — activated by keyword detection
- Feature: `get_block_library` MCP tool for browsing available blocks by category
- Feature: 148-block taxonomy JSON for future block generation reference
- Feature: block toolchain — generation, screenshots, embeddings, QA validation, index builder
- Enhancement: NavMenu supports vertical layout for footer link columns
- Enhancement: declarative state system for tabs, toggles, forms, counters, show/hide
- Enhancement: `buildSystemPrompt` accepts user prompt for conditional knowledge injection
- Fix: duplicate CustomHTML elements no longer shadow existing components

## v3.9.0

**Complexity-based model routing for MCP server.**

- Feature: prompt complexity scoring — 6 weighted dimensions (length, specificity, interactivity, multi-component, constraint density, creativity) classify prompts into SIMPLE/MEDIUM/COMPLEX/PREMIUM tiers
- Feature: tiered model selection — each tier routes to a primary model with two fallbacks, Google-first for multimodality
- Feature: exponential backoff retry — 500ms × 2^attempt, max 3 retries per model, max 2 fallback models on 429/502/503/504 or parse errors
- Feature: routing metadata in `generate_ui` responses — tier, score, dimensions, model used, attempt count, token usage
- Feature: graceful degradation — on total failure returns partial result with raw text and error context
- Enhancement: model tiers use verified OpenRouter pricing (Flash Lite → Flash → Pro → Sonnet 4.6)
- Fix: playground toolbar padding reduced for tighter layout

## v3.8.1

**MCP tools now return spec JSON + rendered HTML.**

- Fix: `generate_ui` and `render_spec` return both the json-render spec object and self-contained HTML (no more broken preview URLs)
- Enhancement: dedicated MCP section on daub.dev with install command, tool descriptions, and conversation example
- Enhancement: MCP tools documented in SKILL.md with allowed-tools and workflow guide
- Added: `daub-render.js` — spec-to-DOM renderer served from CDN for rendered HTML output

## v3.8.0

**Remote MCP server for AI-powered UI generation.**

- Feature: remote MCP server deployed on Cloudflare's edge network at `https://daub.dev/api/mcp`
- Feature: `generate_ui` tool — generate complete DAUB UI specs from natural language prompts via MCP
- Feature: `get_component_catalog` tool — browse all 76 components, props, themes, and spec format
- Feature: `validate_spec` tool — validate DAUB spec JSON with detailed issue reports
- Feature: `render_spec` tool — get playground preview URLs for any spec
- Enhancement: no API key required for MCP clients — uses server-side infrastructure
- Enhancement: stateless HTTP transport — works with Claude Code, Cursor, and any MCP-compatible client
- Setup: `claude mcp add daub --transport http https://daub.dev/api/mcp`

## v3.7.0

**Smarter generation: two-pass layout analysis and visual diff feedback.**

- Feature: `analyzeLayout()` — new pre-generation step that produces a structured layout brief (pattern, sections, components, spacing, structure) before the main LLM call, improving initial render quality for complex UIs
- Feature: `visualDiff()` — when an image is uploaded, the visual check step now compares the rendered output against the original target image and adjusts the spec to match more closely
- Enhancement: layout analysis runs only for new generations (skipped for modifications), adding ~2s overhead
- Enhancement: visual diff replaces selfCheck when a target image is available; selfCheck still runs for text-only prompts
- Enhancement: pipeline step labels reflect the mode ("Comparing with target…" vs "Visual check…")

## v3.6.2

**Bugfix: prevent visual check from destroying generated UIs.**

- Fix: tighten selfCheck prompt to only allow cosmetic tweaks (gap, padding, style) — never remove or restructure elements
- Fix: add element-count guard — reject fixes that drop more than 20% of components
- Fix: match chat and preview toolbar heights (min-height: 40px)

## v3.6.1

**Bugfix: prevent recursive iframe nesting.**

- Fix: clicking links inside AI-generated preview no longer navigates within the iframe — all links now open in a new tab via `<base target="_blank">`

## v3.6.0

**Figma design integration for playground.**

- Feature: Figma button in chat attach bar — click to connect via OAuth, then paste any Figma URL to extract design context (colors, typography, layout hierarchy, components)
- Feature: Figma OAuth flow — one-click "Connect Figma" via the Figma button, no personal access token needed
- Feature: New `/api/figma` Cloudflare Pages Function — proxies Figma REST API, extracts compact design specification (~5-7KB) from arbitrarily large files
- Feature: New `/api/figma-callback` — OAuth callback for token exchange with auto-refresh support
- Feature: Smart URL routing — pasting or entering a figma.com URL in the Link button auto-routes to Figma handler
- Feature: Paste detection — pasting a Figma URL auto-attaches the design if Figma is connected
- Feature: Figma screenshots captured and sent alongside design context to AI for visual matching
- Feature: Figma entries shown in chat bubbles with Figma icon
- Change: Figma-attached prompts always route through default DAUB AI backend (ignores custom key) — Fast and Verify toggles remain independent

## v3.5.2

**Clean toolbar UI with pill toggles + Star History.**

- UI: Removed Fast toggle from title bar — title bar now shows only "Chat" + "New Chat"
- UI: New options bar in chat footer with pill-shaped toggles for Fast and Verify
- UI: Fast pill features a zap-icon square that fills terracotta when active
- UI: Examples collapsible moved into options bar as a trigger button with rotating chevron
- UI: "Own Key" link right-aligned and de-emphasized
- UI: Examples row + separator auto-hide when chat has messages; toggles persist
- Docs: Added Star History chart to README

## v3.5.1

**Session-scoped chat state + visual check always runs.**

- Fix: Visual check no longer skipped in fast mode — it's cheap and catches layout issues early
- Change: Chat history and current spec moved from `localStorage` to `sessionStorage` — state persists across refreshes but clears when the tab closes, eliminating stale state issues during development
- Settings (provider, model, API keys, toggles) remain in `localStorage` as user preferences
- Docs: Added `PIPELINE.md` documenting the full code generation pipeline

## v3.5.0

**Complexity-routed pipeline + component type constraints (SLAG-inspired).**

- Feature: `analyzeInteractivity` returns complexity grade (`none`/`trivial`/`simple`/`complex`) — pipeline routes through optimized paths per tier
- Feature: `VALID_TYPES_HINT` constraint string built from `COMP_CATEGORIES`, injected into all pipeline stage prompts (`reviewAndAssemble`, `generateInteractiveCode`, `executeChunk`, `selfCheck`)
- Feature: Trivial interactivity (1-2 elements) skips plan/test/review — single-shot code gen only
- Feature: Simple interactivity (3-5 elements) skips review stage — plan + execute + verify
- Feature: Complex interactivity (6+ elements) runs full pipeline with all stages
- Enhancement: `_applySpec` now runs `validateSpec` + `autoFixSpec` on every spec application, auto-stripping unknown types and broken references
- Enhancement: Analyze step label shows complexity tier (e.g., `"Analyzed + scaffold [complex]"`)
- Bugfix: Pipeline cleanup (`_pipeFinish`, `setLoading(false)`) now fires for trivial/simple paths — Stop button and "Processing..." header no longer stuck

## v3.4.0

**Fast Mode — single-model toggle for all pipeline stages.**

- Feature: "Fast" toggle in Chat toolbar (checked by default) forces `gemini-3.1-flash-lite-preview` across all stages
- Feature: Per-stage reasoning effort adjustment — low for analysis/planning, medium for code generation/review
- Feature: Toggle state persists in localStorage across sessions
- Enhancement: When Fast is off, original multi-model routing applies unchanged (Pro for planning/review, Flash for execution, Kimi for retries)
- Affects: `generate`, `selfCheck`, `planCodeArchitecture`, `executeChunk`, `executeChunksParallel` retry, `generateInteractiveCode`, `reviewAndAssemble`

## v3.3.9

**Hard stop control + non-blocking input.**

- Feature: Stop button to abort running generation — AbortController cancels all active streams and pipeline fetch calls
- Feature: Input field stays active during generation — type a new prompt and press Enter to interrupt and start fresh
- Feature: Stop button appears during loading, hidden when idle; styled with terracotta accent
- Feature: Stopped bubbles get `--stopped` class with reduced opacity
- Enhancement: Signal threaded through `streamFetch`, all 4 stream wrappers, `parseSseResponse` callers, and pipeline functions (`selfCheck`, `analyzeInteractivity`, `planCodeArchitecture`, `executeChunk`)
- Enhancement: AbortError caught gracefully at every level — no console errors on user-initiated stop

## v3.3.8

**Shared state scoping fix, pipeline step skip corrections.**

- Bugfix: `parseStateDefs()` changed from `var x = val` to `window.x = val` — shared state variables now accessible across chunks in separate execution scopes
- Bugfix: `stepTest` now properly skipped in "no interactivity needed" and single-shot fallback paths (was hanging as active)

## v3.3.7

**Chat UI polish — auto-sizing textarea, wider response bubbles.**

- Enhancement: Textarea auto-sizes to content via `field-sizing: content` (modern CSS) with JS fallback
- Enhancement: AI response bubbles widened from 88% to 96% max-width; user bubbles stay compact at 80%
- Fix: Reset textarea height on "New Chat" click

## v3.3.6

**Pipeline TDD, token/timing stats, JSON repair hardening.**

- Bugfix: `executeChunk()` now calls `repairJSON()` on truncated JSON — matches pattern used by `selfCheck`, `reviewAndAssemble`, `planCodeArchitecture`
- Feature: `parseSseResponse()` returns `{ content, usage }` — captures OpenRouter token counts from final SSE event
- Feature: Pipeline steps show elapsed time and token counts via `._stats` span and auto-timing in `_mkStep` / `_pipeDone`
- Feature: Per-chunk progress displays token count when available (e.g. `✓ game-controls (2/3) · 847tok`)
- Feature: `runChunkTests()` — collects `test` fields from chunk results, executes them in sandboxed iframe, returns pass/fail results
- Feature: Iframe test handler — supports sync (throw = fail) and async (Promise) test functions with configurable timeout
- Feature: New pipeline step "Running tests..." between Execute and Review — shows pass/fail counts
- Feature: Test failures passed as context to `reviewAndAssemble()` for informed fixes (informational, not blocking)
- Enhancement: `executeChunk()` prompt now requests optional `test` field — JS function body validating acceptance criteria
- Enhancement: Token budget increased: trivial 2048→3072, low 4096→5120, medium 8192→10240
- Enhancement: Pipeline panel wider (`max-width: 600px`) for better readability

## v3.3.5

**LLM model taxonomy — task-based model routing across the pipeline.**

- Feature: Defined 5-tier model taxonomy: Planning/Reasoning (`gemini-3.1-pro`), Regular (`gemini-3-flash`), Regular fallback (`kimi-k2.5`), Quick/Granular (`gemini-3.1-flash-lite`), Decision Helper (`minimax-m2.5`)
- Change: `executeChunk()` default upgraded from `gemini-3.1-flash-lite` → `gemini-3-flash` for better code generation
- Change: `retryFailedChunks()` retry model changed from `gemini-2.5-flash` → `kimi-k2.5` (reasoning fallback)
- Change: `planRegressionDesign()` and `reviewAndAssemble()` upgraded from `kimi-k2.5` → `gemini-3.1-pro` (planning/review tier)
- Change: Backend default (`/api/generate`) upgraded from `gemini-3.1-flash-lite` → `gemini-3-flash`
- Change: `FALLBACK_MODEL` changed from `xiaomi/mimo-vl-7b-flash:free` → `kimi-k2.5`
- Enhancement: OpenRouter dropdown updated with taxonomy-aligned model list including MiniMax M2.5

## v3.3.4

**S-expression plan format, failed chunk retry escalation, collapsible pipeline steps.**

- Feature: `planCodeArchitecture()` now uses hybrid JSON+S-expression format — `:do` and `:proof` fields encode tasks concisely with structural intent and acceptance criteria
- Feature: `parseStateDefs()` converts S-expression state declarations `["(score 0)", "(running false)"]` → `var score = 0; var running = false;`
- Feature: `retryFailedChunks()` — when Gemini Flash Lite fails a chunk, retries with upgraded `gemini-2.5-flash` before escalating to Kimi review
- Feature: `_pipeCollapse()` — collapses completed pipeline steps into expandable "N steps completed" summary when ≥2 steps are done
- Enhancement: `executeChunk()` accepts optional `modelOverride` parameter for retry escalation
- Enhancement: Plan normalization — S-expr format (`state`, `wire`, `els`, `do`, `proof`) auto-converted to legacy format (`sharedStateInit`, `wiring`, `elementIds`, `description`) for downstream compatibility
- Enhancement: Pipeline progress messages show retry status: "Retrying 2 chunks with Flash…", "5/6 succeeded (1 retried)"

## v3.3.3

**Map-reduce code generation pipeline: plan → execute → review.**

- Feature: `planCodeArchitecture()` — Kimi K2.5 decomposes interactive UI tasks into independent chunks with effort levels (trivial/low/medium) and shared state declarations
- Feature: `executeChunk()` — Gemini 3.1 Flash Lite agents implement individual chunks in isolation; effort and max_tokens scale per chunk complexity
- Feature: `executeChunksParallel()` — Promise.all orchestrator runs all chunks concurrently with per-chunk progress callbacks
- Feature: `assembleChunkResults()` — client-side merge of chunk outputs into spec with conflict detection (multiple chunks touching same element)
- Feature: `reviewAndAssemble()` — Kimi K2.5 streaming review wires cross-chunk interactions, resolves conflicts, fixes broken refs
- Feature: Pipeline UI shows 6 steps: Analyze → Visual Check → Plan → Execute → Review → Verify
- Feature: Chunk progress shows completion status per chunk (e.g. "✓ chunk-timer (3/5)")
- Feature: Shared state injected as hidden `_shared_state` CustomHTML element; cross-chunk communication via `daub:stateChange` CustomEvent
- Enhancement: Graceful fallback chain — plan failure → single-shot, all chunks fail → single-shot, review failure → raw assembly
- Enhancement: Plan prompt sets chunk `effort` field so execution agents scale appropriately

## v3.3.2

**Pipeline UX: chat-inline step tracker, skeleton shimmer, Kimi JSON fix.**

- Feature: Pipeline steps displayed inside chat bubble as collapsible `<details>` — open while running, auto-collapses when done
- Feature: Each step has an SVG icon: search (analyze), code brackets (code gen), eye (visual check), checkmark (done), dash (skipped)
- Feature: Active step icon blinks; done steps show green checkmark with description; skipped steps are dimmed
- Feature: Skeleton shimmer (`db-skeleton`) applied to target elements in iframe preview during code generation
- Fix: Kimi K2.5 requests opt out of `response_format: { type: 'json_object' }` — backend now conditionally includes it (`response_format: false` to skip)
- Enhancement: Console logging for `analyzeInteractivity` and `generateInteractiveCode` — raw response preview, parse errors, success/failure

## v3.3.1

**Two-LLM interactivity pipeline for games, quizzes, and interactive apps.**

- Feature: `analyzeInteractivity()` — Gemini 3.1 Flash Lite classifies specs as needing custom JS (games, quizzes, calculators) vs static UIs (landing pages, profiles)
- Feature: `generateInteractiveCode()` — Kimi K2.5 (via OpenRouter) generates full CustomHTML nodes with JS/HTML/CSS for interactive specs
- Feature: Two-step pipeline wired into `generate()` — after primary spec renders, Gemini analyzes → if interactive, Kimi generates code → re-render → selfCheck
- Enhancement: `parseSseResponse()` shared helper extracts text from SSE responses (DRY refactor from selfCheck)
- Enhancement: Backend `/api/generate` now passes through `max_tokens` from request body (was hardcoded 16384)
- Enhancement: Status bar shows pipeline progress: "Analyzing interactivity…" → "Generating code…" → "Checking…"

## v3.3.0

**Iframe-isolated preview + prompt quality + auto-JS interactivity.**

- Feature: Preview now renders inside a sandboxed `<iframe srcdoc>` — complete CSS/JS isolation from playground chrome. Theme widget, CustomHTML JS, and CSS styles can no longer leak into the host page
- Feature: `buildIframeSrcdoc()` generates a self-contained HTML document with DAUB CSS/JS, lucide, html2canvas. Communicates via `postMessage` bridge (render, theme, scheme, screenshot, clear)
- Feature: `collectCustomJS()` extracts JS from all CustomHTML elements and executes them inside the iframe context
- Feature: `capturePreview()` now uses a postMessage round-trip — iframe runs html2canvas internally and posts back the data URL
- Enhancement: System prompt adds DENSITY & COMPLETENESS rules — 12-25 elements minimum, realistic data, proper page structure (header/nav/footer)
- Enhancement: System prompt adds INTERACTIVITY guidance — LLM now auto-generates hidden CustomHTML nodes with JS to wire interactive patterns (progress bars, tabs, counters, form validation)
- Enhancement: System prompt includes compact few-shot JSON example (contact form with JS validation wiring)
- Enhancement: `selfCheck` prompt now checks for missing interactivity and sparse UIs
- Removed: `diffUpdate`/`diffElement` incremental DOM patching (no longer applicable with iframe serialization; chat-context diff tracking remains)
- Removed: Complex MutationObserver theme scoping (`pgLockChrome`, widget UI fixups) — replaced with simple observe-and-forward to iframe
- Removed: html2canvas from parent page (now only loaded inside iframe)

## v3.2.8

**Add Image component + diff-tracking in chat context.**

- Feature: New `Image` component type for standalone images with `src`, `alt`, `width`, `height` props
- Feature: `computeSpecDiff()` computes structural diff between consecutive spec versions (added/removed/changed elements + meta)
- Feature: Chat context now includes a concise JSON diff summary of changes from the last iteration, helping the LLM understand spec evolution
- Enhancement: System prompt updated to document Image component and recommend it for standalone images

## v3.2.7

**Fix theme widget scoping via MutationObserver.**

- Bugfix: v3.2.6 override didn't intercept widget clicks (closure-bound internal functions). Replaced with MutationObserver that watches `<html>` attribute changes — when the widget sets a theme, the observer redirects it to the preview pane and re-locks chrome to `bone`

## v3.2.6

**Theme widget scoped to preview + Tabs children-as-panels.**

- Bugfix: Theme switcher widget targets preview pane only — playground chrome stays locked to `bone` theme
- Bugfix: Scheme switcher (Auto/Light/Dark) also scoped to preview only
- Bugfix: FOUC prevention script no longer applies user's saved theme to playground chrome
- Bugfix: Tabs renderer shows active panel based on `active` prop, not just first panel
- Enhancement: Tabs component spec now documents `children` as tab panel content — one child per tab, matched by order
- Enhancement: AI models now generate content inside Tabs children instead of as siblings

## v3.2.5

**Exhaustive specs + structured JSON output for visual QA generator.**

- Enhancement: System prompt now instructs exhaustive, production-realistic output — realistic data, 20-50 elements, complete page structures
- Enhancement: Gemini API uses `responseMimeType: application/json` for guaranteed valid JSON — no more markdown fences or preamble text

## v3.2.4

**Increase Gemini output budget for visual QA generator.**

- Enhancement: Bumped `maxOutputTokens` from 8192 to 32768 — complex layouts were being truncated
- Enhancement: Disabled thinking (`thinkingLevel: NONE`) to maximize output budget for JSON spec generation

## v3.2.3

**Handle "Divider" as alias for Separator.**

- Bugfix: Renderer now maps `Divider` → `Separator` so AI-generated specs using the wrong name render correctly instead of showing "Unknown: Divider"
- Enhancement: System prompt (playground + generate.js) now explicitly states to use "Separator", not "Divider"

## v3.2.2

**Remove raised surface from playground preview.**

- Bugfix: Preview pane no longer applies `db-surface--raised` — removes unwanted elevation/shadow that interfered with theme previews

## v3.2.1

**Visual QA fixes — rendering bugs found by automated 99-layout analysis.**

- Bugfix: Badge no longer stretches full-width in flex columns — added `align-self: flex-start; width: fit-content`
- Bugfix: Navbar border now adapts to dark themes — uses `var(--db-border, var(--db-sand))` fallback
- Bugfix: ChartCard body has `min-height: 200px` and `:empty` state with "No data" placeholder
- Bugfix: Skeleton background uses theme-aware `var(--db-skeleton-bg, var(--db-border))` instead of hardcoded `--db-cream-dark`
- Bugfix: Breadcrumbs `<ol>` wrapper now has flex layout for proper rendering when json-render wraps items
- Enhancement: BottomNav `--static` variant with `position: relative` for static/screenshot contexts
- Enhancement: ScrollArea adds `scrollbar-gutter: stable` for content overflow indication
- Tools: Removed non-existent "midnight" theme from visual QA generator
- Tools: Added system prompt guidelines — ban flex-wrap on app shells, mandate Avatar components, nest Tabs content, ban raw HTML in Carousel
- Tools: Render capture now forces overlays (Modal, Sheet, Drawer) open before screenshot

## v3.2.0

**Web Look + redesigned chat input.**

- Feature: New "Link" button — paste any URL to capture a screenshot + text content as AI context via Browserbase headless browser
- Feature: Backend proxy `functions/api/weblook.js` — creates browser session, connects via CDP WebSocket, extracts title, text (8k chars), and JPEG screenshot
- Feature: Web page screenshots appear as thumbnails in the attachment strip alongside images and PDFs
- Feature: Web context (page text + screenshot) automatically included in AI messages for page-aware responses
- Enhancement: Redesigned chat input — three labeled buttons (Image, File, Link) on the left, "Enter" hint on the right
- Enhancement: Textarea grows upward to 75% of chat panel height (was capped at 200px)
- Enhancement: Separate Image button for images-only, File button for images + PDFs
- Enhancement: Chat bubbles show web attachments as globe icon + domain name chips

## v3.1.1

**Add PDF file attachment support to playground.**

- Feature: Playground now accepts PDF files (up to 50MB) alongside images via the attach button
- Feature: PDF attachments display as file icon + truncated filename in the attachment strip and chat history
- Enhancement: Provider-specific PDF formatting — Anthropic `document` type, OpenAI/OpenRouter `image_url` passthrough
- Enhancement: Mixed attachments supported (images + PDFs together, up to 10 total)

## v3.1.0

**Replace Layout with Stack + Grid for unambiguous layout intent.**

- Breaking: `Layout` component is deprecated. Use `Stack` (flexbox) or `Grid` (CSS grid) instead
- Feature: `Stack` component — flexbox layout with `direction`, `gap`, `justify`, `align`, `wrap`, `container` props
- Feature: `Grid` component — CSS grid layout with `columns`, `gap`, `align`, `container` props
- Enhancement: `justify` (main-axis) and `align` (cross-axis) now match CSS terminology — no more `valign` or overloaded `align`
- Compat: Old `Layout` specs still render via automatic mapping to Stack/Grid
- Docs: Updated llms.txt, SKILL.md, and AI system prompt guidelines

## v3.0.20

**Add Layout align/valign props to eliminate spacer hacks.**

- Feature: Layout renderer now supports `align: "center"|"right"|"end"|"between"` for horizontal alignment and `valign: "center"|"end"` for vertical alignment in horizontal layouts
- Enhancement: AI system prompt explicitly prohibits spacer elements for centering, directing use of `align:"center"` instead
- Docs: Layout prop documentation updated with align/valign options

## v3.0.19

**Fix playground orphan duplication and diffUpdate missing new elements.**

- Bugfix: Orphan renderer now marks rendered orphan's descendants in the `rendered` set, preventing children of orphan containers (e.g. buttons inside a ButtonGroup) from being duplicated as standalone elements
- Bugfix: `diffUpdate` now inserts new elements added in a spec revision into their parent DOM node, instead of silently skipping them when no prior DOM element exists to replace

## v3.0.18

**Fix Temperature/Noise sliders not affecting page visuals.**

- Bugfix: `initSliders()` set `_dbInit` on temperature/noise sliders before `initTemperature()`/`initNoise()` could attach their CSS-variable handlers — sliders moved visually but never updated `--db-temperature`/`--db-noise`. Changed to dedicated `_dbTempInit`/`_dbNoiseInit` flags to avoid collision.

## v3.0.17

**Fix Temperature and Noise controls regression from v2.0.**

- Bugfix: Removed double-tinting `background` layer from `html::after` temperature overlay — the `linear-gradient` tint added in v3.0.16 caused over-saturated warm tones and had `calc()`-inside-`rgba()` browser compat issues
- Bugfix: Adjusted `backdrop-filter` coefficients to match v2.0 effective intensity (saturate `0.6`→`0.5`, sepia `0.18`→`0.15`)
- Bugfix: Dark theme `--db-texture-blend: soft-light` no longer clobbers texture-specific blend modes (e.g. metal `overlay`) — moved from CSS variable override to explicit `body::before` rules with correct source-order specificity

## v3.0.16

**Fix orphan element duplication during streaming + codebase audit fixes.**

- Bugfix: Stale orphan elements (overlays, pagination) no longer duplicate during streaming — previous-render orphans are cleaned up before re-scanning
- Bugfix: Removed redundant orphan scan from `diffUpdate()` — `renderSpec()` already handles orphan rendering after both full-render and diff paths
- Security: CORS on `/api/generate` restricted from wildcard `*` to `daub.dev` and `*.daub.pages.dev` origins only
- Bugfix: `renderTimer` interval now cleared before retry/fallback in streaming, preventing timer leak
- Fix: Version header in `daub.js` updated from stale "2.2" to 3.0.16
- Fix: `package.json` version bumped from 3.0.0 to 3.0.16
- Fix: `demo.html` and `roadmap.html` cache busters bumped from v3.0.5 to v3.0.16
- Cleanup: Removed ~100 unreferenced dev screenshots, reference files, and build cache (~47 MB)

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
