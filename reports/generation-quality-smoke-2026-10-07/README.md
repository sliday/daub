# Generation quality implementation smoke test

## Protocol

Eight live generations: four prompts, each in Direct and Recursive mode. The runner used a fresh browser context per generation, the local source tree, `openrouter/auto`, and real providers. It saved JSON, exported HTML, request metadata and screenshots at 1200px and 390px. This is a diagnostic sample, not a statistical comparison.

This run overlapped implementation. `manifest.json` records source hashes at launch, not a frozen release. The Direct quiz predates the shared assembly-review change. The inbox failure predates the initial-design repair. The original exports predate the dollar-token serialization repair. Final-source verification belongs in a separate report.

The original ten-prompt benchmark remains in `../recursive-vs-direct-2026-10-07/`. Its twenty output sets remain unchanged.

## Observations

| Prompt | Direct | Recursive |
| --- | --- | --- |
| Personality test | 31 nodes, 99s. Complete visible question/options, but Next called an undefined optional renderer and did not change the question. The 10-step strip overflowed at 390px. | 21 nodes, 129s. One populated question, five options, progress and actions. Selecting an answer then Next changed question 1 to 2 and progress from 10% to 20%. No forced sidebar. |
| Sign-in | 21 nodes, 44s. One recovery link. Field wrapper warnings remain. | 13 nodes, 42s. One recovery link, no empty regions. |
| Support inbox | 65 nodes, 154s. Selecting a second message changed the heading but retained the old message body. This is incomplete behavior despite a text-change check. | 6s. Provider returned a duplicate structured property before the first render. No page. |
| Shopping cart | 53 nodes, 100s. Preview code parsed, but the HTML exporter corrupted dollar-sign sequences. | 38 nodes, 34s. Complete visible cart, but reconciliation returned `finish_reason: error`. The client marked it partial and skipped behavior. Quantity changed without recalculating totals. |

## Fixes from this sample

- Require the assembly review for simple multi-chunk code too. Ask chunk tests to exercise behavior, not only element existence.
- Repair initial-design validation errors once, within the same request/deadline budget.
- Use a function replacement when inserting serialized data into exported HTML. String replacement interprets `$&`, dollar-backtick, dollar-apostrophe and `$$` inside generated code.
- Let a non-empty partial design receive the shared behavior pipeline, while retaining its unresolved refinement status. Quota, provider errors thrown out of the run, limit stops and empty regions still stop that path.

## Export regression evidence

`interactions-reexported.json` records the same saved specs exported through the corrected serializer. No LLM regenerated those specs. The Direct cart now updates quantity 1 to 2 and total $622.08 to $891.00 without script errors. Re-exporting does not fix the old Direct quiz or inbox behavior, and this report does not count them as successes.

Recovery links point to demo routes. No authentication, password recovery or payment backend has been verified. A passing runtime check does not prove task completion.
