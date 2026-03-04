# ROADMAP

## The Thesis

Software gets in the way. Every app you open, every menu you navigate, every settings page you hunt through — that's friction between what you want and what you get. The answer isn't better apps. It's fewer of them.

You describe what you need. The computer builds it. Purpose-built UI, generated on the fly, contextual to your moment. Not links. Not menus. Clean interfaces that respect UX laws, then dissolve when you're done.

Say "pizza" and get cards of nearby places with ratings, prices, and an order button. Say "track my spending" and get a categorized expense dashboard. The interface is the answer.

DAUB is the rendering layer for this future.

---

## Architecture

The stack builds progressively. Each layer enables the next.

| Layer | Status | What it does |
|-------|--------|--------------|
| `daub-classless.css` | **Shipped** (v3.0) | Plain HTML looks good. Zero classes needed. |
| `daub.css` + `daub.js` | **Shipped** (v2.9) | 76 class-based components, 40 theme variants. |
| JSON-Render spec | **Working** (playground) | AI outputs JSON, DAUB renders live UI. |
| React/JSX wrappers | Planned | `<DaubCard>`, `<DaubButton>` — typed components. |
| Intent Engine | Future | Natural language in, UI spec out, live render. |
| Agent Runtime | Future | Multi-agent system orchestrates APIs + UI. |

The bottom layers are infrastructure. The top layers are where it gets interesting.

---

## Where We Are (v2.9 → v3.0)

- **76 components** — buttons, cards, modals, tabs, drawers, data tables, and more
- **20 theme families** with 40 variants — from clean corporate to tactile grunge
- **Classless CSS layer** — just shipped. Drop in the stylesheet, write plain HTML, it looks good
- **AI Playground** — type a prompt, get a JSON spec, see live component preview
- **`llms.txt` + `llms-compact.txt`** — documentation formatted for AI agent consumption
- **Zero build step** — CDN-first, no bundler, no compile step, no config files

---

## Near-Term

### v3.1 — React Wrappers
Typed JSX components that wrap DAUB's CSS classes. `<DaubCard variant="elevated">` instead of `<div class="card elevated">`. Full TypeScript support, proper prop validation, IDE autocomplete.

### v3.2 — Streaming Render
Progressive UI construction during LLM streaming. Partial JSON arrives, partial UI appears. No waiting for the full response — components materialize as the model thinks.

### v3.3 — Layout Intelligence
The AI picks the right layout based on what the data looks like. A list of restaurants? Cards in a grid. A single article? Long-form reader. A comparison? Side-by-side table. The shape of the data determines the shape of the UI.

### v3.4 — Action Bindings
Components that do things. Buttons that POST. Forms that submit. Cards that link to real endpoints. The generated UI isn't just a picture — it's functional.

---

## Mid-Term Vision

**Intent Parser** — "I need to track my expenses" becomes a spending dashboard with charts, category breakdowns, and an input form. No wireframes. No product spec. Just the thing you asked for.

**Context Awareness** — Location, time of day, user history all inform what gets generated. Ask for "lunch" at noon near downtown and the UI knows what you mean.

**Adaptive Complexity** — Start simple. Show three options. As the user engages, reveal depth — filters, sorting, advanced settings. Complexity is earned, not imposed.

**Multi-Agent Backend** — One agent fetches data. Another decides layout. A third handles user actions. The UI is just the surface of a coordinated system underneath. Think OpenClaw-style orchestration, but the output is a live interface.

---

## North Star

**You describe what you need. The computer builds it. No apps. No navigation. No learning curve.**

- "Pizza" → cards of nearby places with ratings, ETA, order button
- "Track my spending" → categorized expense dashboard with input form and charts
- "Plan a trip to Tokyo" → itinerary builder with maps, hotels, flights, day-by-day
- "Help me write a cover letter" → editor with AI suggestions, tone controls, export to PDF

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
- **Persistence** — Should generated UIs be saveable? Shareable via URL? Version-controlled?
- **Offline** — Can the intent engine run with local models? WebLLM? ONNX in the browser?
- **Multi-modal input** — Can the system accept screenshots, photos, or sketches as input alongside text?
- **Trust** — When the system generates a "buy" button, how does the user know it's safe? What's the verification layer?
