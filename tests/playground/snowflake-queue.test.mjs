import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const { run, limits } = createRequire(import.meta.url)('../../playground-snowflake.js');
const stack = (children = []) => ({ type: 'Stack', props: {}, children });
const layout = (ids = ['a', 'b']) => ({ root: 'root', elements: { root: stack(ids), ...Object.fromEntries(ids.map(id => [id, stack()])) } });
const scores = (targets, selected = []) => ({ decisions: targets.map(id => ({ id, needsDetail: selected.includes(id), probability: 0.9 })) });
const patch = (spec, id, child = id + '-child') => ({ root: id, elements: { [id]: { ...spec.elements[id], children: [...spec.elements[id].children, child] }, [child]: stack() } });
const tick = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const base = (overrides = {}) => ({ scheduling: 'queue', prompt: 'An app', generate: () => layout(), judge: ({ targets }) => scores(targets), ...overrides });

test('a completed region queues and refines its child before a slower sibling finishes', async () => {
  const slow = gate(), starts = [], events = [], controller = new AbortController();
  const pending = run(base({ signal: controller.signal,
    generate: async ({ stage, spec, targetId }) => {
      if (stage === 'layout') return layout();
      starts.push(targetId);
      if (targetId === 'b') await slow.promise;
      return patch(spec, targetId);
    },
    judge: ({ spec, targets }) => scores(targets, targets.filter(id => ['a', 'b', 'a-child'].includes(id) && !spec.elements[id].children.length)),
    onProgress: event => events.push(event),
  }));
  try {
    await tick();
    assert.deepEqual(starts, ['a', 'b', 'a-child']);
    assert.ok(events.some(event => event.phase === 'queue' && event.concurrency === 3));
    slow.resolve();
    const result = await pending;
    assert.equal(result.reason, 'complete');
    assert.ok(result.spec.elements['a-child-child']);
    assert.ok(result.spec.elements['b-child']);
  } finally { controller.abort(); slow.resolve(); await pending.catch(() => {}); }
});

for (const concurrency of [1, 2, 3, 4]) test('generator and judge calls share a cap of ' + concurrency, async () => {
  let active = 0, peak = 0;
  async function provider(fn) { active++; peak = Math.max(peak, active); await tick(); try { return fn(); } finally { active--; } }
  const result = await run(base({ concurrency,
    generate: ({ stage, spec, targetId }) => provider(() => stage === 'layout' ? layout(['a', 'b', 'c', 'd']) : patch(spec, targetId)),
    judge: ({ spec, targets }) => provider(() => scores(targets, targets.filter(id => ['a', 'b', 'c', 'd'].includes(id) && !spec.elements[id].children.length))),
  }));
  assert.equal(peak, concurrency);
  assert.equal(active, 0);
  assert.equal(result.reason, 'complete');
});

test('an asynchronous progress hook cannot strand newly queued work', async () => {
  const starts = [];
  const result = await run(base({
    onProgress: () => tick(),
    generate: ({ stage, spec, targetId }) => {
      if (stage === 'layout') return layout();
      starts.push(targetId); return patch(spec, targetId);
    },
    judge: ({ spec, targets }) => scores(targets, targets.filter(id => ['a', 'b'].includes(id) && !spec.elements[id].children.length)),
  }));
  assert.equal(result.reason, 'complete');
  assert.deepEqual(starts, ['a', 'b']);
  assert.ok(result.requests < limits.maxRequests);
});

test('capture and publication serialize, and each generator retains its judged geometry snapshot', async () => {
  let rendering = false, measuring = false, live = null, captures = 0;
  const result = await run(base({
    onSpec: async spec => { assert.equal(measuring, false); rendering = true; await tick(); live = structuredClone(spec); rendering = false; },
    measure: async ({ spec, targets }) => {
      assert.equal(rendering, false); assert.equal(measuring, false); measuring = true;
      assert.deepEqual(spec, live); await tick(); assert.deepEqual(spec, live);
      measuring = false; return { stable: true, version: ++captures, targets, count: Object.keys(spec.elements).length };
    },
    judge: async ({ spec, targets, geometry }) => {
      await tick(); assert.equal(geometry.count, Object.keys(spec.elements).length);
      return scores(targets, targets.filter(id => ['a', 'b'].includes(id) && !spec.elements[id].children.length));
    },
    generate: async ({ stage, spec, targetId, geometry }) => {
      if (stage === 'layout') return layout();
      await tick(); assert.equal(geometry.count, Object.keys(spec.elements).length); assert.ok(geometry.targets.includes(targetId));
      return patch(spec, targetId);
    },
  }));
  assert.equal(result.reason, 'complete');
});

