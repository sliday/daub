# Quick prototype verification

## Jev component selection

The active path calls `/api/choose` before generation. The endpoint requests
`~typesafe/jev-latest` through the Decisions API; the provider resolved it to
`typesafe/jev-1.13-20260917` during this check. The picker scores 91 catalog
entries in one batch. Generation receives at most eight ranked components with
real classes and HTML examples, within 12,000 characters. Repairs reuse the
selection. Existing non-picker Jev calls keep their pinned default.

Three live, predeclared selection cases produced these results:

| Request | Selection time | Provider-reported cost | Expected controls in top picks |
| --- | --- | --- | --- |
| Mobile personality quiz | 638 ms | $0.000331800 | Radio Group and Button present |
| Contact form | 348 ms | $0.000331884 | Textarea and Button present |
| Tetris with touch controls | 382 ms | $0.000331716 | Button absent; layout components selected |

This small check establishes service integration, not a general selection
accuracy rate. Base controls and custom canvas remain available, so a missed
selection does not forbid their use. The moving alias and 0.45 threshold can
change relevance in future runs. Evidence: `/private/tmp/daub-jev-live.json`.

A live quiz run made one selection call (640 ms) and two generation calls. It
reused Button, Radio Group, Stepper, Progress, Surface and Container classes, but
failed because the model returned a named `init(container, api)` declaration
without calling it. Local replay also exposed two checker gaps: styled radios
hide their native inputs, and CSS-only progress updates leave text unchanged.
The validator now normalizes a standalone named function without executing it
in the host. The checker clicks the visible associated label, respects disabled
fieldsets, and compares computed geometry/styles as well as text and canvas.
Unused CSS variables cannot satisfy a visible-change assertion.

Replaying the exact first response after those fixes passed both widths with one
mocked generation in 599 ms. A prior replay under concurrent test load used the
allowed second attempt; the observed one-call result is not a latency guarantee.
The independent browser walkthrough answered ten distinct questions, verified
ten output answers and a visible result screen, then restarted. Evidence:
`/private/tmp/daub-jev-browser/replay.json`, `preview-fixed.png` and
`results-fixed.png`. No new provider request was necessary for those repairs.

The five-second picker deadline falls back with a visible notice on invalid
scores, unavailable service or timeout. Quota responses stop before generation;
Stop cancels selection. Tests cover propagation of templates, ranking/budget,
one selection per repair cycle, cancellation and quota behavior.

The full release suite passed 2,520 tests with one skip and no failures
(`--test-concurrency=2`, `/private/tmp/daub-jev-release.tap`). Review then found
that text color on an empty progress bar could satisfy `assertChanged` without
changing pixels. The checker now excludes text and border color from its style
snapshot. All 97 Jev/prototype regressions passed after this change, including
negative cases for unused color and border color
(`/private/tmp/daub-jev-review.tap`). These smoke checks are bounded behavioral
evidence, not a pixel-equivalence guarantee.

## Speed round

The client now checks both viewports concurrently, with a limit of two opaque
frames. Probe frames skip html2canvas and html-to-image; preview and export
frames keep both libraries. Read-only smoke steps no longer add a 32ms delay.
Input actions and explicit waits retain their delays. Stop and setup failures
remove both frames. Streaming progress uses a 250ms throttle.

Tetris instructions enter the prompt only for a Tetris request or an edit to
existing engine-backed code. The model, strict schema, token ceiling, interaction
assertions and one-repair limit stay unchanged.

Paired Chrome replays used the same recorded quiz and Tetris responses, three
runs per interface before and after. Each run used a fresh browser context at
1440 x 1000 and checked 1200px and 390px frames. The harness fulfilled generation
from local SSE files and blocked external CDN requests in both variants to
exclude provider and network variance. The final after batch ran without the
test suite. Both variants passed the same checks in one mocked request.

| Interface | Before runs (ms) | After runs (ms) | Median reduction |
| --- | --- | --- | --- |
| Personality quiz | 690, 722, 680 | 265, 246, 356 | 690 to 265 ms, 61.6% |
| Tetris | 2768, 2755, 2683 | 1252, 1251, 1256 | 2755 to 1252 ms, 54.6% |

