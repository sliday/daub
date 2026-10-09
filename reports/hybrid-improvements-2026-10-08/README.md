# Hybrid improvements and candidate replay

## Implemented improvements

- Freeze initial fixtures and reject contradictory output types/paths before drafting.
- Use conditional `present` requirements with step-level visibility assertions.
- Resolve grouped buttons and checkbox lists by labels instead of silently clicking the first control.
- Keep one capped advisory layout review; browser evidence controls acceptance. Skip the second paid review after behavior.
- Normalize matching full-function wrappers to hook bodies without executing them in the host.
- Allow one behavior correction using browser failures; accept it only when it improves checks without regressions.
- Select quiz, single-choice selection and existing-card filtering recipes during planning. Build deterministic journeys before freezing their contracts, then compile behavior locally with no coding request. Other workflows retain the generated-code path.
- Scope `[hidden]` rendering to the prototype runtime and inspect computed visibility in the probe.

The [visibility replay](after-visibility/summary.json) rechecks profile and habits at
390px and 1200px after the runtime fix. All four views pass with working outputs.
Profile's hidden error no longer appears beside success; `hiddenButVisible` is empty.
The screenshot in `after-02` below records the earlier defect, not the current result.

These local changes do not alter the frozen ten-case generation benchmark or
prove a new 10/10 generation rate. No deployment or commit accompanies this work.

The first live canary (`live-canary`) still requested generated behavior after
layout: the quiz timed out at that stage; filtering passed. That failure prompted
recipe-first planning. Keep that canary separate from `recipe-first-canary`, which
tests the final path. A repeated quiz is a new implementation check, not a reroll
of the original benchmark score.

## Final verification

| Check | Result |
| --- | --- |
| Full repository suite, bounded concurrency | 2,338 passed, 1 skipped |
| Final recipe/contract/integration suite | 96 passed |
| Offline available-candidate replay | 9/9 narrow flows and output APIs at both widths |
| Live recipe-first ten-question quiz | Complete, 36.9s, 3 requests, recorded cost $0.005599 |
| Independent quiz export, 390px and 1200px | Ten distinct questions completed; ten answer records and final numeric result verified |
| Live recipe-first filter | Contract succeeded; draft hit the existing 60-second provider timeout |

The [successful quiz](recipe-portable-canary/01-hybrid/generated.html) uses only
contract, draft and advisory-review calls. Its saved
[independent results](recipe-portable-canary/01-hybrid/interaction.json) exercise
different answer choices from the generated completion journey. No code-generation
request occurs. The result is a demonstration score, not a psychological assessment.

The [filter attempt](recipe-filter-canary/06-hybrid/result.json) stopped after
two requests with no accepted draft. Its timed-out request has no usage record;
the recorded $0.000277 is a lower bound. Local filter recipe tests pass, but this
final live generation does not establish a working filter export. The earlier
custom-code filter canary passed in 49.6s with four calls and $0.011200 recorded cost.

