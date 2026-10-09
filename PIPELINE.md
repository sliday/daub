# Code generation pipeline

## Production flow

Hybrid is the only production generation path. Old `design=direct` and
`design=snowflake` URLs open the same Playground without a mode selector.
[Archived modes](docs/archive/playground-generation-modes.md) document Direct
and Recursive for research; they cannot run through the production UI. Saved
specifications and exports remain readable.

```text
Prompt -> structured design brief + acceptance contract
       -> validate screens, flow, bindings and journeys
       -> complete native design -> measured layout repair
       -> compile recipe or generate controller
       -> exercise journeys and inspect reached screens
       -> bounded correction -> preview and export
```

The strict contract includes `brief` in the existing planning response. It defines
scope, assumptions, screens/states, transitions, edge cases and public outputs.
Validation caps it at 14,000 characters, six screens, twelve transitions, six edge
cases and eight output fields. Initial screens name rendered target IDs; later
screens name a frozen journey whose final state exposes their anchors. Validation
adds explicit visibility assertions, and geometry checks inspect reached screens
at 390px and 1200px, including results. Repairs preserve the screen anchor IDs.

The chat renders the brief as escaped text in a collapsible section and preserves
it in saved specs. No additional model call plans or formats the document.
Edge-case references do not prove that a model chose adequate assertions; human
review still checks scope and semantic coverage. Browser evidence cannot certify
aesthetic quality.

All references are to `playground.html` unless noted.

## Historical Direct/Recursive overview

This overview records retired entry functions and is not the production flow.

`runDesignPipeline` serves Direct and Recursive. The sandbox executes the
`_shared_state` initializer once, then runs isolated chunk closures in that
initializer's lexical scope. `playground-quality.js` rejects non-JSON state
seeds and records initialization and event-handler errors. Invalid shared
initialization stops dependent chunks instead of running them without state.

Both simple and complex multi-chunk designs receive an assembly review. Chunk
prompts request interaction tests that assert visible results. The final runtime
check can request one code repair for observed errors, then checks again. The UI
reports unresolved errors or `Runtime checked; behavior needs review`; absence
of JavaScript exceptions does not establish working product behavior. Manual
interaction checks and rendered evidence remain part of release acceptance.
Late event-handler errors also update the saved conversation status. Cleanup
preserves code-only handler nodes, and exported scripts use literal replacement
callbacks so dollar sequences in generated JavaScript survive serialization.

```
User prompt
    |
    v
[Phase 0: Component Picking] (parallel with layout analysis)
    |  chooseComponents() -> /api/choose -> Jev (typesafe/jev-1.13-20260917)
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
    |   none -----> runtime check
    |   trivial --> single-shot code -> runtime check
    |   simple/complex --> plan -> parallel chunks -> retry failed -> assemble
    |                   -> test -> review -> runtime check
    v
  Done
```

## Hybrid implementation

Open `/playground.html`. Hybrid accepts text prompts through DAUB AI and
keeps `openrouter/auto` with strict schemas and required provider parameters.

1. Generate the design brief, requirements and browser journeys. Validate the contract, allowing
   one correction before freezing it. Compile missing `assertChanged` baseline
   snapshots before interactions; reject empty expected-text assertions and
   change assertions without an intervening action. Limit contracts to eight
   region requirements rather than enumerating a question dataset as screens.
   Freeze explicit initial fixtures, reject contradictory output assertions, and
   use named controls plus visibility checkpoints for conditional panels.
2. Design all planned screens in one native-component page. Validate child references and
   frozen contract bindings, allowing one correction before publishing the draft.
3. Inspect fresh sandbox frames at 1200px and 390px. Record geometry, required
   regions, overflow, clipped visible text/controls, render errors and broken images. Do not request a paid
   advisory review. Browser success verifies measured checks and journeys;
   it does not certify visual quality or aesthetic preference.
4. Propose up to three independent region repairs in parallel. Inspect candidates
   against the latest whole page in sequence. Accept a repair only when it resolves
   its target defect, introduces no new defect and retains passing checks.
   Send only the affected subtree, required bindings and read-only ancestor
   layout context. Deduplicate the same defect on an unchanged region across
   viewports and rounds; changed regions remain eligible for another repair.
   Preserve every recipe-bound item as well as the IDs used by requirements and
   journeys. Replacing a region cannot silently drop filter cards.
