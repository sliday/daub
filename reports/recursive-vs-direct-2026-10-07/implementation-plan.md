# Generation quality implementation plan

## Scope

Improve the existing local Playground workflow. Keep Direct as the default, keep `openrouter/auto`, keep strict Recursive output, and retain the three-job limit. Preserve the twenty benchmark artifacts without rerunning their harness in place. Do not deploy in this task.

## Analysis

The benchmark identifies six plausible contributors: prescribed sidebar layouts, concurrent duplication of responsibilities, immutable early structure, false-positive completion judging, missing Recursive behavior generation, and Direct state/runtime contract errors. The first two implementation priorities are a complete-page baseline with global reconciliation, and a shared behavior/runtime contract. The saved outputs already provide evidence; add regression checks around those exact failures before changing their paths.

## Work items

- [x] Replace the containers-only Recursive start with a complete minimal native page. Select layout from the task, preserve mobile viewport behavior, and refine only deficient regions.
- [x] Add one serialized whole-page reconciliation after bounded parallel refinement. Permit validated structural corrections there, keep sibling ownership during parallel work, retain the last valid preview, and expose unresolved issues.
- [x] Repair a rejected branch once using its validation error. Keep existing total request/time limits and immediate quota/rate-limit stops.
- [x] Handle the observed provider rejection of `reasoning: none` once without weakening structured output or changing the router.
- [x] Add common output-quality checks and reuse behavior generation for Recursive. Fix shared state scope/normalization, check runtime errors, and expose behavior as unverified until interaction checks pass. Multi-chunk behavior now gets an assembly review in both complexity paths.
- [x] Add regression tests from the saved JSON/HTML cases, run the existing relevant suites, and run a new local paired smoke sample with screenshots and interaction evidence. Final scoped suite: 996 passed, one fixture-dependent skip. Twelve additional live generations and saved-output interaction probes show progress and remaining model failures; see `../generation-quality-final-2026-10-07/README.md`.

## Ownership

The lead owns Playground integration, quality/runtime contracts, the plan and documentation. One worker owns Recursive orchestration and its tests. Another owns API reasoning compatibility and its tests. A read-only reviewer investigates generated-state and component-event contracts. File ownership stays disjoint.

## Acceptance

The first Recursive preview contains usable requested content. Single-form requests do not acquire mandatory sidebars. Global reconciliation can remove duplicate controls without racing branch updates. Invalid patches preserve the prior preview; a bounded repair can recover. Runtime verification distinguishes verified, unresolved and unverified states. Both modes keep the same state/event contract. Provider errors never trigger unbounded retries or schema downgrade.

A test pass does not establish model quality. Record live sample results separately from deterministic regressions and identify any remaining generation failures.
