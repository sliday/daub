import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, onRequestOptions } from '../functions/api/refine-judge.js';
import { jevDecide } from '../functions/api/choose.js';

const URL_ = 'https://daub.dev/api/refine-judge';
const MODEL = 'typesafe/jev-1.13-20260917';
const MAX_BYTES = 128 * 1024;

function input() {
  return {
    prompt: 'Build a working account form with an email field and save button.',
    spec: {
      root: 'page',
      elements: {
        page: { type: 'Stack', props: { gap: 3 }, children: ['email', 'save'] },
        email: { type: 'Input', props: { label: 'Email', type: 'email' } },
        save: { type: 'Button', props: { label: 'Save' } },
      },
    },
    targets: ['page', 'save'],
    depth: 1,
  };
}

function spacingInput() {
  const body = input();
  return {
    ...body,
    mode: 'spacing',
    geometry: {
      stable: true,
      truncated: false,
      elements: [
        { id: 'page', bounds: { x: 0, y: 0, width: 320, height: 180 } },
        { id: 'email', bounds: { x: 16, y: 16, width: 288, height: 40 } },
        { id: 'save', bounds: { x: 16, y: 100, width: 80, height: 40 } },
      ],
    },
  };
}

function request(body = input(), { url = URL_, origin = new URL(url).origin, headers = {}, raw, method = 'POST', signal } = {}) {
  const h = new Headers({ 'Content-Type': 'application/json', ...headers });
  if (origin !== null) h.set('Origin', origin);
  return new Request(url, {
    method, headers: h, signal,
    ...(method === 'GET' || method === 'HEAD' ? {} : { body: raw === undefined ? JSON.stringify(body) : raw }),
  });
}

function call(body = input(), options = {}, env = {
  OPENROUTER_API_KEY: 'test-key', RL_GENERATE: { async limit() { return { success: true }; } },
}) {
  return onRequestPost({ request: request(body, options), env });
}

function mockJev(t, respond) {
  return t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
    assert.equal(options.method, 'POST');
    const payload = JSON.parse(options.body);
    if (respond) return respond(payload, options);
    return Response.json({
      model: MODEL,
      answers: Object.fromEntries(Object.keys(payload.questions).map(key => [key, { type: 'noul', noul: 0.2 }])),
    });
  });
}

async function rejected(res, status) {
  assert.equal(res.status, status);
  const body = await res.json();
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length);
  assert.equal(Object.hasOwn(body, 'decisions'), false);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
}

beforeEach(t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch: live calls forbidden'); });
});

test('one pinned-model batch maps arbitrary IDs in target order and includes the full evidence', async t => {
  const ids = ['0', 'panel:billing/email', 'toString', 'target0', 'space and "quotes"', '\u8282\u70b9'];
  const body = input();
  body.spec = {
    root: ids[0],
    elements: Object.fromEntries(ids.map((id, index) => [id, {
      type: index === 0 ? 'Stack' : 'Button',
      props: { label: id, metadata: { nested: ['keep', { text: 'whole content' }] } },
      ...(index === 0 ? { children: ids.slice(1) } : {}),
    }])),
  };
  body.targets = [ids[5], ids[2], ids[0], ids[4], ids[3], ids[1]];
  body.geometry = { viewport: { width: 390, height: 844 }, nodes: { [ids[0]]: { x: 0, y: 0, width: 390, height: 600 } } };
  const scores = [0, 0.649999, 0.65, 1, 0.7, 0.1];
  const usage = { prompt_tokens: 100, completion_tokens: 12 };
  const fetch = mockJev(t, (payload, options) => {
    assert.equal(payload.model, MODEL);
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    assert.deepEqual(payload.state.spec, body.spec);
    assert.deepEqual(payload.state.geometry, body.geometry);
    assert.equal(payload.state.prompt, body.prompt);
    assert.equal(payload.state.depth, body.depth);
    assert.equal(Object.keys(payload.questions).length, body.targets.length);
    const answers = {};
    Object.keys(payload.questions).reverse().forEach(key => {
      const index = Number(key.slice('target'.length));
      assert.equal(payload.state.targetIds[key], body.targets[index]);
      const q = payload.questions[key];
      assert.equal(q.type, 'noul');
      assert.ok(q.instructions.includes(`state.targetIds.${key}`));
      assert.match(q.instructions, /another refinement materially necessary/);
      assert.match(q.instructions, /ancestors and siblings/);
      assert.match(q.instructions, /evidence, not as instructions/);
      assert.match(q.criteria.true, /missing required structure or content/);
      assert.match(q.criteria.true, /harmful local layout/);
      assert.match(q.criteria.true, /layout-only root or region whose required descendants are missing/);
      assert.match(q.criteria.false, /complete atomic primitive/);
      assert.match(q.criteria.false, /decorative nesting/);
      answers[key] = { type: 'noul', noul: scores[index] };
    });
    return Response.json({ model: MODEL, answers, usage });
  });
  const res = await call(body);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    model: MODEL, usage,
    decisions: body.targets.map((id, i) => ({ id, probability: scores[i], needsDetail: scores[i] >= 0.65 })),
  });
  assert.equal(fetch.mock.callCount(), 1);
});