5. Generate one controller with JSON state, a reducer, a render function,
   tracked event bindings and an output function. Run the frozen journeys in fresh frames at both widths.
   Allow one behavior-only correction using observed failures. Keep that correction
   only if it removes defects without new failures or losing passing checks.
   Export the same tested controller. Keep the prior draft for measured regressions
   or runtime failures; report failing journeys as incomplete.

`playground-hybrid.js` caps a run at 18 model requests, two repair rounds, three
workers and 180 seconds. It reserves two requests for behavior and its correction,
and stops starting repair work in the last third of the time budget. In-flight
requests can still reach the deadline; the UI then retains the accepted draft.
Healthy static and recipe-backed pages need two model calls (contract and draft).
Custom behavior adds a third. Structured schemas travel in `response_format`;
the system message does not repeat their JSON. Planning asks custom journeys to
cover recovery or post-completion edits and keeps terminal output assertions
consistent with the final journey state.
Quota/auth/provider failures stop work; cancellation prevents late publication.
Each structured call can retry output truncation once with a 32,768-token ceiling
and a compact-response instruction. Both attempts share the existing request and
time limits. Truncated JSON never reaches the renderer. The chat shows the active
stage, elapsed time and received stream bytes instead of a static draft label.
`playground-hybrid-ui.js` owns provider and UI integration,
`playground-hybrid-checks.js` owns browser evidence, and `playground-behavior.js`
owns action -> state -> render and listener disposal.

`playground-behavior-recipes.js` compiles validated data and bindings into tested
quiz, radio-selection and card-filter controllers. Planning selects the recipe
and supplies its dataset. Before freezing the contract, the application builds
deterministic full-flow journeys from that descriptor. It validates compatible
bindings in the draft, then compiles behavior without another model request.
New quiz plans include separate question/results containers, a score, a text-only
answer review and Restart. The compiler swaps screen visibility and clears answers
on restart. Journeys cover completion, Back with preserved answers, and restart;
filter journeys separate empty results from restoration. New screen-based quiz
plans use at most 16 questions so screen assertions fit the 40-step bound. Larger
requested quizzes use custom generation without reducing the requested count.
Legacy six-binding quiz descriptors remain readable. Unsupported workflows use
custom generation.
The behavior response can also
choose `recipe: {kind, bindings, data}` with empty code strings, or `recipe: null`
with generated code for unsupported workflows. The compiler checks component
types and stable bindings; it never evaluates descriptor text as JavaScript.
Filters preserve existing cards and images. Exports embed the compiled controller
and need no recipe-module dependency. Cart, to-do and other workflows still use
generated code. Recipe scores are demonstration data, not validated assessments.

### Prototype outputs

Hybrid adds inline JavaScript after the layout checks. Its `program.output(state)`
function body returns a plain JSON object. The runtime publishes a detached
snapshot after rendering each accepted state transition. Invalid output or a
render failure clears the snapshot. It does not transmit or persist answers.
The runtime scopes a `[hidden]` display rule to its own preview so component CSS
cannot expose hidden errors or results. Disposal removes that rule.

Read the visible prototype from the Playground host:

```js
const result = await window.DaubPlayground.getOutput();
```

Read or subscribe within an exported prototype:

```js
const result = window.DaubPrototype.getOutput();
const unsubscribe = window.DaubPrototype.subscribe(result => {
  if (result?.completed) consume(result.answers);
});
// Call unsubscribe() when the reader no longer needs updates.
```

The host uses a source-checked, request-correlated iframe bridge. A preview
replacement invalidates pending reads. Uncoded drafts and consent-gated shared
pages return `null`; exports keep the controller and local output API. These are
JavaScript APIs, not server endpoints. Treat generated output as untrusted data.

