// Seeded spec generators for the combo audit.
//   pairs  : every container variant x every (plausible) leaf type
//   random : random json-render trees, depth 2-3, 4-12 elements
//   blocks : the block-library specs in blocks/<category>/*.json, as-is
// Same --seed => byte-identical specs (the RNG is keyed per spec, so a
// pair's props do not depend on which other pairs run).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ---- RNG (xmur3 hash -> mulberry32) ----------------------------------------
export function makeRng(key) {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let a = (h ^= h >>> 16) >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted: (pairs) => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let x = next() * total;
      for (const [v, w] of pairs) { if ((x -= w) < 0) return v; }
      return pairs[pairs.length - 1][0];
    },
  };
  return r;
}

// ---- realistic content pools -------------------------------------------------
const LABELS = ['Save', 'Cancel', 'Continue', 'Upgrade', 'Export CSV', 'Invite team', 'View all', 'Delete account', 'Get started', 'Learn more', 'Download report', 'Add payment method'];
const TITLES = ['Monthly revenue', 'Active users', 'Team members', 'Recent orders', 'Notification settings', 'Billing overview', 'Project Phoenix', 'Q3 performance summary', 'Security & access', 'Customer feedback'];
const SENTENCES = [
  'Track every deployment across your environments in one place.',
  'Your trial ends in 5 days. Upgrade to keep access to premium features.',
  'We will email you when the export is ready to download.',
  'Configure how often we email you about account activity, security alerts and product announcements from the team.',
];
// Unbreakable tokens that AI specs put in tables, fields and cards (emails, URLs, API keys).
const LONG_TOKENS = [
  'alexandra.konstantinopoulou@enterprise-solutions.example.com',
  'https://dashboard.example.com/settings/integrations/webhooks?tab=advanced',
  'demo_key_51H8xQ2Kz9vT3mN7pL4wR6yU0aBcDeFgHiJ',
  'INV-2026-000184-EU-WEST-PRIMARY-RECONCILED',
];
const NAMES = ['Ada Lovelace', 'Grace Hopper', 'Linus Torvalds', 'Margaret Hamilton', 'Alan Turing', 'Katherine Johnson'];
// Verified present in lucide 1.x (brand icons such as "github" are NOT, see README).
const ICONS = ['house', 'settings', 'bell', 'user', 'users', 'search', 'star', 'heart', 'check', 'x', 'arrow-right', 'calendar', 'mail', 'credit-card', 'shield', 'zap', 'folder', 'file-text', 'download', 'trending-up', 'activity', 'inbox', 'package', 'layout-dashboard'];

function label(r) { return r.chance(0.1) ? r.pick(TITLES) : r.pick(LABELS); }
function title(r) { return r.chance(0.12) ? r.pick(SENTENCES) : r.pick(TITLES); }
function sentence(r) { return r.chance(0.15) ? r.pick(SENTENCES) + ' Contact ' + r.pick(LONG_TOKENS) + '.' : r.pick(SENTENCES); }
function cellText(r) { return r.chance(0.12) ? r.pick(LONG_TOKENS) : r.pick([...NAMES, '$1,284.00', '42%', 'Active', 'Pending', 'Failed', '2026-09-12', 'Enterprise']); }
function initials(n) { return n.split(' ').map(s => s[0]).join(''); }
function img(r, w, h) { return `https://picsum.photos/seed/${r.int(1, 999)}/${w}/${h}`; }
function avatarSrc(r) { return `https://i.pravatar.cc/150?img=${r.int(1, 70)}`; }
function opts(values) { return values.map(v => ({ label: v, value: v.toLowerCase().replace(/\s+/g, '-') })); }

