# Hybrid round three

## Scope

Check uncovered native buttons after the existing frozen journeys, without a
routine model review. The prior cart's Checkout button dispatches an action that
its reducer ignores. Both the visible page and output API remain unchanged.

Possible sources examined: incomplete contract journeys, missing listeners,
ignored reducer actions, stale rendering, missing output updates, and disabled
controls. The saved cart has a listener and unchanged reducer output; its frozen
journeys omit Checkout. Round two's cart supplement records both symptoms.

## Implementation

- Probe at most six initially visible uncovered native buttons at each viewport.
- Start each action in a fresh opaque-origin frame, without changing the user's
  preview or weakening the frozen journeys.
- Require a visible or output response; listener registration is insufficient.
- Feed no-response failures into the existing single controller-repair attempt.
- Reject repairs that hide or disable a formerly tested action.
- Preserve recipe compilation without adding a coding request. Report remaining
  recipe action failures for review.
- Record coverage limits and unprobed actions with the browser evidence.
- Keep the tested controller and its unresolved failures if an optional repair
  returns empty or malformed structured content. Propagate provider errors,
  request limits and cancellation.

## Verification

- Probe suite: 172 passing tests, including hidden/disabled/reset/current-state
  skips, no-op reducers, visible/output changes, and external-action guards.
- Initial adapter integration run: 34 passing tests. The full-suite run also
  passes the added quota-during-repair test without another generation request.
- [Saved artifact replay](saved-actions/summary.json): the detector flags the
  prior cart's Checkout at 390px and 1200px. The saved quiz and filter have no
  uncovered native buttons. Replay makes zero model calls and leaves their
  original HTML and JSON unchanged.
- Integration checks prove acceptance of a working repair, rejection of hidden
  or disabled replacement actions, retention after invalid repair responses,
  the six-action cap, and no coding request for recipe-backed extra-action failures.
- Full repository suite: **2,449 passed, one skipped, zero failures**, in 183.4s.
  Command: `node --test --test-concurrency=2 tests/**/*.test.{js,mjs}`.
  Log: `/tmp/daub-hybrid-round3-all.tap`.
- `git diff --check` passes. The existing localhost preview returns HTTP 200 and
  serves both updated `v=4` Hybrid scripts. The user's open chat remains untouched.
- No commit or deployment.

## Cost boundary

Healthy recipe-backed fixtures keep two model calls; healthy custom fixtures keep
three. Only a failed custom controller can use the existing fourth repair call.
These are mocked pipeline request counts, not a new provider-cost benchmark.
This round uses saved outputs and local regression tests rather than another
paid generation batch. The smoke check adds browser work, not routine model work.

## Limits

This smoke check does not certify semantic correctness or cover every state.
Initial hidden controls, native controls nested in non-Button components, actions
after data entry, external effects, and buttons beyond the cap need journeys or
human review. The old benchmark artifacts and evaluator remain unchanged.
