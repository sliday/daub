# Changelog

All notable changes to DAUB are documented here.

## v2.5.0

**Skeuomorphism & configurator redesign. 74 components, 20 theme families.**

- Letterpress text shadows: `--db-text-emboss` and `--db-text-emboss-subtle` CSS variables for crisp pressed-in type on headings, buttons, and labels
- Per-element texture overlay: `::after` pseudo-elements apply grain/paper/metal/wood texture to cards, buttons, navbars, modals, alerts, and surfaces
- Enhanced inner shadows: `--db-shadow-inset` adds bottom inner glow for realistic recessed surfaces
- Beveled edges: inset top-glow + bottom-shadow on cards, buttons, and raised surfaces for 3D lit-from-above effect
- Configurator redesign: tab-based theme selector (Originals/Classics/Modern/Trending), always-visible code snippet with integrated copy button
- Theme switcher: palette icon replaces paint roller, category tabs in popover, inline popover variant for configurator
- Texture system: body background texture + per-element texture with blend mode and opacity controls
- Fix: void elements (`<input>`, `<textarea>`, `<select>`) texture via wrapper elements instead of pseudo-elements

## v2.4.0

**20 theme families (40 variants) in 4 categories.**

- 14 new theme families: Dracula, Nord, One Dark, Monokai, Gruvbox, Night Owl, GitHub, Catppuccin, Tokyo Night, Material, Synthwave, Shades of Purple, Ayu, Horizon
- Theme categories: Originals, Classics, Modern, Trending — organized in `DAUB.THEME_CATEGORIES`
- Category API: `DAUB.getCategory('dracula')` returns category name
- Theme switcher: categorized popover with 3-segment accent swatches (light/accent/dark)
- Scheme row: Auto/Light/Dark toggle in theme switcher popover
- AI integration: `components.json` (74 components with HTML examples), `daub.d.ts` TypeScript declarations
- Backward compatible: all v2.3.0 APIs unchanged

## v2.3.0

**Layout system, navbar & developer experience. 74 components.**

- Navbar: sticky top app bar with brand, nav links, spacer, actions, and mobile hamburger toggle
- Grid 4/5/6 columns: `db-grid--4`, `db-grid--5`, `db-grid--6` with tablet breakpoint (1024px)
- Responsive visibility: `db-hide-mobile`, `db-show-mobile`, `db-hide-tablet`, `db-show-tablet`, `db-hide-desktop`, `db-show-desktop`
- Container variants: `db-container--wide` (1200px), `db-container--narrow` (640px)
- Card media variant: `db-card--media` removes padding for edge-to-edge images
- Chip active state: `db-chip--active` with `data-db-chip-toggle` container for filter chips
- Avatar group: `db-avatar-group` with overlapping stack and `__overflow` counter
- Search input: `db-search` with icon prefix and auto-show clear button
- Modal API: both `openModal` and `closeModal` now accept string ID or element reference
- Icon integration: `DAUB.refreshIcons()` helper for Lucide re-initialization after dynamic content
- Full-page recipes: Dashboard, Pinterest grid, and Settings form templates in llms.txt
- Data attributes reference: complete table of all `data-*` attributes in llms.txt

## v2.2.0

**Theme families + accent color picker.**

- Theme families: 6 families (Default, Grunge, Solarized, Ink, Ember, Bone) x light/dark = 12 variants
- Solarized theme: replaces Parchment with warm tinted / dusky amber palette
- New palettes: `solarized-dark`, `ink-light`, `ember-light`, `bone-dark`
- Scheme control: `DAUB.setScheme('auto'|'light'|'dark')` — separate from family selection
- Family API: `DAUB.setFamily('ink')`, `DAUB.getFamily()`, `DAUB.cycleTheme()` cycles 6 families
- Accent color picker: 12 curated natural colors + reset, persisted to localStorage
- `DAUB.setAccent(hex)` / `DAUB.resetAccent()` / `DAUB.getAccent()` API
- FOUC prevention: now restores scheme and accent color before paint
- Theme switcher: 3x2 family grid + 3-button scheme row (replaces 4x2 theme grid)
- Backward compatible: `DAUB.setTheme('dark')` still works directly
- Bug fixes: modal centering on all viewports, toast visibility in dark themes, sheet/drawer height consistency, tooltip positioning edge-case corrections