test('an invalid subtree stops only that branch while siblings expand', async () => {
  const result = await run(base({
    generate: ({ stage, spec, targetId }) => { if (stage === 'layout') return layout(); if (targetId === 'a') throw new SyntaxError('Bad JSON'); return patch(spec, targetId); },
    judge: ({ spec, targets }) => scores(targets, targets.filter(id => ['a', 'b', 'b-child'].includes(id) && !spec.elements[id].children.length)),
  }));
  assert.equal(result.reason, 'partial');
  assert.deepEqual(result.failedTargets, ['a']);
  assert.ok(result.spec.elements['b-child-child']);
});

test('quota failure aborts active workers and discards queued descendants without retry', async () => {
  const hold = gate(), starts = [], signals = [];
  let publications = 0;
  await assert.rejects(run(base({
    generate: async ({ stage, spec, targetId, signal }) => {
      if (stage === 'layout') return layout(['a', 'b', 'c', 'd']);
      starts.push(targetId); signals.push(signal);
      if (targetId === 'a') { await tick(); throw Object.assign(new Error('Rate limit'), { status: 429 }); }
      await hold.promise; return patch(spec, targetId);
    },
    judge: ({ targets }) => scores(targets, targets), onSpec: () => publications++,
  })), error => error.status === 429);
  assert.deepEqual(starts, ['a', 'b', 'c']);
  assert.ok(signals.every(signal => signal.aborted));
  hold.resolve(); await tick(); assert.equal(publications, 1);
});

test('Stop aborts all active work and prevents late publication', async () => {
  const controller = new AbortController(), hold = gate(); let publications = 0;
  const pending = run(base({ signal: controller.signal,
    generate: async ({ stage, spec, targetId }) => { if (stage === 'layout') return layout(); await hold.promise; return patch(spec, targetId); },
    judge: ({ targets }) => scores(targets, targets), onSpec: () => publications++,
  }));
  pending.catch(() => {}); await tick(); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  hold.resolve(); await tick(); assert.equal(publications, 1);
});

test('queue respects depth and total request budgets', async () => {
  for (const ids of [['a'], ['a', 'b', 'c', 'd']]) {
    let calls = 0;
    const result = await run(base({
      generate: ({ stage, spec, targetId, depth }) => { calls++; assert.ok(depth <= limits.maxDepth); return stage === 'layout' ? layout(ids) : patch(spec, targetId); },
      judge: ({ targets, depth }) => { calls++; assert.ok(depth <= limits.maxDepth); return scores(targets, targets); },
    }));
    assert.ok(['depth-limit', 'request-limit'].includes(result.reason));
    assert.equal(result.requests, calls);
    assert.ok(calls <= limits.maxRequests);
    assert.ok(result.spec.elements['a-child']);
  }
});

test('deadline drains workers even when an active provider ignores cancellation', async () => {
  let expire, signal, calls = 0;
  const context = vm.createContext({ AbortController, setTimeout: fn => { expire = fn; return 1; }, clearTimeout() {} });
  vm.runInContext(readFileSync(new URL('../../playground-snowflake.js', import.meta.url), 'utf8'), context);
  const pending = context.DaubSnowflake.run(base({
    generate: ({ stage, signal: jobSignal }) => {
      if (stage === 'layout') return layout();
      calls++; signal = jobSignal; return new Promise(() => {});
    },
    judge: ({ targets }) => scores(targets, targets),
  }));
  await tick(); assert.equal(calls, 2); expire();
  const result = await pending;
  assert.equal(result.reason, 'time-limit');
  assert.equal(signal.aborted, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.spec)), layout());
});

test('a failed queue progress hook aborts active workers rather than hanging during drain', async () => {
  let running = false, signal;
  await assert.rejects(run(base({
    generate: ({ stage, signal: jobSignal }) => {
      if (stage === 'layout') return layout();
      running = true; signal = jobSignal; return new Promise(() => {});
    },
    judge: ({ targets }) => scores(targets, targets),
    onProgress: async event => {
      if (event.phase === 'queue' && event.active === 2) { await tick(); assert.equal(running, true); throw new Error('UI failed'); }
    },
  })), /UI failed/);
  assert.equal(signal.aborted, true);
});

for (const concurrency of [0, -1, 5, 1.5, '3', NaN]) test('rejects invalid concurrency ' + concurrency, async () => {
  await assert.rejects(run(base({ concurrency })), /concurrency/);
});
