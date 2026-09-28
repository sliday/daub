// Page archetypes, section slots and theme families for the instant assembler
// (functions/api/assemble.js). Data only: no onRequest* export, so Pages does not route it.
//
// A slot groups interchangeable blocks ("any hero", "any login screen"). Patterns match a
// block by category ("hero") or by category plus kind ("auth:login-*"), where kind is the
// block id without its "-NN" suffix. Recipes list slots in page order; `core` slots are the
// sections that make the page what it is.

export const SLOTS = {
  announcement: ['navigation:topbar-announcement', 'banners:banner-top'],
  nav: ['navigation:navbar-simple', 'navigation:navbar-with-auth', 'navigation:navbar-with-search',
    'navigation:navbar-mega-menu', 'navigation:navbar-mobile-drawer'],
  breadcrumbs: ['navigation:breadcrumbs'],
  'app-header': ['dashboard:dashboard-header', 'dashboard:header'],
  hero: ['hero', 'landing:hero'],
  logos: ['logo-bar', 'social-proof:social-proof-bar', 'social-proof:press-mentions'],
  features: ['features:feature-alternating', 'features:feature-bento', 'features:feature-centered',
    'features:feature-grid', 'features:feature-icon-grid', 'features:feature-list', 'features:feature-tabs',
    'features:feature-with-code', 'landing:features-grid'],
  how: ['how-it-works'],
  stats: ['stats'],
  media: ['media', 'content:content-video-embed'],
  integrations: ['integrations:integration-grid', 'integrations:integration-showcase'],
  testimonials: ['social-proof:testimonial-*', 'social-proof:review-stars', 'social-proof:case-study-card',
    'landing:testimonials', 'content:content-quote-highlight'],
  pricing: ['pricing:pricing-tiers', 'pricing:pricing-toggle', 'pricing:pricing-single',
    'pricing:pricing-calculator', 'landing:pricing'],
  compare: ['pricing:pricing-comparison-table', 'features:feature-comparison', 'comparison'],
  faq: ['faq', 'pricing:pricing-faq'],
  team: ['team'],
  cta: ['cta', 'banners:banner-inline'],
  newsletter: ['newsletter', 'blog:blog-newsletter'],
  footer: ['footer', 'landing:footer'],
  login: ['auth:login-*', 'auth:social-login', 'auth:auth-page', 'forms:login'],
  signup: ['auth:signup-card', 'auth:signup-nav', 'auth:signup-simple', 'auth:signup-social*',
    'auth:signup-split-*', 'auth:register-form', 'forms:signup'],
  password: ['auth:forgot-password*', 'auth:reset-password', 'auth:two-factor'],
  kpis: ['dashboard:stats-cards-row', 'dashboard:stats-row'],
  chart: ['dashboard:chart-panel', 'dashboard:chart-section'],
  table: ['dashboard:data-table'],
  feed: ['dashboard:activity-feed', 'dashboard:notification-panel', 'data-display:notification-center'],
  kanban: ['dashboard:kanban-board'],
  search: ['forms:search-bar', 'forms:form-inline'],
  pagination: ['navigation:pagination'],
  settings: ['app-specific:settings-page', 'forms:settings', 'forms:settings-form', 'forms:form-with-sidebar'],
  billing: ['app-specific:billing-page', 'app-specific:api-keys-page'],
  profile: ['app-specific:profile-page', 'data-display:profile'],
  product: ['ecommerce:product-detail'],
  products: ['ecommerce:product-grid', 'ecommerce:category-grid', 'ecommerce:product-carousel', 'ecommerce:wishlist'],
  cart: ['ecommerce:shopping-cart'],
  checkout: ['ecommerce:checkout-form', 'forms:checkout'],
  'order-summary': ['ecommerce:order-summary'],
  'article-header': ['blog:blog-post-header', 'blog:blog-featured'],
  'article-body': ['content:content-section', 'content:content-split', 'content:content-with-image',
    'content:content-numbered-steps'],
  posts: ['blog:blog-grid', 'blog:blog-list', 'blog:blog-sidebar'],
  docs: ['integrations:api-reference', 'faq:faq-with-sidebar', 'misc:table-of-contents'],
  contact: ['contact', 'forms:contact'],
  timeline: ['timeline:timeline-*'],
  changelog: ['timeline:changelog', 'timeline:roadmap', 'app-specific:changelog-page'],
  event: ['event-schedule:event-countdown'],
  schedule: ['event-schedule:schedule-tabs'],
  speakers: ['event-schedule:speaker-grid'],
  portfolio: ['portfolio'],
  error: ['error-pages'],
  onboarding: ['app-specific:onboarding-tour', 'forms:form-multi-step', 'auth:signup-progress',
    'auth:signup-sidebar-progress'],
  upload: ['forms:file-upload'],
  empty: ['dashboard:empty-state-panel', 'data-display:empty-state'],
  'mobile-shell': ['mobile:app-shell'],
};

