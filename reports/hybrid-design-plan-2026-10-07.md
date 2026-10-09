# Hybrid generation implementation plan

## Approved design

Build Hybrid (experimental) beside Direct and Recursive. Generate one complete
native page, inspect concrete defects at desktop and mobile widths, propose up to
three independent repairs, and accept each against the latest whole page. Keep
the incumbent when a proposal regresses. Generate one behavior controller with
action -> state -> render, then run frozen interaction checks on the final page.
Retain strict structured responses and openrouter/auto. Do not deploy.

## Architecture and interfaces

- `playground-hybrid.js`: UMD `DaubHybrid.run(options)`. Options provide `draft`,
  `inspect`, `propose`, `apply`, `finish`, `onSpec`, `onProgress`, `signal`, limits.
  Model callbacks receive `request(fn)` for one shared bounded request budget and
  `signal`. Inspect returns `{complete, defects:[{id,targetId,kind,message}],
  checks:[{id,pass}]}`. A candidate must resolve its target defect, introduce no
  new defect identity, and preserve passing checks. Invalid/missing evidence is
  unverified. Parallel proposals use detached snapshots; serial acceptance uses
  the latest incumbent. Default three workers, two repair rounds, 18 model calls,
  180 seconds. Reserve two requests for finish/final verification. Provider quota
  and rate limits stop immediately. Cancellation cannot publish stale results.
- `playground-behavior.js`: UMD `DaubBehavior.mount(preview, program, reportError)`
  and `toScript(program)`. Program `{initial,reduce,render,bind}` contains JSON
  initial state and function-body strings. Reduce receives `(state,action)` and
  returns next JSON state. Render receives `(state,ui)`. Bind receives
  `(ui,dispatch)`. UI exposes `get(id)`, `input(id)`, `text(id,value)`, and
  `on(id,event,handler)`. Private frozen state, queued actions, unconditional
  render after each accepted transition, listener disposal before remount.
  No additional generated executable chunks in Hybrid.
- `playground.html`: mode selection, strict requirements/draft/repair/behavior
  calls, isolated two-viewport evaluation, frozen journey checks, chat status,
  versions, stop/new-chat cancellation and export parity. Keep other modes intact.

## Work items

- [x] Implement and test bounded repair scheduling, stale snapshots, regression
  rejection, failed evidence, deadline, cancellation and provider-limit stops.
- [x] Implement and test controller state transitions, immutable inputs, event
  ordering, initialization failures, remount disposal and script serialization.
- [x] Integrate Hybrid selection and provider calls with the existing sandbox,
  renderer, schema and chat/version lifecycle. Keep candidate frames isolated.
- [x] Test deterministic browser flows and export: quiz progression, inbox
  selection, cart quantities; desktop/mobile measurements and cancellation.
- [x] Run regression suites, local provider smoke tests where credentials permit,
  review screenshots, and document remaining quality limits without claiming
  that runtime success proves design quality.

## Acceptance and review focus

The whole draft appears before any repair. Workers never publish untested local
subtrees. A failed candidate cannot remove a passing requirement or interaction.
Inspectors cannot change the frozen acceptance criteria. Missing evidence and
timeouts remain unverified. Final behavior changes require a fresh inspection.
Native component IDs survive bindings; custom DOM updates must not duplicate IDs.
If no version passes, retain the best available draft and state its unresolved
defects. No automatic switch of the default generation mode, commit or deployment.

## Verification commands

```sh
node --test tests/playground/hybrid.test.mjs tests/playground/behavior.test.mjs
node --test tests/playground/hybrid-browser.test.mjs
node --test tests/playground/*.test.mjs tests/render/*.test.mjs tests/generate.test.mjs tests/refine-judge.test.mjs
git diff --check
```