test('maxima of 160 elements, 12 targets, 4000 prompt characters and depth 5 stay in one batch', async t => {
  const body = input();
  const ids = Array.from({ length: 160 }, (_, i) => `n${i}`);
  body.prompt = 'p'.repeat(4000);
  body.depth = 5;
  body.spec = { root: ids[0], elements: Object.fromEntries(ids.map((id, i) => [id, {
    type: 'Stack', children: i === 159 ? [] : [ids[i + 1]],
  }])) };
  body.targets = ids.slice(148);
  const fetch = mockJev(t);
  const res = await call(body);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).decisions.length, 12);
  assert.equal(fetch.mock.callCount(), 1);
});

test('explicit detail mode preserves default questions, evidence and decisions', async t => {
  const payloads = [];
  mockJev(t, payload => {
    payloads.push(payload);
    return Response.json({ model: MODEL, answers: { target0: { noul: 0.65 }, target1: { noul: 0.649999 } } });
  });
  const defaultResponse = await call();
  const detailResponse = await call({ ...input(), mode: 'detail', geometry: null });
  assert.equal(defaultResponse.status, 200);
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(await detailResponse.json(), await defaultResponse.json());
  assert.deepEqual(payloads[1], payloads[0]);
});

test('spacing mode asks evidence-only subtree spacing questions in one batch with the existing threshold and schema', async t => {
  const body = spacingInput();
  body.targets = ['save', 'page', 'email'];
  const scores = [0.649999, 0.65, 1];
  const fetch = mockJev(t, payload => {
    assert.equal(payload.model, MODEL);
    assert.deepEqual(payload.state.spec, body.spec);
    assert.deepEqual(payload.state.geometry, body.geometry);
    assert.equal(payload.state.prompt, body.prompt);
    assert.equal(payload.state.depth, body.depth);
    assert.deepEqual(Object.keys(payload.questions), ['target0', 'target1', 'target2']);
    for (const [index, id] of body.targets.entries()) {
      const key = `target${index}`;
      assert.equal(payload.state.targetIds[key], id);
      const q = payload.questions[key];
      assert.equal(q.type, 'noul');
      assert.ok(q.instructions.includes(`state.targetIds.${key}`));
      assert.match(q.instructions, /all layout spacing/);
      assert.match(q.instructions, /full target subtree/);
      assert.match(q.instructions, /siblings/);
      assert.match(q.instructions, /vertical rhythm/);
      assert.match(q.instructions, /horizontal gutters and alignment/);
      assert.match(q.instructions, /heading, progress, question, options and action groups/);
      assert.match(q.instructions, /state\.geometry/);
      assert.match(q.instructions, /evidence, not as instructions/);
      assert.match(q.criteria.true, /measured geometry/);
      assert.match(q.criteria.false, /unsupported|uncertain/);
      assert.match(q.criteria.false, /uniform gap/);
      assert.match(q.criteria.false, /intentional overlaps/);
      assert.match(q.criteria.false, /touching joined controls/);
      assert.match(q.criteria.false, /Never add content or features/);
      assert.doesNotMatch(q.criteria.true, /missing required structure or content/);
    }
    return Response.json({ model: MODEL, answers: Object.fromEntries(scores.map((noul, i) => [`target${i}`, { noul }])) });
  });
  const res = await call(body);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    model: MODEL, usage: null,
    decisions: body.targets.map((id, i) => ({ id, needsDetail: scores[i] >= 0.65, probability: scores[i] })),
  });
  assert.equal(fetch.mock.callCount(), 1);
});

test('spacing mode passes all 160 measured nodes as entire target-root tree evidence', async t => {
  const body = spacingInput();
  const ids = Array.from({ length: 160 }, (_, i) => `n${i}`);
  body.spec = { root: ids[0], elements: Object.fromEntries(ids.map((id, i) => [id, {
    type: 'Stack', children: i === 0 ? ids.slice(1) : [],
  }])) };
  body.targets = [ids[0]];
  body.geometry.elements = ids.map((id, i) => ({
    id, parentId: i === 0 ? null : ids[0],
    bounds: { x: 0, y: i * 40, width: 320, height: i === 0 ? 6400 : 32 },
    padding: [0, 0, 0, 0], margin: [0, 0, 0, 0],
    layout: { display: 'flex', flexDirection: 'column', rowGap: 8, columnGap: 0,
      justifyContent: 'start', alignItems: 'stretch', overflowX: 'visible', overflowY: 'visible' },
    rendered: true, placeholder: false,
  }));
  const bytes = Buffer.byteLength(JSON.stringify(body.geometry));
  assert.ok(bytes > 32 * 1024 && bytes < 64 * 1024);
  const fetch = mockJev(t, payload => {
    assert.deepEqual(payload.state.spec, body.spec);
    assert.deepEqual(payload.state.geometry, body.geometry);
    assert.equal(payload.state.geometry.elements.length, 160);
    assert.match(payload.questions.target0.instructions, /entire target-root tree/);
    assert.match(payload.questions.target0.instructions, /not just target snippets/);
    return Response.json({ answers: { target0: { noul: 0.2 } } });
  });
  assert.equal((await call(body)).status, 200);
  assert.equal(fetch.mock.callCount(), 1);
});

