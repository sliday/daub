// Cloudflare Pages Function — Remote DAUB MCP Server (Streamable HTTP)
// POST /api/mcp  — handles MCP JSON-RPC protocol

import { DAUB_RENDER_BODY, RENDERER_TYPES, THEMES, normalizeTheme, serializeSpec } from '../../mcp/lib/renderers.js';
import { validateSpec } from '../../mcp/lib/validate.js';
import { decideComponents } from './choose.js';
import pkg from '../../package.json' with { type: 'json' };

// ---- Component Catalog (inlined from mcp/lib/prompt.js) ----

const COMP_PROPS = {
  Stack: 'direction: "vertical"|"horizontal", gap: 0-6 (default 2=8px), justify: "center"|"end"|"between"|"evenly", align: "center"|"end"|"start"|"stretch", wrap: bool, container: "wide"|"narrow"|true',
  Grid: 'columns: 2-6, gap: 0-6 (default 2=8px), align: "center"|"end", container: "wide"|"narrow"|true',
  Surface: 'variant: "raised"|"inset"|"pressed"',
  Text: 'tag: "h1"|"h2"|"h3"|"h4"|"p"|"span", content: string (the visible text), class: string | UX: tag is the HTML element, content is the displayed text — never swap them',
  Prose: 'content: string (HTML), size: "sm"|"lg"|"xl"|"2xl"',
  Separator: 'vertical: bool, dashed: bool, label: string',
  Layout: 'deprecated alias for Stack/Grid: children, direction, columns, gap, align (main-axis), valign (cross-axis)',
  Divider: 'alias for Separator: vertical: bool, dashed: bool, label: string',
  Icon: 'name: string (Lucide icon name), size: "xs"|"sm"|"md"|"lg"|"xl", variant: "branded"|"success"',
  Link: 'label: string, href: string (safe URL), class: string',
  CheckboxGroup: 'children: [Checkbox IDs], label: string, helper: string, inline: bool',
  Fieldset: 'children: [field IDs], legend: string, helper: string, disabled: bool',
  Frame: 'children: [body IDs], header: string|[childIds], footer: string|[childIds], flush: bool',
  Group: 'children: [control IDs], attached: bool, vertical: bool, label: string or aria-label: string',
  Meter: 'value: number (default 0), min: number (default 0), max: number (default 100), status: "success"|"warning"|"error", label: string or aria-label: string',
  NumberField: 'value: number, defaultValue: number, min: number, max: number, step: number (default 1), disabled: bool, readOnly: bool, name: string, label: string or aria-label: string',
  PreviewCard: 'trigger: string|[childIds], title: string, description: string, media: string (safe image URL)|[childIds], mediaAlt: string, children: [childIds]',
  Toolbar: 'children: [control IDs], vertical: bool, label: string or aria-label: string',
  Button: 'label: string, variant: "primary"|"secondary"|"ghost"|"icon-danger"|"icon-success"|"icon-accent", size: "sm"|"lg"|"icon", loading: bool, icon: string, trigger: "overlayId"',
  ButtonGroup: '(children are Buttons)',
  Field: 'label: string, placeholder: string, type: "text"|"email"|"password"|"number", error: bool, helper: string, value: string (prefilled text; placeholder is only a hint)',
  Input: 'placeholder: string, size: "sm"|"lg", error: bool, type: "text"|"email"|"password"|"number"|"tel"|"url"|"search"|"date"|"time", value: string (prefilled text)',
  InputGroup: 'addonBefore: string, addonAfter: string (child is Input)',
  InputIcon: 'icon: string, right: bool (child is Input)',
  Search: 'placeholder: string',
  Textarea: 'placeholder: string, rows: number, error: bool, value: string (prefilled text)',
  Checkbox: 'label: string (shown beside the box; leave it out when a Text in the same row names the item: Checkbox(checked: true)), checked: bool',
  RadioGroup: 'options: [{label, value}], selected: string',
  Switch: 'label: string (leave it out when a Text in the same row names the setting: Switch(checked: true)), checked: bool (on/off setting: notifications, preferences, feature flags)',
  Slider: 'min: number, max: number, value: number, step: number, label: string',
  Toggle: 'label: string, pressed: bool, size: "sm" (pressable toolbar button: bold/italic, view filter — NOT for settings)',
  ToggleGroup: 'options: [{label, value}], selected: string',
  Select: 'label: string, options: [{label, value}], selected: string',
  CustomSelect: 'placeholder: string, options: [{label, value, selected, disabled}], searchable: bool, selected: string',
  Kbd: 'keys: [string]',
  Label: 'text: string, required: bool, optional: bool',
  Spinner: 'size: "sm"|"lg"|"xl"',
  InputOTP: 'length: number, separator: bool',
  Tabs: 'tabs: [{label, id}], active: string, children: [childIds]',
  Breadcrumbs: 'items: [{label, href}]',
  Pagination: 'current: number, total: number, perPage: number',
  Stepper: 'steps: [{label, status: "completed"|"active"|"pending"}], vertical: bool',
  NavMenu: 'items: [{label, href, active}]',
  Navbar: 'brand: string, brandHref: string',
  Menubar: 'items: [{label, dropdown: [{label, href}]}]',
  Sidebar: 'sections: [{title, items: [{label, icon, active, href}]}] (inline objects, NOT element ID references), collapsed: bool',
  BottomNav: 'items: [{label, icon, active, badge}]',
  Card: 'title: string, description: string, media: string (image URL only, NOT element IDs), footer: [childIds] (element IDs rendered in card footer area, NOT a boolean), interactive: bool, clip: bool | UX: footer is an array of element IDs not a boolean, media is a URL string not element IDs',
  Table: 'columns: [{key, label, numeric}], rows: [{}] (a cell can list Button ids for row actions: {actions: [editBtn, deleteBtn]}), sortable: bool',
  DataTable: 'columns: [{key, label}], rows: [{}] (a cell can list Button ids for row actions: {actions: [editBtn, deleteBtn]}), selectable: bool',
  List: 'items: [{title, secondary, icon}]',
  Badge: 'text: string, variant: "new"|"updated"|"success"|"warning"|"error"',
  Avatar: 'initials: string, src: string (image URL only; skip it with size: "sm"), size: "sm"|"md"|"lg"',
  AvatarGroup: 'avatars: [{initials, src}], max: number',
  Calendar: 'selected: "YYYY-MM-DD", today: "YYYY-MM-DD"',
  Chart: 'bars: [{label, value, max}]',
  Carousel: 'slides: [{content}]',
  AspectRatio: 'ratio: "16-9"|"4-3"|"1-1"|"21-9"',
  Chip: 'label: string, color: "red"|"green"|"blue"|"purple"|"amber"|"pink", active: bool, closable: bool',
  ScrollArea: 'direction: "horizontal"|"vertical"',
  MessageScroller: 'children: [row IDs], height: number (default 360px), autoScroll: bool (default true), defaultScrollPosition: "start"|"end"|"last-anchor" (default "end"), peek: nonnegative number (default 0), label: string',
  Message: 'children: [content IDs], align: "start"|"end", avatar: string (initials)|{initials, src: safe image URL}, name: string, timestamp: string, messageId: string (defaults to element ID), scrollAnchor: bool, footer: string',
  Bubble: 'children: [content IDs], content: string (plain text), variant: "primary"|"default"|"secondary"|"muted"|"tinted"|"outline"|"ghost"|"destructive", align: "start"|"end", reactions: [{label, count, pressed}] (app-controlled)',
  Attachment: 'children: [action IDs] (separate from overlay link), name: string, description: string, src: safe image URL, alt: string, href: safe URL, size: "sm"|"xs", state: "idle"|"uploading"|"processing"|"error"|"done" (default "idle"), progress: 0-100, orientation: "horizontal"|"vertical"',
  Marker: 'children: [content IDs], content: string (plain text), icon: string (Lucide), variant: "border"|"separator", status: bool (polite live region), busy: bool',
  ChatComposer: 'models: [{id, label, efforts?: string[]}], model: string, effort: string, approval: "ask"|"auto", mode: "chat"|"plan", actions: [{id, label, icon?, disabled?}], capabilities: {queue?, steer?, attachments?, folders?, dictation?, approval?} (boolean flags), busy: bool, placeholder: string, id: string. Empty native form; requires daub.js and daub.css. Default model labels are demo-only (simulated). Host handles db:chat-send/steer/stop/action; configuration grants no access rights',
  Image: 'src: string, alt: string, width: number, height: number',
  Alert: 'type: "info"|"warning"|"error"|"success", title: string, message: string',
  Progress: 'value: number, indeterminate: bool',
  Skeleton: 'variant: "text"|"heading"|"avatar"|"btn", lines: number',
  EmptyState: 'icon: string, title: string, message: string, children: [childIds] (action Buttons shown under the message)',
  Tooltip: 'text: string, position: "top"|"bottom"|"left"|"right"',
  Modal: 'id: string, title: string, footer: [childIds]',
  AlertDialog: 'id: string, title: string, description: string, footer: [childIds]',
  Sheet: 'id: string, position: "right"|"left"|"top"|"bottom"',
  Drawer: 'id: string',
  Popover: 'position: "top"|"bottom"|"left"|"right", children: [childIds] (first child becomes the trigger when it is a Button and there are 2+ children; other children are the content)',
  HoverCard: '',
  DropdownMenu: 'items: [{label, icon, separator, groupLabel, active}]',
  ContextMenu: 'items: [{label, icon, separator}]',
  CommandPalette: 'id: string, placeholder: string, groups: [{label, items: [{label, icon, shortcut}]}] (inline objects, NOT element ID references)',
  Accordion: 'items: [{title, content, children: [childIds]}], multi: bool',
  Collapsible: 'label: string',
  Resizable: 'direction: "horizontal"|"vertical"',
  DatePicker: 'label: string, placeholder: string, selected: string',
  StatCard: 'label: string, value: string, trend: "up"|"down" (direction only, never an icon), trendValue: string, icon: string (Lucide name, pass named: icon: "users"), horizontal: bool',
  ChartCard: 'title: string, children: [Chart element] (empty ChartCard renders "No data"), bars: [{label, value, max}] (shortcut: renders a Chart when no children)',
  CustomHTML: 'html: string, css: string, js: string, children: [childIds]',
};

const COMP_CATEGORIES = [
  ['Layout & Structure', ['Stack', 'Grid', 'Surface', 'Text', 'Prose', 'Separator', 'Layout', 'Divider', 'Icon', 'Link', 'Frame']],
  ['Controls', ['Button', 'ButtonGroup', 'Field', 'Input', 'InputGroup', 'InputIcon', 'Search', 'Textarea', 'Checkbox', 'RadioGroup', 'Switch', 'Slider', 'Toggle', 'ToggleGroup', 'Select', 'CustomSelect', 'Kbd', 'Label', 'Spinner', 'InputOTP', 'CheckboxGroup', 'Fieldset', 'Group', 'NumberField', 'Toolbar']],
  ['Navigation', ['Tabs', 'Breadcrumbs', 'Pagination', 'Stepper', 'NavMenu', 'Navbar', 'Menubar', 'Sidebar', 'BottomNav']],
  ['Data Display', ['Card', 'Table', 'DataTable', 'List', 'Badge', 'Avatar', 'AvatarGroup', 'Calendar', 'Chart', 'Carousel', 'AspectRatio', 'Chip', 'ScrollArea', 'Image']],
  ['Feedback', ['Alert', 'Progress', 'Skeleton', 'EmptyState', 'Tooltip', 'Meter']],
  ['Overlays', ['Modal', 'AlertDialog', 'Sheet', 'Drawer', 'Popover', 'HoverCard', 'DropdownMenu', 'ContextMenu', 'CommandPalette', 'PreviewCard']],
  ['Layout Utilities', ['Accordion', 'Collapsible', 'Resizable', 'DatePicker']],
  ['Dashboard', ['StatCard', 'ChartCard']],
  ['Chat', ['MessageScroller', 'Message', 'Bubble', 'Attachment', 'Marker', 'ChatComposer']],
  ['Custom', ['CustomHTML']],
];

const VALID_TYPES = RENDERER_TYPES;
const validTypeSet = new Set(VALID_TYPES);
// ---- Themes (copied from THEME_FAMILIES in daub.js; tests/mcp-hosted.test.mjs fails on drift) ----

const THEME_FAMILIES = {
  'default':    { light: 'light',        dark: 'dark' },
  'grunge':     { light: 'grunge-light',  dark: 'grunge-dark' },
  'solarized':  { light: 'solarized',     dark: 'solarized-dark' },
  'ink':        { light: 'ink-light',     dark: 'ink' },
  'ember':      { light: 'ember-light',   dark: 'ember' },
  'bone':       { light: 'bone',         dark: 'bone-dark' },
  'dracula':    { light: 'dracula-light', dark: 'dracula' },
  'nord':       { light: 'nord-light',    dark: 'nord' },
  'one-dark':   { light: 'one-dark-light',dark: 'one-dark' },
  'monokai':    { light: 'monokai-light', dark: 'monokai' },
  'gruvbox':    { light: 'gruvbox-light', dark: 'gruvbox' },
  'night-owl':  { light: 'night-owl-light',dark: 'night-owl' },
  'github':     { light: 'github',        dark: 'github-dark' },
  'catppuccin': { light: 'catppuccin',    dark: 'catppuccin-dark' },
  'tokyo-night':{ light: 'tokyo-night-light',dark: 'tokyo-night' },
  'material':   { light: 'material-light', dark: 'material' },
  'monospace':  { light: 'monospace-light', dark: 'monospace' },
  'synthwave':  { light: 'synthwave-light',dark: 'synthwave' },
  'shades-of-purple':{ light: 'shades-of-purple-light',dark: 'shades-of-purple' },
  'ayu':        { light: 'ayu',           dark: 'ayu-dark' },
  'horizon':    { light: 'horizon-light', dark: 'horizon' }
};
const LIGHT_THEMES = Object.values(THEME_FAMILIES).map(f => f.light);
const DARK_THEMES = Object.values(THEME_FAMILIES).map(f => f.dark);

function autoFixSpec(spec) {
  if (!spec || !spec.elements) return spec;
  const validTags = ['h1','h2','h3','h4','p','span'];
  for (const def of Object.values(spec.elements)) {
    if (def.children) def.children = def.children.filter(cid => !!spec.elements[cid]);
    // Auto-fix Text tag/content issues
    if (def.type === 'Text' && def.props) {
      // Swap reversed: content is a tag name, tag is not
      if (validTags.includes(def.props.content) && !validTags.includes(def.props.tag)) {
        [def.props.tag, def.props.content] = [def.props.content, def.props.tag];
      }
      // Clear duplicated: both tag and content are the same tag name
      if (validTags.includes(def.props.content) && def.props.content === def.props.tag) {
        def.props.content = '';
      }
    }
  }
  if (!spec.root || !spec.elements[spec.root]) {
    const ids = Object.keys(spec.elements);
    if (ids.length) spec.root = ids[0];
  }
  return spec;
}

// ---- RAG: Vector Math ----

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // Pre-normalized vectors: dot product = cosine similarity
}

function normalizeVector(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map(v => v / norm);
}

// ---- RAG: Gemini Embedding (gemini-embedding-2-preview, Google-only) ----
// Must use same model as block-embed.js (embedding spaces are incompatible between models)

const EMBEDDING_DIMS = 768;