Contracts distinguish `when: "initial"` from `when: "complete"` requirements.
Use `when: "present"` for conditional panels that must exist but can be hidden.
Journeys check those panels with `assertVisible` and `assertHidden` at the relevant
step, instead of requiring errors, recovery and success to coexist at completion.
Grouped button clicks need a unique visible label; checkbox groups accept exact
values or unique labels. The `fixtures` object defines a shared initial state for
the draft, controller and journeys. Numeric output assertions stay numeric; no
string coercion masks type errors. Function declarations with matching hook
parameters normalize to function bodies before sandbox execution.
Completion journeys set `complete: true` and run the whole flow before checking
the result panel. A ten-step quiz must contain ten questions, preserve selected
answers, and complete all ten steps. Its output includes `completed`, `step`,
`total`, `answers` (question ID, question and answer), and a result summary.
Frozen `outputAssertions` compare JSON values or array/string lengths through
safe dot-separated paths. For example, `answers` length `10` and `completed`
equals `true` prevent a first-screen-only demo from passing completion checks.

Limits: model-authored journeys do not establish full product coverage. Browser
probes cannot judge aesthetic quality or overall composition. Hybrid performs
at most one behavior correction and reports remaining failures. Passing automated
checks still requires human design review.

After coding, Hybrid also smoke-tests up to six initially visible native Button
elements per viewport that the frozen journeys do not click. Each test starts
in a fresh sandbox and checks for a visible or output-API response. A listener
or dispatched action alone does not count. These checks share the existing single
behavior-repair attempt; healthy pages need no additional model request. A repair
cannot remove an action from coverage by hiding or disabling it. Recipe-backed
pages retain the no-coding-call path and report extra-action failures for review.
Evidence records selected, skipped and unprobed actions. This bounded initial-state
check does not prove the meaning of a response, external effects, or later states.

## Historical implementation notes

The remaining sections describe retired behavior for reference. Their selectors,
entry functions and rollout instructions do not apply to the production Playground.

### Recursive design experiment

In the native playground chat, select **Recursive (experimental)** or open
`/playground?design=snowflake`. Direct remains the default. This experiment accepts
text prompts through DAUB AI; attachments, own-key providers, and the experimental
React chat use the Direct path.

The Playground uses `playground-snowflake.js` with `scheduling: 'queue'`:

1. Generate a complete minimal native page, including its requested content and
   controls, then render it. Choose regions from the task; do not prescribe a
   sidebar for a form or quiz. The client enables `completeLayout: true`.
2. Measure the rendered regions and ask Jev which ones need detail.
3. Refine up to three independent regions concurrently from their judged snapshots.
   Merge each accepted subtree into the latest spec and publish it before waiting
   for the remaining regions. Validate the graph, component types, IDs, existing
   content, and sibling boundaries before rendering. New IDs use a region prefix.
4. Recheck each finished region and enqueue its children without waiting for slow
   siblings. A FIFO queue gives waiting regions a turn before new descendants.
   Audit ancestors after the queue drains before reporting completion.
5. Run one serialized full-page reconciliation (`reconcile: true`), even when
   Jev reports no missing detail. Supply the request, current spec, screenshot,
   geometry and unresolved regions. This pass may remove duplicates, replace
   component types and reorder children while preserving the root ID. Validate
   the replacement, then recheck the root with Jev and the empty-region audit.

The module retains its old shell-first behavior unless callers enable these
options. Parallel branches still cannot remove siblings or change existing
types. Hybrid mode can repair a rejected branch once with its validation error
and a fresh snapshot; repairs share the existing deadline and request budget.
The initial complete-page request also gets one validation-guided repair for
local decoding or semantic errors. Provider errors, refusals, empty responses
and token-limit endings do not trigger that repair.

Generator and Jev jobs share three async worker slots, configurable through
`concurrency` from 1 to 4. These are concurrent network jobs, not browser threads.
The toolbar reports active and queued jobs. Preview publication and geometry
capture share a serial lock; provider calls run outside that lock. Each queued
refinement retains its own spec and geometry snapshot. The `level` scheduler
remains available for callers that require a barrier between levels.

The generator uses the existing `/api/generate` proxy and Auto Router. The judge
uses `/api/refine-judge`, which batches independent `noul` questions through the
existing Jev Decisions helper. Each question receives the original request, the
current spec, target ID, depth, and optional measured geometry. The generator also
receives geometry from its judgment snapshot. During measurement, the client
temporarily renders hidden mobile previews inside the viewport with zero opacity
and no pointer events, then restores their display state. This avoids Chromium
suspending offscreen screenshot work. Geometry-only captures skip screenshot
reconstruction. Jev returns a
probability that the target needs more detail; the provisional threshold is 0.65.
This threshold needs evaluation across prompt families before default activation.

