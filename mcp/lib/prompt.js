import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LAYOUT_RULES_COMPACT, LANDING_PAGE_RULES, detectLandingIntent, detectIndustryIntent, detectMobileIntent, MOBILE_DESIGN_RULES, PAGE_FORMULAS } from './design-knowledge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load block library index
let BLOCK_INDEX = [];
try {
  BLOCK_INDEX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'blocks', 'index.json'), 'utf-8'));
} catch {
  BLOCK_INDEX = [];
}

// Current COMP_PROPS from playground.html (Stack/Grid, not legacy Layout)
export const COMP_PROPS = {
  Stack: 'direction: "vertical"|"horizontal", gap: 0-6 (default 2=8px), justify: "center"|"end"|"between"|"evenly" (main-axis), align: "center"|"end"|"start"|"stretch" (cross-axis), wrap: bool (default true for horizontal), container: "wide"|"narrow"|true',
  Grid: 'columns: 2-6, gap: 0-6 (default 2=8px), align: "center"|"end", container: "wide"|"narrow"|true',
  Surface: 'variant: "raised"|"inset"|"pressed"',
  Text: 'tag: "h1"|"h2"|"h3"|"h4"|"p"|"span", content: string (the visible text), class: string | UX: tag is the HTML element, content is the displayed text — never swap them',
  Prose: 'content: string (HTML), size: "sm"|"lg"|"xl"|"2xl"',
  Separator: 'vertical: bool, dashed: bool, label: string',
  Button: 'label: string, variant: "primary"|"secondary"|"ghost"|"icon-danger"|"icon-success"|"icon-accent", size: "sm"|"lg"|"icon", loading: bool, icon: string, trigger: "overlayId" (opens Modal/AlertDialog/Sheet/Drawer by id) | UX: one primary per view, loading:true during async, verb-first labels',
  ButtonGroup: '(children are Buttons)',
  Field: 'label: string, placeholder: string, type: "text"|"email"|"password"|"number", error: bool, helper: string | UX: always include label, helper for complex inputs, error near field',
  Input: 'placeholder: string, size: "sm"|"lg", error: bool, type: "text"|"email"|"password"|"number"|"tel"|"url"|"search"|"date"|"time" | UX: wrap in Field for label+helper, or pair with Label',
  InputGroup: 'addonBefore: string, addonAfter: string (child is Input)',
  InputIcon: 'icon: string, right: bool (child is Input)',
  Search: 'placeholder: string',
  Textarea: 'placeholder: string, rows: number, error: bool',
  Checkbox: 'label: string, checked: bool',
  RadioGroup: 'options: [{label, value}], selected: string',
  Switch: 'label: string, checked: bool',
  Slider: 'min: number, max: number, value: number, step: number, label: string',
  Toggle: 'label: string, pressed: bool, size: "sm"',
  ToggleGroup: 'options: [{label, value}], selected: string',
  Select: 'label: string, options: [{label, value}], selected: string',
  CustomSelect: 'placeholder: string, options: [{label, value, selected: bool, disabled: bool}], searchable: bool',
  Kbd: 'keys: [string]',
  Label: 'text: string, required: bool, optional: bool',
  Spinner: 'size: "sm"|"lg"|"xl"',
  InputOTP: 'length: number, separator: bool',
  Tabs: 'tabs: [{label, id}], active: string, children: [childIds] (one child per tab — each child becomes a tab panel; order matches tabs array)',
  Breadcrumbs: 'items: [{label, href}]',
  Pagination: 'current: number, total: number, perPage: number',
  Stepper: 'steps: [{label, status: "completed"|"active"|"pending"}], vertical: bool | UX: one active step at a time, completed steps should be revisitable',
  NavMenu: 'items: [{label, href, active: bool}]',
  Navbar: 'brand: string, brandHref: string',
  Menubar: 'items: [{label, dropdown: [{label, href}]}]',
  Sidebar: 'sections: [{title, items: [{label, icon, active, href}]}] (inline objects, NOT element ID references), collapsed: bool',
  BottomNav: 'items: [{label, icon, active, badge}] | UX: max 5 items, icon+label always, highlight active',
  Card: 'title: string, description: string, media: string (image URL only, NOT element IDs), footer: [childIds] (element IDs rendered in card footer area, NOT a boolean), interactive: bool, clip: bool | UX: footer is an array of element IDs not a boolean, media is a URL string not element IDs',
  Table: 'columns: [{key, label, numeric}], rows: [{}], sortable: bool',
  DataTable: 'columns: [{key, label}], rows: [{}], selectable: bool',
  List: 'items: [{title, secondary, icon}]',
  Badge: 'text: string, variant: "new"|"updated"|"success"|"warning"|"error"',
  Avatar: 'initials: string, src: string, size: "sm"|"md"|"lg"',
  AvatarGroup: 'avatars: [{initials, src}], max: number',
  Calendar: 'selected: "YYYY-MM-DD" (date to highlight), today: "YYYY-MM-DD" (today override)',
  Chart: 'bars: [{label, value, max}]',
  Carousel: 'slides: [{content}]',
  AspectRatio: 'ratio: "16-9"|"4-3"|"1-1"|"21-9"',
  Chip: 'label: string, color: "red"|"green"|"blue"|"purple"|"amber"|"pink", active: bool, closable: bool',
  ScrollArea: 'direction: "horizontal"|"vertical"',
  Image: 'src: string (URL), alt: string, width: number, height: number',
  Alert: 'type: "info"|"warning"|"error"|"success", title: string, message: string',
  Progress: 'value: number, indeterminate: bool',
  Skeleton: 'variant: "text"|"heading"|"avatar"|"btn", lines: number',
  EmptyState: 'icon: string, title: string, message: string',
  Tooltip: 'text: string, position: "top"|"bottom"|"left"|"right"',
  Modal: 'id: string, title: string, footer: [childIds] (buttons for modal footer; omit for default Cancel/Confirm) | UX: clear close affordance, confirm before dismiss with unsaved data',
  AlertDialog: 'id: string, title: string, description: string, footer: [childIds] (action buttons; omit for default Cancel/Continue)',
  Sheet: 'id: string, position: "right"|"left"|"top"|"bottom"',
  Drawer: 'id: string',
  Popover: 'position: "top"|"bottom"|"left"|"right"',
  HoverCard: '',
  DropdownMenu: 'items: [{label, icon, separator, groupLabel, active: bool}]',
  ContextMenu: 'items: [{label, icon, separator}]',
  CommandPalette: 'id: string, placeholder: string, groups: [{label, items: [{label, icon, shortcut}]}] (inline objects, NOT element ID references)',
  Accordion: 'items: [{title, content, children: [childIds]}], multi: bool',
  Collapsible: 'label: string',
  Resizable: 'direction: "horizontal"|"vertical"',
  DatePicker: 'label: string, placeholder: string, selected: string',
  StatCard: 'label: string, value: string, trend: "up"|"down", trendValue: string, icon: string, horizontal: bool',
  ChartCard: 'title: string',
  CustomHTML: 'html: string (raw HTML using DAUB classless CSS), css: string (CSS rules injected as a <style> tag), js: string (vanilla JS, receives "container" arg for this element and "preview" arg for the entire preview pane — use preview.querySelector(\'[data-spec-id="someId"]\') to target other elements), children: [childIds] (standard DAUB component IDs rendered inside the container — html renders first, then children append after)',
};

