# Code Generation Pipeline

All references are to `playground.html` unless noted.

## Overview

```
User prompt
    |
    v
[Phase 0: Component Picking] (parallel with layout analysis)
    |  chooseComponents() -> /api/choose -> Jev (~typesafe/jev-latest)
    |  One yes/no decision per component; picked ones get full props in the prompt
    v
[Phase 1: Streaming Generation]
    |  generate() -> buildMessages() -> streamFetch() -> SSE parse
    |  Progressive render every 300ms
    |  Continuation on truncation (max 2)
    |  Retry on parse failure (max 3) -> fallback model
    v
Spec rendered in preview iframe
    |
    v
[Phase 2: Interactivity Pipeline]
    |
    +-- Analyze -> Visual Check -> Route by complexity:
    |
    |   none -----> done
    |   trivial --> single-shot code -> verify loop -> done
    |   simple ---> plan -> parallel chunks -> assemble -> verify loop -> done
    |   complex --> plan -> parallel chunks -> retry failed -> assemble
    |                   -> test -> review -> verify loop -> done
    v
  Done
```

## Backend Proxy

`functions/api/generate.js` — Cloudflare Pages Function that proxies to OpenRouter.

- Default model: `openrouter/auto` (OpenRouter Auto Router picks a model per request)
- Pinned ids the proxy still accepts: `google/gemini-3-flash-preview`, `google/gemini-3.1-pro-preview`, `google/gemini-3.1-flash-lite`, `moonshotai/kimi-k2.5` (fallback path and cached clients)
- Passthrough params: `model`, `messages`, `max_tokens`, `reasoning` (`low` | `medium` | `high`, default `medium`), `response_format` (`false` turns JSON mode off)
- `cost_tier` (`low` | `medium`): only with `openrouter/auto`, sent upstream as `plugins: [{ id: 'auto-router', cost_tier }]`. Unset routes at roughly `low`. The playground leaves it unset on every call.
- `session_id` (`^[A-Za-z0-9_-]{1,128}$`): passed through so Auto Router keeps one chat on the same model
- Streams SSE responses back to the client. Each chunk carries `model`, the model Auto Router picked.

## Photo Proxy

`functions/api/photo.js`: `GET /api/photo?q=<1-6 words>&w=<16-2000>&h=<16-2000>[&i=0-9]` answers with a 302 to a CC0 or public-domain photo of `q`. The photos need no attribution, and no API key is required. The playground prompt does not emit these URLs yet; a later change wires that in.

- Sources, in order: Openverse (`license=cc0,pdm`, `source=rawpixel,wordpress,stocksnap,nappy`), then Wikimedia Commons CC0/PD search, then an inline DAUB placeholder SVG. Openverse images go through `api.openverse.org/v1/images/{id}/thumb/` (600px; `?full_size=true` when `w > 600`), so generated pages never hotlink the stock sites.
- Query ladder: Openverse matches every word, so a miss retries with the phrase before the first preposition and then drops leading words (`white leather sneaker` → `leather sneaker` → `sneaker`). At most 3 upstream calls per query.
- Cache: a named Cache API cache (`daub-photo-v1`) keyed by the normalised `q` stores the top 20 hits for 7 days (10 min for no match, 5 min for a Commons answer given while Openverse was slow or down). `w`, `h` and `i` pick from that list, so the same `(q, w, h, i)` gives the same photo. The 302 carries `Cache-Control: public, max-age=86400`.
- Pick rule: the `i`-th hit whose orientation matches the slot (landscape if `w >= 1.15h`, portrait if `h >= 1.15w`), otherwise the `i`-th hit.
- Failure handling: Openverse races a 3 s timer; if Openverse loses, Commons answers and the late Openverse result replaces the cache entry via `waitUntil`. A network error, 429, 5xx or timeout opens a 60 s per-isolate breaker. Commons has a 2.5 s timeout.
- Content filter: a `q` that names nudity or gore (`nude`, `naked`, `topless`, `porn`, `corpse`, ...) returns the placeholder with no upstream call. Openverse hits flagged `mature` or whose title or tags match those words are dropped, and so are Commons files whose title or categories match. Openverse's `mature=false` alone lets StockSnap's "Body Nude" through for `q=body`. The filter reads metadata only, so Commons can still return classical art or historical photos that carry no such words.
- Safety: the request never supplies a URL. `Location` must be https on `api.openverse.org`, `thumb.wikimedia.org` or `upload.wikimedia.org`. Invalid input returns the placeholder with `X-Photo-Status: invalid`, so an `<img>` never breaks. Responses send `Access-Control-Allow-Origin: *`, `Cross-Origin-Resource-Policy: cross-origin`, `Referrer-Policy: no-referrer` and `nosniff`.
- Rate limit: `RL_PHOTO` (60 req / 60 s per IP) runs on cache misses only and fails open. Over the limit, the proxy returns the placeholder with `no-store` and `Retry-After: 60`.
- Debug headers: `X-Photo-Status` (`hit`, `miss`, `miss-fallback`, `no-match`, `cached-empty`, `upstream-down`, `rate-limited`, `invalid`), `X-Photo-Source`, `X-Photo-License`, `X-Photo-Landing`.
- Tests: `tests/photo-proxy.test.mjs` (mocked fetch and Cache API).

