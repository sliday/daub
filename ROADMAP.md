# ROADMAP

## The Thesis

Software gets in the way. Every app you open, every menu you navigate, every settings page you hunt through — that's friction between what you want and what you get. The answer isn't better apps. It's fewer of them.

You describe what you need. The computer builds it. Purpose-built UI, generated on the fly, contextual to your moment. Not links. Not menus. Clean interfaces that respect UX laws, then dissolve when you're done.

Say "pizza" and get cards of nearby places with ratings, prices, and an order button. Say "track my spending" and get a categorized expense dashboard. The interface is the answer.

DAUB is the rendering layer for this future.

---

## What Makes This Different

**Zero ceremony.** Two files, CDN link, done. No bundler, no framework, no config. Classless CSS means even raw HTML looks considered. In a world of build pipelines, DAUB is refreshingly immediate.

**Opinionated about beauty.** Most component libraries are deliberately neutral — gray surfaces, utilitarian defaults. DAUB has a point of view: tactile surfaces, letterpress typography, real textures. 20 theme families, each with character. "Considered" isn't marketing — it's the design constraint.

**AI-native architecture.** Not a CSS framework with AI bolted on. The JSON-Render spec, MCP server, complexity-routed pipeline, 189-block RAG library, and `llms.txt` documentation were designed together. AI doesn't just *use* DAUB — DAUB was built for AI to use.

**Structured specs, not throwaway code.** v0 generates one-off Tailwind/React. Cursor produces code you maintain. DAUB generates structured JSON specs that AI can iterate on, validate, visually diff, and render — without a compile step. The spec *is* the UI.

**The rendering layer, not the whole stack.** DAUB doesn't replace your backend, your data layer, or your framework. It renders interfaces. Plug it into any stack — vanilla HTML, React, an MCP client, an AI agent. It's infrastructure for the intent-to-interface future.

---

## Architecture

The stack builds progressively. Each layer enables the next.

| Layer | Status | What it does |
|-------|--------|--------------|
| `daub-classless.css` | **Shipped** (v3.0) | Plain HTML looks good. Zero classes needed. |
| `daub.css` + `daub.js` | **Shipped** (v2.9) | 76 class-based components, 40 theme variants. |
| JSON-Render spec | **Shipped** (v3.5+) | AI outputs JSON, DAUB renders live UI. Full pipeline with complexity routing. |
| AI Playground | **Shipped** (v3.9) | 7-stage pipeline: analyze, scaffold, generate, selfCheck, verify, repair, visual diff. Figma input, mobile detection, complexity-based model routing. |
| MCP Server | **Shipped** (v3.8-3.9) | Remote edge server on Cloudflare. Prompt complexity scoring, tiered model routing with fallback chains. |
| React/JSX wrappers | Planned | `<DaubCard>`, `<DaubButton>` — typed components. |
| Intent Engine | In Progress | Natural language in, UI spec out, live render. Playground is the working prototype. |
| Agent Runtime | Future | Multi-agent system orchestrates APIs + UI. |

The bottom layers are infrastructure. The top layers are where it gets interesting.

---

## Where We Are (v3.13.0)

- **76 components** — buttons, cards, modals, tabs, drawers, data tables, and more
- **20 theme families** with 40 variants — from clean corporate to tactile grunge
- **189 pre-made blocks** across 34 categories with multimodal RAG retrieval
- **Block library QA audit** — all 189 blocks validated, screenshots regenerated
- **AI Playground** with full 7-stage pipeline — analyze, scaffold, generate, selfCheck, verify, repair loop, visual diff
- **Complexity-based model routing** — prompts scored across 6 dimensions, routed to tiered models with exponential backoff fallbacks
- **MCP server** on Cloudflare's edge — `generate_ui`, `render_spec`, `validate_spec`, `get_component_catalog` tools
- **Figma design import** — OAuth flow, screenshot capture, layout analysis fed into generation
- **Visual diff** — compare rendered output against uploaded target images for iterative refinement
- **Mobile-responsive generation** — auto-detects mobile app prompts and switches layout strategy
- **Content integrity guards** — `mergeSpecFixes`, `measureTextContent`, element-count guards, CustomHTML dedup
- **Case studies** — Dashrock, the first production deployment, documented
- **Theme switcher nudge** for first-time visitors
- **`llms.txt` + `llms-compact.txt`** — documentation formatted for AI agent consumption
- **Zero build step** — CDN-first, no bundler, no compile step, no config files

