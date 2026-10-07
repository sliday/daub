#!/usr/bin/env node
// Generates functions/_lib/blocks-catalog.js from blocks/index.json.
// The output statically imports every block spec so wrangler bundles them into the
// Pages Functions worker, and gives each block a one-line purpose for the Jev picker.
//
//   node scripts/build-blocks-catalog.mjs          # write the module
//   node scripts/build-blocks-catalog.mjs --check  # exit 1 when the module is stale
//
// Descriptions: OVERRIDES below win, then a curated one from the BLOCK_INDEX in
// functions/api/mcp.js; the generic boilerplate ones ("X block for y", "N elements") are replaced by a summary
// built from the spec's structure (layout, distinctive components). Sample copy stays out:
// Jev scored a headphones product-detail block 0.16 for "product page for running shoes"
// when its headline was in the description.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'functions/_lib/blocks-catalog.js');
const MAX_DESC = 150;

const GENERIC = /block for |variant using |screen with \d+ elements/i;
const PLAIN_TYPES = new Set(['Stack', 'Text', 'Surface', 'Separator', 'Grid', 'Card', 'Badge', 'Chip', 'Icon', 'Spacer']);

function curatedDescriptions() {
  const src = readFileSync(join(ROOT, 'functions/api/mcp.js'), 'utf8');
  const start = src.indexOf('const BLOCK_INDEX = [');
  const out = new Map();
  if (start < 0) return out;
  const end = src.indexOf('\n];', start);
  for (const line of src.slice(start, end).split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      const b = JSON.parse(t.replace(/,$/, ''));
      if (b.id && b.description && !GENERIC.test(b.description)) out.set(b.id, b.description);
    } catch {}
  }
  return out;
}

// Purpose lines for blocks whose kind name and components leave Jev guessing. Structure
// only, checked against each spec; no sample copy.
const OVERRIDES = {
  'api-reference-01': 'Endpoint list with HTTP method badges, paths and descriptions for developer docs',
  'table-of-contents-01': 'In-page navigation list for long docs or articles',
  'content-split-01': 'Two-column text section: heading and intro beside a bulleted list',
  'content-section-01': 'Long-form text section with image and buttons',
  'vs-layout-01': 'Side-by-side comparison of two options with a verdict',
  'social-proof-bar-01': 'Strip of trust numbers: customer count, star rating, review sites',
  'stats-counter-01': 'Row of large headline numbers with labels',
  'process-alternating-01': 'Numbered process steps with alternating image and text',
  'changelog-01': 'Dated release notes with version badges',
  'changelog-page-01': 'Dated release notes with version badges',
  'kanban-board-01': 'Task board with to-do, in-progress and done columns of cards',
  'event-countdown-01': 'Event hero with date, venue, countdown and register buttons',
  'feature-with-code-01': 'Developer feature section with a code sample',
  'review-stars-01': 'Rating summary with average score, star distribution bars and reviews',
  'category-grid-01': 'Shop-by-category image tiles with product counts',
  'dashboard-header-01': 'Dashboard title with date range picker and actions',
  'activity-feed-01': 'Recent activity list',
  'press-mentions-01': 'As-featured-in row of publication names',
  'speaker-grid-01': 'Grid of speaker cards with photo, name, role and talk tag',
  'schedule-tabs-01': 'Event agenda tabbed by day with session lists',
  'header-01': 'App top bar with search, notifications, user menu, breadcrumbs and tabs',
};

const WORDS = { cta: 'call-to-action', faq: 'FAQ', api: 'API', bg: 'background', vs: 'versus', kpi: 'KPI' };

function humanize(sub) {
  const s = String(sub || '').split('-').map(w => WORDS[w] || w).join(' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function layoutOf(spec) {
  const root = spec.elements[spec.root] || {};
  const p = root.props || {};
  if (root.type === 'Grid' && Number(p.columns) === 2) return 'two-column split';
  if (p.container === 'narrow') return 'narrow centered';
  return '';
}

function summarize(spec) {
  const types = [];
  for (const el of Object.values(spec.elements)) {
    if (!PLAIN_TYPES.has(el.type) && !types.includes(el.type)) types.push(el.type);
  }
  const parts = [];
  const layout = layoutOf(spec);
  if (layout) parts.push(layout);
  if (types.length) parts.push('uses ' + types.slice(0, 5).join(', '));
  return parts.join('; ');
}

function build() {
  const index = JSON.parse(readFileSync(join(ROOT, 'blocks/index.json'), 'utf8'));
  const curated = curatedDescriptions();
  const imports = [];
  const rows = [];
  index.forEach((meta, i) => {
    const spec = JSON.parse(readFileSync(join(ROOT, 'blocks', meta.file), 'utf8'));
    const name = humanize(meta.subcategory || meta.id.replace(/-\d+$/, ''));
    let desc = OVERRIDES[meta.id] || curated.get(meta.id) || (!GENERIC.test(meta.description || '') && meta.description) || '';
    const summary = summarize(spec);
    desc = desc ? `${name}: ${desc}` : summary ? `${name}: ${summary}` : name;
    if (desc.length > MAX_DESC) desc = desc.slice(0, MAX_DESC - 1) + '…';
    imports.push(`import b${i} from '../../blocks/${meta.file}' with { type: 'json' };`);
    rows.push(`  { id: ${JSON.stringify(meta.id)}, category: ${JSON.stringify(meta.category)}, ` +
      `subcategory: ${JSON.stringify(meta.subcategory || '')}, description: ${JSON.stringify(desc)}, spec: b${i} },`);
  });
  return [
    '// GENERATED by scripts/build-blocks-catalog.mjs from blocks/index.json. Do not edit by hand.',
    '// Static JSON imports let wrangler bundle every block spec into the Pages Functions worker.',
    '// This module exports data only (no onRequest* handler), so Pages does not route it.',
    '',
    ...imports,
    '',
    'export const BLOCKS = [',
    ...rows,
    '];',
    '',
  ].join('\n');
}

const code = build();
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(OUT, 'utf8'); } catch {}
  if (current !== code) {
    console.error('functions/_lib/blocks-catalog.js is stale; run node scripts/build-blocks-catalog.mjs');
    process.exit(1);
  }
  console.log('blocks catalog up to date');
} else {
  writeFileSync(OUT, code);
  console.log(`wrote ${OUT}`);
}