These are local pipeline times with instant recorded responses, not live model
latency. They do not establish an equivalent end-to-end generation speedup.
Probe screenshot-library requests dropped from four to zero per run. Quiz
message content shrank from 4,664 to 3,668 characters (21.4%); Tetris retained
its 4,633-character context. Character reduction does not measure token or
dollar savings. This speed round made no paid generation requests.

Raw timing evidence: `/private/tmp/daub-speed-before.json` and
`/private/tmp/daub-speed-after.json`; harness:
`/private/tmp/daub-prototype-speed.mjs`. The first-preview observer did not match
the host message shape, so its null values provide no paint measurement.
`window.__prototypeLastTiming` now records response timing, input/output
character counts, first preview publication and cumulative checks for future
live diagnosis without storing generated content or credentials.

## Change

The production entry now requests a brief, HTML, CSS, behavior and smoke steps in
one strict response. It permits one correction. Browser checks run in separate
390px and 1200px opaque frames. The preview, saved JSON, shared-code consent and
HTML export remain available. Existing Hybrid controller specs still render.

Final full suite after the speed round: 2,492 passed, one skipped, zero failures
with test concurrency limited to four. The first high-concurrency run hit two unchanged React timing
assertions; both passed in a 56-test focused rerun and the final full run. Syntax
compilation and `git diff --check` passed. Security regressions verify that hidden
keyboard checks preserve focus and export navigation cannot receive another
payload or impersonate the previous output source. Speed regressions check both
probes in flight, Stop/setup-failure cleanup, engine context on follow-up edits,
timing diagnostics and screenshot-library omission from probes. Full-suite log:
`/private/tmp/daub-speed-full.tap`.

## Live checks

All provider calls used the local server and `openrouter/auto`. These checks did
not deploy or alter the user's open chat. Recorded files live under
`/private/tmp/daub-prototype-quiz/` and `/private/tmp/daub-prototype-tetris/`.

Local demos: [quiz](http://127.0.0.1:8893/reports/quick-prototype-2026-10-09/quiz.html)
and [Tetris](http://127.0.0.1:8893/reports/quick-prototype-2026-10-09/tetris.html).
These generated HTML files are local evidence; exclude them from release archives.

| Prompt | Observed generation | Independent interaction checks |
| --- | --- | --- |
| 10-step personality test, mobile-optimized. | 1 request, 43.6 seconds after the validation fix | Ten distinct questions, required choice, Back preserves answer, results visible, ten answers in output, Retake clears state; 390px and 1200px exported views |
| Tetris game. | 2 requests, 54.1 seconds before the canvas-check fix | Visible canvas pixels change with keyboard input, touch controls and gravity; Pause freezes pixels; Restart clears score; output API works; 390px and 1200px exported views |

The initial quiz run spent two requests and failed JavaScript syntax validation.
The validator now accepts an anonymous function wrapper without executing it in
the host. The first Tetris response omitted the CSS scope wrapper; the renderer
now supplies it. A blank secondary next-piece canvas caused an unnecessary paid
repair. After narrowing the nonblank check to the main canvas after interaction,
replaying that exact first response passed both viewports with one mocked request
and 2.8 seconds of local checking. This replay did not measure provider latency.

The Tetris core comes from Jake Gordon's MIT implementation at pinned commit
`e5c0c42f7dac0f3514a55eff656c6e22e95d68ed`. The adapter preserves the upstream
classic rules. It does not promise modern Guideline rules or hard drop.

## Limits

Two live prompts do not establish a success rate, broad design quality or dollar
savings. Request count decreased relative to the contract-first architecture;
actual cost depends on routed models and token usage. The smoke steps cover a
short interaction, not a full generated application. The live samples still
need visual polish, including the Tetris mobile control arrangement and quiz
palette. New prompt guidance addresses those patterns; it has no new live
generation evidence in this run.

The opaque sandbox protects the parent origin. Managed timers/listeners support
cleanup; they do not prevent arbitrary code from consuming CPU. Export tests
check navigation invalidation and source correlation. No deployment forms part
of this verification.
