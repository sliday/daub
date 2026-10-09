# Recursive vs Direct: paired local evaluation

Completed: 20 live generations, 20 JSON specs, 20 HTML exports, 40 desktop/phone renders, and follow-up browser interaction checks. I changed no generation code during the experiment. The six source hashes in `manifest.json` still match the checkout.

Open the [side-by-side gallery](index.html), [measured summary](summary.json), or [interaction evidence](interactions.json).

## Conclusion

I would use Direct's output as the starting point in nine of these ten pairs. Recursive produced the better recipe layout because Direct's generated script hid its six recipe cards. This is a reviewer preference based on task coverage, coherence and the rendered result, not a statistical win rate or a claim that Direct produced nine working applications.

Recursive's current implementation has several disadvantages beyond scheduling: its prompt prescribes an app sidebar, its branch patches preserve early content and component types, and its completion judge accepted missing or contradictory content. It also skips Direct's application-interaction generation. Increasing parallelism would not address those problems.

Direct has separate failures. The quiz cannot advance because generated chunks cannot access shared lexical variables. The recipe script starts with malformed state and hides the cards. The inbox does not switch messages, and the cart does not recalculate after the tested quantity change. Treat Direct as the stronger starting point in this sample, not as production-ready output.

## Protocol

- Run the current local checkout, including the uncommitted structured-output, timeout and skeleton fixes, not production release 034b731.
- Ten short prompts, one fresh run per mode per prompt. Alternate mode order between pairs.
- Use the real local Playground and its API functions with OpenRouter Auto Router; do not mock generation or judging.
- Run one design at a time, retaining each mode's own pipeline and internal concurrency.
- Save canonical JSON, the actual HTML download, request metadata, status, elapsed time, screenshots and DOM measurements.
- Compare exports at desktop (1200px) and phone (390px). Keep generated content unchanged while measuring.
- Generate with a 1440 x 1000 browser viewport, light OS scheme, and a new context for each run. Direct can change its preview viewport from the prompt; Recursive does not share that mobile-prompt path. Preserve this product behavior and record it as a confounder.
- Keep each mode's shipped-local defaults: Recursive uses three concurrent jobs, strict structured responses and reasoning effort `none`; Direct uses its normal OpenUI, review and interaction pipeline. Both request `openrouter/auto`. This compares the two product workflows, not recursion alone.
- Serve the actual local API handlers for generation, choosing and refinement judging. Route exported DAUB CSS/JS URLs to the same local source while testing. Do not mock model responses.
- Cap a design at 240 seconds. No run reached that benchmark cap. One Direct visual-review request hit the API's 60-second timeout. The Recursive to-do spacing request returned HTTP 400 because the routed endpoint required reasoning.
- Stop the benchmark on provider quota/rate limits. Do not reroll bad designs or retry failed prompts to improve scores.
- Treat this as a ten-pair diagnostic sample, not a statistically established model benchmark. Record routed models and pipeline differences as confounders.

## Prompts

1. 10-step personality test, mobile-optimized.
2. Email and password sign-in form with a forgot-password link.
3. Three-plan pricing page with a monthly/annual toggle.
4. Simple to-do list with add, complete, and delete actions.
5. Profile settings form with name, email, and a save button.
6. Recipe search page with a search field and six recipe cards.
7. Weekly habit tracker with seven daily checkboxes per habit.
8. Support inbox with a message list and a reading pane.
9. Shopping cart with item quantities and an order total.
10. Event registration form with name, email, and ticket quantity.

## Review rubric

Evaluate task coverage, global content consistency, coherent hierarchy, responsive fit, and requested interaction behavior. Keep objective metrics separate from visual judgments. Empty layout containers, duplicate headings/progress/navigation, unsupported component properties, rendering errors, and missing event/state logic are specific failure signatures. Fewer components or less HTML is not a quality score.

## Results

