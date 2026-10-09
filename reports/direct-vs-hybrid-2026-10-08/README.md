# Direct vs Hybrid comparison

Completed 20 live generations and independent export checks at two widths (40 viewport runs). Application source hashes match the collection snapshot. No product changes, commits, or deployments during this benchmark.

**Keep Direct as the default for now.** It passed more of the specified core flows in this sample. Hybrid produced useful inbox and cart prototypes with fewer requests, but contract errors and finish-gate decisions discarded several behavior candidates. Neither mode completed the ten-question quiz correctly.

## Results

| Metric | Direct | Hybrid |
| --- | ---: | ---: |
| JSON and HTML exports | 10/10 | 10/10 |
| Core-flow pass at both widths | 6/10 | 4/10* |
| Core-flow fail | 3/10 | 6/10 |
| Unverified external destination | 1/10 | 0/10 |
| Median generation time | 131.9s | 99.9s |
| Model requests | 99 | 72 |
| Recorded cost | $0.6095 | $0.2195** |
| Retained standard output API | 0/10 | 3/10 |
| Initial horizontal-overflow cases | 0/10 | 0/10 |

*Hybrid's habit-tracker pass covers native daily checkbox toggling. Its aggregate counter does not update and it has no controller/output API. Registration passes visible behavior but violates its generated output type contract. A core-flow pass does not mean the whole generated product works.

**Hybrid has two timed-out requests without usage records, so its cost is a lower bound. These are observed costs, not normalized model-price estimates.

| Interface | Direct | Hybrid |
| --- | --- | --- |
| Ten-question personality test | Fail: no final result | Fail: static first question |
| Sign-in and recovery | Validation passes; recovery route unverified | Fail: static conditional panels |
| Monthly/annual pricing | Pass | Fail: prices do not change |
| To-do list | Pass | Fail: Add does not add a task |
| Profile settings | Pass | Fail: no save feedback transition |
| Recipe search | Pass | Fail: no filtering |
| Weekly habit tracker | Fail: no habit rows | Native-only pass; counter stale |
| Support inbox | Fail: reading pane does not change | Pass, including selection output |
| Shopping cart | Pass | Pass, including quantity/total output |
| Event registration | Pass | Visible flow passes; output type mismatch |

Hybrid's pipeline reported only two `complete` runs, seven `incomplete`, and one `unverified`. It retained three controllers (inbox, cart, registration). Its seven finish rejections comprise two invalid finishes, three new-defect rejections, one check regression, and one unverified review. No Hybrid run reached its 18-request/180-second cap; its maximum was 11 requests and 152.3 seconds.

The standard output API was absent from Direct, which did not promise that contract. Independent checks verified matching visible values in all three retained Hybrid APIs. Registration returns numeric values as strings, contrary to its generated assertions. Do not interpret semantic value agreement as typed-contract compliance.

## Protocol

- Ten one-line prompts, one fresh generation per mode and prompt (20 runs).
- Live product paths with their existing routed models and budgets. This compares the modes users run, not algorithms under equal token budgets.
- Alternate mode order between prompts. Run designs serially with fresh browser contexts.
- Generate at 1440 x 1000 with a light OS color scheme. Inspect exports at 1200 x 900 and 390 x 900.
- Allow up to 240 seconds per run. Preserve each mode's own request limits, timeouts, repair limits, and failure behavior.
- Stop the batch on provider rate limits or exhausted credits. Do not reroll unsuccessful outputs.
- Keep application sources unchanged during collection. `manifest.json` records start hashes; `environment.json` adds browser version and supplemental hashes captured during case 02.
- Test exported HTML with synthetic inputs. Block external submissions. Authentication, payments, and email delivery are outside this local prototype test.

## Evidence

Open `index.html` for paired desktop/mobile screenshots. Each run links its JSON, HTML, pipeline diagnostics, and independent interaction checks.

Separate the following outcomes:

1. Export: JSON and HTML exist. This does not establish interaction success.
2. Structure: valid root, resolved child references, cycles and unreachable elements.
3. Rendering: horizontal overflow, uncaught runtime errors, and missing images at both widths.
4. Task: independent prompt-specific interactions at both widths. Unknown selectors or missing test evidence count as unverified, not success.
5. Output API: presence and verified content as a separate Hybrid capability. Direct does not promise that API.