The first recipe-first schema attempts (`recipe-first-canary`) received provider
400 errors. Removing regex constraints from the wire schema allowed the next quiz
attempt to succeed. The local compiler still validates IDs, reserved names, text,
bounds and graph structure. We retained strict `json_schema`, required parameters,
and `openrouter/auto`; provider-specific schema handling remains a compatibility
boundary ([OpenRouter structured-output documentation](https://openrouter.ai/docs/guides/features/structured-outputs)).

An initial unconstrained test run hit one chat-scroll timing assertion. Its
15-test isolated rerun passed; the bounded-concurrency full run passed. No chat
code changed. Logs: `/tmp/daub-hybrid-final-all.tap` and
`/tmp/daub-hybrid-final-focused.tap`.

These are recovery tests and two targeted live prompts, not a fresh paired
ten-interface benchmark or proof of a general cost/win-rate improvement.

Replay nine saved controllers and one timeout case without provider calls. The runner restores each original saved layout through the browser host, downloads HTML through the existing exporter, and calls the original independent `evaluateCase` at 390 and 1200 pixels. It does not generate replacement behavior, change contracts, or edit product files.

Keep the denominators separate: **original retained-generation baseline 4/10**, **saved-candidate baseline 8/9 available** (includes native-only habits), **current candidate replay 9/9 available**. Quiz remains timeout/no-program. Candidate replay does not change the original generation score.

## Run

Run from `/Users/stas/.codex/worktrees/snowflake-design/daub`:

```sh
node reports/hybrid-improvements-2026-10-08/replay.mjs \
  --out reports/hybrid-improvements-2026-10-08/after-next \
  --compare reports/hybrid-improvements-2026-10-08/baseline/replay-02
```

Choose a new output name on each run. The runner refuses existing directories, including the baseline. `--cases 5,7` selects a subset; both widths still run. `--help` prints the interface.

To replay the captured baseline source into another folder:

```sh
node reports/hybrid-improvements-2026-10-08/replay.mjs \
  --source-snapshot reports/hybrid-improvements-2026-10-08/baseline/source \
  --out reports/hybrid-improvements-2026-10-08/baseline/replay-next
```

Requirements: the checkout's `playwright` dependency and installed Google Chrome. The runner starts a loopback-only server, opens fresh browser contexts, blocks external/API traffic, maps `daub.dev/daub.css` and `daub.dev/daub.js` to captured local bytes, then closes Chrome and the server. It imports no API handler, reads no provider credentials, and invokes no generation/review endpoint. External fonts, icons, and images can remain unavailable.

## Baseline provenance

`baseline/source` is a snapshot captured at **2026-10-08T19:59:56.853Z**, before the normalizer changes. It is **not a byte-identical copy of the complete original benchmark source**. The renderer, exporter host, behavior runtime, Hybrid UI and independent evaluator match the benchmark-era hashes. One tracked benchmark source differs:

| File | Original benchmark SHA-256 | Captured baseline SHA-256 |
| --- | --- | --- |
| playground-hybrid-checks.js | `072c812fbe24782631cc1e0d1c959858fad6f61719c3e1b46b64a5a67e2936cd` | `dcd8bd452db1740fde44380617ee72c5cf095180e0f86b5fe13888489a0d9458` |

The snapshot already contained a concurrent checks change. We did not recover the original complete checks module. The independent evaluator does not invoke that generated-contract probe. Each protocol lists the exact source hashes and differences; do not treat this replay as a historical acceptance-gate rerun.

`baseline/corpus` freezes byte copies of all ten original `result.json`/`spec.json` pairs and the benchmark provenance. Each run verifies those hashes. The runner selects the **last complete `hybrid_behavior` JSON** with five string fields and decodable initial state. It keeps invalid hook syntax as evidence. It skips truncated output instead of repairing it. For case 04 this selects request index 8, after the truncated request at index 7. Indices are zero-based.

The saved `spec.json` supplies the frozen layout and contract. The generation harness saves the final retained spec; the original finish stage clones that layout before attaching behavior and performs no later layout edits. Cases 08-10 retain controllers, and the runner checks their raw extracted programs against the saved programs. It preserves `root`, `elements`, contract, and historical status. Historical `hybrid.status` is not the replay result.

The old source has no `normalizeProgram`; baseline replay only decodes `initial` as the original adapter did. Current replay calls **`DaubHybridUI.create({}).normalizeProgram(raw)` from its captured source**. The replay runner does not unwrap, rewrite, or correct hooks. It records raw and normalized hashes separately. A normalization rejection stays a rejection, with a static export for inspection.

## Evidence

- [Baseline summary](baseline/replay-02/summary.json), [protocol](baseline/replay-02/protocol.json): all ten cases, 20 viewport records. Baseline finished at 20:04:27Z.
- [Current summary](after-02/summary.json), [protocol](after-02/protocol.json), [comparison](after-02/comparison.json): final runner, ten cases at both widths.
- [First current replay](after-01/summary.json): same nine available candidates; confirms the normalizer path before adding hidden-element diagnostics.
- `baseline/replay/` contains the interrupted first harness attempt with the wrong preview-frame ID. Do not count it as baseline results. The corrected run uses `#pg-preview-frame`.
- Each case contains `behavior-response.txt` (when available), `program.json`, exported `generated.html`, attached `spec.json`, and `result.json`. Width folders contain full independent observations, checks, runtime errors, and screenshots in `interaction.json`.
- Each protocol contains source/input/evaluator/runner hashes, source capture time, served files, denied requests, and browser version. Results hash HTML and screenshots. `runner.mjs.txt` preserves the executed runner bytes.

The frozen independent evaluator SHA-256 is `63ebe6bdb12396e8aac06f76a5779d3a3e9c0b4d85684992949495f854d32794`. Comparisons require identical corpus and evaluator hashes. `sameRawProgram` proves unchanged candidate input; `sameProgram` can be false because the product adapter trims or unwraps hooks.

## Results

Results agree at both widths. UI pass means the evaluator's specified core flow passed; it does not certify the generated contract, all visible states, or production behavior.

| Case | Captured baseline | Current product adapter | Interpretation |
| --- | --- | --- | --- |
| 01 Quiz | Timeout/no-program | Timeout/no-program | No complete response exists. Static draft observations are supplementary, not a recovered candidate. |
| 02 Sign-in | Pass, output available | Pass, output available | Local validation and recovery opening work. Original final-review timeout discarded the candidate. |
| 03 Pricing | Pass, output available | Pass, output available | Explicit Annual click changes prices; Monthly restores them. Original journey clicked the group without choosing Annual. |
| 04 To-do | Pass, output available | Pass, output available | Add, complete and delete work with synthetic input. Original checks mixed fixture assumptions and unsupported row selection. |
| 05 Profile | Fail, controller initialization error | Save-flow pass, output available | Product hook unwrapping recovers execution. An invalid-email alert remains visible beside success feedback. |
| 06 Recipe search | Pass, output available | Pass, output available | Six cards, matching query, empty query result and restoration work. Original final assertions describe the preceding empty state. |
| 07 Habits | Native-toggle pass; controller fails, counter stale | Toggle and counter pass, output available | Anonymous hook wrapper caused the original syntax failure. Product normalization restores the aggregate counter. |
| 08 Inbox | Pass, output matches selection | Pass, output matches selection | Retained original controller. |
| 09 Cart | Pass, output matches quantity/total | Pass, output matches quantity/total | Retained original controller. Checkout state after later quantity edits remains outside this evaluator. |
| 10 Registration | Visible-flow pass; string numbers | Visible-flow pass; string numbers | Output still returns `quantity: "3"`, `total: "75.00"`; original assertions expect numbers. |

Baseline: 8/9 available candidates pass the narrow UI checks, including a native-only habit pass. Seven expose an initialized output API. Current adapter: 9/9 pass the narrow UI checks and expose output; habit-counter checks pass. Case 01 remains missing, so neither run completes all ten requested behaviors.

## Remaining mistakes

- Current contract validation rejects case 02's initially hidden recovery panel as an initial-visibility requirement and case 05's scalar `saved` assertion alongside `saved.name`/`saved.email`. Replay preserves both contracts.
- Case 03's saved journey clicks Monthly while expecting Annual; the original finish gate also rejected a new header hierarchy criticism. Case 04 starts empty despite draft fixtures, then uses unsupported index targeting and asserts a task it deletes.
- Case 06's saved journey ends on `chocolate cake` but asserts the preceding empty state. Current contract validation accepts that semantic contradiction.
- Case 05's [mobile screenshot](after-02/05-hybrid/390/02-after.png) shows an error beside success. `hiddenButVisible` confirms `specId: error` has `hidden` yet computed `display: flex`. The narrow Save check does not catch this display defect.
- Case 07's [desktop screenshot](after-02/07-hybrid/1200/03-after.png) confirms the recovered counter, `1 of 21`, and output `totalChecked: 1`.
- Case 10 still returns numeric strings. Changing them to numbers in this runner would invent corrected behavior.

## Boundaries and verification

No model calls, regeneration, contract repair, or final-review requests occur. We bypass pipeline acceptance to inspect saved candidate behavior; these results do not prove changes to finish-gate acceptance. Current contract validation is a diagnostic only and never replaces the saved contract. The runner also does not execute new `present`, named-control, or visibility-checkpoint probe features through the frozen independent evaluator.

Verification covers immutable extraction across all ten saved inputs, selection after truncation, timeout and invalid-syntax classification, source/input/hash checks, refusal to overwrite an output folder, and full browser replay. Infrastructure failures produce evidence and a nonzero exit; after three consecutive failing cases the runner stops. Candidate behavior failures remain report data. No product lint/test suite or provider integration ran because this change owns only report tooling.

Final verification: 20 baseline views and 20 current views, 88 screenshots per run, all checked source/runner/HTML/screenshot hashes match, unchanged raw candidates in all comparisons, and zero intercepted provider attempts. Current snapshot time: **2026-10-08T20:07:15.262Z**. The served-file manifest excludes the new recipe module; this run makes no claim about recipe-worker changes.