## Phase 0: Component Picking

`chooseComponents(prompt, signal)` runs in parallel with `analyzeLayout()` and resolves before `buildMessages()`.

- Endpoint: `functions/api/choose.js` → OpenRouter `/api/alpha/decisions` (not chat/completions; Jev is a decisions model)
- Model: `~typesafe/jev-latest` (pinned server-side; clients cannot override)
- Request: `state = { request: prompt }`, one `noul` question per renderable component (core layout types excluded), each described by its one-line `COMP_PURPOSE` entry
- Picks: core set (`Stack`, `Grid`, `Text`, `Card`, `Button`, `Icon`, `Separator`) + every component with p(yes) ≥ 0.45 (`PICK_THRESHOLD`) + every type already in `currentSpec`
- Skipped when the message has attachments (images, web or Figma context): Jev only sees the typed text, so those requests use the full catalog
- Prompt: `focusedSystemPrompt()` / `focusedOpenuiSystemPrompt()` list full props for picked types and names only for the rest (~40% shorter system prompt)
- Cost/latency: ~$0.00025 and 300–550ms per call (65 questions)
- Fallback: any error, 4s timeout, abort, or empty pick → full catalog prompt (previous behavior)

## Phase 1: Streaming Generation (lines 3072–3203)

### Entry point

`generate()` (line 3072) — orchestrates the standard chat flow:
1. Attaches media (images, web contexts)
2. Sets UI state (loading, error vars)
3. Delegates to streaming logic

### Message building

`buildMessages(userPrompt, images, webContexts)` (line 2796) — assembles the system prompt + conversation context + attached images/web snapshots.

### Provider routing

Four stream functions handle different API formats:
- `streamDefault` / `streamOpenAI` / `streamAnthropic` / `streamOpenRouter`

All use `streamFetch()` (line 1857), a shared SSE parser.

In default mode the main stream sends `model: 'openrouter/auto'` and the chat's `session_id` (`mainGenOpts()`), with no `cost_tier` (the unset band), on the first request, on continuations and on retries. `newChatSessionId()` builds the id (`pg-` + 32 hex chars from `crypto.getRandomValues`) on page load and again on New Chat. `streamDefault()` records the last SSE `model` field, and the version card shows it as `via <model>`.

BYOK OpenRouter lists `openrouter/auto` first ("Auto (OpenRouter router)"). BYOK requests send neither `cost_tier` nor `session_id`.

### Rendering

