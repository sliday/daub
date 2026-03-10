#!/usr/bin/env node
/**
 * Block Generator — Generate DAUB block specs via OpenRouter
 *
 * Usage:
 *   OPENROUTER_API_KEY=... node tools/block-generate.js <category> <subcategory> [--variants N] [--start N] [--theme THEME] [--model MODEL]
 *
 * Examples:
 *   node tools/block-generate.js landing hero --variants 3
 *   node tools/block-generate.js dashboard analytics --variants 5 --theme github
 *   node tools/block-generate.js forms multi-step --start 2 --variants 1
 *
 * Reads the system prompt from mcp/lib/prompt.js and calls OpenRouter to generate specs.
 * Saves to blocks/{category}/{subcategory}-{nn}.json and updates blocks/index.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BLOCKS_DIR = path.join(ROOT, 'blocks');
const INDEX_PATH = path.join(BLOCKS_DIR, 'index.json');

// ---- CLI Args ----
const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const category = positional[0];
const subcategory = positional[1];

if (!category || !subcategory) {
  console.error('Usage: node tools/block-generate.js <category> <subcategory> [--variants N] [--start N] [--theme THEME] [--model MODEL]');
  console.error('\nCategories: landing, dashboard, forms, auth, ecommerce, data-display, mobile, navigation, feedback, settings');
  process.exit(1);
}

function getFlag(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const variants = parseInt(getFlag('variants', '1'));
const startNum = parseInt(getFlag('start', '1'));
const theme = getFlag('theme', '');
const modelOverride = getFlag('model', '');
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('Error: OPENROUTER_API_KEY env var required');
  process.exit(1);
}

// ---- Prompt Templates per Category ----
const PROMPT_TEMPLATES = {
  landing: {
    hero: 'Create a hero section for a {adj} {product} landing page with a bold headline, subtitle, {cta} CTA button, and a decorative image/illustration area',
    pricing: 'Create a pricing table with {tiers} tiers for a {product} service. Include feature lists, prices, and CTA buttons. Highlight the recommended plan',
    features: 'Create a features grid showcasing {count} key features of a {product} platform with icons, titles, and descriptions',
    testimonials: 'Create a testimonials section with {count} customer quotes for a {product} company, including avatars, names, roles, and star ratings',
    footer: 'Create a comprehensive footer for a {product} website with {cols} columns of links, social media icons, newsletter signup, and copyright',
    'cta-banner': 'Create a call-to-action banner for a {product} with a compelling headline, subtitle, and action button',
    logos: 'Create a trusted-by/partners logo strip showing {count} company names for a {product} landing page',
    faq: 'Create a FAQ section with {count} questions and answers about a {product} service using accordions',
    stats: 'Create a stats/metrics section showing {count} impressive numbers for a {product} company (users, revenue, uptime, etc)',
  },
  dashboard: {
    'sidebar-layout': 'Create a full dashboard layout for a {product} app with sidebar navigation, top header bar, and main content area',
    'stats-row': 'Create a row of {count} KPI stat cards for a {product} dashboard showing key metrics with trends',
    'data-table': 'Create a data table section for a {product} dashboard with search, filters, {rows} rows of data, and pagination',
    'chart-panel': 'Create a chart/analytics panel for a {product} dashboard with a bar chart and summary statistics',
    header: 'Create a dashboard header bar for a {product} app with brand logo, search, notifications, and user avatar',
    'activity-feed': 'Create an activity feed/timeline for a {product} dashboard showing recent events with timestamps and icons',
    kanban: 'Create a kanban board view for a {product} dashboard with {cols} columns and task cards',
    analytics: 'Create an analytics dashboard for a {product} platform with charts, metrics, date range selector, and data breakdown',
  },
  forms: {
    login: 'Create a {style} login form with email/password fields, remember me checkbox, forgot password link, and social login options',
    signup: 'Create a {style} registration form with name fields, email, password with strength indicator, terms checkbox, and submit button',
    settings: 'Create a settings/preferences form for a {product} app with profile info section, notification toggles, and danger zone',
    contact: 'Create a {style} contact form with name, email, subject dropdown, message textarea, and submit button',
    checkout: 'Create a checkout form for a {product} store with shipping details, payment info, and order summary',
    'multi-step': 'Create a multi-step form wizard for {product} with {steps} steps, progress indicator, and navigation buttons',
    'search-filter': 'Create an advanced search/filter panel for a {product} with text search, category filters, date range, and sort options',
    survey: 'Create a survey/questionnaire form for {product} with various input types: radio, checkbox, text, rating scale',
  },
  auth: {
    'auth-page': 'Create a split-screen authentication page for a {product} with branding panel on one side and {form} form on the other',
    'forgot-password': 'Create a forgot password flow page for a {product} with email input and reset instructions',
    'verify-email': 'Create an email verification page for a {product} with OTP input, resend button, and status message',
    'two-factor': 'Create a two-factor authentication page for a {product} with code input, backup codes option, and verify button',
    'onboarding-wizard': 'Create an onboarding wizard for a {product} with {steps} steps: welcome, profile setup, preferences, and completion',
  },
  ecommerce: {
    'product-grid': 'Create a product listing page for a {product} store with filter sidebar, {count} product cards in a grid, and sort options',
    'product-detail': 'Create a product detail page for a {product} store with image gallery, title, price, description, size selector, and add to cart',
    cart: 'Create a shopping cart page for a {product} store with {count} items, quantity controls, remove buttons, and checkout summary',
    'order-summary': 'Create an order summary/receipt for a {product} store with line items, subtotal, shipping, tax, total, and promo code input',
    wishlist: 'Create a wishlist page for a {product} store with {count} saved items, remove buttons, and add-to-cart actions',
    reviews: 'Create a product reviews section for a {product} store with overall rating, rating breakdown, and {count} individual reviews',
  },
  'data-display': {
    profile: 'Create a user profile page for a {product} platform with avatar, bio, stats, tabbed content, and activity list',
    'notification-center': 'Create a notification center for a {product} app with filter tabs, {count} notification items, and mark-all-read',
    'empty-state': 'Create an empty state page for a {product} feature with illustration placeholder, title, description, and action button',
    'file-browser': 'Create a file browser/manager for a {product} with breadcrumb path, grid/list toggle, file items with icons, and action buttons',
    timeline: 'Create a timeline/history view for a {product} showing {count} events with dates, descriptions, and status indicators',
    comparison: 'Create a comparison table for {count} {product} plans showing features with checkmarks and pricing',
  },
  mobile: {
    'app-shell': 'Create a mobile app shell for a {product} app with top navbar, scrollable content area, and {count}-tab bottom navigation',
    'bottom-sheet': 'Create a mobile bottom sheet for a {product} app with drag handle, title, and action items/options',
    'swipe-cards': 'Create a mobile swipe card interface for a {product} app with profile cards and action buttons',
    stories: 'Create a mobile stories/reel viewer for a {product} app with progress bar, content area, and navigation controls',
    'chat-bubble': 'Create a mobile chat interface for a {product} app with message bubbles, input bar, and attachment button',
    'media-feed': 'Create a mobile social media feed for a {product} app with {count} posts including images, captions, and engagement actions',
  },
  navigation: {
    'sidebar-nav': 'Create a collapsible sidebar navigation for a {product} app with sections, icons, active states, and user menu',
    'top-nav': 'Create a top navigation bar for a {product} website with logo, menu links, dropdown menus, and user actions',
    'breadcrumb-page': 'Create a page layout with breadcrumb navigation for a {product} app showing the current location in the hierarchy',
    'tab-layout': 'Create a tabbed content layout for a {product} with {count} tabs, each containing different content sections',
    'command-palette-page': 'Create a command palette/search overlay for a {product} app with categorized actions and keyboard shortcuts',
  },
  feedback: {
    'error-page': 'Create a {code} error page for a {product} with illustration, error message, helpful suggestions, and navigation buttons',
    'loading-skeleton': 'Create a loading skeleton screen for a {product} {page} page showing placeholder shapes that match the real content layout',
    'success-state': 'Create a success/completion page for a {product} after {action} with checkmark, congratulations message, and next steps',
    maintenance: 'Create a maintenance/downtime page for a {product} with status icon, expected return time, and contact info',
    '404': 'Create a creative 404 page for a {product} with illustration, message, search bar, and popular links',
  },
  settings: {
    account: 'Create an account settings page for a {product} with profile photo, personal info fields, email/password change, and save button',
    billing: 'Create a billing settings page for a {product} with current plan, usage stats, payment method, and invoice history',
    integrations: 'Create an integrations settings page for a {product} with {count} available integrations showing connected status and configure buttons',
    'team-members': 'Create a team management page for a {product} with member list, roles dropdown, invite button, and remove actions',
    'api-keys': 'Create an API keys management page for a {product} with key list, create/revoke actions, and usage stats',
    preferences: 'Create a preferences page for a {product} with appearance (theme toggle), language, timezone, notification settings',
  },
};

// Variation data for template interpolation
const VARIATION_DATA = {
  adj: ['modern', 'elegant', 'bold', 'minimal', 'vibrant', 'professional', 'sleek', 'innovative', 'clean', 'dynamic'],
  product: ['SaaS', 'analytics', 'project management', 'e-commerce', 'social media', 'fintech', 'health & fitness', 'education', 'CRM', 'developer tools', 'AI/ML', 'cloud storage', 'HR', 'marketing', 'design'],
  cta: ['Get Started', 'Try Free', 'Start Building', 'Sign Up', 'Learn More', 'Book Demo', 'Download Now', 'Join Waitlist'],
  style: ['clean and minimal', 'modern card-based', 'split-screen', 'centered with gradient background', 'with social proof'],
  tiers: ['3', '3', '4', '3'],
  count: ['4', '5', '6', '3', '8'],
  rows: ['6', '8', '5', '10'],
  cols: ['3', '4', '5', '3'],
  steps: ['3', '4', '5', '3'],
  form: ['login', 'signup', 'login', 'signup'],
  code: ['404', '500', '403', '503'],
  page: ['dashboard', 'profile', 'feed', 'settings', 'product listing'],
  action: ['signup', 'purchase', 'subscription', 'form submission', 'payment'],
};

function interpolateTemplate(template, variantIdx) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const options = VARIATION_DATA[key];
    if (!options) return key;
    return options[(variantIdx + Math.floor(Math.random() * options.length)) % options.length];
  });
}

// ---- Validation (lightweight, same as mcp.js) ----

const VALID_TYPES = new Set([
  'Stack', 'Grid', 'Surface', 'Text', 'Prose', 'Separator',
  'Button', 'ButtonGroup', 'Field', 'Input', 'InputGroup', 'InputIcon', 'Search', 'Textarea',
  'Checkbox', 'RadioGroup', 'Switch', 'Slider', 'Toggle', 'ToggleGroup', 'Select', 'CustomSelect',
  'Kbd', 'Label', 'Spinner', 'InputOTP',
  'Tabs', 'Breadcrumbs', 'Pagination', 'Stepper', 'NavMenu', 'Navbar', 'Menubar', 'Sidebar', 'BottomNav',
  'Card', 'Table', 'DataTable', 'List', 'Badge', 'Avatar', 'AvatarGroup', 'Calendar', 'Chart', 'Carousel',
  'AspectRatio', 'Chip', 'ScrollArea', 'Image',
  'Alert', 'Progress', 'Skeleton', 'EmptyState', 'Tooltip',
  'Modal', 'AlertDialog', 'Sheet', 'Drawer', 'Popover', 'HoverCard', 'DropdownMenu', 'ContextMenu', 'CommandPalette',
  'Accordion', 'Collapsible', 'Resizable', 'DatePicker',
  'StatCard', 'ChartCard', 'CustomHTML',
]);

function validateSpec(spec) {
  const issues = [];
  if (!spec || typeof spec !== 'object') return { valid: false, issues: ['Not an object'], element_count: 0 };
  if (!spec.elements || typeof spec.elements !== 'object') issues.push('Missing "elements"');
  if (!spec.root) issues.push('Missing "root"');
  if (spec.root && spec.elements && !spec.elements[spec.root]) issues.push(`Root "${spec.root}" not in elements`);
  const componentsUsed = new Set();
  if (spec.elements) {
    for (const [id, def] of Object.entries(spec.elements)) {
      if (!def.type) issues.push(`"${id}" missing type`);
      else {
        componentsUsed.add(def.type);
        if (!VALID_TYPES.has(def.type)) issues.push(`Unknown type "${def.type}"`);
      }
      for (const cid of (def.children || [])) {
        if (!spec.elements[cid]) issues.push(`"${id}" references missing child "${cid}"`);
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

function cleanJSON(raw) {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const idx = s.indexOf('{');
  if (idx > 0) s = s.slice(idx);
  const lastIdx = s.lastIndexOf('}');
  if (lastIdx >= 0 && lastIdx < s.length - 1) s = s.slice(0, lastIdx + 1);
  return s;
}

// ---- System Prompt (import from mcp/lib/prompt.js) ----

let buildSystemPrompt;
try {
  const promptModule = await import(path.join(ROOT, 'mcp', 'lib', 'prompt.js'));
  buildSystemPrompt = promptModule.buildSystemPrompt;
} catch {
  console.error('Warning: Could not import mcp/lib/prompt.js, using minimal prompt');
  buildSystemPrompt = () => 'You are a UI generator that outputs json-render flat specs using DAUB components. Return ONLY valid JSON.';
}

// ---- OpenRouter API ----

async function callOpenRouter(prompt, model) {
  const systemPrompt = buildSystemPrompt();
  let userContent = prompt
    + '\n\nIMPORTANT: Generate a COMPLETE, production-realistic UI with 25-50 elements. '
    + 'Fill tables with 5-8 rows of realistic data. Include full navigation, headers, and footers. '
    + 'Use real names, numbers, dates — no placeholders.';
  if (theme) userContent += `\n\nUse the "${theme}" theme.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daub.dev',
      'X-Title': 'DAUB Block Generator',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 32768,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

// ---- Index Management ----

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveIndex(index) {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
}

function addToIndex(index, entry) {
  const existing = index.findIndex(e => e.id === entry.id);
  if (existing >= 0) index[existing] = entry;
  else index.push(entry);
  return index;
}

// ---- Main ----

async function main() {
  const templates = PROMPT_TEMPLATES[category];
  if (!templates) {
    console.error(`Unknown category: ${category}`);
    console.error('Available:', Object.keys(PROMPT_TEMPLATES).join(', '));
    process.exit(1);
  }

  const template = templates[subcategory];
  if (!template) {
    console.error(`Unknown subcategory: ${subcategory} for category ${category}`);
    console.error('Available:', Object.keys(templates).join(', '));
    process.exit(1);
  }

  const model = modelOverride || 'google/gemini-3-flash-preview-20251217';
  const categoryDir = path.join(BLOCKS_DIR, category);
  fs.mkdirSync(categoryDir, { recursive: true });

  let index = loadIndex();
  let generated = 0;
  let failed = 0;

  for (let v = startNum; v < startNum + variants; v++) {
    const variantNum = String(v).padStart(2, '0');
    const blockId = `${subcategory}-${variantNum}`;
    const filePath = path.join(categoryDir, `${blockId}.json`);
    const relPath = `${category}/${blockId}.json`;

    if (fs.existsSync(filePath) && !args.includes('--force')) {
      console.log(`[skip] ${blockId} already exists (use --force to overwrite)`);
      continue;
    }

    const prompt = interpolateTemplate(template, v);
    console.log(`[${blockId}] Generating: ${prompt.slice(0, 80)}...`);

    try {
      const rawContent = await callOpenRouter(prompt, model);
      if (!rawContent) throw new Error('Empty response');

      let spec = JSON.parse(cleanJSON(rawContent));

      // Strip theme from block spec (blocks are theme-agnostic)
      delete spec.theme;

      spec = autoFixSpec(spec);
      const validation = validateSpec(spec);

      if (!validation.valid) {
        console.log(`  ! Validation issues: ${validation.issues.join(', ')}`);
        if (validation.element_count === 0) {
          console.log(`  x Skipping (no elements)`);
          failed++;
          continue;
        }
      }

      // Save spec
      fs.writeFileSync(filePath, JSON.stringify(spec, null, 2) + '\n');

      // Derive name and description from prompt
      const name = subcategory.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') + ` ${variantNum}`;
      const description = prompt.replace(/^Create (?:a |an )/, '').replace(/\s+/g, ' ').trim();

      // Extract tags from description
      const tagWords = new Set([category, subcategory, ...subcategory.split('-')]);
      const tagCandidates = ['dashboard', 'sidebar', 'header', 'footer', 'chart', 'table', 'form', 'card', 'grid', 'list', 'nav', 'auth', 'login', 'signup', 'profile', 'settings', 'pricing', 'hero', 'cta', 'mobile', 'stats', 'kpi', 'analytics', 'notification', 'ecommerce', 'product', 'cart', 'checkout', 'search', 'filter', 'modal', 'drawer', 'tabs', 'accordion', 'timeline', 'feed', 'chat', 'wizard', 'onboarding', 'error', '404', 'empty', 'skeleton', 'billing', 'team', 'api', 'integration'];
      const descLower = description.toLowerCase();
      for (const tag of tagCandidates) {
        if (descLower.includes(tag)) tagWords.add(tag);
      }

      const indexEntry = {
        id: blockId,
        name,
        category,
        subcategory,
        description,
        tags: [...tagWords],
        file: relPath,
        element_count: validation.element_count,
        components_used: validation.components_used,
      };

      index = addToIndex(index, indexEntry);
      generated++;

      console.log(`  + ${validation.element_count} elements, ${validation.components_used.length} types → ${relPath}`);
    } catch (e) {
      console.log(`  x Error: ${e.message}`);
      failed++;
    }

    // Small delay between API calls
    if (v < startNum + variants - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  saveIndex(index);
  console.log(`\nDone: ${generated} generated, ${failed} failed`);
  console.log(`Index: ${INDEX_PATH} (${index.length} total blocks)`);
}

main().catch(e => { console.error(e); process.exit(1); });