Recursive design, reconciliation, subtree, and spacing generation require strict JSON Schema
responses. The proxy forwards the schema and sets `provider.require_parameters`
so providers cannot ignore the requested format. It does not retry without the
schema when no compatible endpoint exists. Existing Direct/OpenUI calls retain
their explicit text format; other JSON calls require JSON-mode support.

The wire schema uses an element array with IDs and property name/value entries.
Nested property objects use an `entries` array, allowing strict closed-object
schemas without restricting component-specific keys. The client decodes this
format into the existing ID-keyed spec before graph and content validation.
It rejects duplicate IDs/properties and schema violations. Refusal, empty output,
and token-limit endings stop the call with distinct messages, even if partial
output parses as JSON. Structured output does not replace semantic validation or
guarantee completion within a provider's token budget.
Recursive generation requests `reasoning.effort: "none"`: these bounded steps
should produce output instead of spending the request deadline on thinking.
The client rejects streams without a finish reason or completion marker, even
when the connection closes with HTTP 200. Auto Router and strict schemas remain
required; the client does not retry a failed request without those constraints.
For the exact HTTP 400 rejection that reasoning cannot be disabled, the proxy
retries once with provider-default reasoning. It keeps the model, strict schema,
parameter requirement, cancellation signal and original 60-second deadline.
Other 400 errors, quota errors and rate limits do not trigger this retry.

The client allows 24 model requests, 160 elements, 12 targets per judge batch, a maximum
depth of 5, and two minutes per run. Generator and judge calls share the request
budget. An invalid subtree response marks that region incomplete while siblings
continue. Quota responses, authentication failures, and rate limits stop the run
without retries. Cancel pending requests before returning on a global stop.
The UI retains the last valid preview and distinguishes completion from a limit
or failure. Stop and New Chat cancel pending work. Completed Recursive designs
enter the same interactivity pipeline as Direct. A partial or no-progress result
with no empty layout regions can also receive behavior; it retains the unresolved
refinement status. Provider errors, empty designs and limit stops skip this stage.
Branch progress appears in the chat and preview. Placeholder styling stays out
of saved specs and exports; measured geometry marks placeholder regions so the
judge can distinguish their reserved space from finished content.
Empty regions show theme-aware skeletons: compact header/footer rows, sidebar
navigation rows, and content blocks. Running regions pulse unless reduced motion
is enabled. The pulse changes opacity only and does not invalidate geometry
captures. Failed regions remain static; the chat retains their failure status.
Child groups with more than 12 targets use multiple queued judge batches.

After refinement, the client measures the full layout and asks Jev to check
vertical rhythm, horizontal gutters, and alignment. This spacing pass has its own
30-second deadline and at most three model calls: judge, one repair, and rejudge.
It skips runs that hit the overall time limit or fail with a provider error.
The design and spacing limits total 27 calls and 150 seconds, excluding the
shared behavior pipeline. Stop and New Chat cancel this
pass too. Direct mode includes spacing in its existing visual-check prompt.

Spacing review requires stable, complete geometry for up to 160 elements.
The judge evaluates rendered gaps, grouping, and intentional touching rather
than requiring uniform spacing. Repairs may change only existing Stack/Grid
`gap` and `align`, or Stack `justify`. Content, child order, types, state, and
theme remain unchanged. The client remeasures accepted repairs before reporting
`Spacing checked`. Remaining defects produce `Spacing needs another pass`;
missing measurements, invalid repairs, or a deadline produce `Spacing not verified`.
These outcomes do not turn an incomplete recursive run into a completed one.

The judge requires `RL_GENERATE` or an exact HTTPS host configured through
`REFINEMENT_WAF_HOST` with verified WAF protection. Pages production uses
`daub.dev`, covered by rule `11f49e0921004fadadd390d497f5d789` (60 API requests
per 10 seconds per IP/colo, verified 2026-10-07). Preview hosts fail closed.
A configured but failing limiter never falls back to WAF. Local development may
set `ALLOW_LOCAL_REFINEMENT=true` only on a loopback request host.
Configure and verify production rate limiting before enabling the endpoint. The
client budget alone does not constrain direct API callers or total monetary cost.
The endpoint rejects cross-origin browser requests, invalid graphs, oversized
bodies, and missing decision scores. It never accepts a client model or API key.