export const COMP_CATEGORIES = [
  ['Layout & Structure', ['Stack', 'Grid', 'Surface', 'Text', 'Prose', 'Separator']],
  ['Controls', ['Button', 'ButtonGroup', 'Field', 'Input', 'InputGroup', 'InputIcon', 'Search', 'Textarea', 'Checkbox', 'RadioGroup', 'Switch', 'Slider', 'Toggle', 'ToggleGroup', 'Select', 'CustomSelect', 'Kbd', 'Label', 'Spinner', 'InputOTP']],
  ['Navigation', ['Tabs', 'Breadcrumbs', 'Pagination', 'Stepper', 'NavMenu', 'Navbar', 'Menubar', 'Sidebar', 'BottomNav']],
  ['Data Display', ['Card', 'Table', 'DataTable', 'List', 'Badge', 'Avatar', 'AvatarGroup', 'Calendar', 'Chart', 'Carousel', 'AspectRatio', 'Chip', 'ScrollArea', 'Image']],
  ['Feedback', ['Alert', 'Progress', 'Skeleton', 'EmptyState', 'Tooltip']],
  ['Overlays', ['Modal', 'AlertDialog', 'Sheet', 'Drawer', 'Popover', 'HoverCard', 'DropdownMenu', 'ContextMenu', 'CommandPalette']],
  ['Layout Utilities', ['Accordion', 'Collapsible', 'Resizable', 'DatePicker']],
  ['Dashboard', ['StatCard', 'ChartCard']],
  ['Custom', ['CustomHTML']],
];