| Measurement | Direct | Recursive |
| --- | ---: | ---: |
| Runs with saved JSON and HTML | 10/10 | 10/10 |
| Median generation/pipeline time | 72.9s | 15.4s |
| Total generation/pipeline time | 764.4s | 149.3s |
| API requests, including judges/reviews | 87 | 151 |
| Recorded provider cost | $0.4412 | $0.0718 |
| Requests without returned cost | 1 | 1 |
| Runs with reported branch failures | Not applicable | 3/10 |
| Runs with empty Stack/Grid leaves in saved JSON | 0/10 | 2/10 |
| Document-level horizontal overflow at 1200px or 390px | 0/10 | 0/10 |

Cost is the sum of returned usage, including Jev when provided, not an invoice total. The missing values belong to the Direct review timeout and the Recursive spacing HTTP 400. Faster and cheaper Recursive runs also generated less content and no application scripts. Do not infer equivalent work or quality from these totals.

The router returned DeepSeek v4.1 Flash, DeepSeek v4 Flash 0731, GLM 5.3 Flash, and Gemini 3 Pro Image Preview across generation/review requests. Jev handled classification. `result.json` records each returned model. Model routing, reasoning settings, response format, prompt policy, and pipeline stages differ between modes.

### Paired findings

Times include the observed generation pipeline through its terminal UI state, not the later screenshots or interaction checks. A preference names the artifact I would keep for further work.

| # | Prompt | Direct output | Recursive output | Preference |
| --- | --- | --- | --- | --- |
| 1 | Personality test | 86s, 35 nodes. Complete question/answer layout at phone width. Next does not advance; shared-state runtime errors. | 11s, 15 nodes. Header, progress and navigation only. Two empty regions, no question or answers. Body schema rejection. | Direct, visual coverage only |
| 2 | Sign-in | 27s, 25 nodes. One email/password form and one recovery link. Desktop form is wider than needed. | 9s, 22 nodes. Same basic fields, but three recovery links and a detached welcome column. | Direct |
| 3 | Pricing | 77s, 67 nodes. Three plans; switching monthly to annual changes Pro $29 to $23 and Enterprise $99 to $79. Initial annual selection conflicts with monthly copy; card heights and content alignment need work. | 18s, 49 nodes. Three well-defined cards, but an unnecessary sidebar and two billing toggles. Neither toggle changes prices. | Direct |
| 4 | To-do | 52s, 29 nodes. Add, check/counter update, and delete all worked in the export. | 16s, 30 nodes. Duplicate Add controls. Native checkbox toggles, but add/delete do nothing and the remaining count stays stale. Spacing review failed with HTTP 400. | Direct |
| 5 | Profile settings | 21s, 48 nodes. Coherent form, with extra phone, location, bio and notification settings beyond the prompt. Save produced no visible confirmation. | 18s, 18 nodes. Three Save buttons. Desktop navigation overlaps the Name area. A patch tried to change the navigation component type and the merger rejected it. Save produced no visible confirmation. | Direct |
| 6 | Recipe search | 69s, 87 nodes. Six cards exist in JSON/HTML, but the generated script hides them and shows zero results on load. | 14s, 35 nodes. Six visible recipe cards. Two search fields, inconsistent image ratios, and a pizza image on the taco card. Search does not filter. | Recursive, visual coverage only |
| 7 | Habit tracker | 168s, 80 nodes. Four habits with seven checkboxes each. Toggling updates state/text. Day headings do not align with checkbox columns. Review request timed out. | 22s, 28 nodes. No habits or checkboxes. Two empty containers after structured-component rejection. Summary says 18/35 while footer says 26/42. | Direct |
| 8 | Support inbox | 79s, 71 nodes. Message list and populated reading pane. Clicking another message does not change the pane. List column is cramped. | 11s, 28 nodes. Mailbox categories instead of a message list, and a subject-only card without message body. Duplicate search/compose controls. Judge marked it complete. | Direct |
| 9 | Shopping cart | 119s, 60 nodes. Three products, quantity controls, and initially coherent subtotal/tax/total. Product images are unrelated landscapes. Quantity 1 to 2 does not change totals. | 20s, 55 nodes. Two product rows and quantities 1 and 2; header says three items. Two order summaries both show $128 despite displayed $129/$74 prices. Quantity changes do not update totals. | Direct |
| 10 | Registration | 66s, 39 nodes. One set of name/email/quantity fields, a summary, and native quantity control. Adds an unsolicited parking fee. | 9s, 21 nodes. Two complete registration forms, two quantity controls, and two submit buttons. Claims that the total updates but renders no total. Judge marked it complete. | Direct |

