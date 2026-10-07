// Tests for the instant assembler: functions/_lib/{blocks-catalog,archetypes,assemble}.js
// and the POST /api/assemble handler with Jev mocked. Run: node --test tests/assemble.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BLOCKS } from '../functions/_lib/blocks-catalog.js';
import { ARCHETYPES, SLOTS, THEME_FAMILIES, slotIndex } from '../functions/_lib/archetypes.js';
import {
  assemble, buildQuestions, candidateBlocks, namespaceSpec, validateSpec, RESERVED_KEYS, DEFAULTS,
} from '../functions/_lib/assemble.js';
import { onRequestPost, onRequestOptions } from '../functions/api/assemble.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const byId = Object.fromEntries(BLOCKS.map(b => [b.id, b]));
const all = p => Object.fromEntries(BLOCKS.map(b => [b.id, p]));

// ---- catalog ----

test('catalog covers blocks/index.json and every block spec is valid', () => {
  const index = JSON.parse(readFileSync(join(ROOT, 'blocks/index.json'), 'utf8'));
  assert.equal(BLOCKS.length, index.length);
  assert.deepEqual(BLOCKS.map(b => b.id), index.map(b => b.id));
  for (const b of BLOCKS) {
    assert.deepEqual(validateSpec(b.spec), [], b.id);
    assert.ok(b.description && b.description.length <= 150, `${b.id} description`);
    assert.ok(!RESERVED_KEYS.includes(b.id), `${b.id} collides with a reserved question key`);
  }
});

test('generated catalog is in sync with the generator', () => {
  execFileSync(process.execPath, [join(ROOT, 'scripts/build-blocks-catalog.mjs'), '--check'], { stdio: 'pipe' });
});

test('THEME_FAMILIES mirrors daub.js', () => {
  const src = readFileSync(join(ROOT, 'daub.js'), 'utf8');
  const body = src.slice(src.indexOf('var THEME_FAMILIES = {'), src.indexOf('};', src.indexOf('var THEME_FAMILIES = {')));
  const fromDaub = {};
  for (const m of body.matchAll(/'([\w-]+)':\s*\{\s*light:\s*'([\w-]+)',\s*dark:\s*'([\w-]+)'\s*\}/g)) {
    fromDaub[m[1]] = { light: m[2], dark: m[3] };
  }
  assert.equal(Object.keys(fromDaub).length, 21);
  const mirror = Object.fromEntries(Object.entries(THEME_FAMILIES).map(([k, v]) => [k, { light: v.light, dark: v.dark }]));
  assert.deepEqual(mirror, fromDaub);
});

test('archetype recipes reference real slots and core slots have blocks', () => {
  const idx = slotIndex(BLOCKS);
  for (const [name, a] of Object.entries(ARCHETYPES)) {
    for (const [slot, kind] of a.sections) {
      assert.ok(SLOTS[slot], `${name}: unknown slot ${slot}`);
      assert.ok(kind === 'core' || kind === 'optional', `${name}: bad kind ${kind}`);
      if (kind === 'core') assert.ok(idx[slot].length > 0, `${name}: core slot ${slot} is empty`);
    }
    for (const slot of a.extras) assert.ok(SLOTS[slot], `${name}: unknown extra slot ${slot}`);
  }
  assert.deepEqual(ARCHETYPES.custom.sections, []);
});

test('questions: archetype + theme choices, dark noul, one noul per candidate block', () => {
  const cands = candidateBlocks(BLOCKS);
  const q = buildQuestions(cands);
  assert.equal(Object.keys(q).length, cands.length + 3);
  assert.equal(q.archetype.type, 'choice');
  assert.deepEqual(Object.keys(q.archetype.criteria), Object.keys(ARCHETYPES));
  assert.deepEqual(Object.keys(q.theme.criteria), Object.keys(THEME_FAMILIES));
  assert.equal(q.dark.type, 'noul');
  for (const b of cands) assert.equal(q[b.id].type, 'noul');
  assert.throws(() => buildQuestions([{ id: 'theme', description: 'x' }]), /reserved/);
});

// ---- namespacing ----

