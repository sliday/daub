# Hybrid prototype outputs

Hybrid now generates a synchronous `output(state)` function alongside its reducer,
render function and event bindings. The runtime exposes read-only snapshots and
subscriptions through `window.DaubPrototype`. The Playground host reads the current
render through `await window.DaubPlayground.getOutput()`.

Completion contracts distinguish the initial screen from the final result. Frozen
journeys can assert output values and lengths after completing the workflow.
The quiz prompt requests ten distinct questions, retained answers and a final
result object. The generator keeps strict structured output and Auto Router.

## Verification

- Full suite: 1,253 passed, one optional fixture skipped.
- Final focused Hybrid browser suite: 16 passed.
- Browser fixture completes ten questions with alternating answers, checks ten
  distinct question IDs, reads detached output through the parent bridge, and
  repeats completion in exported HTML.
- Shared-link tests cover consent, stale render reads, cleanup-triggered remounts
  and replies from another window. Runtime tests cover invalid output,
  subscriptions, disposal and backward compatibility.
- Live generation exposed a radio label/value mismatch. The checker now accepts
  an exact value first, then a unique visible label. Ambiguous matches still fail.
- A second live run introduced a welcome screen that contradicted its initial
  requirements. Quiz prompts now request question one at startup and one reused
  question/answer region. The gate retained the static draft rather than claiming
  that the failed prototype passed.
- A third contract required later questions at startup and asserted progress
  changes before interaction. Stopped that run. The contract validator now rejects
  premature change assertions and more than eight region requirements before
  layout generation. Prompts separate question data from visible regions.
- The final live run passed desktop/mobile checks in 98 seconds. Its frozen
  completion journey has 21 actions and assertions for ten answers and
  `completed: true`. Completed all ten questions in the visible mobile preview
  and reached its computed result. Saved the generated spec and replayed its
  controller in a network-blocked browser: the public API returned ten distinct
  question IDs with the exact selected answers and no runtime errors. Evidence:
  `hybrid-output-2026-10-08/spec.json` and `output.json`.

Answers remain in the prototype's local runtime. The API does not create a server
endpoint or transmit results. No commit or deployment in this change.