Pipeline self-assessments appear in the report but do not count as independent task evidence. A retained draft can render while its behavior code failed or the pipeline rejected it. Candidate probe results do not establish that the retained export works.

## Limits

One sample per prompt cannot establish a stable win rate. Auto routing can choose different models between runs and stages. Recorded costs exclude requests without usage records. Generated personality scores are demonstration data, not validated psychological assessments.

## Visual inspection notes

- Both modes fit the tested widths in the first six pairs. Lack of horizontal overflow does not establish usable states or correct content.
- Direct's quiz starts at question 3 and retains a stale "Question 3" subheading while its question text changes. The ten-question flow still fails to reveal the final result.
- Hybrid exposes mutually exclusive states after rollback: sign-in/recovery/success, profile validation/success, recipe results/empty state, and both billing prices.
- Direct's pricing page adds navigation, comparison details, and FAQ content beyond the prompt. Hybrid uses a shorter layout, but the retained toggle does not update prices.
- Direct's recipe grid uses unrelated scenery and architecture photographs rather than food photographs. Its functional pass is not a visual-quality pass.
- The Direct cart also uses unrelated placeholder photographs. Hybrid's cart is more compact and omits product imagery.
- Direct's mobile inbox stacks mailbox navigation and conversation lists before the reading pane. Hybrid's shorter list/pane layout requires less scrolling, and its selection behavior works.
- Direct's habit card is empty. Hybrid renders three habits with seven native checkboxes each, but its failed coding stage leaves its aggregate counters disconnected.

## Failure analysis

### Conditional state versus initial visibility

Case 02 Hybrid requires an error-message area and an "initially hidden" recovery panel to be visible at initial render. The contract validator accepts the contradiction. Its probe treats `when: initial` as a visibility requirement. The candidate controller hides conditional panels and clears errors, which conflicts with that contract.

The saved candidate passed both generated interaction journeys at both widths. A 60-second final-review timeout then triggered an `unverified` rollback. The retained export lacks the candidate's program and shows sign-in, recovery, and success content together. The candidate's passing probes do not establish that the export works.

### Ambiguous actions and rollback attribution

Case 03 Hybrid targets the billing toggle wrapper without selecting an option. The probe clicks its first button, Monthly, while the contract expects Annual pricing. This test cannot establish whether the Annual control works.

The final reviewer also introduces a `hierarchy:header` defect after the initial review reported no defects. The finish gate rejects that new non-behavior defect and drops the controller. Its status instead quotes the first journey defect, obscuring the rollback trigger. The retained export shows both billing prices and prefilled selection feedback.

### Separate candidate and retained artifacts

Use `assessment` for the retained spec, and label `attemptedAssessment` and candidate probe views as candidate evidence. Check `spec.hybrid.program` and exercise the exported HTML before crediting behavior or output API support.

### Fixture drift and unsupported action selectors

Case 04 Hybrid's draft starts with two sample tasks; the candidate starts empty and its journeys assume an empty list. A zero-height empty list then fails initial visibility requirements. The candidate adds tasks, but the generated `check(todo-list, "0")` action assumes an index selector the probe does not support. The output assertions also contradict the intended delete action: they expect the deleted first task to remain.

This run spent 136.1 seconds and 10 of 18 requests, below the 180-second budget. Behavior generation consumed 83.3 seconds, including one permitted retry after a 16,384-token truncated response. The retained export has no controller. Increasing concurrency would not resolve these contract and probe mismatches.

### Hook shape versus JSON shape

Case 05 Hybrid returns full function declarations for all four controller hooks. The runtime expects function bodies. Compilation succeeds, but invoking the wrapper declares an inner function and returns `undefined`; output validation rejects it and disposes the controller before binding events. This is a generated-code API mismatch, despite valid outer JSON. Runtime errors justify rollback in this case.

Its contract also expects `saved` to have `name/email` properties and equal the string `"true"`. A global completion requirement demands the invalid-email alert during the successful-save journey. Validate those constraints before generating code.

### Assertions against the wrong checkpoint