test('namespaceSpec prefixes ids and children, drops dangling children, copies props', () => {
  const spec = {
    root: 'a',
    elements: {
      a: { type: 'Stack', props: { gap: 2 }, children: ['b', 'ghost'] },
      b: { type: 'Text', props: { content: 'hi', style: { color: 'red' } } },
    },
  };
  const ns = namespaceSpec(spec, 's1-');
  assert.equal(ns.root, 's1-a');
  assert.deepEqual(Object.keys(ns.elements).sort(), ['s1-a', 's1-b']);
  assert.deepEqual(ns.elements['s1-a'].children, ['s1-b']);
  assert.equal(ns.elements['s1-b'].children, undefined);
  ns.elements['s1-b'].props.style.color = 'blue';
  assert.equal(spec.elements.b.props.style.color, 'red');
});

test('validateSpec flags elements the root cannot reach', () => {
  const spec = {
    root: 'a',
    elements: {
      a: { type: 'Stack', props: {}, children: ['b'] },
      b: { type: 'Text', props: { content: 'hi' } },
      loose: { type: 'Text', props: { content: 'orphan' } },
    },
  };
  assert.deepEqual(validateSpec(spec), ['orphan "loose"']);
});

test('blocks that share element ids never collide after assembly', () => {
  // Five blocks built from the same element ids ("wrap", "title", and even "page").
  const same = () => ({
    root: 'wrap',
    elements: {
      wrap: { type: 'Stack', props: {}, children: ['title', 'page'] },
      title: { type: 'Text', props: { content: 't' } },
      page: { type: 'Text', props: { content: 'p' } },
    },
  });
  const blocks = [
    ['navbar-simple-01', 'navigation'], ['hero-centered-01', 'hero'], ['feature-grid-01', 'features'],
    ['cta-banner-01', 'cta'], ['footer-simple-01', 'footer'],
  ].map(([id, category]) => ({ id, category, description: id, spec: same() }));
  const r = assemble({ archetype: 'landing', scores: Object.fromEntries(blocks.map(b => [b.id, 1])), blocks });
  assert.equal(r.picks.length, 5);
  assert.equal(Object.keys(r.spec.elements).length, 5 * 3 + 1);
  assert.equal(r.spec.elements.page.type, 'Stack');
  assert.deepEqual(r.spec.elements.page.children, ['s1-wrap', 's2-wrap', 's3-wrap', 's4-wrap', 's5-wrap']);
  assert.deepEqual(r.spec.elements['s3-wrap'].children, ['s3-title', 's3-page']);
  assert.deepEqual(validateSpec(r.spec), []);
});

test('real blocks keep every element after assembly (no overwrites)', () => {
  for (const archetype of ['landing', 'dashboard', 'product', 'about']) {
    const r = assemble({ archetype, scores: all(1), blocks: BLOCKS });
    const expected = r.picks.reduce((n, p) => n + Object.keys(byId[p.id].spec.elements).length, 0) + 1;
    assert.equal(Object.keys(r.spec.elements).length, expected, archetype);
  }
});

// ---- ordering and thresholds ----

test('sections follow the recipe order; optional sections below threshold are skipped', () => {
  const scores = all(0.1);
  Object.assign(scores, {
    'navbar-simple-01': 0.9, 'hero-centered-01': 0.9, 'feature-grid-01': 0.9, 'cta-banner-01': 0.9,
    'footer-simple-01': 0.9, 'faq-accordion-01': 0.7, 'pricing-tiers-01': 0.6,
  });
  const r = assemble({ archetype: 'landing', scores, blocks: BLOCKS });
  assert.deepEqual(r.picks.map(p => p.id), [
    'navbar-simple-01', 'hero-centered-01', 'feature-grid-01', 'faq-accordion-01', 'cta-banner-01', 'footer-simple-01',
  ]);
  assert.deepEqual(r.spec.elements.page.children, r.picks.map((p, i) => `s${i + 1}-${byId[p.id].spec.root}`));
  assert.equal(r.coverage, Math.round((6 / ARCHETYPES.landing.sections.length) * 100) / 100);
  assert.equal(r.confidence, 0.9);
});