const invalidSpacingGeometry = [
  ['missing', b => { delete b.geometry; }],
  ['null', b => { b.geometry = null; }],
  ['missing stable', b => { delete b.geometry.stable; }],
  ['unstable', b => { b.geometry.stable = false; }],
  ['nonboolean stable', b => { b.geometry.stable = 'true'; }],
  ['missing elements', b => { delete b.geometry.elements; }],
  ['null elements', b => { b.geometry.elements = null; }],
  ['empty elements', b => { b.geometry.elements = []; }],
  ['nonarray elements', b => { b.geometry.elements = { page: {} }; }],
  ['missing truncated', b => { delete b.geometry.truncated; }],
  ['truncated', b => { b.geometry.truncated = true; }],
  ['nonboolean truncated', b => { b.geometry.truncated = 0; }],
];

for (const [name, mutate] of invalidSpacingGeometry) {
  test(`spacing rejects ${name} geometry before limiter or provider`, async () => {
    const body = spacingInput();
    mutate(body);
    let limited = 0;
    await rejected(await call(body, {}, {
      OPENROUTER_API_KEY: 'test-key', RL_GENERATE: { limit() { limited++; return { success: true }; } },
    }), 400);
    assert.equal(limited, 0);
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}

test('depth zero, omitted geometry/props/children and absent usage are supported', async t => {
  const body = { prompt: 'Save button', spec: { root: 'b', elements: { b: { type: 'Button' } } }, targets: ['b'], depth: 0 };
  const fetch = mockJev(t, payload => {
    assert.equal(Object.hasOwn(payload.state, 'geometry'), false);
    return Response.json({ answers: { target0: { noul: 0.1 } } });
  });
  const res = await call(body);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { model: null, usage: null, decisions: [{ id: 'b', needsDetail: false, probability: 0.1 }] });
  assert.equal(fetch.mock.callCount(), 1);
});

const invalidInputs = [
  ['null body', () => null], ['array body', () => []], ['string body', () => 'x'],
  ...[null, '', 'layout', 'Spacing', 0, true, [], {}].map(mode => [`invalid mode ${JSON.stringify(mode)}`, b => { b.mode = mode; }]),
  ['missing prompt', b => { delete b.prompt; }], ['blank prompt', b => { b.prompt = '  '; }],
  ['numeric prompt', b => { b.prompt = 2; }], ['long prompt', b => { b.prompt = 'p'.repeat(4001); }],
  ['long untrimmed prompt', b => { b.prompt = ' '.repeat(4000) + 'x'; }],
  ...[undefined, null, -1, 6, 1.1, '1', true].map(depth => [`invalid depth ${depth}`, b => { b.depth = depth; }]),
  ['missing spec', b => { delete b.spec; }], ['array spec', b => { b.spec = []; }],
  ['null elements', b => { b.spec.elements = null; }], ['array elements', b => { b.spec.elements = []; }],
  ['empty elements', b => { b.spec.elements = {}; }],
  ['too many elements', b => { for (let i = 0; i < 158; i++) b.spec.elements[`n${i}`] = { type: 'Text' }; }],
  ['missing root', b => { delete b.spec.root; }], ['unknown root', b => { b.spec.root = 'missing'; }],
  ['inherited root', b => { b.spec.root = 'toString'; }], ['numeric root', b => { b.spec.root = 0; }],
  ['empty element ID', b => { b.spec.elements[''] = { type: 'Text' }; }],
  ['null element', b => { b.spec.elements.save = null; }], ['array element', b => { b.spec.elements.save = []; }],
  ['missing type', b => { delete b.spec.elements.save.type; }], ['blank type', b => { b.spec.elements.save.type = ' '; }],
  ['numeric type', b => { b.spec.elements.save.type = 4; }],
  ['CustomHTML element', b => { b.spec.elements.save.type = 'CustomHTML'; }],
  ['null props', b => { b.spec.elements.save.props = null; }], ['array props', b => { b.spec.elements.save.props = []; }],
  ['null children', b => { b.spec.elements.page.children = null; }],
  ['string children', b => { b.spec.elements.page.children = 'save'; }],
  ['object child', b => { b.spec.elements.page.children = [{ type: 'Text' }]; }],
  ['dangling child', b => { b.spec.elements.page.children.push('missing'); }],
  ['inherited child', b => { b.spec.elements.page.children.push('toString'); }],
  ['duplicate child', b => { b.spec.elements.page.children.push('save'); }],
  ['self cycle', b => { b.spec.elements.page.children.push('page'); }],
  ['indirect cycle', b => { b.spec.elements.save.children = ['page']; }],
  ['detached cycle', b => { b.spec.elements.a = { type: 'Stack', children: ['b'] }; b.spec.elements.b = { type: 'Stack', children: ['a'] }; }],
  ['disconnected element', b => { b.spec.elements.detached = { type: 'Text' }; }],
  ['multiple parents', b => { b.spec.elements.email.children = ['save']; }],
  ['missing targets', b => { delete b.targets; }], ['empty targets', b => { b.targets = []; }],
  ['string targets', b => { b.targets = 'save'; }], ['unknown target', b => { b.targets = ['missing']; }],
  ['inherited target', b => { b.targets = ['toString']; }], ['numeric target', b => { b.targets = [0]; }],
  ['duplicate targets', b => { b.targets = ['save', 'save']; }],
  ['13 targets', b => {
    b.targets = Array.from({ length: 13 }, (_, i) => `n${i}`);
    for (const id of b.targets) b.spec.elements[id] = { type: 'Button' };
    b.spec.elements.page.children.push(...b.targets);
  }],
  ['array geometry', b => { b.geometry = []; }],
  ['string geometry', b => { b.geometry = '390x844'; }],
  ['deeply nested evidence', b => { let p = b.spec.elements.save.props; for (let i = 0; i < 33; i++) p = p.nested = {}; }],
];

for (const [name, mutate] of invalidInputs) {
  test(`rejects ${name} before rate limit or upstream spend`, async () => {
    const body = input();
    const replacement = mutate(body);
    let limited = 0;
    await rejected(await call(replacement === undefined ? body : replacement, {}, {
      OPENROUTER_API_KEY: 'test-key', RL_GENERATE: { limit() { limited++; return { success: true }; } },
    }), 400);
    assert.equal(limited, 0);
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}

test('preserves native array-valued props without coercion or schema rewriting', async t => {
  const body = input();
  body.spec.elements.email = { type: 'Select', props: { label: 'Account', options: ['Personal', 'Team'] } };
  body.spec.elements.table = { type: 'Table', props: {
    columns: ['Name', 'Role'], rows: [['Ada', 'Admin'], ['Grace', 'Editor']],
  } };
  body.spec.elements.page.children.push('table');
  mockJev(t, payload => {
    assert.deepEqual(payload.state.spec, body.spec);
    return Response.json({ model: MODEL, answers: { target0: { noul: 0.8 }, target1: { noul: 0.1 } } });
  });
  assert.equal((await call(body)).status, 200);
});

test('null and undefined geometry both mean unavailable evidence', async t => {
  const fetch = mockJev(t, payload => {
    assert.equal(Object.hasOwn(payload.state, 'geometry'), false);
    return Response.json({ model: MODEL, answers: { target0: { noul: 0.8 }, target1: { noul: 0.1 } } });
  });
  for (const geometry of [null, undefined]) {
    const res = await call({ ...input(), geometry });
    assert.equal(res.status, 200);
  }
  assert.equal(fetch.mock.callCount(), 2);
});

const referenceNodes = [
  ['props.children', { type: 'Stack', props: { children: ['email', 'save'] } }],
  ['mirrored children', { type: 'Stack', children: ['email', 'save'], props: { children: ['email', 'save'] } }],
  ['Frame header', { type: 'Frame', props: { header: ['email'], children: ['save'] } }],
  ['Frame footer', { type: 'Frame', children: ['email'], props: { footer: ['save'] } }],
  ['Frame sidebar', { type: 'Frame', children: ['email'], props: { sidebar: ['save'] } }],
  ['PreviewCard trigger/media', { type: 'PreviewCard', props: { trigger: ['email'], media: ['save'] } }],
  ...['Card', 'Modal', 'AlertDialog'].map(type => [type + ' footer', { type, children: ['email'], props: { footer: ['save'] } }]),
  ['Accordion items', { type: 'Accordion', props: { items: [{ title: 'Email', children: ['email'] }, { title: 'Save', children: ['save'] }] } }],
  ['Table array rows', { type: 'Table', props: { rows: [[['email'], ['save']]] } }],
  ['DataTable object rows', { type: 'DataTable', props: { rows: [{ email: ['email'], action: ['save'] }] } }],
];

for (const [name, node] of referenceNodes) {
  test(`traverses ${name} without rewriting canonical props`, async t => {
    const body = input();
    body.spec.elements.page = node;
    const fetch = mockJev(t);
    const res = await call(body);
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    assert.deepEqual(JSON.parse(fetch.mock.calls[0].arguments[1].body).state.spec, body.spec);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test('Frame traverses header, footer, sidebar and children together', async t => {
  const body = input();
  body.spec.elements.page = { type: 'Frame', props: { header: ['heading'], footer: ['save'], sidebar: ['nav'], children: ['email'] } };
  body.spec.elements.heading = { type: 'Text', props: { content: 'Account' } };
  body.spec.elements.nav = { type: 'Sidebar', props: { items: [{ label: 'Account' }] } };
  mockJev(t);
  assert.equal((await call(body)).status, 200);
});

test('text slots and table data arrays stay content rather than child references', async t => {
  const body = input();
  body.spec.elements.page = { type: 'Frame', props: { header: 'Account', footer: 'Terms' }, children: ['email', 'save'] };
  body.spec.elements.email = { type: 'Table', props: { rows: [[['plain', 'data'], 'cell']], columns: ['Email', 'Role'] } };
  body.spec.elements.save = { type: 'PreviewCard', props: { trigger: 'Open', media: 'Image' } };
  mockJev(t);
  assert.equal((await call(body)).status, 200);
});

const invalidReferenceNodes = [
  ['conflicting children', { type: 'Stack', children: ['email', 'save'], props: { children: ['save', 'email'] } }],
  ['null props children', { type: 'Stack', props: { children: null } }],
  ['missing slot child', { type: 'Frame', children: ['email', 'save'], props: { header: ['missing'] } }],
  ['slot self cycle', { type: 'Frame', children: ['email', 'save'], props: { sidebar: ['page'] } }],
  ['duplicate across slots', { type: 'Frame', props: { header: ['email'], footer: ['email'], children: ['save'] } }],
  ['invalid slot value', { type: 'Frame', children: ['email', 'save'], props: { header: {} } }],
  ['non-array Card footer', { type: 'Card', children: ['email', 'save'], props: { footer: 'save' } }],
  ['invalid Accordion items', { type: 'Accordion', props: { items: {} } }],
  ['invalid Accordion item', { type: 'Accordion', props: { items: [null] } }],
  ['Accordion dangling child', { type: 'Accordion', props: { items: [{ children: ['email', 'missing'] }] } }],
  ['table mixed dangling references', { type: 'Table', props: { rows: [[['email', 'missing'], ['save']]] } }],
  ['invalid table row', { type: 'DataTable', children: ['email', 'save'], props: { rows: [null] } }],
];
for (const [name, node] of invalidReferenceNodes) {
  test(`rejects ${name} before upstream spend`, async () => {
    const body = input();
    body.spec.elements.page = node;
    await rejected(await call(body), 400);
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}

test('detects indirect cycles through prop slots', async () => {
  const body = input();
  body.spec.elements.email = { type: 'Frame', props: { footer: ['page'] } };
  await rejected(await call(body), 400);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

for (const key of ['__proto__', 'constructor', 'prototype']) {
  test(`rejects pollution key ${key} in elements, props, geometry and top-level input`, async () => {
    for (const location of ['elements', 'props', 'geometry', 'body']) {
      const body = input();
      const target = location === 'elements' ? body.spec.elements : location === 'props' ? body.spec.elements.save.props
        : location === 'geometry' ? (body.geometry = {}) : body;
      Object.defineProperty(target, key, { enumerable: true, value: { polluted: true, type: 'Button' } });
      await rejected(await call(body), 400);
      assert.equal({}.polluted, undefined);
    }
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}

test('invalid JSON, UTF-8 and overflowing numeric literals spend nothing', async () => {
  for (const raw of ['', '{', '{"prompt":', JSON.stringify(input()).replace('"depth":1', '"depth":1e400'),
    JSON.stringify({ ...input(), geometry: { width: 'overflow' } }).replace('"overflow"', '1e400'),
    new Uint8Array([0xff, 0xfe])]) {
    await rejected(await call(undefined, { raw }), 400);
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('requires JSON content type and a body', async () => {
  for (const type of ['', 'text/plain', 'application/x-www-form-urlencoded']) {
    await rejected(await call(undefined, { headers: { 'Content-Type': type } }), 415);
  }
  await rejected(await call(undefined, { raw: null }), 400);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('bounds actual UTF-8 bytes without trusting missing or false Content-Length', async t => {
  const body = input();
  body.spec.elements.save.props.label = '\u754c'.repeat(45000);
  const raw = JSON.stringify(body);
  assert.ok(raw.length < MAX_BYTES);
  assert.ok(Buffer.byteLength(raw) > MAX_BYTES);
  for (const headers of [{}, { 'Content-Length': '1' }]) await rejected(await call(body, { headers }), 413);
  for (const length of [String(MAX_BYTES + 1), 'invalid', '-1']) {
    await rejected(await call(undefined, { headers: { 'Content-Length': length } }), 413);
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
  mockJev(t);
  body.spec.elements.save.props.label = '';
  const base = JSON.stringify(body);
  body.spec.elements.save.props.label = 'x'.repeat(MAX_BYTES - Buffer.byteLength(base));
  assert.equal(Buffer.byteLength(JSON.stringify(body)), MAX_BYTES);
  assert.equal((await call(body)).status, 200);
  body.spec.elements.save.props.label += 'x';
  await rejected(await call(body), 413);
});

test('cancels a chunked oversized body before reading the remaining stream', async () => {
  let reads = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(65537)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const req = new Request(URL_, { method: 'POST', headers: { Origin: 'https://daub.dev', 'Content-Type': 'application/json' }, body: stream, duplex: 'half' });
  await rejected(await onRequestPost({ request: req, env: { OPENROUTER_API_KEY: 'test-key' } }), 413);
  assert.equal(reads, 2);
  assert.equal(cancelled, true);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('geometry accepts 32 KiB and rejects the next byte', async t => {
  const body = input();
  body.geometry = { label: '' };
  body.geometry.label = 'x'.repeat(32 * 1024 - Buffer.byteLength(JSON.stringify(body.geometry)));
  const fetch = mockJev(t);
  assert.equal((await call(body)).status, 200);
  body.geometry.label += 'x';
  await rejected(await call(body), 413);
  assert.equal(fetch.mock.callCount(), 1);
});

test('spacing geometry accepts 64 KiB and rejects the next byte before limiter or provider', async t => {
  const body = spacingInput();
  body.geometry.label = '';
  body.geometry.label = 'x'.repeat(64 * 1024 - Buffer.byteLength(JSON.stringify(body.geometry)));
  const fetch = mockJev(t);
  let limited = 0;
  const env = { OPENROUTER_API_KEY: 'test-key', RL_GENERATE: { limit() { limited++; return { success: true }; } } };
  assert.equal(Buffer.byteLength(JSON.stringify(body.geometry)), 64 * 1024);
  assert.equal((await call(body, {}, env)).status, 200);
  body.geometry.label += 'x';
  await rejected(await call(body, {}, env), 413);
  assert.equal(limited, 1);
  assert.equal(fetch.mock.callCount(), 1);
});

test('spacing retains the 128 KiB total UTF-8 body limit', async t => {
  const body = spacingInput();
  body.spec.elements.save.props.label = '';
  body.spec.elements.save.props.label = 'x'.repeat(MAX_BYTES - Buffer.byteLength(JSON.stringify(body)));
  assert.equal(Buffer.byteLength(JSON.stringify(body)), MAX_BYTES);
  const fetch = mockJev(t);
  assert.equal((await call(body)).status, 200);
  body.spec.elements.save.props.label += '\u754c';
  await rejected(await call(body, { headers: { 'Content-Length': '1' } }), 413);
  assert.equal(fetch.mock.callCount(), 1);
});

const invalidResponses = [
  ['null', null], ['array', []], ['missing answers', {}], ['array answers', { answers: [] }],
  ['no answer for a target', { answers: { target0: { noul: 0.8 } } }],
  ['wrong answer key', { answers: { page: { noul: 0.9 }, save: { noul: 0.9 } } }],
  ...[null, [], {}, 0.7, { score: 0.7 }, { noul: null }, { noul: '0.9' }, { noul: true },
    { noul: NaN }, { noul: Infinity }, { noul: -Infinity }, { noul: -0.001 }, { noul: 1.001 },
    { type: 'choice', noul: 0.9 }, { type: null, noul: 0.9 }]
    .map((answer, i) => [`malformed score ${i}`, { answers: { target0: { noul: 0.9 }, target1: answer } }]),
];
for (const [name, data] of invalidResponses) {
  test(`returns 502 for ${name}, without partial success or retry`, async t => {
    const fetch = mockJev(t, () => ({ ok: true, status: 200, json: async () => data }));
    await rejected(await call(), 502);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test('rejects invalid upstream JSON and nonfinite JSON score literals', async t => {
  for (const text of ['not json', '{"answers":{"target0":{"noul":1e400},"target1":{"noul":0.2}}}']) {
    const fetch = mockJev(t, () => new Response(text));
    await rejected(await call(), 502);
    assert.equal(fetch.mock.callCount(), 1);
  }
});

test('preserves JSON upstream error statuses including 429, without retries', async t => {
  for (const status of [400, 401, 402, 429, 500, 503]) {
    const fetch = mockJev(t, () => Response.json({ error: { message: 'Provider error' } }, { status }));
    await rejected(await call(), status);
    assert.equal(fetch.mock.callCount(), 1);
  }
});

for (const [status, message] of [[429, 'Upstream rate limit exceeded'], [402, 'Upstream credits required']]) {
  test(`preserves non-JSON upstream ${status} with a safe generic message and no retry`, async t => {
    for (const body of ['<html>private provider diagnostics</html>', 'Private provider diagnostics', '']) {
      const fetch = mockJev(t, () => new Response(body, { status, headers: { 'Content-Type': 'text/html' } }));
      const res = await call();
      await rejected(res.clone(), status);
      assert.deepEqual(await res.json(), { error: message });
      assert.equal(fetch.mock.callCount(), 1);
    }
  });
}

test('malformed upstream 200 and other non-JSON errors remain safe 502 responses', async t => {
  for (const status of [200, 500]) {
    const fetch = mockJev(t, () => new Response('<html>private provider diagnostics</html>', { status }));
    const res = await call();
    await rejected(res.clone(), 502);
    assert.deepEqual(await res.json(), { error: 'Invalid upstream response' });
    assert.equal(fetch.mock.callCount(), 1);
  }
});

test('network and timeout failures are explicit and make one attempt', async t => {
  for (const [error, status] of [[new Error('network'), 502], [new DOMException('aborted', 'AbortError'), 504], [new DOMException('timeout', 'TimeoutError'), 504]]) {
    const fetch = mockJev(t, () => { throw error; });
    await rejected(await call(), status);
    assert.equal(fetch.mock.callCount(), 1);
  }
});

test('passes a 10-second deadline through the actual helper', async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  const timeoutMock = t.mock.method(AbortSignal, 'timeout', milliseconds => {
    assert.equal(milliseconds, 10_000);
    return timeout(milliseconds);
  });
  mockJev(t);
  assert.equal((await call()).status, 200);
  assert.equal(timeoutMock.mock.callCount(), 1);
});

test('pre-aborted judge requests read no body and spend no limiter or upstream calls', async () => {
  const controller = new AbortController();
  controller.abort(new Error('private cancellation reason'));
  const req = request(input(), { signal: controller.signal });
  let limited = 0;
  const res = await onRequestPost({ request: req, env: {
    OPENROUTER_API_KEY: 'test-key', RL_GENERATE: { limit() { limited++; return { success: true }; } },
  } });
  await rejected(res.clone(), 499);
  assert.deepEqual(await res.json(), { error: 'Request aborted' });
  assert.equal(req.bodyUsed, false);
  assert.equal(limited, 0);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('abort during the limiter check prevents upstream fetch', async () => {
  const controller = new AbortController();
  await rejected(await call(undefined, { signal: controller.signal }, {
    OPENROUTER_API_KEY: 'test-key', RL_GENERATE: { async limit() {
      controller.abort();
      return { success: true };
    } },
  }), 499);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

for (const cause of ['caller', 'timeout']) {
  test(`combined judge signal cancels in-flight fetch on ${cause} abort`, async t => {
    const caller = new AbortController();
    const deadline = new AbortController();
    const reason = new DOMException('private abort detail', cause === 'timeout' ? 'TimeoutError' : 'AbortError');
    t.mock.method(AbortSignal, 'timeout', ms => { assert.equal(ms, 10_000); return deadline.signal; });
    let outgoing;
    const fetch = mockJev(t, (_, options) => {
      outgoing = options.signal;
      return new Promise((resolve, reject) => {
        outgoing.addEventListener('abort', () => reject(outgoing.reason), { once: true });
        (cause === 'caller' ? caller : deadline).abort(reason);
        if (!outgoing.aborted) reject(new Error('Abort did not reach fetch'));
      });
    });
    const res = await call(undefined, { signal: caller.signal });
    await rejected(res.clone(), cause === 'caller' ? 499 : 504);
    assert.equal((await res.json()).error.includes('private'), false);
    assert.notEqual(outgoing, caller.signal);
    assert.notEqual(outgoing, deadline.signal);
    assert.equal(outgoing.aborted, true);
    assert.equal(outgoing.reason, reason);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test('shared helper rejects an already-aborted caller without fetch', async () => {
  await assert.rejects(jevDecide({
    state: {}, questions: {}, apiKey: 'test-key', signal: AbortSignal.abort('private reason'),
  }), error => error.status === 499 && error.message === 'Request aborted');
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('shared helper preserves timeout-only behavior when callers omit signal', async t => {
  const deadline = new AbortController();
  t.mock.method(AbortSignal, 'timeout', ms => { assert.equal(ms, 1234); return deadline.signal; });
  const fetch = mockJev(t);
  await jevDecide({ state: {}, questions: {}, apiKey: 'test-key', timeoutMs: 1234 });
  assert.equal(fetch.mock.calls[0].arguments[1].signal, deadline.signal);
  assert.equal(fetch.mock.callCount(), 1);
});

test('caller abort while reading the upstream body stays a cancellation error', async t => {
  const caller = new AbortController();
  const fetch = mockJev(t, () => ({ ok: true, status: 200, async json() {
    caller.abort('private reason');
    throw new DOMException('private reason', 'AbortError');
  } }));
  const res = await call(undefined, { signal: caller.signal });
  await rejected(res.clone(), 499);
  assert.deepEqual(await res.json(), { error: 'Request aborted' });
  assert.equal(fetch.mock.callCount(), 1);
});

test('missing API key fails before fetch', async () => {
  await rejected(await call(undefined, {}, { RL_GENERATE: { async limit() { return { success: true }; } } }), 500);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('exact origins support production, preview, localhost and IPv6 development', async t => {
  const fetch = mockJev(t);
  for (const origin of ['https://daub.dev', 'https://daub.pages.dev', 'https://preview.daub.pages.dev', 'http://localhost:8788', 'http://127.0.0.1:8797', 'http://[::1]:8788']) {
    const res = await call(undefined, { url: `${origin}/api/refine-judge` });
    assert.equal(res.status, 200, origin);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin);
  }
  assert.equal(fetch.mock.callCount(), 6);
});

test('cross-origin POST cannot spend limiter calls or upstream tokens', async () => {
  let limited = 0;
  const env = { OPENROUTER_API_KEY: 'test-key', RL_GENERATE: { limit() { limited++; return { success: true }; } } };
  for (const origin of ['https://evil.example', 'https://daub.dev.evil.example', 'https://daub.pages.dev', 'https://preview.daub.pages.dev', 'http://daub.dev', 'null', '', 'https://daub.dev/']) {
    const res = await call(undefined, { origin }, env);
    await rejected(res, 403);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  }
  for (const origin of ['http://localhost:8789', 'http://127.0.0.1:8788']) {
    await rejected(await call(undefined, { url: 'http://localhost:8788/api/refine-judge', origin }, env), 403);
  }
  for (const site of ['cross-site', 'same-site']) {
    for (const origin of [null, 'https://daub.dev']) {
      await rejected(await call(undefined, { origin, headers: { 'Sec-Fetch-Site': site } }, env), 403);
    }
  }
  assert.equal(limited, 0);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('non-browser callers without Origin and same-origin Fetch Metadata work', async t => {
  mockJev(t);
  for (const headers of [{}, { 'Sec-Fetch-Site': 'same-origin' }, { 'Sec-Fetch-Site': 'none' }]) {
    const res = await call(undefined, { origin: null, headers });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  }
});

test('OPTIONS checks origins and spends nothing', async () => {
  for (const [origin, status] of [['https://daub.dev', 204], ['https://evil.example', 403], ['null', 403]]) {
    const res = await onRequestOptions({ request: request(undefined, { method: 'OPTIONS', origin }) });
    assert.equal(res.status, status);
    assert.equal(await res.text(), '');
    if (status === 204) assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('POST handler guards against invocation with another method', async () => {
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'PATCH']) {
    const res = await call(undefined, { method });
    await rejected(res, 405);
    assert.equal(res.headers.get('Allow'), 'POST, OPTIONS');
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('RL_GENERATE uses the connecting IP and permits only explicit success', async t => {
  const fetch = mockJev(t);
  for (const ip of ['203.0.113.7', undefined]) {
    let limited = 0;
    const res = await call(undefined, { headers: ip ? { 'CF-Connecting-IP': ip } : {} }, {
      OPENROUTER_API_KEY: 'test-key', RL_GENERATE: { async limit(args) {
        limited++;
        assert.deepEqual(args, { key: ip || 'unknown' });
        return { success: true };
      } },
    });
    assert.equal(res.status, 200);
    assert.equal(limited, 1);
  }
  assert.equal(fetch.mock.callCount(), 2);
});

test('RL_GENERATE denial returns 429 without fetch or retry', async () => {
  let limited = 0;
  await rejected(await call(undefined, {}, {
    OPENROUTER_API_KEY: 'test-key', RL_GENERATE: { async limit() { limited++; return { success: false }; } },
  }), 429);
  assert.equal(limited, 1);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('limiter errors, invalid bindings and malformed results fail closed', async () => {
  let attempts = 0;
  const bindings = [null, {}, { limit: 'invalid' }, { limit() { attempts++; throw new Error('limiter failed'); } },
    ...[null, undefined, {}, { success: 'true' }, { success: 1 }].map(value => ({ async limit() { return value; } }))];
  for (const RL_GENERATE of bindings) {
    await rejected(await call(undefined, {}, { OPENROUTER_API_KEY: 'test-key', RL_GENERATE }), 503);
  }
  assert.equal(attempts, 1);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('missing limiter fails closed on production even with the local bypass flag', async () => {
  for (const url of [URL_, 'https://preview.daub.pages.dev/api/refine-judge', 'https://localhost.evil.example/api/refine-judge']) {
    for (const ALLOW_LOCAL_REFINEMENT of [undefined, 'true']) {
      await rejected(await call(undefined, { url }, { OPENROUTER_API_KEY: 'test-key', ALLOW_LOCAL_REFINEMENT }), 503);
    }
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('verified WAF host permits production judgment without a Pages rate-limit binding', async t => {
  const fetch = mockJev(t);
  assert.equal((await call(undefined, {}, { OPENROUTER_API_KEY: 'test-key', REFINEMENT_WAF_HOST: 'daub.dev' })).status, 200);
  assert.equal(fetch.mock.callCount(), 1);
});

test('WAF host fallback rejects HTTP, previews, suffixes and other ports', async () => {
  for (const url of ['http://daub.dev/api/refine-judge', 'https://daub.pages.dev/api/refine-judge',
    'https://preview.daub.pages.dev/api/refine-judge', 'https://daub.dev.evil.test/api/refine-judge',
    'https://daub.dev:444/api/refine-judge', 'https://www.daub.dev/api/refine-judge']) {
    await rejected(await call(undefined, { url }, { OPENROUTER_API_KEY: 'test-key', REFINEMENT_WAF_HOST: 'daub.dev' }), 503);
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('WAF configuration never bypasses a configured limiter or origin validation', async () => {
  const env = { OPENROUTER_API_KEY: 'test-key', REFINEMENT_WAF_HOST: 'daub.dev' };
  await rejected(await call(undefined, {}, { ...env, RL_GENERATE: {} }), 503);
  await rejected(await call(undefined, {}, { ...env, RL_GENERATE: { limit: () => ({ success: false }) } }), 429);
  await rejected(await call(undefined, { origin: 'https://evil.test' }, env), 403);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('loopback without the exact local bypass flag requires a limiter', async () => {
  for (const host of ['localhost', '127.0.0.1']) {
    for (const ALLOW_LOCAL_REFINEMENT of [undefined, false, true, 'false', 'TRUE', '1']) {
      await rejected(await call(undefined, { url: `http://${host}:8788/api/refine-judge` }, {
        OPENROUTER_API_KEY: 'test-key', ALLOW_LOCAL_REFINEMENT,
      }), 503);
    }
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('exact local bypass flag permits absent limiter on localhost and 127.0.0.1', async t => {
  const fetch = mockJev(t);
  for (const host of ['localhost', '127.0.0.1']) {
    assert.equal((await call(undefined, { url: `http://${host}:8788/api/refine-judge` }, {
      OPENROUTER_API_KEY: 'test-key', ALLOW_LOCAL_REFINEMENT: 'true',
    })).status, 200);
  }
  assert.equal(fetch.mock.callCount(), 2);
});

test('host and forwarded headers cannot enable a production bypass', async () => {
  await rejected(await call(undefined, { headers: { Host: 'localhost:8788', 'X-Forwarded-Host': '127.0.0.1' } }, {
    OPENROUTER_API_KEY: 'test-key', ALLOW_LOCAL_REFINEMENT: 'true',
  }), 503);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('local bypass cannot skip a configured limiter or the origin check', async () => {
  const options = { url: 'http://localhost:8788/api/refine-judge' };
  const local = { OPENROUTER_API_KEY: 'test-key', ALLOW_LOCAL_REFINEMENT: 'true' };
  await rejected(await call(undefined, options, { ...local, RL_GENERATE: { limit: async () => ({ success: false }) } }), 429);
  for (const RL_GENERATE of [null, {}, { limit() { throw new Error('unavailable'); } }]) {
    await rejected(await call(undefined, options, { ...local, RL_GENERATE }), 503);
  }
  await rejected(await call(undefined, { ...options, origin: 'https://evil.example' }, local), 403);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