## v2.1.1

**"Daub" definition + housekeeping.**

- Hero: dictionary-style "daub" definition below the headline
- Fixed component count across meta tags, structured data, and showcase stats (64 -> 67)
- Updated JSON-LD version to 2.1.1

## v2.1.0

**67 components. Semantic tokens, ghost buttons, input icons, chips, bottom nav, sidebar collapse.**

- Semantic design tokens: theme-aware aliases (`--db-color-bg`, `--db-color-text`, `--db-color-accent`, etc.) that auto-resolve across all 12 theme variants
- Ghost button: transparent `db-btn--ghost` variant for subtle actions
- Icon button colors: `db-btn--icon-danger`, `--icon-success`, `--icon-accent` with tinted hover backgrounds
- Input with icon: `db-input-icon` with prefix/suffix icon positions and `:focus-within` highlight
- Chip/Tag: `db-chip` with 6 color presets and arbitrary HSL color support via `--db-chip-h/s/l`
- Bottom navigation: `db-bottom-nav` for mobile apps with badge support and safe-area padding
- Sidebar collapse: `db-sidebar--collapsed` mode with hover tooltips and `db-sidebar__toggle` button
- `DAUB.toggleSidebar()` JS API for programmatic sidebar collapse

## v2.0.3

**Noise texture, grunge corners & bug fixes.**

- Noise texture slider: adjustable grain overlay via `--db-noise` CSS variable with persistence
- Grunge themes: sharp corners (2-3px radius) for typewriter/rough aesthetic
- Vertical stepper: new `db-stepper--vertical` modifier for timeline layouts
- Primary button hover/active fix: `<a>` elements no longer lose white text on hover
- Tooltip wrapping: long text wraps gracefully instead of clipping
- Card overflow: `overflow: hidden` prevents child elements from bleeding
- Card border-radius uses `--db-radius-4` variable (theme-aware)
- Showcase panel radius uses CSS variables for theme adaptability

## v2.0.2

**Nested border-radius & card refinement.**

- Nested border-radius JS utility: auto-calculates `innerRadius = outerRadius - padding` for cards, modals, sheets, drawers
- Showcase frame: generous 36px radius with auto-computed inner radii
- Card border-radius: increased from 12px to 20px for softer, more premium feel
- `DAUB.fixNestedRadius()` exposed in public API for dynamic content

## v2.0.1

**Polish pass — 10 quality fixes.**

- Install snippet: 2-line layout showing both CSS and JS files
- Button active state: instant press feedback, no light-color blink
- Calendar hover: selected day keeps terracotta gradient on hover
- Theme switcher: nested border-radius (12px outer - 4px padding = 8px inner)
- Theme switcher: mobile-friendly 8x1 horizontal toolbar on small screens
- Warmth slider: 3x stronger visual effect (saturate + sepia range increased)
- Showcase: replaced fake Email/Subscribe with "Try it live" demo controls
- Component index: centered tabs with gap below sticky nav
- Copy button: absolute positioning for consistent visibility on all screens

## v2.0.0

**64 components. 6 theme families (12 variants). Zero build step.**

- 36 new components: Data Table, Custom Select, Command Palette, Carousel, OTP Input, Resizable panels, Hover Card, Context Menu, Menubar, Sidebar, Drawer, Sheet, Alert Dialog, Toggle Group, Button Group, Input Group, Spinner, Kbd, Separator, Native Select, Aspect Ratio, Scroll Area, Date Picker, Chart, Nav Menu, Label, and more
- 4 new themes: Solarized, Ink, Ember, Bone
- CSS-only components: Separator, Spinner, Kbd, Input, Toggle, Button Group, Native Select
- Prose typography system with scale variants
- Layout utilities: `db-container`, `db-flex`, `db-grid`, `db-gap-*`
- Warmth slider: adjust page warmth via CSS custom property with persistence
- Theme switcher: dark-glass treatment for universal legibility across all themes
- Calendar today highlight: visible background tint + strong border
- 8px grid alignment throughout
- Nested border-radius fix for cards and modals

## v1.1.0

- Initial release: 28 components, 4 themes
