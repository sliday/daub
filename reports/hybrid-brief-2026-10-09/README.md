# Hybrid design brief and mode retirement

Local implementation and verification on 2026-10-09. No production deployment
accompanies this report.

## Changes

- The first strict structured response includes a concise design brief alongside
  the existing contract. It names screens, transitions, edge cases, assumptions,
  exclusions and output fields. No separate planning request is required.
- Generation and repair use the same brief. Validation checks references and
  reachability; browser journeys check later screens after their triggering actions.
  Saved versions expose a readable, text-only Design brief disclosure.
- New quiz recipes include question and results panels, answer review and Restart.
  The trusted controller retains answers through Back and clears them on Restart.
  Legacy six-binding quizzes remain readable and runnable.
- The Playground routes default and legacy URLs to Hybrid. It removes the mode
  selector and retired generation entry implementations. The current host accepts
  text prompts through DAUB AI; it hides unsupported attachment and own-key controls
  without deleting stored keys or designs.
- Direct and Recursive references live in
  `../../docs/archive/playground-generation-modes.md`. The archive preserves 28
  historical integration cases, including one shared SSE case that remains active.
  Standalone Snowflake module tests remain active.

## Live sample

Prompt: `10-step personality test, mobile-optimized.`

Artifacts: `live/01-hybrid/spec.json`, `generated.html`, `result.json` and viewport
screenshots. The benchmark manifest records source hashes.

| Measurement | Result |
| --- | --- |
| End status | Complete |
| Duration | 42.651 seconds |
| Requests | 3: contract, contract correction, draft |
| Reported total cost | $0.0082194 |
| Contract model | z-ai/glm-5.3-flash |
| Draft model | deepseek/deepseek-v4.1-flash |
| Coding request | None, trusted quiz recipe |

The first response invented `quiz-recipe-*` journey IDs. Validation rejected them;
one correction supplied the required `recipe-*` IDs. The request and cost totals
include this correction. Routing still uses `openrouter/auto` with strict schemas.
This single sample does not establish a quality or cost improvement over the
earlier ten-prompt benchmark.

## Export verification

`verify-results.mjs` exercises the generated HTML without model calls at 390px and
1200px. Both widths passed:

- Disabled Next before answering; Back preserves the first selection.
- Ten completed answers with exact question IDs, labels, values and scores.
- Separate visible results panel, hidden question panel and complete answer review.
- Result score matches the sum of the ten recorded answers.
- Restart clears answers and score, returns to step one and disables Next.
- No document-level horizontal overflow.

Evidence: `results-verification/summary.json`, `results-390.png`, `results-1200.png`.
The result is an illustrative numeric score, not a validated personality assessment.

## Checks and limits

The full suite passed 2,463 tests with one existing opt-in attachment case skipped
(`DAUB_LAYOUT_SPEC`). Shared workflow coverage includes 44 passing cases. Review
identified and fixed three edge cases: journey IDs that resembled defect kinds,
visibility assertions before a later hide action, and Back after completion of a
one-question quiz. All 140 contract/scheduler tests and the one-/ten-question
browser flows passed after those fixes. A browser regression also checks malformed
briefs and HTML-like strings as plain text.

The final focused run passed all 190 Hybrid contract, scheduler, browser and
production-mode tests. After removing the disabled React bridge and mount source,
all 11 production-mode tests passed again. `git diff --check` passed. The local
server at `http://127.0.0.1:8893/playground.html` served matching Hybrid assets.

The brief validator proves structure and journey references, not the meaning of
each prose edge case. Generic output descriptions do not replace explicit typed
journey assertions. Quiz recipes support the bounded journey budget; planning
uses custom behavior for larger quizzes instead of reducing requested counts.

The scheduler preserves a working controller when a reached-screen layout defect
remains and marks the run incomplete. It still rejects initial layout regressions,
runtime errors and loss of previously passing checks. A complete status means the
implemented checks passed; it does not replace human design review.
