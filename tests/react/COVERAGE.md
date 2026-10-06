# React Adapter Review

Date: 2026-10-06. Scope: `react/` and `tests/react/`.

I reviewed all 78 component wrappers and the two hook modules present during the initial pass against the local native
DAUB classes, behavior, and public props. I used [Kitze UI](https://ui.kitze.io/)
as the requested interaction-quality reference. This report records a source
review, not acceptance of full visual or behavioral parity for every wrapper.

## Overlay Follow-Up

The parent assigned the follow-up to overlay/menu adapters, ThemeProvider,
ToastProvider, CustomSelect, and useOverlay. Other workers own controls,
navigation, data/feedback, and disclosures. I did not edit their source or tests
during this follow-up.

- DropdownMenu and ContextMenu now use native visible markup, menu semantics,
  disabled-item skipping, arrows/Home/End/typeahead, keyboard invocation,
  Escape/Tab dismissal, focus restoration, and non-submit action buttons.
- Popover, HoverCard, PreviewCard, and Tooltip now associate trigger/content,
  preserve consumer handlers, support focus/Escape, and forward wrapper refs.
  Single-element fragments retain the trigger's original ID and ref.
- CommandPalette now uses the native panel/open contract, named dialog/search
  semantics, disabled command skipping, keyboard activation, filtering and an
  empty state. It resets during the open transition before committing the
  reopened input, and honors consumer keyboard cancellation.
- Modal, AlertDialog, Sheet, Drawer, and CommandPalette forward panel refs and
  accept native attributes and explicit accessible names. The shared ref merger
  preserves callback-ref cleanup functions without requiring React 19.
- React modals isolate background siblings through inert and restore previous
  inert/overflow/focus state. Activation order covers nested/sibling overlays
  and callback rerenders. Backdrops remain active.
- Portal roots copy the nearest ThemeProvider context and update with it,
  including toast stacks. Owned roots/portals carry data-db-react; the native
  agent's ancestor skip prevents duplicate listeners and controlled-DOM writes.
  Mixed tests keep an unmarked native switch active outside the React subtree.
  The final test uses Switch's own root marker, without a marked ancestor. The
  parent supplied that marker and Carousel's imperative inert setter for the
  React 18 peer contract. I did not change those two source files in this pass.
- ThemeProvider paints its local semantic background and applies local text
  color/font to plain children. Portal roots apply the same text/font styles
  without replacing their native backdrops or component fills. Tests assert
  computed Dracula/Nord Light modal/card gradients, portal surface/text colors,
  primary-button gradients/text, color-scheme, and scoped font inheritance.
  They wait for CSS transitions, not a fixed delay. A CSSOM negative control
  restores the original root-only token selector and confirms the fill checks
  detect that regression. I did not edit the parent's shared token declarations.
- CustomSelect now scrolls/highlights keyboard options, announces empty search
  results, closes when disabled, and carries the ownership marker.
- AlertDialog confirmations use the supported db-btn--primary class, including
  danger variants, matching the native catalog while preserving confirmLabel.
- DropdownMenu.icon also accepts a rendered ReactNode. String behavior stays
  compatible; consumers can pass a React Lucide icon instead of asking native
  icon refresh to mutate an owned tree.

The parent reports 26 data tests, five disclosure tests, and 90 library tests
across Chromium/Firefox/WebKit passing. The final cross-worker coverage
reconciliation belongs to the parent. Source-only rows outside this ownership
scope below retain the initial audit findings; they are not claims that those
findings remain unresolved after the other workers' changes.

## Implemented And Tested

- Modal, AlertDialog, Sheet, Drawer: native open classes and panel markup;
  dialog semantics, title/description associations, named close controls,
  focus containment/restoration, scroll locking, nested Escape handling, SSR.
- Overlay hooks rank active layers by activation tokens, not DOM order.
  Tokens and previous focus enter the hook before child-first effects run.
  Tests cover both sibling open orders, simultaneous nesting, callback
  rerenders, reopen cycles, focus restoration, and StrictMode cleanup.
- Popover: native open class, callback/object ref composition, outside click,
  Escape dismissal before the enclosing modal.
- Tabs: linked tabs/panels, roving tabindex, ArrowLeft/Right, Home/End, and
  controlled selection. Inactive content retains the prior unmount behavior.
- CustomSelect: combobox/listbox semantics, keyboard selection, search focus,
  filter reset, trigger focus restoration, native selected/search classes,
  disabled control/options, and controlled change requests.
- Switch and Toggle: compose consumer handlers; honor preventDefault;
  retain controlled/uncontrolled state. Switch supports disabled and
  aria-disabled without sending disabled to a div.
- NumberField: disabled/read-only stepping and disabled controls at bounds.
- Select and Slider: explicit label associations and existing ref targets.
  Slider sends disabled and accessible-name props to its native range input.

## Validation

- Current owned browser suite: 62 tests passed with Chrome for Testing. The log
  lives at `/private/tmp/daub-react-overlay-final.log`.
- Current React typecheck and scoped diff checks passed. The TS7022 sibling
  inference issue is resolved with an explicit HTMLCollection annotation.
- The initial ESM/CJS/declaration builds passed. I did not rebuild dist during
  the parallel follow-up; the parent owns the final shared build.
- Browser assertions cover native CSS visibility, DOM semantics, focus,
  controlled callbacks, disabled states, and absence of browser/React errors.
- Four overlay panels fit 320px, 390px, and 1280px viewports. Screenshots live
  outside the repository at `/private/tmp/daub-react-review/`.
- Final combined React suites: 153 passed, 0 failed, including the owned suite's
  62 cases. All earlier controls/OTP reset failures cleared in the refreshed
  source snapshot. The log lives at `/private/tmp/daub-react-combined-final.log`.
- Final full `npm test`: 782 tests, 781 passed, one failed. The remaining gate is
  `search, browser history, variant markup, and keyboard tabs stay synchronized`
  in `tests/library/browser.test.mjs:48`. Its page.goBack call at line 57 timed
  out after 3000ms waiting for navigation until load. It failed in isolation too,
  so I do not classify it as concurrent browser-load noise. The parent owns this
  library-browser scope. Logs: `/private/tmp/daub-all-final.log` and
  `/private/tmp/daub-library-isolated-final.log`.
- Scoped `git diff --check` passed. This workspace has no React lint script.
- The configured typecheck covers all React source with the workspace's React
  19 types. These browser suites use its installed React 19 runtime; they do not
  constitute an independent React 18 runtime matrix.
- Source/test imports match the current adapters. Existing APIs and ref
  targets remain intact; new disabled props and the optional escape-hook ref
  argument extend them.

Run with the root Playwright dependency and the React workspace dependencies:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Users/stas/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" node --test tests/react/adapters.test.mjs
npm --prefix react run typecheck
npm --prefix react run build
```

Without the executable override, Playwright uses its installed default browser.
`REACT_SCREENSHOT_DIR` enables optional screenshot output. The tests bundle the
current source with the React workspace's esbuild, then render it in Chromium.

## Wrapper Coverage

`Browser` means focused tests exercise the wrapper. `Source` means I reviewed
its implementation without adding a browser acceptance case. An empty finding
does not establish accessibility, visual, or integration acceptance.

| Wrapper | Coverage | Result Or Remaining Gap |
| --- | --- | --- |
| Accordion | Source | Missing trigger/content IDs and relationships; closes by unmounting. |
| Alert | Source | No default alert/status announcement semantics. |
| AlertDialog | Browser | Native markup, accessible title/description, panel ref, theme, inert/focus and SSR; confirm class matches native CSS. |
| AspectRatio | Source | No issue identified in this source pass. |
| Avatar | Source | No image-load fallback state. |
| AvatarGroup | Source | Ignores max. |
| Badge | Source | No issue identified in this source pass. |
| BottomNav | Source | Missing href leaves noninteractive anchors; icon strings render as text. |
| Breadcrumbs | Source | Current-page semantics exist; nonfinal items need href from consumers. |
| Button | Source | Ignores icon; loading lacks aria-busy. Native button type remains consumer-controlled. |
| ButtonGroup | Source | No default group name or role. |
| Calendar | Source | Missing date labels/selection semantics and grid-keyboard behavior; month prop initializes once. |
| Card | Source | Missing native title/description classes; interactive flag adds styling without keyboard semantics. |
| Carousel | Source | Empty slides produce modulo-zero navigation; unnamed arrows; inactive slides retain focusable children. |
| Chart | Source | Missing accessible chart description and value bounds. |
| ChartCard | Source | No accessible chart association or empty-data state. |
| Checkbox | Source | Native input/ref and boolean state exist; no indeterminate prop. |
| CheckboxGroup | Source | Visible label/helper lack ARIA associations. |
| Chip | Source | Close control lacks an accessible name. |
| Collapsible | Source | Missing trigger/content IDs and relationships. |
| CommandPalette | Browser | Native markup, dialog/combobox/listbox semantics, filtering, disabled skipping, keyboard actions, synchronous reopen reset, panel ref, theme and SSR. |
| Container | Source | No issue identified in this source pass. |
| ContextMenu | Browser | Visible trigger/content, native menu classes, Shift+F10/right-click, item navigation, viewport clamp, ref and focus restoration. |
| CustomSelect | Browser | Semantics, selection/search, disabled states, option scroll/highlight, no-results announcement and ownership. Remaining: native form name/required integration and non-searchable typeahead. |
| DataTable | Source | React sorting/select-all state absent; checkboxes unnamed; native JS would mutate React-owned DOM. |
| DatePicker | Source | Label/input association, keyboard opening, Escape and dropdown semantics absent. |
| Drawer | Browser | Native markup, explicit accessible names, panel ref, theme, inert/focus, scroll and SSR. Remaining: swipe dismissal. |
| DropdownMenu | Browser | Native open/menu markup, composed trigger handlers/IDs/refs, keyboard navigation, disabled items, focus restoration and non-submit action buttons. |
| EmptyState | Source | No issue identified in this source pass. |
| Field | Source | Label/helper/error do not associate with the child control. |
| Fieldset | Source | Native legend exists; helper lacks a describedby association. |
| Frame | Source | No issue identified in this source pass. |
| Grid | Source | No issue identified in this source pass. |
| Group | Source | No issue identified in this source pass. |
| HoverCard | Browser | Focus/hover visibility, description association, Escape dismissal, consumer handler composition and forwarded ref. |
| Image | Source | Native image props/ref preserved; consumers must provide alt. |
| Input | Source | error only changes CSS; no aria-invalid mapping. |
| InputGroup | Source | No issue identified in this source pass. |
| InputIcon | Source | Decorative icons lack an automatic aria-hidden default. |
| InputOTP | Source | No paste/autofill distribution, numeric filtering or slot names; clearing a middle character shifts later characters. |
| Kbd | Source | Multi-key branch drops native props. |
| Label | Source | Native htmlFor preserved; required/optional are visual indicators. |
| List | Source | Ignores icon; no list/listitem semantics. |
| Meter | Source | Visual value clamps but aria-valuenow does not. |
| Modal | Browser | Native markup, explicit accessible names, panel ref, theme, activation-order inert/focus/Escape, scroll and SSR. |
| NavMenu | Source | Active-page semantics exist; items without href are not links. |
| Navbar | Source | No React mobile toggle; brand without href is not a link. |
| NumberField | Browser | Fixed disabled/read-only/bound stepping. Remaining: empty/partial numeric editing coerces to zero or clamps on each keystroke. |
| Pagination | Source | Buttons can submit enclosing forms; invalid perPage/current bounds need guards. |
| Popover | Browser | Native visibility, trigger ARIA/handlers/IDs, callback refs, outside click, nested Escape and content-focus restoration. |
| PreviewCard | Browser | Focus/hover visibility, description association, Escape dismissal, consumer handler composition and forwarded ref. |
| Progress | Source | Missing progressbar role/value semantics and value bounds. |
| Prose | Source | No issue identified in this source pass. |
| Radio | Source | Individual state exists; consumers need controlled coordination for same-name radios. |
| RadioGroup | Source | Omitted name leaves inputs outside a native named group, so arrow grouping lacks a default. |
| ScrollArea | Source | Consumers must name/focus scroll regions when keyboard access requires it. |
| Search | Source | Native search props/ref preserved; consumers must supply a label. |
| Select | Browser | Fixed label association; native props and ref target preserved. |
| Separator | Source | Vertical orientation lacks aria-orientation. |
| Sheet | Browser | Native panel markup, explicit accessible names, panel ref, theme, inert/focus, scroll and SSR. The native fixed-position wrapper can have zero size; its panel is visible. |
| Skeleton | Source | Decorative content lacks an automatic aria-hidden default. |
| Slider | Browser | Fixed label, disabled and accessible-name forwarding. Remaining: native form name/required and input-prop surface. |
| Spinner | Source | Status role and default accessible name exist. |
| Stack | Source | No issue identified in this source pass. |
| StatCard | Source | No issue identified in this source pass. |
| Stepper | Source | Active step lacks aria-current=step. |
| Surface | Source | No issue identified in this source pass. |
| Switch | Browser | Fixed event composition, disabled state, controlled requests and ref target. Remaining: native form submission/reset integration. |
| Table | Source | sortable adds styling without React sorting behavior; table props target the wrapper. |
| Tabs | Browser | Fixed keyboard and associations. Remaining: disabled-tab/vertical APIs, explicit tablist name and invalid selection bounds. |
| Textarea | Source | error only changes CSS; no aria-invalid mapping. |
| ThemeProvider | Browser | Nearest provider theme propagates into portals; plain children inherit scoped text/font on a scoped background. Actual dark/light computed colors and a root-only alias negative control verify it. |
| Toast | Source | Lacks live announcement semantics and named dismiss control; dismiss can submit a form. |
| ToastProvider | Browser | Timer cleanup retained; portal stack theme/ownership verified. Toast announcement semantics belong to the data worker. |
| Toggle | Browser | Fixed click composition/cancellation and controlled requests. |
| ToggleGroup | Source | Drops value/defaultValue/onChange/multiple instead of coordinating child toggles. |
| Toolbar | Source | Role exists; lacks roving focus and orientation mapping. |
| Tooltip | Browser | Native focused visibility, describedby merging, Escape dismissal, nested modal consumption and wrapper ref. |

## Integration Limits

- Repeated native initialization now has a mixed-ownership regression gate for
  controlled switches/tabs, menus, custom selects and modal portals.
- Cross-kind overlay z-index ordering and simultaneous native/React modal
  stacks need a shared-manager integration pass. I cannot unify the native and
  React focus/scroll managers within this ownership scope.
- Dropdown/popover/preview positioning at viewport edges needs collision and
  resize handling beyond the native CSS contract. ContextMenu clamps its fixed
  position. Touch swipe dismissal for Drawer remains open.
- Concurrent/Suspense activation and focus recovery after a subtree suspends
  need a separate integration gate; the current tests cover synchronous and
  StrictMode activation.
- I did not certify screen-reader output, touch gestures, all theme combinations
  or visual parity with Kitze UI. Parent workers own other wrappers' acceptance.
- The React README still lists 59 components and describes overlays as coming
  soon. I left documentation outside this report unchanged.

## Exact Changed Files

Original pass source:

- `react/src/components/AlertDialog.tsx`
- `react/src/components/CustomSelect.tsx`
- `react/src/components/Drawer.tsx`
- `react/src/components/Modal.tsx`
- `react/src/components/NumberField.tsx`
- `react/src/components/Popover.tsx`
- `react/src/components/Select.tsx`
- `react/src/components/Sheet.tsx`
- `react/src/components/Slider.tsx`
- `react/src/components/Switch.tsx`
- `react/src/components/Tabs.tsx`
- `react/src/components/Toggle.tsx`
- `react/src/hooks/useOverlay.ts`

Follow-up owned source (other workers' files excluded):

- `react/src/components/AlertDialog.tsx`
- `react/src/components/CommandPalette.tsx`
- `react/src/components/ContextMenu.tsx`
- `react/src/components/CustomSelect.tsx`
- `react/src/components/Drawer.tsx`
- `react/src/components/DropdownMenu.tsx`
- `react/src/components/HoverCard.tsx`
- `react/src/components/Modal.tsx`
- `react/src/components/Popover.tsx`
- `react/src/components/PreviewCard.tsx`
- `react/src/components/Sheet.tsx`
- `react/src/components/ThemeProvider.tsx`
- `react/src/components/ToastProvider.tsx`
- `react/src/components/Tooltip.tsx`
- `react/src/hooks/useOverlay.ts`

Tests and this report:

- `tests/react/adapters.test.mjs`
- `tests/react/fixture.tsx`
- `tests/react/COVERAGE.md`

Build outputs regenerated during the initial pass, not this follow-up:

- `react/dist/index.d.mts`
- `react/dist/index.d.ts`
- `react/dist/index.js`
- `react/dist/index.js.map`
- `react/dist/index.mjs`
- `react/dist/index.mjs.map`

I did not edit shared CSS, native JS, renderer files, root package metadata,
shared docs, or other contributors' tests. No commit or deployment.