---

## Near-Term

### v3.14 — Action Bindings
Generated buttons that POST to real endpoints. Forms with submit handlers. Cards that link to live URLs. The gap between "pretty mockup" and "functional UI" — this is where it closes.

### v3.15 — Persistence & Sharing
Save generated UIs to shareable URLs. Version history for iterative refinement. Export to standalone HTML file. The generated interface outlives the session that created it.

### v4.0 — React Wrappers (if demand warrants)
Typed JSX components wrapping DAUB CSS. `<DaubCard variant="elevated">` with full TypeScript support, proper prop validation, IDE autocomplete. Only if community demand justifies the maintenance burden.

---

## Mid-Term Vision

**Intent Parser** — Partially built in the playground's analyze-generate pipeline. Needs formalization into a standalone module. "I need to track my expenses" becomes a spending dashboard with charts, category breakdowns, and an input form. No wireframes. No product spec. Just the thing you asked for.

**Context Awareness** — Location, time of day, user history all inform what gets generated. Ask for "lunch" at noon near downtown and the UI knows what you mean. Still future work.

**Adaptive Complexity** — Partially built. The complexity-routed pipeline already classifies prompts into tiers and adjusts generation strategy. Next step: extend this to the UI itself — start simple, reveal depth as the user engages. Complexity is earned, not imposed.

**Multi-Agent Backend** — Foundation laid. The MCP server is the first agent in the system. Next: one agent fetches data, another decides layout, a third handles user actions. The UI is just the surface of a coordinated system underneath.

---

## North Star

**You describe what you need. The computer builds it. No apps. No navigation. No learning curve.**

- "Pizza" -> cards of nearby places with ratings, ETA, order button
- "Track my spending" -> categorized expense dashboard with input form and charts
- "Plan a trip to Tokyo" -> itinerary builder with maps, hotels, flights, day-by-day
- "Help me write a cover letter" -> editor with AI suggestions, tone controls, export to PDF

The interface serves the moment, then it's gone. Next thought, next surface.

---

## Design Principles

These carry through from handcrafted components to AI-generated UI.

**No UI issues.** Generated interfaces must be correct. No overflow. No broken layouts. No accessibility violations. If the system can't render it properly, it shouldn't render it at all.

**UX laws respected.** Fitts's law, Hick's law, Miller's law — baked into generation rules. Touch targets are big enough. Choices are limited enough. Information is chunked properly. This isn't optional.

**Human-focused.** The UI serves the person, not the system. No metrics dashboards disguised as user interfaces. No dark patterns. No engagement traps.

**Progressive disclosure.** Start simple, reveal depth on demand. The first view should be immediately useful. Advanced features exist but don't compete for attention.

**Considered aesthetics.** DAUB's tactile, crafted feel carries through to generated UI. Textures, shadows, typography — these matter. Generated doesn't mean generic.

---

## Open Questions

- **Voice input** — Web Speech API or an external service? Browser support is spotty. Latency matters.
- **Offline** — Can the intent engine run with local models? WebLLM? ONNX in the browser?
- **Trust** — When the system generates a "buy" button, how does the user know it's safe? What's the verification layer?
- **Stateful UIs** — How to handle forms, wizards, and multi-step flows? The current pipeline generates static snapshots. What's the model for state transitions?
- **Automated quality testing** — How to test generated UI quality at scale? Automated visual regression across prompt categories?

### Resolved

- **Persistence** — Moved to near-term roadmap (v3.15).
- **Multi-modal input** — Resolved. Figma screenshots and image upload feed into the generation pipeline (v3.6-3.7).
- **MCP streaming** — Deprioritized. Stateless JSON-RPC responses work well for current use cases; streaming can be revisited when progressive rendering demands it.