// Page order used to place extra sections between recipe sections (nav first, footer last).
export const SLOT_ORDER = Object.keys(SLOTS).sort((a, b) => rank(a) - rank(b));
function rank(slot) {
  const first = ['announcement', 'nav', 'app-header', 'breadcrumbs'];
  const last = ['cta', 'newsletter', 'footer'];
  if (first.includes(slot)) return first.indexOf(slot);
  if (last.includes(slot)) return 1000 + last.indexOf(slot);
  return 100 + Object.keys(SLOTS).indexOf(slot);
}

// sections: [slot, 'core' | 'optional'] in page order. extras: slots that may add one more
// section when a block in them scores very high.
export const ARCHETYPES = {
  landing: {
    description: 'Marketing or product landing page / homepage for a SaaS, startup, app, agency or service',
    sections: [['announcement', 'optional'], ['nav', 'core'], ['hero', 'core'], ['logos', 'optional'],
      ['features', 'core'], ['how', 'optional'], ['testimonials', 'optional'], ['pricing', 'optional'],
      ['faq', 'optional'], ['cta', 'core'], ['footer', 'core']],
    extras: ['stats', 'media', 'integrations', 'team', 'compare', 'newsletter'],
  },
  pricing: {
    description: 'Pricing or plans page comparing subscription tiers',
    sections: [['nav', 'core'], ['pricing', 'core'], ['compare', 'optional'], ['testimonials', 'optional'],
      ['faq', 'optional'], ['cta', 'optional'], ['footer', 'core']],
    extras: ['logos', 'stats'],
  },
  dashboard: {
    description: 'Analytics or admin dashboard with KPI cards, charts and recent activity',
    sections: [['app-header', 'core'], ['kpis', 'core'], ['chart', 'core'], ['table', 'optional'], ['feed', 'optional']],
    extras: ['kanban', 'empty'],
  },
  table: {
    description: 'Admin list or data table screen for managing records (users, orders, invoices)',
    sections: [['app-header', 'core'], ['kpis', 'optional'], ['search', 'optional'], ['table', 'core'],
      ['pagination', 'optional']],
    extras: ['empty'],
  },
  kanban: {
    description: 'Kanban or task board for project management',
    sections: [['app-header', 'core'], ['kanban', 'core']],
    extras: ['feed'],
  },
  settings: {
    description: 'Account or app settings page: preferences, profile form, billing, API keys',
    sections: [['app-header', 'optional'], ['settings', 'core'], ['billing', 'optional']],
    extras: ['upload'],
  },
  profile: {
    description: 'User profile or account overview page',
    sections: [['app-header', 'optional'], ['profile', 'core'], ['feed', 'optional']],
    extras: ['stats'],
  },
  login: {
    description: 'Sign-in / log-in screen',
    sections: [['login', 'core']],
    extras: [],
  },
  signup: {
    description: 'Sign-up / registration / create-account screen',
    sections: [['signup', 'core']],
    extras: [],
  },
  password: {
    description: 'Forgot password, reset password or two-factor verification screen',
    sections: [['password', 'core']],
    extras: [],
  },
  onboarding: {
    description: 'Onboarding, getting-started or multi-step setup wizard',
    sections: [['onboarding', 'core']],
    extras: ['upload'],
  },
  product: {
    description: 'E-commerce product detail page for a single item',
    sections: [['nav', 'core'], ['breadcrumbs', 'optional'], ['product', 'core'], ['testimonials', 'optional'],
      ['products', 'optional'], ['footer', 'core']],
    extras: ['newsletter'],
  },
  store: {
    description: 'Online store, shop homepage or product catalog / category listing',
    sections: [['nav', 'core'], ['hero', 'optional'], ['products', 'core'], ['newsletter', 'optional'], ['footer', 'core']],
    extras: ['testimonials', 'cta'],
  },
  checkout: {
    description: 'Shopping cart, checkout or payment flow',
    sections: [['nav', 'optional'], ['cart', 'optional'], ['checkout', 'core'], ['order-summary', 'optional']],
    extras: [],
  },
  article: {
    description: 'Blog post or article reading page',
    sections: [['nav', 'core'], ['article-header', 'core'], ['article-body', 'core'], ['newsletter', 'optional'],
      ['footer', 'core']],
    extras: ['testimonials', 'media'],
  },
  blog: {
    description: 'Blog index, news or magazine listing of posts',
    sections: [['nav', 'core'], ['posts', 'core'], ['newsletter', 'optional'], ['footer', 'core']],
    extras: ['hero'],
  },
  docs: {
    description: 'Developer documentation, API reference or help center',
    sections: [['nav', 'core'], ['breadcrumbs', 'optional'], ['docs', 'core'], ['faq', 'optional'], ['footer', 'optional']],
    extras: ['search', 'article-body'],
  },
  contact: {
    description: 'Contact us or support page',
    sections: [['nav', 'core'], ['contact', 'core'], ['faq', 'optional'], ['footer', 'core']],
    extras: [],
  },
  about: {
    description: 'About us, company or team page',
    sections: [['nav', 'core'], ['hero', 'optional'], ['team', 'core'], ['stats', 'optional'], ['timeline', 'optional'],
      ['testimonials', 'optional'], ['footer', 'core']],
    extras: ['media', 'cta'],
  },
  portfolio: {
    description: 'Portfolio, agency showcase or case studies',
    sections: [['nav', 'core'], ['hero', 'optional'], ['portfolio', 'core'], ['testimonials', 'optional'],
      ['contact', 'optional'], ['footer', 'core']],
    extras: ['media', 'team'],
  },
  event: {
    description: 'Event, conference or webinar page with schedule and speakers',
    sections: [['nav', 'optional'], ['event', 'core'], ['schedule', 'optional'], ['speakers', 'optional'],
      ['cta', 'optional'], ['footer', 'optional']],
    extras: ['faq', 'logos'],
  },
  changelog: {
    description: 'Changelog, release notes or product roadmap',
    sections: [['nav', 'optional'], ['changelog', 'core'], ['newsletter', 'optional'], ['footer', 'optional']],
    extras: [],
  },
  error: {
    description: 'Error page: 404 not found, 500, maintenance or coming soon',
    sections: [['error', 'core']],
    extras: [],
  },
  mobile: {
    description: 'Mobile app home screen with top bar and bottom tab navigation',
    sections: [['mobile-shell', 'core']],
    extras: [],
  },
  custom: {
    description: 'None of these: a custom interactive app or tool (chat, music player, game, calculator, editor, map, form builder) that needs bespoke UI',
    sections: [],
    extras: [],
  },
};

