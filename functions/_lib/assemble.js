// Instant page assembly: one Jev decision (archetype + theme + dark + one yes/no per block)
// followed by deterministic composition of curated blocks. Data/logic only: no onRequest*
// export, so Pages does not route this file. Used by functions/api/assemble.js.

import { ARCHETYPES, SLOT_ORDER, THEME_FAMILIES, slotIndex } from './archetypes.js';

export const RESERVED_KEYS = ['archetype', 'theme', 'dark'];

export const DEFAULTS = {
  optionalThreshold: 0.65, // an optional recipe section needs its best block at or above this
  extraThreshold: 0.85, // a slot outside the recipe joins the page only at this P or higher
  maxExtras: 2,
  darkThreshold: 0.5,
  // preview: true when the page is worth painting as a draft while the LLM streams. Measured on
  // the 34-prompt benchmark: shows all 11 good previews, hides all 3 wrong pages. Confidence
  // alone is not enough (a docs page with only a navbar and a TOC scored 0.97).
  previewConfidence: 0.6,
  previewCoverage: 0.5,
};

// Page chrome fits nearly any page, so a low P there means "the user did not mention a
// navbar", not "wrong page". Confidence ignores chrome.
const CHROME = new Set(['announcement', 'nav', 'app-header', 'breadcrumbs', 'footer']);

// Slots some archetype can place (as a section or an extra). Only their blocks get a question.
export function usedSlots(archetypes = ARCHETYPES) {
  const used = new Set();
  for (const a of Object.values(archetypes)) {
    for (const [slot] of a.sections) used.add(slot);
    for (const slot of a.extras) used.add(slot);
  }
  return used;
}

export function candidateBlocks(blocks, archetypes = ARCHETYPES) {
  const idx = slotIndex(blocks);
  const ids = new Set();
  for (const slot of usedSlots(archetypes)) for (const b of idx[slot] || []) ids.add(b.id);
  return blocks.filter(b => ids.has(b.id));
}

const BLOCK_CRITERIA = {
  true: 'The requested page calls for this kind of section. Judge the section type and layout; its sample copy gets rewritten.',
  false: 'This kind of section does not belong on the requested page.',
};

// Builds the Decisions API `questions` object. Block ids are the question keys.
export function buildQuestions(blocks, { archetypes = ARCHETYPES, themes = THEME_FAMILIES } = {}) {
  const questions = {
    archetype: {
      type: 'choice',
      instructions: 'Which kind of page or screen is the user asking for?',
      criteria: Object.fromEntries(Object.entries(archetypes).map(([k, a]) => [k, a.description])),
    },
    theme: {
      type: 'choice',
      instructions: 'Which DAUB theme family best fits the requested product, audience and mood? '
        + 'If the user names a theme or color mood, follow it; pick default when nothing points elsewhere.',
      criteria: Object.fromEntries(Object.entries(themes).map(([k, t]) => [k, t.description])),
    },
    dark: {
      type: 'noul',
      instructions: 'Should the page use a dark color scheme?',
      criteria: {
        true: 'The user asks for dark mode or a dark, night or neon look, or the product is usually dark (developer tools, gaming, music).',
        false: 'The user asks for light mode, or nothing suggests a dark look.',
      },
    },
  };
  for (const b of blocks) {
    if (RESERVED_KEYS.includes(b.id)) throw new Error(`block id collides with a reserved question: ${b.id}`);
    questions[b.id] = {
      type: 'noul',
      instructions: `Would this section belong on the requested page? ${b.description}`,
      criteria: BLOCK_CRITERIA,
    };
  }
  return questions;
}

function rankOf(slot) {
  const i = SLOT_ORDER.indexOf(slot);
  return i < 0 ? SLOT_ORDER.length : i;
}

// Copies a block spec with every element id prefixed. Children that point at missing
// elements are dropped so the merged spec stays valid.
export function namespaceSpec(spec, prefix) {
  const elements = {};
  for (const [id, el] of Object.entries(spec.elements || {})) {
    const copy = { type: el.type, props: structuredClone(el.props || {}) };
    if (Array.isArray(el.children)) {
      copy.children = el.children.filter(c => spec.elements[c]).map(c => prefix + c);
    }
    elements[prefix + id] = copy;
  }
  return { root: prefix + spec.root, elements };
}

