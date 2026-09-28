# Jev recipes for DAUB

Jev is TypeSafe's decision model on OpenRouter (`~typesafe/jev-latest`, currently `typesafe/jev-1.13`). You send `state` (the context) and named `questions`; it returns a typed answer with probabilities for each question. It cannot write text, specs or code. In a DAUB flow, Jev makes the narrow calls (which components, which block, which theme) and a writer model or your code produces the UI.

## Call it

`POST https://openrouter.ai/api/alpha/decisions` with `Authorization: Bearer <your OpenRouter key>`. Jev rejects `chat/completions`.

Use your own key. `https://daub.dev/api/choose` and `/api/generate` accept only daub.dev origins and run on the site's rate-limited key; they are not a public API.

Question types:

| Type | Asks | Answer |
|---|---|---|
| `noul` | Does this hold? `criteria: { "true": "...", "false": "..." }` | `{ "noul": 0.93 }`, the probability of yes |
| `choice` | Which option? `criteria: { "<option>": "<description>", ... }` | `{ "choice": "nord", "confidence": 0.81, "probabilities": { ... } }` |
| `score` | Where on an ordered scale? `criteria: ["low", "mid", "high"]` | `{ "score": 1.7, "confidence": 0.9, "probabilities": { "0": 0.1, ... } }` |

Many questions fit in one request (the playground sends 65). Context limit: 32k tokens for state plus questions. You pay for input tokens only; every response carries `usage.cost` in USD.

## Recipe 1: pick components

The playground and the hosted MCP ask one `noul` per component and put full props only for the picked ones into the writer's prompt. On a dashboard prompt that cut the OpenUI system prompt from 8.3k to 5.0k characters.

Tuning, from 39 labeled prompts and about 990 Jev calls: describe each component by a one-line purpose (not its props), keep `p(yes) >= 0.45`. That reached 96% recall of must-have components at about 13 picks per prompt, with 0.2% wrong picks. Always keep the core layout types, which the questions leave out.

Request shape (two of the 65 questions shown):

```json
{
  "model": "~typesafe/jev-latest",
  "state": { "request": "Account settings with email and push notification preferences and a delete-account confirmation" },
  "questions": {
    "Switch": {
      "type": "noul",
      "instructions": "Should the generated UI use the DAUB \"Switch\" component (an on/off switch for a setting)?",
      "criteria": {
        "true": "The requested UI clearly benefits from a Switch.",
        "false": "A Switch is not needed for this request."
      }
    },
    "AlertDialog": {
      "type": "noul",
      "instructions": "Should the generated UI use the DAUB \"AlertDialog\" component (a confirmation dialog for destructive actions)?",
      "criteria": {
        "true": "The requested UI clearly benefits from a AlertDialog.",
        "false": "A AlertDialog is not needed for this request."
      }
    }
  }
}
```

Response: `{ "answers": { "Switch": { "type": "noul", "noul": 0.97 }, "AlertDialog": { "type": "noul", "noul": 0.9 } }, "model": "...", "usage": { "cost": 0.00025, ... } }`.

```js
// PURPOSE: the purpose map at the end of this file. CORE: the core set above it.
async function pickComponents(request, apiKey, { threshold = 0.45, keep = [] } = {}) {
  const questions = {};
  for (const [name, purpose] of Object.entries(PURPOSE)) {
    questions[name] = {
      type: 'noul',
      instructions: `Should the generated UI use the DAUB "${name}" component (${purpose})?`,
      criteria: { true: `The requested UI clearly benefits from a ${name}.`, false: `A ${name} is not needed for this request.` },
    };
  }
  try {
    const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: '~typesafe/jev-latest', state: { request }, questions }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const { answers } = await res.json();
    const picked = Object.keys(answers).filter(n => answers[n].noul >= threshold);
    if (!picked.length) return null;
    return [...new Set([...CORE, ...picked, ...keep])]; // keep: types already in a spec you are editing
  } catch {
    return null; // timeout or network error
  }
}
```

`null` means "use the full catalog". Then list full props for picked types and names only for the rest ("ALSO AVAILABLE, use only if clearly needed"). Specs bound for the hosted MCP should drop `Icon` from the core set, since its validator rejects that type.

## Recipe 2: pick a block

Two `choice` calls keep each option list short: first the category, then a block inside it. Build the criteria from `references/blocks.md` or `blocks/index.json`: the block name plus the components it uses.

