// Condensed design knowledge for MCP system prompt injection
// Sources: tools/LAYOUT-RULES.md (Practical UI), skill-landing-pages/references/ (Landing Page Cookbook)

export const LAYOUT_RULES_COMPACT = `LAYOUT RULES (8pt grid):
Spacing tokens: XS=8px, S=16px, M=24px, L=32px, XL=48px, XXL=80px
DAUB gap mapping: 0=0, 1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px

Grouping: 4 methods — containers, proximity, similarity, continuity. Space between groups >= 2x within groups. Don't over-containerize: if 3/4 signals present, drop the border.

Visual hierarchy (strongest→weakest): size, color/contrast, weight, position, spacing, depth. One focal point per view. Squint test: blur UI, key elements must still be identifiable.

Typography: one sans-serif, two weights max (400/700). App scale 1.2 ratio (12-14-16-20-24-28), marketing scale 1.333 (14-18-24-32-42-56). Max 4-5 sizes/page. Body >=16px, line-height >=1.5 body / 1.1-1.3 headings. Max 65ch line length. Left-align body, center only short hero text (<3 lines).

Color: design greyscale first. Brand color = interactive only (buttons, links, toggles). One accent. Foreground opacity: 90% primary, 75% body, 60% secondary, 45% borders, 10% separators, 4% fills. Contrast: 4.5:1 text, 3:1 large text/UI.

Components: one primary button per view. Three weights: filled/outlined/text. Min 48x48px touch targets, 8px gap between. Label above input, helper below. One-column forms.

Common mistakes: equal spacing everywhere (fix: inner < outer) | multiple primary buttons | center-aligned paragraphs | full-width text (max 65ch) | empty containers | orphan elements | color-only hierarchy | tiny touch targets | lorem ipsum.`;

