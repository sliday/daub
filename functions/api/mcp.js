// Cloudflare Pages Function — Remote DAUB MCP Server (Streamable HTTP)
// POST /api/mcp  — handles MCP JSON-RPC protocol

// ---- Component Catalog (inlined from mcp/lib/prompt.js) ----

const COMP_PROPS = {
  Stack: 'direction: "vertical"|"horizontal", gap: 0-6 (default 2=8px), justify: "center"|"end"|"between"|"evenly", align: "center"|"end"|"start"|"stretch", wrap: bool, container: "wide"|"narrow"|true',
  Grid: 'columns: 2-6, gap: 0-6 (default 2=8px), align: "center"|"end", container: "wide"|"narrow"|true',
  Surface: 'variant: "raised"|"inset"|"pressed"',
  Text: 'tag: "h1"|"h2"|"h3"|"h4"|"p"|"span", content: string, class: string',
  Prose: 'content: string (HTML), size: "sm"|"lg"|"xl"|"2xl"',
  Separator: 'vertical: bool, dashed: bool, label: string',
  Button: 'label: string, variant: "primary"|"secondary"|"ghost"|"icon-danger"|"icon-success"|"icon-accent", size: "sm"|"lg"|"icon", loading: bool, icon: string, trigger: "overlayId"',
  ButtonGroup: '(children are Buttons)',
  Field: 'label: string, placeholder: string, type: "text"|"email"|"password"|"number", error: bool, helper: string',
  Input: 'placeholder: string, size: "sm"|"lg", error: bool, type: "text"|"email"|"password"|"number"|"tel"|"url"|"search"|"date"|"time"',
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
  CustomSelect: 'placeholder: string, options: [{label, value, selected, disabled}], searchable: bool',
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
  Sidebar: 'sections: [{title, items: [{label, icon, active, href}]}], collapsed: bool',
  BottomNav: 'items: [{label, icon, active, badge}]',
  Card: 'title: string, description: string, media: string, footer: [childIds], interactive: bool, clip: bool',
  Table: 'columns: [{key, label, numeric}], rows: [{}], sortable: bool',
  DataTable: 'columns: [{key, label}], rows: [{}], selectable: bool',
  List: 'items: [{title, secondary, icon}]',
  Badge: 'text: string, variant: "new"|"updated"|"warning"|"error"',
  Avatar: 'initials: string, src: string, size: "sm"|"md"|"lg"',
  AvatarGroup: 'avatars: [{initials, src}], max: number',
  Calendar: 'selected: "YYYY-MM-DD", today: "YYYY-MM-DD"',
  Chart: 'bars: [{label, value, max}]',
  Carousel: 'slides: [{content}]',
  AspectRatio: 'ratio: "16-9"|"4-3"|"1-1"|"21-9"',
  Chip: 'label: string, color: "red"|"green"|"blue"|"purple"|"amber"|"pink", active: bool, closable: bool',
  ScrollArea: 'direction: "horizontal"|"vertical"',
  Image: 'src: string, alt: string, width: number, height: number',
  Alert: 'type: "info"|"warning"|"error"|"success", title: string, message: string',
  Progress: 'value: number, indeterminate: bool',
  Skeleton: 'variant: "text"|"heading"|"avatar"|"btn", lines: number',
  EmptyState: 'icon: string, title: string, message: string',
  Tooltip: 'text: string, position: "top"|"bottom"|"left"|"right"',
  Modal: 'id: string, title: string, footer: [childIds]',
  AlertDialog: 'id: string, title: string, description: string, footer: [childIds]',
  Sheet: 'id: string, position: "right"|"left"|"top"|"bottom"',
  Drawer: 'id: string',
  Popover: 'position: "top"|"bottom"|"left"|"right"',
  HoverCard: '',
  DropdownMenu: 'items: [{label, icon, separator, groupLabel, active}]',
  ContextMenu: 'items: [{label, icon, separator}]',
  CommandPalette: 'id: string, placeholder: string, groups: [{label, items: [{label, icon, shortcut}]}]',
  Accordion: 'items: [{title, content, children: [childIds]}], multi: bool',
  Collapsible: 'label: string',
  Resizable: 'direction: "horizontal"|"vertical"',
  DatePicker: 'label: string, placeholder: string, selected: string',
  StatCard: 'label: string, value: string, trend: "up"|"down", trendValue: string, icon: string, horizontal: bool',
  ChartCard: 'title: string',
  CustomHTML: 'html: string, css: string, js: string, children: [childIds]',
};