Case 06 Hybrid's second journey searches `zzz`, checks the empty state, then searches `chocolate cake` and verifies one result. Its final output assertions still expect `visibleCount:0` and `empty:true`. Candidate probes show the matching Chocolate Cake result. A completion requirement also demands that the empty-state message remain visible, creating the non-behavior defect that causes rollback.

Separate the empty-search and recovery journeys, or associate assertions with named checkpoints. Visibility and output assertions must describe the same state.

### Native controls versus generated behavior

Case 07 Hybrid retains 21 native Checkbox nodes after its controller fails syntax validation. The checkbox-only requirement can pass without a working counter or output API. Direct retains an empty habit card and shared-state initialization, without row-rendering code. Count this as a narrow Hybrid success, not a complete stateful tracker.

Cases 08 and 09 Hybrid retain controllers. The inbox exposes a selected index plus message metadata, without message bodies. The cart exposes item quantities and a formatted total. Its generated tests do not cover changing a quantity after checkout; source review shows that such a change preserves `checkedOut:true` while changing the confirmed total. Treat this as an untested state-consistency risk beyond the core quantity/total check.

### Direct wiring and final assembly

Case 01 Direct advances through ten distinct questions but its result trigger targets a `resultModal` DOM ID that the rendered modal does not expose. Case 08 changes selection state without a handler that updates the reading pane. The final reviews in cases 07 and 08 ended with truncation; the saved artifacts do not prove that truncation caused the missing implementations.

### Typed registration output

Case 10 Hybrid returns `quantity: "3"` and `total: "75.00"`. Its generated assertions encode JSON values that parse as numbers `3` and `75`. The quantity assertion fails first; total has the same mismatch. The pipeline retains this controller because the mismatch is a behavior/journey defect, then labels the run incomplete. The visible form works, but a typed consumer cannot rely on the promised numeric fields.

## Replay and provenance

`inspect.mjs` uses fresh contexts, synthetic inputs, and blocked external submissions. Its final all-case replay uses one harness version across 40 views. Earlier selector/debug runs remain under `inspections/`; they did not regenerate designs. The harness records outgoing runtime messages before forwarding them with their original target origin, without changing export behavior.

The evaluator resolved two Save buttons by choosing the button beside Cancel in the form action row. It marks the sign-in recovery destination unverified because the link targets a separate route. It does not count absent optional output APIs as core-flow failures. Review individual `interaction.json` records for checks, screenshots, blocked requests, and observed state.

Final replay: `2026-10-08T17-37-18.094Z-8e35fbf5`, 40 raw records and 192 screenshots. All latest records use the same evaluator SHA-256, `63ebe6bdb12396e8aac06f76a5779d3a3e9c0b4d85684992949495f854d32794`. Required checks: 32 pass, 20 fail, 8 untestable/dependent checks. Optional checks: 6 pass, 2 fail, 10 unavailable. The replay captured 80 outgoing messages and no runtime-error payloads; all 40 views retained origin warnings.

To regenerate the local report from existing evidence:

```sh
node reports/direct-vs-hybrid-2026-10-08/summarize.mjs
node reports/direct-vs-hybrid-2026-10-08/capture.mjs
```

To replay the saved exports without provider calls:

```sh
node reports/direct-vs-hybrid-2026-10-08/inspect.mjs
```

## Proposed fixes

1. Validate generated contracts before generation: distinguish DOM presence from visibility, bind conditional requirements to a named journey/checkpoint, freeze starting fixtures, and reject contradictory output paths or expected states.
2. Give actions explicit control targets. A billing group needs an option value; a task list needs a row and checkbox/delete control. Reject unsupported selectors before spending requests on implementation.
3. Validate controller hook bodies with a small initialization probe. Named function declarations can compile while returning undefined; anonymous declarations can fail compilation. Require an initial plain-object output and then exercise transitions.
4. Separate reproducible behavior/layout regressions from subjective review changes. A new design criticism should not discard working interactions and expose incompatible static states. Report the actual rollback trigger, and retain candidate evidence for inspection.
5. Validate Direct's final assembled artifact after the last code review. Check requested controls and the complete user journey, including quiz completion, rather than relying on successful generation or isolated chunk tests.
6. Make standalone export diagnostics observable without the original preview origin. The benchmark records blocked-origin warnings; caught errors need independent capture before drawing conclusions from an empty page-error list.