Tests: `tests/playground/snowflake.test.mjs`,
`tests/playground/snowflake-spacing.test.mjs`,
`tests/playground/snowflake-browser.test.mjs`, and `tests/refine-judge.test.mjs`.

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

## Smart Quota

`functions/api/smart.js` holds the daily budget for the playground's Smart mode: 10 runs per caller per UTC day. The Smart pipeline and its toggle ship in a later change; this endpoint only counts.

- `GET /api/smart` → `200 { limit: 10, used, remaining, resetAt }`. Read only.
- `POST /api/smart` → `200 { granted: true, remaining, resetAt }` and spends one run, or `429 { granted: false, remaining: 0, resetAt }` with `Retry-After` in seconds. No request body.
- Untrusted browser origins cannot spend quota: POST returns `403 { granted: false, reason: 'forbidden' }` before accessing KV. Same-origin local development and non-browser callers remain supported.
- `resetAt` is the next UTC midnight (ISO 8601). Responses send `Cache-Control: no-store`. `OPTIONS` answers the CORS preflight; other methods get 405.
- Storage: KV binding `SMART_QUOTA` (namespace `DAUB_SMART_QUOTA`, declared in `wrangler.toml`). Key `q:<yyyy-mm-dd>:<sha256(salt|day|caller)>`, value the count as a string, `expirationTtl` 30 h. The raw IP never reaches KV. The caller is `CF-Connecting-IP`; IPv6 addresses count per /64. The optional `SMART_QUOTA_SALT` secret replaces the public default salt.
- Fail closed: a missing binding or a KV error returns `503 { granted: false, reason: 'unavailable' }`. Future Smart callers must stay in normal mode on failure; no frontend calls this endpoint yet.
- Limits of the design: KV is eventually consistent and takes about one write per second per key, so concurrent POSTs can exceed 10. This is a UI budget, not server-side enforcement of model spending.
- Before enabling Smart, verify the namespace binding and configure `SMART_QUOTA_SALT`. The public default permits guessing IP hashes. Verify WAF protection for `/api/*` (60 requests / 10 s per IP, 10 s block) and restrict unprotected Pages hostnames. The current binding shares quota between previews and production; isolate preview storage before Smart preview testing.
- Tests: `tests/smart-quota.test.mjs` (in-memory KV, mocked clock).

## Phase 0: Component Picking

`chooseComponents(prompt, signal)` runs in parallel with `analyzeLayout()` and resolves before `buildMessages()`.

- Endpoint: `functions/api/choose.js` → OpenRouter `/api/alpha/decisions` (not chat/completions; Jev is a decisions model)
- Model: `typesafe/jev-1.13-20260917` (versioned id pinned server-side; clients cannot override)
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

### Step 2: Visual Check

`selfCheck(spec, screenshotDataUrl, signal, geometry)`

- Calls `capturePreview({ geometry: true })` to collect a screenshot and layout measurements inside the sandboxed preview iframe. Screenshot-only callers can still use `capturePreview()`.
- Sends screenshot + spec + LAYOUT_RULES + stable geometry to AI (`openrouter/auto`, effort `medium`; `visualDiff()` receives the same geometry when the prompt had a target image).
- Reports up to 80 `data-spec-id` elements in DOM order: IDs, nearest spec parent, root-relative border-box bounds, computed padding/margin/border, grid/flex settings, transforms, and scroll extents. The report includes viewport size, scroll offsets, device pixel ratio, total element count, and truncation status. Internal markup without a spec ID has no separate entry.
- Uses CSS pixels for geometry and top/right/bottom/left order for edge arrays. Computed margins do not describe collapsed margins or actual sibling distances; compare bounds for distances. Overflow flags alone do not prove a defect.
- Waits up to one second for fonts/images before measurement. Drops geometry when assets remain pending, animations run, or measured layout changes during capture. Correlates replies by request ID and rejects captures after a render revision or spec change.
- Keeps screenshot-only review when geometry is unstable. The capture uses `html2canvas` with `html-to-image` fallback; both reconstruct the DOM, so the report does not claim screenshot-pixel equivalence. Measurements describe the current preview, not an uploaded reference image. This path does not draw an annotation overlay.
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
| Pick components | `chooseComponents()` → `/api/choose` | `typesafe/jev-1.13-20260917` | — | — | — |
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
