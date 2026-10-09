# Archived Playground generation modes

Production uses Hybrid with text prompts and DAUB AI. The default URL and legacy
`?design=direct`, `?design=snowflake`, `?design=hybrid`, and `?react-chat` URLs use
the same Hybrid host. Production ignores stored provider and generation-mode
preferences without deleting API keys or stored designs. Production rejects file
paste/drop and own-key control attempts; it does not fall back to Direct.

## Source references

The last committed host before this retirement is
`034b7311cd7422a2714b6ccacdb58a1b8df80969` (Add bounded recursive design queue and
polish Playground layouts). Inspect the historical implementation without copying
the production HTML or restoring it over a dirty checkout:

```sh
git show 034b7311cd7422a2714b6ccacdb58a1b8df80969:playground.html
git show 034b7311cd7422a2714b6ccacdb58a1b8df80969:playground-snowflake.js
```

- Direct: `generate`, `buildMessages`, streaming provider wrappers,
  `runBlockingGenerate`, and `runDesignPipeline` in the historical HTML. Direct
  streamed a complete design and ran a separate visual/interactivity pipeline.
  It supported own-key providers and image, file, web and Figma context.
- Recursive: `generateRecursive` in the historical HTML and the standalone
  `playground-snowflake.js` module. It generated regions through a bounded queue,
  used `/api/refine-judge` to select work, and reviewed layout spacing.
- The historical React entry used `?react-chat` and `__playgroundBridge` to reach
  Direct streaming. The production host no longer contains that bridge or mount.

The retirement removes Direct and Recursive generation entry implementations
from the host. Shared rendering, schema, saved-design and export helpers remain.
Some dormant pipeline/provider helpers remain to avoid changing shared contracts
during retirement. The standalone Snowflake, quality, OpenUI, behavior and recipe
modules remain available to tests; Hybrid still uses Snowflake schema helpers.
The committed revision does not capture later uncommitted experiments. Preserve
those experiments in the team's eventual integration commit.

## Host contract

`generate()` invokes `DaubPrototypeUI.create(host).generate(prompt)`. The existing
host getters for `currentSpec`, `controller`, `stream`, `isDefaultMode` and
`hasAttachments` remain. Tests can observe loading through
`.pg-chat[aria-busy="true"]`; completion restores `aria-busy="false"`.
`#pg-status` remains hidden, while the chat shows generation progress.

`buildResultBubble` retains `DaubHybridUI.renderBrief` for saved contract briefs
and displays the new prototype's five-point brief as escaped text. The quick
prototype path returns markup, styling, behavior and smoke steps together. See
`PIPELINE.md` for the active runtime and output APIs.

## Contract-first Hybrid retirement

Revision `f38b3f547b6b0208cb97bf36058d54f1308bf9f8` contains the last deployed
contract-first host. That path planned requirements and journeys, generated a
native layout, then compiled a recipe or generated a controller. Its mandatory
stages delayed the first working interaction. The reported Tetris case contained
a text board, a fabricated test control and no behavior program.

The quick prototype path keeps a brief but includes it in the implementation
response. It permits canvas and managed animation, and checks a short interaction
in isolated frames. It allows at most one correction. Saved controller specs
continue to use `playground-behavior.js`; the retired scheduler and contract
validators remain available for reference and unit tests.

`tests/archive/hybrid-browser.reference.mjs` preserves the old host integration
assertions. It requires the contract-first host and does not run in the active
suite. The new browser tests cover the replacement behavior rather than skipping
failures or weakening assertions in the old tests.

## Verification and historical tests

Run from the repository root, with Playwright and Chrome installed:

```sh
node --test tests/playground/production-mode.test.mjs
node --test tests/playground/workflow.test.mjs
```

The suite mocks provider responses and blocks external requests. It covers
default/legacy routing, unsupported controls, persisted preferences, status,
quota termination, saved JSON, HTML export and shared-code consent.

### Archived integration assertions

- `tests/archive/snowflake-browser.reference.mjs` preserves the 24 registered
  cases from `tests/playground/snowflake-browser.test.mjs`, including its dirty
  retirement-time changes. Coverage includes mode selection, queue/refinement,
  region skeletons, spacing, the old shared pipeline, cancellation and errors.
  These historical cases require the retired host. The shared SSE parser case
  also remains active in `workflow.test.mjs` so retirement keeps that coverage.
- `docs/archive/react-generation-tests.reference.mjs` preserves the four final
  React assertions from `workflow.test.mjs`: example/provider controls,
  generation/context updates, Stop, and provider-error handling. The snippets
  use that file's historical `open`, `spec`, `test` and `assert` harness. The
  original harness is accessible with `git show` at the base revision above.

Both references retain their original assertion bodies and use `.reference.mjs`
names, outside the active `*.test.mjs` suite. The snapshots include uncommitted
work after the base revision; Git's old committed tests alone do not capture it.
In total, the archives retain 28 cases; 27 concern retired integration behavior,
and the shared SSE case also runs in the active suite. We did not duplicate the
production HTML or add skipped tests.

### Active coverage

`workflow.test.mjs` keeps 44 shared cases for preview/export behavior, schema
parity, sandbox isolation, geometry and source-correlated message handling. A
test-only message sender addresses the actual opaque iframe; it does not restore
the retired production React bridge. Tests read the current spec from the JSON
editor and evaluate retained prompt source. The theme/export case uses the public
theme API with the registered `dracula` theme (the previous bridge accepted the
unregistered name `grape`). The former React-bundle fallback case now verifies
that a legacy React URL uses Hybrid with one request on a mocked quota error.

The 11 production-mode cases replace mode-selection integration coverage.
Standalone Snowflake module tests remain active and unchanged. Current Hybrid
coverage lives in `prototype-browser.test.mjs`, `prototype-runtime.test.mjs`,
`prototype-validation.test.mjs` and the retained `hybrid-contract.test.mjs`; `visual.mjs` still needs
integration changes if used as a React-specific visual runner.