test('extras need a high P and land in page order before the footer', () => {
  const scores = all(0);
  Object.assign(scores, {
    'pricing-tiers-01': 0.95, 'footer-simple-01': 0.9, 'navbar-simple-01': 0.9,
    'faq-accordion-01': 0.9, 'testimonial-grid-01': 0.8, 'logo-cloud-simple-01': 0.99,
  });
  const r = assemble({ archetype: 'pricing', scores, blocks: BLOCKS });
  const ids = r.picks.map(p => p.id);
  assert.ok(ids.includes('logo-cloud-simple-01'), 'logos extra at 0.99 joins');
  assert.equal(r.picks.find(p => p.id === 'logo-cloud-simple-01').kind, 'extra');
  assert.ok(!ids.includes('testimonial-grid-01') || r.picks.find(p => p.id === 'testimonial-grid-01').kind !== 'extra');
  assert.equal(ids[ids.length - 1], 'footer-simple-01');
  assert.equal(ids[0], 'navbar-simple-01');
  assert.ok(r.picks.filter(p => p.kind === 'extra').length <= DEFAULTS.maxExtras);
});

test('a block never appears twice even when it sits in two slots', () => {
  // content-numbered-steps sits in article-body; faq-with-sidebar sits in both faq and docs.
  const scores = all(0);
  scores['faq-with-sidebar-01'] = 0.99;
  const r = assemble({ archetype: 'docs', scores, blocks: BLOCKS });
  const ids = r.picks.map(p => p.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual(validateSpec(r.spec), []);
});

// ---- fallbacks ----

test('empty scores: core sections fall back to catalog order with confidence 0', () => {
  const r = assemble({ archetype: 'login', scores: {}, blocks: BLOCKS });
  const firstLogin = slotIndex(BLOCKS).login[0].id;
  assert.deepEqual(r.picks.map(p => p.id), [firstLogin]);
  assert.equal(r.confidence, 0);
  assert.equal(r.coverage, 1);
  assert.equal(r.fallback, null);
  assert.deepEqual(validateSpec(r.spec), []);
});

test('custom or unknown archetype: no spec, fallback to the LLM', () => {
  for (const archetype of ['custom', 'no-such-page', undefined]) {
    const r = assemble({ archetype, scores: all(0.99), blocks: BLOCKS });
    assert.equal(r.spec, null);
    assert.equal(r.fallback, 'llm');
    assert.equal(r.archetype, 'custom');
    assert.deepEqual(r.picks, []);
    assert.equal(r.confidence, 0);
  }
});

test('empty catalog: every archetype falls back to the LLM', () => {
  const r = assemble({ archetype: 'landing', scores: {}, blocks: [] });
  assert.equal(r.spec, null);
  assert.equal(r.fallback, 'llm');
});

// ---- validity, theme, determinism ----

test('every archetype assembles a valid spec (root exists, all children exist)', () => {
  for (const archetype of Object.keys(ARCHETYPES).filter(a => a !== 'custom')) {
    for (const scores of [all(1), all(0), {}]) {
      const r = assemble({ archetype, scores, blocks: BLOCKS });
      assert.deepEqual(validateSpec(r.spec), [], archetype);
      assert.equal(r.spec.root, 'page');
      assert.equal(r.spec.elements.page.type, 'Stack');
      assert.deepEqual(r.spec.elements.page.props, { direction: 'vertical', gap: 5 });
      assert.equal(r.spec.elements.page.children.length, r.picks.length);
    }
  }
});

test('preview needs a real page, confidence >= 0.6 and coverage >= 0.5', () => {
  const idx = slotIndex(BLOCKS);
  const onlyCore = arch => {
    const scores = all(0.1);
    for (const [slot, kind] of ARCHETYPES[arch].sections) {
      if (kind === 'core') for (const b of idx[slot]) scores[b.id] = 0.9;
    }
    return scores;
  };
  const login = assemble({ archetype: 'login', archetypeConfidence: 0.95, scores: onlyCore('login'), blocks: BLOCKS });
  assert.equal(login.preview, true);
  const lowConf = assemble({ archetype: 'login', archetypeConfidence: 0.55, scores: onlyCore('login'), blocks: BLOCKS });
  assert.equal(lowConf.preview, false);
  // Landing with only its 5 core sections: confident, but 5/11 of the recipe.
  const thin = assemble({ archetype: 'landing', archetypeConfidence: 0.95, scores: onlyCore('landing'), blocks: BLOCKS });
  assert.equal(thin.confidence, 0.9);
  assert.equal(thin.coverage, 0.45);
  assert.equal(thin.preview, false);
  assert.equal(assemble({ archetype: 'custom', archetypeConfidence: 1, blocks: BLOCKS }).preview, false);
});

test('theme follows family and dark probability', () => {
  const base = { archetype: 'login', scores: {}, blocks: BLOCKS };
  assert.equal(assemble({ ...base, themeFamily: 'nord', darkP: 0.9 }).theme, 'nord');
  assert.equal(assemble({ ...base, themeFamily: 'nord', darkP: 0.1 }).theme, 'nord-light');
  assert.equal(assemble({ ...base, themeFamily: 'github', darkP: 0.2 }).spec.theme, 'github');
  assert.equal(assemble({ ...base, themeFamily: 'bogus', darkP: 0.9 }).theme, 'dark');
  assert.equal(assemble({ ...base }).theme, 'light');
  // Object.prototype keys are not archetypes or theme families.
  assert.equal(assemble({ ...base, themeFamily: 'toString', darkP: 0.9 }).theme, 'dark');
  assert.equal(assemble({ ...base, archetype: 'constructor' }).fallback, 'llm');
});

test('assembly is deterministic', () => {
  const scores = Object.fromEntries(BLOCKS.map((b, i) => [b.id, ((i * 37) % 100) / 100]));
  const a = assemble({ archetype: 'landing', scores, blocks: BLOCKS, themeFamily: 'ember', darkP: 0.7 });
  const b = assemble({ archetype: 'landing', scores, blocks: BLOCKS, themeFamily: 'ember', darkP: 0.7 });
  assert.deepEqual(a, b);
});

// ---- handler with mocked Jev ----

function mockJev(respond) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return respond(calls[calls.length - 1]);
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

function jevAnswers(questions, pick) {
  const answers = {};
  for (const [k, q] of Object.entries(questions)) {
    if (q.type === 'noul') answers[k] = { type: 'noul', noul: pick[k] ?? 0.05 };
  }
  answers.archetype = { type: 'choice', choice: pick.archetype, confidence: 0.97, probabilities: {} };
  answers.theme = { type: 'choice', choice: pick.theme, confidence: 0.9, probabilities: {} };
  return answers;
}

const post = (body, headers = {}) => onRequestPost({
  request: new Request('https://daub.dev/api/assemble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://daub.dev', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }),
  env: { OPENROUTER_API_KEY: 'test-key' },
});