export const LANDING_PAGE_RULES = `LANDING PAGE PATTERNS:
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

export function detectLandingIntent(prompt) {
  return /landing\s*page|hero\s*section|marketing|pricing\s*(page|table)|signup\s*page|\bcta\b|conversion|above.?the.?fold|sales\s*page|lead\s*gen/i.test(prompt || '');
}

export const INDUSTRY_INTENTS = [
  { pattern: /saas|b2b|subscription|crm|erp|project\s*manage/i,
    theme: 'github',
    rules: 'Trust blue tones. Hero+Features+Pricing+CTA. Clean data-dense layouts. Anti: excessive animation, playful icons in serious tools.' },
  { pattern: /e.?commerce|shop|store|product\s*page|cart|checkout/i,
    theme: 'light',
    rules: 'Product-focused cards with hover lift. CTA prominence. Success green for cart. Grid layouts for product catalogs. Anti: flat without depth, text-heavy pages.' },
  { pattern: /fintech|banking|finance|payment|trading|invest/i,
    theme: 'material-light',
    rules: 'Data-dense, trust-focused. StatCards for KPIs. Tables for transactions. Muted palette, no neons. Anti: vibrant colors, excessive animation, playful tone.' },
  { pattern: /health|medical|clinic|patient|pharma|wellness/i,
    theme: 'nord-light',
    rules: 'Calming, accessible. Clear hierarchy. Large text, high contrast. Whitespace-generous. Anti: dark mode default, playful animations, small text.' },
  { pattern: /education|learn|course|student|school|lms|tutor/i,
    theme: 'catppuccin',
    rules: 'Warm, inviting. Progress indicators (Stepper, Progress). Card-based content. Clear navigation. Anti: dense data tables, corporate tone.' },
  { pattern: /creative|portfolio|design\s*agency|studio|artist/i,
    theme: 'grunge-dark',
    rules: 'Expressive, bold. Large imagery. Minimal text. Full-bleed sections. Anti: corporate blue, dense forms, cookie-cutter layouts.' },
  { pattern: /blog|news|magazine|editorial|article|content\s*site/i,
    theme: 'paper',
    rules: 'Typography-first. Prose component for body. Max 65ch line length. Clear reading hierarchy. Anti: sidebar clutter, small body text, low contrast.' },
  { pattern: /social|community|forum|chat|messaging|feed/i,
    theme: 'light',
    rules: 'Card-based feeds. Avatar+name patterns. List for threads. BottomNav for mobile. Anti: dense tables, formal tone, no user presence indicators.' },
  { pattern: /dashboard|analytics|admin\s*panel|back.?office|monitoring/i,
    theme: 'github',
    rules: 'Data-dense. StatCards row + Charts + Tables. Sidebar navigation. Compact spacing. Anti: large hero sections, marketing copy, excessive whitespace.' },
  { pattern: /dev\s*tool|developer|api|code|terminal|ide|cli/i,
    theme: 'dracula',
    rules: 'Dark theme preferred. Monospace for code. Compact UI. Kbd for shortcuts. Anti: rounded playful shapes, pastel colors, large images.' },
  { pattern: /real\s*estate|property|listing|rental|housing/i,
    theme: 'bone',
    rules: 'Image-heavy cards. Grid layouts for listings. Filter chips. Map integration hints. Anti: dark themes, dense tables without imagery.' },
  { pattern: /food|restaurant|recipe|delivery|menu|cafe/i,
    theme: 'gruvbox-light',
    rules: 'Warm tones. Image-heavy cards. Grid for menu items. Large CTAs for ordering. Anti: corporate blue, data-dense layouts.' },
  { pattern: /travel|booking|hotel|flight|tourism|vacation/i,
    theme: 'nord-light',
    rules: 'Image-forward. Search-first layout. Card grids for destinations. DatePicker for dates. Anti: text-heavy, dark themes, no imagery.' },
  { pattern: /fitness|gym|workout|sport|exercise|training/i,
    theme: 'material-dark',
    rules: 'Bold, energetic. Progress bars, stat cards. Dark with accent pops. Charts for progress. Anti: pastel, formal corporate tone.' },
  { pattern: /music|audio|podcast|streaming|playlist/i,
    theme: 'synthwave',
    rules: 'Dark with vibrant accents. List-based for tracks/episodes. Progress for playback. BottomNav for mobile. Anti: white themes, corporate layouts.' },
  { pattern: /gaming|game|esport|player|leaderboard/i,
    theme: 'tokyo-night',
    rules: 'Dark, immersive. StatCards for scores. Tables for leaderboards. Bold accent colors. Anti: light themes, formal business tone.' },
  { pattern: /hr|recruit|hiring|job\s*board|career|applicant/i,
    theme: 'material-light',
    rules: 'Clean, professional. Card-based job listings. Stepper for application flow. Filter sidebar. Anti: dark themes, playful tone.' },
  { pattern: /legal|law|compliance|contract|policy/i,
    theme: 'bone',
    rules: 'Conservative, trustworthy. Prose for documents. Accordion for FAQs. Muted palette. Anti: bright colors, playful elements, dark mode.' },
  { pattern: /nonprofit|charity|donation|cause|volunteer/i,
    theme: 'catppuccin',
    rules: 'Warm, emotive. Hero with impact stats. Progress for goals. Testimonials. Anti: corporate cold, dark themes, dense data.' },
  { pattern: /onboarding|signup\s*flow|welcome|getting\s*started/i,
    theme: 'light',
    rules: 'Stepper for progress. One task per step. Centered layout. Minimal navigation. Anti: dense forms, sidebar nav, multiple CTAs per step.' },
];

export function detectIndustryIntent(prompt) {
  if (!prompt) return null;
  for (const intent of INDUSTRY_INTENTS) {
    if (intent.pattern.test(prompt)) {
      return { industry: intent.pattern.source, theme: intent.theme, rules: intent.rules };
    }
  }
  return null;
}

export const MOBILE_DESIGN_RULES = `MOBILE APP DESIGN PATTERNS:
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

export function detectMobileIntent(prompt) {
  return /mobile\s*app|mobile\s*application|ios\s*app|android\s*app|phone\s*app|\bsmartphone\b|\biphone\b|mobile\s*screen|mobile\s*ui|mobile\s*layout|mobile\s*view|native\s*app|bottom.?nav|app\s*shell/i.test(prompt || '');
}

export const PAGE_FORMULAS = `PAGE FORMULAS (beyond landing pages):
Dashboard: Navbar + StatCards row + Primary chart/table + Secondary data + Activity feed
Settings: Sidebar/Tabs nav + Section cards + Form fields + Save/Cancel footer
Onboarding: Stepper + Welcome + Profile setup + Preferences + Completion
Profile: Avatar + Stats row + Tabs (Posts/Activity/Settings) + Content
Inbox/List: Search + Filter chips + Scrollable list + Detail panel (or navigate)
Pricing: Toggle (monthly/annual) + Plan cards (3 tiers) + Feature comparison table + FAQ`;