The cart's "three items" can mean units rather than product rows, so I did not score that label alone as an error. The $128 total cannot match either plausible interpretation of the displayed prices and quantities.

### JSON vs HTML

- All 20 terminal specs parse as JSON and produced HTML downloads. That does not establish task completeness. Recursive rejected three intermediate branch responses and kept its last valid spec.
- Recursive's quiz and habit tracker preserve empty structural nodes. HTML renders those nodes with little or no height, so a visible-DOM-only empty-box check misses the missing content. Inspect the spec and requested roles as well as pixel geometry.
- Recursive emitted no top-level theme/state or script nodes in these ten runs. Its final specs contain `root` and `elements`. Direct chose themes and emitted application scripts in eight of ten runs, excluding sign-in and settings.
- Direct's quiz stores `let currentQuestion` and `const questions` inside the `_shared_state` CustomHTML script. The export executes each code item with a separate `new Function`. Other chunks throw `questions is not defined`, `currentQuestion is not defined`, and `resultsOpen is not defined`.
- Direct's recipe `_shared_state` contains string values such as `window.recipes = "(array salmon taco pasta ramen soup pancake)"` and an `all` filter with embedded quote characters. Its filter script hides the rendered cards on load. The JSON contains content that the browser never shows.
- Both modes fit the document width in the tested viewports. Recursive settings and inbox still have local navigation collisions. A zero horizontal-scroll count cannot certify alignment, readability or completeness.
- Static image loading completed for the measured exports. Content relevance still fails in examples such as the taco image and Direct cart landscapes.

### Interaction scope

`inspect.mjs` runs the exported HTML without new provider requests. It records controls, console warnings, page errors, and before/after values. I tested quiz selection/Next, recovery-link destinations, both billing modes, to-do add/check/delete, settings save feedback, recipe filtering, habit toggling, inbox selection, cart quantity/totals, and registration field editing/quantity.

I did not submit registrations, authenticate users, test real recovery endpoints, or verify backend persistence. Sign-in link destinations are markup evidence, not proof that those routes exist. Native checkbox/number-field changes count as control behavior, not complete application logic.

Some exports retain their original preview-origin notification target and log a `postMessage` origin warning when reopened on the inspection server. The self-posted render still runs. I excluded that origin warning from generation-quality judgments. The initial screenshot pass only captured uncaught page errors; the follow-up also captures caught `CustomHTML JS error` console messages. See each run's `interaction.json` for those errors.

## Causes and fixes

### 1. Choose the shell from the task

The layout prompt says that an app body should use `Grid columns:"sidebar-main"`. That guidance explains why Recursive adds sidebar structures to quizzes, to-do lists, and simple forms. All ten saved Recursive specs use that grid preset. The registration result then repeats the form in separate regions.

Source: [layout/detail instructions](/Users/stas/.codex/worktrees/snowflake-design/daub/playground.html:4182).

Recommended change: produce a small typed layout brief first, including required roles, optional roles, viewport, and each role's owner. A form can be one column. An inbox needs message-list and reading-pane roles. Reject extra top-level regions that lack a task-based purpose.

### 2. Permit reviewed structural corrections

`merge()` forbids removing nodes, changing types, changing child order, or removing existing text. That protects sibling work, but it also protects duplicate actions and poor early choices. The settings run demonstrates the type-change rejection. The generator receives the full spec, so this is not a simple absence-of-global-context problem. Concurrent branch jobs can still duplicate shared responsibilities, and the merger offers no reconciliation operation.

Source: [preservation and merge rules](/Users/stas/.codex/worktrees/snowflake-design/daub/playground-snowflake.js:125).

Recommended change: retain strict subtree ownership during parallel work, then allow a validated ancestor-level reconciliation patch to remove duplicates, relocate controls, or replace an unsuitable wrapper. Serialize ancestor edits against in-flight descendants and validate the complete graph after merging.

### 3. Separate completion from spacing

