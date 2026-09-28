// /api/choose design packs: validation, question wording, response shape. fetch is mocked; no network.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const choose = await import(pathToFileURL(path.resolve('functions/api/choose.js')).href);

const PACKS = [
  { id: 'dashboard', purpose: 'a dashboard, admin home, analytics overview, or KPI summary screen' },
  { id: 'data-tables-admin', purpose: 'a data table, admin list, CRM, orders, users, inventory, or records management view' },
  { id: 'pricing', purpose: 'a pricing page, plan comparison, subscription tiers, or upgrade screen' },
];
const COMPONENTS = { StatCard: 'a KPI metric card', DataTable: 'an interactive data table' };

let sent, answers, realFetch;
beforeEach(() => {
  sent = null;
  answers = {};
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ model: '~typesafe/jev-latest', answers, usage: { cost: 0 } }), { status: 200 });
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

async function post(body) {
  const req = new Request('https://daub.dev/api/choose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const res = await choose.onRequestPost({ request: req, env: { OPENROUTER_API_KEY: 'test-key' } });
  return { status: res.status, json: await res.json() };
}

describe('choose.js without packs (old clients)', () => {
  it('sends only component questions and returns { model, scores, usage }', async () => {
    answers = { StatCard: { noul: 0.9 }, DataTable: { noul: 0.2 } };
    const r = await post({ prompt: 'a sales dashboard', components: COMPONENTS });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(sent.body.questions), ['StatCard', 'DataTable']);
    assert.deepEqual(Object.keys(r.json).sort(), ['model', 'scores', 'usage']);
    assert.deepEqual(r.json.scores, { StatCard: 0.9, DataTable: 0.2 });
  });
});

describe('choose.js with packs', () => {
  it('adds one noul per pack, worded as in the eval, in the same request', async () => {
    await post({ prompt: 'a sales dashboard', components: COMPONENTS, packs: PACKS });
    assert.equal(sent.url, 'https://openrouter.ai/api/alpha/decisions');
    const q = sent.body.questions;
    assert.deepEqual(Object.keys(q), ['StatCard', 'DataTable', 'dashboard', 'data_tables_admin', 'pricing']);
    assert.deepEqual(q.data_tables_admin, {
      type: 'noul',
      instructions: 'Should the UI generator follow the design guidance for a data table, admin list, CRM, orders, users, inventory, or records management view when building the requested UI?',
      criteria: {
        true: 'The requested UI is, or clearly contains, a data table, admin list, CRM, orders, users, inventory, or records management view.',
        false: 'The requested UI does not involve a data table, admin list, CRM, orders, users, inventory, or records management view.',
      },
    });
    assert.deepEqual(sent.body.state, { request: 'a sales dashboard' });
  });
  it('picks packs at noul >= 0.5 and keeps pack scores out of component scores', async () => {
    answers = { StatCard: { noul: 0.9 }, DataTable: { noul: 0.1 }, dashboard: { noul: 0.5 }, data_tables_admin: { noul: 0.49 }, pricing: { noul: 0.97 } };
    const r = await post({ prompt: 'a sales dashboard', components: COMPONENTS, packs: PACKS });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.scores, { StatCard: 0.9, DataTable: 0.1 });
    assert.deepEqual(r.json.pack_scores, { dashboard: 0.5, 'data-tables-admin': 0.49, pricing: 0.97 });
    assert.deepEqual(r.json.picked_packs, ['dashboard', 'pricing']);
  });
  it('an empty pack list is valid and picks nothing', async () => {
    const r = await post({ prompt: 'x', components: COMPONENTS, packs: [] });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.picked_packs, []);
  });
});

describe('choose.js pack validation (400, no upstream call)', () => {
  const bad = {
    'not an array': { id: 'x', purpose: 'y' },
    'more than 20 packs': Array.from({ length: 21 }, (_, i) => ({ id: 'p' + i, purpose: 'a page' })),
    'uppercase id': [{ id: 'Dashboard', purpose: 'a page' }],
    'id over 40 chars': [{ id: 'a'.repeat(41), purpose: 'a page' }],
    'id with a space': [{ id: 'a b', purpose: 'a page' }],
    'missing purpose': [{ id: 'a' }],
    'blank purpose': [{ id: 'a', purpose: '   ' }],
    'purpose over 240 chars': [{ id: 'a', purpose: 'x'.repeat(241) }],
    'duplicate id': [{ id: 'a', purpose: 'one' }, { id: 'a', purpose: 'two' }],
    'id that maps onto another id': [{ id: 'a-b', purpose: 'one' }, { id: 'a_b', purpose: 'two' }],
    'non-object entry': ['dashboard'],
  };
  for (const [name, packs] of Object.entries(bad)) {
    it(name, async () => {
      const r = await post({ prompt: 'x', components: COMPONENTS, packs });
      assert.equal(r.status, 400, JSON.stringify(r.json));
      assert.equal(sent, null);
    });
  }
  it('a pack key may not reuse a component key', async () => {
    const r = await post({ prompt: 'x', components: { dashboard: 'lowercase component' }, packs: [{ id: 'dashboard', purpose: 'a page' }] });
    assert.equal(r.status, 400);
  });
  it('limits: exactly 20 packs, a 40-char id and a 240-char purpose pass', async () => {
    const packs = Array.from({ length: 20 }, (_, i) => ({ id: i ? 'p' + i : 'a'.repeat(40), purpose: i ? 'a page' : 'x'.repeat(240) }));
    const r = await post({ prompt: 'x', components: COMPONENTS, packs });
    assert.equal(r.status, 200);
    assert.equal(Object.keys(sent.body.questions).length, 22);
  });
});
