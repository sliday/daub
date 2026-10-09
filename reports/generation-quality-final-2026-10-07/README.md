# Generation quality: implementation and verification

## Findings and changes

The original ten-prompt comparison exposed two separate problems: Recursive
started with a prescribed shell and refined parts without a whole-page correction;
both modes could generate incompatible shared state and event handlers.

This implementation follows the [plan](../recursive-vs-direct-2026-10-07/implementation-plan.md):

- Start Recursive with a complete minimal native page chosen for the request.
- Keep three concurrent jobs and subtree ownership. Run one serialized full-page
  reconciliation afterward, then judge the root and audit empty containers.
- Allow one validation-guided repair for a rejected initial design or branch,
  within existing request and time limits. Stop on provider quota/rate limits.
- Preserve `openrouter/auto`, strict schemas and required provider support. Retry
  only the specific mandatory-reasoning incompatibility without `reasoning: none`.
- Share behavior generation, assembly review and runtime checks between modes.
  Validate JSON state seeds and execute chunks with shared lexical state.
- Preserve code-only handlers, report late runtime errors and retain literal
  dollar sequences in exported JavaScript. Emit NumberField input/change events.
- Capture hidden mobile previews for visual review and measured spacing checks.

Direct remains the default. Recursive remains experimental. No commit or
production deployment forms part of this verification.

## Evidence boundaries

The original twenty runs remain in
[the baseline report](../recursive-vs-direct-2026-10-07/README.md).
Eight development probes live in
[the smoke report](../generation-quality-smoke-2026-10-07/README.md).
This folder adds four live generations, followed by interaction probes against
their saved JSON and HTML. Each case has one sample. This is diagnostic evidence,
not a statistical comparison or a new ten-prompt release benchmark.

`manifest.json` records source hashes at harness startup. During these four runs,
the implementation still received handler-preservation and hidden-preview fixes.
Do not treat that manifest as the final source snapshot. The generation engine
and API changes preceded these runs; the final test suite and re-export probes
cover the later frontend fixes without more provider calls.

Use `interaction-reexported.json` for the final exporter checks. `result.json`
contains generation-time screenshots, geometry, requests and provider usage.
Its `error: "Parse error"` field comes from the harness reading the default hidden
JSON-error label regardless of visibility; it does not establish a failed run.
All four cases produced a spec and exported HTML.

## Live outcomes

| Case | Time | Requests | Reported cost | Observed behavior |
| --- | ---: | ---: | ---: | --- |
| Personality test, Direct | 128s | 11 | $0.05014 | Answer selection enables Next, but clicking Next leaves the question unchanged. Initial step and card counters disagree. |
| Personality test, Recursive | 60s | 9 | $0.01550 | Three answer options; Next changes question text, options and counter from 1 to 2. No forced sidebar or empty region. |
| Support inbox, Recursive | 78s | 13 | $0.03523 | Selecting Marcus changes sender, email and full body. The billing badge remains stale. |
| Shopping cart, Recursive | 62s | 9 | $0.02708 | Increasing headphones from 1 to 2 updates line total, subtotal, tax and order total ($305.76 to $445.08). |

Costs sum provider-reported usage fields; they are not billing invoices. The
Recursive quiz emits DAUB radio-markup warnings after replacing options. The
sampled interactions produced no uncaught JavaScript errors. That does not prove
all controls or complete user journeys work.

## Visual review

I inspected the saved 390px and 1200px renders.

- The Recursive quiz fits 390px without horizontal overflow and presents one
  question with answers and navigation. Generated code replaces the native radio
  styling with plain inputs. This probe covers one transition, not the final result.
- The inbox provides three populated columns at 1200px. At 390px it stacks a
  tall icon sidebar above the messages; its action group overflows by about 6px.
- The cart renders product images and calculated totals. Its desktop grid gives
  a narrow column to products and most width to the summary. Tall product cards
  make both desktop and mobile pages longer than needed. Color descriptions do
  not match some images (for example, the warm-brass lamp appears gray).

Jev reported `Spacing checked` for these Recursive cases at their generation
viewport. The mobile inbox failure shows that this single-viewport verdict cannot
serve as responsive acceptance. No empty layout nodes or broken images appeared
in these four saved outputs.

## Deterministic verification

Command:

```sh
node --test --test-reporter=spec tests/playground/*.test.mjs tests/render/*.test.mjs tests/generate.test.mjs tests/refine-judge.test.mjs
```

Result: 997 tests, 996 passed, zero failed, one skipped. The skipped test requires
an external original layout attachment through `DAUB_LAYOUT_SPEC`.

Coverage includes whole-page reconciliation, branch isolation, bounded repairs,
cancellation and budgets, strict provider forwarding, shared state execution,
handler preservation, literal export payloads, NumberField event ordering,
late runtime reporting and hidden mobile screenshot capture.

## Remaining work

The changes address concrete pipeline defects. They do not establish that
Recursive produces better designs than Direct across the original ten prompts.

1. Add a two-viewport final acceptance check, including overflow and region-width
   proportions, after behavior generation. Keep repairs bounded and retain the
   last valid page.
2. Replace free-form cross-chunk state wiring with a small shared state/update
   contract. In the failed Direct quiz, one chunk mutates `currentStep` before
   dispatching an event; another chunk only renders if the event value differs
   from that already-mutated state. Runtime exception checks cannot detect this.
3. Require task-specific interaction assertions: full quiz progression and result,
   inbox body plus metadata, cart arithmetic, form validation and submission
   feedback. Treat model-written tests as evidence to review, not an oracle.
4. Rerun the ten paired prompts from a frozen source snapshot with repeated
   samples before changing the default or claiming a quality advantage.

Local preview: <http://127.0.0.1:8893/playground.html?design=snowflake>.