- Progressive rendering every 300ms during streaming
- On `finish_reason: 'length'`: automatic continuation (max 2)
- On parse failure: retry (max 3), then fallback to the pinned `FALLBACK_MODEL` (`moonshotai/kimi-k2.5`), sent without `cost_tier` or `session_id`. The fallback gets its own 3 retries on the same pinned model.
- Format detection (`openui` vs JSON) caches only a decisive result. A first tick like `__theme` reads as `unknown`, so the timer tries again on the next tick, and each retry re-detects from its own text.
- Render guard: `renderElement()` wraps each renderer call in try/catch. A throwing element renders a `Couldn't render <Type>` notice that keeps its `data-spec-id`, and its siblings still render (its own children fall through to the orphan pass at the end of the page). `renderSpec()` logs the failures once per distinct set (`console.warn`) and shows the count in the status line when the line is free.
- Prop coercions: `toArr()` for list props (arrays pass through, `{items|data|rows|options|list: [...]}` unwraps, an object whose values are all objects becomes its values, a string, number or boolean becomes `[x]`, anything else becomes `[]`), `optArr()` for `RadioGroup`, `Select`, `ToggleGroup` and `CustomSelect` options (a bare string or number becomes `{label, value}`), `Kbd` key strings split on `+`, `chartBars()` for `{type, data, labels}` and `{labels, datasets}` chart objects, `chartNum()` for values like `"$12k"`, and `tableShape()` for a `{columns, rows}` object, a `{key: 'Label'}` column map, string columns (key = the label when any row has it, else its slug) and array rows; a scalar `columns` or `rows` (an unresolved variable name such as `'compareColumns'`) renders no header or row. Table cells print `0` and `false`. A `Sidebar` given flat nav items (`[{label, icon}]`) wraps them in one untitled section. A string `footer` on `Card`, `Modal` or `AlertDialog` is one id; footer ids that name no element are dropped, and with none left the component renders as if it had no footer (`Modal` and `AlertDialog` get their default buttons back). `daub-render.js` and `mcp/lib/renderers.js` apply the same footer and table rules. The preview receives serialized HTML, so `Checkbox`, `RadioGroup`, `Select` and `Slider` write their state as attributes (`checked`, `selected`, `value`) as well as properties. A `DropdownMenu` promotes a `Button` or `Link` first child to the trigger; any other first child renders inside the default trigger button. `List` string items render as titles (as `daub-render.js` does; several block-library specs use them), and `autoFixSpec()` wraps a string `children` in an array. Unknown-type notices keep their `data-spec-id`, so the orphan pass draws each one once. Valid props render byte-identical HTML.
- Parser: `daub-openui-parser.js` resolves a reference to a data statement (`cols = [...]`) wherever that statement sits in the file, so a forward reference reaches the renderer as data instead of a bare name. References to component statements stay string IDs. `functions/api/mcp.js` carries the same logic.

### JSON repair

`cleanJSON()` -> `JSON.parse()` -> `repairJSON()` fallback

### Blocking fallback

`runBlockingGenerate()` runs only when `streamFetch()` reports `no-stream` (the browser has no `ReadableStream`). `/api/generate` always answers with SSE, so the default path reads the whole body with `res.text()` through `parseSseResponse()` and sends `response_format: false` in openui mode. The result goes through `DaubOpenUI.detectFormat()` like the streaming path.

### Preview iframe

`buildIframeSrcdoc()` loads lucide from a pinned, integrity-checked URL:

```
https://cdn.jsdelivr.net/npm/lucide@0.576.0/dist/umd/lucide.min.js
integrity="sha384-b05ba3pt6xaC7F4r130arhf8cF18GH/gKu9JDz/NMf+BhLlBVwIWUdAZSpf1IWRZ" crossorigin="anonymous"
```

To bump it, fetch the exact file and hash it: `curl -sSL <url> | openssl dgst -sha384 -binary | openssl base64 -A`. The playground page (`unpkg.com/lucide@0.576.0`, same bytes and hash) and the MCP HTML export (`functions/api/mcp.js`, `mcp/lib/render.js`) use the same version. Stay on 0.x: lucide 1.x dropped the brand icons (`github`, `twitter`, `linkedin`, `facebook`, `youtube`, `instagram`, `chrome`, `figma`) that block-library specs and the Figma attach button use.

### Share links

The Share button copies `<origin><path>#s=<LZString payload>` (`https://daub.dev/playground#s=…` in production). The payload sits in the fragment, so it never reaches the server; long `?s=` URLs failed with HTTP 431 around 10KB. On load the playground reads `#s=` first and falls back to a legacy `?s=`, then clears both with `history.replaceState`. A `#s=` link pasted into an open tab arrives through `hashchange` and loads the same way.

Every shared spec renders inert: when it carries CustomHTML `js` or inline handlers (`_hasInlineCode()`), the preview drops the `js`, strips inline code in the frame, and the chat shows a "Run code" notice. The code runs only after you click it.

## Phase 2: Interactivity Pipeline (lines 3204–3635)

Triggered after the spec renders successfully in the preview iframe.

### Step 1: Analyze (line 3338)

`analyzeInteractivity(spec, signal)` (line 2123)

- Model: `openrouter/auto`, effort `low`
- Output: `{ needed, complexity, description, elements, scaffold }`
- Complexity levels: `none` | `trivial` | `simple` | `complex`

### Step 2: Visual Check (line 3351)

`selfCheck(spec, screenshotDataUrl, signal)` (line 2073)

