# DAUB themes

A theme is one value of the `data-theme` attribute on `<html>`. Each family has a light and a dark theme, and the names do not follow one pattern: in some families the bare name is light (`solarized`, `github`, `catppuccin`, `ayu`), in others it is dark (`ink`, `ember`, `material`, `monospace`). Copy names from this table.

<!-- BEGIN GENERATED:families (tools/build-skill.mjs) -->
| Family | Category | Light theme | Dark theme | Character |
|---|---|---|---|---|
| `default` | originals | `light` | `dark` | Warm cream / deep charcoal |
| `grunge` | originals | `grunge-light` | `grunge-dark` | Typewriter / ink-stained |
| `solarized` | originals | `solarized` | `solarized-dark` | Aged paper / antiqued leather |
| `ink` | originals | `ink-light` | `ink` | Cool editorial / navy silver |
| `ember` | originals | `ember-light` | `ember` | Sunlit pottery / copper glow |
| `bone` | originals | `bone` | `bone-dark` | Stark white / grayscale brutalism |
| `dracula` | classics | `dracula-light` | `dracula` | Alucard warmth / vampire purple |
| `nord` | classics | `nord-light` | `nord` | Snow storm / arctic frost |
| `one-dark` | classics | `one-dark-light` | `one-dark` | Soft atom / midnight code |
| `monokai` | classics | `monokai-light` | `monokai` | Warm latte / neon noir |
| `gruvbox` | classics | `gruvbox-light` | `gruvbox` | Retro cream / earthy dark |
| `night-owl` | modern | `night-owl-light` | `night-owl` | Soft dawn / deep twilight |
| `github` | modern | `github` | `github-dark` | Clean primer / dimmed slate |
| `catppuccin` | modern | `catppuccin` | `catppuccin-dark` | Latte pastel / mocha warmth |
| `tokyo-night` | modern | `tokyo-night-light` | `tokyo-night` | Storm light / city neon |
| `material` | modern | `material-light` | `material` | Lighter paper / palenight haze |
| `monospace` | modern | `monospace-light` | `monospace` | Terminal paper / phosphor console |
| `synthwave` | trending | `synthwave-light` | `synthwave` | Warm retro / neon purple |
| `shades-of-purple` | trending | `shades-of-purple-light` | `shades-of-purple` | Soft lavender / deep violet |
| `ayu` | trending | `ayu` | `ayu-dark` | Warm light / mirage dark |
| `horizon` | trending | `horizon-light` | `horizon` | Soft rose / warm dusk |

21 families, 42 theme names. `light` (the default) and `dark` are the `default` family.
<!-- END GENERATED:families -->

<!-- BEGIN GENERATED:mcp-invalid (tools/build-skill.mjs) -->
Every theme name the hosted MCP catalog lists is valid.
<!-- END GENERATED:mcp-invalid -->

## Set a theme

- In a spec: `"theme": "nord-light"` at the root, or `__theme = "nord-light"` in OpenUI Lang.
- In HTML: `<html data-theme="nord-light">`.
- In JS: `DAUB.setTheme('nord-light')` sets an exact name and ignores unknown ones. `DAUB.setFamily('nord')` picks the family and keeps the current scheme; `DAUB.setScheme('light' | 'dark' | 'auto')` switches mode within the family. `DAUB.cycleTheme()`, `DAUB.getTheme()`, `DAUB.getFamily()`, `DAUB.THEME_FAMILIES` and `DAUB.THEME_CATEGORIES` round it out.
- Accent: `DAUB.setAccent('#6B7C3E')` swaps the accent color (primary buttons, links, active states) in any theme; `DAUB.resetAccent()` undoes it.
- `daub.js` stores the choice in `localStorage` (`db-theme`, `db-scheme`, `db-accent`). A stored theme wins over the `data-theme` attribute on the next load, so clear `db-theme` when a page must open in its own theme.
- `grunge-*` themes load the Special Elite font from Google Fonts on first use.

## Pick a theme

Match the request, then the product:

- The user names a theme or family: use it. "Make it dark": the dark theme of the current family.
- Dashboards, analytics, admin: `github` or `material-light`.
- Developer tools, code, terminals: `dracula`, `tokyo-night` or `monospace`.
- Minimal, clean, editorial: `bone` or `nord-light`.
- Warm, cozy, food, education: `gruvbox-light` or `catppuccin`.
- Retro, music, nightlife: `synthwave` or `grunge-dark`.
- Healthcare, legal, finance: `nord-light`, `bone` or `material-light`, and avoid neon palettes.
- No signal: `light`, the DAUB default (warm cream with a terracotta accent).

To let a model decide, ask Jev one `choice` question over the family names (`references/jev.md`), then pick the light or dark theme of that family.
