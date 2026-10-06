# DAUB Quality Review

Reference: [Kitze UI](https://ui.kitze.io/). Date: 2026-10-06.

Objective: improve the project and review each component against the reference's
component discovery, working examples, clear states, and desktop/mobile behavior.
Preserve DAUB's theme families and tactile visual identity.

Status: local verification complete for the quality review, chat kit, and upstream merge.

## Release Integration

- Preserved the 29 upstream commits through `4591bea`, including photo licensing,
  SSRF guards, model routing, renderer coercions, and OpenUI positional contracts.
- The merged catalog contains 89 components and 87 spec renderer types, with
  MessageScroller, Message, Bubble, Attachment, and Marker.
- Added compact chat controls, local attachments, streaming cancellation, and
  position-preserving history. React chat components use the shadcn headless engine
  and require React 19 or later.
- Merged integration suite: 1,171 tests passed, zero failures and skips.
- Chat contrast: 1,302 checks across 42 themes, zero failures. Minimum text ratio
  4.60:1; minimum focus-ring ratio 5.21:1, including busy-state text colors.
- The Pages Function bundle, canonical renderer snapshot, and generated skill
  reference/digest checks passed. Deploy from the committed archive, excluding
  development artifacts and retaining the compiled server bundle.

Final merged log: `/private/tmp/daub-merged-release-final.log`. The initial review
results below describe the 84-component library before adding the chat kit.

## Acceptance Criteria

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| Search and navigate the complete library | `components.html`, grouped navigation, stable component links, history, adjacent components | `tests/library/browser.test.mjs`, 84 catalog examples |
| Inspect working examples and source | Sandboxed previews, HTML/anatomy tabs, theme/variant controls, mobile sizing, copy actions | Library browser tests and screenshots |
| Match component markup to native styles | Correct React class hooks, field/OTP/select/pagination styling, flex/grid gaps, chart labels, step indicators | `tests/react/controls.test.mjs`, `data.test.mjs`, `disclosures.test.mjs` |
| Preserve interaction and accessibility state | Keyboard navigation, focus/scroll restoration, overlay stacking, disabled controls, labels, descriptions, native/React ownership | `tests/behaviors`, `tests/react` |
| Apply themes across scopes and portals | Theme-local semantic/component variables, inherited fonts/colors, portal theme context | Rendered theme and React portal tests |
| Keep text readable across themes | Primary-button state contrast, field placeholders, raised-surface secondary text | `tests/library/contrast.test.mjs`, `npm run test:contrast` |
| Preserve developer workflows | Editable JSON, validation, restore/cancel, copy/export, state bindings, preview readiness | `tests/playground` |
| Isolate generated JavaScript | Opaque-origin preview, sender checks, message-based inspection and screenshots | Playground isolation tests |
| Expose a consistent renderer contract | 82 renderer types, eight added types, canonical generated MCP body, parser/prompt/catalog parity, 42 theme names | `tests/render` |
| Verify desktop/mobile rendering | Per-component fixtures, viewport bounds, loaded assets, screenshots, browser interaction checks | Component audit reports and library browser tests |

## Review Scope

- All 84 HTML catalog entries, their declared modifiers, and native behaviors.
- All 78 React component wrappers, shared hooks, SSR paths, and generated builds.
- Browser rendering, OpenUI parsing, local/cloud MCP catalogs, validation, and exports.
- Homepage, component browser, docs, themes, theme import preview, layout gallery,
  playground, roadmap, and case-study navigation.
- Package inventories, public type declarations, shared icons, social image counts,
  and development/audit tooling.

## Confirmed Fixes

- Added a dedicated component browser with local icons and isolated examples.
  Preview reset replaces the iframe document to preserve component history.
- Guarded storage access in opaque documents. Reinitialization preserves state
  ownership, and disconnected overlays release focus/scroll/inert state.
- Added native menu/select/context-menu keyboard behavior, disclosure relationships,
  command activation, table sorting/selection, calendar labels, OTP paste, carousel
  swipe, and pointer resizing.
- Corrected React menus and portal markup, controlled groups, field associations,
  loading buttons, form-safe actions, date navigation, metric bounds, image fallback,
  carousel focus isolation, and native style hooks.
- Preserved disclosure form state across closing/reopening. Long accordion content
  no longer clips at a fixed height. Zero-gap utilities now override grid defaults.
- Rebound theme-dependent variables at scoped theme elements. Portal previews now
  use their own gradients, text, fonts, and browser color scheme.
- Added contrast-aware primary-button fills/text, including custom accent reset.
  Removed placeholder opacity reduction and adjusted 17 dark-theme subtitle colors
  against raised surfaces.
- Repaired catalog placeholders, missing assets, duplicate IDs, and overlay triggers.
  Docs filtering preserves sample inputs; clipboard failure selects copyable source.
- Added typed theme JSON paste/file/drop import and replacement/reset checks.
- Kept generated playground JavaScript isolated from editor storage and DOM while
  preserving custom code, state, screenshots, inspection, chunk tests, and export.
- Added CheckboxGroup, Fieldset, Frame, Group, Meter, NumberField, PreviewCard, and
  Toolbar to the renderer and reconciled its local/cloud/parser exposure.
- Updated component navigation, React counts, theme names, social image counts,
  and the stale shadcn AI-documentation comparison using its
  [published reference](https://ui.shadcn.com/llms.txt).

## Verification

- Final integration: 843 tests passed, zero failures and skips.
- Firefox library/rendered contrast: 91 tests passed.
- WebKit library/rendered contrast: 91 tests passed.
- Catalog audits: 84/84 green at 1440x900 and 375x812, including loaded assets.
- Contrast audit: 42 themes, zero failing audited pairs. Borderline warnings remain
  above their thresholds; this audit does not certify overall WCAG conformance.
- React typecheck and ESM/CJS/declaration builds passed. The tracked build artifacts
  match the edited source.
- Canonical renderer snapshot check, package dry run, and diff checks passed.

Final logs: `/private/tmp/daub-quality-final.log`,
`/private/tmp/daub-quality-firefox.log`, and `/private/tmp/daub-quality-webkit.log`.
Browser screenshots: `test-results/library/components-1440.png` and
`test-results/library/components-375.png`. Per-component screenshots and audit
tables live alongside each catalog report.

Commands:

```sh
npm install
npm --prefix react install
npm --prefix mcp install
npx playwright install chromium firefox webkit
npm test
npm run test:contrast
npm --prefix react run typecheck
npm --prefix react run build
node tests/render/sync-renderers.mjs
npm run test:components
DAUB_TEST_BROWSER=firefox node --test tests/library/browser.test.mjs tests/library/contrast.test.mjs
DAUB_TEST_BROWSER=webkit node --test tests/library/browser.test.mjs tests/library/contrast.test.mjs
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` or `AUDIT_BROWSER` when using an existing
Chromium executable. Audit viewport/output overrides appear in `audit.mjs`.

## Limits

Browser automation checks DOM semantics, keyboard/pointer events, rendering,
and measured contrast. It does not certify screen-reader output or physical-device
touch behavior. Live paid generation, provider account configuration, and production
deployment require separate checks. This review does not claim that DAUB duplicates
Kitze UI's APIs or visual design.

Detailed component evidence: [React coverage](tests/react/COVERAGE.md),
[renderer coverage](tests/render/README.md), and generated reports in
`test-results/component-audit` and `test-results/component-audit-mobile`.