export const VALID_TYPES = COMP_CATEGORIES.flatMap(([, types]) => types);

export { BLOCK_INDEX };

export function buildSystemPrompt(ragBlocks, userPrompt) {
  let preamble = 'You are a UI generator that outputs json-render flat specs using DAUB components.\n\n'
    + 'BE EXHAUSTIVE AND DETAILED. Generate complete, production-realistic UIs:\n'
    + '- Include ALL elements mentioned in the prompt — do not skip or summarize\n'
    + '- Add realistic sample data: full names, plausible numbers, real-looking dates, complete sentences\n'
    + '- Populate tables with 5-8 rows, lists with 4-6 items, sidebars with full navigation\n'
    + '- Include secondary UI elements: badges, status indicators, tooltips, helper text, icons on buttons\n'
    + '- Build complete page structures: header/navbar, main content, sidebar if relevant, footer elements\n'
    + '- Use nested layouts to create visual hierarchy — cards inside grids, stats above tables, filters above content\n'
    + '- Aim for 20-50 elements per spec. Simple forms: 15-25. Dashboards: 30-50. Complex layouts: 40-60\n\n'
    + 'CRITICAL: You MUST return ONLY a single valid JSON object. No markdown fences, no explanation, no text before or after the JSON.\n'
    + 'Do NOT use trailing commas. Do NOT use comments. Ensure every string is properly quoted and escaped.\n\n'
    + 'OUTPUT FORMAT:\n'
    + '{\n  "theme": "<theme-name>",\n  "root": "<element-id>",\n  "elements": {\n    "<element-id>": {\n'
    + '      "type": "<ComponentType>",\n      "props": { ... },\n'
    + '      "children": ["<child-id>", ...]\n    }\n  }\n}\n\n'
    + 'RULES:\n'
    + '- Every element has a unique string ID (e.g. "stack-1", "card-1", "btn-1")\n'
    + '- "children" is an array of element ID strings (flat, NOT nested objects)\n'
    + '- Only leaf elements omit "children"\n'
    + '- The "root" must reference an existing element ID\n'
    + '- Output MUST be valid JSON. Double-check: no trailing commas, no single quotes, no unescaped special characters\n\n'
    + 'VALID COMPONENT TYPES (use ONLY these): ' + VALID_TYPES.join(', ') + '\n'
    + 'Do NOT invent new types. Do NOT use nested elements objects — use flat ID references in "children" arrays.\n'
    + 'FORMAT: {"theme":"...","root":"id","elements":{"id":{"type":"ValidType","props":{...},"children":["child-id"]}}}\n\n'
    + 'AVAILABLE COMPONENT TYPES AND PROPS:\n\n';

  let sections = '';
  for (const [cat, types] of COMP_CATEGORIES) {
    sections += cat + ':\n';
    for (const t of types) {
      if (COMP_PROPS[t] !== undefined) {
        sections += '- ' + t + ': { ' + (COMP_PROPS[t] || '') + ' }\n';
      }
    }
    sections += '\n';
  }

  const guidelines = 'GUIDELINES:\n'
    + '- Use Stack as the root with direction:"vertical" for page-level layouts\n'
    + '- Use Grid with columns for equal-width grid arrangements\n'
    + '- Use Stack with direction:"horizontal" and justify:"between" for header rows, toolbars, and spaced-out content\n'
    + '- To center children use Stack justify:"center" align:"center"\n'
    + '- Stack/Grid gap uses spacing tokens 0-6 (0=0px, 1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px). Default is 2 (8px). Use gap:2-3 for tight rhythm, gap:4-5 for sections\n'
    + '- Do NOT use Layout — it is deprecated. Use Stack (flexbox) or Grid (CSS grid) instead\n'
    + '- Wrap related content in Card components\n'
    + '- Use StatCard for KPI metrics\n'
    + '- Keep element IDs descriptive and unique\n'
    + '- For standalone images use the Image component with a src URL. For placeholder images, use dummyimage.com: https://dummyimage.com/WxH/BGCOLOR/TEXTCOLOR.png&text=LABEL\n'
    + '- CustomHTML is an ESCAPE HATCH — PREFER standard DAUB components for everything. Only use CustomHTML for: (a) inter-component interactions, (b) animations/transitions, (c) widgets not covered by DAUB components\n'
    + '- Escape quotes properly in JSON strings: use \\" for double quotes inside string values\n'
    + '- Overlay components (Modal, AlertDialog, Sheet, Drawer) are hidden by default — do NOT add display:none style\n'
    + '- Use trigger: "overlay-id" on Button to open overlays — no CustomHTML JS needed\n'
    + '- Card interactive:true for clickable/hoverable cards (adds pointer cursor + hover lift)\n'
    + '- Input type prop for semantic inputs: type:"email" for emails, type:"date" for dates\n'
    + '- Button variant "icon-danger"|"icon-success"|"icon-accent" for colored icon buttons\n'
    + '- StatCard horizontal:true for compact inline stat display\n'
    + '- Stepper vertical:true for vertical process flows and timelines\n'
    + '- Use CustomSelect (not Select) when you need searchable dropdowns\n'
    + '- Use "Separator" for dividers — there is no "Divider" component\n'
    + '- There is NO "Icon" component type — icons are props on Button, Sidebar items, List items, etc. Use icon: "name" on supported components\n\n';

  const density = 'DENSITY & COMPLETENESS:\n'
    + '- Generate 12-25 elements minimum for any non-trivial UI\n'
    + '- Fill every section with realistic sample data — no "Lorem ipsum", no "..." placeholders\n'
    + '- Dashboards: 4+ stat cards, 2+ charts/tables, sidebar navigation\n'
    + '- Forms: field labels, helper text, validation states, submit buttons\n'
    + '- Use nested Stacks/Cards for visual depth and hierarchy\n'
    + '- Every page needs proper header/nav, main content, and footer/actions\n'
    + '- Use real-looking sample data (names, numbers, dates) throughout\n\n';

  const layoutRulesSection = LAYOUT_RULES_COMPACT + '\n\n';

  const landingSection = detectLandingIntent(userPrompt)
    ? LANDING_PAGE_RULES + '\n\n'
    : '';

  const mobileSection = detectMobileIntent(userPrompt)
    ? MOBILE_DESIGN_RULES + '\n\n'
    : '';

  const formulaSection = PAGE_FORMULAS + '\n\n';

  const stateSection = 'INTERACTIVITY — DECLARATIVE STATE (PREFERRED):\n'
    + '- Use declarative state for tabs, toggles, forms, counters, show/hide — NO JavaScript needed\n'
    + '- Add "state" to root spec: initial values as JSON object with paths\n'
    + '- Add "on" to elements: maps DOM events to actions\n'
    + '- Add "visible" to elements: show/hide based on state\n'
    + '- Use $state expressions in props for reactive text/values\n\n'
    + 'STATE FIELDS:\n'
    + '- "state": { "activeTab": "home", "count": 0 } — initial state at spec root\n'
    + '- "on": { "click": { "action": "setState", "params": { "path": "/activeTab", "value": "home" } } } — event handler\n'
    + '- "visible": { "$state": "/activeTab", "eq": "home" } — conditional visibility\n'
    + '- Props with $state: "label": { "$state": "/count" } — reactive text from state\n'
    + '- Props with $template: "text": { "$template": "Items: ${/count}" } — interpolated strings\n'
    + '- Props with $cond: "variant": { "$cond": { "$state": "/active" }, "$then": "primary", "$else": "outlined" } — conditional values\n'
    + '- Props with $bindState: "value": { "$bindState": "/form/email" } — two-way binding for inputs\n\n'
    + 'ACTIONS:\n'
    + '- "setState": set a state path to a value\n'
    + '- "toggleState": toggle boolean\n'
    + '- "pushState": append to array\n'
    + '- "removeState": delete a state key\n\n';

  const industryIntent = detectIndustryIntent(userPrompt);

  let themes = 'THEMES:\n'
    + 'Set "theme" in the root JSON to apply a DAUB theme. Available themes:\n'
    + '- Light: "light", "bone", "material-light", "github", "nord-light", "solarized-light", "catppuccin", "gruvbox-light", "paper", "grunge-light"\n'
    + '- Dark: "dark", "material-dark", "github-dark", "nord", "solarized-dark", "catppuccin-dark", "gruvbox-dark", "dracula", "grunge-dark", "synthwave", "tokyo-night"\n\n';

  if (industryIntent) {
    themes += 'DETECTED INDUSTRY CONTEXT — recommended theme: "' + industryIntent.theme + '"\n'
      + 'Industry-specific guidance: ' + industryIntent.rules + '\n\n';
  }

  themes += 'Theme selection heuristics:\n'
    + '- SaaS/B2B/CRM → "github" or "material-light"\n'
    + '- E-commerce/shop → "light" or "catppuccin"\n'
    + '- Fintech/banking → "material-light" or "github-dark"\n'
    + '- Healthcare/wellness → "nord-light" or "bone"\n'
    + '- Education/learning → "catppuccin" or "light"\n'
    + '- Creative/portfolio → "grunge-dark" or "synthwave"\n'
    + '- Blog/editorial → "paper" or "bone"\n'
    + '- Dashboards/analytics → "github" or "material-light"\n'
    + '- Dev tools/code → "dracula" or "tokyo-night"\n'
    + '- Gaming/esports → "tokyo-night" or "synthwave"\n'
    + '- Music/audio → "synthwave" or "grunge-dark"\n'
    + '- Fitness/sports → "material-dark" or "github-dark"\n'
    + '- Minimal/clean → "bone" or "nord-light"\n'
    + '- Warm/cozy → "gruvbox-light" or "catppuccin"\n'
    + '- Default: "light" when no preference is detected\n';

  let blocksSection = '';
  if (ragBlocks && ragBlocks.length > 0) {
    // RAG-retrieved blocks as few-shot examples (dynamic)
    blocksSection = 'REFERENCE BLOCKS (proven layout patterns matching the request — use these as structural templates):\n'
      + 'Study these specs carefully and follow the same patterns for layout structure, component nesting, and data density.\n\n';
    for (const block of ragBlocks) {
      const indexEntry = BLOCK_INDEX.find(b => b.id === block.id);
      const desc = indexEntry?.description || block.id;
      blocksSection += `--- ${block.id}: ${desc} ---\n`;
      blocksSection += JSON.stringify(block.spec, null, 2) + '\n\n';
    }
  } else if (BLOCK_INDEX.length > 0) {
    // Fallback: static block summaries
    const byCategory = {};
    for (const b of BLOCK_INDEX) {
      (byCategory[b.category] = byCategory[b.category] || []).push(b);
    }
    blocksSection = 'BUILDING BLOCKS (pre-made layout patterns — use these as structural references):\n'
      + 'When a prompt matches one of these patterns, follow the same layout structure.\n'
      + 'Combine multiple blocks for full pages (e.g. hero-01 + features-grid-01 + pricing-01 + footer-01 for a landing page).\n\n';
    for (const [cat, blocks] of Object.entries(byCategory)) {
      blocksSection += cat.charAt(0).toUpperCase() + cat.slice(1) + ':\n';
      for (const b of blocks) {
        blocksSection += `- ${b.id}: ${b.description}\n`;
      }
      blocksSection += '\n';
    }
  }

  return preamble + sections + guidelines + density + layoutRulesSection + formulaSection + landingSection + mobileSection + blocksSection + stateSection + themes;
}
