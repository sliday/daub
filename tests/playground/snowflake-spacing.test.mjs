import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const { reviewSpacing } = createRequire(import.meta.url)('../../playground-snowflake.js');
const spec = () => ({ root: 'page', theme: 'light', state: { answer: 'neutral' }, elements: {
  page: { type: 'Stack', props: { gap: 0 }, children: ['question', 'actions'] },
  question: { type: 'Text', props: { content: 'I enjoy being the center of attention.' } },
  actions: { type: 'Stack', props: { direction: 'horizontal', gap: 0 }, children: ['back', 'next'] },
  back: { type: 'Button', props: { label: 'Back' } }, next: { type: 'Button', props: { label: 'Next' } },
} });
const geometry = s => ({ stable: true, truncated: false, elements: Object.keys(s.elements).map(id => ({ id })) });
const scores = needsDetail => ({ decisions: [{ id: 'page', needsDetail, probability: needsDetail ? 0.9 : 0.1 }] });
const base = overrides => ({ spec: spec(), prompt: 'Personality test', measure: ({ spec }) => geometry(spec), judge: () => scores(false), generate: () => { throw new Error('Unexpected repair'); }, ...overrides });

test('clean spacing requires one measured judgment and no repair', async () => {
  const events = [];
  const result = await reviewSpacing(base({ onProgress: event => events.push(event.phase) }));
  assert.equal(result.status, 'passed'); assert.equal(result.requests, 1);
  assert.deepEqual(events, ['spacing-check']); assert.deepEqual(result.spec, spec());
});

test('repairs supported gaps on both axes, publishes, remeasures and rejudges', async () => {
  const order = [], seen = [];
  const result = await reviewSpacing(base({
    measure: ({ spec: s, mode }) => { assert.equal(mode, 'spacing'); order.push('measure:' + s.elements.page.props.gap); return geometry(s); },
    judge: ({ spec: s, mode, targets }) => { assert.equal(mode, 'spacing'); assert.deepEqual(targets, ['page']); order.push('judge'); return scores(s.elements.page.props.gap === 0); },
    generate: ({ stage, spec: s, geometry: g }) => {
      assert.equal(stage, 'spacing'); assert.deepEqual(s, spec()); assert.deepEqual(g, geometry(s)); order.push('repair');
      return { root: 'page', elements: { page: { props: { gap: 6 } }, actions: { props: { gap: 3, justify: 'between' } } } };
    },
    onSpec: s => { order.push('publish'); seen.push(s); },
  }));
  assert.deepEqual(order, ['measure:0', 'judge', 'repair', 'publish', 'measure:6', 'judge']);
  assert.equal(result.status, 'passed'); assert.equal(result.requests, 3);
  assert.deepEqual(result.spec.state, spec().state); assert.deepEqual(result.spec.elements.page.children, spec().elements.page.children);
  assert.equal(result.spec.elements.question.props.content, spec().elements.question.props.content);
  assert.equal(result.spec.elements.actions.props.gap, 3); assert.equal(seen.length, 1);
});

for (const patch of [
  { root: 'other', elements: {} },
  { root: 'page', elements: {}, theme: 'dark' },
  { root: 'page', elements: { missing: { props: { gap: 3 } } } },
  { root: 'page', elements: { question: { props: { content: 'Lost content' } } } },
  ...['children', 'type'].map(key => ({ root: 'page', elements: { page: { [key]: [], props: { gap: 4 } } } })),
  ...[{ gap: 7 }, { gap: -1 }, { gap: 1.5 }, { gap: '4' }, { style: { display: 'none' } }, { columns: 1 }, { direction: 'horizontal' }, { padding: 20 }].map(props => ({ root: 'page', elements: { page: { props } } })),
]) test('rejects a destructive or unsupported spacing patch: ' + JSON.stringify(patch), async () => {
  let publishes = 0;
  const result = await reviewSpacing(base({ judge: () => scores(true), generate: () => patch, onSpec: () => publishes++ }));
  assert.equal(result.status, 'unverified'); assert.deepEqual(result.spec, spec()); assert.equal(publishes, 0);
});

for (const bad of [null, { stable: false, elements: [] }, { stable: true, truncated: true, elements: [] }, { stable: true, elements: [{ id: 'page' }] }]) {
  test('incomplete measurements cannot produce a passing review: ' + JSON.stringify(bad), async () => {
    let judges = 0;
    const result = await reviewSpacing(base({ measure: () => bad, judge: () => { judges++; return scores(false); } }));
    assert.equal(result.status, 'unverified'); assert.equal(judges, 0);
  });
}

test('persistent spacing problems stop after one repair without claiming completion', async () => {
  const result = await reviewSpacing(base({ judge: () => scores(true), generate: () => ({ root: 'page', elements: {} }) }));
  assert.equal(result.status, 'unresolved'); assert.equal(result.requests, 3);
});

test('unstable remeasurement keeps accepted spacing without reporting success', async () => {
  let measures = 0;
  const result = await reviewSpacing(base({ measure: ({ spec: s }) => ++measures === 1 ? geometry(s) : null,
    judge: () => scores(true), generate: () => ({ root: 'page', elements: { page: { props: { gap: 4 } } } }),
  }));
  assert.equal(result.status, 'unverified'); assert.equal(result.spec.elements.page.props.gap, 4);
});

for (const status of [401, 402, 403, 429]) test('provider failure ' + status + ' stops without retry', async () => {
  let calls = 0;
  await assert.rejects(reviewSpacing(base({ judge: () => { calls++; throw Object.assign(new Error('Provider failure'), { status }); } })), error => error.status === status);
  assert.equal(calls, 1);
});

test('cancellation suppresses a late spacing repair', async () => {
  const controller = new AbortController(); let release, publishes = 0;
  const pending = reviewSpacing(base({ signal: controller.signal, judge: () => scores(true),
    generate: () => new Promise(resolve => { release = resolve; }), onSpec: () => publishes++,
  }));
  pending.catch(() => {});
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  release({ root: 'page', elements: { page: { props: { gap: 6 } } } });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(publishes, 0);
});

test('spacing review has a separate bounded 30-second deadline', async () => {
  let expire;
  const context = vm.createContext({ AbortController, setTimeout: (fn, ms) => { assert.equal(ms, 30000); expire = fn; return 1; }, clearTimeout() {} });
  vm.runInContext(readFileSync(new URL('../../playground-snowflake.js', import.meta.url), 'utf8'), context);
  const pending = context.DaubSnowflake.reviewSpacing(base({ measure: () => new Promise(() => {}) }));
  await new Promise(resolve => setImmediate(resolve)); expire();
  const result = await pending; assert.equal(result.status, 'unverified'); assert.equal(result.requests, 0);
});