// Returns a list of problems; empty means the root exists, every child reference resolves
// and every element is reachable from the root (no orphans).
export function validateSpec(spec) {
  if (!spec || typeof spec !== 'object' || !spec.elements) return ['spec must have elements'];
  const errors = [];
  if (!spec.elements[spec.root]) errors.push(`root "${spec.root}" missing`);
  for (const [id, el] of Object.entries(spec.elements)) {
    for (const c of el.children || []) if (!spec.elements[c]) errors.push(`${id} -> missing child "${c}"`);
  }
  const seen = new Set();
  const stack = [spec.root];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id) || !spec.elements[id]) continue;
    seen.add(id);
    stack.push(...(spec.elements[id].children || []));
  }
  for (const id of Object.keys(spec.elements)) if (!seen.has(id)) errors.push(`orphan "${id}"`);
  return errors;
}

export function themeName(family, dark) {
  const f = Object.hasOwn(THEME_FAMILIES, family) ? THEME_FAMILIES[family] : THEME_FAMILIES.default;
  return dark ? f.dark : f.light;
}

const round2 = n => Math.round(n * 100) / 100;

// Deterministic composition: the same inputs always give the same page.
// scores: { blockId: P(yes) } from the per-block noul questions.
export function assemble({
  archetype,
  archetypeConfidence = 1,
  themeFamily = 'default',
  darkP = 0,
  scores = {},
  blocks,
  options = {},
}) {
  const opts = { ...DEFAULTS, ...options };
  // Own keys only: "constructor" or "toString" must not resolve through Object.prototype.
  const key = Object.hasOwn(ARCHETYPES, archetype) ? archetype : 'custom';
  const arch = ARCHETYPES[key];
  const family = Object.hasOwn(THEME_FAMILIES, themeFamily) ? themeFamily : 'default';
  const theme = themeName(family, darkP >= opts.darkThreshold);
  const idx = slotIndex(blocks);
  const P = id => (typeof scores[id] === 'number' ? scores[id] : 0);
  const taken = new Set();
  // Highest P in the slot; ties go to catalog order.
  const best = slot => {
    let top = null;
    for (const b of idx[slot] || []) {
      if (!taken.has(b.id) && (!top || P(b.id) > P(top.id))) top = b;
    }
    return top;
  };

  const placed = [];
  for (const [slot, kind] of arch.sections) {
    const b = best(slot);
    if (b && (kind === 'core' || P(b.id) >= opts.optionalThreshold)) {
      placed.push({ slot, kind, block: b });
      taken.add(b.id);
    }
  }
  const coverage = arch.sections.length ? placed.length / arch.sections.length : 0;

  const inPage = new Set(placed.map(x => x.slot));
  const extras = arch.extras
    .filter(slot => !inPage.has(slot))
    .map(slot => ({ slot, kind: 'extra', block: best(slot) }))
    .filter(x => x.block && P(x.block.id) >= opts.extraThreshold)
    .sort((a, b) => P(b.block.id) - P(a.block.id))
    .slice(0, opts.maxExtras);
  for (const x of extras) {
    if (taken.has(x.block.id)) continue; // two extra slots can share a block
    // Extras slot in by page order: before the first section that sits lower on a page.
    const at = placed.findIndex(p => rankOf(p.slot) > rankOf(x.slot));
    placed.splice(at < 0 ? placed.length : at, 0, x);
    taken.add(x.block.id);
  }

  const picks = placed.map(x => ({ id: x.block.id, p: P(x.block.id), slot: x.slot, kind: x.kind }));
  const base = { archetype: key, theme, themeFamily: family, picks };
  if (!placed.length) {
    // "custom" archetype, or a recipe with no blocks in the catalog: nothing honest to paint.
    return { ...base, spec: null, confidence: 0, coverage: 0, fallback: 'llm', preview: false };
  }

  const core = picks.filter(x => x.kind === 'core' && !CHROME.has(x.slot));
  const confidence = Math.min(archetypeConfidence, ...(core.length ? core.map(x => x.p) : [0]));

  const elements = {};
  const children = [];
  placed.forEach((x, i) => {
    const ns = namespaceSpec(x.block.spec, `s${i + 1}-`);
    Object.assign(elements, ns.elements);
    children.push(ns.root);
  });
  elements.page = { type: 'Stack', props: { direction: 'vertical', gap: 5 }, children };

  return {
    ...base,
    spec: { theme, root: 'page', elements },
    confidence: round2(confidence),
    coverage: round2(coverage),
    fallback: null,
    preview: round2(confidence) >= opts.previewConfidence && round2(coverage) >= opts.previewCoverage,
  };
}
