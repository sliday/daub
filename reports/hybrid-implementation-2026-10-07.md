# Hybrid implementation evidence

## Scope

Added an opt-in Hybrid mode beside Direct and Recursive. One complete native
draft precedes bounded region proposals. Up to three workers propose independent
repairs; whole-page checks gate serial acceptance. Frozen requirements and browser
journeys survive repairs. A single state/reducer/render controller owns behavior.

The UI retains accepted drafts on invalid candidates, failed checks, cancellation
or budget exhaustion. Strict OpenRouter Auto requests remain required. No release,
commit or deployment forms part of this work.

## Live development checks

The development probes used the existing ten-prompt benchmark harness but only
three selected prompts: personality quiz, support inbox and shopping cart. These
are diagnostic runs across changing revisions, not a controlled comparison with
Direct. The source manifests and raw provider output accompany each run.

- `hybrid-diagnostic-2026-10-07`: provider returned JSON with wrong contract fields
  despite a supplied strict schema. The proxy preserved the schema. Added explicit
  schema context and one validation correction before freezing the contract.
- `hybrid-schema-smoke-2026-10-07/01-hybrid`: complete quiz in 74 seconds, five
  requests and 11 native elements. Frozen question/progress journey passed at
  1200px and 390px. Reviewed both exported screenshots. Mobile layout fits; desktop
  content remains wider than desirable. Added narrow-container guidance.
- `hybrid-schema-smoke-2026-10-07/08-hybrid`: retained a 30-element draft at the
  180-second limit. The reviewer criticized interactions before controller
  generation. Added static-draft review rules and time reserved for finish.
- `hybrid-schema-smoke-2026-10-07/09-hybrid`: 27-element cart in 85 seconds. The
  probe clicked the disabled decrement button inside NumberField rather than its
  input. Fixed probe targeting and replayed the unchanged exported HTML. Both
  frozen quantity/total journeys passed at both widths, with no reported defects.
  Evidence: `09-hybrid/export-journey-replay.json`.
- `hybrid-final-smoke-2026-10-07/08-hybrid`: 72 seconds, five requests and a
  21-element draft. One selection journey passed; the second expected a subject
  phrase in the body and failed at both widths. The final reviewer also flagged
  the joined ButtonGroup as a spacing defect, despite that being an intentional
  component treatment. The acceptance gate retained the draft and marked the run
  incomplete. This exposes two remaining model-judgment limits: ambiguous test
  fixtures and inconsistent visual judgments across reviews. The UI now exposes
  rejected candidate evidence separately from the retained draft assessment.

## Regression checks

- Full local suite: 1,206 tests, 1,205 passed, one optional external-fixture skip.
- Browser integration covers desktop/mobile, controller export, malformed contract
  correction, inert behavior, cancellation and immediate quota stops.
- Shared-link tests cover explicit code consent, hash changes, inert messages and
  export. The paused copy strips Hybrid programs, and inert frames refuse scripts.
- Orchestrator tests cover parallel limits, ancestor conflicts, stale candidates,
  regression rejection, error diagnostics and time reserved for final checks.
- Controller and probe tests include radio selection, indexed List rows,
  NumberField input targeting, state immutability and listener disposal.

## Limits

Model-generated tests cover selected journeys, not the whole application. The
semantic reviewer uses geometry and text; it does not inspect a screenshot.
Behavior generation currently has one attempt. An incomplete controller can
remain available with an incomplete status if it preserves the existing passing
checks and introduces no visual defect. Shared links must retain code consent.

Do not conclude that Hybrid beats Direct from these probes. A frozen-source,
paired ten-prompt evaluation remains necessary before changing the default mode.
