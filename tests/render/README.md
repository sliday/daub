# Catalog and Renderer Checks

Run from the repository root:

```sh
npm install
npx playwright install chromium
node --test tests/render/*.test.mjs
```

For an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. The suites import the root `playwright` dependency. They fulfill browser requests through Playwright routes, load repository CSS and JavaScript, and need no HTTP server or external service.

## Coverage

- 91 catalog components: useful HTML, named controls, label targets, overlay trigger targets, complete calendar grids, navigation destinations, nested-button rejection, placeholder rejection, and repository image paths and loading.
- Catalog modifier selectors: each advertised modifier has a matching CSS selector.
- Catalog interactions: six overlay examples open and close, Number Field steps and respects its minimum, Date Picker selects a date, Data Table selects and sorts rows, and Toolbar toggles formatting.
- 89 renderer types: representative props and children, named controls, root creation, and nested-button rejection. Tests require a fixture for each registered type. The additions cover Checkbox Group, Fieldset, Frame, Group, Meter, Number Field, Preview Card, Toolbar, Message Scroller, Message, Bubble, Attachment, and Marker.
- Renderer regressions: child field labels/helpers/errors, values and disabled states, zero spacing and numeric values, table cells, default tabs, pagination, date-only parsing in a negative UTC offset, chart scaling, named dialogs, usable popup triggers, navigation URLs, prose attribute escaping, avatar fallback, chart empty states, collapsed sidebar names, image loading, and icon positioning.

- MCP contracts: browser/snapshot body equality, local/cloud type catalogs and shared validation, 42 theme names against native JavaScript and CSS, new Cloud OpenUI types, rendered controls and color tokens at desktop/mobile widths, theme/spec script-literal injection, orphan slot uniqueness, and standalone package rendering without the root checkout. Tests fulfill CDN and font requests with local fixtures.
- Chat contracts: children-first OpenUI signatures, stable row IDs and turn anchors, depth limits, plain text escaping, safe image/link URLs, app-controlled reactions and attachment states, progress bounds, and overlay/action separation. Local/cloud exports initialize native scroll commands at 1280px and 390px without duplicate visible IDs or page overflow.

The tests check HTML structure and focused behaviors; they do not establish full WCAG conformance or a subjective visual-quality score.

The scoped run passes 319 checks with `node --test --test-concurrency=1 tests/render/*.test.mjs`. Chromium requires permission to register its macOS MachPort; a sandbox launch denial prevents browser suites from reaching their assertions. An earlier integration run passed 646 of 647 root tests; the component-browser history test hit a 3-second `page.goBack()` timeout. Its suite then passed all 89 checks in isolation without edits.

A later serial root run passed 711 of 713 tests. The React suite's new uncontrolled OTP-reset and ToggleGroup-reset tests failed. Their owner needs to address them; this task leaves React files untouched.

## Renderer Snapshot

`daub-render.js` exports `DAUB_RENDER_BODY` in Node and retains the browser globals. The MCP package embeds a generated snapshot, so its renderer does not read outside the installed package. The cloud endpoint embeds the same body instead of downloading the browser renderer at runtime.

```sh
node tests/render/sync-renderers.mjs --write
node tests/render/sync-renderers.mjs
```

After changing the canonical renderer, regenerate the snapshot and run the parity test. This includes the type registry and theme list. The shared validator imports the generated registry; local and cloud tool handlers use that validator.

The generated snapshot stores a literal body string, so bundling cannot change it through a runtime function `toString()`. A local esbuild probe bundled and minified the cloud endpoint with `keepNames` enabled; its `render_spec` response retained the canonical body and passed validation.

## Catalog Changes

The examples include complete modal content and triggers, static toast anatomy, a full calendar in Date Picker, CSS bars in Chart Card, activity rows in Scroll Area, initials instead of broken avatar URLs, and the repository's `/og-image.png` in Aspect Ratio. Number Field uses native `stepUp`/`stepDown` and emits an input event. Toolbar uses pressable Toggle controls. Examples use button types and descriptive navigation destinations.

Overlay triggers use `data-db-modal-trigger` for Modal and `data-db-trigger` for Alert Dialog, Sheet, and Drawer. Command Palette uses `data-db-command-trigger` as a preview discovery hook plus an inline `DAUB.openCommand('cmd')` action. The two modal examples use distinct IDs: `my-modal` and `overlay-example`.

## Boundaries

- The HTML catalog and renderer registry have different scopes: 91 CSS/catalog entries and 89 spec renderer types, including layout aliases and helpers.
- App-specific commands such as Save, Create, and Export expose controls for consumers to wire; the catalog does not create an application backend.
- `mcp/server.js` still hardcodes a stale theme catalog outside this task's file ownership. Its owner needs to import `THEMES` from `lib/prompt.js` and return that object. The shared prompt and cloud catalog expose the 42 supported names.
- The browser/OpenUI parser and playground catalogs need their owners to expose the new types. This task updates the owned cloud OpenUI schema.
- Generated HTML still loads CSS/native JavaScript and icons from CDNs. Offline tests prove local contracts; they do not verify the deployed CDN versions. `CustomHTML` remains a trusted-author feature with raw HTML/CSS capabilities. Script-literal escaping does not turn it into an untrusted-content sandbox.
- The first phase changed catalog examples. The continuation changes `daub-render.js`, `mcp/lib/renderers.js`, `mcp/lib/render.js`, `mcp/lib/prompt.js`, `mcp/lib/validate.js`, `functions/api/mcp.js`, and this directory. It does not commit or deploy.

## Browser Evidence

On the local `component-preview.html` bridge, the Aspect Ratio example loaded `/og-image.png` with a natural size of 1200 by 630 pixels. A 390px viewport displayed the image within a 358px-wide preview; a 1280px viewport also loaded it. Screenshots from this check reside at `/private/tmp/daub-aspect-ratio-mobile.png` and `/private/tmp/daub-aspect-ratio-desktop.png`.

The current social preview artwork lists 91 components and 21 theme families. Its source is `og-template.html`.

Desktop/mobile screenshots of the new MCP-rendered types reside in `/private/tmp/daub-render-contracts/`. Set `DAUB_RENDER_SCREENSHOTS` when running the MCP contract suite to capture them again. The npm dry-run package inventory includes the renderer snapshot and all required local library modules.