Three Recursive runs report partial refinement, but all three also say "Spacing checked." Seven runs receive "Jev: no further refinement," including the inbox without a message list/body, cart with contradictory totals, and duplicated registration form. The spacing judge's policy excludes missing content by design; its status must not substitute for completion.

Source: [judge criteria and threshold application](/Users/stas/.codex/worktrees/snowflake-design/daub/functions/api/refine-judge.js:213), [terminal status](/Users/stas/.codex/worktrees/snowflake-design/daub/playground.html:4268).

Recommended change: before the global judge can approve, enforce task-specific coverage and consistency checks: required roles populated, no duplicate singleton forms/actions, counts consistent, and primary actions connected. Follow with a whole-page screenshot/geometry review at both target widths. Give the checker a repair path, not only a stop decision. Preserve separate statuses for content, layout and behavior.

### 4. Share the behavior pipeline and state contract

Recursive generation returns before Direct's interaction pipeline. Its prompt excludes scripts, and the strict wire schema includes only `root` and `elements`, not the top-level state/theme that the prompt assigns to the parent. Native controls render and toggle, but business behavior remains absent in the saved Recursive examples.

Source: [recursive generation and early return](/Users/stas/.codex/worktrees/snowflake-design/daub/playground.html:4312), [structured response schema](/Users/stas/.codex/worktrees/snowflake-design/daub/playground-snowflake.js:595).

Recommended change: use the same typed state/actions and behavior-verification stage for both modes. Prefer deterministic bindings for totals, counters, selections and form state. If code generation remains necessary, provide one shared runtime state object instead of inaccessible lexical declarations. Direct's final `_runVerifyLoop()` currently returns an already-resolved promise, so add real acceptance checks there too.

Source: [Direct verification stub](/Users/stas/.codex/worktrees/snowflake-design/daub/playground.html:4706).

### 5. Keep structured output, improve rejected-branch handling

Structured output remains useful. It caught malformed branch data and prevented a bad patch from replacing the last valid layout. It cannot ensure semantic completeness, valid application state, or provider compatibility. The quiz and habit runs demonstrate decoder failures; the to-do spacing call demonstrates an Auto-routed endpoint that rejected `reasoning: none`.

Recommended change: keep strict schemas and `openrouter/auto`. Record the rejected stage, target, decoder error and finish reason; allow a bounded branch repair using that error, with the existing immediate stop on quota/rate limits. Simplify contradictory wire-shape examples in the prompt. Validate optional model parameters against the routed-provider contract instead of assuming structured-output support also permits disabling reasoning.

## Suggested next experiment

Keep Direct as the default. Test a hybrid next: generate a complete minimal page with a shared state/role plan, then use the bounded Recursive queue to repair identified subtrees. Run one global reconciliation and behavior-verification pass before completion. Keep three concurrent region jobs; this sample gives no evidence that more workers would improve quality.

Re-run these same ten pairs after changing one policy at a time. First remove the prescribed sidebar and add the global coverage gate, then assess state/behavior parity. Use multiple seeds/runs before claiming a stable preference rate. Preserve structured output and the raw failing examples as regression fixtures.

## Artifacts and reproduction

- `run.mjs`: live generation harness. Requires the repo's Playwright dependency, Chrome, and `OPENROUTER_API_KEY` in the environment. It incurs provider charges. Running it again overwrites this evidence folder; use a new report folder for a new experiment.
- `inspect.mjs`: local browser interaction checks against saved exports. No model calls.
- `summarize.mjs`: measured totals, source-hash check, static gallery, and ten paired screenshot sheets.
- `manifest.json`: source revision, hashes, prompt list, and protocol.
- `results.json`: aggregate run records, with no quota/rate-limit circuit trip.
- `summary.json`: counts, timings, recorded cost and JSON structure comparison. `outsideRootTree` can include intentional Direct overlays; it is not an automatic error classification.
- `01-direct` through `10-recursive`: `spec.json`, `generated.html`, `result.json`, `interaction.json`, Playground screenshot, and both exported viewport screenshots.

The generation snapshot includes prior uncommitted fixes and differs from production release `034b731`. This report does not claim production parity. I made no deployment or application changes in this task.