const COMP_CATEGORIES = [
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

const VALID_TYPES = COMP_CATEGORIES.flatMap(([, types]) => types);
const validTypeSet = new Set(VALID_TYPES);

// ---- Validation (inlined from mcp/lib/validate.js) ----

function validateSpec(spec) {
  const issues = [];
  if (!spec || typeof spec !== 'object') return { valid: false, issues: ['Spec is not an object'], element_count: 0, components_used: [] };
  if (!spec.elements || typeof spec.elements !== 'object') issues.push('Missing "elements" object');
  if (!spec.root) issues.push('Missing "root"');
  if (spec.root && spec.elements && !spec.elements[spec.root]) issues.push(`Root "${spec.root}" not found in elements`);
  const componentsUsed = new Set();
  if (spec.elements) {
    for (const [id, def] of Object.entries(spec.elements)) {
      if (!def.type) {
        issues.push(`Element "${id}" missing "type"`);
      } else {
        componentsUsed.add(def.type);
        if (!validTypeSet.has(def.type)) issues.push(`Unknown type "${def.type}" on element "${id}"`);
      }
      for (const cid of (def.children || [])) {
        if (!spec.elements[cid]) issues.push(`Element "${id}" references missing child "${cid}"`);
      }
    }
  }
  return { valid: issues.length === 0, issues, element_count: spec.elements ? Object.keys(spec.elements).length : 0, components_used: [...componentsUsed] };
}

function autoFixSpec(spec) {
  if (!spec || !spec.elements) return spec;
  for (const def of Object.values(spec.elements)) {
    if (def.children) def.children = def.children.filter(cid => !!spec.elements[cid]);
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

// ---- System Prompt Builder ----

function buildSystemPrompt(ragBlocks, userPrompt) {
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

  for (const [cat, types] of COMP_CATEGORIES) {
    prompt += cat + ':\n';
    for (const t of types) {
      if (COMP_PROPS[t] !== undefined) prompt += '- ' + t + ': { ' + (COMP_PROPS[t] || '') + ' }\n';
    }
    prompt += '\n';
  }

  prompt += 'GUIDELINES:\n'
    + '- Use Stack as root with direction:"vertical" for page layouts\n'
    + '- Use Grid for equal-width arrangements\n'
    + '- Stack direction:"horizontal" justify:"between" for headers/toolbars\n'
    + '- Gap tokens: 0=0px, 1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px\n'
    + '- Wrap related content in Card components\n'
    + '- Use StatCard for KPI metrics\n'
    + '- Use trigger:"overlay-id" on Button to open overlays\n\n';

  prompt += LAYOUT_RULES_COMPACT + '\n\n';

  if (detectLandingIntent(userPrompt)) {
    prompt += LANDING_PAGE_RULES + '\n\n';
  }

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
    + '- Light: light, bone, material-light, github, nord-light, solarized-light, catppuccin, gruvbox-light, paper, grunge-light\n'
    + '- Dark: dark, material-dark, github-dark, nord, solarized-dark, catppuccin-dark, gruvbox-dark, dracula, grunge-dark, synthwave, tokyo-night\n';

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

async function callOpenRouter(model, messages, apiKey) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daub.dev',
      'X-Title': 'DAUB MCP Server',
    },
    body: JSON.stringify({ model, messages, max_tokens: 32768, temperature: 0.7, response_format: { type: 'json_object' } }),
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

async function generateSpecWithRouting(prompt, options, apiKey, env) {
  const complexity = scorePromptComplexity(prompt);
  const tierConfig = MODEL_TIERS[complexity.tier];
  const modelsToTry = [tierConfig.primary, ...tierConfig.fallbacks.slice(0, MAX_FALLBACK_MODELS)];

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

  const messages = [{ role: 'system', content: buildSystemPrompt(ragBlocks, prompt) }];
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

        const { rawContent, usage } = await callOpenRouter(model, messages, apiKey);
        lastRawContent = rawContent;

        let spec;
        try {
          spec = JSON.parse(cleanJSON(rawContent));
        } catch (e) {
          const parseError = new Error(`Failed to parse JSON: ${e.message}`);
          parseError.retryable = true;
          throw parseError;
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

function renderToHTML(spec) {
  const theme = spec.theme || 'light';
  const specJSON = JSON.stringify(spec);
  return `<!DOCTYPE html>
<html data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAUB UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daub-ui@3/daub.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"><\/script>
  <style>
    body { margin: 0; padding: 16px; font-family: Inter, system-ui, sans-serif; background: var(--db-bg); color: var(--db-fg); }
    #app { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/daub-ui@3/daub.js"><\/script>
  <script>
  (function() {
    var spec = ${specJSON};
    // Load renderer from playground and render spec
    var s = document.createElement('script');
    s.src = 'https://daub.dev/daub-render.js';
    s.onload = function() {
      if (typeof renderElement === 'function') {
        var root = renderElement(spec.elements, spec.root, 0);
        if (root) document.getElementById('app').appendChild(root);
        var rendered = {};
        document.querySelectorAll('[data-spec-id]').forEach(function(n) { rendered[n.getAttribute('data-spec-id')] = true; });
        Object.keys(spec.elements).forEach(function(id) {
          if (id !== spec.root && !rendered[id]) {
            var orphan = renderElement(spec.elements, id, 0);
            if (orphan) document.getElementById('app').appendChild(orphan);
          }
        });
        if (typeof DAUB !== 'undefined') DAUB.init();
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    };
    document.body.appendChild(s);
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
        spec: { type: 'string', description: 'DAUB spec JSON string to validate' },
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
        spec: { type: 'string', description: 'DAUB spec JSON string' },
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
];

// ---- Block Library (inlined from blocks/index.json) ----

const BLOCK_INDEX = [
  {"id":"api-keys-page-01","category":"app-specific","file":"app-specific/api-keys-page-01.json","description":"Api Keys Page block for app-specific","tags":["app-specific","api","keys","page"],"element_count":11,"components_used":["Stack","Text","Button","Alert","DataTable"]},
  {"id":"billing-page-01","category":"app-specific","file":"app-specific/billing-page-01.json","description":"Billing Page block for app-specific","tags":["app-specific","billing","page"],"element_count":21,"components_used":["Stack","Text","Button","Surface","Badge","Separator","DataTable"]},
  {"id":"changelog-page-01","category":"app-specific","file":"app-specific/changelog-page-01.json","description":"Changelog Page block for app-specific","tags":["app-specific","changelog","page"],"element_count":38,"components_used":["Stack","Text","Badge","Prose","Separator"]},
  {"id":"onboarding-tour-01","category":"app-specific","file":"app-specific/onboarding-tour-01.json","description":"Onboarding Tour block for app-specific","tags":["app-specific","onboarding","tour"],"element_count":10,"components_used":["Stack","Text","Progress","List","Button"]},
  {"id":"profile-page-01","category":"app-specific","file":"app-specific/profile-page-01.json","description":"Profile Page block for app-specific","tags":["app-specific","profile","page"],"element_count":21,"components_used":["Stack","Avatar","Text","Badge","Button","Grid","StatCard","Separator","List"]},
  {"id":"settings-page-01","category":"app-specific","file":"app-specific/settings-page-01.json","description":"Settings Page block for app-specific","tags":["app-specific","settings","page"],"element_count":22,"components_used":["Grid","Sidebar","Stack","Text","Select","Separator","Switch","Button"]},
  {"id":"auth-page-01","category":"auth","file":"auth/auth-page-01.json","description":"Split-screen auth: branding panel (left) + login form (right) in 2-column grid","tags":["auth","login","split-screen","branding"],"element_count":33,"components_used":["Grid","Surface","Stack","Text","List","Avatar","Button","Separator","Field","Switch"]},
  {"id":"forgot-password-01","category":"auth","file":"auth/forgot-password-01.json","description":"Forgot Password block for auth","tags":["auth","forgot","password"],"element_count":11,"components_used":["Stack","Card","Alert","Field","email","Button","Separator","Text"]},
  {"id":"login-form-01","category":"auth","file":"auth/login-form-01.json","description":"Login Form block for auth","tags":["auth","login","form"],"element_count":15,"components_used":["Stack","Card","Field","email","password","Checkbox","Button","Separator","Text"]},
  {"id":"register-form-01","category":"auth","file":"auth/register-form-01.json","description":"Register Form block for auth","tags":["auth","register","form"],"element_count":20,"components_used":["Stack","Card","Grid","Field","Input","email","password","Checkbox","Button","Separator","Text"]},
  {"id":"reset-password-01","category":"auth","file":"auth/reset-password-01.json","description":"Reset Password block for auth","tags":["auth","reset","password"],"element_count":15,"components_used":["Stack","Card","Field","password","Progress","Text","Button","Separator"]},
  {"id":"social-login-01","category":"auth","file":"auth/social-login-01.json","description":"Social Login block for auth","tags":["auth","social","login"],"element_count":18,"components_used":["Stack","Card","Button","Separator","Text","Field","email","password"]},
  {"id":"two-factor-01","category":"auth","file":"auth/two-factor-01.json","description":"Two Factor block for auth","tags":["auth","two","factor"],"element_count":14,"components_used":["Stack","Card","Button","Label","InputOTP","Separator","Text"]},
  {"id":"banner-bottom-sticky-01","category":"banners","file":"banners/banner-bottom-sticky-01.json","description":"Banner Bottom Sticky block for banners","tags":["banners","banner","bottom","sticky"],"element_count":9,"components_used":["Surface","Stack","Text","ButtonGroup","Button"]},
  {"id":"banner-inline-01","category":"banners","file":"banners/banner-inline-01.json","description":"Banner Inline block for banners","tags":["banners","banner","inline"],"element_count":11,"components_used":["Stack","Surface","Grid","Chip","Text","Button","Image"]},
  {"id":"banner-top-01","category":"banners","file":"banners/banner-top-01.json","description":"Banner Top block for banners","tags":["banners","banner","top"],"element_count":6,"components_used":["Surface","Stack","Badge","Text","Button"]},
  {"id":"blog-featured-01","category":"blog","file":"blog/blog-featured-01.json","description":"Blog Featured block for blog","tags":["blog","blog","featured"],"element_count":13,"components_used":["Surface","Stack","Image","Badge","Text","Avatar","Button"]},
  {"id":"blog-grid-01","category":"blog","file":"blog/blog-grid-01.json","description":"Blog Grid block for blog","tags":["blog","blog","grid"],"element_count":46,"components_used":["Stack","Text","Grid","Card","Image","Chip"]},
  {"id":"blog-list-01","category":"blog","file":"blog/blog-list-01.json","description":"Blog List block for blog","tags":["blog","blog","list"],"element_count":34,"components_used":["Stack","Text","Image","Chip","Separator"]},
  {"id":"blog-newsletter-01","category":"blog","file":"blog/blog-newsletter-01.json","description":"Blog Newsletter block for blog","tags":["blog","blog","newsletter"],"element_count":26,"components_used":["Stack","Text","Grid","Card","Image","Surface","InputGroup","email","Button"]},
  {"id":"blog-post-header-01","category":"blog","file":"blog/blog-post-header-01.json","description":"Blog Post Header block for blog","tags":["blog","blog","post","header"],"element_count":17,"components_used":["Stack","Breadcrumbs","Chip","Text","Avatar","ButtonGroup","Button","Image"]},
  {"id":"blog-sidebar-01","category":"blog","file":"blog/blog-sidebar-01.json","description":"Blog Sidebar block for blog","tags":["blog","blog","sidebar"],"element_count":37,"components_used":["Grid","Stack","Text","Card","Image","Search","NavMenu","Chip","List"]},
  {"id":"before-after-01","category":"comparison","file":"comparison/before-after-01.json","description":"Before After block for comparison","tags":["comparison","before","after"],"element_count":16,"components_used":["Stack","Text","Grid","Card","Badge","AspectRatio","Image"]},
  {"id":"comparison-table-01","category":"comparison","file":"comparison/comparison-table-01.json","description":"Comparison Table block for comparison","tags":["comparison","comparison","table"],"element_count":4,"components_used":["Stack","Text","DataTable"]},
  {"id":"vs-layout-01","category":"comparison","file":"comparison/vs-layout-01.json","description":"Vs Layout block for comparison","tags":["comparison","vs","layout"],"element_count":13,"components_used":["Stack","Text","Grid","Card","List","Separator","Surface","Badge"]},
  {"id":"contact-form-simple-01","category":"contact","file":"contact/contact-form-simple-01.json","description":"Contact Form Simple block for contact","tags":["contact","contact","form","simple"],"element_count":18,"components_used":["Stack","Text","Surface","Grid","Field","Input","email","Textarea","Button"]},
  {"id":"contact-info-01","category":"contact","file":"contact/contact-info-01.json","description":"Contact Info block for contact","tags":["contact","contact","info"],"element_count":20,"components_used":["Stack","Text","Grid","Card","Button"]},
  {"id":"contact-offices-01","category":"contact","file":"contact/contact-offices-01.json","description":"Contact Offices block for contact","tags":["contact","contact","offices"],"element_count":26,"components_used":["Stack","Text","Grid","Card","Badge"]},
  {"id":"contact-split-01","category":"contact","file":"contact/contact-split-01.json","description":"Contact Split block for contact","tags":["contact","contact","split"],"element_count":35,"components_used":["Stack","Text","Grid","Surface","Field","Input","Textarea","Button","Separator"]},
  {"id":"contact-with-map-01","category":"contact","file":"contact/contact-with-map-01.json","description":"Contact With Map block for contact","tags":["contact","contact","with","map"],"element_count":26,"components_used":["Stack","Text","Grid","Image","Surface","Field","Input","Textarea","Button"]},
  {"id":"content-numbered-steps-01","category":"content","file":"content/content-numbered-steps-01.json","description":"Content Numbered Steps block for content","tags":["content","content","numbered","steps"],"element_count":35,"components_used":["Stack","Text","Avatar","Separator","Button"]},
  {"id":"content-quote-highlight-01","category":"content","file":"content/content-quote-highlight-01.json","description":"Content Quote Highlight block for content","tags":["content","content","quote","highlight"],"element_count":19,"components_used":["Stack","Chip","Text","Surface","Avatar","StatCard"]},
  {"id":"content-section-01","category":"content","file":"content/content-section-01.json","description":"Content Section block for content","tags":["content","content","section"],"element_count":12,"components_used":["Stack","Chip","Text","Image","Button"]},
  {"id":"content-split-01","category":"content","file":"content/content-split-01.json","description":"Content Split block for content","tags":["content","content","split"],"element_count":13,"components_used":["Stack","Text","Grid","Badge","List"]},
  {"id":"content-video-embed-01","category":"content","file":"content/content-video-embed-01.json","description":"Content Video Embed block for content","tags":["content","content","video","embed"],"element_count":20,"components_used":["Stack","Badge","Text","AspectRatio","Surface","Image","List","Separator"]},
  {"id":"content-with-image-01","category":"content","file":"content/content-with-image-01.json","description":"Content With Image block for content","tags":["content","content","with","image"],"element_count":20,"components_used":["Stack","Image","Badge","Text","ButtonGroup","Button"]},
  {"id":"cta-banner-01","category":"cta","file":"cta/cta-banner-01.json","description":"Cta Banner block for cta","tags":["cta","cta","banner"],"element_count":8,"components_used":["Surface","Stack","Text","Button"]},
  {"id":"cta-download-01","category":"cta","file":"cta/cta-download-01.json","description":"Cta Download block for cta","tags":["cta","cta","download"],"element_count":17,"components_used":["Stack","Badge","Text","Button","Image","Chip"]},
  {"id":"cta-floating-01","category":"cta","file":"cta/cta-floating-01.json","description":"Cta Floating block for cta","tags":["cta","cta","floating"],"element_count":10,"components_used":["Surface","Stack","Badge","Text","Button"]},
  {"id":"cta-simple-01","category":"cta","file":"cta/cta-simple-01.json","description":"Cta Simple block for cta","tags":["cta","cta","simple"],"element_count":6,"components_used":["Stack","Text","ButtonGroup","Button"]},
  {"id":"cta-split-01","category":"cta","file":"cta/cta-split-01.json","description":"Cta Split block for cta","tags":["cta","cta","split"],"element_count":21,"components_used":["Stack","Badge","Text","Surface","Field","email","Input","Button"]},
  {"id":"cta-with-form-01","category":"cta","file":"cta/cta-with-form-01.json","description":"Cta With Form block for cta","tags":["cta","cta","with","form"],"element_count":15,"components_used":["Stack","Text","Field","email","Button","AvatarGroup","Avatar"]},
  {"id":"activity-feed-01","category":"dashboard","file":"dashboard/activity-feed-01.json","description":"Activity Feed block for dashboard","tags":["dashboard","activity","feed"],"element_count":5,"components_used":["Stack","Text","Button","List"]},
  {"id":"chart-panel-01","category":"dashboard","file":"dashboard/chart-panel-01.json","description":"Chart card with bar chart (6 months revenue) and summary stats row","tags":["dashboard","chart","analytics","visualization"],"element_count":22,"components_used":["Stack","Text","Badge","Select","Button","ChartCard","Chart","Grid","StatCard","Separator","List"]},
  {"id":"chart-section-01","category":"dashboard","file":"dashboard/chart-section-01.json","description":"Chart Section block for dashboard","tags":["dashboard","chart","section"],"element_count":3,"components_used":["Grid","ChartCard"]},
  {"id":"dashboard-header-01","category":"dashboard","file":"dashboard/dashboard-header-01.json","description":"Dashboard Header block for dashboard","tags":["dashboard","dashboard","header"],"element_count":8,"components_used":["Stack","Text","DatePicker","Button"]},
  {"id":"data-table-01","category":"dashboard","file":"dashboard/data-table-01.json","description":"Data table with header bar (title + search + filter), 6 rows, and pagination","tags":["dashboard","table","data","pagination"],"element_count":11,"components_used":["Stack","Search","Select","ButtonGroup","Button","DataTable","Pagination"]},
  {"id":"header-01","category":"dashboard","file":"dashboard/header-01.json","description":"Header block for dashboard","tags":["dashboard","header"],"element_count":28,"components_used":["Stack","Navbar","Avatar","Text","Search","Button","Badge","Separator","Breadcrumbs","Tabs"]},
  {"id":"kanban-board-01","category":"dashboard","file":"dashboard/kanban-board-01.json","description":"Kanban Board block for dashboard","tags":["dashboard","kanban","board"],"element_count":20,"components_used":["Grid","Stack","Text","Badge","Card"]},
  {"id":"notification-panel-01","category":"dashboard","file":"dashboard/notification-panel-01.json","description":"Notification Panel block for dashboard","tags":["dashboard","notification","panel"],"element_count":8,"components_used":["Stack","Text","Badge","Button","List"]},
  {"id":"sidebar-layout-01","category":"dashboard","file":"dashboard/sidebar-layout-01.json","description":"Sidebar Layout block for dashboard","tags":["dashboard","sidebar","layout"],"element_count":31,"components_used":["Stack","Sidebar","Text","Search","Button","Avatar","Grid","StatCard","Separator","ButtonGroup","DataTable","Card","List"]},
  {"id":"stats-cards-row-01","category":"dashboard","file":"dashboard/stats-cards-row-01.json","description":"Stats Cards Row block for dashboard","tags":["dashboard","stats","cards","row"],"element_count":5,"components_used":["Grid","StatCard"]},
  {"id":"stats-row-01","category":"dashboard","file":"dashboard/stats-row-01.json","description":"4-column KPI stat cards row (Revenue, Users, Conversion, Avg Order) with trends","tags":["dashboard","stats","kpi","metrics"],"element_count":5,"components_used":["Grid","StatCard"]},
  {"id":"stats-row-01","category":"dashboard","file":"stats/stats-row-01.json","description":"4-column KPI stat cards row (Revenue, Users, Conversion, Avg Order) with trends","tags":["dashboard","stats","kpi","metrics"],"element_count":16,"components_used":["Stack","Text","Separator"]},
  {"id":"empty-state-01","category":"data-display","file":"dashboard/empty-state-01.json","description":"Centered empty state with icon, title, message, and action button","tags":["empty","placeholder","no-data","cta"],"element_count":6,"components_used":["Surface","Stack","EmptyState","Button"]},
  {"id":"empty-state-01","category":"data-display","file":"data-display/empty-state-01.json","description":"Centered empty state with icon, title, message, and action button","tags":["empty","placeholder","no-data","cta"],"element_count":3,"components_used":["Stack","EmptyState","Button"]},
  {"id":"notification-center-01","category":"data-display","file":"data-display/notification-center-01.json","description":"Notification list with header, mark-all-read button, and 6 notification items","tags":["notifications","list","alerts","inbox"],"element_count":5,"components_used":["Stack","Text","Button","List"]},
  {"id":"profile-01","category":"data-display","file":"data-display/profile-01.json","description":"Profile page with avatar header, 3 stat cards, tabbed content, activity list","tags":["profile","user","stats","tabs","activity"],"element_count":13,"components_used":["Stack","Avatar","Text","Button","StatCard","Tabs","List"]},
  {"id":"category-grid-01","category":"ecommerce","file":"ecommerce/category-grid-01.json","description":"Category Grid block for ecommerce","tags":["ecommerce","category","grid"],"element_count":29,"components_used":["Stack","Text","Grid","Card","Image","Badge"]},
  {"id":"checkout-form-01","category":"ecommerce","file":"ecommerce/checkout-form-01.json","description":"Checkout Form block for ecommerce","tags":["ecommerce","checkout","form"],"element_count":44,"components_used":["Stack","Text","Stepper","Field","Input","email","Select","Separator","Checkbox","Surface","List","Button"]},
  {"id":"order-summary-01","category":"ecommerce","file":"ecommerce/order-summary-01.json","description":"Order summary card with line items, subtotal/shipping/tax/total, promo code, checkout","tags":["ecommerce","order","cart","summary","checkout"],"element_count":51,"components_used":["Stack","Badge","Text","Grid","Surface","Separator","DataTable","Button"]},
  {"id":"product-card-01","category":"ecommerce","file":"ecommerce/product-card-01.json","description":"Product Card block for ecommerce","tags":["ecommerce","product","card"],"element_count":23,"components_used":["Card","Stack","AspectRatio","Image","Badge","Text","ToggleGroup","Toggle","Button"]},
  {"id":"product-carousel-01","category":"ecommerce","file":"ecommerce/product-carousel-01.json","description":"Product Carousel block for ecommerce","tags":["ecommerce","product","carousel"],"element_count":30,"components_used":["Stack","Text","ButtonGroup","Button","Carousel","Card","Image","Badge","Pagination"]},
  {"id":"product-detail-01","category":"ecommerce","file":"ecommerce/product-detail-01.json","description":"Product Detail block for ecommerce","tags":["ecommerce","product","detail"],"element_count":35,"components_used":["Stack","AspectRatio","Image","Breadcrumbs","Text","Button","Badge","Separator","ToggleGroup","Toggle","Select","Alert","List"]},
  {"id":"product-grid-01","category":"ecommerce","file":"ecommerce/product-grid-01.json","description":"Product listing with filter chips and 3-column grid of 6 product cards","tags":["ecommerce","products","grid","cards","shopping"],"element_count":22,"components_used":["Stack","Text","Select","Chip","Grid","Card","Button"]},
  {"id":"shopping-cart-01","category":"ecommerce","file":"ecommerce/shopping-cart-01.json","description":"Shopping Cart block for ecommerce","tags":["ecommerce","shopping","cart"],"element_count":56,"components_used":["Stack","Text","Badge","Image","Select","Button","Separator","Surface","Input"]},
  {"id":"wishlist-01","category":"ecommerce","file":"ecommerce/wishlist-01.json","description":"Wishlist block for ecommerce","tags":["ecommerce","wishlist"],"element_count":39,"components_used":["Stack","Text","Badge","Button","Grid","Card","Image","Alert"]},
  {"id":"404-page-01","category":"error-pages","file":"error-pages/404-page-01.json","description":"404 Page block for error-pages","tags":["error-pages","404","page"],"element_count":16,"components_used":["Stack","Image","Text","Search","Button","ButtonGroup"]},
  {"id":"500-page-01","category":"error-pages","file":"error-pages/500-page-01.json","description":"500 Page block for error-pages","tags":["error-pages","500","page"],"element_count":15,"components_used":["Stack","Image","Text","Surface","ButtonGroup","Button","Alert"]},
  {"id":"coming-soon-01","category":"error-pages","file":"error-pages/coming-soon-01.json","description":"Coming Soon block for error-pages","tags":["error-pages","coming","soon"],"element_count":27,"components_used":["Stack","Badge","Text","Progress","Chip","Surface","email","Button","Grid","Card"]},
  {"id":"maintenance-page-01","category":"error-pages","file":"error-pages/maintenance-page-01.json","description":"Maintenance Page block for error-pages","tags":["error-pages","maintenance","page"],"element_count":26,"components_used":["Stack","Image","Text","Separator","Progress","email","Button"]},
  {"id":"event-countdown-01","category":"event-schedule","file":"event-schedule/event-countdown-01.json","description":"Event Countdown block for event-schedule","tags":["event-schedule","event","countdown"],"element_count":28,"components_used":["Surface","Stack","Badge","Text","Chip","ButtonGroup","Button"]},
  {"id":"schedule-tabs-01","category":"event-schedule","file":"event-schedule/schedule-tabs-01.json","description":"Schedule Tabs block for event-schedule","tags":["event-schedule","schedule","tabs"],"element_count":7,"components_used":["Stack","Text","Tabs","List"]},
  {"id":"speaker-grid-01","category":"event-schedule","file":"event-schedule/speaker-grid-01.json","description":"Speaker Grid block for event-schedule","tags":["event-schedule","speaker","grid"],"element_count":41,"components_used":["Stack","Text","Grid","Card","Image","Chip"]},
  {"id":"faq-accordion-01","category":"faq","file":"faq/faq-accordion-01.json","description":"Faq Accordion block for faq","tags":["faq","faq","accordion"],"element_count":4,"components_used":["Stack","Text","Accordion"]},
  {"id":"faq-grid-01","category":"faq","file":"faq/faq-grid-01.json","description":"Faq Grid block for faq","tags":["faq","faq","grid"],"element_count":10,"components_used":["Stack","Text","Grid","Card"]},
  {"id":"faq-simple-01","category":"faq","file":"faq/faq-simple-01.json","description":"Faq Simple block for faq","tags":["faq","faq","simple"],"element_count":22,"components_used":["Stack","Text","Separator"]},
  {"id":"faq-with-sidebar-01","category":"faq","file":"faq/faq-with-sidebar-01.json","description":"Faq With Sidebar block for faq","tags":["faq","faq","with","sidebar"],"element_count":13,"components_used":["Stack","Text","Grid","NavMenu","Accordion","Surface","Button"]},
  {"id":"feature-alternating-01","category":"features","file":"features/feature-alternating-01.json","description":"Feature Alternating block for features","tags":["features","feature","alternating"],"element_count":25,"components_used":["Stack","Text","Image","Chip","Button"]},
  {"id":"feature-bento-01","category":"features","file":"features/feature-bento-01.json","description":"Feature Bento block for features","tags":["features","feature","bento"],"element_count":33,"components_used":["Stack","Chip","Text","Grid","Surface","Image"]},
  {"id":"feature-centered-01","category":"features","file":"features/feature-centered-01.json","description":"Feature Centered block for features","tags":["features","feature","centered"],"element_count":17,"components_used":["Stack","Badge","Text","Image","Separator"]},
  {"id":"feature-comparison-01","category":"features","file":"features/feature-comparison-01.json","description":"Feature Comparison block for features","tags":["features","feature","comparison"],"element_count":20,"components_used":["Stack","Text","Grid","Surface","Separator","List","Badge"]},
  {"id":"feature-grid-01","category":"features","file":"features/feature-grid-01.json","description":"Feature Grid block for features","tags":["features","feature","grid"],"element_count":18,"components_used":["Stack","Badge","Text","Grid","Card"]},
  {"id":"feature-icon-grid-01","category":"features","file":"features/feature-icon-grid-01.json","description":"Feature Icon Grid block for features","tags":["features","feature","icon","grid"],"element_count":41,"components_used":["Stack","Text","Grid"]},
  {"id":"feature-list-01","category":"features","file":"features/feature-list-01.json","description":"Feature List block for features","tags":["features","feature","list"],"element_count":34,"components_used":["Stack","Text","Separator"]},
  {"id":"feature-tabs-01","category":"features","file":"features/feature-tabs-01.json","description":"Feature Tabs block for features","tags":["features","feature","tabs"],"element_count":29,"components_used":["Stack","Text","Tabs","List","Image"]},
  {"id":"feature-with-code-01","category":"features","file":"features/feature-with-code-01.json","description":"Feature With Code block for features","tags":["features","feature","with","code"],"element_count":23,"components_used":["Stack","Badge","Text","Separator","Surface","CustomHTML","Button"]},
  {"id":"footer-columns-01","category":"footer","file":"footer/footer-columns-01.json","description":"Footer Columns block for footer","tags":["footer","footer","columns"],"element_count":23,"components_used":["Stack","Separator","Grid","Text","NavMenu","ButtonGroup","Button"]},
  {"id":"footer-mega-01","category":"footer","file":"footer/footer-mega-01.json","description":"Footer Mega block for footer","tags":["footer","footer","mega"],"element_count":33,"components_used":["Stack","Separator","Grid","Text","NavMenu","Surface","Input","Button","ButtonGroup"]},
  {"id":"footer-minimal-01","category":"footer","file":"footer/footer-minimal-01.json","description":"Footer Minimal block for footer","tags":["footer","footer","minimal"],"element_count":5,"components_used":["Stack","Separator","Text","NavMenu"]},
  {"id":"footer-simple-01","category":"footer","file":"footer/footer-simple-01.json","description":"Footer Simple block for footer","tags":["footer","footer","simple"],"element_count":9,"components_used":["Stack","Separator","Text","NavMenu","ButtonGroup","Button"]},
  {"id":"footer-with-cta-01","category":"footer","file":"footer/footer-with-cta-01.json","description":"Footer With Cta block for footer","tags":["footer","footer","with","cta"],"element_count":30,"components_used":["Stack","Surface","Text","ButtonGroup","Button","Separator","Grid","NavMenu"]},
  {"id":"checkout-01","category":"forms","file":"forms/checkout-01.json","description":"Checkout block for forms","tags":["forms","checkout"],"element_count":35,"components_used":["Stack","Text","Grid","Field","Select","Card","Separator","Button"]},
  {"id":"contact-01","category":"forms","file":"forms/contact-01.json","description":"Contact block for forms","tags":["forms","contact"],"element_count":13,"components_used":["Stack","Text","Field","Select","Label","Textarea","Button"]},
  {"id":"file-upload-01","category":"forms","file":"forms/file-upload-01.json","description":"File Upload block for forms","tags":["forms","file","upload"],"element_count":29,"components_used":["Stack","Text","Surface","Button","Badge","Progress"]},
  {"id":"form-inline-01","category":"forms","file":"forms/form-inline-01.json","description":"Form Inline block for forms","tags":["forms","form","inline"],"element_count":11,"components_used":["Stack","Field","Search","Select","Button"]},
  {"id":"form-multi-step-01","category":"forms","file":"forms/form-multi-step-01.json","description":"Form Multi Step block for forms","tags":["forms","form","multi","step"],"element_count":18,"components_used":["Stack","Stepper","Surface","Text","Field","Input","Checkbox","Button"]},
  {"id":"form-stacked-01","category":"forms","file":"forms/form-stacked-01.json","description":"Form Stacked block for forms","tags":["forms","form","stacked"],"element_count":33,"components_used":["Stack","Text","Grid","Field","Input","Separator","Select","Textarea","Button"]},
  {"id":"form-with-sidebar-01","category":"forms","file":"forms/form-with-sidebar-01.json","description":"Form With Sidebar block for forms","tags":["forms","form","with","sidebar"],"element_count":20,"components_used":["Grid","Stack","Text","Field","Input","Textarea","Select","RadioGroup","DatePicker","Button","Separator","List","Alert"]},
  {"id":"login-01","category":"forms","file":"forms/login-01.json","description":"Login block for forms","tags":["forms","login"],"element_count":18,"components_used":["Stack","Card","Text","Field","Checkbox","Button","Separator"]},
  {"id":"search-bar-01","category":"forms","file":"forms/search-bar-01.json","description":"Search Bar block for forms","tags":["forms","search","bar"],"element_count":13,"components_used":["Stack","Search","Button","Chip","Surface","List"]},
  {"id":"settings-01","category":"forms","file":"forms/settings-01.json","description":"Settings block for forms","tags":["forms","settings"],"element_count":23,"components_used":["Stack","Text","Field","Label","Textarea","Separator","Switch","Button"]},
  {"id":"settings-form-01","category":"forms","file":"forms/settings-form-01.json","description":"Settings Form block for forms","tags":["forms","settings","form"],"element_count":24,"components_used":["Stack","Text","Switch","Select","Separator","ToggleGroup","Button"]},
  {"id":"signup-01","category":"forms","file":"forms/signup-01.json","description":"Signup block for forms","tags":["forms","signup"],"element_count":16,"components_used":["Stack","Card","Text","Grid","Field","Checkbox","Button"]},
  {"id":"hero-centered-01","category":"hero","file":"hero/hero-centered-01.json","description":"Hero Centered block for hero","tags":["hero","hero","centered"],"element_count":14,"components_used":["Stack","Badge","Text","Button","AvatarGroup","Avatar"]},
  {"id":"hero-fullscreen-01","category":"hero","file":"hero/hero-fullscreen-01.json","description":"Hero Fullscreen block for hero","tags":["hero","hero","fullscreen"],"element_count":10,"components_used":["Stack","Avatar","Text","Button"]},
  {"id":"hero-minimal-01","category":"hero","file":"hero/hero-minimal-01.json","description":"Hero Minimal block for hero","tags":["hero","hero","minimal"],"element_count":7,"components_used":["Stack","Text","Separator","Button"]},
  {"id":"hero-split-01","category":"hero","file":"hero/hero-split-01.json","description":"Hero Split block for hero","tags":["hero","hero","split"],"element_count":20,"components_used":["Grid","Stack","Chip","Text","Badge","Button","Surface","Image"]},
  {"id":"hero-video-background-01","category":"hero","file":"hero/hero-video-background-01.json","description":"Hero Video Background block for hero","tags":["hero","hero","video","background"],"element_count":9,"components_used":["Stack","CustomHTML","Text","Button"]},
  {"id":"hero-with-app-screenshot-01","category":"hero","file":"hero/hero-with-app-screenshot-01.json","description":"Hero With App Screenshot block for hero","tags":["hero","hero","with","app","screenshot"],"element_count":16,"components_used":["Stack","Text","Button","Surface","Image"]},
  {"id":"hero-with-form-01","category":"hero","file":"hero/hero-with-form-01.json","description":"Hero With Form block for hero","tags":["hero","hero","with","form"],"element_count":13,"components_used":["Grid","Stack","Text","List","Card","Field","email","Select","Button"]},
  {"id":"hero-with-stats-01","category":"hero","file":"hero/hero-with-stats-01.json","description":"Hero With Stats block for hero","tags":["hero","hero","with","stats"],"element_count":13,"components_used":["Stack","Badge","Text","Button","Grid","StatCard"]},
  {"id":"process-alternating-01","category":"how-it-works","file":"how-it-works/process-alternating-01.json","description":"Process Alternating block for how-it-works","tags":["how-it-works","process","alternating"],"element_count":23,"components_used":["Stack","Text","Grid","Chip","Image","Button"]},
  {"id":"steps-horizontal-01","category":"how-it-works","file":"how-it-works/steps-horizontal-01.json","description":"Steps Horizontal block for how-it-works","tags":["how-it-works","steps","horizontal"],"element_count":21,"components_used":["Stack","Text","Stepper","Grid","Surface","Avatar"]},
  {"id":"steps-vertical-01","category":"how-it-works","file":"how-it-works/steps-vertical-01.json","description":"Steps Vertical block for how-it-works","tags":["how-it-works","steps","vertical"],"element_count":29,"components_used":["Stack","Text","Avatar","Chip","Button"]},
  {"id":"api-reference-01","category":"integrations","file":"integrations/api-reference-01.json","description":"Api Reference block for integrations","tags":["integrations","api","reference"],"element_count":37,"components_used":["Stack","Text","Surface","Badge","Chip","Separator","Button"]},
  {"id":"integration-grid-01","category":"integrations","file":"integrations/integration-grid-01.json","description":"Integration Grid block for integrations","tags":["integrations","integration","grid"],"element_count":55,"components_used":["Stack","Text","Grid","Surface","Avatar","Button"]},
  {"id":"integration-showcase-01","category":"integrations","file":"integrations/integration-showcase-01.json","description":"Integration Showcase block for integrations","tags":["integrations","integration","showcase"],"element_count":24,"components_used":["Stack","Badge","Text","Grid","Surface","Image","List","Separator","ButtonGroup","Button"]},
  {"id":"features-grid-01","category":"landing","file":"landing/features-grid-01.json","description":"6-item feature grid with icons, titles, and descriptions in 3 columns","tags":["landing","features","grid","marketing"],"element_count":10,"components_used":["Stack","Text","Grid","Card"]},
  {"id":"footer-01","category":"landing","file":"landing/footer-01.json","description":"4-column link footer (Product/Company/Resources/Legal) with copyright","tags":["landing","footer","navigation"],"element_count":22,"components_used":["Stack","Grid","Text","NavMenu","Separator","Button"]},
  {"id":"hero-01","category":"landing","file":"landing/hero-01.json","description":"Centered hero with heading, subheading, CTA button, and decorative image","tags":["landing","hero","cta","marketing"],"element_count":20,"components_used":["Stack","Badge","Text","Button","Image","Grid","StatCard"]},
  {"id":"pricing-01","category":"landing","file":"landing/pricing-01.json","description":"3-tier pricing cards (Free/Pro/Enterprise) with features and CTA buttons","tags":["landing","pricing","cards","marketing"],"element_count":34,"components_used":["Stack","Text","Grid","Surface","Separator","Button","Badge"]},
  {"id":"testimonials-01","category":"landing","file":"landing/testimonials-01.json","description":"3 testimonial cards with quotes, avatars, names, and roles","tags":["landing","testimonials","social-proof"],"element_count":31,"components_used":["Stack","Text","Grid","Surface","Separator","Avatar"]},
  {"id":"logo-cloud-scrolling-01","category":"logo-bar","file":"logo-bar/logo-cloud-scrolling-01.json","description":"Logo Cloud Scrolling block for logo-bar","tags":["logo-bar","logo","cloud","scrolling"],"element_count":16,"components_used":["Stack","Text","ScrollArea"]},
  {"id":"logo-cloud-simple-01","category":"logo-bar","file":"logo-bar/logo-cloud-simple-01.json","description":"Logo Cloud Simple block for logo-bar","tags":["logo-bar","logo","cloud","simple"],"element_count":23,"components_used":["Stack","Text","Grid","Surface"]},
  {"id":"logo-cloud-with-heading-01","category":"logo-bar","file":"logo-bar/logo-cloud-with-heading-01.json","description":"Logo Cloud With Heading block for logo-bar","tags":["logo-bar","logo","cloud","with","heading"],"element_count":23,"components_used":["Stack","Badge","Text","Separator","Grid","Surface"]},
  {"id":"gallery-carousel-01","category":"media","file":"media/gallery-carousel-01.json","description":"Gallery Carousel block for media","tags":["media","gallery","carousel"],"element_count":29,"components_used":["Stack","Text","Carousel","AspectRatio","Image"]},
  {"id":"gallery-grid-01","category":"media","file":"media/gallery-grid-01.json","description":"Gallery Grid block for media","tags":["media","gallery","grid"],"element_count":17,"components_used":["Stack","Text","Grid","AspectRatio","Image"]},
  {"id":"media-with-text-01","category":"media","file":"media/media-with-text-01.json","description":"Media With Text block for media","tags":["media","media","with","text"],"element_count":23,"components_used":["Grid","Surface","AspectRatio","Image","Stack","Badge","Text","Separator","ButtonGroup","Button"]},
  {"id":"video-section-01","category":"media","file":"media/video-section-01.json","description":"Video Section block for media","tags":["media","video","section"],"element_count":20,"components_used":["Stack","Text","Grid","Surface","AspectRatio","Image","Button","Chip"]},
  {"id":"back-to-top-01","category":"misc","file":"misc/back-to-top-01.json","description":"Back To Top block for misc","tags":["misc","back","to","top"],"element_count":2,"components_used":["Stack","Button"]},
  {"id":"divider-01","category":"misc","file":"misc/divider-01.json","description":"Divider block for misc","tags":["misc","divider"],"element_count":4,"components_used":["Stack","Separator","Text"]},
  {"id":"language-switcher-01","category":"misc","file":"misc/language-switcher-01.json","description":"Language Switcher block for misc","tags":["misc","language","switcher"],"element_count":3,"components_used":["Stack","Text","Select"]},
  {"id":"scroll-indicator-01","category":"misc","file":"misc/scroll-indicator-01.json","description":"Scroll Indicator block for misc","tags":["misc","scroll","indicator"],"element_count":2,"components_used":["Stack","Progress"]},
  {"id":"skip-link-01","category":"misc","file":"misc/skip-link-01.json","description":"Skip Link block for misc","tags":["misc","skip","link"],"element_count":2,"components_used":["Stack","Button"]},
  {"id":"social-links-01","category":"misc","file":"misc/social-links-01.json","description":"Social Links block for misc","tags":["misc","social","links"],"element_count":9,"components_used":["Stack","Text","ButtonGroup","Button"]},
  {"id":"table-of-contents-01","category":"misc","file":"misc/table-of-contents-01.json","description":"Table Of Contents block for misc","tags":["misc","table","of","contents"],"element_count":3,"components_used":["Stack","Text","NavMenu"]},
  {"id":"theme-toggle-01","category":"misc","file":"misc/theme-toggle-01.json","description":"Theme Toggle block for misc","tags":["misc","theme","toggle"],"element_count":4,"components_used":["Stack","Text","Toggle"]},
  {"id":"app-shell-01","category":"mobile","file":"mobile/app-shell-01.json","description":"Mobile layout with top navbar, content area, and bottom navigation (5 tabs)","tags":["mobile","app","navigation","bottom-nav","shell"],"element_count":28,"components_used":["Stack","Navbar","Avatar","Text","Grid","Button","StatCard","Separator","Chip","List","BottomNav"]},
  {"id":"command-palette-01","category":"modals-overlays","file":"modals-overlays/command-palette-01.json","description":"Command Palette block for modals-overlays","tags":["modals-overlays","command","palette"],"element_count":1,"components_used":["CommandPalette"]},
  {"id":"cookie-consent-01","category":"modals-overlays","file":"modals-overlays/cookie-consent-01.json","description":"Cookie Consent block for modals-overlays","tags":["modals-overlays","cookie","consent"],"element_count":9,"components_used":["Surface","Stack","Text","Button"]},
  {"id":"drawer-01","category":"modals-overlays","file":"modals-overlays/drawer-01.json","description":"Drawer block for modals-overlays","tags":["modals-overlays","drawer"],"element_count":17,"components_used":["Drawer","Stack","Text","Field","Input","Select","Checkbox","Button"]},
  {"id":"lightbox-01","category":"modals-overlays","file":"modals-overlays/lightbox-01.json","description":"Lightbox block for modals-overlays","tags":["modals-overlays","lightbox"],"element_count":15,"components_used":["Modal","Stack","AspectRatio","Image","Button","Text"]},
  {"id":"modal-confirm-01","category":"modals-overlays","file":"modals-overlays/modal-confirm-01.json","description":"Modal Confirm block for modals-overlays","tags":["modals-overlays","modal","confirm"],"element_count":6,"components_used":["AlertDialog","Surface","List","Stack","Button"]},
  {"id":"modal-dialog-01","category":"modals-overlays","file":"modals-overlays/modal-dialog-01.json","description":"Modal Dialog block for modals-overlays","tags":["modals-overlays","modal","dialog"],"element_count":19,"components_used":["Modal","Stack","Avatar","Button","Field","Input","Textarea","Grid","DatePicker"]},
  {"id":"toast-notification-01","category":"modals-overlays","file":"modals-overlays/toast-notification-01.json","description":"Toast Notification block for modals-overlays","tags":["modals-overlays","toast","notification"],"element_count":5,"components_used":["Stack","Alert"]},
  {"id":"bottom-nav-01","category":"navigation","file":"navigation/bottom-nav-01.json","description":"Bottom Nav block for navigation","tags":["navigation","bottom","nav"],"element_count":1,"components_used":["BottomNav"]},
  {"id":"breadcrumbs-01","category":"navigation","file":"navigation/breadcrumbs-01.json","description":"Breadcrumbs block for navigation","tags":["navigation","breadcrumbs"],"element_count":3,"components_used":["Stack","Breadcrumbs","Text"]},
  {"id":"navbar-mega-menu-01","category":"navigation","file":"navigation/navbar-mega-menu-01.json","description":"Navbar Mega Menu block for navigation","tags":["navigation","navbar","mega","menu"],"element_count":21,"components_used":["Navbar","Stack","Button","Surface","Grid","Text"]},
  {"id":"navbar-mobile-drawer-01","category":"navigation","file":"navigation/navbar-mobile-drawer-01.json","description":"Navbar Mobile Drawer block for navigation","tags":["navigation","navbar","mobile","drawer"],"element_count":12,"components_used":["Stack","Navbar","Button","Sheet","Text","Separator","NavMenu"]},
  {"id":"navbar-simple-01","category":"navigation","file":"navigation/navbar-simple-01.json","description":"Navbar Simple block for navigation","tags":["navigation","navbar","simple"],"element_count":2,"components_used":["Navbar","Button"]},
  {"id":"navbar-with-auth-01","category":"navigation","file":"navigation/navbar-with-auth-01.json","description":"Navbar With Auth block for navigation","tags":["navigation","navbar","with","auth"],"element_count":4,"components_used":["Navbar","Stack","Button"]},
  {"id":"navbar-with-search-01","category":"navigation","file":"navigation/navbar-with-search-01.json","description":"Navbar With Search block for navigation","tags":["navigation","navbar","with","search"],"element_count":5,"components_used":["Navbar","Stack","Search","Button","Avatar"]},
  {"id":"pagination-01","category":"navigation","file":"navigation/pagination-01.json","description":"Pagination block for navigation","tags":["navigation","pagination"],"element_count":5,"components_used":["Stack","Text","Select","Pagination"]},
  {"id":"sidebar-nav-01","category":"navigation","file":"navigation/sidebar-nav-01.json","description":"Sidebar Nav block for navigation","tags":["navigation","sidebar","nav"],"element_count":1,"components_used":["Sidebar"]},
  {"id":"tab-nav-01","category":"navigation","file":"navigation/tab-nav-01.json","description":"Tab Nav block for navigation","tags":["navigation","tab","nav"],"element_count":18,"components_used":["Stack","Text","Button","Tabs","Field","email","Select","password","Switch"]},
  {"id":"topbar-announcement-01","category":"navigation","file":"navigation/topbar-announcement-01.json","description":"Topbar Announcement block for navigation","tags":["navigation","topbar","announcement"],"element_count":5,"components_used":["Surface","Stack","Badge","Text","Button"]},
  {"id":"newsletter-card-01","category":"newsletter","file":"newsletter/newsletter-card-01.json","description":"Newsletter Card block for newsletter","tags":["newsletter","newsletter","card"],"element_count":12,"components_used":["Card","Stack","Badge","Field","email","Input","Button","Text"]},
  {"id":"newsletter-footer-01","category":"newsletter","file":"newsletter/newsletter-footer-01.json","description":"Newsletter Footer block for newsletter","tags":["newsletter","newsletter","footer"],"element_count":15,"components_used":["Surface","Stack","Text","Button","InputGroup","email"]},
  {"id":"newsletter-inline-01","category":"newsletter","file":"newsletter/newsletter-inline-01.json","description":"Newsletter Inline block for newsletter","tags":["newsletter","newsletter","inline"],"element_count":7,"components_used":["Stack","Text","InputGroup","email","Button"]},
  {"id":"newsletter-popup-01","category":"newsletter","file":"newsletter/newsletter-popup-01.json","description":"Newsletter Popup block for newsletter","tags":["newsletter","newsletter","popup"],"element_count":10,"components_used":["Modal","Stack","Text","email","Button"]},
  {"id":"portfolio-carousel-01","category":"portfolio","file":"portfolio/portfolio-carousel-01.json","description":"Portfolio Carousel block for portfolio","tags":["portfolio","portfolio","carousel"],"element_count":42,"components_used":["Stack","Text","ButtonGroup","Button","Carousel","Surface","Image","Chip","Pagination"]},
  {"id":"portfolio-case-study-01","category":"portfolio","file":"portfolio/portfolio-case-study-01.json","description":"Portfolio Case Study block for portfolio","tags":["portfolio","portfolio","case","study"],"element_count":33,"components_used":["Stack","Breadcrumbs","Badge","Text","Image","Grid","StatCard","Prose","List","Surface","Avatar","Button"]},
  {"id":"portfolio-grid-01","category":"portfolio","file":"portfolio/portfolio-grid-01.json","description":"Portfolio Grid block for portfolio","tags":["portfolio","portfolio","grid"],"element_count":53,"components_used":["Stack","Text","ToggleGroup","Grid","Card","Image","Chip"]},
  {"id":"pricing-calculator-01","category":"pricing","file":"pricing/pricing-calculator-01.json","description":"Pricing Calculator block for pricing","tags":["pricing","pricing","calculator"],"element_count":36,"components_used":["Stack","Text","Surface","Slider","Separator","Button"]},
  {"id":"pricing-comparison-table-01","category":"pricing","file":"pricing/pricing-comparison-table-01.json","description":"Pricing Comparison Table block for pricing","tags":["pricing","pricing","comparison","table"],"element_count":8,"components_used":["Stack","Text","DataTable","Button"]},
  {"id":"pricing-faq-01","category":"pricing","file":"pricing/pricing-faq-01.json","description":"Pricing Faq block for pricing","tags":["pricing","pricing","faq"],"element_count":10,"components_used":["Stack","Text","Accordion","ButtonGroup","Button"]},
  {"id":"pricing-single-01","category":"pricing","file":"pricing/pricing-single-01.json","description":"Pricing Single block for pricing","tags":["pricing","pricing","single"],"element_count":23,"components_used":["Stack","Surface","Text","Badge","Separator","Grid","Button"]},
  {"id":"pricing-tiers-01","category":"pricing","file":"pricing/pricing-tiers-01.json","description":"Pricing Tiers block for pricing","tags":["pricing","pricing","tiers"],"element_count":35,"components_used":["Stack","Text","Grid","Surface","Button","Separator","List","Badge"]},
  {"id":"pricing-toggle-01","category":"pricing","file":"pricing/pricing-toggle-01.json","description":"Pricing Toggle block for pricing","tags":["pricing","pricing","toggle"],"element_count":38,"components_used":["Stack","Text","ToggleGroup","Grid","Surface","Button","Separator","List","Badge"]},
  {"id":"case-study-card-01","category":"social-proof","file":"social-proof/case-study-card-01.json","description":"Case Study Card block for social-proof","tags":["social-proof","case","study","card"],"element_count":25,"components_used":["Stack","Badge","Text","Surface","Grid","StatCard","Separator","Avatar"]},
  {"id":"press-mentions-01","category":"social-proof","file":"social-proof/press-mentions-01.json","description":"Press Mentions block for social-proof","tags":["social-proof","press","mentions"],"element_count":22,"components_used":["Stack","Text","Separator","Grid","Surface"]},
  {"id":"review-stars-01","category":"social-proof","file":"social-proof/review-stars-01.json","description":"Review Stars block for social-proof","tags":["social-proof","review","stars"],"element_count":42,"components_used":["Stack","Text","Progress","Separator"]},
  {"id":"social-proof-bar-01","category":"social-proof","file":"social-proof/social-proof-bar-01.json","description":"Social Proof Bar block for social-proof","tags":["social-proof","social","proof","bar"],"element_count":18,"components_used":["Surface","Stack","Text","Separator"]},
  {"id":"testimonial-carousel-01","category":"social-proof","file":"social-proof/testimonial-carousel-01.json","description":"Testimonial Carousel block for social-proof","tags":["social-proof","testimonial","carousel"],"element_count":33,"components_used":["Stack","Text","Carousel","Surface","Avatar","ButtonGroup","Button"]},
  {"id":"testimonial-grid-01","category":"social-proof","file":"social-proof/testimonial-grid-01.json","description":"Testimonial Grid block for social-proof","tags":["social-proof","testimonial","grid"],"element_count":30,"components_used":["Stack","Badge","Text","Grid","Surface","Avatar"]},
  {"id":"testimonial-single-01","category":"social-proof","file":"social-proof/testimonial-single-01.json","description":"Testimonial Single block for social-proof","tags":["social-proof","testimonial","single"],"element_count":10,"components_used":["Stack","Text","Separator","Avatar"]},
  {"id":"testimonial-wall-01","category":"social-proof","file":"social-proof/testimonial-wall-01.json","description":"Testimonial Wall block for social-proof","tags":["social-proof","testimonial","wall"],"element_count":39,"components_used":["Stack","Text","Grid","Surface","Avatar"]},
  {"id":"stats-counter-01","category":"stats","file":"stats/stats-counter-01.json","description":"Stats Counter block for stats","tags":["stats","stats","counter"],"element_count":17,"components_used":["Surface","Stack","Text","Grid"]},
  {"id":"stats-grid-01","category":"stats","file":"stats/stats-grid-01.json","description":"Stats Grid block for stats","tags":["stats","stats","grid"],"element_count":8,"components_used":["Stack","Text","Grid","StatCard"]},
  {"id":"stats-with-description-01","category":"stats","file":"stats/stats-with-description-01.json","description":"Stats With Description block for stats","tags":["stats","stats","with","description"],"element_count":27,"components_used":["Stack","Badge","Text","Button","Grid","Surface","Chip"]},
  {"id":"team-carousel-01","category":"team","file":"team/team-carousel-01.json","description":"Team Carousel block for team","tags":["team","team","carousel"],"element_count":37,"components_used":["Stack","Text","Carousel","Card","Avatar","Chip","ButtonGroup","Button"]},
  {"id":"team-featured-01","category":"team","file":"team/team-featured-01.json","description":"Team Featured block for team","tags":["team","team","featured"],"element_count":12,"components_used":["Surface","Stack","Image","Badge","Text","Prose","Button"]},
  {"id":"team-grid-01","category":"team","file":"team/team-grid-01.json","description":"Team Grid block for team","tags":["team","team","grid"],"element_count":34,"components_used":["Stack","Text","Grid","Card","Avatar"]},
  {"id":"team-list-01","category":"team","file":"team/team-list-01.json","description":"Team List block for team","tags":["team","team","list"],"element_count":31,"components_used":["Stack","Text","Avatar","Badge","Separator"]},
  {"id":"changelog-01","category":"timeline","file":"timeline/changelog-01.json","description":"Changelog block for timeline","tags":["timeline","changelog"],"element_count":37,"components_used":["Stack","Text","Badge","Prose","Separator"]},
  {"id":"roadmap-01","category":"timeline","file":"timeline/roadmap-01.json","description":"Roadmap block for timeline","tags":["timeline","roadmap"],"element_count":22,"components_used":["Stack","Text","Stepper","Grid","Surface","Badge","List","Progress"]},
  {"id":"timeline-horizontal-01","category":"timeline","file":"timeline/timeline-horizontal-01.json","description":"Timeline Horizontal block for timeline","tags":["timeline","timeline","horizontal"],"element_count":24,"components_used":["Stack","Text","ScrollArea","Card","Badge"]},
  {"id":"timeline-vertical-01","category":"timeline","file":"timeline/timeline-vertical-01.json","description":"Timeline Vertical block for timeline","tags":["timeline","timeline","vertical"],"element_count":4,"components_used":["Stack","Text","List"]},
];

// ---- MCP Tool Handlers ----

async function handleToolCall(name, args, env) {
  switch (name) {
    case 'generate_ui': {
      const apiKey = env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('Server misconfigured: missing OPENROUTER_API_KEY');
      const options = { theme: args.theme };
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
        themes: {
          light: ['light', 'bone', 'material-light', 'github', 'nord-light', 'solarized-light', 'catppuccin', 'gruvbox-light', 'paper', 'grunge-light'],
          dark: ['dark', 'material-dark', 'github-dark', 'nord', 'solarized-dark', 'catppuccin-dark', 'gruvbox-dark', 'dracula', 'grunge-dark', 'synthwave', 'tokyo-night'],
        },
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
      const spec = JSON.parse(args.spec);
      return JSON.stringify(validateSpec(spec), null, 2);
    }

    case 'render_spec': {
      const spec = JSON.parse(args.spec);
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
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  };

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
    const results = [];
    for (const req of body) {
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