test('handler: one Jev request, assembled spec, picks, timing and usage', async () => {
  const m = mockJev(({ body }) => Response.json({
    model: 'typesafe/jev-test',
    answers: jevAnswers(body.questions, {
      archetype: 'login', theme: 'material', dark: 0.8, 'login-page-card-01': 0.97, 'login-form-01': 0.9,
    }),
    usage: { input_tokens: 21000, output_tokens: 0, cost: 0.0009 },
  }));
  try {
    const res = await post({ prompt: 'login page for a bank' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://daub.dev');
    const out = await res.json();
    assert.equal(m.calls.length, 1);
    assert.match(m.calls[0].url, /\/api\/alpha\/decisions$/);
    assert.equal(m.calls[0].body.state.request, 'login page for a bank');
    assert.equal(m.calls[0].headers.Authorization, 'Bearer test-key');
    assert.equal(Object.keys(m.calls[0].body.questions).length, candidateBlocks(BLOCKS).length + 3);
    assert.equal(out.archetype, 'login');
    assert.equal(out.archetype_confidence, 0.97);
    assert.equal(out.theme, 'material');
    assert.equal(out.theme_family, 'material');
    assert.deepEqual(out.picks, [{ id: 'login-page-card-01', p: 0.97, slot: 'login', kind: 'core' }]);
    assert.equal(out.confidence, 0.97);
    assert.equal(out.coverage, 1);
    assert.equal(out.fallback, null);
    assert.equal(out.preview, true);
    assert.deepEqual(validateSpec(out.spec), []);
    assert.equal(out.spec.theme, 'material');
    assert.deepEqual(out.jev_usage, { input_tokens: 21000, output_tokens: 0, cost: 0.0009 });
    for (const k of ['jev', 'assemble', 'total']) assert.equal(typeof out.timing_ms[k], 'number');
  } finally { m.restore(); }
});

test('handler: custom archetype returns spec null with fallback llm', async () => {
  const m = mockJev(({ body }) => Response.json({ answers: jevAnswers(body.questions, { archetype: 'custom', theme: 'synthwave' }) }));
  try {
    const res = await post({ prompt: 'music player' });
    assert.equal(res.status, 200);
    const out = await res.json();
    assert.equal(out.spec, null);
    assert.equal(out.fallback, 'llm');
    assert.equal(out.preview, false);
  } finally { m.restore(); }
});

test('handler: prototype keys from Jev never resolve as archetype or theme', async () => {
  const bad = mockJev(({ body }) => Response.json({ answers: jevAnswers(body.questions, { archetype: 'constructor', theme: 'default' }) }));
  try {
    const res = await post({ prompt: 'pricing page' });
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /no usable archetype/);
  } finally { bad.restore(); }
  const m = mockJev(({ body }) => Response.json({ answers: jevAnswers(body.questions, { archetype: 'login', theme: 'toString' }) }));
  try {
    const out = await (await post({ prompt: 'login page' })).json();
    assert.equal(out.theme_family, 'default');
    assert.equal(out.theme, 'light');
    assert.equal(out.spec.theme, 'light');
  } finally { m.restore(); }
});

test('handler: non-string choices cannot coerce property lookups', async () => {
  for (const choice of [['login'], ['nord'], { toString: null }]) {
    const invalidArchetype = mockJev(({ body }) => Response.json({ answers: jevAnswers(body.questions, { archetype: choice, theme: 'default' }) }));
    try {
      const res = await post({ prompt: 'login page' });
      assert.equal(res.status, 502);
      assert.match((await res.json()).error, /no usable archetype/);
    } finally { invalidArchetype.restore(); }
    const invalidTheme = mockJev(({ body }) => Response.json({ answers: jevAnswers(body.questions, { archetype: 'login', theme: choice }) }));
    try {
      const res = await post({ prompt: 'login page' });
      assert.equal(res.status, 200);
      const out = await res.json();
      assert.equal(out.theme_family, 'default');
      assert.equal(out.theme, 'light');
    } finally { invalidTheme.restore(); }
  }
});

test('handler: Jev failures become 502 with a clear error', async () => {
  const cases = [
    () => { throw new TypeError('network down'); },
    () => { throw new DOMException('timed out', 'TimeoutError'); },
    () => Response.json({ error: { message: 'internal' } }, { status: 500 }),
    () => Response.json({ error: { message: 'model overloaded' } }, { status: 503 }),
    () => new Response('<html>oops</html>', { status: 200 }),
    () => Response.json({ answers: {} }),
    () => Response.json({ answers: { archetype: { type: 'choice', choice: 'spaceship' } } }),
  ];
  for (const respond of cases) {
    const m = mockJev(respond);
    try {
      const res = await post({ prompt: 'pricing page' });
      assert.equal(res.status, 502);
      const out = await res.json();
      assert.match(out.error, /^Decision model failed/);
    } finally { m.restore(); }
  }
});

test('handler: input validation and null bodies', async () => {
  const m = mockJev(() => { throw new Error('Jev must not be called'); });
  try {
    for (const body of ['null', '[]', '"text"', '{bad json', JSON.stringify({}), JSON.stringify({ prompt: '   ' }), JSON.stringify({ prompt: 42 })]) {
      const res = await post(body);
      assert.equal(res.status, 400, body);
      assert.ok((await res.json()).error);
    }
    assert.equal(m.calls.length, 0);
  } finally { m.restore(); }
});

test('handler: missing API key is a 500, rate limit is a 429, OPTIONS is CORS preflight', async () => {
  const m = mockJev(() => { throw new Error('Jev must not be called'); });
  try {
    const noKey = await onRequestPost({
      request: new Request('https://daub.dev/api/assemble', { method: 'POST', body: JSON.stringify({ prompt: 'x' }) }),
      env: {},
    });
    assert.equal(noKey.status, 500);
    const limited = await onRequestPost({
      request: new Request('https://daub.dev/api/assemble', { method: 'POST', body: JSON.stringify({ prompt: 'x' }) }),
      env: { OPENROUTER_API_KEY: 'k', RL_GENERATE: { limit: async () => ({ success: false }) } },
    });
    assert.equal(limited.status, 429);
    const pre = await onRequestOptions({ request: new Request('https://daub.dev/api/assemble', { method: 'OPTIONS', headers: { Origin: 'https://x.daub.pages.dev' } }) });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'https://x.daub.pages.dev');
    assert.equal(m.calls.length, 0);
  } finally { m.restore(); }
});