async function embedQuery(text, geminiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=${geminiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskType: 'RETRIEVAL_QUERY',
      content: { parts: [{ text }] },
      output_dimensionality: EMBEDDING_DIMS,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const values = data.embedding?.values;
  return values ? normalizeVector(values) : null;
}

// ---- RAG: Block Retrieval ----

// Embeddings loaded lazily from CDN (cached in global scope for Worker reuse)
let _embeddingsCache = null;
let _blockSpecsCache = {};

async function loadEmbeddings() {
  if (_embeddingsCache) return _embeddingsCache;
  try {
    const res = await fetch('https://daub.dev/blocks/embeddings.json');
    if (res.ok) {
      _embeddingsCache = await res.json();
      return _embeddingsCache;
    }
  } catch {}
  return null;
}

async function loadBlockSpec(blockId, category) {
  const cacheKey = blockId;
  if (_blockSpecsCache[cacheKey]) return _blockSpecsCache[cacheKey];
  try {
    // Try loading from CDN — blocks are served as static files
    const filePath = BLOCK_INDEX.find(b => b.id === blockId)?.file;
    if (!filePath) return null;
    const res = await fetch(`https://daub.dev/blocks/${filePath}`);
    if (res.ok) {
      const spec = await res.json();
      _blockSpecsCache[cacheKey] = spec;
      return spec;
    }
  } catch {}
  return null;
}

async function retrieveTopBlocks(queryText, geminiKey, topK = 5) {
  const [queryVec, embeddings] = await Promise.all([
    embedQuery(queryText, geminiKey),
    loadEmbeddings(),
  ]);

  if (!queryVec || !embeddings) return [];

  const scores = [];
  for (const [blockId, blockVec] of Object.entries(embeddings)) {
    scores.push({ id: blockId, score: cosineSimilarity(queryVec, blockVec) });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

// ---- Design Knowledge Constants ----

const LAYOUT_RULES_COMPACT = `LAYOUT RULES (8pt grid):
Spacing tokens: XS=8px, S=16px, M=24px, L=32px, XL=48px, XXL=80px
DAUB gap mapping: 0=0, 1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px

Grouping: 4 methods — containers, proximity, similarity, continuity. Space between groups >= 2x within groups. Don't over-containerize: if 3/4 signals present, drop the border.

Visual hierarchy (strongest→weakest): size, color/contrast, weight, position, spacing, depth. One focal point per view. Squint test: blur UI, key elements must still be identifiable.

Typography: one sans-serif, two weights max (400/700). App scale 1.2 ratio (12-14-16-20-24-28), marketing scale 1.333 (14-18-24-32-42-56). Max 4-5 sizes/page. Body >=16px, line-height >=1.5 body / 1.1-1.3 headings. Max 65ch line length. Left-align body, center only short hero text (<3 lines).

Color: design greyscale first. Brand color = interactive only (buttons, links, toggles). One accent. Foreground opacity: 90% primary, 75% body, 60% secondary, 45% borders, 10% separators, 4% fills. Contrast: 4.5:1 text, 3:1 large text/UI.

Components: one primary button per view. Three weights: filled/outlined/text. Min 48x48px touch targets, 8px gap between. Label above input, helper below. One-column forms.

Common mistakes: equal spacing everywhere (fix: inner < outer) | multiple primary buttons | center-aligned paragraphs | full-width text (max 65ch) | empty containers | orphan elements | color-only hierarchy | tiny touch targets | lorem ipsum.`;

const LANDING_PAGE_RULES = `LANDING PAGE PATTERNS:
Hero essentials: headline + subhead + hero image + CTA. No carousels in hero. Ever.

Headline→awareness mapping:
- Unaware: pain remover, problem/question ("Tired of X?")
- Problem-aware: benefit, easy way ("The fastest way to X")
- Solution-aware: product description, category ("Simple help desk software")
- Product-aware: comparison, social proof, double benefit
- Most aware: promise, testimonial ("You'll have X in Y days")
Rules: customer-focused (never "We..."), clear > clever, big visual weight.

Page formulas by product type:
- SaaS: Hero→How it works→Main benefit→Features→Integrations→Testimonial→Use cases→Pricing→Footer
- Physical: Hero→Description→Features→Proof gallery→More features→Cross-sell→Specs→Guarantees
- Mobile App (known): Hero + download CTA. Done.
- Mobile App (new): Hero→Benefits summary→Benefits detail→Features grid→Press→Testimonials→Logos+CTA→Footer
- Desktop App: Hero→Benefits→Use cases→Proof→Awards+CTA
- Book/Info: Hero (cover+proof)→About→Why buy→Contents→Author bio

Visitor inner monologue (section ordering):
1. What is this? → headline+image
2. Why should I care? → main benefit
3. How does it work? → how-it-works
4. What do I get? → features
5. Can I trust this? → proof
6. Will it work for me? → use cases/testimonials
7. What do others think? → more proof
8. How much? → pricing
9. What if it fails? → FAQ/guarantees
10. How do I start? → bottom CTA

CTA rules: one goal per page, verb-first text, never "Submit", big+contrasting+repeated, match aggressiveness to awareness. Always include bottom CTA.

Proof placement: adjacent to claims, not in a separate section. Start proof early (hero if possible). Specific > general ("23% churn reduction" > "great product").

Red lines: no carousels in hero, no "Submit" CTA, no company-name-only headlines, mandatory bottom CTA, no lorem ipsum, no low-quality images.`;

function detectLandingIntent(prompt) {
  return /landing\s*page|hero\s*section|marketing|pricing\s*(page|table)|signup\s*page|\bcta\b|conversion|above.?the.?fold|sales\s*page|lead\s*gen/i.test(prompt || '');
}

const MOBILE_DESIGN_RULES = `MOBILE APP DESIGN PATTERNS:
Core principle: thumb-driven, single-column, bottom-anchored navigation.

Layout structure:
- Use BottomNav (5 tabs max) as primary navigation — NOT Sidebar or horizontal Navbar links
- App Shell pattern: Navbar (title + actions) + scrollable content + BottomNav
- Single-column layout only. No Grid columns > 1 on mobile
- Stack direction:"vertical" for all page content, direction:"horizontal" only for inline elements (chips, button rows, avatar + text)
- Cards go full-width (no side margins except 16px page gutter)

Navigation hierarchy:
- BottomNav = top-level sections (Home, Search, Create, Activity, Profile)
- Navbar = contextual title + back arrow + action icons (max 2 right-side icons)
- Tabs = sub-sections within a screen
- Sheet (bottom) = contextual actions, filters, sort options
- Drawer = secondary navigation or settings

Touch targets & spacing:
- All interactive elements: min 48x48px touch target
- 8px minimum gap between adjacent touch targets
- Button height: 48px (primary actions), 40px (secondary)
- Gap tokens: prefer 3 (12px) for tight lists, 4 (16px) for section spacing, 5 (24px) for major sections
- Page gutter: 16px (gap 4) on both sides — content never touches screen edges

Content patterns:
- Lists with db-list for feeds, settings, contacts (icon/avatar + title + secondary + chevron)
- Cards for content previews (image + text + actions)
- StatCard row (2 across in horizontal Stack) for dashboard metrics
- Avatar + name patterns for user references
- Chip rows for filters/categories (horizontal Stack, wrap:true)

Mobile-specific components to prefer:
- BottomNav over Sidebar
- Sheet (bottom) over Modal for actions/filters
- Drawer for settings/profile menus
- Carousel for media galleries
- Tabs for sub-navigation (max 4-5 tabs)
- Search with db-search component at page top

Screen templates by type:
- Feed: Navbar + Search + filter Chips + List/Cards + BottomNav
- Detail: Navbar (back + title + share) + hero image + content Stack + sticky bottom CTA
- Settings: Navbar (back + "Settings") + grouped Lists with Separators
- Profile: Navbar + Avatar (lg) + stats row + Tabs + content
- Dashboard: Navbar + StatCards (2x2 Grid) + Chart + recent List + BottomNav
- Auth/Login: centered Stack with logo + Fields + primary Button + text links

Typography for mobile:
- Body: 16px (never smaller for readability)
- Headings: scale 1.2 ratio (16-20-24-28)
- Use db-caption (12px) sparingly — only for timestamps, metadata
- Left-align everything (no center-aligned paragraphs on mobile)

Common mobile mistakes to avoid:
- Using Sidebar navigation (use BottomNav)
- Grid with 3+ columns (max 2, prefer 1)
- Tiny touch targets (< 48px)
- Modal for simple choices (use Sheet)
- Desktop-style horizontal navbars with many links
- Content without page gutters (16px minimum)
- Floating action buttons overlapping content
- Deep navigation hierarchies (max 3 levels)`;

function detectMobileIntent(prompt) {
  return /mobile\s*app|mobile\s*application|ios\s*app|android\s*app|phone\s*app|\bsmartphone\b|\biphone\b|mobile\s*screen|mobile\s*ui|mobile\s*layout|mobile\s*view|native\s*app|bottom.?nav|app\s*shell/i.test(prompt || '');
}

const INDUSTRY_INTENTS = [
  { pattern: /saas|b2b|subscription|crm|erp|project\s*manage/i, theme: 'github', rules: 'Trust blue tones. Hero+Features+Pricing+CTA. Clean data-dense layouts. Anti: excessive animation, playful icons in serious tools.' },
  { pattern: /e.?commerce|shop|store|product\s*page|cart|checkout/i, theme: 'light', rules: 'Product-focused cards with hover lift. CTA prominence. Success green for cart. Grid layouts for product catalogs. Anti: flat without depth, text-heavy pages.' },
  { pattern: /fintech|banking|finance|payment|trading|invest/i, theme: 'material-light', rules: 'Data-dense, trust-focused. StatCards for KPIs. Tables for transactions. Muted palette, no neons. Anti: vibrant colors, excessive animation, playful tone.' },
  { pattern: /health|medical|clinic|patient|pharma|wellness/i, theme: 'nord-light', rules: 'Calming, accessible. Clear hierarchy. Large text, high contrast. Whitespace-generous. Anti: dark mode default, playful animations, small text.' },
  { pattern: /education|learn|course|student|school|lms|tutor/i, theme: 'catppuccin', rules: 'Warm, inviting. Progress indicators (Stepper, Progress). Card-based content. Clear navigation. Anti: dense data tables, corporate tone.' },
  { pattern: /creative|portfolio|design\s*agency|studio|artist/i, theme: 'grunge-dark', rules: 'Expressive, bold. Large imagery. Minimal text. Full-bleed sections. Anti: corporate blue, dense forms, cookie-cutter layouts.' },
  { pattern: /blog|news|magazine|editorial|article|content\s*site/i, theme: 'bone', rules: 'Typography-first. Prose component for body. Max 65ch line length. Clear reading hierarchy. Anti: sidebar clutter, small body text, low contrast.' },
  { pattern: /social|community|forum|chat|messaging|feed/i, theme: 'light', rules: 'Card-based feeds. Avatar+name patterns. List for threads. BottomNav for mobile. Anti: dense tables, formal tone, no user presence indicators.' },
  { pattern: /dashboard|analytics|admin\s*panel|back.?office|monitoring/i, theme: 'github', rules: 'Data-dense. StatCards row + Charts + Tables. Sidebar navigation. Compact spacing. Anti: large hero sections, marketing copy, excessive whitespace.' },
  { pattern: /dev\s*tool|developer|api|code|terminal|ide|cli/i, theme: 'dracula', rules: 'Dark theme preferred. Monospace for code. Compact UI. Kbd for shortcuts. Anti: rounded playful shapes, pastel colors, large images.' },
  { pattern: /real\s*estate|property|listing|rental|housing/i, theme: 'bone', rules: 'Image-heavy cards. Grid layouts for listings. Filter chips. Anti: dark themes, dense tables without imagery.' },
  { pattern: /food|restaurant|recipe|delivery|menu|cafe/i, theme: 'gruvbox-light', rules: 'Warm tones. Image-heavy cards. Grid for menu items. Large CTAs for ordering. Anti: corporate blue, data-dense layouts.' },
  { pattern: /travel|booking|hotel|flight|tourism|vacation/i, theme: 'nord-light', rules: 'Image-forward. Search-first layout. Card grids for destinations. DatePicker for dates. Anti: text-heavy, dark themes, no imagery.' },
  { pattern: /fitness|gym|workout|sport|exercise|training/i, theme: 'material', rules: 'Bold, energetic. Progress bars, stat cards. Dark with accent pops. Charts for progress. Anti: pastel, formal corporate tone.' },
  { pattern: /music|audio|podcast|streaming|playlist/i, theme: 'synthwave', rules: 'Dark with vibrant accents. List-based for tracks/episodes. Progress for playback. BottomNav for mobile. Anti: white themes, corporate layouts.' },
  { pattern: /gaming|game|esport|player|leaderboard/i, theme: 'tokyo-night', rules: 'Dark, immersive. StatCards for scores. Tables for leaderboards. Bold accent colors. Anti: light themes, formal business tone.' },
  { pattern: /hr|recruit|hiring|job\s*board|career|applicant/i, theme: 'material-light', rules: 'Clean, professional. Card-based job listings. Stepper for application flow. Filter sidebar. Anti: dark themes, playful tone.' },
  { pattern: /legal|law|compliance|contract|policy/i, theme: 'bone', rules: 'Conservative, trustworthy. Prose for documents. Accordion for FAQs. Muted palette. Anti: bright colors, playful elements, dark mode.' },
  { pattern: /nonprofit|charity|donation|cause|volunteer/i, theme: 'catppuccin', rules: 'Warm, emotive. Hero with impact stats. Progress for goals. Testimonials. Anti: corporate cold, dark themes, dense data.' },
  { pattern: /onboarding|signup\s*flow|welcome|getting\s*started/i, theme: 'light', rules: 'Stepper for progress. One task per step. Centered layout. Minimal navigation. Anti: dense forms, sidebar nav, multiple CTAs per step.' },
];

function detectIndustryIntent(prompt) {
  if (!prompt) return null;
  for (const intent of INDUSTRY_INTENTS) {
    if (intent.pattern.test(prompt)) {
      return { industry: intent.pattern.source, theme: intent.theme, rules: intent.rules };
    }
  }
  return null;
}

const PAGE_FORMULAS = `PAGE FORMULAS (beyond landing pages):
Dashboard: Navbar + StatCards row + Primary chart/table + Secondary data + Activity feed
Settings: Sidebar/Tabs nav + Section cards + Form fields + Save/Cancel footer
Onboarding: Stepper + Welcome + Profile setup + Preferences + Completion
Profile: Avatar + Stats row + Tabs (Posts/Activity/Settings) + Content
Inbox/List: Search + Filter chips + Scrollable list + Detail panel (or navigate)
Pricing: Toggle (monthly/annual) + Plan cards (3 tiers) + Feature comparison table + FAQ`;

// ---- OpenUI Lang Parser (inlined for Cloudflare Pages Functions) ----

const COMP_SCHEMA = {
  Stack: ["children","direction","gap","justify","align","wrap","container"],
  Grid: ["children","columns","gap","align","container"],
  Surface: ["children","variant"],
  Text: ["content","tag","class"],
  Prose: ["content","size"],
  Separator: ["vertical","dashed","label"],
  Layout: ["children","direction","columns","gap","align","valign"],
  Divider: ["vertical","dashed","label"],
  Icon: ["name","size","variant"],
  Link: ["label","href","class"],
  Button: ["label","variant","size","loading","icon","trigger"],
  ButtonGroup: ["children"],
  Field: ["children","label","placeholder","type","error","helper","value"],
  Input: ["placeholder","size","error","type","value"],
  InputGroup: ["children","addonBefore","addonAfter"],
  InputIcon: ["children","icon","right"],
  Search: ["placeholder"],
  Textarea: ["placeholder","rows","error","value"],
  Checkbox: ["label","checked"],
  CheckboxGroup: ["children","label","helper","inline"],
  Fieldset: ["children","legend","helper","disabled"],
  Group: ["children","attached","vertical","label"],
  NumberField: ["value","min","max","step","label"],
  RadioGroup: ["options","selected"],
  Switch: ["label","checked"],
  Slider: ["min","max","value","step","label"],
  Toggle: ["label","pressed","size"],
  ToggleGroup: ["options","selected"],
  Select: ["label","options","selected"],
  CustomSelect: ["placeholder","options","searchable"],
  Kbd: ["keys"],
  Label: ["text","required","optional"],
  Spinner: ["size"],
  InputOTP: ["length","separator"],
  Tabs: ["children","tabs","active"],
  Breadcrumbs: ["items"],
  Pagination: ["current","total","perPage"],
  Stepper: ["steps","vertical"],
  NavMenu: ["items"],
  Navbar: ["children","brand","brandHref"],
  Toolbar: ["children","vertical","label"],
  Menubar: ["items"],
  Sidebar: ["sections","collapsed"],
  BottomNav: ["items"],
  Card: ["children","title","description","media","footer","interactive","clip"],
  Frame: ["children","header","footer","flush"],
  Table: ["columns","rows","sortable"],
  DataTable: ["columns","rows","selectable"],
  List: ["items"],
  Badge: ["text","variant"],
  Avatar: ["initials","src","size"],
  AvatarGroup: ["avatars","max"],
  Calendar: ["selected","today"],
  Chart: ["bars"],
  Carousel: ["slides"],
  AspectRatio: ["children","ratio"],
  Chip: ["label","color","active","closable"],
  ScrollArea: ["children","direction"],
  MessageScroller: ["children","height","autoScroll","defaultScrollPosition","peek"],
  Message: ["children","align","avatar","name","timestamp","messageId","scrollAnchor","footer"],
  Bubble: ["children","content","variant","align","reactions"],
  Attachment: ["children","name","description","src","alt","href","size","state","progress","orientation"],
  Marker: ["children","content","icon","variant","status","busy"],
  ChatComposer: ["models","model","effort","approval","mode","actions","capabilities","busy","placeholder","id"],
  Image: ["src","alt","width","height"],
  Alert: ["type","title","message"],
  Progress: ["value","indeterminate"],
  Meter: ["value","min","max","status","label"],
  Skeleton: ["variant","lines"],
  EmptyState: ["icon","title","message","children"],
  Tooltip: ["children","text","position"],
  Modal: ["children","id","title","footer"],
  AlertDialog: ["id","title","description","footer"],
  Sheet: ["children","id","position"],
  Drawer: ["children","id"],
  Popover: ["children","position"],
  HoverCard: ["children"],
  PreviewCard: ["children","trigger","title","description","media","mediaAlt"],
  DropdownMenu: ["items"],
  ContextMenu: ["items"],
  CommandPalette: ["id","placeholder","groups"],
  Accordion: ["items","multi"],
  Collapsible: ["children","label"],
  Resizable: ["children","direction"],
  DatePicker: ["label","placeholder","selected"],
  StatCard: ["label","value","trend","trendValue","icon","horizontal"],
  ChartCard: ["children","title"],
  CustomHTML: ["html","css","js","children"],
};

function openUItoSpec(input) {
  if (!input || typeof input !== 'string') return null;
  input = input.trim().replace(/^```\w*\n?/, '').replace(/\n?```\s*$/, '');

  const T = { STRING: 1, NUMBER: 2, BOOL: 3, NULL: 4, IDENT: 5, TYPE: 6, LPAR: 7, RPAR: 8, LBRK: 9, RBRK: 10, LBRC: 11, RBRC: 12, EQ: 13, COMMA: 14, COLON: 15, EOF: 16 };

  function tokenize(s) {
    const toks = []; let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (' \t\r\n'.includes(ch)) { i++; continue; }
      if (ch === '/' && s[i+1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (ch === '"' || ch === "'") {
        const q = ch; let v = ''; i++;
        while (i < s.length && s[i] !== q) { if (s[i] === '\\' && i+1<s.length) { const n=s[i+1]; v += n==='n'?'\n':n==='t'?'\t':n; i+=2; } else { v+=s[i]; i++; } }
        if (i<s.length) i++; toks.push({t:T.STRING,v}); continue;
      }
      if ((ch>='0'&&ch<='9')||(ch==='-'&&s[i+1]>='0'&&s[i+1]<='9')) {
        let n=''; if(ch==='-'){n+='-';i++;} while(i<s.length&&((s[i]>='0'&&s[i]<='9')||s[i]==='.'))n+=s[i++];
        toks.push({t:T.NUMBER,v:parseFloat(n)}); continue;
      }
      if (/[a-zA-Z_$]/.test(ch)) {
        let id=''; while(i<s.length&&/[a-zA-Z0-9_\-$]/.test(s[i]))id+=s[i++];
        if(id==='true'||id==='false')toks.push({t:T.BOOL,v:id==='true'});
        else if(id==='null')toks.push({t:T.NULL,v:null});
        else if(ch>='A'&&ch<='Z'&&COMP_SCHEMA[id])toks.push({t:T.TYPE,v:id});
        else toks.push({t:T.IDENT,v:id}); continue;
      }
      const singles = {'(':T.LPAR,')':T.RPAR,'[':T.LBRK,']':T.RBRK,'{':T.LBRC,'}':T.RBRC,'=':T.EQ,',':T.COMMA,':':T.COLON};
      if(singles[ch]){toks.push({t:singles[ch]});i++;continue;} i++;
    }
    toks.push({t:T.EOF}); return toks;
  }

  let pos = 0, tokens;
  function peek(){return tokens[pos]||{t:T.EOF};}
  function next(){return tokens[pos++]||{t:T.EOF};}
  function match(t){if(peek().t===t){pos++;return true;}return false;}

  function parseExpr() {
    const tok = peek();
    if(tok.t===T.TYPE) return parseComp();
    if(tok.t===T.STRING){next();return tok.v;}
    if(tok.t===T.NUMBER){next();return tok.v;}
    if(tok.t===T.BOOL){next();return tok.v;}
    if(tok.t===T.NULL){next();return null;}
    if(tok.t===T.LBRK){next();const a=[];while(peek().t!==T.RBRK&&peek().t!==T.EOF){a.push(parseExpr());match(T.COMMA);}match(T.RBRK);return a;}
    if(tok.t===T.LBRC){next();const o={};while(peek().t!==T.RBRC&&peek().t!==T.EOF){let k;const kt=peek();if(kt.t===T.IDENT||kt.t===T.TYPE)k=next().v;else if(kt.t===T.STRING)k=next().v;else{next();continue;}if(peek().t===T.COLON)next();o[k]=parseExpr();match(T.COMMA);}match(T.RBRC);return o;}
    if(tok.t===T.IDENT){next();return{__ref:tok.v};}
    next();return null;
  }

  function parseComp() {
    const name = next().v; const args = []; const named = {}; let hasNamed = false;
    if(match(T.LPAR)){
      while(peek().t!==T.RPAR&&peek().t!==T.EOF){
        if(peek().t===T.IDENT&&pos+1<tokens.length&&tokens[pos+1].t===T.COLON){const k=next().v;next();named[k]=parseExpr();hasNamed=true;}
        else args.push(parseExpr());
        match(T.COMMA);
      }match(T.RPAR);
    }
    return{__component:name,__args:args,__named:named,__hasNamed:hasNamed};
  }

  try {
    tokens = tokenize(input); pos = 0;
    const stmts = [];
    while(peek().t!==T.EOF){
      if(peek().t===T.IDENT){const saved=pos;const id=next().v;if(peek().t===T.EQ){next();stmts.push({name:id,value:parseExpr()});}else{pos=saved;next();}}
      else if(peek().t===T.TYPE){stmts.push({name:null,value:parseComp()});}
      else next();
    }
    if(!stmts.length) return null;

    // Resolve
    let counter = 0;
    const genId = (p) => p.toLowerCase() + '-' + (++counter);
    const elements = {};
    const nameToId = {};
    let theme = 'bone', rootName = null, state = null;
    // Data statements (name = literal) resolve by value wherever they are defined; `resolving` guards cycles
    const data = Object.create(null), resolving = Object.create(null);
    const isData = n => Object.prototype.hasOwnProperty.call(data, n);
    // Alias statements (name = otherName) create no element: every use of the alias resolves to its target
    const aliasOf = Object.create(null);
    const canon = n => { const seen = Object.create(null); while (aliasOf[n] && !seen[n]) { seen[n] = true; n = aliasOf[n]; } return n; };
    // Switch(webhook1) with __state = {webhook1: true}: a bare __state key sets the control's state instead of printing as its label
    const STATE_PROP = { Switch: 'checked', Checkbox: 'checked', Toggle: 'pressed' };
    const stateKey = v => { const k = v && v.__ref; return k && !nameToId[k] && state && typeof state === 'object' && !Array.isArray(state) && Object.prototype.hasOwnProperty.call(state, k) ? k : null; };

    for(let i=0;i<stmts.length;i++){
      const s=stmts[i];
      if(s.name==='__theme'){theme=typeof s.value==='string'?s.value:'bone';continue;}
      if(s.name==='__state'){state=s.value;continue;}
      const id=s.name||genId('auto');nameToId[id]=id;s._id=id;
      const v=s.value;
      if(s.name&&v!=null&&(typeof v!=='object'||Array.isArray(v)||(!v.__ref&&!v.__component)))data[s.name]=v;
      else if(s.name&&v&&v.__ref&&v.__ref!==s.name)aliasOf[s.name]=v.__ref;
      if(!rootName&&!isData(id))rootName=id;
      if(s.name==='root')rootName=id;
    }

    function resolveValue(v){
      if(v==null||typeof v==='string'||typeof v==='number'||typeof v==='boolean')return v;
      if(Array.isArray(v))return v.map(resolveValue);
      if(v.__ref){
        const r=canon(v.__ref);
        if(!isData(r)||resolving[r])return r;
        resolving[r]=true;const out=resolveValue(data[r]);delete resolving[r];return out;
      }
      if(v.__component)return resolveComponent(v);
      const o={};for(const k in v)if(v.hasOwnProperty(k))o[k]=resolveValue(v[k]);return o;
    }

    // Children: arrays and data-statement refs expand in place
    function collectChildren(cv,out){
      if(Array.isArray(cv)){cv.forEach(c=>collectChildren(c,out));return;}
      const dr=cv&&cv.__ref&&canon(cv.__ref);
      if(dr&&isData(dr)&&!resolving[dr]){resolving[dr]=true;collectChildren(data[dr],out);delete resolving[dr];return;}
      const id=processChild(cv);if(id)out.push(id);
    }

    function processChild(cv){
      if(cv==null)return null;
      if(typeof cv==='string'){if(nameToId[cv])return canon(cv);const id=genId('text');elements[id]={type:'Text',props:{content:cv}};return id;}
      if(typeof cv==='number'||typeof cv==='boolean'){const id=genId('text');elements[id]={type:'Text',props:{content:String(cv)}};return id;}
      if(cv.__ref)return canon(cv.__ref);
      if(cv.__component)return resolveComponent(cv);
      return null;
    }

    function resolveComponent(comp){
      const {__component:typeName,__named:named,__hasNamed:hn}=comp;
      let args=comp.__args;
      let schema=COMP_SCHEMA[typeName];const props={};const childIds=[];
      // Modal("upload-modal", "Upload files", "Drop files here", [footer]) or Modal("upload-modal", [body], "Upload files"):
      // an id-first call (AlertDialog order). Text args are the title then the description; an array before them is the body,
      // after them the footer. Modal("Body", "id", "Title") keeps the schema order (its 2nd arg is id-shaped)
      const idLike=v=>typeof v==='string'&&/^[A-Za-z][\w-]*$/.test(v);
      if((typeName==='Modal'||typeName==='Sheet'||typeName==='Drawer')&&idLike(args[0])&&args.length>1&&!idLike(args[1])){
        props.id=args[0];let sawText=false;
        for(let m=1;m<args.length;m++){
          if(typeof args[m]==='string'){if(props.title==null)props.title=args[m];else if(props.description==null)props.description=args[m];sawText=true;}
          else if(!sawText)collectChildren(args[m],childIds);
          else props.footer=resolveValue(args[m]);
        }
        args=[];
      }
      // Tabs(["All", "Active"], "All"): a first arg of only quoted labels is the tab list, not the panels
      if(typeName==='Tabs'&&Array.isArray(args[0])&&args[0].length&&args[0].every(x=>typeof x==='string'&&!nameToId[x]))schema=['tabs','active'];
      const sk=STATE_PROP[typeName]&&stateKey(args[0]);
      if(sk)props[STATE_PROP[typeName]]=state[sk];
      if(schema&&args.length){
        for(let a=sk?1:0;a<args.length&&a<schema.length;a++){
          if(schema[a]==='children')collectChildren(args[a],childIds);
          else props[schema[a]]=resolveValue(args[a]);
        }
      }
      if(hn)for(const k in named)if(named.hasOwnProperty(k)){
        if(k==='children')collectChildren(named[k],childIds);
        else props[k]=resolveValue(named[k]);
      }
      const elId=genId(typeName);elements[elId]={type:typeName,props};if(childIds.length)elements[elId].children=childIds;return elId;
    }

    for(const s of stmts){
      if(s.name==='__theme'||s.name==='__state')continue;
      const name=s._id; // reuse the first-pass id so rootName still points at it
      if(s.value&&s.value.__component){
        const compId=resolveComponent(s.value);
        if(compId!==name&&elements[compId]){
          elements[name]=elements[compId];delete elements[compId];
          for(const eid in elements)if(elements[eid].children)elements[eid].children=elements[eid].children.map(c=>c===compId?name:c);
        }
      }
    }
    if(rootName)rootName=canon(rootName); // root = page
    if(!rootName||!elements[rootName]){const ks=Object.keys(elements);if(ks.length)rootName=ks[0];}
    // A named element listed under two parents renders once: the first placement in document order wins.
    // A repeat in a sibling panel of the same Tabs stays (one panel shows at a time)
    if(rootName){
      const placed=Object.create(null),onPath=Object.create(null);
      const walk=(id,panel)=>{
        const el=elements[id];
        if(!el||!Array.isArray(el.children)||onPath[id])return;
        onPath[id]=true;
        el.children=el.children.filter((cid,i)=>{
          const ctx=el.type==='Tabs'?id+'#'+i:panel;
          const prev=placed[cid];
          if(!prev){placed[cid]=[ctx];walk(cid,ctx);return true;}
          const tabs=ctx&&ctx.split('#')[0];
          const sibling=tabs&&prev.every(p=>p&&p!==ctx&&p.split('#')[0]===tabs);
          if(sibling)prev.push(ctx);
          return !!sibling;
        });
        delete onPath[id];
      };
      walk(rootName,null);
    }
    const spec={theme,root:rootName||'root',elements};if(state)spec.state=state;return spec;
  } catch(e) {
    try {
      const lastNl=input.lastIndexOf('\n');
      if(lastNl>0)return openUItoSpec(input.substring(0,lastNl));
    } catch{}
    return null;
  }
}

function detectOutputFormat(text) {
  if(!text)return'unknown';
  const t=text.trim().replace(/^```\w*\n?/,'');
  if(t[0]==='{')return'json';
  if(/^[a-zA-Z_]\w*\s*=/.test(t))return'openui';
  return'unknown';
}

// ---- OpenUI Lang System Prompt Builder ----

// Split a COMP_PROPS string on commas outside ()/[]/{}.
function splitTopLevel(s) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// OpenUI signature in the parser's positional order (COMP_SCHEMA), described from COMP_PROPS.
// Props the parser can't take positionally are listed last as "(named only)".
function openUISignature(t) {
  const schema = COMP_SCHEMA[t];
  const raw = COMP_PROPS[t] || '';
  if (!schema) return t + '(' + raw + ')';
  const noteAt = raw.indexOf(' | ');
  const note = noteAt >= 0 ? raw.slice(noteAt) : '';
  const segs = {};
  const extras = [];
  for (const seg of splitTopLevel(noteAt >= 0 ? raw.slice(0, noteAt) : raw)) {
    const m = seg.match(/^([A-Za-z_]\w*)\s*:/);
    if (m) segs[m[1]] = seg; else extras.push(seg);
  }
  const args = schema.map(k => segs[k] || (k === 'children' ? 'children: [refs]' : k));
  for (const k of Object.keys(segs)) if (!schema.includes(k)) args.push(segs[k] + ' (named only)');
  return t + '(' + args.join(', ') + ')' + (extras.length ? ' ' + extras.join(' ') : '') + note;
}

// Catalog section of a system prompt. With a Jev pick: full lines for picked types,
// names only for the rest. Without: every type, grouped by category (original behavior).
function catalogSection(lineFor, picked, othersNote) {
  let out = '';
  if (!picked) {
    for (const [cat, types] of COMP_CATEGORIES) {
      out += cat + ':\n';
      for (const t of types) if (COMP_PROPS[t] !== undefined) out += lineFor(t);
      out += '\n';
    }
    return out;
  }
  const others = [];
  out += 'PICKED FOR THIS REQUEST (prefer these):\n';
  for (const t of VALID_TYPES) {
    if (COMP_PROPS[t] === undefined) continue;
    if (picked.includes(t)) out += lineFor(t); else others.push(t);
  }
  if (others.length) out += '\nALSO AVAILABLE (' + othersNote + '): ' + others.join(', ') + '\n';
  return out + '\n';
}

function buildOpenUISystemPrompt(ragBlocks, userPrompt, picked) {
  let prompt = 'You are a UI generator. Output ONLY valid openui-lang code using DAUB components.\n\n'
    + 'BE EXHAUSTIVE AND DETAILED. Generate complete, production-realistic UIs:\n'
    + '- Include ALL elements mentioned in the prompt\n'
    + '- Add realistic sample data: full names, plausible numbers, real-looking dates\n'
    + '- Build complete page structures: header/navbar, main content, sidebar if relevant\n'
    + '- Aim for 20-50 elements per spec\n\n'
    + 'SYNTAX:\n'
    + '- One statement per line: identifier = Expression\n'
    + '- "root = ..." is mandatory (top-level element)\n'
    + '- Expressions: ComponentType(arg1, arg2, ...), "string", number, bool, [array], {key: value}\n'
    + '- References: define name = ..., use name in children arrays\n'
    + '- __theme = "themeName" to set theme (optional, defaults to "light")\n'
    + '- __state = {key: value} for initial state (optional)\n'
    + '- Line comments with //\n\n'
    + 'ARGUMENT STYLES:\n'
    + '- Positional: Button("Click", "primary", "sm")\n'
    + '- Named: Button(label: "Click", variant: "primary")\n'
    + '- Mixed: Stack([child1, child2], direction: "horizontal")\n\n'
    + 'CHILDREN: first arg for layout components: Stack([c1, c2], "vertical")\n'
    + 'Inline: Stack([Text("Hello", "h1"), Button("Go")])\n'
    + 'References: Stack([header, content]) where header/content are separate statements\n\n'
    + 'CRITICAL: Output ONLY openui-lang code. No markdown fences, no explanation.\n\n'
    + 'COMPONENT SIGNATURES (positional arg order; "(named only)" props must be passed by name):\n\n';

  prompt += catalogSection(t => '- ' + openUISignature(t) + '\n', picked, 'use only if clearly needed, named args only');

  prompt += 'GUIDELINES:\n'
    + '- Use Stack as root with direction:"vertical" for page layouts\n'
    + '- Grid for equal-width arrangements\n'
    + '- Stack direction:"horizontal" justify:"between" for headers/toolbars\n'
    + '- Gap tokens: 0=0px, 1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px\n'
    + '- Wrap related content in Card\n'
    + '- StatCard for KPI metrics\n'
    + '- Charts go inside ChartCard as a Chart child with 4-8 bars of realistic data unless the user specifies the data: ChartCard([revenueChart], "Revenue"); use Switch (not Toggle) for on/off settings like notifications\n'
    + '- Use trigger:"overlay-id" on Button to open overlays\n'
    + '- Put icons in props (Button icon, StatCard icon, Sidebar and List item icon); use Icon only for a standalone icon\n\n';

  prompt += LAYOUT_RULES_COMPACT + '\n\n';
  prompt += PAGE_FORMULAS + '\n\n';

  if (detectLandingIntent(userPrompt)) prompt += LANDING_PAGE_RULES + '\n\n';
  if (detectMobileIntent(userPrompt)) prompt += MOBILE_DESIGN_RULES + '\n\n';

  const industryIntentOUI = detectIndustryIntent(userPrompt);

  if (ragBlocks && ragBlocks.length > 0) {
    prompt += 'REFERENCE BLOCKS (proven patterns — adapt structure):\n\n';
    for (const block of ragBlocks) {
      const indexEntry = BLOCK_INDEX.find(b => b.id === block.id);
      const desc = indexEntry?.description || block.id;
      prompt += `--- ${block.id}: ${desc} ---\n`;
      prompt += JSON.stringify(block.spec, null, 2) + '\n\n';
    }
  }

  prompt += 'THEMES:\n'
    + '- Light: ' + THEMES.light.join(', ') + '\n'
    + '- Dark: ' + THEMES.dark.join(', ') + '\n\n';

  if (industryIntentOUI) {
    prompt += 'DETECTED INDUSTRY CONTEXT — recommended theme: "' + industryIntentOUI.theme + '"\n'
      + 'Industry-specific guidance: ' + industryIntentOUI.rules + '\n\n';
  }

  prompt += 'EXAMPLE:\n'
    + '__theme = "bone"\n'
    + 'root = Stack([header, content], "vertical", 4)\n'
    + 'header = Stack([Text("Dashboard", "h1"), Button("Settings", "ghost")], "horizontal", 2, "between", "center")\n'
    + 'content = Card([], "Overview", "Dashboard content")\n';

  return prompt;
}

// ---- System Prompt Builder ----

function buildSystemPrompt(ragBlocks, userPrompt, picked) {
  let prompt = 'You are a UI generator that outputs json-render flat specs using DAUB components.\n\n'
    + 'BE EXHAUSTIVE AND DETAILED. Generate complete, production-realistic UIs:\n'
    + '- Include ALL elements mentioned in the prompt\n'
    + '- Add realistic sample data: full names, plausible numbers, real-looking dates\n'
    + '- Populate tables with 5-8 rows, lists with 4-6 items, sidebars with full navigation\n'
    + '- Include secondary UI elements: badges, status indicators, tooltips, helper text, icons\n'
    + '- Build complete page structures: header/navbar, main content, sidebar if relevant\n'
    + '- Use nested layouts for visual hierarchy\n'
    + '- Aim for 20-50 elements per spec\n\n'
    + 'CRITICAL: Return ONLY a single valid JSON object. No markdown fences, no explanation.\n\n'
    + 'OUTPUT FORMAT:\n'
    + '{"theme":"<name>","root":"<id>","elements":{"<id>":{"type":"<Type>","props":{...},"children":["<child-id>"]}}}\n\n'
    + 'RULES:\n'
    + '- Every element has a unique string ID\n'
    + '- "children" is an array of element ID strings (flat, NOT nested)\n'
    + '- The "root" must reference an existing element ID\n'
    + '- Output MUST be valid JSON\n\n'
    + 'VALID COMPONENT TYPES: ' + VALID_TYPES.join(', ') + '\n\n'
    + 'COMPONENT PROPS:\n\n';

  prompt += catalogSection(t => '- ' + t + ': { ' + (COMP_PROPS[t] || '') + ' }\n', picked, 'use only if clearly needed');

  prompt += 'GUIDELINES:\n'
    + '- Use Stack as root with direction:"vertical" for page layouts\n'
    + '- Use Grid for equal-width arrangements\n'
    + '- Stack direction:"horizontal" justify:"between" for headers/toolbars\n'
    + '- Gap tokens: 0=0px, 1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px\n'
    + '- Wrap related content in Card components\n'
    + '- Use StatCard for KPI metrics\n'
    + '- Charts go inside ChartCard as a Chart child ("children":["chart-id"]) with 4-8 bars of realistic data unless the user specifies the data; use Switch (not Toggle) for on/off settings like notifications\n'
    + '- Use trigger:"overlay-id" on Button to open overlays\n'
    + '- Put icons in props (Button icon, StatCard icon, Sidebar and List item icon); use Icon only for a standalone icon\n\n';

  prompt += LAYOUT_RULES_COMPACT + '\n\n';
  prompt += PAGE_FORMULAS + '\n\n';

  if (detectLandingIntent(userPrompt)) {
    prompt += LANDING_PAGE_RULES + '\n\n';
  }

  if (detectMobileIntent(userPrompt)) {
    prompt += MOBILE_DESIGN_RULES + '\n\n';
  }

  const industryIntent = detectIndustryIntent(userPrompt);

  // RAG-retrieved blocks as few-shot examples (dynamic)
  if (ragBlocks && ragBlocks.length > 0) {
    prompt += 'REFERENCE BLOCKS (proven layout patterns matching the request — use these as structural templates):\n'
      + 'Study these specs carefully and follow the same patterns for layout structure, component nesting, and data density.\n\n';
    for (const block of ragBlocks) {
      const indexEntry = BLOCK_INDEX.find(b => b.id === block.id);
      const desc = indexEntry?.description || block.id;
      prompt += `--- ${block.id}: ${desc} ---\n`;
      prompt += JSON.stringify(block.spec, null, 2) + '\n\n';
    }
  } else {
    // Fallback: static block summaries (original behavior)
    prompt += 'BUILDING BLOCKS (pre-made layout patterns — use these as structural references):\n'
      + 'When a prompt matches one of these patterns, follow the same layout structure.\n'
      + 'Combine multiple blocks for full pages (e.g. hero-01 + features-grid-01 + pricing-01 + footer-01 for a landing page).\n\n';
    const byCategory = {};
    for (const b of BLOCK_INDEX) {
      (byCategory[b.category] = byCategory[b.category] || []).push(b);
    }
    for (const [cat, blocks] of Object.entries(byCategory)) {
      prompt += cat.charAt(0).toUpperCase() + cat.slice(1) + ':\n';
      for (const b of blocks) {
        prompt += `- ${b.id}: ${b.description}\n`;
      }
      prompt += '\n';
    }
  }

  prompt += 'THEMES:\n'
    + '- Light: ' + THEMES.light.join(', ') + '\n'
    + '- Dark: ' + THEMES.dark.join(', ') + '\n\n';

  if (industryIntent) {
    prompt += 'DETECTED INDUSTRY CONTEXT — recommended theme: "' + industryIntent.theme + '"\n'
      + 'Industry-specific guidance: ' + industryIntent.rules + '\n\n';
  }

  prompt += 'Theme selection heuristics:\n'
    + '- SaaS/B2B/CRM → "github" or "material-light"\n'
    + '- E-commerce/shop → "light" or "catppuccin"\n'
    + '- Fintech/banking → "material-light" or "github-dark"\n'
    + '- Healthcare/wellness → "nord-light" or "bone"\n'
    + '- Dashboards/analytics → "github" or "material-light"\n'
    + '- Dev tools/code → "dracula" or "tokyo-night"\n'
    + '- Creative/portfolio → "grunge-dark" or "synthwave"\n'
    + '- Default: "light" when no preference is detected\n';

  return prompt;
}

// ---- JSON Cleaning ----

function cleanJSON(raw) {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const idx = s.indexOf('{');
  if (idx > 0) s = s.slice(idx);
  const lastIdx = s.lastIndexOf('}');
  if (lastIdx >= 0 && lastIdx < s.length - 1) s = s.slice(0, lastIdx + 1);
  return s;
}

// ---- Prompt Complexity Scoring ----

const COMPLEXITY_WEIGHTS = {
  length: 0.15,
  specificity: 0.20,
  interactivity: 0.25,
  multiComponent: 0.20,
  constraintDensity: 0.10,
  creativity: 0.10,
};

function scorePromptComplexity(prompt) {
  const p = prompt.toLowerCase();

  // Length: token count proxy
  const words = p.split(/\s+/).length;
  const length = words <= 5 ? 10 : words <= 15 ? 30 : words <= 40 ? 55 : words <= 80 ? 75 : 95;

  // Specificity: named components, theme refs, layout keywords
  const specificityTerms = [
    /sidebar/g, /navbar/g, /header/g, /footer/g, /dashboard/g, /table/g, /chart/g,
    /modal/g, /drawer/g, /tab[s]?\b/g, /card/g, /form/g, /stepper/g, /calendar/g,
    /breadcrumb/g, /pagination/g, /menu/g, /accordion/g, /carousel/g,
    /theme/g, /dracula/g, /nord/g, /github/g, /solarized/g, /synthwave/g, /tokyo/g,
    /catppuccin/g, /gruvbox/g, /material/g, /bone/g,
  ];
  const specHits = specificityTerms.reduce((n, rx) => n + (p.match(rx) || []).length, 0);
  const specificity = Math.min(specHits * 15, 100);

  // Interactivity: state, events, dynamic behavior
  const interactTerms = [
    /drag.?and.?drop/g, /real.?time/g, /live\s/g, /interactive/g, /animation/g, /transition/g,
    /hover/g, /click/g, /toggle/g, /collaps/g, /expand/g, /filter/g, /sort/g, /search/g,
    /state/g, /dynamic/g, /update/g, /editable/g, /inline.?edit/g, /websocket/g,
  ];
  const interactHits = interactTerms.reduce((n, rx) => n + (p.match(rx) || []).length, 0);
  const interactivity = Math.min(interactHits * 20, 100);

  // Multi-component: distinct UI component mentions
  const componentTerms = [
    /button/g, /input/g, /field/g, /select/g, /checkbox/g, /radio/g, /switch/g,
    /slider/g, /table/g, /list/g, /card/g, /badge/g, /avatar/g, /chart/g,
    /alert/g, /progress/g, /spinner/g, /tooltip/g, /modal/g, /sheet/g,
    /sidebar/g, /navbar/g, /tab[s]?\b/g, /breadcrumb/g, /stepper/g, /image/g,
  ];
  const compHits = new Set(componentTerms.filter(rx => rx.test(p)).map(rx => rx.source)).size;
  const multiComponent = Math.min(compHits * 12, 100);

  // Constraint density: specific sizing, spacing, color constraints
  const constraintTerms = [
    /\d+px/g, /\d+rem/g, /\d+%/g, /#[0-9a-f]{3,8}/gi, /rgb/g, /gap.?\d/g,
    /width/g, /height/g, /padding/g, /margin/g, /border/g, /radius/g,
    /columns?:\s*\d/g, /rows?:\s*\d/g, /max.?width/g, /min.?height/g,
    /spacing/g, /align/g, /justify/g, /grid/g, /flex/g,
  ];
  const constraintHits = constraintTerms.reduce((n, rx) => n + (p.match(rx) || []).length, 0);
  const constraintDensity = Math.min(constraintHits * 12, 100);

  // Creativity: open-ended vs prescriptive
  const creativeTerms = [
    /creative/g, /beautiful/g, /stunning/g, /unique/g, /innovative/g, /elegant/g,
    /surprise/g, /wow/g, /impressive/g, /professional/g, /modern/g, /sleek/g,
    /minimal/g, /futuristic/g, /retro/g, /playful/g, /bold/g, /artistic/g,
  ];
  const creativeHits = creativeTerms.reduce((n, rx) => n + (p.match(rx) || []).length, 0);
  const creativity = Math.min(creativeHits * 20, 100);

  const dimensions = { length, specificity, interactivity, multiComponent, constraintDensity, creativity };

  const score = Math.round(
    Object.entries(COMPLEXITY_WEIGHTS).reduce((sum, [k, w]) => sum + dimensions[k] * w, 0)
  );

  const tier = score <= 15 ? 'SIMPLE' : score <= 35 ? 'MEDIUM' : score <= 60 ? 'COMPLEX' : 'PREMIUM';

  return { tier, score, dimensions };
}

// ---- Model Tier Configuration ----

const MODEL_TIERS = {
  SIMPLE:  { primary: 'google/gemini-3.1-flash-lite-preview', fallbacks: ['deepseek/deepseek-v3.2-20251201', 'x-ai/grok-4.1-fast'] },
  MEDIUM:  { primary: 'google/gemini-3-flash-preview-20251217', fallbacks: ['minimax/minimax-m2.5-20260211', 'moonshotai/kimi-k2.5-0127'] },
  COMPLEX: { primary: 'google/gemini-3.1-pro-preview', fallbacks: ['anthropic/claude-haiku-4-5', 'openai/gpt-5.4'] },
  PREMIUM: { primary: 'anthropic/claude-sonnet-4-6', fallbacks: ['anthropic/claude-opus-4-6', 'openai/gpt-5.4-pro'] },
};

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES_PER_MODEL = 3;
const MAX_FALLBACK_MODELS = 2;
const BASE_BACKOFF_MS = 500;

// ---- Generate Spec via OpenRouter (with routing + fallback) ----

async function callOpenRouter(model, messages, apiKey, format) {
  const bodyObj = { model, messages, max_tokens: 32768, temperature: 0.7 };
  if (format !== 'openui') bodyObj.response_format = { type: 'json_object' };
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daub.dev',
      'X-Title': 'DAUB MCP Server',
    },
    body: JSON.stringify(bodyObj),
  });

  if (!res.ok) {
    const err = await res.text();
    const retryable = RETRYABLE_STATUSES.has(res.status);
    const error = new Error(`OpenRouter API ${res.status}: ${err.slice(0, 300)}`);
    error.status = res.status;
    error.retryable = retryable;
    throw error;
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error('No content in OpenRouter response');

  return { rawContent, usage: data.usage || null };
}

// ---- Component picker: Jev decision model via choose.js (same rules as the playground) ----

const COMP_PURPOSE = {
  ChatComposer: 'Native rich message composer with local attachments, queue controls, model and effort selection, approval intent, plan mode, and user-started dictation.',
  MessageScroller: 'Scrollable conversation thread with message anchors and scroll-to-start/end controls.',
  Message: 'Conversation message row with author, avatar, timestamp, alignment, and delivery metadata.',
  Bubble: 'Chat message content bubble with variants, alignment, and reaction controls.',
  Attachment: 'Conversation file or image attachment with upload progress, status, and separate actions.',
  Marker: 'Conversation date separator or status marker for unread messages, generation, and activity.',
};

const PICK_CORE = ['Stack', 'Grid', 'Text', 'Card', 'Button', 'Icon', 'Separator'].filter(t => validTypeSet.has(t));
const PICK_THRESHOLD = 0.5;
const PICK_TIMEOUT_MS = 4000;

// Resolves to the picked type list, or null (use the full catalog) on any failure, timeout, or empty pick.
async function pickComponents(prompt, existingSpec, apiKey) {
  try {
    const comps = {};
    for (const t of VALID_TYPES) if (!PICK_CORE.includes(t)) comps[t] = [COMP_PURPOSE[t], COMP_PROPS[t]].filter(Boolean).join(' | ');
    const { scores } = await decideComponents({ prompt, components: comps, apiKey, timeoutMs: PICK_TIMEOUT_MS, title: 'DAUB MCP' });
    const picked = PICK_CORE.slice();
    for (const t of Object.keys(scores)) {
      if (scores[t] >= PICK_THRESHOLD && Object.prototype.hasOwnProperty.call(comps, t)) picked.push(t);
    }
    if (picked.length === PICK_CORE.length) return null;
    // Keep every type already in the spec being modified so the edit can still use it
    const els = existingSpec && typeof existingSpec === 'object' ? existingSpec.elements : null;
    if (els && typeof els === 'object') {
      for (const def of Object.values(els)) {
        const t = def && def.type;
        if (validTypeSet.has(t) && !picked.includes(t)) picked.push(t);
      }
    }
    return picked;
  } catch {
    return null;
  }
}

async function generateSpecWithRouting(prompt, options, apiKey, env) {
  const format = options.format || 'json';
  const complexity = scorePromptComplexity(prompt);
  const tierConfig = MODEL_TIERS[complexity.tier];
  const modelsToTry = [tierConfig.primary, ...tierConfig.fallbacks.slice(0, MAX_FALLBACK_MODELS)];

  // Runs in parallel with RAG retrieval below
  const pickPromise = pickComponents(prompt, options.existing_spec, apiKey);

  // RAG: retrieve relevant blocks as few-shot examples
  let ragBlocks = null;
  let ragMeta = null;
  const geminiKey = env?.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const topMatches = await retrieveTopBlocks(prompt, geminiKey, 5);
      if (topMatches.length > 0) {
        ragBlocks = [];
        ragMeta = [];
        for (const match of topMatches) {
          const indexEntry = BLOCK_INDEX.find(b => b.id === match.id);
          if (!indexEntry) continue;
          const spec = await loadBlockSpec(match.id, indexEntry.category);
          if (spec) {
            ragBlocks.push({ id: match.id, spec });
            ragMeta.push({ id: match.id, score: Math.round(match.score * 1000) / 1000 });
          }
        }
        if (ragBlocks.length === 0) ragBlocks = null;
      }
    } catch {
      // RAG failure is non-fatal — fall back to static blocks
    }
  }

  const picked = await pickPromise;
  const sysPrompt = format === 'openui'
    ? buildOpenUISystemPrompt(ragBlocks, prompt, picked)
    : buildSystemPrompt(ragBlocks, prompt, picked);
  const messages = [{ role: 'system', content: sysPrompt }];
  if (options.existing_spec) {
    messages.push({
      role: 'assistant',
      content: typeof options.existing_spec === 'string' ? options.existing_spec : JSON.stringify(options.existing_spec),
    });
    messages.push({ role: 'user', content: `Modify the existing spec above according to these instructions: ${prompt}` });
  } else {
    let userContent = prompt;
    if (options.theme) userContent += `\n\nUse the "${options.theme}" theme.`;
    messages.push({ role: 'user', content: userContent });
  }

  let totalAttempts = 0;
  let lastError = null;
  let lastRawContent = null;

  for (const model of modelsToTry) {
    for (let retry = 0; retry < MAX_RETRIES_PER_MODEL; retry++) {
      totalAttempts++;
      try {
        if (retry > 0) {
          await new Promise(r => setTimeout(r, BASE_BACKOFF_MS * Math.pow(2, retry - 1)));
        }

        const { rawContent, usage } = await callOpenRouter(model, messages, apiKey, format);
        lastRawContent = rawContent;

        let spec;
        const detectedFmt = detectOutputFormat(rawContent);
        if (detectedFmt === 'openui' || (format === 'openui' && detectedFmt !== 'json')) {
          spec = openUItoSpec(rawContent);
          if (!spec) {
            const parseError = new Error('Failed to parse OpenUI Lang output');
            parseError.retryable = true;
            throw parseError;
          }
        } else {
          try {
            spec = JSON.parse(cleanJSON(rawContent));
          } catch (e) {
            const parseError = new Error(`Failed to parse JSON: ${e.message}`);
            parseError.retryable = true;
            throw parseError;
          }
        }

        spec = autoFixSpec(spec);
        const validation = validateSpec(spec);

        return {
          spec,
          validation,
          routing: {
            tier: complexity.tier,
            score: complexity.score,
            dimensions: complexity.dimensions,
            model_used: model,
            attempts: totalAttempts,
            rag_blocks: ragMeta || null,
            picked_components: picked,
          },
          usage,
        };
      } catch (e) {
        lastError = e;
        if (!e.retryable) break;
      }
    }
  }

  // Graceful degradation: return partial result with error context
  return {
    spec: null,
    validation: { valid: false, issues: [lastError?.message || 'All models failed'] },
    routing: {
      tier: complexity.tier,
      score: complexity.score,
      dimensions: complexity.dimensions,
      model_used: null,
      attempts: totalAttempts,
      rag_blocks: ragMeta || null,
      picked_components: picked,
    },
    usage: null,
    parse_error: true,
    raw_text: lastRawContent ? lastRawContent.slice(0, 1000) : null,
  };
}

// ---- Spec Summary ----

function specSummary(spec) {
  if (!spec || !spec.elements) return 'Empty spec';
  const types = new Set();
  for (const def of Object.values(spec.elements)) {
    if (def.type) types.add(def.type);
  }
  return `${Object.keys(spec.elements).length} elements, ${types.size} component types, theme: ${spec.theme || 'light'}`;
}

// ---- Render spec to self-contained HTML ----

// First-party daub.dev assets always match the deployed renderer (npm can lag a release). ?v= is the package.json
// version inlined at build time, so each release busts caches; no SRI since their bytes change per deploy.
// lucide build + SRI match the playground export
const DAUB_ASSET = name => 'https://daub.dev/' + name + '?v=' + pkg.version;
const LUCIDE_SRC = 'https://cdn.jsdelivr.net/npm/lucide@0.576.0/dist/umd/lucide.min.js';
const LUCIDE_SRI = 'sha384-b05ba3pt6xaC7F4r130arhf8cF18GH/gKu9JDz/NMf+BhLlBVwIWUdAZSpf1IWRZ';

function renderToHTML(spec) {
  const theme = normalizeTheme(spec.theme);
  const specJSON = serializeSpec(spec);
  return `<!DOCTYPE html>
<html data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAUB UI</title>
  <link rel="stylesheet" href="${DAUB_ASSET('daub.css')}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="${LUCIDE_SRC}" integrity="${LUCIDE_SRI}" crossorigin="anonymous"><\/script>
  <style>
    body { margin: 0; padding: 16px; font-family: Inter, system-ui, sans-serif; background: var(--db-color-bg); color: var(--db-color-text); }
    #app { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="${DAUB_ASSET('daub.js')}"><\/script>
  <script>
  (function() {
    var spec = ${specJSON};
    ${DAUB_RENDER_BODY}
    var root = renderElement(spec.elements, spec.root, 0);
    if (root) document.getElementById('app').appendChild(root);
    renderOrphans(spec, document.getElementById('app'));
    if (typeof DAUB !== 'undefined') DAUB.init(document.getElementById('app'));
        if (typeof lucide !== 'undefined') lucide.createIcons();
  })();
  <\/script>
</body>
</html>`;
}

// ---- MCP Tool Definitions ----

const TOOLS = [
  {
    name: 'generate_ui',
    description: 'Generate a complete DAUB UI from a natural language prompt. Returns a JSON spec (json-render format), self-contained HTML, validation results, and a summary.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Natural language description of the UI to generate' },
        theme: { type: 'string', description: 'Theme override, e.g. "dracula", "github", "bone"' },
        existing_spec: { type: 'string', description: 'Existing DAUB spec JSON string to modify/refine' },
        format: { type: 'string', enum: ['json', 'openui'], description: 'Output format for LLM generation. "openui" uses token-efficient OpenUI Lang (67% fewer tokens). Default: "json"' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'get_component_catalog',
    description: 'Returns available DAUB components so you can construct specs directly without an LLM call. Includes component types, props, categories, themes, and an example spec.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category name, e.g. "Controls", "Navigation"' },
      },
    },
  },
  {
    name: 'validate_spec',
    description: 'Validate a DAUB spec JSON string. Returns validation status, issues, element count, and components used.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'string', description: 'DAUB spec JSON string to validate (a spec object also works)' },
      },
      required: ['spec'],
    },
  },
  {
    name: 'render_spec',
    description: 'Render an existing DAUB spec JSON into self-contained HTML. Returns the spec, rendered HTML, and validation results.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'string', description: 'DAUB spec JSON string (a spec object also works)' },
      },
      required: ['spec'],
    },
  },
  {
    name: 'get_block_library',
    description: 'Returns available pre-made UI building blocks (layout patterns). Each block is a proven DAUB spec that can be used as-is or adapted. Use blocks as starting points for common UI patterns like dashboards, landing pages, forms, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category: "landing", "dashboard", "forms", "auth", "ecommerce", "data-display", "mobile"' },
      },
    },
  },
  {
    name: 'parse_openui',
    description: 'Parse OpenUI Lang code into a DAUB JSON spec. Useful for converting token-efficient OpenUI Lang output to the standard spec format.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'OpenUI Lang code to parse' },
      },
      required: ['code'],
    },
  },
];

// ---- Block Library (inlined from blocks/index.json) ----

const BLOCK_INDEX = [
  {
    "id": "api-keys-page-01",
    "category": "app-specific",
    "subcategory": "api-keys-page",
    "file": "app-specific/api-keys-page-01.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "Alert",
      "DataTable"
    ],
    "name": "Api Keys Page",
    "description": "Api Keys Page block for app-specific",
    "tags": [
      "app-specific",
      "api",
      "keys",
      "page"
    ],
    "screenshot": "thumbs/app-specific/api-keys-page-01.webp"
  },
  {
    "id": "billing-page-01",
    "category": "app-specific",
    "subcategory": "billing-page",
    "file": "app-specific/billing-page-01.json",
    "element_count": 21,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "Surface",
      "Badge",
      "Separator",
      "DataTable"
    ],
    "name": "Billing Page",
    "description": "Billing Page block for app-specific",
    "tags": [
      "app-specific",
      "billing",
      "page"
    ],
    "screenshot": "thumbs/app-specific/billing-page-01.webp"
  },
  {
    "id": "changelog-page-01",
    "category": "app-specific",
    "subcategory": "changelog-page",
    "file": "app-specific/changelog-page-01.json",
    "element_count": 38,
    "components_used": [
      "Stack",
      "Text",
      "Badge",
      "Prose",
      "Separator"
    ],
    "name": "Changelog Page",
    "description": "Changelog Page block for app-specific",
    "tags": [
      "app-specific",
      "changelog",
      "page"
    ],
    "screenshot": "thumbs/app-specific/changelog-page-01.webp"
  },
  {
    "id": "onboarding-tour-01",
    "category": "app-specific",
    "subcategory": "onboarding-tour",
    "file": "app-specific/onboarding-tour-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Progress",
      "List",
      "Button"
    ],
    "name": "Onboarding Tour",
    "description": "Onboarding Tour block for app-specific",
    "tags": [
      "app-specific",
      "onboarding",
      "tour"
    ],
    "screenshot": "thumbs/app-specific/onboarding-tour-01.webp"
  },
  {
    "id": "profile-page-01",
    "category": "app-specific",
    "subcategory": "profile-page",
    "file": "app-specific/profile-page-01.json",
    "element_count": 21,
    "components_used": [
      "Stack",
      "Avatar",
      "Text",
      "Badge",
      "Button",
      "Grid",
      "StatCard",
      "Separator",
      "List"
    ],
    "name": "Profile Page",
    "description": "Profile Page block for app-specific",
    "tags": [
      "app-specific",
      "profile",
      "page"
    ],
    "screenshot": "thumbs/app-specific/profile-page-01.webp"
  },
  {
    "id": "settings-page-01",
    "category": "app-specific",
    "subcategory": "settings-page",
    "file": "app-specific/settings-page-01.json",
    "element_count": 22,
    "components_used": [
      "Grid",
      "Sidebar",
      "Stack",
      "Text",
      "Select",
      "Separator",
      "Switch",
      "Button"
    ],
    "name": "Settings Page",
    "description": "Settings Page block for app-specific",
    "tags": [
      "app-specific",
      "settings",
      "page"
    ],
    "screenshot": "thumbs/app-specific/settings-page-01.webp"
  },
  {
    "id": "auth-page-01",
    "name": "Auth Page",
    "category": "auth",
    "description": "Split-screen auth: branding panel (left) + login form (right) in 2-column grid",
    "tags": [
      "auth",
      "login",
      "split-screen",
      "branding"
    ],
    "file": "auth/auth-page-01.json",
    "element_count": 33,
    "components_used": [
      "Grid",
      "Surface",
      "Stack",
      "Text",
      "List",
      "Avatar",
      "Button",
      "Separator",
      "Field",
      "Switch",
      "Link"
    ],
    "screenshot": "thumbs/auth/auth-page-01.webp"
  },
  {
    "id": "forgot-password-01",
    "category": "auth",
    "subcategory": "forgot-password",
    "file": "auth/forgot-password-01.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Card",
      "Alert",
      "Field",
      "Input",
      "Button",
      "Separator",
      "Text",
      "Link"
    ],
    "name": "Forgot Password",
    "description": "Forgot Password block for auth",
    "tags": [
      "auth",
      "forgot",
      "password"
    ],
    "screenshot": "thumbs/auth/forgot-password-01.webp"
  },
  {
    "id": "forgot-password-check-email-01",
    "name": "Forgot Password Check Email",
    "category": "auth",
    "description": "Forgot Password Check Email screen with 12 elements",
    "tags": [
      "auth",
      "forgot-password",
      "form"
    ],
    "file": "auth/forgot-password-check-email-01.json",
    "element_count": 12,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Button",
      "Link"
    ],
    "screenshot": "thumbs/auth/forgot-password-check-email-01.webp"
  },
  {
    "id": "forgot-password-form-01",
    "name": "Forgot Password Form",
    "category": "auth",
    "description": "Forgot Password Form screen with 11 elements",
    "tags": [
      "auth",
      "forgot-password",
      "form"
    ],
    "file": "auth/forgot-password-form-01.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link"
    ],
    "screenshot": "thumbs/auth/forgot-password-form-01.webp"
  },
  {
    "id": "forgot-password-new-password-01",
    "name": "Forgot Password New Password",
    "category": "auth",
    "description": "Forgot Password New Password screen with 14 elements",
    "tags": [
      "auth",
      "forgot-password",
      "form"
    ],
    "file": "auth/forgot-password-new-password-01.json",
    "element_count": 14,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link"
    ],
    "screenshot": "thumbs/auth/forgot-password-new-password-01.webp"
  },
  {
    "id": "forgot-password-success-01",
    "name": "Forgot Password Success",
    "category": "auth",
    "description": "Forgot Password Success screen with 9 elements",
    "tags": [
      "auth",
      "forgot-password",
      "form"
    ],
    "file": "auth/forgot-password-success-01.json",
    "element_count": 9,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Button",
      "Link"
    ],
    "screenshot": "thumbs/auth/forgot-password-success-01.webp"
  },
  {
    "id": "login-form-01",
    "category": "auth",
    "subcategory": "login-form",
    "file": "auth/login-form-01.json",
    "element_count": 15,
    "components_used": [
      "Stack",
      "Card",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button",
      "Separator",
      "Text"
    ],
    "name": "Login Form",
    "description": "Login Form block for auth",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "screenshot": "thumbs/auth/login-form-01.webp"
  },
  {
    "id": "login-page-card-01",
    "name": "Login Page Card",
    "category": "auth",
    "description": "Login page variant using Stack layout with 20 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-page-card-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Card",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button",
      "Separator"
    ],
    "screenshot": "thumbs/auth/login-page-card-01.webp"
  },
  {
    "id": "login-page-card-02",
    "name": "Login Page Card V2",
    "category": "auth",
    "description": "Login page variant using Stack layout with 18 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-page-card-02.json",
    "element_count": 18,
    "components_used": [
      "Stack",
      "Card",
      "Icon",
      "Text",
      "Input",
      "Checkbox",
      "Link",
      "Button"
    ],
    "screenshot": "thumbs/auth/login-page-card-02.webp"
  },
  {
    "id": "login-page-illustration-01",
    "name": "Login Page Illustration",
    "category": "auth",
    "description": "Login page variant using Stack layout with 19 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-page-illustration-01.json",
    "element_count": 19,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button"
    ],
    "screenshot": "thumbs/auth/login-page-illustration-01.webp"
  },
  {
    "id": "login-page-minimal-01",
    "name": "Login Page Minimal",
    "category": "auth",
    "description": "Login page variant using Stack layout with 18 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-page-minimal-01.json",
    "element_count": 18,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Input",
      "Button",
      "Link"
    ],
    "screenshot": "thumbs/auth/login-page-minimal-01.webp"
  },
  {
    "id": "login-page-nav-01",
    "name": "Login Page Nav",
    "category": "auth",
    "description": "Login page variant using Stack layout with 23 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-page-nav-01.json",
    "element_count": 23,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Link",
      "Field",
      "Input",
      "Checkbox",
      "Button"
    ],
    "screenshot": "thumbs/auth/login-page-nav-01.webp"
  },
  {
    "id": "login-page-simple-01",
    "name": "Login Page Simple",
    "category": "auth",
    "description": "Login page variant using Stack layout with 19 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-page-simple-01.json",
    "element_count": 19,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button"
    ],
    "screenshot": "thumbs/auth/login-page-simple-01.webp"
  },
  {
    "id": "login-page-social-01",
    "name": "Login Page Social",
    "category": "auth",
    "description": "Login page variant using Stack layout with 17 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-page-social-01.json",
    "element_count": 17,
    "components_used": [
      "Stack",
      "Surface",
      "Icon",
      "Text",
      "Input",
      "Button",
      "Separator",
      "Link"
    ],
    "screenshot": "thumbs/auth/login-page-social-01.webp"
  },
  {
    "id": "login-page-social-leading-01",
    "name": "Login Page Social Leading",
    "category": "auth",
    "description": "Login page variant using Stack layout with 12 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-page-social-leading-01.json",
    "element_count": 12,
    "components_used": [
      "Stack",
      "Surface",
      "Icon",
      "Text",
      "Button",
      "Separator",
      "Input"
    ],
    "screenshot": "thumbs/auth/login-page-social-leading-01.webp"
  },
  {
    "id": "login-split-carousel-01",
    "name": "Login Split Carousel",
    "category": "auth",
    "description": "Login page variant using Grid layout with 43 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-split-carousel-01.json",
    "element_count": 55,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button",
      "Surface",
      "Badge"
    ],
    "screenshot": "thumbs/auth/login-split-carousel-01.webp"
  },
  {
    "id": "login-split-geometric-01",
    "name": "Login Split Geometric",
    "category": "auth",
    "description": "Login page variant using Grid layout with 28 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-split-geometric-01.json",
    "element_count": 29,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button",
      "Surface"
    ],
    "screenshot": "thumbs/auth/login-split-geometric-01.webp"
  },
  {
    "id": "login-split-image-01",
    "name": "Login Split Image",
    "category": "auth",
    "description": "Login page variant using Grid layout with 22 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-split-image-01.json",
    "element_count": 26,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button",
      "Surface",
      "Icon"
    ],
    "screenshot": "thumbs/auth/login-split-image-01.webp"
  },
  {
    "id": "login-split-image-quote-01",
    "name": "Login Split Image Quote",
    "category": "auth",
    "description": "Login page variant using Grid layout with 31 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-split-image-quote-01.json",
    "element_count": 31,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button",
      "Surface"
    ],
    "screenshot": "thumbs/auth/login-split-image-quote-01.webp"
  },
  {
    "id": "login-split-mockup-01",
    "name": "Login Split Mockup",
    "category": "auth",
    "description": "Login page variant using Grid layout with 24 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-split-mockup-01.json",
    "element_count": 39,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button",
      "Surface"
    ],
    "screenshot": "thumbs/auth/login-split-mockup-01.webp"
  },
  {
    "id": "login-split-mockup-quote-01",
    "name": "Login Split Mockup Quote",
    "category": "auth",
    "description": "Login page variant using Grid layout with 31 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-split-mockup-quote-01.json",
    "element_count": 46,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button",
      "Surface",
      "Avatar"
    ],
    "screenshot": "thumbs/auth/login-split-mockup-quote-01.webp"
  },
  {
    "id": "login-split-quote-01",
    "name": "Login Split Quote",
    "category": "auth",
    "description": "Login page variant using Grid layout with 31 elements",
    "tags": [
      "auth",
      "login",
      "form"
    ],
    "file": "auth/login-split-quote-01.json",
    "element_count": 31,
    "components_used": [
      "Grid",
      "Surface",
      "Stack",
      "Icon",
      "Text",
      "Avatar",
      "Field",
      "Input",
      "Checkbox",
      "Link",
      "Button"
    ],
    "screenshot": "thumbs/auth/login-split-quote-01.webp"
  },
  {
    "id": "register-form-01",
    "category": "auth",
    "subcategory": "register-form",
    "file": "auth/register-form-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Card",
      "Grid",
      "Field",
      "Input",
      "Checkbox",
      "Button",
      "Separator",
      "Text",
      "Link"
    ],
    "name": "Register Form",
    "description": "Register Form block for auth",
    "tags": [
      "auth",
      "register",
      "form"
    ],
    "screenshot": "thumbs/auth/register-form-01.webp"
  },
  {
    "id": "reset-password-01",
    "category": "auth",
    "subcategory": "reset-password",
    "file": "auth/reset-password-01.json",
    "element_count": 15,
    "components_used": [
      "Stack",
      "Card",
      "Field",
      "Input",
      "Progress",
      "Text",
      "Button",
      "Separator",
      "Link"
    ],
    "name": "Reset Password",
    "description": "Reset Password block for auth",
    "tags": [
      "auth",
      "reset",
      "password"
    ],
    "screenshot": "thumbs/auth/reset-password-01.webp"
  },
  {
    "id": "signup-card-01",
    "name": "Signup Card",
    "category": "auth",
    "description": "Signup Card screen with 21 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-card-01.json",
    "element_count": 21,
    "components_used": [
      "Surface",
      "Stack",
      "Icon",
      "Text",
      "Card",
      "Field",
      "Input",
      "Button",
      "Link"
    ],
    "screenshot": "thumbs/auth/signup-card-01.webp"
  },
  {
    "id": "signup-card-02",
    "name": "Signup Card",
    "category": "auth",
    "description": "Signup Card screen with 25 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-card-02.json",
    "element_count": 25,
    "components_used": [
      "Surface",
      "Stack",
      "Card",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link"
    ],
    "screenshot": "thumbs/auth/signup-card-02.webp"
  },
  {
    "id": "signup-nav-01",
    "name": "Signup Nav",
    "category": "auth",
    "description": "Signup Nav screen with 28 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-nav-01.json",
    "element_count": 28,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Link",
      "Field",
      "Input",
      "Button"
    ],
    "screenshot": "thumbs/auth/signup-nav-01.webp"
  },
  {
    "id": "signup-progress-01",
    "name": "Signup Progress",
    "category": "auth",
    "description": "Signup Progress screen with 20 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-progress-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Separator"
    ],
    "screenshot": "thumbs/auth/signup-progress-01.webp"
  },
  {
    "id": "signup-progress-02",
    "name": "Signup Progress",
    "category": "auth",
    "description": "Signup Progress screen with 32 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-progress-02.json",
    "element_count": 32,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Surface",
      "Grid"
    ],
    "screenshot": "thumbs/auth/signup-progress-02.webp"
  },
  {
    "id": "signup-progress-03",
    "name": "Signup Progress",
    "category": "auth",
    "description": "Signup Progress screen with 25 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-progress-03.json",
    "element_count": 25,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Grid"
    ],
    "screenshot": "thumbs/auth/signup-progress-03.webp"
  },
  {
    "id": "signup-sidebar-progress-01",
    "name": "Signup Sidebar Progress",
    "category": "auth",
    "description": "Signup Sidebar Progress screen with 48 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-sidebar-progress-01.json",
    "element_count": 48,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Avatar",
      "Field",
      "Input",
      "Button",
      "Separator"
    ],
    "screenshot": "thumbs/auth/signup-sidebar-progress-01.webp"
  },
  {
    "id": "signup-sidebar-progress-02",
    "name": "Signup Sidebar Progress",
    "category": "auth",
    "description": "Signup Sidebar Progress screen with 43 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-sidebar-progress-02.json",
    "element_count": 43,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Separator",
      "Avatar",
      "Field",
      "Input",
      "Button"
    ],
    "screenshot": "thumbs/auth/signup-sidebar-progress-02.webp"
  },
  {
    "id": "signup-sidebar-progress-03",
    "name": "Signup Sidebar Progress",
    "category": "auth",
    "description": "Signup Sidebar Progress screen with 43 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-sidebar-progress-03.json",
    "element_count": 43,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Badge",
      "Separator",
      "Avatar",
      "Field",
      "Input",
      "Button"
    ],
    "screenshot": "thumbs/auth/signup-sidebar-progress-03.webp"
  },
  {
    "id": "signup-simple-01",
    "name": "Signup Simple",
    "category": "auth",
    "description": "Signup Simple screen with 19 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-simple-01.json",
    "element_count": 19,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link"
    ],
    "screenshot": "thumbs/auth/signup-simple-01.webp"
  },
  {
    "id": "signup-social-01",
    "name": "Signup Social",
    "category": "auth",
    "description": "Signup Social screen with 19 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-social-01.json",
    "element_count": 19,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Separator",
      "Link"
    ],
    "screenshot": "thumbs/auth/signup-social-01.webp"
  },
  {
    "id": "signup-social-leading-01",
    "name": "Signup Social Leading",
    "category": "auth",
    "description": "Signup Social Leading screen with 18 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-social-leading-01.json",
    "element_count": 18,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Button",
      "Separator",
      "Field",
      "Input",
      "Link"
    ],
    "screenshot": "thumbs/auth/signup-social-leading-01.webp"
  },
  {
    "id": "signup-split-app-mockup-01",
    "name": "Signup Split App Mockup",
    "category": "auth",
    "description": "Signup Split App Mockup screen with 26 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-app-mockup-01.json",
    "element_count": 41,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link",
      "Surface",
      "List"
    ],
    "screenshot": "thumbs/auth/signup-split-app-mockup-01.webp"
  },
  {
    "id": "signup-split-arrow-01",
    "name": "Signup Split Arrow",
    "category": "auth",
    "description": "Signup Split Arrow screen with 37 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-arrow-01.json",
    "element_count": 37,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link",
      "Surface",
      "Avatar"
    ],
    "screenshot": "thumbs/auth/signup-split-arrow-01.webp"
  },
  {
    "id": "signup-split-carousel-01",
    "name": "Signup Split Carousel",
    "category": "auth",
    "description": "Signup Split Carousel screen with 40 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-carousel-01.json",
    "element_count": 52,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link",
      "Surface",
      "Badge"
    ],
    "screenshot": "thumbs/auth/signup-split-carousel-01.webp"
  },
  {
    "id": "signup-split-gradient-01",
    "name": "Signup Split Gradient",
    "category": "auth",
    "description": "Signup Split Gradient screen with 25 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-gradient-01.json",
    "element_count": 29,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link",
      "Surface",
      "List"
    ],
    "screenshot": "thumbs/auth/signup-split-gradient-01.webp"
  },
  {
    "id": "signup-split-image-bg-01",
    "name": "Signup Split Image Bg",
    "category": "auth",
    "description": "Signup Split Image Bg screen with 37 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-image-bg-01.json",
    "element_count": 37,
    "components_used": [
      "Grid",
      "Surface",
      "Stack",
      "Icon",
      "Text",
      "Avatar",
      "Field",
      "Input",
      "Button",
      "Link"
    ],
    "screenshot": "thumbs/auth/signup-split-image-bg-01.webp"
  },
  {
    "id": "signup-split-mockup-01",
    "name": "Signup Split Mockup",
    "category": "auth",
    "description": "Signup Split Mockup screen with 27 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-mockup-01.json",
    "element_count": 42,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link",
      "Surface"
    ],
    "screenshot": "thumbs/auth/signup-split-mockup-01.webp"
  },
  {
    "id": "signup-split-mockup-quote-01",
    "name": "Signup Split Mockup Quote",
    "category": "auth",
    "description": "Signup Split Mockup Quote screen with 34 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-mockup-quote-01.json",
    "element_count": 49,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link",
      "Surface",
      "Avatar"
    ],
    "screenshot": "thumbs/auth/signup-split-mockup-quote-01.webp"
  },
  {
    "id": "signup-split-quote-carousel-01",
    "name": "Signup Split Quote Carousel",
    "category": "auth",
    "description": "Signup Split Quote Carousel screen with 40 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-quote-carousel-01.json",
    "element_count": 40,
    "components_used": [
      "Grid",
      "Surface",
      "Stack",
      "Icon",
      "Text",
      "Avatar",
      "Button",
      "Badge",
      "Field",
      "Input",
      "Link"
    ],
    "screenshot": "thumbs/auth/signup-split-quote-carousel-01.webp"
  },
  {
    "id": "signup-split-quote-image-01",
    "name": "Signup Split Quote Image",
    "category": "auth",
    "description": "Signup Split Quote Image screen with 29 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-quote-image-01.json",
    "element_count": 29,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link",
      "Surface",
      "Avatar"
    ],
    "screenshot": "thumbs/auth/signup-split-quote-image-01.webp"
  },
  {
    "id": "signup-split-quote-image-02",
    "name": "Signup Split Quote Image",
    "category": "auth",
    "description": "Signup Split Quote Image screen with 34 elements",
    "tags": [
      "auth",
      "signup"
    ],
    "file": "auth/signup-split-quote-image-02.json",
    "element_count": 34,
    "components_used": [
      "Grid",
      "Stack",
      "Icon",
      "Text",
      "Field",
      "Input",
      "Button",
      "Link",
      "Surface",
      "Card",
      "Avatar"
    ],
    "screenshot": "thumbs/auth/signup-split-quote-image-02.webp"
  },
  {
    "id": "social-login-01",
    "category": "auth",
    "subcategory": "social-login",
    "file": "auth/social-login-01.json",
    "element_count": 18,
    "components_used": [
      "Stack",
      "Card",
      "Button",
      "Separator",
      "Text",
      "Field",
      "Input",
      "Link"
    ],
    "name": "Social Login",
    "description": "Social Login block for auth",
    "tags": [
      "auth",
      "social",
      "login"
    ],
    "screenshot": "thumbs/auth/social-login-01.webp"
  },
  {
    "id": "two-factor-01",
    "category": "auth",
    "subcategory": "two-factor",
    "file": "auth/two-factor-01.json",
    "element_count": 14,
    "components_used": [
      "Stack",
      "Card",
      "Button",
      "Label",
      "InputOTP",
      "Separator",
      "Text",
      "Link"
    ],
    "name": "Two Factor",
    "description": "Two Factor block for auth",
    "tags": [
      "auth",
      "two",
      "factor"
    ],
    "screenshot": "thumbs/auth/two-factor-01.webp"
  },
  {
    "id": "banner-bottom-sticky-01",
    "category": "banners",
    "subcategory": "banner-bottom-sticky",
    "file": "banners/banner-bottom-sticky-01.json",
    "element_count": 9,
    "components_used": [
      "Surface",
      "Stack",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "Banner Bottom Sticky",
    "description": "Banner Bottom Sticky block for banners",
    "tags": [
      "banners",
      "banner",
      "bottom",
      "sticky"
    ],
    "screenshot": "thumbs/banners/banner-bottom-sticky-01.webp"
  },
  {
    "id": "banner-inline-01",
    "category": "banners",
    "subcategory": "banner-inline",
    "file": "banners/banner-inline-01.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Surface",
      "Grid",
      "Chip",
      "Text",
      "Button",
      "Image"
    ],
    "name": "Banner Inline",
    "description": "Banner Inline block for banners",
    "tags": [
      "banners",
      "banner",
      "inline"
    ],
    "screenshot": "thumbs/banners/banner-inline-01.webp"
  },
  {
    "id": "banner-top-01",
    "category": "banners",
    "subcategory": "banner-top",
    "file": "banners/banner-top-01.json",
    "element_count": 6,
    "components_used": [
      "Surface",
      "Stack",
      "Badge",
      "Text",
      "Button"
    ],
    "name": "Banner Top",
    "description": "Banner Top block for banners",
    "tags": [
      "banners",
      "banner",
      "top"
    ],
    "screenshot": "thumbs/banners/banner-top-01.webp"
  },
  {
    "id": "blog-featured-01",
    "category": "blog",
    "subcategory": "blog-featured",
    "file": "blog/blog-featured-01.json",
    "element_count": 13,
    "components_used": [
      "Surface",
      "Stack",
      "Image",
      "Badge",
      "Text",
      "Avatar",
      "Button"
    ],
    "name": "Blog Featured",
    "description": "Blog Featured block for blog",
    "tags": [
      "blog",
      "blog",
      "featured"
    ],
    "screenshot": "thumbs/blog/blog-featured-01.webp"
  },
  {
    "id": "blog-grid-01",
    "category": "blog",
    "subcategory": "blog-grid",
    "file": "blog/blog-grid-01.json",
    "element_count": 46,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "Image",
      "Chip"
    ],
    "name": "Blog Grid",
    "description": "Blog Grid block for blog",
    "tags": [
      "blog",
      "blog",
      "grid"
    ],
    "screenshot": "thumbs/blog/blog-grid-01.webp"
  },
  {
    "id": "blog-list-01",
    "category": "blog",
    "subcategory": "blog-list",
    "file": "blog/blog-list-01.json",
    "element_count": 34,
    "components_used": [
      "Stack",
      "Text",
      "Image",
      "Chip",
      "Separator"
    ],
    "name": "Blog List",
    "description": "Blog List block for blog",
    "tags": [
      "blog",
      "blog",
      "list"
    ],
    "screenshot": "thumbs/blog/blog-list-01.webp"
  },
  {
    "id": "blog-newsletter-01",
    "category": "blog",
    "subcategory": "blog-newsletter",
    "file": "blog/blog-newsletter-01.json",
    "element_count": 26,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "Image",
      "Surface",
      "InputGroup",
      "Input",
      "Button"
    ],
    "name": "Blog Newsletter",
    "description": "Blog Newsletter block for blog",
    "tags": [
      "blog",
      "blog",
      "newsletter"
    ],
    "screenshot": "thumbs/blog/blog-newsletter-01.webp"
  },
  {
    "id": "blog-post-header-01",
    "category": "blog",
    "subcategory": "blog-post-header",
    "file": "blog/blog-post-header-01.json",
    "element_count": 17,
    "components_used": [
      "Stack",
      "Breadcrumbs",
      "Chip",
      "Text",
      "Avatar",
      "ButtonGroup",
      "Button",
      "Image"
    ],
    "name": "Blog Post Header",
    "description": "Blog Post Header block for blog",
    "tags": [
      "blog",
      "blog",
      "post",
      "header"
    ],
    "screenshot": "thumbs/blog/blog-post-header-01.webp"
  },
  {
    "id": "blog-sidebar-01",
    "category": "blog",
    "subcategory": "blog-sidebar",
    "file": "blog/blog-sidebar-01.json",
    "element_count": 37,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Card",
      "Image",
      "Search",
      "NavMenu",
      "Chip",
      "List"
    ],
    "name": "Blog Sidebar",
    "description": "Blog Sidebar block for blog",
    "tags": [
      "blog",
      "blog",
      "sidebar"
    ],
    "screenshot": "thumbs/blog/blog-sidebar-01.webp"
  },
  {
    "id": "before-after-01",
    "category": "comparison",
    "subcategory": "before-after",
    "file": "comparison/before-after-01.json",
    "element_count": 16,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "Badge",
      "AspectRatio",
      "Image"
    ],
    "name": "Before After",
    "description": "Before After block for comparison",
    "tags": [
      "comparison",
      "before",
      "after"
    ],
    "screenshot": "thumbs/comparison/before-after-01.webp"
  },
  {
    "id": "comparison-table-01",
    "category": "comparison",
    "subcategory": "comparison-table",
    "file": "comparison/comparison-table-01.json",
    "element_count": 4,
    "components_used": [
      "Stack",
      "Text",
      "DataTable"
    ],
    "name": "Comparison Table",
    "description": "Comparison Table block for comparison",
    "tags": [
      "comparison",
      "comparison",
      "table"
    ],
    "screenshot": "thumbs/comparison/comparison-table-01.webp"
  },
  {
    "id": "vs-layout-01",
    "category": "comparison",
    "subcategory": "vs-layout",
    "file": "comparison/vs-layout-01.json",
    "element_count": 13,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "List",
      "Separator",
      "Surface",
      "Badge"
    ],
    "name": "Vs Layout",
    "description": "Vs Layout block for comparison",
    "tags": [
      "comparison",
      "vs",
      "layout"
    ],
    "screenshot": "thumbs/comparison/vs-layout-01.webp"
  },
  {
    "id": "contact-form-simple-01",
    "category": "contact",
    "subcategory": "contact-form-simple",
    "file": "contact/contact-form-simple-01.json",
    "element_count": 18,
    "components_used": [
      "Stack",
      "Text",
      "Surface",
      "Grid",
      "Field",
      "Input",
      "Textarea",
      "Button"
    ],
    "name": "Contact Form Simple",
    "description": "Contact Form Simple block for contact",
    "tags": [
      "contact",
      "contact",
      "form",
      "simple"
    ],
    "screenshot": "thumbs/contact/contact-form-simple-01.webp"
  },
  {
    "id": "contact-info-01",
    "category": "contact",
    "subcategory": "contact-info",
    "file": "contact/contact-info-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "Button"
    ],
    "name": "Contact Info",
    "description": "Contact Info block for contact",
    "tags": [
      "contact",
      "contact",
      "info"
    ],
    "screenshot": "thumbs/contact/contact-info-01.webp"
  },
  {
    "id": "contact-offices-01",
    "category": "contact",
    "subcategory": "contact-offices",
    "file": "contact/contact-offices-01.json",
    "element_count": 26,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "Badge"
    ],
    "name": "Contact Offices",
    "description": "Contact Offices block for contact",
    "tags": [
      "contact",
      "contact",
      "offices"
    ],
    "screenshot": "thumbs/contact/contact-offices-01.webp"
  },
  {
    "id": "contact-split-01",
    "category": "contact",
    "subcategory": "contact-split",
    "file": "contact/contact-split-01.json",
    "element_count": 35,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Surface",
      "Field",
      "Input",
      "Textarea",
      "Button",
      "Separator"
    ],
    "name": "Contact Split",
    "description": "Contact Split block for contact",
    "tags": [
      "contact",
      "contact",
      "split"
    ],
    "screenshot": "thumbs/contact/contact-split-01.webp"
  },
  {
    "id": "contact-with-map-01",
    "category": "contact",
    "subcategory": "contact-with-map",
    "file": "contact/contact-with-map-01.json",
    "element_count": 26,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Image",
      "Surface",
      "Field",
      "Input",
      "Textarea",
      "Button"
    ],
    "name": "Contact With Map",
    "description": "Contact With Map block for contact",
    "tags": [
      "contact",
      "contact",
      "with",
      "map"
    ],
    "screenshot": "thumbs/contact/contact-with-map-01.webp"
  },
  {
    "id": "content-numbered-steps-01",
    "category": "content",
    "subcategory": "content-numbered-steps",
    "file": "content/content-numbered-steps-01.json",
    "element_count": 35,
    "components_used": [
      "Stack",
      "Text",
      "Avatar",
      "Separator",
      "Button"
    ],
    "name": "Content Numbered Steps",
    "description": "Content Numbered Steps block for content",
    "tags": [
      "content",
      "content",
      "numbered",
      "steps"
    ],
    "screenshot": "thumbs/content/content-numbered-steps-01.webp"
  },
  {
    "id": "content-quote-highlight-01",
    "category": "content",
    "subcategory": "content-quote-highlight",
    "file": "content/content-quote-highlight-01.json",
    "element_count": 19,
    "components_used": [
      "Stack",
      "Chip",
      "Text",
      "Surface",
      "Avatar",
      "StatCard"
    ],
    "name": "Content Quote Highlight",
    "description": "Content Quote Highlight block for content",
    "tags": [
      "content",
      "content",
      "quote",
      "highlight"
    ],
    "screenshot": "thumbs/content/content-quote-highlight-01.webp"
  },
  {
    "id": "content-section-01",
    "category": "content",
    "subcategory": "content-section",
    "file": "content/content-section-01.json",
    "element_count": 12,
    "components_used": [
      "Stack",
      "Chip",
      "Text",
      "Image",
      "Button"
    ],
    "name": "Content Section",
    "description": "Content Section block for content",
    "tags": [
      "content",
      "content",
      "section"
    ],
    "screenshot": "thumbs/content/content-section-01.webp"
  },
  {
    "id": "content-split-01",
    "category": "content",
    "subcategory": "content-split",
    "file": "content/content-split-01.json",
    "element_count": 13,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Badge",
      "List"
    ],
    "name": "Content Split",
    "description": "Content Split block for content",
    "tags": [
      "content",
      "content",
      "split"
    ],
    "screenshot": "thumbs/content/content-split-01.webp"
  },
  {
    "id": "content-video-embed-01",
    "category": "content",
    "subcategory": "content-video-embed",
    "file": "content/content-video-embed-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "AspectRatio",
      "Surface",
      "Image",
      "Icon",
      "List",
      "Separator"
    ],
    "name": "Content Video Embed",
    "description": "Content Video Embed block for content",
    "tags": [
      "content",
      "content",
      "video",
      "embed"
    ],
    "screenshot": "thumbs/content/content-video-embed-01.webp"
  },
  {
    "id": "content-with-image-01",
    "category": "content",
    "subcategory": "content-with-image",
    "file": "content/content-with-image-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Image",
      "Badge",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "Content With Image",
    "description": "Content With Image block for content",
    "tags": [
      "content",
      "content",
      "with",
      "image"
    ],
    "screenshot": "thumbs/content/content-with-image-01.webp"
  },
  {
    "id": "cta-abstract-images-01",
    "category": "cta",
    "subcategory": "cta-abstract-images",
    "file": "cta/cta-abstract-images-01.json",
    "element_count": 17,
    "components_used": [
      "Stack",
      "Grid",
      "Text",
      "ButtonGroup",
      "Button",
      "Image"
    ],
    "name": "CTA Abstract Images",
    "description": "Centered call to action flanked by an abstract image collage, with no-contract reassurance copy and dual buttons.",
    "tags": [
      "cta",
      "abstract",
      "collage",
      "centered"
    ],
    "screenshot": "thumbs/cta/cta-abstract-images-01.webp"
  },
  {
    "id": "cta-banner-01",
    "category": "cta",
    "subcategory": "cta-banner",
    "file": "cta/cta-banner-01.json",
    "element_count": 8,
    "components_used": [
      "Surface",
      "Stack",
      "Text",
      "Button"
    ],
    "name": "CTA Banner",
    "description": "Cta Banner block for cta",
    "tags": [
      "cta",
      "cta",
      "banner"
    ],
    "screenshot": "thumbs/cta/cta-banner-01.webp"
  },
  {
    "id": "cta-card-horizontal-01",
    "category": "cta",
    "subcategory": "cta-card-horizontal",
    "file": "cta/cta-card-horizontal-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Card",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Card Horizontal",
    "description": "Horizontal card call to action with trial headline, supporting copy, and side-by-side action buttons.",
    "tags": [
      "cta",
      "card",
      "horizontal",
      "trial"
    ],
    "screenshot": "thumbs/cta/cta-card-horizontal-01.webp"
  },
  {
    "id": "cta-card-horizontal-split-01",
    "category": "cta",
    "subcategory": "cta-card-horizontal-split",
    "file": "cta/cta-card-horizontal-split-01.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Surface",
      "Card",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Card Horizontal Split",
    "description": "Two-tone horizontal card call to action splitting copy and actions across a raised surface.",
    "tags": [
      "cta",
      "card",
      "horizontal",
      "split"
    ],
    "screenshot": "thumbs/cta/cta-card-horizontal-split-01.webp"
  },
  {
    "id": "cta-card-vertical-01",
    "category": "cta",
    "subcategory": "cta-card-vertical",
    "file": "cta/cta-card-vertical-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Card",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Card Vertical",
    "description": "Compact vertical card call to action with centered trial headline and stacked buttons.",
    "tags": [
      "cta",
      "card",
      "vertical",
      "centered"
    ],
    "screenshot": "thumbs/cta/cta-card-vertical-01.webp"
  },
  {
    "id": "cta-download-01",
    "category": "cta",
    "subcategory": "cta-download",
    "file": "cta/cta-download-01.json",
    "element_count": 17,
    "components_used": [
      "Grid",
      "Stack",
      "Badge",
      "Text",
      "Button",
      "Image",
      "Chip"
    ],
    "name": "CTA Download",
    "description": "Cta Download block for cta",
    "tags": [
      "cta",
      "cta",
      "download"
    ],
    "screenshot": "thumbs/cta/cta-download-01.webp"
  },
  {
    "id": "cta-floating-01",
    "category": "cta",
    "subcategory": "cta-floating",
    "file": "cta/cta-floating-01.json",
    "element_count": 10,
    "components_used": [
      "Surface",
      "Stack",
      "Badge",
      "Text",
      "Button"
    ],
    "name": "CTA Floating",
    "description": "Cta Floating block for cta",
    "tags": [
      "cta",
      "cta",
      "floating"
    ],
    "screenshot": "thumbs/cta/cta-floating-01.webp"
  },
  {
    "id": "cta-iphone-mockup-01",
    "category": "cta",
    "subcategory": "cta-iphone-mockup",
    "file": "cta/cta-iphone-mockup-01.json",
    "element_count": 14,
    "components_used": [
      "Stack",
      "Grid",
      "Text",
      "List",
      "ButtonGroup",
      "Button",
      "Image"
    ],
    "name": "CTA iPhone Mockup",
    "description": "Split call to action pairing benefit list and buttons with an iPhone app mockup image.",
    "tags": [
      "cta",
      "iphone",
      "mockup",
      "split"
    ],
    "screenshot": "thumbs/cta/cta-iphone-mockup-01.webp"
  },
  {
    "id": "cta-iphone-mockup-02",
    "category": "cta",
    "subcategory": "cta-iphone-mockup",
    "file": "cta/cta-iphone-mockup-02.json",
    "element_count": 9,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button",
      "Image"
    ],
    "name": "CTA iPhone Mockup Centered",
    "description": "Centered call to action with headline, buttons, and an iPhone mockup image below.",
    "tags": [
      "cta",
      "iphone",
      "mockup",
      "centered"
    ],
    "screenshot": "thumbs/cta/cta-iphone-mockup-02.webp"
  },
  {
    "id": "cta-iphone-mockup-03",
    "category": "cta",
    "subcategory": "cta-iphone-mockup",
    "file": "cta/cta-iphone-mockup-03.json",
    "element_count": 9,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button",
      "Image"
    ],
    "name": "CTA iPhone Mockup Minimal",
    "description": "Minimal trial call to action above a cropped iPhone mockup image.",
    "tags": [
      "cta",
      "iphone",
      "mockup",
      "minimal"
    ],
    "screenshot": "thumbs/cta/cta-iphone-mockup-03.webp"
  },
  {
    "id": "cta-iphone-mockup-04",
    "category": "cta",
    "subcategory": "cta-iphone-mockup",
    "file": "cta/cta-iphone-mockup-04.json",
    "element_count": 14,
    "components_used": [
      "Stack",
      "Grid",
      "Image",
      "Text",
      "List",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA iPhone Mockup Reversed",
    "description": "Split call to action with iPhone mockup on the left and benefit list with buttons on the right.",
    "tags": [
      "cta",
      "iphone",
      "mockup",
      "reversed"
    ],
    "screenshot": "thumbs/cta/cta-iphone-mockup-04.webp"
  },
  {
    "id": "cta-screen-mockup-01",
    "category": "cta",
    "subcategory": "cta-screen-mockup",
    "file": "cta/cta-screen-mockup-01.json",
    "element_count": 14,
    "components_used": [
      "Stack",
      "Grid",
      "Text",
      "List",
      "ButtonGroup",
      "Button",
      "Image"
    ],
    "name": "CTA Screen Mockup",
    "description": "Split call to action pairing benefit list and buttons with a desktop app screenshot.",
    "tags": [
      "cta",
      "screen",
      "mockup",
      "split"
    ],
    "screenshot": "thumbs/cta/cta-screen-mockup-01.webp"
  },
  {
    "id": "cta-screen-mockup-02",
    "category": "cta",
    "subcategory": "cta-screen-mockup",
    "file": "cta/cta-screen-mockup-02.json",
    "element_count": 9,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button",
      "Image"
    ],
    "name": "CTA Screen Mockup Centered",
    "description": "Centered call to action with headline and buttons above a desktop app screenshot.",
    "tags": [
      "cta",
      "screen",
      "mockup",
      "centered"
    ],
    "screenshot": "thumbs/cta/cta-screen-mockup-02.webp"
  },
  {
    "id": "cta-screen-mockup-03",
    "category": "cta",
    "subcategory": "cta-screen-mockup",
    "file": "cta/cta-screen-mockup-03.json",
    "element_count": 9,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button",
      "Image"
    ],
    "name": "CTA Screen Mockup Minimal",
    "description": "Minimal call to action with a full-width desktop app screenshot below the buttons.",
    "tags": [
      "cta",
      "screen",
      "mockup",
      "minimal"
    ],
    "screenshot": "thumbs/cta/cta-screen-mockup-03.webp"
  },
  {
    "id": "cta-screen-mockup-04",
    "category": "cta",
    "subcategory": "cta-screen-mockup",
    "file": "cta/cta-screen-mockup-04.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Grid",
      "Image",
      "Text",
      "Badge",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Screen Mockup Checklist",
    "description": "Split call to action with desktop screenshot on the left and a check-marked feature list with buttons.",
    "tags": [
      "cta",
      "screen",
      "mockup",
      "checklist"
    ],
    "screenshot": "thumbs/cta/cta-screen-mockup-04.webp"
  },
  {
    "id": "cta-simple-01",
    "category": "cta",
    "subcategory": "cta-simple",
    "file": "cta/cta-simple-01.json",
    "element_count": 6,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Simple",
    "description": "Cta Simple block for cta",
    "tags": [
      "cta",
      "cta",
      "simple"
    ],
    "screenshot": "thumbs/cta/cta-simple-01.webp"
  },
  {
    "id": "cta-simple-centered-01",
    "category": "cta",
    "subcategory": "cta-simple-centered",
    "file": "cta/cta-simple-centered-01.json",
    "element_count": 8,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Simple Centered",
    "description": "Centered headline, supporting line, and button pair on a plain background.",
    "tags": [
      "cta",
      "simple",
      "centered"
    ],
    "screenshot": "thumbs/cta/cta-simple-centered-01.webp"
  },
  {
    "id": "cta-simple-left-01",
    "category": "cta",
    "subcategory": "cta-simple-left",
    "file": "cta/cta-simple-left-01.json",
    "element_count": 8,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Simple Left",
    "description": "Left-aligned call to action with headline, supporting copy, and inline buttons.",
    "tags": [
      "cta",
      "simple",
      "left-aligned"
    ],
    "screenshot": "thumbs/cta/cta-simple-left-01.webp"
  },
  {
    "id": "cta-simple-logos-01",
    "category": "cta",
    "subcategory": "cta-simple-logos",
    "file": "cta/cta-simple-logos-01.json",
    "element_count": 17,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button",
      "Separator",
      "Icon"
    ],
    "name": "CTA Simple Logos",
    "description": "Centered call to action followed by a separator and a row of customer logos.",
    "tags": [
      "cta",
      "simple",
      "logos",
      "social-proof"
    ],
    "screenshot": "thumbs/cta/cta-simple-logos-01.webp"
  },
  {
    "id": "cta-simple-logos-02",
    "category": "cta",
    "subcategory": "cta-simple-logos",
    "file": "cta/cta-simple-logos-02.json",
    "element_count": 25,
    "components_used": [
      "Stack",
      "Grid",
      "Text",
      "ButtonGroup",
      "Button",
      "Icon"
    ],
    "name": "CTA Simple Logos Grid",
    "description": "Call to action beside a grid of customer logos for lightweight social proof.",
    "tags": [
      "cta",
      "simple",
      "logos",
      "grid"
    ],
    "screenshot": "thumbs/cta/cta-simple-logos-02.webp"
  },
  {
    "id": "cta-split-01",
    "category": "cta",
    "subcategory": "cta-split",
    "file": "cta/cta-split-01.json",
    "element_count": 21,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Surface",
      "Field",
      "Input",
      "Button"
    ],
    "name": "CTA Split",
    "description": "Cta Split block for cta",
    "tags": [
      "cta",
      "cta",
      "split"
    ],
    "screenshot": "thumbs/cta/cta-split-01.webp"
  },
  {
    "id": "cta-split-image-01",
    "category": "cta",
    "subcategory": "cta-split-image",
    "file": "cta/cta-split-image-01.json",
    "element_count": 9,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "List",
      "ButtonGroup",
      "Button",
      "Image"
    ],
    "name": "CTA Split Image",
    "description": "Split call to action with startup social-proof headline, benefit list, and a photo panel.",
    "tags": [
      "cta",
      "split",
      "image",
      "social-proof"
    ],
    "screenshot": "thumbs/cta/cta-split-image-01.webp"
  },
  {
    "id": "cta-split-image-02",
    "category": "cta",
    "subcategory": "cta-split-image",
    "file": "cta/cta-split-image-02.json",
    "element_count": 9,
    "components_used": [
      "Grid",
      "Image",
      "Stack",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Split Image Reversed",
    "description": "Split call to action with photo on the left and trial copy with buttons on the right.",
    "tags": [
      "cta",
      "split",
      "image",
      "reversed"
    ],
    "screenshot": "thumbs/cta/cta-split-image-02.webp"
  },
  {
    "id": "cta-split-image-03",
    "category": "cta",
    "subcategory": "cta-split-image",
    "file": "cta/cta-split-image-03.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Image",
      "Card",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Split Image Card",
    "description": "Card-framed call to action stacked over a full-width photo.",
    "tags": [
      "cta",
      "split",
      "image",
      "card"
    ],
    "screenshot": "thumbs/cta/cta-split-image-03.webp"
  },
  {
    "id": "cta-split-image-04",
    "category": "cta",
    "subcategory": "cta-split-image",
    "file": "cta/cta-split-image-04.json",
    "element_count": 10,
    "components_used": [
      "Grid",
      "Image",
      "Stack",
      "Text",
      "List",
      "ButtonGroup",
      "Button"
    ],
    "name": "CTA Split Image Checklist",
    "description": "Split call to action pairing a benefit checklist with a photo panel.",
    "tags": [
      "cta",
      "split",
      "image",
      "checklist"
    ],
    "screenshot": "thumbs/cta/cta-split-image-04.webp"
  },
  {
    "id": "cta-split-image-quote-01",
    "category": "cta",
    "subcategory": "cta-split-image-quote",
    "file": "cta/cta-split-image-quote-01.json",
    "element_count": 27,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Badge",
      "Button",
      "Image",
      "Surface",
      "Avatar"
    ],
    "name": "CTA Split Image Quote",
    "description": "Split call to action with check-marked benefits and a customer quote card over the photo.",
    "tags": [
      "cta",
      "split",
      "image",
      "quote",
      "testimonial"
    ],
    "screenshot": "thumbs/cta/cta-split-image-quote-01.webp"
  },
  {
    "id": "cta-split-image-quote-02",
    "category": "cta",
    "subcategory": "cta-split-image-quote",
    "file": "cta/cta-split-image-quote-02.json",
    "element_count": 18,
    "components_used": [
      "Grid",
      "Stack",
      "Image",
      "Surface",
      "Text",
      "Avatar",
      "Button"
    ],
    "name": "CTA Split Image Quote Reversed",
    "description": "Split call to action with photo and overlaid customer quote on the left, trial copy on the right.",
    "tags": [
      "cta",
      "split",
      "image",
      "quote",
      "reversed"
    ],
    "screenshot": "thumbs/cta/cta-split-image-quote-02.webp"
  },
  {
    "id": "cta-split-image-quote-03",
    "category": "cta",
    "subcategory": "cta-split-image-quote",
    "file": "cta/cta-split-image-quote-03.json",
    "element_count": 15,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Button",
      "Image",
      "Avatar"
    ],
    "name": "CTA Split Image Quote Minimal",
    "description": "Split call to action with inline customer quote and avatar under the buttons.",
    "tags": [
      "cta",
      "split",
      "image",
      "quote",
      "minimal"
    ],
    "screenshot": "thumbs/cta/cta-split-image-quote-03.webp"
  },
  {
    "id": "cta-split-image-quote-04",
    "category": "cta",
    "subcategory": "cta-split-image-quote",
    "file": "cta/cta-split-image-quote-04.json",
    "element_count": 16,
    "components_used": [
      "Stack",
      "Image",
      "Surface",
      "Text",
      "Avatar",
      "Button"
    ],
    "name": "CTA Split Image Quote Stacked",
    "description": "Stacked call to action with photo, overlaid quote card, and closing buttons.",
    "tags": [
      "cta",
      "split",
      "image",
      "quote",
      "stacked"
    ],
    "screenshot": "thumbs/cta/cta-split-image-quote-04.webp"
  },
  {
    "id": "cta-with-form-01",
    "category": "cta",
    "subcategory": "cta-with-form",
    "file": "cta/cta-with-form-01.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Text",
      "Field",
      "Input",
      "Button",
      "AvatarGroup"
    ],
    "name": "CTA With Form",
    "description": "Cta With Form block for cta",
    "tags": [
      "cta",
      "cta",
      "with",
      "form"
    ],
    "screenshot": "thumbs/cta/cta-with-form-01.webp"
  },
  {
    "id": "activity-feed-01",
    "category": "dashboard",
    "subcategory": "activity-feed",
    "file": "dashboard/activity-feed-01.json",
    "element_count": 5,
    "components_used": [
      "Stack",
      "Text",
      "Link",
      "List"
    ],
    "name": "Activity Feed",
    "description": "Activity Feed block for dashboard",
    "tags": [
      "dashboard",
      "activity",
      "feed"
    ],
    "screenshot": "thumbs/dashboard/activity-feed-01.webp"
  },
  {
    "id": "chart-panel-01",
    "name": "Chart Panel",
    "category": "dashboard",
    "description": "Chart card with bar chart (6 months revenue) and summary stats row",
    "tags": [
      "dashboard",
      "chart",
      "analytics",
      "visualization"
    ],
    "file": "dashboard/chart-panel-01.json",
    "element_count": 22,
    "components_used": [
      "Stack",
      "Text",
      "Badge",
      "Select",
      "Button",
      "ChartCard",
      "Chart",
      "Grid",
      "StatCard",
      "Separator",
      "List"
    ],
    "screenshot": "thumbs/dashboard/chart-panel-01.webp"
  },
  {
    "id": "chart-section-01",
    "category": "dashboard",
    "subcategory": "chart-section",
    "file": "dashboard/chart-section-01.json",
    "element_count": 5,
    "components_used": [
      "Grid",
      "ChartCard",
      "Chart"
    ],
    "name": "Chart Section",
    "description": "Chart Section block for dashboard",
    "tags": [
      "dashboard",
      "chart",
      "section"
    ],
    "screenshot": "thumbs/dashboard/chart-section-01.webp"
  },
  {
    "id": "dashboard-header-01",
    "category": "dashboard",
    "subcategory": "dashboard-header",
    "file": "dashboard/dashboard-header-01.json",
    "element_count": 8,
    "components_used": [
      "Stack",
      "Text",
      "DatePicker",
      "Button"
    ],
    "name": "Dashboard Header",
    "description": "Dashboard Header block for dashboard",
    "tags": [
      "dashboard",
      "dashboard",
      "header"
    ],
    "screenshot": "thumbs/dashboard/dashboard-header-01.webp"
  },
  {
    "id": "data-table-01",
    "name": "Data Table Section",
    "category": "dashboard",
    "description": "Data table with header bar (title + search + filter), 6 rows, and pagination",
    "tags": [
      "dashboard",
      "table",
      "data",
      "pagination"
    ],
    "file": "dashboard/data-table-01.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Search",
      "Select",
      "ButtonGroup",
      "Button",
      "DataTable",
      "Pagination"
    ],
    "screenshot": "thumbs/dashboard/data-table-01.webp"
  },
  {
    "id": "empty-state-panel-01",
    "category": "dashboard",
    "subcategory": "empty-state-panel",
    "file": "dashboard/empty-state-panel-01.json",
    "element_count": 6,
    "components_used": [
      "Surface",
      "Stack",
      "EmptyState",
      "Button"
    ],
    "name": "Empty State Panel",
    "description": "Dashboard panel empty state on a raised surface with icon, explanation, and primary and secondary actions.",
    "tags": [
      "dashboard",
      "empty-state",
      "panel",
      "onboarding"
    ],
    "screenshot": "thumbs/dashboard/empty-state-panel-01.webp"
  },
  {
    "id": "header-01",
    "category": "dashboard",
    "subcategory": "header",
    "file": "dashboard/header-01.json",
    "element_count": 28,
    "components_used": [
      "Stack",
      "Navbar",
      "Avatar",
      "Text",
      "Search",
      "Button",
      "Badge",
      "Separator",
      "Breadcrumbs",
      "Tabs"
    ],
    "name": "Header",
    "description": "Header block for dashboard",
    "tags": [
      "dashboard",
      "header"
    ],
    "screenshot": "thumbs/dashboard/header-01.webp"
  },
  {
    "id": "kanban-board-01",
    "category": "dashboard",
    "subcategory": "kanban-board",
    "file": "dashboard/kanban-board-01.json",
    "element_count": 20,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Badge",
      "Card"
    ],
    "name": "Kanban Board",
    "description": "Kanban Board block for dashboard",
    "tags": [
      "dashboard",
      "kanban",
      "board"
    ],
    "screenshot": "thumbs/dashboard/kanban-board-01.webp"
  },
  {
    "id": "notification-panel-01",
    "category": "dashboard",
    "subcategory": "notification-panel",
    "file": "dashboard/notification-panel-01.json",
    "element_count": 8,
    "components_used": [
      "Stack",
      "Text",
      "Badge",
      "Button",
      "List"
    ],
    "name": "Notification Panel",
    "description": "Notification Panel block for dashboard",
    "tags": [
      "dashboard",
      "notification",
      "panel"
    ],
    "screenshot": "thumbs/dashboard/notification-panel-01.webp"
  },
  {
    "id": "sidebar-layout-01",
    "category": "dashboard",
    "subcategory": "sidebar-layout",
    "file": "dashboard/sidebar-layout-01.json",
    "element_count": 31,
    "components_used": [
      "Stack",
      "Sidebar",
      "Text",
      "Search",
      "Button",
      "Avatar",
      "Grid",
      "StatCard",
      "Separator",
      "ButtonGroup",
      "DataTable",
      "Card",
      "List"
    ],
    "name": "Sidebar Layout",
    "description": "Sidebar Layout block for dashboard",
    "tags": [
      "dashboard",
      "sidebar",
      "layout"
    ],
    "screenshot": "thumbs/dashboard/sidebar-layout-01.webp"
  },
  {
    "id": "stats-cards-row-01",
    "category": "dashboard",
    "subcategory": "stats-cards-row",
    "file": "dashboard/stats-cards-row-01.json",
    "element_count": 5,
    "components_used": [
      "Grid",
      "StatCard"
    ],
    "name": "Stats Cards Row",
    "description": "Stats Cards Row block for dashboard",
    "tags": [
      "dashboard",
      "stats",
      "cards",
      "row"
    ],
    "screenshot": "thumbs/dashboard/stats-cards-row-01.webp"
  },
  {
    "id": "stats-row-01",
    "name": "Stats Row",
    "category": "dashboard",
    "description": "4-column KPI stat cards row (Revenue, Users, Conversion, Avg Order) with trends",
    "tags": [
      "dashboard",
      "stats",
      "kpi",
      "metrics"
    ],
    "file": "dashboard/stats-row-01.json",
    "element_count": 5,
    "components_used": [
      "Grid",
      "StatCard"
    ],
    "screenshot": "thumbs/dashboard/stats-row-01.webp"
  },
  {
    "id": "empty-state-01",
    "name": "Empty State",
    "category": "data-display",
    "description": "Centered empty state with icon, title, message, and action button",
    "tags": [
      "empty",
      "placeholder",
      "no-data",
      "cta"
    ],
    "file": "data-display/empty-state-01.json",
    "element_count": 3,
    "components_used": [
      "Stack",
      "EmptyState",
      "Button"
    ],
    "screenshot": "thumbs/data-display/empty-state-01.webp"
  },
  {
    "id": "notification-center-01",
    "name": "Notification Center",
    "category": "data-display",
    "description": "Notification list with header, mark-all-read button, and 6 notification items",
    "tags": [
      "notifications",
      "list",
      "alerts",
      "inbox"
    ],
    "file": "data-display/notification-center-01.json",
    "element_count": 5,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "List"
    ],
    "screenshot": "thumbs/data-display/notification-center-01.webp"
  },
  {
    "id": "profile-01",
    "name": "User Profile",
    "category": "data-display",
    "description": "Profile page with avatar header, 3 stat cards, tabbed content, activity list",
    "tags": [
      "profile",
      "user",
      "stats",
      "tabs",
      "activity"
    ],
    "file": "data-display/profile-01.json",
    "element_count": 13,
    "components_used": [
      "Stack",
      "Avatar",
      "Text",
      "Button",
      "StatCard",
      "Tabs",
      "List"
    ],
    "screenshot": "thumbs/data-display/profile-01.webp"
  },
  {
    "id": "category-grid-01",
    "category": "ecommerce",
    "subcategory": "category-grid",
    "file": "ecommerce/category-grid-01.json",
    "element_count": 29,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "Image",
      "Badge"
    ],
    "name": "Category Grid",
    "description": "Category Grid block for ecommerce",
    "tags": [
      "ecommerce",
      "category",
      "grid"
    ],
    "screenshot": "thumbs/ecommerce/category-grid-01.webp"
  },
  {
    "id": "checkout-form-01",
    "category": "ecommerce",
    "subcategory": "checkout-form",
    "file": "ecommerce/checkout-form-01.json",
    "element_count": 44,
    "components_used": [
      "Stack",
      "Text",
      "Stepper",
      "Field",
      "Input",
      "Select",
      "Separator",
      "Checkbox",
      "Surface",
      "List",
      "Button"
    ],
    "name": "Checkout Form",
    "description": "Checkout Form block for ecommerce",
    "tags": [
      "ecommerce",
      "checkout",
      "form"
    ],
    "screenshot": "thumbs/ecommerce/checkout-form-01.webp"
  },
  {
    "id": "order-summary-01",
    "name": "Order Summary",
    "category": "ecommerce",
    "description": "Order summary card with line items, subtotal/shipping/tax/total, promo code, checkout",
    "tags": [
      "ecommerce",
      "order",
      "cart",
      "summary",
      "checkout"
    ],
    "file": "ecommerce/order-summary-01.json",
    "element_count": 51,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Grid",
      "Surface",
      "Separator",
      "DataTable",
      "Button"
    ],
    "screenshot": "thumbs/ecommerce/order-summary-01.webp"
  },
  {
    "id": "product-card-01",
    "category": "ecommerce",
    "subcategory": "product-card",
    "file": "ecommerce/product-card-01.json",
    "element_count": 20,
    "components_used": [
      "Card",
      "Stack",
      "AspectRatio",
      "Image",
      "Badge",
      "Text",
      "ToggleGroup",
      "Button"
    ],
    "name": "Product Card",
    "description": "Product Card block for ecommerce",
    "tags": [
      "ecommerce",
      "product",
      "card"
    ],
    "screenshot": "thumbs/ecommerce/product-card-01.webp"
  },
  {
    "id": "product-carousel-01",
    "category": "ecommerce",
    "subcategory": "product-carousel",
    "file": "ecommerce/product-carousel-01.json",
    "element_count": 37,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button",
      "Grid",
      "Card",
      "Image",
      "Badge"
    ],
    "name": "Product Carousel",
    "description": "Product Carousel block for ecommerce",
    "tags": [
      "ecommerce",
      "product",
      "carousel"
    ],
    "screenshot": "thumbs/ecommerce/product-carousel-01.webp"
  },
  {
    "id": "product-detail-01",
    "category": "ecommerce",
    "subcategory": "product-detail",
    "file": "ecommerce/product-detail-01.json",
    "element_count": 32,
    "components_used": [
      "Grid",
      "Stack",
      "AspectRatio",
      "Image",
      "Breadcrumbs",
      "Text",
      "Link",
      "Badge",
      "Separator",
      "ToggleGroup",
      "Select",
      "Button",
      "Alert",
      "List"
    ],
    "name": "Product Detail",
    "description": "Product Detail block for ecommerce",
    "tags": [
      "ecommerce",
      "product",
      "detail"
    ],
    "screenshot": "thumbs/ecommerce/product-detail-01.webp"
  },
  {
    "id": "product-grid-01",
    "name": "Product Grid",
    "category": "ecommerce",
    "description": "Product listing with filter chips and 3-column grid of 6 product cards",
    "tags": [
      "ecommerce",
      "products",
      "grid",
      "cards",
      "shopping"
    ],
    "file": "ecommerce/product-grid-01.json",
    "element_count": 22,
    "components_used": [
      "Stack",
      "Text",
      "Select",
      "Chip",
      "Grid",
      "Card",
      "Button"
    ],
    "screenshot": "thumbs/ecommerce/product-grid-01.webp"
  },
  {
    "id": "shopping-cart-01",
    "category": "ecommerce",
    "subcategory": "shopping-cart",
    "file": "ecommerce/shopping-cart-01.json",
    "element_count": 56,
    "components_used": [
      "Stack",
      "Text",
      "Badge",
      "Image",
      "Select",
      "Button",
      "Separator",
      "Surface",
      "Input"
    ],
    "name": "Shopping Cart",
    "description": "Shopping Cart block for ecommerce",
    "tags": [
      "ecommerce",
      "shopping",
      "cart"
    ],
    "screenshot": "thumbs/ecommerce/shopping-cart-01.webp"
  },
  {
    "id": "wishlist-01",
    "category": "ecommerce",
    "subcategory": "wishlist",
    "file": "ecommerce/wishlist-01.json",
    "element_count": 39,
    "components_used": [
      "Stack",
      "Text",
      "Badge",
      "Button",
      "Grid",
      "Card",
      "Image",
      "Alert"
    ],
    "name": "Wishlist",
    "description": "Wishlist block for ecommerce",
    "tags": [
      "ecommerce",
      "wishlist"
    ],
    "screenshot": "thumbs/ecommerce/wishlist-01.webp"
  },
  {
    "id": "404-illustration-01",
    "category": "error-pages",
    "subcategory": "404-illustration",
    "file": "error-pages/404-illustration-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "Image"
    ],
    "name": "404 Illustration",
    "description": "Not-found page with illustration, apologetic headline, and back-home button.",
    "tags": [
      "error-pages",
      "404",
      "illustration",
      "not-found"
    ],
    "screenshot": "thumbs/error-pages/404-illustration-01.webp"
  },
  {
    "id": "404-illustration-02",
    "category": "error-pages",
    "subcategory": "404-illustration",
    "file": "error-pages/404-illustration-02.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Search",
      "Button",
      "Image"
    ],
    "name": "404 Illustration Search",
    "description": "Not-found page with illustration plus a search field to recover the visitor.",
    "tags": [
      "error-pages",
      "404",
      "illustration",
      "search"
    ],
    "screenshot": "thumbs/error-pages/404-illustration-02.webp"
  },
  {
    "id": "404-illustration-03",
    "category": "error-pages",
    "subcategory": "404-illustration",
    "file": "error-pages/404-illustration-03.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "Image"
    ],
    "name": "Maintenance Illustration",
    "description": "Under-maintenance page with illustration, status headline, and return button.",
    "tags": [
      "error-pages",
      "maintenance",
      "illustration",
      "status"
    ],
    "screenshot": "thumbs/error-pages/404-illustration-03.webp"
  },
  {
    "id": "404-illustration-04",
    "category": "error-pages",
    "subcategory": "404-illustration",
    "file": "error-pages/404-illustration-04.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Search",
      "Button",
      "Image"
    ],
    "name": "Maintenance Illustration Search",
    "description": "Under-maintenance page with illustration and a search field for finding content meanwhile.",
    "tags": [
      "error-pages",
      "maintenance",
      "illustration",
      "search"
    ],
    "screenshot": "thumbs/error-pages/404-illustration-04.webp"
  },
  {
    "id": "404-page-01",
    "category": "error-pages",
    "subcategory": "404-page",
    "file": "error-pages/404-page-01.json",
    "element_count": 16,
    "components_used": [
      "Stack",
      "Image",
      "Text",
      "Search",
      "Button",
      "ButtonGroup",
      "Link"
    ],
    "name": "404 Page",
    "description": "404 Page block for error-pages",
    "tags": [
      "error-pages",
      "404",
      "page"
    ],
    "screenshot": "thumbs/error-pages/404-page-01.webp"
  },
  {
    "id": "404-simple-01",
    "category": "error-pages",
    "subcategory": "404-simple",
    "file": "error-pages/404-simple-01.json",
    "element_count": 8,
    "components_used": [
      "Stack",
      "Text",
      "Button"
    ],
    "name": "404 Simple",
    "description": "Minimal not-found page with large headline, short explanation, and back-home button.",
    "tags": [
      "error-pages",
      "404",
      "simple",
      "not-found"
    ],
    "screenshot": "thumbs/error-pages/404-simple-01.webp"
  },
  {
    "id": "404-simple-02",
    "category": "error-pages",
    "subcategory": "404-simple",
    "file": "error-pages/404-simple-02.json",
    "element_count": 18,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "Link"
    ],
    "name": "404 Simple Links",
    "description": "Minimal not-found page with back-home button and a support link.",
    "tags": [
      "error-pages",
      "404",
      "simple",
      "links"
    ],
    "screenshot": "thumbs/error-pages/404-simple-02.webp"
  },
  {
    "id": "404-simple-03",
    "category": "error-pages",
    "subcategory": "404-simple",
    "file": "error-pages/404-simple-03.json",
    "element_count": 8,
    "components_used": [
      "Stack",
      "Icon",
      "Text",
      "Button"
    ],
    "name": "404 Simple Icon",
    "description": "Minimal not-found page led by an icon above the headline and button.",
    "tags": [
      "error-pages",
      "404",
      "simple",
      "icon"
    ],
    "screenshot": "thumbs/error-pages/404-simple-03.webp"
  },
  {
    "id": "404-simple-04",
    "category": "error-pages",
    "subcategory": "404-simple",
    "file": "error-pages/404-simple-04.json",
    "element_count": 28,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "Card",
      "Icon",
      "Link"
    ],
    "name": "404 Simple Suggestions",
    "description": "Not-found page with suggestion cards linking to popular destinations.",
    "tags": [
      "error-pages",
      "404",
      "simple",
      "suggestions"
    ],
    "screenshot": "thumbs/error-pages/404-simple-04.webp"
  },
  {
    "id": "404-split-image-01",
    "category": "error-pages",
    "subcategory": "404-split-image",
    "file": "error-pages/404-split-image-01.json",
    "element_count": 9,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Button",
      "Image"
    ],
    "name": "404 Split Image",
    "description": "Split not-found page with copy and button beside a photo panel.",
    "tags": [
      "error-pages",
      "404",
      "split",
      "image"
    ],
    "screenshot": "thumbs/error-pages/404-split-image-01.webp"
  },
  {
    "id": "404-split-image-02",
    "category": "error-pages",
    "subcategory": "404-split-image",
    "file": "error-pages/404-split-image-02.json",
    "element_count": 9,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Search",
      "Button",
      "Image"
    ],
    "name": "404 Split Image Search",
    "description": "Split not-found page pairing a search field with a photo panel.",
    "tags": [
      "error-pages",
      "404",
      "split",
      "image",
      "search"
    ],
    "screenshot": "thumbs/error-pages/404-split-image-02.webp"
  },
  {
    "id": "404-split-image-03",
    "category": "error-pages",
    "subcategory": "404-split-image",
    "file": "error-pages/404-split-image-03.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "Image"
    ],
    "name": "404 Split Image Stacked",
    "description": "Not-found page with copy over a full-width photo.",
    "tags": [
      "error-pages",
      "404",
      "split",
      "image",
      "stacked"
    ],
    "screenshot": "thumbs/error-pages/404-split-image-03.webp"
  },
  {
    "id": "404-split-image-04",
    "category": "error-pages",
    "subcategory": "404-split-image",
    "file": "error-pages/404-split-image-04.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Text",
      "Search",
      "Button",
      "Link",
      "Image"
    ],
    "name": "404 Split Image Links",
    "description": "Split not-found page with search, quick links, and a photo panel.",
    "tags": [
      "error-pages",
      "404",
      "split",
      "image",
      "links"
    ],
    "screenshot": "thumbs/error-pages/404-split-image-04.webp"
  },
  {
    "id": "500-page-01",
    "category": "error-pages",
    "subcategory": "500-page",
    "file": "error-pages/500-page-01.json",
    "element_count": 15,
    "components_used": [
      "Stack",
      "Image",
      "Text",
      "Surface",
      "ButtonGroup",
      "Button",
      "Alert"
    ],
    "name": "500 Page",
    "description": "500 Page block for error-pages",
    "tags": [
      "error-pages",
      "500",
      "page"
    ],
    "screenshot": "thumbs/error-pages/500-page-01.webp"
  },
  {
    "id": "coming-soon-01",
    "category": "error-pages",
    "subcategory": "coming-soon",
    "file": "error-pages/coming-soon-01.json",
    "element_count": 27,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Progress",
      "Chip",
      "Surface",
      "Input",
      "Button",
      "Grid",
      "Card"
    ],
    "name": "Coming Soon",
    "description": "Coming Soon block for error-pages",
    "tags": [
      "error-pages",
      "coming",
      "soon"
    ],
    "screenshot": "thumbs/error-pages/coming-soon-01.webp"
  },
  {
    "id": "maintenance-page-01",
    "category": "error-pages",
    "subcategory": "maintenance-page",
    "file": "error-pages/maintenance-page-01.json",
    "element_count": 26,
    "components_used": [
      "Stack",
      "Image",
      "Text",
      "Separator",
      "Progress",
      "Input",
      "Button"
    ],
    "name": "Maintenance Page",
    "description": "Maintenance Page block for error-pages",
    "tags": [
      "error-pages",
      "maintenance",
      "page"
    ],
    "screenshot": "thumbs/error-pages/maintenance-page-01.webp"
  },
  {
    "id": "event-countdown-01",
    "category": "event-schedule",
    "subcategory": "event-countdown",
    "file": "event-schedule/event-countdown-01.json",
    "element_count": 28,
    "components_used": [
      "Surface",
      "Stack",
      "Badge",
      "Text",
      "Chip",
      "ButtonGroup",
      "Button"
    ],
    "name": "Event Countdown",
    "description": "Event Countdown block for event-schedule",
    "tags": [
      "event-schedule",
      "event",
      "countdown"
    ],
    "screenshot": "thumbs/event-schedule/event-countdown-01.webp"
  },
  {
    "id": "schedule-tabs-01",
    "category": "event-schedule",
    "subcategory": "schedule-tabs",
    "file": "event-schedule/schedule-tabs-01.json",
    "element_count": 7,
    "components_used": [
      "Stack",
      "Text",
      "Tabs",
      "List"
    ],
    "name": "Schedule Tabs",
    "description": "Schedule Tabs block for event-schedule",
    "tags": [
      "event-schedule",
      "schedule",
      "tabs"
    ],
    "screenshot": "thumbs/event-schedule/schedule-tabs-01.webp"
  },
  {
    "id": "speaker-grid-01",
    "category": "event-schedule",
    "subcategory": "speaker-grid",
    "file": "event-schedule/speaker-grid-01.json",
    "element_count": 41,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "Image",
      "Chip"
    ],
    "name": "Speaker Grid",
    "description": "Speaker Grid block for event-schedule",
    "tags": [
      "event-schedule",
      "speaker",
      "grid"
    ],
    "screenshot": "thumbs/event-schedule/speaker-grid-01.webp"
  },
  {
    "id": "faq-accordion-01",
    "category": "faq",
    "subcategory": "faq-accordion",
    "file": "faq/faq-accordion-01.json",
    "element_count": 4,
    "components_used": [
      "Stack",
      "Text",
      "Accordion"
    ],
    "name": "Faq Accordion",
    "description": "Faq Accordion block for faq",
    "tags": [
      "faq",
      "faq",
      "accordion"
    ],
    "screenshot": "thumbs/faq/faq-accordion-01.webp"
  },
  {
    "id": "faq-grid-01",
    "category": "faq",
    "subcategory": "faq-grid",
    "file": "faq/faq-grid-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card"
    ],
    "name": "Faq Grid",
    "description": "Faq Grid block for faq",
    "tags": [
      "faq",
      "faq",
      "grid"
    ],
    "screenshot": "thumbs/faq/faq-grid-01.webp"
  },
  {
    "id": "faq-simple-01",
    "category": "faq",
    "subcategory": "faq-simple",
    "file": "faq/faq-simple-01.json",
    "element_count": 22,
    "components_used": [
      "Stack",
      "Text",
      "Separator"
    ],
    "name": "Faq Simple",
    "description": "Faq Simple block for faq",
    "tags": [
      "faq",
      "faq",
      "simple"
    ],
    "screenshot": "thumbs/faq/faq-simple-01.webp"
  },
  {
    "id": "faq-with-sidebar-01",
    "category": "faq",
    "subcategory": "faq-with-sidebar",
    "file": "faq/faq-with-sidebar-01.json",
    "element_count": 13,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "NavMenu",
      "Accordion",
      "Surface",
      "Button"
    ],
    "name": "Faq With Sidebar",
    "description": "Faq With Sidebar block for faq",
    "tags": [
      "faq",
      "faq",
      "with",
      "sidebar"
    ],
    "screenshot": "thumbs/faq/faq-with-sidebar-01.webp"
  },
  {
    "id": "feature-alternating-01",
    "category": "features",
    "subcategory": "feature-alternating",
    "file": "features/feature-alternating-01.json",
    "element_count": 25,
    "components_used": [
      "Stack",
      "Text",
      "Image",
      "Chip",
      "Button"
    ],
    "name": "Feature Alternating",
    "description": "Feature Alternating block for features",
    "tags": [
      "features",
      "feature",
      "alternating"
    ],
    "screenshot": "thumbs/features/feature-alternating-01.webp"
  },
  {
    "id": "feature-bento-01",
    "category": "features",
    "subcategory": "feature-bento",
    "file": "features/feature-bento-01.json",
    "element_count": 33,
    "components_used": [
      "Stack",
      "Chip",
      "Text",
      "Grid",
      "Surface",
      "Image"
    ],
    "name": "Feature Bento",
    "description": "Feature Bento block for features",
    "tags": [
      "features",
      "feature",
      "bento"
    ],
    "screenshot": "thumbs/features/feature-bento-01.webp"
  },
  {
    "id": "feature-centered-01",
    "category": "features",
    "subcategory": "feature-centered",
    "file": "features/feature-centered-01.json",
    "element_count": 17,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Image",
      "Separator"
    ],
    "name": "Feature Centered",
    "description": "Feature Centered block for features",
    "tags": [
      "features",
      "feature",
      "centered"
    ],
    "screenshot": "thumbs/features/feature-centered-01.webp"
  },
  {
    "id": "feature-comparison-01",
    "category": "features",
    "subcategory": "feature-comparison",
    "file": "features/feature-comparison-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Surface",
      "Separator",
      "List",
      "Badge"
    ],
    "name": "Feature Comparison",
    "description": "Feature Comparison block for features",
    "tags": [
      "features",
      "feature",
      "comparison"
    ],
    "screenshot": "thumbs/features/feature-comparison-01.webp"
  },
  {
    "id": "feature-grid-01",
    "category": "features",
    "subcategory": "feature-grid",
    "file": "features/feature-grid-01.json",
    "element_count": 18,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Grid",
      "Card"
    ],
    "name": "Feature Grid",
    "description": "Feature Grid block for features",
    "tags": [
      "features",
      "feature",
      "grid"
    ],
    "screenshot": "thumbs/features/feature-grid-01.webp"
  },
  {
    "id": "feature-icon-grid-01",
    "category": "features",
    "subcategory": "feature-icon-grid",
    "file": "features/feature-icon-grid-01.json",
    "element_count": 41,
    "components_used": [
      "Stack",
      "Text",
      "Grid"
    ],
    "name": "Feature Icon Grid",
    "description": "Feature Icon Grid block for features",
    "tags": [
      "features",
      "feature",
      "icon",
      "grid"
    ],
    "screenshot": "thumbs/features/feature-icon-grid-01.webp"
  },
  {
    "id": "feature-list-01",
    "category": "features",
    "subcategory": "feature-list",
    "file": "features/feature-list-01.json",
    "element_count": 34,
    "components_used": [
      "Stack",
      "Text",
      "Separator"
    ],
    "name": "Feature List",
    "description": "Feature List block for features",
    "tags": [
      "features",
      "feature",
      "list"
    ],
    "screenshot": "thumbs/features/feature-list-01.webp"
  },
  {
    "id": "feature-tabs-01",
    "category": "features",
    "subcategory": "feature-tabs",
    "file": "features/feature-tabs-01.json",
    "element_count": 29,
    "components_used": [
      "Stack",
      "Text",
      "Tabs",
      "List",
      "Image"
    ],
    "name": "Feature Tabs",
    "description": "Feature Tabs block for features",
    "tags": [
      "features",
      "feature",
      "tabs"
    ],
    "screenshot": "thumbs/features/feature-tabs-01.webp"
  },
  {
    "id": "feature-with-code-01",
    "category": "features",
    "subcategory": "feature-with-code",
    "file": "features/feature-with-code-01.json",
    "element_count": 23,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Separator",
      "Surface",
      "CustomHTML",
      "Button"
    ],
    "name": "Feature With Code",
    "description": "Feature With Code block for features",
    "tags": [
      "features",
      "feature",
      "with",
      "code"
    ],
    "screenshot": "thumbs/features/feature-with-code-01.webp"
  },
  {
    "id": "footer-columns-01",
    "category": "footer",
    "subcategory": "footer-columns",
    "file": "footer/footer-columns-01.json",
    "element_count": 23,
    "components_used": [
      "Stack",
      "Separator",
      "Grid",
      "Text",
      "NavMenu",
      "ButtonGroup",
      "Button"
    ],
    "name": "Footer Columns",
    "description": "Footer Columns block for footer",
    "tags": [
      "footer",
      "footer",
      "columns"
    ],
    "screenshot": "thumbs/footer/footer-columns-01.webp"
  },
  {
    "id": "footer-mega-01",
    "category": "footer",
    "subcategory": "footer-mega",
    "file": "footer/footer-mega-01.json",
    "element_count": 33,
    "components_used": [
      "Stack",
      "Separator",
      "Grid",
      "Text",
      "NavMenu",
      "Surface",
      "Input",
      "Button",
      "ButtonGroup"
    ],
    "name": "Footer Mega",
    "description": "Footer Mega block for footer",
    "tags": [
      "footer",
      "footer",
      "mega"
    ],
    "screenshot": "thumbs/footer/footer-mega-01.webp"
  },
  {
    "id": "footer-minimal-01",
    "category": "footer",
    "subcategory": "footer-minimal",
    "file": "footer/footer-minimal-01.json",
    "element_count": 5,
    "components_used": [
      "Stack",
      "Separator",
      "Text",
      "NavMenu"
    ],
    "name": "Footer Minimal",
    "description": "Footer Minimal block for footer",
    "tags": [
      "footer",
      "footer",
      "minimal"
    ],
    "screenshot": "thumbs/footer/footer-minimal-01.webp"
  },
  {
    "id": "footer-simple-01",
    "category": "footer",
    "subcategory": "footer-simple",
    "file": "footer/footer-simple-01.json",
    "element_count": 9,
    "components_used": [
      "Stack",
      "Separator",
      "Text",
      "NavMenu",
      "ButtonGroup",
      "Button"
    ],
    "name": "Footer Simple",
    "description": "Footer Simple block for footer",
    "tags": [
      "footer",
      "footer",
      "simple"
    ],
    "screenshot": "thumbs/footer/footer-simple-01.webp"
  },
  {
    "id": "footer-with-cta-01",
    "category": "footer",
    "subcategory": "footer-with-cta",
    "file": "footer/footer-with-cta-01.json",
    "element_count": 30,
    "components_used": [
      "Stack",
      "Surface",
      "Text",
      "ButtonGroup",
      "Button",
      "Separator",
      "Grid",
      "NavMenu"
    ],
    "name": "Footer With CTA",
    "description": "Footer With Cta block for footer",
    "tags": [
      "footer",
      "footer",
      "with",
      "cta"
    ],
    "screenshot": "thumbs/footer/footer-with-cta-01.webp"
  },
  {
    "id": "checkout-01",
    "category": "forms",
    "subcategory": "checkout",
    "file": "forms/checkout-01.json",
    "element_count": 35,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Field",
      "Select",
      "Card",
      "Separator",
      "Button"
    ],
    "name": "Checkout",
    "description": "Checkout block for forms",
    "tags": [
      "forms",
      "checkout"
    ],
    "screenshot": "thumbs/forms/checkout-01.webp"
  },
  {
    "id": "contact-01",
    "category": "forms",
    "subcategory": "contact",
    "file": "forms/contact-01.json",
    "element_count": 13,
    "components_used": [
      "Stack",
      "Text",
      "Field",
      "Select",
      "Label",
      "Textarea",
      "Button"
    ],
    "name": "Contact",
    "description": "Contact block for forms",
    "tags": [
      "forms",
      "contact"
    ],
    "screenshot": "thumbs/forms/contact-01.webp"
  },
  {
    "id": "file-upload-01",
    "category": "forms",
    "subcategory": "file-upload",
    "file": "forms/file-upload-01.json",
    "element_count": 29,
    "components_used": [
      "Stack",
      "Text",
      "Surface",
      "Button",
      "Badge",
      "Progress"
    ],
    "name": "File Upload",
    "description": "File Upload block for forms",
    "tags": [
      "forms",
      "file",
      "upload"
    ],
    "screenshot": "thumbs/forms/file-upload-01.webp"
  },
  {
    "id": "form-inline-01",
    "category": "forms",
    "subcategory": "form-inline",
    "file": "forms/form-inline-01.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Field",
      "Search",
      "Select",
      "Button"
    ],
    "name": "Form Inline",
    "description": "Form Inline block for forms",
    "tags": [
      "forms",
      "form",
      "inline"
    ],
    "screenshot": "thumbs/forms/form-inline-01.webp"
  },
  {
    "id": "form-multi-step-01",
    "category": "forms",
    "subcategory": "form-multi-step",
    "file": "forms/form-multi-step-01.json",
    "element_count": 18,
    "components_used": [
      "Stack",
      "Stepper",
      "Surface",
      "Text",
      "Field",
      "Input",
      "Checkbox",
      "Button"
    ],
    "name": "Form Multi Step",
    "description": "Form Multi Step block for forms",
    "tags": [
      "forms",
      "form",
      "multi",
      "step"
    ],
    "screenshot": "thumbs/forms/form-multi-step-01.webp"
  },
  {
    "id": "form-stacked-01",
    "category": "forms",
    "subcategory": "form-stacked",
    "file": "forms/form-stacked-01.json",
    "element_count": 33,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Field",
      "Input",
      "Separator",
      "Select",
      "Textarea",
      "Button"
    ],
    "name": "Form Stacked",
    "description": "Form Stacked block for forms",
    "tags": [
      "forms",
      "form",
      "stacked"
    ],
    "screenshot": "thumbs/forms/form-stacked-01.webp"
  },
  {
    "id": "form-with-sidebar-01",
    "category": "forms",
    "subcategory": "form-with-sidebar",
    "file": "forms/form-with-sidebar-01.json",
    "element_count": 20,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "Field",
      "Input",
      "Textarea",
      "Select",
      "RadioGroup",
      "DatePicker",
      "Button",
      "Separator",
      "List",
      "Alert"
    ],
    "name": "Form With Sidebar",
    "description": "Form With Sidebar block for forms",
    "tags": [
      "forms",
      "form",
      "with",
      "sidebar"
    ],
    "screenshot": "thumbs/forms/form-with-sidebar-01.webp"
  },
  {
    "id": "login-01",
    "category": "forms",
    "subcategory": "login",
    "file": "forms/login-01.json",
    "element_count": 18,
    "components_used": [
      "Stack",
      "Card",
      "Text",
      "Field",
      "Checkbox",
      "Button",
      "Separator"
    ],
    "name": "Login",
    "description": "Login block for forms",
    "tags": [
      "forms",
      "login"
    ],
    "screenshot": "thumbs/forms/login-01.webp"
  },
  {
    "id": "search-bar-01",
    "category": "forms",
    "subcategory": "search-bar",
    "file": "forms/search-bar-01.json",
    "element_count": 13,
    "components_used": [
      "Stack",
      "Search",
      "Button",
      "Chip",
      "Surface",
      "List"
    ],
    "name": "Search Bar",
    "description": "Search Bar block for forms",
    "tags": [
      "forms",
      "search",
      "bar"
    ],
    "screenshot": "thumbs/forms/search-bar-01.webp"
  },
  {
    "id": "settings-01",
    "category": "forms",
    "subcategory": "settings",
    "file": "forms/settings-01.json",
    "element_count": 23,
    "components_used": [
      "Stack",
      "Text",
      "Field",
      "Label",
      "Textarea",
      "Separator",
      "Switch",
      "Button"
    ],
    "name": "Settings",
    "description": "Settings block for forms",
    "tags": [
      "forms",
      "settings"
    ],
    "screenshot": "thumbs/forms/settings-01.webp"
  },
  {
    "id": "settings-form-01",
    "category": "forms",
    "subcategory": "settings-form",
    "file": "forms/settings-form-01.json",
    "element_count": 24,
    "components_used": [
      "Stack",
      "Text",
      "Switch",
      "Select",
      "Separator",
      "ToggleGroup",
      "Button"
    ],
    "name": "Settings Form",
    "description": "Settings Form block for forms",
    "tags": [
      "forms",
      "settings",
      "form"
    ],
    "screenshot": "thumbs/forms/settings-form-01.webp"
  },
  {
    "id": "signup-01",
    "category": "forms",
    "subcategory": "signup",
    "file": "forms/signup-01.json",
    "element_count": 16,
    "components_used": [
      "Stack",
      "Card",
      "Text",
      "Grid",
      "Field",
      "Checkbox",
      "Button",
      "Link"
    ],
    "name": "Signup",
    "description": "Signup block for forms",
    "tags": [
      "forms",
      "signup"
    ],
    "screenshot": "thumbs/forms/signup-01.webp"
  },
  {
    "id": "hero-centered-01",
    "category": "hero",
    "subcategory": "hero-centered",
    "file": "hero/hero-centered-01.json",
    "element_count": 14,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Button",
      "AvatarGroup",
      "Avatar"
    ],
    "name": "Hero Centered",
    "description": "Hero Centered block for hero",
    "tags": [
      "hero",
      "hero",
      "centered"
    ],
    "screenshot": "thumbs/hero/hero-centered-01.webp"
  },
  {
    "id": "hero-fullscreen-01",
    "category": "hero",
    "subcategory": "hero-fullscreen",
    "file": "hero/hero-fullscreen-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Avatar",
      "Text",
      "Button"
    ],
    "name": "Hero Fullscreen",
    "description": "Hero Fullscreen block for hero",
    "tags": [
      "hero",
      "hero",
      "fullscreen"
    ],
    "screenshot": "thumbs/hero/hero-fullscreen-01.webp"
  },
  {
    "id": "hero-minimal-01",
    "category": "hero",
    "subcategory": "hero-minimal",
    "file": "hero/hero-minimal-01.json",
    "element_count": 7,
    "components_used": [
      "Stack",
      "Text",
      "Separator",
      "Button"
    ],
    "name": "Hero Minimal",
    "description": "Hero Minimal block for hero",
    "tags": [
      "hero",
      "hero",
      "minimal"
    ],
    "screenshot": "thumbs/hero/hero-minimal-01.webp"
  },
  {
    "id": "hero-split-01",
    "category": "hero",
    "subcategory": "hero-split",
    "file": "hero/hero-split-01.json",
    "element_count": 20,
    "components_used": [
      "Grid",
      "Stack",
      "Chip",
      "Text",
      "Badge",
      "Button",
      "Surface",
      "Image"
    ],
    "name": "Hero Split",
    "description": "Hero Split block for hero",
    "tags": [
      "hero",
      "hero",
      "split"
    ],
    "screenshot": "thumbs/hero/hero-split-01.webp"
  },
  {
    "id": "hero-video-background-01",
    "category": "hero",
    "subcategory": "hero-video-background",
    "file": "hero/hero-video-background-01.json",
    "element_count": 9,
    "components_used": [
      "Stack",
      "CustomHTML",
      "Text",
      "Button"
    ],
    "name": "Hero Video Background",
    "description": "Hero Video Background block for hero",
    "tags": [
      "hero",
      "hero",
      "video",
      "background"
    ],
    "screenshot": "thumbs/hero/hero-video-background-01.webp"
  },
  {
    "id": "hero-with-app-screenshot-01",
    "category": "hero",
    "subcategory": "hero-with-app-screenshot",
    "file": "hero/hero-with-app-screenshot-01.json",
    "element_count": 16,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "Surface",
      "Image"
    ],
    "name": "Hero With App Screenshot",
    "description": "Hero With App Screenshot block for hero",
    "tags": [
      "hero",
      "hero",
      "with",
      "app",
      "screenshot"
    ],
    "screenshot": "thumbs/hero/hero-with-app-screenshot-01.webp"
  },
  {
    "id": "hero-with-form-01",
    "category": "hero",
    "subcategory": "hero-with-form",
    "file": "hero/hero-with-form-01.json",
    "element_count": 13,
    "components_used": [
      "Grid",
      "Stack",
      "Text",
      "List",
      "Card",
      "Field",
      "Input",
      "Select",
      "Button"
    ],
    "name": "Hero With Form",
    "description": "Hero With Form block for hero",
    "tags": [
      "hero",
      "hero",
      "with",
      "form"
    ],
    "screenshot": "thumbs/hero/hero-with-form-01.webp"
  },
  {
    "id": "hero-with-stats-01",
    "category": "hero",
    "subcategory": "hero-with-stats",
    "file": "hero/hero-with-stats-01.json",
    "element_count": 13,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Button",
      "Grid",
      "StatCard"
    ],
    "name": "Hero With Stats",
    "description": "Hero With Stats block for hero",
    "tags": [
      "hero",
      "hero",
      "with",
      "stats"
    ],
    "screenshot": "thumbs/hero/hero-with-stats-01.webp"
  },
  {
    "id": "process-alternating-01",
    "category": "how-it-works",
    "subcategory": "process-alternating",
    "file": "how-it-works/process-alternating-01.json",
    "element_count": 23,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Chip",
      "Image",
      "Button"
    ],
    "name": "Process Alternating",
    "description": "Process Alternating block for how-it-works",
    "tags": [
      "how-it-works",
      "process",
      "alternating"
    ],
    "screenshot": "thumbs/how-it-works/process-alternating-01.webp"
  },
  {
    "id": "steps-horizontal-01",
    "category": "how-it-works",
    "subcategory": "steps-horizontal",
    "file": "how-it-works/steps-horizontal-01.json",
    "element_count": 21,
    "components_used": [
      "Stack",
      "Text",
      "Stepper",
      "Grid",
      "Surface",
      "Avatar"
    ],
    "name": "Steps Horizontal",
    "description": "Steps Horizontal block for how-it-works",
    "tags": [
      "how-it-works",
      "steps",
      "horizontal"
    ],
    "screenshot": "thumbs/how-it-works/steps-horizontal-01.webp"
  },
  {
    "id": "steps-vertical-01",
    "category": "how-it-works",
    "subcategory": "steps-vertical",
    "file": "how-it-works/steps-vertical-01.json",
    "element_count": 29,
    "components_used": [
      "Stack",
      "Text",
      "Avatar",
      "Chip",
      "Button"
    ],
    "name": "Steps Vertical",
    "description": "Steps Vertical block for how-it-works",
    "tags": [
      "how-it-works",
      "steps",
      "vertical"
    ],
    "screenshot": "thumbs/how-it-works/steps-vertical-01.webp"
  },
  {
    "id": "api-reference-01",
    "category": "integrations",
    "subcategory": "api-reference",
    "file": "integrations/api-reference-01.json",
    "element_count": 37,
    "components_used": [
      "Stack",
      "Text",
      "Surface",
      "Badge",
      "Chip",
      "Separator",
      "Button"
    ],
    "name": "Api Reference",
    "description": "Api Reference block for integrations",
    "tags": [
      "integrations",
      "api",
      "reference"
    ],
    "screenshot": "thumbs/integrations/api-reference-01.webp"
  },
  {
    "id": "integration-grid-01",
    "category": "integrations",
    "subcategory": "integration-grid",
    "file": "integrations/integration-grid-01.json",
    "element_count": 55,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Surface",
      "Avatar",
      "Button"
    ],
    "name": "Integration Grid",
    "description": "Integration Grid block for integrations",
    "tags": [
      "integrations",
      "integration",
      "grid"
    ],
    "screenshot": "thumbs/integrations/integration-grid-01.webp"
  },
  {
    "id": "integration-showcase-01",
    "category": "integrations",
    "subcategory": "integration-showcase",
    "file": "integrations/integration-showcase-01.json",
    "element_count": 24,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Grid",
      "Surface",
      "Image",
      "List",
      "Separator",
      "ButtonGroup",
      "Button"
    ],
    "name": "Integration Showcase",
    "description": "Integration Showcase block for integrations",
    "tags": [
      "integrations",
      "integration",
      "showcase"
    ],
    "screenshot": "thumbs/integrations/integration-showcase-01.webp"
  },
  {
    "id": "features-grid-01",
    "name": "Features Grid",
    "category": "landing",
    "description": "6-item feature grid with icons, titles, and descriptions in 3 columns",
    "tags": [
      "landing",
      "features",
      "grid",
      "marketing"
    ],
    "file": "landing/features-grid-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card"
    ],
    "screenshot": "thumbs/landing/features-grid-01.webp"
  },
  {
    "id": "footer-01",
    "name": "Footer",
    "category": "landing",
    "description": "4-column link footer (Product/Company/Resources/Legal) with copyright",
    "tags": [
      "landing",
      "footer",
      "navigation"
    ],
    "file": "landing/footer-01.json",
    "element_count": 22,
    "components_used": [
      "Stack",
      "Grid",
      "Text",
      "NavMenu",
      "Separator",
      "Button"
    ],
    "screenshot": "thumbs/landing/footer-01.webp"
  },
  {
    "id": "hero-01",
    "name": "Hero Section",
    "category": "landing",
    "description": "Centered hero with heading, subheading, CTA button, and decorative image",
    "tags": [
      "landing",
      "hero",
      "cta",
      "marketing"
    ],
    "file": "landing/hero-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Button",
      "Image",
      "Grid",
      "StatCard"
    ],
    "screenshot": "thumbs/landing/hero-01.webp"
  },
  {
    "id": "pricing-01",
    "name": "Pricing Table",
    "category": "landing",
    "description": "3-tier pricing cards (Free/Pro/Enterprise) with features and CTA buttons",
    "tags": [
      "landing",
      "pricing",
      "cards",
      "marketing"
    ],
    "file": "landing/pricing-01.json",
    "element_count": 34,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Surface",
      "Separator",
      "Button",
      "Badge"
    ],
    "screenshot": "thumbs/landing/pricing-01.webp"
  },
  {
    "id": "testimonials-01",
    "name": "Testimonials",
    "category": "landing",
    "description": "3 testimonial cards with quotes, avatars, names, and roles",
    "tags": [
      "landing",
      "testimonials",
      "social-proof"
    ],
    "file": "landing/testimonials-01.json",
    "element_count": 31,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Surface",
      "Separator",
      "Avatar"
    ],
    "screenshot": "thumbs/landing/testimonials-01.webp"
  },
  {
    "id": "logo-cloud-scrolling-01",
    "category": "logo-bar",
    "subcategory": "logo-cloud-scrolling",
    "file": "logo-bar/logo-cloud-scrolling-01.json",
    "element_count": 16,
    "components_used": [
      "Stack",
      "Text",
      "ScrollArea"
    ],
    "name": "Logo Cloud Scrolling",
    "description": "Logo Cloud Scrolling block for logo-bar",
    "tags": [
      "logo-bar",
      "logo",
      "cloud",
      "scrolling"
    ],
    "screenshot": "thumbs/logo-bar/logo-cloud-scrolling-01.webp"
  },
  {
    "id": "logo-cloud-simple-01",
    "category": "logo-bar",
    "subcategory": "logo-cloud-simple",
    "file": "logo-bar/logo-cloud-simple-01.json",
    "element_count": 23,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Surface"
    ],
    "name": "Logo Cloud Simple",
    "description": "Logo Cloud Simple block for logo-bar",
    "tags": [
      "logo-bar",
      "logo",
      "cloud",
      "simple"
    ],
    "screenshot": "thumbs/logo-bar/logo-cloud-simple-01.webp"
  },
  {
    "id": "logo-cloud-with-heading-01",
    "category": "logo-bar",
    "subcategory": "logo-cloud-with-heading",
    "file": "logo-bar/logo-cloud-with-heading-01.json",
    "element_count": 23,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Separator",
      "Grid",
      "Surface"
    ],
    "name": "Logo Cloud With Heading",
    "description": "Logo Cloud With Heading block for logo-bar",
    "tags": [
      "logo-bar",
      "logo",
      "cloud",
      "with",
      "heading"
    ],
    "screenshot": "thumbs/logo-bar/logo-cloud-with-heading-01.webp"
  },
  {
    "id": "gallery-carousel-01",
    "category": "media",
    "subcategory": "gallery-carousel",
    "file": "media/gallery-carousel-01.json",
    "element_count": 29,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button",
      "Card",
      "Image",
      "Grid"
    ],
    "name": "Gallery Carousel",
    "description": "Gallery Carousel block for media",
    "tags": [
      "media",
      "gallery",
      "carousel"
    ],
    "screenshot": "thumbs/media/gallery-carousel-01.webp"
  },
  {
    "id": "gallery-grid-01",
    "category": "media",
    "subcategory": "gallery-grid",
    "file": "media/gallery-grid-01.json",
    "element_count": 11,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Image"
    ],
    "name": "Gallery Grid",
    "description": "Gallery Grid block for media",
    "tags": [
      "media",
      "gallery",
      "grid"
    ],
    "screenshot": "thumbs/media/gallery-grid-01.webp"
  },
  {
    "id": "media-with-text-01",
    "category": "media",
    "subcategory": "media-with-text",
    "file": "media/media-with-text-01.json",
    "element_count": 23,
    "components_used": [
      "Grid",
      "Surface",
      "AspectRatio",
      "Image",
      "Stack",
      "Badge",
      "Text",
      "Separator",
      "ButtonGroup",
      "Button"
    ],
    "name": "Media With Text",
    "description": "Media With Text block for media",
    "tags": [
      "media",
      "media",
      "with",
      "text"
    ],
    "screenshot": "thumbs/media/media-with-text-01.webp"
  },
  {
    "id": "video-section-01",
    "category": "media",
    "subcategory": "video-section",
    "file": "media/video-section-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Surface",
      "AspectRatio",
      "Image",
      "Button",
      "Chip"
    ],
    "name": "Video Section",
    "description": "Video Section block for media",
    "tags": [
      "media",
      "video",
      "section"
    ],
    "screenshot": "thumbs/media/video-section-01.webp"
  },
  {
    "id": "back-to-top-01",
    "category": "misc",
    "subcategory": "back-to-top",
    "file": "misc/back-to-top-01.json",
    "element_count": 2,
    "components_used": [
      "Stack",
      "Button"
    ],
    "name": "Back To Top",
    "description": "Back To Top block for misc",
    "tags": [
      "misc",
      "back",
      "to",
      "top"
    ],
    "screenshot": "thumbs/misc/back-to-top-01.webp"
  },
  {
    "id": "divider-01",
    "category": "misc",
    "subcategory": "divider",
    "file": "misc/divider-01.json",
    "element_count": 4,
    "components_used": [
      "Stack",
      "Separator",
      "Text"
    ],
    "name": "Divider",
    "description": "Divider block for misc",
    "tags": [
      "misc",
      "divider"
    ],
    "screenshot": "thumbs/misc/divider-01.webp"
  },
  {
    "id": "language-switcher-01",
    "category": "misc",
    "subcategory": "language-switcher",
    "file": "misc/language-switcher-01.json",
    "element_count": 3,
    "components_used": [
      "Stack",
      "Icon",
      "Select"
    ],
    "name": "Language Switcher",
    "description": "Language Switcher block for misc",
    "tags": [
      "misc",
      "language",
      "switcher"
    ],
    "screenshot": "thumbs/misc/language-switcher-01.webp"
  },
  {
    "id": "scroll-indicator-01",
    "category": "misc",
    "subcategory": "scroll-indicator",
    "file": "misc/scroll-indicator-01.json",
    "element_count": 2,
    "components_used": [
      "Stack",
      "Progress"
    ],
    "name": "Scroll Indicator",
    "description": "Scroll Indicator block for misc",
    "tags": [
      "misc",
      "scroll",
      "indicator"
    ],
    "screenshot": "thumbs/misc/scroll-indicator-01.webp"
  },
  {
    "id": "skip-link-01",
    "category": "misc",
    "subcategory": "skip-link",
    "file": "misc/skip-link-01.json",
    "element_count": 2,
    "components_used": [
      "Stack",
      "Button"
    ],
    "name": "Skip Link",
    "description": "Skip Link block for misc",
    "tags": [
      "misc",
      "skip",
      "link"
    ],
    "screenshot": "thumbs/misc/skip-link-01.webp"
  },
  {
    "id": "social-links-01",
    "category": "misc",
    "subcategory": "social-links",
    "file": "misc/social-links-01.json",
    "element_count": 9,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button"
    ],
    "name": "Social Links",
    "description": "Social Links block for misc",
    "tags": [
      "misc",
      "social",
      "links"
    ],
    "screenshot": "thumbs/misc/social-links-01.webp"
  },
  {
    "id": "table-of-contents-01",
    "category": "misc",
    "subcategory": "table-of-contents",
    "file": "misc/table-of-contents-01.json",
    "element_count": 3,
    "components_used": [
      "Stack",
      "Text",
      "NavMenu"
    ],
    "name": "Table Of Contents",
    "description": "Table Of Contents block for misc",
    "tags": [
      "misc",
      "table",
      "of",
      "contents"
    ],
    "screenshot": "thumbs/misc/table-of-contents-01.webp"
  },
  {
    "id": "theme-toggle-01",
    "category": "misc",
    "subcategory": "theme-toggle",
    "file": "misc/theme-toggle-01.json",
    "element_count": 8,
    "components_used": [
      "Stack",
      "Card",
      "Icon",
      "Text",
      "Toggle"
    ],
    "name": "Theme Toggle",
    "description": "Theme Toggle block for misc",
    "tags": [
      "misc",
      "theme",
      "toggle"
    ],
    "screenshot": "thumbs/misc/theme-toggle-01.webp"
  },
  {
    "id": "app-shell-01",
    "name": "Mobile App Shell",
    "category": "mobile",
    "description": "Mobile layout with top navbar, content area, and bottom navigation (5 tabs)",
    "tags": [
      "mobile",
      "app",
      "navigation",
      "bottom-nav",
      "shell"
    ],
    "file": "mobile/app-shell-01.json",
    "element_count": 28,
    "components_used": [
      "Stack",
      "Navbar",
      "Avatar",
      "Text",
      "Grid",
      "Button",
      "StatCard",
      "Separator",
      "Chip",
      "List",
      "BottomNav"
    ],
    "screenshot": "thumbs/mobile/app-shell-01.webp"
  },
  {
    "id": "command-palette-01",
    "category": "modals-overlays",
    "subcategory": "command-palette",
    "file": "modals-overlays/command-palette-01.json",
    "element_count": 6,
    "components_used": [
      "Stack",
      "Card",
      "Input",
      "Separator",
      "List"
    ],
    "name": "Command Palette",
    "description": "Command Palette block for modals-overlays",
    "tags": [
      "modals-overlays",
      "command",
      "palette"
    ],
    "screenshot": "thumbs/modals-overlays/command-palette-01.webp"
  },
  {
    "id": "cookie-consent-01",
    "category": "modals-overlays",
    "subcategory": "cookie-consent",
    "file": "modals-overlays/cookie-consent-01.json",
    "element_count": 9,
    "components_used": [
      "Surface",
      "Stack",
      "Text",
      "Button"
    ],
    "name": "Cookie Consent",
    "description": "Cookie Consent block for modals-overlays",
    "tags": [
      "modals-overlays",
      "cookie",
      "consent"
    ],
    "screenshot": "thumbs/modals-overlays/cookie-consent-01.webp"
  },
  {
    "id": "drawer-01",
    "category": "modals-overlays",
    "subcategory": "drawer",
    "file": "modals-overlays/drawer-01.json",
    "element_count": 17,
    "components_used": [
      "Drawer",
      "Stack",
      "Text",
      "Field",
      "Input",
      "Select",
      "Checkbox",
      "Button"
    ],
    "name": "Drawer",
    "description": "Drawer block for modals-overlays",
    "tags": [
      "modals-overlays",
      "drawer"
    ],
    "screenshot": "thumbs/modals-overlays/drawer-01.webp"
  },
  {
    "id": "lightbox-01",
    "category": "modals-overlays",
    "subcategory": "lightbox",
    "file": "modals-overlays/lightbox-01.json",
    "element_count": 15,
    "components_used": [
      "Card",
      "Stack",
      "AspectRatio",
      "Image",
      "Button",
      "Text"
    ],
    "name": "Lightbox",
    "description": "Lightbox block for modals-overlays",
    "tags": [
      "modals-overlays",
      "lightbox"
    ],
    "screenshot": "thumbs/modals-overlays/lightbox-01.webp"
  },
  {
    "id": "modal-confirm-01",
    "category": "modals-overlays",
    "subcategory": "modal-confirm",
    "file": "modals-overlays/modal-confirm-01.json",
    "element_count": 6,
    "components_used": [
      "Card",
      "Surface",
      "List",
      "Stack",
      "Button"
    ],
    "name": "Modal Confirm",
    "description": "Modal Confirm block for modals-overlays",
    "tags": [
      "modals-overlays",
      "modal",
      "confirm"
    ],
    "screenshot": "thumbs/modals-overlays/modal-confirm-01.webp"
  },
  {
    "id": "modal-dialog-01",
    "category": "modals-overlays",
    "subcategory": "modal-dialog",
    "file": "modals-overlays/modal-dialog-01.json",
    "element_count": 19,
    "components_used": [
      "Card",
      "Stack",
      "Avatar",
      "Button",
      "Field",
      "Input",
      "Textarea",
      "Grid",
      "DatePicker"
    ],
    "name": "Modal Dialog",
    "description": "Modal Dialog block for modals-overlays",
    "tags": [
      "modals-overlays",
      "modal",
      "dialog"
    ],
    "screenshot": "thumbs/modals-overlays/modal-dialog-01.webp"
  },
  {
    "id": "toast-notification-01",
    "category": "modals-overlays",
    "subcategory": "toast-notification",
    "file": "modals-overlays/toast-notification-01.json",
    "element_count": 5,
    "components_used": [
      "Stack",
      "Alert"
    ],
    "name": "Toast Notification",
    "description": "Toast Notification block for modals-overlays",
    "tags": [
      "modals-overlays",
      "toast",
      "notification"
    ],
    "screenshot": "thumbs/modals-overlays/toast-notification-01.webp"
  },
  {
    "id": "bottom-nav-01",
    "category": "navigation",
    "subcategory": "bottom-nav",
    "file": "navigation/bottom-nav-01.json",
    "element_count": 1,
    "components_used": [
      "BottomNav"
    ],
    "name": "Bottom Nav",
    "description": "Bottom Nav block for navigation",
    "tags": [
      "navigation",
      "bottom",
      "nav"
    ],
    "screenshot": "thumbs/navigation/bottom-nav-01.webp"
  },
  {
    "id": "breadcrumbs-01",
    "category": "navigation",
    "subcategory": "breadcrumbs",
    "file": "navigation/breadcrumbs-01.json",
    "element_count": 3,
    "components_used": [
      "Stack",
      "Breadcrumbs",
      "Text"
    ],
    "name": "Breadcrumbs",
    "description": "Breadcrumbs block for navigation",
    "tags": [
      "navigation",
      "breadcrumbs"
    ],
    "screenshot": "thumbs/navigation/breadcrumbs-01.webp"
  },
  {
    "id": "navbar-mega-menu-01",
    "category": "navigation",
    "subcategory": "navbar-mega-menu",
    "file": "navigation/navbar-mega-menu-01.json",
    "element_count": 30,
    "components_used": [
      "Stack",
      "Surface",
      "Text",
      "Link",
      "Button",
      "Grid"
    ],
    "name": "Navbar Mega Menu",
    "description": "Navbar Mega Menu block for navigation",
    "tags": [
      "navigation",
      "navbar",
      "mega",
      "menu"
    ],
    "screenshot": "thumbs/navigation/navbar-mega-menu-01.webp"
  },
  {
    "id": "navbar-mobile-drawer-01",
    "category": "navigation",
    "subcategory": "navbar-mobile-drawer",
    "file": "navigation/navbar-mobile-drawer-01.json",
    "element_count": 14,
    "components_used": [
      "Stack",
      "Surface",
      "Button",
      "Sheet",
      "Text",
      "Separator",
      "NavMenu"
    ],
    "name": "Navbar Mobile Drawer",
    "description": "Navbar Mobile Drawer block for navigation",
    "tags": [
      "navigation",
      "navbar",
      "mobile",
      "drawer"
    ],
    "screenshot": "thumbs/navigation/navbar-mobile-drawer-01.webp"
  },
  {
    "id": "navbar-simple-01",
    "category": "navigation",
    "subcategory": "navbar-simple",
    "file": "navigation/navbar-simple-01.json",
    "element_count": 12,
    "components_used": [
      "Stack",
      "Surface",
      "Text",
      "Link",
      "Button"
    ],
    "name": "Navbar Simple",
    "description": "Navbar Simple block for navigation",
    "tags": [
      "navigation",
      "navbar",
      "simple"
    ],
    "screenshot": "thumbs/navigation/navbar-simple-01.webp"
  },
  {
    "id": "navbar-with-auth-01",
    "category": "navigation",
    "subcategory": "navbar-with-auth",
    "file": "navigation/navbar-with-auth-01.json",
    "element_count": 13,
    "components_used": [
      "Stack",
      "Surface",
      "Text",
      "Link",
      "Button"
    ],
    "name": "Navbar With Auth",
    "description": "Navbar With Auth block for navigation",
    "tags": [
      "navigation",
      "navbar",
      "with",
      "auth"
    ],
    "screenshot": "thumbs/navigation/navbar-with-auth-01.webp"
  },
  {
    "id": "navbar-with-search-01",
    "category": "navigation",
    "subcategory": "navbar-with-search",
    "file": "navigation/navbar-with-search-01.json",
    "element_count": 13,
    "components_used": [
      "Stack",
      "Surface",
      "Text",
      "Link",
      "Search",
      "Button",
      "Avatar"
    ],
    "name": "Navbar With Search",
    "description": "Navbar With Search block for navigation",
    "tags": [
      "navigation",
      "navbar",
      "with",
      "search"
    ],
    "screenshot": "thumbs/navigation/navbar-with-search-01.webp"
  },
  {
    "id": "pagination-01",
    "category": "navigation",
    "subcategory": "pagination",
    "file": "navigation/pagination-01.json",
    "element_count": 5,
    "components_used": [
      "Stack",
      "Text",
      "Select",
      "Pagination"
    ],
    "name": "Pagination",
    "description": "Pagination block for navigation",
    "tags": [
      "navigation",
      "pagination"
    ],
    "screenshot": "thumbs/navigation/pagination-01.webp"
  },
  {
    "id": "sidebar-nav-01",
    "category": "navigation",
    "subcategory": "sidebar-nav",
    "file": "navigation/sidebar-nav-01.json",
    "element_count": 1,
    "components_used": [
      "Sidebar"
    ],
    "name": "Sidebar Nav",
    "description": "Sidebar Nav block for navigation",
    "tags": [
      "navigation",
      "sidebar",
      "nav"
    ],
    "screenshot": "thumbs/navigation/sidebar-nav-01.webp"
  },
  {
    "id": "tab-nav-01",
    "category": "navigation",
    "subcategory": "tab-nav",
    "file": "navigation/tab-nav-01.json",
    "element_count": 20,
    "components_used": [
      "Stack",
      "Text",
      "Button",
      "Tabs",
      "Field",
      "Input",
      "Select",
      "Switch"
    ],
    "name": "Tab Nav",
    "description": "Tab Nav block for navigation",
    "tags": [
      "navigation",
      "tab",
      "nav"
    ],
    "screenshot": "thumbs/navigation/tab-nav-01.webp"
  },
  {
    "id": "topbar-announcement-01",
    "category": "navigation",
    "subcategory": "topbar-announcement",
    "file": "navigation/topbar-announcement-01.json",
    "element_count": 5,
    "components_used": [
      "Surface",
      "Stack",
      "Badge",
      "Text",
      "Link"
    ],
    "name": "Topbar Announcement",
    "description": "Topbar Announcement block for navigation",
    "tags": [
      "navigation",
      "topbar",
      "announcement"
    ],
    "screenshot": "thumbs/navigation/topbar-announcement-01.webp"
  },
  {
    "id": "newsletter-card-01",
    "category": "newsletter",
    "subcategory": "newsletter-card",
    "file": "newsletter/newsletter-card-01.json",
    "element_count": 12,
    "components_used": [
      "Card",
      "Stack",
      "Badge",
      "Field",
      "Input",
      "Button",
      "Text"
    ],
    "name": "Newsletter Card",
    "description": "Newsletter Card block for newsletter",
    "tags": [
      "newsletter",
      "newsletter",
      "card"
    ],
    "screenshot": "thumbs/newsletter/newsletter-card-01.webp"
  },
  {
    "id": "newsletter-footer-01",
    "category": "newsletter",
    "subcategory": "newsletter-footer",
    "file": "newsletter/newsletter-footer-01.json",
    "element_count": 15,
    "components_used": [
      "Surface",
      "Stack",
      "Text",
      "Button",
      "InputGroup",
      "Input"
    ],
    "name": "Newsletter Footer",
    "description": "Newsletter Footer block for newsletter",
    "tags": [
      "newsletter",
      "newsletter",
      "footer"
    ],
    "screenshot": "thumbs/newsletter/newsletter-footer-01.webp"
  },
  {
    "id": "newsletter-inline-01",
    "category": "newsletter",
    "subcategory": "newsletter-inline",
    "file": "newsletter/newsletter-inline-01.json",
    "element_count": 7,
    "components_used": [
      "Stack",
      "Text",
      "InputGroup",
      "Input",
      "Button"
    ],
    "name": "Newsletter Inline",
    "description": "Newsletter Inline block for newsletter",
    "tags": [
      "newsletter",
      "newsletter",
      "inline"
    ],
    "screenshot": "thumbs/newsletter/newsletter-inline-01.webp"
  },
  {
    "id": "newsletter-popup-01",
    "category": "newsletter",
    "subcategory": "newsletter-popup",
    "file": "newsletter/newsletter-popup-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Card",
      "Icon",
      "Text",
      "Input",
      "Button"
    ],
    "name": "Newsletter Popup",
    "description": "Newsletter Popup block for newsletter",
    "tags": [
      "newsletter",
      "newsletter",
      "popup"
    ],
    "screenshot": "thumbs/newsletter/newsletter-popup-01.webp"
  },
  {
    "id": "portfolio-carousel-01",
    "category": "portfolio",
    "subcategory": "portfolio-carousel",
    "file": "portfolio/portfolio-carousel-01.json",
    "element_count": 32,
    "components_used": [
      "Stack",
      "Text",
      "ButtonGroup",
      "Button",
      "Card",
      "Image",
      "Chip",
      "Grid"
    ],
    "name": "Portfolio Carousel",
    "description": "Portfolio Carousel block for portfolio",
    "tags": [
      "portfolio",
      "portfolio",
      "carousel"
    ],
    "screenshot": "thumbs/portfolio/portfolio-carousel-01.webp"
  },
  {
    "id": "portfolio-case-study-01",
    "category": "portfolio",
    "subcategory": "portfolio-case-study",
    "file": "portfolio/portfolio-case-study-01.json",
    "element_count": 33,
    "components_used": [
      "Stack",
      "Breadcrumbs",
      "Badge",
      "Text",
      "Image",
      "Grid",
      "StatCard",
      "Prose",
      "List",
      "Surface",
      "Avatar",
      "Button"
    ],
    "name": "Portfolio Case Study",
    "description": "Portfolio Case Study block for portfolio",
    "tags": [
      "portfolio",
      "portfolio",
      "case",
      "study"
    ],
    "screenshot": "thumbs/portfolio/portfolio-case-study-01.webp"
  },
  {
    "id": "portfolio-grid-01",
    "category": "portfolio",
    "subcategory": "portfolio-grid",
    "file": "portfolio/portfolio-grid-01.json",
    "element_count": 53,
    "components_used": [
      "Stack",
      "Text",
      "ToggleGroup",
      "Grid",
      "Card",
      "Image",
      "Chip"
    ],
    "name": "Portfolio Grid",
    "description": "Portfolio Grid block for portfolio",
    "tags": [
      "portfolio",
      "portfolio",
      "grid"
    ],
    "screenshot": "thumbs/portfolio/portfolio-grid-01.webp"
  },
  {
    "id": "pricing-calculator-01",
    "category": "pricing",
    "subcategory": "pricing-calculator",
    "file": "pricing/pricing-calculator-01.json",
    "element_count": 36,
    "components_used": [
      "Stack",
      "Text",
      "Surface",
      "Slider",
      "Separator",
      "Button"
    ],
    "name": "Pricing Calculator",
    "description": "Pricing Calculator block for pricing",
    "tags": [
      "pricing",
      "pricing",
      "calculator"
    ],
    "screenshot": "thumbs/pricing/pricing-calculator-01.webp"
  },
  {
    "id": "pricing-comparison-table-01",
    "category": "pricing",
    "subcategory": "pricing-comparison-table",
    "file": "pricing/pricing-comparison-table-01.json",
    "element_count": 8,
    "components_used": [
      "Stack",
      "Text",
      "DataTable",
      "Button"
    ],
    "name": "Pricing Comparison Table",
    "description": "Pricing Comparison Table block for pricing",
    "tags": [
      "pricing",
      "pricing",
      "comparison",
      "table"
    ],
    "screenshot": "thumbs/pricing/pricing-comparison-table-01.webp"
  },
  {
    "id": "pricing-faq-01",
    "category": "pricing",
    "subcategory": "pricing-faq",
    "file": "pricing/pricing-faq-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Accordion",
      "ButtonGroup",
      "Button"
    ],
    "name": "Pricing Faq",
    "description": "Pricing Faq block for pricing",
    "tags": [
      "pricing",
      "pricing",
      "faq"
    ],
    "screenshot": "thumbs/pricing/pricing-faq-01.webp"
  },
  {
    "id": "pricing-single-01",
    "category": "pricing",
    "subcategory": "pricing-single",
    "file": "pricing/pricing-single-01.json",
    "element_count": 23,
    "components_used": [
      "Stack",
      "Surface",
      "Text",
      "Badge",
      "Separator",
      "Grid",
      "Button"
    ],
    "name": "Pricing Single",
    "description": "Pricing Single block for pricing",
    "tags": [
      "pricing",
      "pricing",
      "single"
    ],
    "screenshot": "thumbs/pricing/pricing-single-01.webp"
  },
  {
    "id": "pricing-tiers-01",
    "category": "pricing",
    "subcategory": "pricing-tiers",
    "file": "pricing/pricing-tiers-01.json",
    "element_count": 35,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Surface",
      "Button",
      "Separator",
      "List",
      "Badge"
    ],
    "name": "Pricing Tiers",
    "description": "Pricing Tiers block for pricing",
    "tags": [
      "pricing",
      "pricing",
      "tiers"
    ],
    "screenshot": "thumbs/pricing/pricing-tiers-01.webp"
  },
  {
    "id": "pricing-toggle-01",
    "category": "pricing",
    "subcategory": "pricing-toggle",
    "file": "pricing/pricing-toggle-01.json",
    "element_count": 38,
    "components_used": [
      "Stack",
      "Text",
      "ToggleGroup",
      "Grid",
      "Surface",
      "Button",
      "Separator",
      "List",
      "Badge"
    ],
    "name": "Pricing Toggle",
    "description": "Pricing Toggle block for pricing",
    "tags": [
      "pricing",
      "pricing",
      "toggle"
    ],
    "screenshot": "thumbs/pricing/pricing-toggle-01.webp"
  },
  {
    "id": "case-study-card-01",
    "category": "social-proof",
    "subcategory": "case-study-card",
    "file": "social-proof/case-study-card-01.json",
    "element_count": 25,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Surface",
      "Grid",
      "StatCard",
      "Separator",
      "Avatar"
    ],
    "name": "Case Study Card",
    "description": "Case Study Card block for social-proof",
    "tags": [
      "social-proof",
      "case",
      "study",
      "card"
    ],
    "screenshot": "thumbs/social-proof/case-study-card-01.webp"
  },
  {
    "id": "press-mentions-01",
    "category": "social-proof",
    "subcategory": "press-mentions",
    "file": "social-proof/press-mentions-01.json",
    "element_count": 22,
    "components_used": [
      "Stack",
      "Text",
      "Separator",
      "Grid",
      "Surface"
    ],
    "name": "Press Mentions",
    "description": "Press Mentions block for social-proof",
    "tags": [
      "social-proof",
      "press",
      "mentions"
    ],
    "screenshot": "thumbs/social-proof/press-mentions-01.webp"
  },
  {
    "id": "review-stars-01",
    "category": "social-proof",
    "subcategory": "review-stars",
    "file": "social-proof/review-stars-01.json",
    "element_count": 42,
    "components_used": [
      "Stack",
      "Text",
      "Progress",
      "Separator"
    ],
    "name": "Review Stars",
    "description": "Review Stars block for social-proof",
    "tags": [
      "social-proof",
      "review",
      "stars"
    ],
    "screenshot": "thumbs/social-proof/review-stars-01.webp"
  },
  {
    "id": "social-proof-bar-01",
    "category": "social-proof",
    "subcategory": "social-proof-bar",
    "file": "social-proof/social-proof-bar-01.json",
    "element_count": 18,
    "components_used": [
      "Surface",
      "Stack",
      "Text",
      "Separator"
    ],
    "name": "Social Proof Bar",
    "description": "Social Proof Bar block for social-proof",
    "tags": [
      "social-proof",
      "social",
      "proof",
      "bar"
    ],
    "screenshot": "thumbs/social-proof/social-proof-bar-01.webp"
  },
  {
    "id": "testimonial-carousel-01",
    "category": "social-proof",
    "subcategory": "testimonial-carousel",
    "file": "social-proof/testimonial-carousel-01.json",
    "element_count": 33,
    "components_used": [
      "Stack",
      "Text",
      "Card",
      "Avatar",
      "Grid",
      "ButtonGroup",
      "Button"
    ],
    "name": "Testimonial Carousel",
    "description": "Testimonial Carousel block for social-proof",
    "tags": [
      "social-proof",
      "testimonial",
      "carousel"
    ],
    "screenshot": "thumbs/social-proof/testimonial-carousel-01.webp"
  },
  {
    "id": "testimonial-grid-01",
    "category": "social-proof",
    "subcategory": "testimonial-grid",
    "file": "social-proof/testimonial-grid-01.json",
    "element_count": 30,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Grid",
      "Surface",
      "Avatar"
    ],
    "name": "Testimonial Grid",
    "description": "Testimonial Grid block for social-proof",
    "tags": [
      "social-proof",
      "testimonial",
      "grid"
    ],
    "screenshot": "thumbs/social-proof/testimonial-grid-01.webp"
  },
  {
    "id": "testimonial-single-01",
    "category": "social-proof",
    "subcategory": "testimonial-single",
    "file": "social-proof/testimonial-single-01.json",
    "element_count": 10,
    "components_used": [
      "Stack",
      "Text",
      "Separator",
      "Avatar"
    ],
    "name": "Testimonial Single",
    "description": "Testimonial Single block for social-proof",
    "tags": [
      "social-proof",
      "testimonial",
      "single"
    ],
    "screenshot": "thumbs/social-proof/testimonial-single-01.webp"
  },
  {
    "id": "testimonial-wall-01",
    "category": "social-proof",
    "subcategory": "testimonial-wall",
    "file": "social-proof/testimonial-wall-01.json",
    "element_count": 39,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Surface",
      "Avatar"
    ],
    "name": "Testimonial Wall",
    "description": "Testimonial Wall block for social-proof",
    "tags": [
      "social-proof",
      "testimonial",
      "wall"
    ],
    "screenshot": "thumbs/social-proof/testimonial-wall-01.webp"
  },
  {
    "id": "stats-counter-01",
    "category": "stats",
    "subcategory": "stats-counter",
    "file": "stats/stats-counter-01.json",
    "element_count": 17,
    "components_used": [
      "Surface",
      "Stack",
      "Text",
      "Grid"
    ],
    "name": "Stats Counter",
    "description": "Stats Counter block for stats",
    "tags": [
      "stats",
      "stats",
      "counter"
    ],
    "screenshot": "thumbs/stats/stats-counter-01.webp"
  },
  {
    "id": "stats-grid-01",
    "category": "stats",
    "subcategory": "stats-grid",
    "file": "stats/stats-grid-01.json",
    "element_count": 8,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "StatCard"
    ],
    "name": "Stats Grid",
    "description": "Stats Grid block for stats",
    "tags": [
      "stats",
      "stats",
      "grid"
    ],
    "screenshot": "thumbs/stats/stats-grid-01.webp"
  },
  {
    "id": "stats-strip-01",
    "category": "stats",
    "subcategory": "stats-strip",
    "file": "stats/stats-strip-01.json",
    "element_count": 16,
    "components_used": [
      "Stack",
      "Text",
      "Separator"
    ],
    "name": "Stats Strip",
    "description": "Slim horizontal strip of headline metrics divided by separators.",
    "tags": [
      "stats",
      "strip",
      "metrics",
      "kpi"
    ],
    "screenshot": "thumbs/stats/stats-strip-01.webp"
  },
  {
    "id": "stats-with-description-01",
    "category": "stats",
    "subcategory": "stats-with-description",
    "file": "stats/stats-with-description-01.json",
    "element_count": 27,
    "components_used": [
      "Stack",
      "Badge",
      "Text",
      "Button",
      "Grid",
      "Surface",
      "Chip"
    ],
    "name": "Stats With Description",
    "description": "Stats With Description block for stats",
    "tags": [
      "stats",
      "stats",
      "with",
      "description"
    ],
    "screenshot": "thumbs/stats/stats-with-description-01.webp"
  },
  {
    "id": "team-carousel-01",
    "category": "team",
    "subcategory": "team-carousel",
    "file": "team/team-carousel-01.json",
    "element_count": 25,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "Avatar",
      "Chip",
      "ButtonGroup",
      "Button"
    ],
    "name": "Team Carousel",
    "description": "Team Carousel block for team",
    "tags": [
      "team",
      "team",
      "carousel"
    ],
    "screenshot": "thumbs/team/team-carousel-01.webp"
  },
  {
    "id": "team-featured-01",
    "category": "team",
    "subcategory": "team-featured",
    "file": "team/team-featured-01.json",
    "element_count": 12,
    "components_used": [
      "Surface",
      "Stack",
      "Image",
      "Badge",
      "Text",
      "Prose",
      "Button"
    ],
    "name": "Team Featured",
    "description": "Team Featured block for team",
    "tags": [
      "team",
      "team",
      "featured"
    ],
    "screenshot": "thumbs/team/team-featured-01.webp"
  },
  {
    "id": "team-grid-01",
    "category": "team",
    "subcategory": "team-grid",
    "file": "team/team-grid-01.json",
    "element_count": 34,
    "components_used": [
      "Stack",
      "Text",
      "Grid",
      "Card",
      "Avatar"
    ],
    "name": "Team Grid",
    "description": "Team Grid block for team",
    "tags": [
      "team",
      "team",
      "grid"
    ],
    "screenshot": "thumbs/team/team-grid-01.webp"
  },
  {
    "id": "team-list-01",
    "category": "team",
    "subcategory": "team-list",
    "file": "team/team-list-01.json",
    "element_count": 31,
    "components_used": [
      "Stack",
      "Text",
      "Avatar",
      "Badge",
      "Separator"
    ],
    "name": "Team List",
    "description": "Team List block for team",
    "tags": [
      "team",
      "team",
      "list"
    ],
    "screenshot": "thumbs/team/team-list-01.webp"
  },
  {
    "id": "changelog-01",
    "category": "timeline",
    "subcategory": "changelog",
    "file": "timeline/changelog-01.json",
    "element_count": 37,
    "components_used": [
      "Stack",
      "Text",
      "Badge",
      "Prose",
      "Separator"
    ],
    "name": "Changelog",
    "description": "Changelog block for timeline",
    "tags": [
      "timeline",
      "changelog"
    ],
    "screenshot": "thumbs/timeline/changelog-01.webp"
  },
  {
    "id": "roadmap-01",
    "category": "timeline",
    "subcategory": "roadmap",
    "file": "timeline/roadmap-01.json",
    "element_count": 22,
    "components_used": [
      "Stack",
      "Text",
      "Stepper",
      "Grid",
      "Surface",
      "Badge",
      "List",
      "Progress"
    ],
    "name": "Roadmap",
    "description": "Roadmap block for timeline",
    "tags": [
      "timeline",
      "roadmap"
    ],
    "screenshot": "thumbs/timeline/roadmap-01.webp"
  },
  {
    "id": "timeline-horizontal-01",
    "category": "timeline",
    "subcategory": "timeline-horizontal",
    "file": "timeline/timeline-horizontal-01.json",
    "element_count": 24,
    "components_used": [
      "Stack",
      "Text",
      "ScrollArea",
      "Card",
      "Badge"
    ],
    "name": "Timeline Horizontal",
    "description": "Timeline Horizontal block for timeline",
    "tags": [
      "timeline",
      "timeline",
      "horizontal"
    ],
    "screenshot": "thumbs/timeline/timeline-horizontal-01.webp"
  },
  {
    "id": "timeline-vertical-01",
    "category": "timeline",
    "subcategory": "timeline-vertical",
    "file": "timeline/timeline-vertical-01.json",
    "element_count": 4,
    "components_used": [
      "Stack",
      "Text",
      "List"
    ],
    "name": "Timeline Vertical",
    "description": "Timeline Vertical block for timeline",
    "tags": [
      "timeline",
      "timeline",
      "vertical"
    ],
    "screenshot": "thumbs/timeline/timeline-vertical-01.webp"
  }
];

// ---- MCP Tool Handlers ----

// The schema asks for a JSON string, but some clients pass the spec object itself; take either
function specArg(tool, spec) {
  if (spec && typeof spec === 'object') return spec;
  if (typeof spec !== 'string') throw new Error(`${tool} requires "spec" as a JSON string or object`);
  return JSON.parse(spec);
}

async function handleToolCall(name, args, env) {
  switch (name) {
    case 'generate_ui': {
      if (typeof args.prompt !== 'string' || !args.prompt.trim()) throw new Error('generate_ui requires "prompt" as a non-empty string');
      const apiKey = env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('Server misconfigured: missing OPENROUTER_API_KEY');
      const options = { theme: args.theme, format: args.format || 'json' };
      if (args.existing_spec) {
        try { options.existing_spec = JSON.parse(args.existing_spec); } catch { options.existing_spec = args.existing_spec; }
      }
      const result = await generateSpecWithRouting(args.prompt, options, apiKey, env);
      if (result.parse_error || !result.spec) {
        return JSON.stringify({
          error: 'Generation failed after all retries',
          validation: result.validation,
          routing: result.routing,
          raw_text: result.raw_text,
        }, null, 2);
      }
      const summary = specSummary(result.spec);
      const html = renderToHTML(result.spec);
      return JSON.stringify({
        spec: result.spec,
        html,
        summary,
        validation: { valid: result.validation.valid, issues: result.validation.issues },
        routing: result.routing,
        usage: result.usage,
      }, null, 2);
    }

    case 'get_component_catalog': {
      let categories = COMP_CATEGORIES;
      if (args.category) {
        categories = categories.filter(([name]) => name.toLowerCase().includes(args.category.toLowerCase()));
      }
      const catalog = {};
      for (const [catName, types] of categories) {
        catalog[catName] = {};
        for (const t of types) catalog[catName][t] = COMP_PROPS[t] || '(no props)';
      }
      return JSON.stringify({
        categories: catalog,
        all_types: VALID_TYPES,
        themes: THEMES,
        spec_format: '{"theme":"<name>","root":"<id>","elements":{"<id>":{"type":"<Type>","props":{...},"children":["<child-id>"]}}}',
        example: {
          theme: 'bone',
          root: 'page',
          elements: {
            page: { type: 'Stack', props: { direction: 'vertical', gap: 4 }, children: ['heading', 'card-1'] },
            heading: { type: 'Text', props: { tag: 'h1', content: 'Hello DAUB' } },
            'card-1': { type: 'Card', props: { title: 'Welcome', description: 'This is a DAUB component' } },
          },
        },
      }, null, 2);
    }

    case 'validate_spec': {
      const spec = specArg(name, args.spec);
      return JSON.stringify(validateSpec(spec), null, 2);
    }

    case 'render_spec': {
      const spec = specArg(name, args.spec);
      const validation = validateSpec(spec);
      const html = renderToHTML(spec);
      return JSON.stringify({ spec, html, validation }, null, 2);
    }

    case 'get_block_library': {
      let blocks = BLOCK_INDEX;
      if (args.category) {
        blocks = blocks.filter(b => b.category === args.category);
      }
      const byCategory = {};
      for (const b of blocks) {
        (byCategory[b.category] = byCategory[b.category] || []).push({
          id: b.id,
          name: b.name,
          description: b.description,
          tags: b.tags,
        });
      }
      return JSON.stringify({
        total: blocks.length,
        categories: byCategory,
        usage: 'Use block IDs as references when prompting generate_ui. Example: "Build a landing page using the hero-01 and pricing-01 patterns"',
      }, null, 2);
    }

    case 'parse_openui': {
      const spec = openUItoSpec(args.code);
      if (!spec) {
        return JSON.stringify({ error: 'Failed to parse OpenUI Lang code', raw: args.code.slice(0, 500) }, null, 2);
      }
      const validation = validateSpec(spec);
      const html = renderToHTML(spec);
      return JSON.stringify({ spec, html, validation }, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---- JSON-RPC Helpers ----

function jsonrpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// ---- MCP Protocol Handler ----

async function handleMcpRequest(body, env) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 400, body: jsonrpcError(null, -32600, 'Invalid Request') };
  }
  const { method, id, params } = body;

  // Notifications (no id) — acknowledge with 202
  if (id === undefined || id === null) {
    return { status: 202, body: null };
  }

  switch (method) {
    case 'initialize':
      return {
        status: 200,
        body: jsonrpcResult(id, {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'daub-mcp', version: '1.0.0' },
        }),
      };

    case 'tools/list':
      return {
        status: 200,
        body: jsonrpcResult(id, { tools: TOOLS }),
      };

    case 'tools/call': {
      const { name, arguments: args } = params || {};
      try {
        const text = await handleToolCall(name, args || {}, env);
        return {
          status: 200,
          body: jsonrpcResult(id, { content: [{ type: 'text', text }] }),
        };
      } catch (e) {
        return {
          status: 200,
          body: jsonrpcResult(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }),
        };
      }
    }

    case 'ping':
      return { status: 200, body: jsonrpcResult(id, {}) };

    default:
      return {
        status: 200,
        body: jsonrpcError(id, -32601, `Method not found: ${method}`),
      };
  }
}

// ---- Cloudflare Pages Function: POST ----

export async function onRequestPost(context) {
  try {
    return await handlePost(context);
  } catch (e) {
    return new Response(JSON.stringify(jsonrpcError(null, -32603, 'Internal error')), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Mcp-Session-Id',
        'Content-Type': 'application/json',
      },
    });
  }
}

async function handlePost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  };

  if (env.RL_MCP) {
    try {
      const key = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RL_MCP.limit({ key });
      if (!success) {
        return new Response(JSON.stringify(jsonrpcError(null, -32000, 'Rate limit exceeded — 60 req/min per IP')), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch {}
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify(jsonrpcError(null, -32700, 'Parse error')), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Handle batch requests
  if (Array.isArray(body)) {
    if (body.length === 0 || body.length > 10) {
      return new Response(JSON.stringify(jsonrpcError(null, -32600, 'Invalid Request')), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const results = [];
    let toolCalls = 0;
    for (const req of body) {
      // Count each tools/call after the first against the rate limit. Notifications (no id)
      // never run and get no response, so they neither count nor get a rate-limit entry.
      const isCall = req && req.method === 'tools/call' && req.id !== undefined && req.id !== null;
      if (isCall && ++toolCalls > 1 && env.RL_MCP) {
        let allowed = true;
        try {
          const { success } = await env.RL_MCP.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
          allowed = success;
        } catch {}
        if (!allowed) {
          results.push(jsonrpcError(req.id, -32000, 'Rate limit exceeded — 60 req/min per IP'));
          continue;
        }
      }
      const res = await handleMcpRequest(req, env);
      if (res.body) results.push(res.body);
    }
    if (results.length === 0) {
      return new Response(null, { status: 202, headers: corsHeaders });
    }
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const result = await handleMcpRequest(body, env);

  if (result.status === 202) {
    return new Response(null, { status: 202, headers: corsHeaders });
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---- Cloudflare Pages Function: GET (SSE — not needed for stateless, return 405) ----

export async function onRequestGet() {
  return new Response(JSON.stringify({ error: 'SSE not supported — use POST for MCP requests' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ---- Cloudflare Pages Function: DELETE (session cleanup — no-op for stateless) ----

export async function onRequestDelete() {
  return new Response(null, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

// ---- Cloudflare Pages Function: OPTIONS (CORS preflight) ----

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    },
  });
}