- Captures screenshot via `capturePreview()`
- Sends screenshot + spec + LAYOUT_RULES to AI (`openrouter/auto`, effort `medium`; `visualDiff()` when the prompt had a target image)
- Returns fixed spec or unchanged

### Step 3: Complexity Routing (line 3373)

Four paths based on `_complexity`:

#### Path A: `none` (line 3379)

Skip all remaining steps, finish immediately.

#### Path B: `trivial` (line 3454)

1. Skip plan
2. `_singleShotPath()` -> `generateInteractiveCode()` (line 2177)
   - Model: `openrouter/auto`, effort `medium`
3. Skip test, skip review
4. Run verify loop

#### Path C: `simple` (line 3462)

1. Plan via `planCodeArchitecture()` (line 2341)
   - Model: `openrouter/auto`, effort `medium`
   - `stateInitProblem()` checks `sharedStateInit`: it must compile (`new Function`, never called) and carry no placeholder strings (`(seed`, `...)`, `TODO:`, `placeholder`; URL strings are exempt, and seed data such as `'todo'` passes). A failing value is dropped to `''` and logged with `dlog`.
   - If <= 1 chunk: fall back to single-shot
2. Execute chunks in parallel via `executeChunksParallel()` (line 2506)
   - Model: `openrouter/auto`, effort per chunk (`low` or `medium`)
   - If all fail: fall back to single-shot
3. Skip test, skip review
4. Assemble via `assembleChunkResults()` (line 2534)
5. Run verify loop

#### Path D: `complex` (line 3499)

1. Plan (same as simple)
2. Execute chunks in parallel
3. Retry failed chunks with `retryFailedChunks()` (line 2517)
   - Model: `openrouter/auto` (a fresh route, so often a different model)
4. Assemble chunks
5. Test via `runChunkTests()` (line 2633) — iframe postMessage, 2s timeout
6. Review via `reviewAndAssemble()` (line 2667)
   - Model: `openrouter/auto`, effort `medium`
   - Inputs: plan, assembled spec, conflicts, failed chunks, test failures
   - Returns reviewed/fixed spec (or null -> use raw assembly)
7. Verify loop

### Verify Loop (line 3392)

`_runVerifyLoop()` is a no-op stub. The `#pg-verify-loop` toggle, `verifyGeneratedCode()` and `retryCodeGeneration()` no longer exist.

## Model Summary

Default (daub.dev proxy) mode. No stage sends `cost_tier`, so every Auto Router call uses the unset band. Only the main stream sends `session_id`; helper stages skip it, so Auto Router routes each one on its own instead of pinning it to the main stream's model.

Benchmark (34 prompts, 116 outputs, two blind frontier judges plus a critic): the unset band drafted as well as `cost_tier: 'medium'` or better (+0.53 composite on prompts that rendered), at 3.4x lower cost and p90 21s vs 32s. Jev picks components, but Jev as a verifier did not raise blind-judged quality, so the pipeline runs no verify/repair cascade. The one measurable gain came from pages the renderer blanked; the render guard and prop coercions fix those at $0 (judges scored code-fixed pages 6.27 vs 6.28 for LLM repairs).

| Stage | Function | Model | Reasoning effort | `cost_tier` | `session_id` |
|-------|----------|-------|------------------|-------------|--------------|
| Pick components | `chooseComponents()` → `/api/choose` | `~typesafe/jev-latest` | — | — | — |
| Layout analysis | `analyzeLayout()` | `openrouter/auto` | low | — | — |
| Generate (main chat, continuations, retries) | `startStream()` → `streamDefault()` | `openrouter/auto` | server default (medium) | — | per chat |
| Fallback after 3 failed parses | `startStream(messages, FALLBACK_MODEL)` | `moonshotai/kimi-k2.5` | server default (medium) | — | — |
| Analyze interactivity | `analyzeInteractivity()` | `openrouter/auto` | low | — | — |
| Visual check | `selfCheck()` / `visualDiff()` | `openrouter/auto` | medium | — | — |
| Plan | `planCodeArchitecture()` | `openrouter/auto` | medium | — | — |
| Execute chunks | `executeChunk()` | `openrouter/auto` | per chunk (low / medium) | — | — |
| Retry failed chunks | `retryFailedChunks()` | `openrouter/auto` | per chunk | — | — |
| Single-shot code | `generateInteractiveCode()` | `openrouter/auto` | medium | — | — |
| Review | `reviewAndAssemble()` | `openrouter/auto` | medium | — | — |
