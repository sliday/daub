#!/usr/bin/env node
/**
 * Visual QA — Generate 100 spec JSONs via Gemini API
 * Uses the same system prompt as the playground.
 *
 * Usage: GEMINI_API_KEY=... node generate.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPECS_DIR = path.join(__dirname, 'results', 'specs');
const MANIFEST_PATH = path.join(__dirname, 'results', 'manifest.json');

// ---- Rebuild the same system prompt the playground uses ----

const COMP_PROPS = {
  Layout: 'direction: "vertical"|"horizontal", columns: 2-6, gap: 0-6 (default 2=8px), container: "wide"|"narrow"|true, align: "center"|"right"|"end"|"between" (centers/aligns children — use instead of spacer hacks), valign: "center"|"end" (vertical align for horizontal layouts)',
  Surface: 'variant: "raised"|"inset"|"pressed"',
  Text: 'tag: "h1"|"h2"|"h3"|"h4"|"p"|"span", content: string, class: string',
  Prose: 'content: string (HTML), size: "sm"|"lg"|"xl"|"2xl"',
  Separator: 'vertical: bool, dashed: bool, label: string',
  Button: 'label: string, variant: "primary"|"secondary"|"ghost"|"icon-danger"|"icon-success"|"icon-accent", size: "sm"|"lg"|"icon", loading: bool, icon: string, trigger: "overlayId" (opens Modal/AlertDialog/Sheet/Drawer by id)',
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
  CustomSelect: 'placeholder: string, options: [{label, value, selected: bool, disabled: bool}], searchable: bool',
  Kbd: 'keys: [string]',
  Label: 'text: string, required: bool, optional: bool',
  Spinner: 'size: "sm"|"lg"|"xl"',
  InputOTP: 'length: number, separator: bool',
  Tabs: 'tabs: [{label, id}], active: string',
  Breadcrumbs: 'items: [{label, href}]',
  Pagination: 'current: number, total: number, perPage: number',
  Stepper: 'steps: [{label, status: "completed"|"active"|"pending"}], vertical: bool',
  NavMenu: 'items: [{label, href, active: bool}]',
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
  Calendar: 'selected: "YYYY-MM-DD" (date to highlight), today: "YYYY-MM-DD" (today override)',
  Chart: 'bars: [{label, value, max}]',
  Carousel: 'slides: [{content}]',
  AspectRatio: 'ratio: "16-9"|"4-3"|"1-1"|"21-9"',
  Chip: 'label: string, color: "red"|"green"|"blue"|"purple"|"amber"|"pink", active: bool, closable: bool',
  ScrollArea: 'direction: "horizontal"|"vertical"',
  Alert: 'type: "info"|"warning"|"error"|"success", title: string, message: string',
  Progress: 'value: number, indeterminate: bool',
  Skeleton: 'variant: "text"|"heading"|"avatar"|"btn", lines: number',
  EmptyState: 'icon: string, title: string, message: string',
  Tooltip: 'text: string, position: "top"|"bottom"|"left"|"right"',
  Modal: 'id: string, title: string, footer: [childIds] (buttons for modal footer; omit for default Cancel/Confirm)',
  AlertDialog: 'id: string, title: string, description: string, footer: [childIds] (action buttons; omit for default Cancel/Continue)',
  Sheet: 'id: string, position: "right"|"left"|"top"|"bottom"',
  Drawer: 'id: string',
  Popover: 'position: "top"|"bottom"|"left"|"right"',
  HoverCard: '',
  DropdownMenu: 'items: [{label, icon, separator, groupLabel, active: bool}]',
  ContextMenu: 'items: [{label, icon, separator}]',
  CommandPalette: 'id: string, placeholder: string, groups: [{label, items: [{label, icon, shortcut}]}]',
  Accordion: 'items: [{title, content, children: [childIds]}], multi: bool',
  Collapsible: 'label: string',
  Resizable: 'direction: "horizontal"|"vertical"',
  DatePicker: 'label: string, placeholder: string, selected: string',
  StatCard: 'label: string, value: string, trend: "up"|"down", trendValue: string, icon: string, horizontal: bool',
  ChartCard: 'title: string',
  CustomHTML: 'html: string (raw HTML using DAUB classless CSS), css: string (CSS rules injected as a <style> tag), js: string (vanilla JS, receives "container" arg for this element and "preview" arg for the entire preview pane — use preview.querySelector(\'[data-spec-id="someId"]\') to target other elements), children: [childIds] (standard DAUB component IDs rendered inside the container — html renders first, then children append after)',
};

const COMP_CATEGORIES = [
  ['Layout & Structure', ['Layout', 'Surface', 'Text', 'Prose', 'Separator']],
  ['Controls', ['Button', 'ButtonGroup', 'Field', 'Input', 'InputGroup', 'InputIcon', 'Search', 'Textarea', 'Checkbox', 'RadioGroup', 'Switch', 'Slider', 'Toggle', 'ToggleGroup', 'Select', 'CustomSelect', 'Kbd', 'Label', 'Spinner', 'InputOTP']],
  ['Navigation', ['Tabs', 'Breadcrumbs', 'Pagination', 'Stepper', 'NavMenu', 'Navbar', 'Menubar', 'Sidebar', 'BottomNav']],
  ['Data Display', ['Card', 'Table', 'DataTable', 'List', 'Badge', 'Avatar', 'AvatarGroup', 'Calendar', 'Chart', 'Carousel', 'AspectRatio', 'Chip', 'ScrollArea']],
  ['Feedback', ['Alert', 'Progress', 'Skeleton', 'EmptyState', 'Tooltip']],
  ['Overlays', ['Modal', 'AlertDialog', 'Sheet', 'Drawer', 'Popover', 'HoverCard', 'DropdownMenu', 'ContextMenu', 'CommandPalette']],
  ['Layout Utilities', ['Accordion', 'Collapsible', 'Resizable', 'DatePicker']],
  ['Dashboard', ['StatCard', 'ChartCard']],
  ['Custom', ['CustomHTML']],
];

function buildSystemPrompt() {
  let preamble = 'You are a UI generator that outputs json-render flat specs using DAUB components.\n\n'
    + 'CRITICAL: You MUST return ONLY a single valid JSON object. No markdown fences, no explanation, no text before or after the JSON.\n'
    + 'Do NOT use trailing commas. Do NOT use comments. Ensure every string is properly quoted and escaped.\n\n'
    + 'OUTPUT FORMAT:\n'
    + '{\n  "theme": "<theme-name>",\n  "root": "<element-id>",\n  "elements": {\n    "<element-id>": {\n'
    + '      "type": "<ComponentType>",\n      "props": { ... },\n'
    + '      "children": ["<child-id>", ...]\n    }\n  }\n}\n\n'
    + 'RULES:\n'
    + '- Every element has a unique string ID (e.g. "layout-1", "card-1", "btn-1")\n'
    + '- "children" is an array of element ID strings (flat, NOT nested objects)\n'
    + '- Only leaf elements omit "children"\n'
    + '- The "root" must reference an existing element ID\n'
    + '- Output MUST be valid JSON. Double-check: no trailing commas, no single quotes, no unescaped special characters\n\n'
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
    + '- Use Layout as the root with direction:"vertical" for page-level layouts\n'
    + '- Use Layout with direction:"horizontal" and columns for grid arrangements\n'
    + '- To center children use Layout align:"center" — NEVER use empty spacer elements for centering\n'
    + '- Layout gap uses spacing tokens 0-6 (0=0px, 1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px). Default is 2 (8px). Use gap:2-3 for tight rhythm, gap:4-5 for sections\n'
    + '- Wrap related content in Card components\n'
    + '- Use StatCard for KPI metrics\n'
    + '- Use real-looking sample data (names, numbers, dates)\n'
    + '- Keep element IDs descriptive and unique\n'
    + '- For placeholder images, use dummyimage.com: https://dummyimage.com/WxH/BGCOLOR/TEXTCOLOR.png&text=LABEL (e.g. https://dummyimage.com/300x200/e0e0e0/666.png&text=Product+Photo)\n'
    + '- CustomHTML is an ESCAPE HATCH — PREFER standard DAUB components for everything. Only use CustomHTML for: (a) inter-component interactions (e.g. a button controlling a modal elsewhere), (b) animations/transitions, (c) widgets not covered by DAUB components\n'
    + '- CustomHTML supports children: use "children" array to nest DAUB components inside CustomHTML (modals, drawers, interactive panels). Children are real DAUB components — themed, diffable, with data-spec-id\n'
    + '- Use "html" only for truly custom markup (decorative elements, SVG, canvas). Use "children" for content that should be standard DAUB components. Can combine both: html renders first, children append after\n'
    + '- CustomHTML props: html (raw HTML, use DAUB CSS classes like db-btn, db-card), css (CSS rules injected as <style>), js (vanilla JS)\n'
    + '- CustomHTML JS receives two args: "container" (this element\'s wrapper div) and "preview" (the entire preview pane). Use preview.querySelector(\'[data-spec-id="someId"]\') to target other rendered elements by their spec ID. The js can manipulate both html content and rendered children via container\n'
    + '- Keep CustomHTML JS minimal: event listeners, class toggling, text updates. No frameworks, no fetch calls\n'
    + '- Escape quotes properly in JSON strings: use \\" for double quotes inside string values\n'
    + '- Overlay components (Modal, AlertDialog, Sheet, Drawer) are hidden by default — do NOT add display:none style\n'
    + '- Use trigger: "overlay-id" on Button to open overlays — no CustomHTML JS needed\n'
    + '- Overlays get DAUB behaviors automatically: overlay click-to-close, ESC key, focus trap (Modal)\n'
    + '- Card interactive:true for clickable/hoverable cards (adds pointer cursor + hover lift)\n'
    + '- Input type prop for semantic inputs: type:"email" for emails, type:"date" for dates, type:"password" for passwords, type:"number" for numbers\n'
    + '- Button variant "icon-danger"|"icon-success"|"icon-accent" for colored icon buttons (e.g. delete, approve actions)\n'
    + '- StatCard horizontal:true for compact inline stat display (icon + label + value in a row)\n'
    + '- Stepper vertical:true for vertical process flows and timelines\n'
    + '- Use CustomSelect (not Select) when you need searchable dropdowns or custom-styled options; set selected:true on the default option and disabled:true on unavailable options\n'
    + '- NEVER use flex-flow:wrap or flex-wrap:wrap on app shell containers (navbar+sidebar+content) — app shells must use fixed/sticky positioning, not wrapping flow\n'
    + '- Overlays (Modal, Sheet, Drawer) render in closed state by default — for static previews, always include visible content inside them and assume they will be forced open\n'
    + '- When the prompt mentions avatars or user photos, ALWAYS use the Avatar or AvatarGroup component — never use raw <img> or placeholder divs\n'
    + '- Tabs content must be nested INSIDE the Tabs component as children — never place tab panel content as siblings after the Tabs element\n'
    + '- Carousel slides should use standard DAUB components (Card, Text, Layout) — never put raw HTML strings in slide content\n'
    + '- Use "Separator" for dividers/horizontal rules — there is no "Divider" component\n\n';

  const themes = 'THEMES:\n'
    + 'Set "theme" in the root JSON to apply a DAUB theme. Available themes:\n'
    + '- Light: "light", "bone", "material-light", "github", "nord-light", "solarized-light", "catppuccin", "gruvbox-light", "paper", "grunge-light"\n'
    + '- Dark: "dark", "material-dark", "github-dark", "nord", "solarized-dark", "catppuccin-dark", "gruvbox-dark", "dracula", "grunge-dark", "synthwave", "tokyo-night"\n\n'
    + 'Theme selection heuristics:\n'
    + '- Dashboards/analytics → "github" or "material-light"\n'
    + '- Dark UIs, code tools, dev tools → "dracula" or "tokyo-night"\n'
    + '- Retro/nostalgic → "grunge-dark" or "synthwave"\n'
    + '- Minimal/clean → "bone" or "nord-light"\n'
    + '- Warm/cozy → "gruvbox-light" or "catppuccin"\n'
    + '- If user says "make it dark" → switch to the dark variant of the current theme family\n'
    + '- If user explicitly names a theme (e.g. "use nord") → use that exact theme\n'
    + '- Default: "light" when no preference is detected\n';

  return preamble + sections + guidelines + themes;
}

// ---- 100 prompts organized by category ----

const PROMPTS = [
  // Dashboards (10)
  { id: 1, category: 'dashboards', prompt: 'Analytics dashboard with visitor stats, conversion rate, revenue chart, and recent activity feed' },
  { id: 2, category: 'dashboards', prompt: 'Admin panel with user management table, role filters, and bulk action buttons' },
  { id: 3, category: 'dashboards', prompt: 'Server monitoring dashboard with CPU, memory, disk usage stat cards and uptime chart' },
  { id: 4, category: 'dashboards', prompt: 'Sales CRM dashboard with pipeline stages, deal values, and top performers leaderboard' },
  { id: 5, category: 'dashboards', prompt: 'Project tracker with kanban-style task columns, progress bars, and team member avatars' },
  { id: 6, category: 'dashboards', prompt: 'Social media metrics dashboard showing followers, engagement rate, post performance chart' },
  { id: 7, category: 'dashboards', prompt: 'IoT device dashboard with sensor readings, status indicators, and alert notifications' },
  { id: 8, category: 'dashboards', prompt: 'Financial overview with account balances, recent transactions table, and spending breakdown chart' },
  { id: 9, category: 'dashboards', prompt: 'DevOps deployment status dashboard with build history, service health, and incident timeline' },
  { id: 10, category: 'dashboards', prompt: 'Content management dashboard with published articles list, draft count, and editorial calendar' },

  // Forms (10)
  { id: 11, category: 'forms', prompt: 'Sign-in form with email, password, remember me checkbox, and social login buttons' },
  { id: 12, category: 'forms', prompt: 'User registration form with name, email, password, confirm password, and terms checkbox' },
  { id: 13, category: 'forms', prompt: 'Multi-step onboarding wizard with personal info, preferences, and confirmation steps using Stepper' },
  { id: 14, category: 'forms', prompt: 'E-commerce checkout form with shipping address, payment method selection, and order summary card' },
  { id: 15, category: 'forms', prompt: 'Settings page with profile section, notification toggles, theme selector, and danger zone' },
  { id: 16, category: 'forms', prompt: 'Profile edit form with avatar upload area, bio textarea, social links, and save/cancel buttons' },
  { id: 17, category: 'forms', prompt: 'Survey form with multiple question types: radio groups, checkboxes, text areas, and rating slider' },
  { id: 18, category: 'forms', prompt: 'Contact form with name, email, subject dropdown, message textarea, and file attachment area' },
  { id: 19, category: 'forms', prompt: 'Job application form with personal details, experience fields, skills chips, and resume upload' },
  { id: 20, category: 'forms', prompt: 'Advanced search filters with date pickers, category selects, price range sliders, and toggle options' },

  // Data display (10)
  { id: 21, category: 'data-display', prompt: 'Data table with sortable columns, pagination, search, and row selection checkboxes' },
  { id: 22, category: 'data-display', prompt: 'Product catalog grid with image cards, prices, ratings, and add-to-cart buttons' },
  { id: 23, category: 'data-display', prompt: 'User directory with avatar list, role badges, status indicators, and search bar' },
  { id: 24, category: 'data-display', prompt: 'File manager with breadcrumb path, folder/file list, size column, and action dropdown menus' },
  { id: 25, category: 'data-display', prompt: 'Email inbox with unread indicators, sender avatars, subject preview, date, and star toggle' },
  { id: 26, category: 'data-display', prompt: 'Notification center with grouped notifications by date, read/unread states, and clear all button' },
  { id: 27, category: 'data-display', prompt: 'Activity feed timeline with user avatars, action descriptions, timestamps, and comment counts' },
  { id: 28, category: 'data-display', prompt: 'Kanban board with three columns (To Do, In Progress, Done) containing task cards with badges' },
  { id: 29, category: 'data-display', prompt: 'Vertical timeline showing project milestones with dates, descriptions, and status indicators' },
  { id: 30, category: 'data-display', prompt: 'Gaming leaderboard with rank numbers, player avatars, scores, and trend indicators' },

  // Marketing (10)
  { id: 31, category: 'marketing', prompt: 'Pricing page with three tier cards (Basic, Pro, Enterprise), feature lists, and CTA buttons' },
  { id: 32, category: 'marketing', prompt: 'Landing page hero section with headline, subtitle, CTA button, and feature highlights' },
  { id: 33, category: 'marketing', prompt: 'Feature comparison table with checkmarks, plan names, and upgrade buttons' },
  { id: 34, category: 'marketing', prompt: 'Testimonials section with quote cards, author avatars, company names, and star ratings' },
  { id: 35, category: 'marketing', prompt: 'Team page with member cards showing photos, names, roles, and social media links' },
  { id: 36, category: 'marketing', prompt: 'Blog listing page with article cards, featured images, author info, categories, and read time' },
  { id: 37, category: 'marketing', prompt: 'Portfolio gallery with project cards, category filter tabs, and project detail modal' },
  { id: 38, category: 'marketing', prompt: 'Product detail page with image carousel, specs table, reviews section, and add-to-cart' },
  { id: 39, category: 'marketing', prompt: 'FAQ page with accordion sections organized by category' },
  { id: 40, category: 'marketing', prompt: 'Changelog page with version entries showing dates, badges (new/updated/fix), and descriptions' },

  // Complex layouts (10)
  { id: 41, category: 'complex-layouts', prompt: 'Dashboard with nested cards inside tabs, each tab containing stat cards and a chart' },
  { id: 42, category: 'complex-layouts', prompt: 'App layout with collapsible sidebar navigation and main content area with breadcrumbs' },
  { id: 43, category: 'complex-layouts', prompt: 'Settings page with tabs, each tab containing a form with different input types and a table' },
  { id: 44, category: 'complex-layouts', prompt: 'Modal containing a multi-step form with validation errors and a confirmation dialog' },
  { id: 45, category: 'complex-layouts', prompt: 'Sheet panel with a detailed form, collapsible sections, and action buttons at bottom' },
  { id: 46, category: 'complex-layouts', prompt: 'App with drawer navigation, bottom nav bar, and main content with horizontal scrolling cards' },
  { id: 47, category: 'complex-layouts', prompt: 'Command palette overlay with grouped actions, keyboard shortcuts, and search input' },
  { id: 48, category: 'complex-layouts', prompt: 'Context menu with nested sub-items, separators, icons, and keyboard shortcuts' },
  { id: 49, category: 'complex-layouts', prompt: 'FAQ page with nested accordion items, some containing lists and code blocks in Prose' },
  { id: 50, category: 'complex-layouts', prompt: 'Image gallery with carousel, thumbnail strip below, and fullscreen modal view' },

  // Edge cases (10)
  { id: 51, category: 'edge-cases', prompt: 'Empty state page with illustration icon, title, description, and action button' },
  { id: 52, category: 'edge-cases', prompt: 'Error state page with warning alert, error details in card, retry button, and support link' },
  { id: 53, category: 'edge-cases', prompt: 'Loading skeleton page showing placeholder content for a dashboard with stat cards and table' },
  { id: 54, category: 'edge-cases', prompt: 'Single Button component with primary variant, nothing else' },
  { id: 55, category: 'edge-cases', prompt: 'Deeply nested layout: Layout > Card > Layout > Card > Layout > Card > Text, 6 levels deep' },
  { id: 56, category: 'edge-cases', prompt: 'Layout with 20 child cards in a horizontal scrollable row' },
  { id: 57, category: 'edge-cases', prompt: 'Card with extremely long text content that should overflow gracefully with ellipsis' },
  { id: 58, category: 'edge-cases', prompt: 'Dashboard with RTL-friendly layout, Arabic placeholder text, and right-aligned navigation' },
  { id: 59, category: 'edge-cases', prompt: 'Icon showcase: a grid of 30 buttons each with a different icon name' },
  { id: 60, category: 'edge-cases', prompt: 'Minimal spec: just a Layout root with one Text child saying "Hello World"' },

  // Component stress (10)
  { id: 61, category: 'component-stress', prompt: 'Stepper showcase with horizontal, vertical, all status variants (completed, active, pending)' },
  { id: 62, category: 'component-stress', prompt: 'Badge gallery showing all variants: new, updated, warning, error in different contexts' },
  { id: 63, category: 'component-stress', prompt: 'Chart comparison showing multiple Chart components with different data sets side by side' },
  { id: 64, category: 'component-stress', prompt: 'Toggle and ToggleGroup showcase with all sizes and states (pressed, unpressed)' },
  { id: 65, category: 'component-stress', prompt: 'InputOTP showcase with different lengths (4, 6, 8) and with/without separators' },
  { id: 66, category: 'component-stress', prompt: 'Calendar showcase with different selected dates and today highlights' },
  { id: 67, category: 'component-stress', prompt: 'Carousel with 5 slides each containing different content (text, image, card)' },
  { id: 68, category: 'component-stress', prompt: 'Menubar with 4 menu items each having dropdown sub-items' },
  { id: 69, category: 'component-stress', prompt: 'Breadcrumbs showcase with short (2 items), medium (4 items), and long (7 items) paths' },
  { id: 70, category: 'component-stress', prompt: 'Card variants: basic, with media, with footer buttons, interactive, with badge overlay' },

  // Theme combos (10)
  { id: 71, category: 'theme-combos', prompt: 'Dashboard with stat cards and table. Use "paper" theme' },
  { id: 72, category: 'theme-combos', prompt: 'Login form with social buttons. Use "dark" theme' },
  { id: 73, category: 'theme-combos', prompt: 'Settings page with toggles and selects. Use "gruvbox-light" theme' },
  { id: 74, category: 'theme-combos', prompt: 'Code editor settings panel. Use "dracula" theme' },
  { id: 75, category: 'theme-combos', prompt: 'Blog post layout with sidebar. Use "nord-light" theme' },
  { id: 76, category: 'theme-combos', prompt: 'Music player interface with playlist. Use "synthwave" theme' },
  { id: 77, category: 'theme-combos', prompt: 'E-commerce product page. Use "solarized-light" theme' },
  { id: 78, category: 'theme-combos', prompt: 'Task management app. Use "catppuccin-dark" theme' },
  { id: 79, category: 'theme-combos', prompt: 'Documentation page with code blocks. Use "github" theme' },
  { id: 80, category: 'theme-combos', prompt: 'Retro-styled portfolio. Use "grunge-dark" theme' },

  // Real apps (10)
  { id: 81, category: 'real-apps', prompt: 'Stripe-style payment dashboard with balance card, recent payments table, and payout schedule' },
  { id: 82, category: 'real-apps', prompt: 'Linear-style issue tracker with issue list, status badges, priority labels, and assignee avatars' },
  { id: 83, category: 'real-apps', prompt: 'Notion-style page with title, breadcrumbs, content blocks (text, table, callout card)' },
  { id: 84, category: 'real-apps', prompt: 'Slack-style channel view with message list, user avatars, timestamps, and message input' },
  { id: 85, category: 'real-apps', prompt: 'GitHub-style PR page with title, status badge, file changes table, and review comments' },
  { id: 86, category: 'real-apps', prompt: 'Figma-style layers panel with nested list items, visibility toggles, and lock icons' },
  { id: 87, category: 'real-apps', prompt: 'VS Code-style settings page with search, categorized settings list, and toggle/input controls' },
  { id: 88, category: 'real-apps', prompt: 'Spotify-style playlist view with track list, album art, duration, and play buttons' },
  { id: 89, category: 'real-apps', prompt: 'Twitter-style feed with tweet cards, user avatars, engagement stats, and action buttons' },
  { id: 90, category: 'real-apps', prompt: 'Discord-style server view with channel sidebar, message area, and member list' },

  // Responsive patterns (10)
  { id: 91, category: 'responsive', prompt: 'Mobile sign-in screen with stacked form fields, full-width buttons, and bottom nav' },
  { id: 92, category: 'responsive', prompt: 'Tablet-optimized dashboard with 2-column stat card grid and collapsible sidebar' },
  { id: 93, category: 'responsive', prompt: 'Narrow card stack layout with single-column content and full-width action buttons' },
  { id: 94, category: 'responsive', prompt: 'Wide data table with many columns, horizontal scroll area, and fixed action column' },
  { id: 95, category: 'responsive', prompt: 'Single-column blog post layout with full-width images and comfortable reading width' },
  { id: 96, category: 'responsive', prompt: 'Two-column settings layout: navigation list on left, settings form on right' },
  { id: 97, category: 'responsive', prompt: 'Three-column pricing comparison with feature rows and highlighted recommended plan' },
  { id: 98, category: 'responsive', prompt: 'Grid gallery with 3-column image card layout and load more pagination' },
  { id: 99, category: 'responsive', prompt: 'App shell with sidebar that could collapse, header with search, and main content area' },
  { id: 100, category: 'responsive', prompt: 'Full-width hero section with centered headline, subtext, and two CTA buttons side by side' },
];

// ---- Gemini API call ----

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable required');
  process.exit(1);
}

const MODEL = 'gemini-3.1-flash-lite-preview';
const SYSTEM = buildSystemPrompt();

async function callGemini(userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        thinkingConfig: { thinkingLevel: 'MEDIUM' },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts?.length) {
    throw new Error('No parts in Gemini response');
  }
  // With thinking enabled, skip thought parts — get last text part
  const textParts = candidate.content.parts.filter(p => p.text && !p.thought);
  if (!textParts.length) {
    // Fallback: try any part with text
    const anyText = candidate.content.parts.find(p => p.text);
    if (anyText) return anyText.text;
    throw new Error('No text in Gemini response');
  }
  return textParts[textParts.length - 1].text;
}

function cleanJSON(raw) {
  let s = raw.trim();
  // Strip markdown fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  // Strip leading text before first {
  const idx = s.indexOf('{');
  if (idx > 0) s = s.slice(idx);
  // Strip trailing text after last }
  const lastIdx = s.lastIndexOf('}');
  if (lastIdx >= 0 && lastIdx < s.length - 1) s = s.slice(0, lastIdx + 1);
  return s;
}

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') return 'not an object';
  if (!spec.root) return 'missing root';
  if (!spec.elements || typeof spec.elements !== 'object') return 'missing elements';
  if (!spec.elements[spec.root]) return 'root not in elements';
  return null;
}

// ---- Main ----

async function main() {
  // Check which specs already exist (for resumability)
  const existing = new Set();
  try {
    const files = fs.readdirSync(SPECS_DIR);
    for (const f of files) {
      const m = f.match(/^(\d+)\.json$/);
      if (m) existing.add(parseInt(m[1]));
    }
  } catch {}

  // Load or create manifest
  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {}

  const total = PROMPTS.length;
  let completed = existing.size;
  console.log(`Starting generation: ${total} prompts, ${completed} already done\n`);

  for (const entry of PROMPTS) {
    if (existing.has(entry.id)) {
      continue;
    }

    const num = String(entry.id).padStart(3, '0');
    console.log(`[${entry.id}/${total}] ${entry.category}: ${entry.prompt.slice(0, 60)}...`);

    let retries = 0;
    let spec = null;
    let error = null;

    while (retries < 3 && !spec) {
      try {
        const raw = await callGemini(entry.prompt);
        const cleaned = cleanJSON(raw);
        spec = JSON.parse(cleaned);
        const validationErr = validateSpec(spec);
        if (validationErr) {
          console.log(`  Validation failed (${validationErr}), retry ${retries + 1}`);
          spec = null;
          retries++;
          continue;
        }
      } catch (e) {
        error = e.message;
        retries++;
        console.log(`  Error: ${error}, retry ${retries}`);
        if (e.message.includes('429') || e.message.includes('rate')) {
          console.log('  Rate limited, waiting 30s...');
          await new Promise(r => setTimeout(r, 30000));
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    if (spec) {
      const specPath = path.join(SPECS_DIR, `${num}.json`);
      fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));

      const componentCount = Object.keys(spec.elements).length;
      manifest.push({
        id: entry.id,
        category: entry.category,
        prompt: entry.prompt,
        specFile: `specs/${num}.json`,
        componentCount,
        theme: spec.theme || 'default',
        generatedAt: new Date().toISOString(),
      });
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

      console.log(`  ✓ ${componentCount} components, theme: ${spec.theme || 'default'}`);
      completed++;
    } else {
      console.log(`  ✗ Failed after ${retries} retries: ${error}`);
      manifest.push({
        id: entry.id,
        category: entry.category,
        prompt: entry.prompt,
        specFile: null,
        error: error || 'validation failed',
        generatedAt: new Date().toISOString(),
      });
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    }

    // Brief pause between requests
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone: ${completed}/${total} specs generated`);
}

main().catch(e => { console.error(e); process.exit(1); });