```json
{
  "model": "~typesafe/jev-latest",
  "state": { "request": "A pricing section with monthly and yearly plans for a note-taking app" },
  "questions": {
    "category": {
      "type": "choice",
      "instructions": "Which DAUB block category fits the section the request asks for?",
      "criteria": {
        "hero": "Top-of-page hero with headline, subhead and call to action",
        "pricing": "Plans, prices and billing period selection",
        "features": "Grid or list of product features",
        "faq": "Questions and answers",
        "cta": "A closing call-to-action band",
        "social-proof": "Testimonials, reviews and customer quotes"
      }
    }
  }
}
```

Follow up with a `choice` over the blocks of the winning category, for example `"pricing-toggle-01": "Pricing Toggle: Stack, Text, ToggleGroup, Grid, Card, Button"`. If `confidence` is below about 0.5, show the top two to the writer model instead of one. Block picking has not been benchmarked in this project; spot-check the picks.

## Recipe 3: pick a theme family

One `choice` over the 21 families, plus a `noul` for dark mode. Then take the light or dark theme of that family from `references/themes.md`.

```json
{
  "model": "~typesafe/jev-latest",
  "state": { "request": "A cozy recipe journal for home bakers" },
  "questions": {
    "family": {
      "type": "choice",
      "instructions": "Which DAUB theme family best fits the look and feel of the requested UI? If the request names a theme, pick that one.",
      "criteria": {
        "default": "DAUB signature look: warm cream background with terracotta accent. Use when the request has no style preference.",
        "grunge": "Gritty, distressed retro-punk look in muddy browns. Good for retro or nostalgic UIs.",
        "solarized": "Solarized beige and teal, calm, classic developer palette.",
        "ink": "Cool blue-gray ink tones, sober and editorial.",
        "ember": "Warm dark embers with a glowing copper accent.",
        "bone": "Stark minimal off-white and gray with lots of whitespace. Good for minimal, clean UIs.",
        "dracula": "Dracula dark purple code-editor palette. Good for dark UIs, code tools and dev tools.",
        "nord": "Nord arctic blue-gray, calm and clean. Good for minimal, clean UIs.",
        "one-dark": "Atom One Dark code-editor palette.",
        "monokai": "Monokai vivid neon-on-dark code-editor palette.",
        "gruvbox": "Gruvbox warm, earthy retro tones. Good for warm, cozy UIs.",
        "night-owl": "Night Owl deep-blue night-coding palette.",
        "github": "GitHub-style neutral grays and blue product UI. Good for dashboards and analytics.",
        "catppuccin": "Catppuccin soft, friendly pastels. Good for warm, cozy UIs.",
        "tokyo-night": "Tokyo Night dark blue and purple neon-city palette. Good for dark UIs, code tools and dev tools.",
        "material": "Material Design clean app UI. Good for dashboards and analytics.",
        "monospace": "Monospaced typewriter or terminal look, brutalist.",
        "synthwave": "Synthwave 80s neon pink and purple. Good for retro or nostalgic UIs.",
        "shades-of-purple": "Bold saturated purples, playful.",
        "ayu": "Ayu bright and clean with an orange accent.",
        "horizon": "Horizon warm dark palette with coral-pink accent."
      }
    },
    "dark": {
      "type": "noul",
      "instructions": "Does the request ask for or clearly imply a dark interface?",
      "criteria": {
        "true": "The request says dark, night, terminal, code editor, or neon-on-dark.",
        "false": "The request does not call for a dark interface."
      }
    }
  }
}
```

On 8 labeled theme prompts, this wording matched the hand-written heuristic in 6 of 8 (5 of 8 without the "Good for" hints). Both misses were defensible dark code palettes: `monospace` for a terminal-style console and `one-dark` for an IDE, where the heuristic wanted `dracula` or `tokyo-night`. Treat the result as a suggestion the user can override.

## Cost and latency

- About 300-550 ms per request, including 65 questions.
- About $0.00025 per 65-question component pick. Output tokens are free.
- Budget a 4 s timeout and fall back to the no-Jev path on any error, timeout or empty answer.

## When not to use Jev

- To write anything: specs, copy, code or explanations. It returns probabilities only.
- To judge a finished UI from a text outline. A blind benchmark here (draft, Jev check, repair) moved judged quality by +0.01 (CI -0.16 to +0.15): Jev read an outline while the judges read pixels, and an outline cannot show broken images, empty icon slots or whitespace. Review screenshots with a vision model instead (`references/verify.md`).
- To trigger automatic repair from a soft signal such as a middling probability. Repair only on hard failures you can check in code.
- When the request carries images, web pages or Figma frames. Jev sees only the typed text, so the playground skips the picker for those and uses the full catalog.
- When the request already names the components, or the catalog is small enough to send whole.

