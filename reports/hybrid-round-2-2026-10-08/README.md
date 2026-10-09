# Hybrid round two

## Scope

Preserve Direct's complete first draft and Hybrid's frozen interaction contract.
Use Recursive-style isolated repairs only for measured defects. Keep
`openrouter/auto`, strict structured output, opaque preview frames, and existing
request, concurrency and duration limits.

## Implemented changes

- Remove the advisory-only model call from the acceptance path. Browser checks
  remain mandatory; their success does not certify visual quality.
- Send the schema through `response_format` once, without a duplicate copy in
  the system message. Keep the generation rules and native component catalog.
- Scope repairs to the affected subtree and its layout context. Do not spend
  another request on an unchanged region with the same defect.
- Detect clipped visible content that document-width checks miss, while
  preserving intentional scrolling and truncation.
- Supply an explicit required-ID checklist in draft and correction requests.
  Protect recipe bindings and all filter item IDs during subtree replacement.
- Ask custom journeys to cover recovery and edits after completion, and to keep
  final output assertions consistent with their final state.

## Live evidence

One fresh sample per selected prompt, followed by one search recheck after the
binding-checklist change. All requests use `openrouter/auto`. Keep the failed
search attempt in the denominator; do not replace it with its later success.

| Attempt | Time | Calls | Recorded cost | Result |
| --- | ---: | ---: | ---: | --- |
| [Quiz](live/01-hybrid/generated.html) | 23.1s | 2 | $0.005498 | Complete; independent ten-question journey and ten answer records pass at 390/1200px |
| [Search, first attempt](live/06-hybrid/result.json) | 23.1s | 3 | $0.002269 | Failed: both draft attempts omitted required ID `recipe` |
| [Cart](live/09-hybrid/generated.html) | 57.2s | 3 | $0.021628 | Generated journeys pass; see independent-test limitation below |
| [Search, binding-checklist recheck](filter-binding-canary/06-hybrid/generated.html) | 28.7s | 2 | $0.005430 | Complete; independent matching, empty state and restoration pass at both widths |

The successful quiz and search need contract and draft calls only. Custom cart
behavior adds one coding call. Neither pipeline pays for an advisory review.
The prior quiz canary used three calls and took 36.9s at $0.005599. These samples
show a lower request count and shorter quiz time, but they do not establish an
average dollar saving: routing and output-token use vary. Cart planning alone
cost $0.010047 in this sample.

The runner records request stages, model names, usage/cost, message characters,
schema characters, source hashes, JSON, HTML and screenshots. `live/manifest.json`
captures the first three attempts; `filter-binding-canary/manifest.json` captures
the later checklist revision. The final binding-preservation helper changes only
validation/repair safety; focused tests cover that final change.

## Verification

- Full repository suite with concurrency 2: **2,373 passed, one skipped** before
  the final binding guard. Log: `/tmp/daub-hybrid-round2-all.tap`.
- Final targeted Hybrid browser, contract, clipping and scheduler suites:
  **255 passed**. Log: `/tmp/daub-hybrid-round2-verified.tap`.
- [Offline replay](../hybrid-improvements-2026-10-08/after-round2/summary.json):
  nine available saved controllers retain their narrow-flow passes and output
  APIs at both widths. The tenth historical case has no controller. This is not
  a new ten-case generation pass rate.
- [Clipping audit](clipping/summary.json): 40 saved Direct/Hybrid initial views,
  zero clipping flags. Synthetic browser tests prove detection of clipped text
  and controls at both widths. Scroll, ellipsis, hidden content and transformed
  content remain excluded where geometry alone cannot prove a defect.
- [Quiz and cart independent evaluation](live/interactions.json) and
  [search independent evaluation](filter-binding-canary/interactions.json)
  preserve the original evaluator and its scores.
- The independent cart evaluator requires native quantity inputs and marks this
  button-based cart **untestable**. A separate
  [artifact-specific check](cart-supplement/results.json) verifies increment,
  decrement, restoration, visible totals and numeric outputs at both widths.
  It does not change the frozen evaluator's result.
- Local preview returns HTTP 200 and serves the new script versions. Nothing
  changes the user's current chat until reload.

## Remaining gaps

The generated cart has an extra Checkout button with no visible or output effect.
The supplementary test confirms the gap at both widths. Its frozen contract
tests quantities and totals, so Hybrid's success label does not mean every
generated button works. Coverage of extra actions needs a separate improvement;
this round does not invent a checkout workflow or edit the saved artifact.

The new planning guidance does not prove that a model will choose a recovery
journey or avoid stale assertions. Custom-generated contracts still need semantic
review. Visual spacing, choice of controls, imagery and aesthetic quality need
human assessment; clipping detection does not score those qualities.

The first search failure and its recheck use different model outputs. The
checklist is a tested correction input, not a guarantee that it alone caused the
successful recheck. Keep the frozen Direct/Recursive/Hybrid reports unchanged.

No commit or deployment belongs to this round.