// Mirror of THEME_FAMILIES in daub.js (tests/assemble.test.mjs keeps the two in sync).
export const THEME_FAMILIES = {
  default: { light: 'light', dark: 'dark', description: 'Warm cream / deep charcoal; neutral, safe for anything' },
  grunge: { light: 'grunge-light', dark: 'grunge-dark', description: 'Typewriter, ink-stained; bold creative, agencies, artists' },
  solarized: { light: 'solarized', dark: 'solarized-dark', description: 'Aged paper / antiqued leather; calm, bookish' },
  ink: { light: 'ink-light', dark: 'ink', description: 'Cool editorial navy and silver; news, publishing, law' },
  ember: { light: 'ember-light', dark: 'ember', description: 'Sunlit pottery, copper glow; warm crafts, food, hospitality' },
  bone: { light: 'bone', dark: 'bone-dark', description: 'Stark white grayscale brutalism; minimal, real estate, legal' },
  dracula: { light: 'dracula-light', dark: 'dracula', description: 'Vampire purple; developer tools, code' },
  nord: { light: 'nord-light', dark: 'nord', description: 'Arctic frost blues; calm health, travel, wellness' },
  'one-dark': { light: 'one-dark-light', dark: 'one-dark', description: 'Midnight code editor; developer products' },
  monokai: { light: 'monokai-light', dark: 'monokai', description: 'Neon noir on dark; hacker, terminals' },
  gruvbox: { light: 'gruvbox-light', dark: 'gruvbox', description: 'Retro cream, earthy dark; cozy food, restaurants, coffee' },
  'night-owl': { light: 'night-owl-light', dark: 'night-owl', description: 'Soft dawn / deep twilight blue; night, focus apps' },
  github: { light: 'github', dark: 'github-dark', description: 'Clean primer blue; SaaS, B2B, dashboards, admin' },
  catppuccin: { light: 'catppuccin', dark: 'catppuccin-dark', description: 'Latte pastel, mocha warmth; friendly education, nonprofit' },
  'tokyo-night': { light: 'tokyo-night-light', dark: 'tokyo-night', description: 'City neon storm; gaming, esports' },
  material: { light: 'material-light', dark: 'material', description: 'Material paper, palenight; fintech, banking, HR, professional' },
  monospace: { light: 'monospace-light', dark: 'monospace', description: 'Terminal paper, phosphor console; CLI, docs for engineers' },
  synthwave: { light: 'synthwave-light', dark: 'synthwave', description: 'Retro 80s neon purple; music, streaming, nightlife' },
  'shades-of-purple': { light: 'shades-of-purple-light', dark: 'shades-of-purple', description: 'Lavender and deep violet; playful creative tools' },
  ayu: { light: 'ayu', dark: 'ayu-dark', description: 'Warm light, mirage dark; modern minimal apps' },
  horizon: { light: 'horizon-light', dark: 'horizon', description: 'Soft rose, warm dusk; lifestyle, fashion, beauty' },
};

function matches(pattern, block) {
  const [cat, kindGlob] = pattern.split(':');
  if (cat !== block.category) return false;
  if (!kindGlob) return true;
  const kind = block.id.replace(/-\d+$/, '');
  return kindGlob.endsWith('*') ? kind.startsWith(kindGlob.slice(0, -1)) : kind === kindGlob;
}

// slot -> blocks (catalog order). Blocks outside every slot are never asked about.
export function slotIndex(blocks) {
  const out = {};
  for (const [slot, patterns] of Object.entries(SLOTS)) {
    out[slot] = blocks.filter(b => patterns.some(p => matches(p, b)));
  }
  return out;
}