## Purpose map

<!-- BEGIN GENERATED:purpose-map (tools/build-skill.mjs) -->
Core set (always kept, never asked): `Stack`, `Grid`, `Text`, `Card`, `Button`, `Icon`, `Separator`.
Threshold: `p(yes) >= 0.45` in the playground (tuned value). The hosted MCP `generate_ui` uses `0.5`.

Purpose map (65 questions, one per non-core type), copied from `COMP_PURPOSE` in playground.html:

```json
{
  "Surface": "a raised or inset background panel that groups content",
  "Prose": "long-form rich text such as an article body",
  "Link": "an inline text hyperlink",
  "ButtonGroup": "a row of joined buttons",
  "Field": "a labeled form input with helper or error text",
  "Input": "a single-line text input",
  "InputGroup": "an input with a prefix or suffix addon such as $ or .com",
  "InputIcon": "an input with an icon inside it",
  "Search": "a search box",
  "Textarea": "a multi-line text input for comments, bios or messages",
  "Checkbox": "a checkbox for opting in, agreeing to terms or selecting items",
  "RadioGroup": "a set of radio buttons to pick exactly one visible option",
  "Switch": "an on/off switch for a setting",
  "Slider": "a draggable range control for volume, price or another number",
  "Toggle": "a single pressable on/off button",
  "ToggleGroup": "a segmented control to pick one option, such as Monthly/Yearly or Grid/List",
  "Select": "a dropdown to choose one option from a list",
  "CustomSelect": "a searchable dropdown for long option lists",
  "Kbd": "a keyboard shortcut hint such as Cmd+K",
  "Label": "a standalone form label",
  "Spinner": "a loading spinner",
  "InputOTP": "one-time passcode boxes for entering a verification code",
  "Tabs": "tabs that switch between panels of content",
  "Breadcrumbs": "a breadcrumb trail showing the page hierarchy",
  "Pagination": "page number controls for long lists or tables",
  "Stepper": "a multi-step progress indicator for wizards or checkout",
  "NavMenu": "a horizontal row of navigation links",
  "Navbar": "a top header bar with brand and navigation",
  "Menubar": "a desktop-app menu bar with File/Edit/View dropdowns",
  "Sidebar": "a vertical side navigation with sections",
  "BottomNav": "a mobile bottom tab bar",
  "Table": "a data table with columns and rows",
  "DataTable": "an interactive data table with selectable rows",
  "List": "a vertical list of items with title, secondary text and icon",
  "Badge": "a small status label or count",
  "Avatar": "a user profile picture or initials",
  "AvatarGroup": "a stacked row of several user avatars",
  "Calendar": "a month calendar grid for picking or showing dates",
  "Chart": "a bar chart",
  "Carousel": "a sliding slideshow of images or cards",
  "AspectRatio": "a fixed aspect-ratio frame for images or video",
  "Chip": "a tag or filter pill",
  "ScrollArea": "a scrollable region",
  "Image": "an image or photo",
  "Alert": "an inline callout banner for info, warning, error or success messages",
  "Progress": "a progress bar",
  "Skeleton": "loading placeholder shapes",
  "EmptyState": "a placeholder message shown when there is no content or nothing was found",
  "Tooltip": "a hint shown on hover",
  "Modal": "a dialog window over the page for forms or content",
  "AlertDialog": "a confirmation dialog for destructive actions",
  "Sheet": "a side panel that slides over the page",
  "Drawer": "a bottom drawer that slides up",
  "Popover": "a small floating panel anchored to a button",
  "HoverCard": "a preview card shown when hovering a link or user",
  "DropdownMenu": "a menu of actions opened from a button",
  "ContextMenu": "a right-click menu of actions",
  "CommandPalette": "a Cmd+K searchable command launcher",
  "Accordion": "stacked expandable sections such as an FAQ",
  "Collapsible": "a single show/hide section",
  "Resizable": "split panes with a draggable divider",
  "DatePicker": "a date input with a calendar popup",
  "StatCard": "a KPI metric card with a value and trend",
  "ChartCard": "a titled card that holds a chart",
  "CustomHTML": "custom HTML and JS for anything no built-in component covers"
}
```
<!-- END GENERATED:purpose-map -->
