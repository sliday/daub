# Hybrid blank-preview recovery

The reported run returned `finish_reason: length` after two successful HTTP
requests. The old UI displayed `draft` throughout requirements and page generation,
and rejected truncated output without another attempt.

## Changes

- Show stage names, elapsed seconds and received stream bytes, including retry
  state. Remove the duplicate failure message and stop the timer at completion.
- Retry truncated structured output once, requesting a fresh compact response
  with a 32,768-token ceiling. Preserve strict schemas, Auto Router, quota stops,
  the shared request cap and the existing deadline. Never publish partial JSON.
- Correct an invalid initial graph once, supplying its validation error and
  frozen IDs. Later region repairs retain their existing validation rules.
- Require nonempty expected-text assertions in the schema. Compile missing
  assertChanged baseline snapshots before freezing journeys, without changing
  assertions or expected outcomes.

## Evidence

Development probes exposed an empty assertion, a missing button reference and a
missing baseline snapshot. These are separate failures from truncation. Captured
provider responses remain in the dated recovery folders.

The final live quiz run in `hybrid-recovery-verified-2026-10-08/01-hybrid` completed
in 89 seconds with seven requests. Desktop and mobile journey checks passed.
The exported HTML advanced from question 1 to question 2 after selecting Agree
and clicking Next in the in-app browser. This run did not truncate; mocked
responses verify the truncation retry and the second-truncation stop.

Full regression suite: 1,211 passed, one optional fixture skipped. The final
focused browser suite adds coverage for baseline setup without another model call.
Syntax and whitespace checks pass. No commit or deployment.