// ---- leaf fixtures (prop shapes from COMP_PROPS in functions/api/mcp.js) ------
// Each returns { props, kids? } where kids is [[suffix, def], ...] for composite leaves.
const LEAF = {
  Text: r => { const tag = r.pick(['h1', 'h2', 'h3', 'h4', 'p', 'p', 'span']); return { props: { tag, content: tag === 'p' || tag === 'span' ? sentence(r) : title(r) } }; },
  Prose: r => ({ props: { content: `<h3>${title(r)}</h3><p>${sentence(r)}</p><ul><li>${label(r)}</li><li>${label(r)}</li></ul>` } }),
  Separator: r => ({ props: r.pick([{}, { label: 'or' }, { dashed: true }, { vertical: true }]) }),
  Button: r => ({ props: { label: label(r), variant: r.pick(['primary', 'secondary', 'ghost', undefined]), ...(r.chance(0.3) ? { icon: r.pick(ICONS) } : {}), ...(r.chance(0.15) ? { size: r.pick(['sm', 'lg']) } : {}) } }),
  ButtonGroup: r => ({ props: {}, kids: [0, 1, 2].map(i => [`b${i}`, { type: 'Button', props: { label: r.pick(['Day', 'Week', 'Month', 'Year']), variant: i === 0 ? 'primary' : 'secondary' } }]) }),
  Link: r => ({ props: { label: r.pick(['Read the docs', 'View changelog', 'Forgot password?', 'Terms of service']), href: '#' } }),
  Icon: r => ({ props: { name: r.pick(ICONS), size: r.pick(['sm', 'md', 'lg']) } }),
  Input: r => ({ props: { placeholder: r.pick(['you@company.com', 'Search projects...', 'Enter amount', 'Full name']), type: r.pick(['text', 'email', 'number']) } }),
  Search: r => ({ props: { placeholder: r.pick(['Search...', 'Search users, orders, products...']) } }),
  Textarea: r => ({ props: { placeholder: 'Tell us more about your use case...', rows: r.int(2, 5) } }),
  Checkbox: r => ({ props: { label: r.pick(['Remember me', 'I agree to the Terms of Service and Privacy Policy', 'Email notifications']), checked: r.chance(0.5) } }),
  RadioGroup: r => ({ props: { options: opts(['Free', 'Pro', 'Enterprise']), selected: 'pro' } }),
  Switch: r => ({ props: { label: r.pick(['Dark mode', 'Email notifications', 'Enable two-factor authentication for all workspace members']), checked: r.chance(0.5) } }),
  Slider: r => ({ props: { min: 0, max: 100, value: r.int(10, 90), step: 1, label: r.pick(['Volume', 'Budget', 'Opacity']) } }),
  Toggle: r => ({ props: { label: r.pick(['Bold', 'Italic', 'Grid view']), pressed: r.chance(0.5) } }),
  ToggleGroup: r => ({ props: { options: opts(['Day', 'Week', 'Month', 'Year']), selected: 'week' } }),
  Select: r => ({ props: { label: r.pick(['Country', 'Plan', 'Timezone']), options: opts(['United States', 'Germany', 'Japan', 'Brazil']), selected: 'germany' } }),
  CustomSelect: r => ({ props: { placeholder: 'Choose a framework', options: opts(['React', 'Vue', 'Svelte', 'Solid']), searchable: r.chance(0.5) } }),
  Kbd: r => ({ props: { keys: r.pick([['Ctrl', 'K'], ['⌘', 'Shift', 'P'], ['Esc']]) } }),
  Label: r => ({ props: { text: r.pick(['Email address', 'Workspace name', 'API key']), required: r.chance(0.5) } }),
  Spinner: r => ({ props: { size: r.pick(['sm', 'lg', undefined]) } }),
  InputOTP: r => ({ props: { length: 6, separator: r.chance(0.5) } }),
  Breadcrumbs: r => ({ props: { items: [{ label: 'Home', href: '#' }, { label: 'Projects', href: '#' }, { label: title(r) }] } }),
  Pagination: r => ({ props: { current: r.int(1, 3), total: r.pick([30, 120, 480]), perPage: 10 } }),
  Stepper: r => ({ props: { steps: [{ label: 'Account', status: 'completed' }, { label: 'Billing details', status: 'active' }, { label: 'Review', status: 'pending' }, { label: 'Confirm', status: 'pending' }], vertical: r.chance(0.3) } }),
  NavMenu: r => ({ props: { items: [{ label: 'Overview', href: '#', active: true }, { label: 'Analytics', href: '#' }, { label: 'Reports', href: '#' }, { label: 'Settings', href: '#' }] } }),
  Menubar: r => ({ props: { items: [{ label: 'File', dropdown: [{ label: 'New' }, { label: 'Open' }] }, { label: 'Edit', dropdown: [{ label: 'Undo' }] }, { label: 'View' }] } }),
  BottomNav: r => ({ props: { items: [{ label: 'Home', icon: 'house', active: true }, { label: 'Search', icon: 'search' }, { label: 'Inbox', icon: 'inbox', badge: '3' }, { label: 'Profile', icon: 'user' }] } }),
  Table: r => ({ props: { columns: [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }, { key: 'amount', label: 'Amount', numeric: true }], rows: [0, 1, 2, 3].map(() => ({ name: r.pick(NAMES), email: cellText(r), status: r.pick(['Active', 'Pending', 'Failed']), amount: '$' + r.int(10, 9000) + '.00' })) } }),
  DataTable: r => ({ props: { selectable: r.chance(0.5), columns: [{ key: 'id', label: 'Order' }, { key: 'customer', label: 'Customer' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total' }], rows: [0, 1, 2, 3, 4].map(i => ({ id: '#' + (1040 + i), customer: cellText(r), date: '2026-09-1' + i, status: r.pick(['Shipped', 'Processing', 'Cancelled']), total: '$' + r.int(10, 900) })) } }),
  List: r => ({ props: { items: [0, 1, 2].map(() => ({ title: r.pick(NAMES), secondary: r.chance(0.3) ? r.pick(LONG_TOKENS) : r.pick(['Admin', 'Editor', 'Viewer']), icon: r.chance(0.5) ? r.pick(ICONS) : undefined })) } }),
  Badge: r => ({ props: { text: r.pick(['New', 'Beta', 'Pro', 'Out of stock', '3']), variant: r.pick(['new', 'updated', 'success', 'warning', 'error', undefined]) } }),
  Avatar: r => { const n = r.pick(NAMES); return { props: r.chance(0.5) ? { src: avatarSrc(r), size: r.pick(['sm', 'md', 'lg']) } : { initials: initials(n), size: r.pick(['sm', 'md', 'lg']) } }; },
  AvatarGroup: r => ({ props: { avatars: NAMES.slice(0, 5).map(n => ({ initials: initials(n) })), max: r.int(3, 5) } }),
  Calendar: () => ({ props: { selected: '2026-09-18', today: '2026-09-12' } }),
  Chart: r => ({ props: { bars: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(l => ({ label: l, value: r.int(5, 100) })) } }),
  Carousel: r => ({ props: { slides: [{ content: title(r) }, { content: title(r) }, { content: title(r) }] } }),
  AspectRatio: r => ({ props: { ratio: r.pick(['16-9', '4-3', '1-1']) }, kids: [['img', { type: 'Image', props: { src: img(r, 800, 450), alt: 'Preview' } }]] }),
  Chip: r => ({ props: { label: r.pick(['Design', 'Engineering', 'Marketing', 'Remote-first']), color: r.pick(['red', 'green', 'blue', 'purple', 'amber', undefined]), closable: r.chance(0.4) } }),
  Image: r => ({ props: { src: img(r, 800, 500), alt: 'Product photo', ...(r.chance(0.2) ? { width: r.pick([320, 640]), height: 240 } : {}) } }),
  Alert: r => ({ props: { type: r.pick(['info', 'warning', 'error', 'success']), title: title(r), message: sentence(r) } }),
  Progress: r => ({ props: { value: r.int(5, 95) } }),
  Skeleton: r => ({ props: { variant: r.pick(['text', 'heading', 'avatar', 'btn']), lines: r.int(1, 3) } }),
  EmptyState: r => ({ props: { icon: r.pick(ICONS), title: 'No projects yet', message: sentence(r) } }),
  Tooltip: r => ({ props: { text: 'Copies the link to your clipboard', position: r.pick(['top', 'bottom', 'left', 'right']) }, kids: [['btn', { type: 'Button', props: { label: 'Copy link', variant: 'secondary' } }]] }),
  HoverCard: r => ({ props: {}, kids: [['txt', { type: 'Text', props: { tag: 'p', content: sentence(r) } }]] }),
  ContextMenu: () => ({ props: { items: [{ label: 'Copy', icon: 'copy' }, { separator: true }, { label: 'Delete', icon: 'trash-2' }] } }),
  CommandPalette: () => ({ props: { placeholder: 'Type a command...', groups: [{ label: 'Pages', items: [{ label: 'Dashboard', icon: 'layout-dashboard', shortcut: 'G D' }] }] } }),
  AlertDialog: r => ({ props: { title: 'Delete project?', description: sentence(r) } }),
  DatePicker: () => ({ props: { label: 'Start date', placeholder: 'Pick a date' } }),
  StatCard: r => ({ props: { label: r.pick(TITLES), value: r.pick(['$48,295', '12,493', '98.2%', '1.2M']), trend: r.pick(['up', 'down']), trendValue: r.pick(['12.5%', '3 this week']), ...(r.chance(0.5) ? { icon: r.pick(ICONS) } : {}), horizontal: r.chance(0.2) } }),
  Field: r => ({ props: { label: r.pick(['Email', 'Company name', 'Billing email address']), placeholder: r.pick(['you@company.com', 'Acme Inc.']), helper: r.chance(0.5) ? 'We will never share your email.' : undefined } }),
};
export const LEAF_TYPES = Object.keys(LEAF);

// Leaves that make sense in constrained containers (AI specs do this; the rest is noise).
const FORM_LEAVES = ['Input', 'Search', 'Textarea', 'Select', 'CustomSelect', 'Checkbox', 'RadioGroup', 'Switch', 'Slider', 'Toggle', 'ToggleGroup', 'InputOTP', 'DatePicker', 'Button', 'Kbd', 'Label', 'Text'];
const TRIGGER_LEAVES = ['Button', 'Avatar', 'Icon', 'Badge', 'Chip', 'Text', 'Link', 'Toggle'];
const NAV_LEAVES = ['NavMenu', 'Button', 'ButtonGroup', 'Search', 'Input', 'Avatar', 'AvatarGroup', 'Badge', 'Chip', 'Link', 'Icon', 'Switch', 'Toggle', 'ToggleGroup', 'Breadcrumbs', 'Menubar', 'Kbd', 'Text', 'Select', 'CustomSelect'];

// ---- realistic prop pool mined from the block library ------------------------
// Half the time a leaf uses a props object copied from a real block spec instead
// of the fixture, so the generator exercises prop shapes AI actually writes.
let MINED = null;
function minedPool(blockSpecs) {
  if (MINED) return MINED;
  MINED = {};
  for (const b of blockSpecs) {
    for (const def of Object.values(b.spec.elements || {})) {
      if (!def || !LEAF[def.type] || (def.children && def.children.length) || (def.props && (def.props.children || def.props.footer))) continue;
      if (['ButtonGroup', 'Tooltip', 'HoverCard', 'AspectRatio'].includes(def.type)) continue;
      (MINED[def.type] ||= []).push(def.props || {});
    }
  }
  return MINED;
}

// Add a leaf of `type` to `els` under id `id`. Returns id.
function addLeaf(els, id, type, r, pool) {
  const mined = pool && pool[type];
  let props, kids;
  if (mined && mined.length && r.chance(0.5)) {
    props = JSON.parse(JSON.stringify(r.pick(mined)));
  } else {
    ({ props, kids } = LEAF[type](r));
    props = JSON.parse(JSON.stringify(props)); // drop undefined
  }
  const def = { type, props };
  if (kids) {
    def.children = kids.map(([suffix, kdef]) => { els[`${id}-${suffix}`] = kdef; return `${id}-${suffix}`; });
  }
  if (type === 'AlertDialog' || type === 'CommandPalette') props.id = `${id}-ov`;
  els[id] = def;
  return id;
}

// ---- container variants ------------------------------------------------------
// build(els, id, childIds, r) -> writes the container def; open: how the harness opens it.
// leafCount: how many instances of the leaf the pair puts in the container.
const CONTAINERS = [
  { key: 'stack-v', leafCount: 2, build: (els, id, ch) => { els[id] = { type: 'Stack', props: { direction: 'vertical', gap: 3 }, children: ch }; } },
  { key: 'stack-h', leafCount: 3, build: (els, id, ch) => { els[id] = { type: 'Stack', props: { direction: 'horizontal', gap: 3, align: 'center' }, children: ch }; } },
  { key: 'grid-2', leafCount: 4, build: (els, id, ch) => { els[id] = { type: 'Grid', props: { columns: 2, gap: 3 }, children: ch }; } },
  { key: 'grid-3', leafCount: 4, build: (els, id, ch) => { els[id] = { type: 'Grid', props: { columns: 3, gap: 3 }, children: ch }; } },
  { key: 'grid-4', leafCount: 4, build: (els, id, ch) => { els[id] = { type: 'Grid', props: { columns: 4, gap: 3 }, children: ch }; } },
  { key: 'card', leafCount: 1, build: (els, id, ch, r) => {
    els[`${id}-f1`] = { type: 'Button', props: { label: 'Save changes', variant: 'primary' } };
    els[`${id}-f2`] = { type: 'Button', props: { label: 'Cancel', variant: 'ghost' } };
    els[id] = { type: 'Card', props: { title: title(r), description: sentence(r), footer: [`${id}-f1`, `${id}-f2`] }, children: [...ch, `${id}-f1`, `${id}-f2`] };
  } },
  { key: 'surface', leafCount: 1, build: (els, id, ch, r) => { els[id] = { type: 'Surface', props: r.chance(0.5) ? { variant: 'raised' } : {}, children: ch }; } },
  { key: 'tabs', leafCount: 1, build: (els, id, ch, r) => {
    els[`${id}-t2`] = { type: 'Text', props: { tag: 'p', content: sentence(r) } };
    els[`${id}-t3`] = { type: 'Text', props: { tag: 'p', content: sentence(r) } };
    els[id] = { type: 'Tabs', props: { tabs: [{ label: 'Overview', id: 'overview' }, { label: 'Activity', id: 'activity' }, { label: 'Settings', id: 'settings' }], active: 'overview' }, children: [...ch, `${id}-t2`, `${id}-t3`] };
  } },
  { key: 'accordion', leafCount: 1, build: (els, id, ch, r) => {
    els[id] = { type: 'Accordion', props: { items: [{ title: title(r), children: ch }, { title: 'Billing questions', content: sentence(r) }] } };
  } },
  { key: 'collapsible', leafCount: 1, open: 'Collapsible', build: (els, id, ch) => { els[id] = { type: 'Collapsible', props: { label: 'Advanced options' }, children: ch }; } },
  { key: 'scroll-v', leafCount: 2, build: (els, id, ch) => { els[id] = { type: 'ScrollArea', props: { direction: 'vertical' }, children: ch }; } },
  { key: 'scroll-h', leafCount: 3, build: (els, id, ch) => { els[id] = { type: 'ScrollArea', props: { direction: 'horizontal' }, children: ch }; } },
  { key: 'chartcard', leafCount: 1, build: (els, id, ch, r) => { els[id] = { type: 'ChartCard', props: { title: title(r) }, children: ch }; } },
  { key: 'modal', leafCount: 1, open: 'Modal', build: (els, id, ch, r) => {
    els[`${id}-ok`] = { type: 'Button', props: { label: 'Confirm', variant: 'primary' } };
    els[id] = { type: 'Modal', props: { id: `${id}-ov`, title: title(r), footer: [`${id}-ok`] }, children: [...ch, `${id}-ok`] };
  } },
  { key: 'sheet', leafCount: 1, open: 'Sheet', build: (els, id, ch, r) => { els[id] = { type: 'Sheet', props: { id: `${id}-ov`, position: 'right', title: title(r) }, children: ch }; } },
  { key: 'drawer', leafCount: 1, open: 'Drawer', build: (els, id, ch) => { els[id] = { type: 'Drawer', props: { id: `${id}-ov` }, children: ch }; } },
  { key: 'popover', leafCount: 1, open: 'Popover', build: (els, id, ch) => {
    els[`${id}-trg`] = { type: 'Button', props: { label: 'Details', variant: 'secondary' } };
    els[id] = { type: 'Popover', props: { position: 'bottom' }, children: [`${id}-trg`, ...ch] };
  } },
  { key: 'dropdown', leafCount: 1, open: 'DropdownMenu', leaves: TRIGGER_LEAVES, build: (els, id, ch) => {
    els[id] = { type: 'DropdownMenu', props: { items: [{ groupLabel: 'Account' }, { label: 'Profile', icon: 'user' }, { label: 'Billing', icon: 'credit-card' }, { separator: true }, { label: 'Sign out of all workspaces', icon: 'log-out' }] }, children: ch };
  } },
  { key: 'sidebar-row', leafCount: 1, build: (els, id, ch, r) => {
    els[`${id}-sb`] = { type: 'Sidebar', props: { sections: [{ title: 'Workspace', items: [{ label: 'Dashboard', icon: 'layout-dashboard', active: true }, { label: 'Projects', icon: 'folder' }, { label: 'Team', icon: 'users' }] }] } };
    els[`${id}-h`] = { type: 'Text', props: { tag: 'h2', content: title(r) } };
    els[`${id}-main`] = { type: 'Stack', props: { direction: 'vertical', gap: 3 }, children: [`${id}-h`, ...ch] };
    els[id] = { type: 'Stack', props: { direction: 'horizontal', gap: 0 }, children: [`${id}-sb`, `${id}-main`] };
  } },
  { key: 'navbar', leafCount: 1, leaves: NAV_LEAVES, build: (els, id, ch) => {
    els[`${id}-cta`] = { type: 'Button', props: { label: 'Sign up', variant: 'primary' } };
    els[id] = { type: 'Navbar', props: { brand: 'Acme Analytics' }, children: [...ch, `${id}-cta`] };
  } },
  { key: 'field', leafCount: 1, leaves: FORM_LEAVES, build: (els, id, ch) => { els[id] = { type: 'Field', props: { label: 'Workspace setting', helper: 'Applies to every member of the workspace.' }, children: ch }; } },
  { key: 'input-group', leafCount: 1, leaves: FORM_LEAVES, build: (els, id, ch) => { els[id] = { type: 'InputGroup', props: { addonBefore: '$', addonAfter: 'USD' }, children: ch }; } },
  { key: 'input-icon', leafCount: 1, leaves: FORM_LEAVES, build: (els, id, ch) => { els[id] = { type: 'InputIcon', props: { icon: 'search' }, children: ch }; } },
];
export const CONTAINER_KEYS = CONTAINERS.map(c => c.key);

// ---- (a) pairs ---------------------------------------------------------------
export function genPairs(seed, blockSpecs, { allPairs = false } = {}) {
  const pool = minedPool(blockSpecs);
  const out = [];
  for (const c of CONTAINERS) {
    const leaves = allPairs || !c.leaves ? LEAF_TYPES : c.leaves;
    for (const leaf of leaves) {
      const id = `pair--${c.key}--${leaf}`;
      const r = makeRng(`${seed}:${id}`);
      const els = {};
      const ch = [];
      for (let i = 0; i < c.leafCount; i++) ch.push(addLeaf(els, `L${i}`, leaf, r, pool));
      c.build(els, 'C', ch, r);
      const open = c.open ? [{ type: c.open, id: 'C' }] : [];
      out.push({ id, kind: 'pair', container: c.key, leaf, spec: { root: 'C', elements: els }, open });
    }
  }
  return out;
}

// ---- (b) random trees --------------------------------------------------------
// Container / leaf weights follow real usage in blocks + AI outputs (Stack, Card,
// Grid, Surface dominate), with a floor so rare types still show up.
const RAND_CONTAINERS = [
  ['Stack-v', 30], ['Stack-h', 18], ['Grid', 14], ['Card', 16], ['Surface', 8], ['Tabs', 3], ['Accordion', 2],
  ['Collapsible', 2], ['ScrollArea', 3], ['ChartCard', 3], ['Modal', 2], ['Sheet', 1], ['Drawer', 1], ['Popover', 1], ['Navbar', 2], ['SidebarRow', 2],
];
function leafWeights() {
  const common = { Text: 40, Button: 20, Badge: 8, Input: 6, Field: 6, Avatar: 5, Image: 5, Icon: 5, Chip: 5, Link: 4, StatCard: 5, List: 3, Separator: 4, Checkbox: 3, Switch: 3, Select: 3, Progress: 2, Prose: 2, Alert: 2, Table: 2, DataTable: 2, Chart: 2 };
  return LEAF_TYPES.map(t => [t, common[t] || 1]);
}

export function genRandom(seed, count, blockSpecs) {
  const pool = minedPool(blockSpecs);
  const lw = leafWeights();
  const out = [];
  for (let n = 0; n < count; n++) {
    const id = `rand--s${seed}--${String(n).padStart(4, '0')}`;
    const r = makeRng(`${seed}:${id}`);
    const target = r.int(4, 12);
    const depth = r.int(2, 3);
    const els = {};
    const open = [];
    let seq = 0;
    let overlayUsed = false;
    const nextId = (p) => `${p}${seq++}`;
    // Pick a container kind; max one full-screen overlay per tree (they stack otherwise).
    const pickContainer = () => {
      for (;;) {
        const k = r.weighted(RAND_CONTAINERS);
        if (['Modal', 'Sheet', 'Drawer'].includes(k)) { if (overlayUsed) continue; overlayUsed = true; }
        return k;
      }
    };
    // nodes: { id, kind, children: [], level }
    const nodes = [];
    const root = { id: nextId('c'), kind: pickContainer(), children: [], level: 0 };
    nodes.push(root);
    let count = 1;
    // Force a container chain to reach `depth` levels of nesting.
    let cur = root;
    for (let lv = 1; lv < depth && count < target - 1; lv++) {
      const c = { id: nextId('c'), kind: pickContainer(), children: [], level: lv };
      cur.children.push(c); nodes.push(c); count++; cur = c;
    }
    // Every container needs at least one child; then fill the rest at random.
    const containers = () => nodes.filter(x => x.kind);
    for (const c of containers()) if (!c.children.length) { c.children.push({ id: nextId('l'), leaf: r.weighted(lw) }); count++; }
    while (count < target) {
      const parent = r.pick(containers());
      if (parent.level < depth - 1 && r.chance(0.25)) {
        const c = { id: nextId('c'), kind: pickContainer(), children: [], level: parent.level + 1 };
        c.children.push({ id: nextId('l'), leaf: r.weighted(lw) });
        parent.children.push(c); nodes.push(c); count += 2;
      } else {
        parent.children.push({ id: nextId('l'), leaf: r.weighted(lw) }); count++;
      }
    }
    // Emit
    const emit = (node) => {
      if (node.leaf) return addLeaf(els, node.id, node.leaf, r, pool);
      const ch = node.children.map(emit);
      const id = node.id;
      switch (node.kind) {
        case 'Stack-v': els[id] = { type: 'Stack', props: { direction: 'vertical', gap: r.int(1, 4) }, children: ch }; break;
        case 'Stack-h': els[id] = { type: 'Stack', props: { direction: 'horizontal', gap: r.int(1, 4), ...(r.chance(0.4) ? { justify: 'between' } : {}), ...(r.chance(0.4) ? { align: 'center' } : {}) }, children: ch }; break;
        case 'Grid': els[id] = { type: 'Grid', props: { columns: r.int(2, 4), gap: r.int(2, 4) }, children: ch }; break;
        case 'Card': {
          const props = { title: title(r) };
          if (r.chance(0.5)) props.description = sentence(r);
          if (ch.length > 1 && r.chance(0.35) && els[ch[ch.length - 1]].type === 'Button') props.footer = [ch[ch.length - 1]];
          els[id] = { type: 'Card', props, children: ch }; break;
        }
        case 'Surface': els[id] = { type: 'Surface', props: r.chance(0.4) ? { variant: 'raised' } : {}, children: ch }; break;
        case 'Tabs': els[id] = { type: 'Tabs', props: { tabs: ch.map((c, i) => ({ label: ['Overview', 'Activity', 'Settings', 'Billing', 'Members'][i % 5], id: 't' + i })), active: 't0' }, children: ch }; break;
        case 'Accordion': els[id] = { type: 'Accordion', props: { items: ch.map((c, i) => ({ title: title(r), children: [c] })) } }; break;
        case 'Collapsible': els[id] = { type: 'Collapsible', props: { label: 'Show details' }, children: ch }; open.push({ type: 'Collapsible', id }); break;
        case 'ScrollArea': els[id] = { type: 'ScrollArea', props: { direction: r.pick(['vertical', 'horizontal']) }, children: ch }; break;
        case 'ChartCard': els[id] = { type: 'ChartCard', props: { title: title(r) }, children: ch }; break;
        case 'Modal': els[id] = { type: 'Modal', props: { id: `${id}-ov`, title: title(r) }, children: ch }; open.push({ type: 'Modal', id }); break;
        case 'Sheet': els[id] = { type: 'Sheet', props: { id: `${id}-ov`, position: r.pick(['right', 'left', 'bottom']), title: title(r) }, children: ch }; open.push({ type: 'Sheet', id }); break;
        case 'Drawer': els[id] = { type: 'Drawer', props: { id: `${id}-ov` }, children: ch }; open.push({ type: 'Drawer', id }); break;
        case 'Popover': {
          const trg = `${id}-trg`;
          els[trg] = { type: 'Button', props: { label: 'More', variant: 'secondary' } };
          els[id] = { type: 'Popover', props: { position: r.pick(['bottom', 'top', 'right']) }, children: [trg, ...ch] };
          open.push({ type: 'Popover', id }); break;
        }
        case 'Navbar': els[id] = { type: 'Navbar', props: { brand: 'Acme' }, children: ch }; break;
        case 'SidebarRow': {
          const sb = `${id}-sb`, main = `${id}-main`;
          els[sb] = { type: 'Sidebar', props: { sections: [{ title: 'Menu', items: [{ label: 'Dashboard', icon: 'layout-dashboard', active: true }, { label: 'Settings', icon: 'settings' }] }] } };
          els[main] = { type: 'Stack', props: { direction: 'vertical', gap: 3 }, children: ch };
          els[id] = { type: 'Stack', props: { direction: 'horizontal', gap: 0 }, children: [sb, main] }; break;
        }
      }
      return id;
    };
    const rootId = emit(root);
    const shape = nodes.map(x => x.kind).join('>');
    out.push({ id, kind: 'random', shape, spec: { root: rootId, elements: els }, open });
  }
  return out;
}

// ---- (c) block library -------------------------------------------------------
export function loadBlocks(root) {
  const dir = join(root, 'blocks');
  const out = [];
  for (const cat of readdirSync(dir).sort()) {
    const cdir = join(dir, cat);
    if (!statSync(cdir).isDirectory() || cat === 'thumbs') continue;
    for (const f of readdirSync(cdir).sort()) {
      if (!f.endsWith('.json')) continue;
      try {
        const spec = JSON.parse(readFileSync(join(cdir, f), 'utf8'));
        if (!spec || !spec.root || !spec.elements) continue;
        out.push({ id: `block--${cat}--${f.replace(/\.json$/, '')}`, kind: 'block', file: `blocks/${cat}/${f}`, spec, open: [] });
      } catch { /* skip malformed */ }
    }
  }
  return out;
}
