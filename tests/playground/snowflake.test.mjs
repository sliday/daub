import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const file = new URL('../../playground-snowflake.js', import.meta.url);
const engine = existsSync(file) ? require(file.pathname) : {};
const { run } = engine;
const stack = (children = [], props = {}) => ({ type: 'Stack', props: { direction: 'vertical', ...props }, children });
const text = (content = 'Keep this') => ({ type: 'Text', props: { content } });
const layout = () => ({ root: 'page', theme: 'bone', state: { count: 1 }, elements: { page: stack(['a', 'b']), a: stack(['title']), title: text(), b: stack() } });
const scores = (targets, yes = []) => ({ decisions: targets.map(id => ({ id, needsDetail: yes.includes(id), probability: 0.9 })) });
const complete = ({ targets }) => scores(targets);
const patch = (spec, targetId, childId) => ({ root: targetId, elements: { [targetId]: { ...spec.elements[targetId], children: [...(spec.elements[targetId].children || []), childId] }, [childId]: stack() } });
const base = (overrides = {}) => ({ prompt: 'Build a dashboard', generate: async () => layout(), judge: complete, ...overrides });
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('starts three sibling requests before resolution and gives the entire level detached common snapshots', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const initial = { root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, stack()])) } };
  const starts = [], inputs = [], gates = new Map(), published = [], events = [];
  const controller = new AbortController();
  let active = 0, peak = 0;
  const pending = run(base({ signal: controller.signal,
    generate: ({ stage, spec, targetId }) => {
      if (stage === 'layout') return initial;
      starts.push(targetId); inputs.push(structuredClone(spec));
      const gate = deferred(); gates.set(targetId, gate);
      active++; peak = Math.max(active, peak);
      const answer = patch(spec, targetId, targetId + '-detail');
      spec.elements.page.props.mutated = true;
      return gate.promise.then(() => { active--; return answer; });
    },
    judge: ({ spec, targets }) => scores(targets, targets.filter(id => ids.includes(id) && !spec.elements[id + '-detail'])),
    onSpec: spec => published.push(spec), onProgress: event => events.push(event),
  }));
  pending.catch(() => {});
  try {
    await tick();
    assert.deepEqual(starts, ['a', 'b', 'c']);
    assert.equal(published.length, 1);
    gates.get('b').resolve(); await tick();
    assert.deepEqual(starts, ['a', 'b', 'c', 'd']);
    assert.ok(published.at(-1).elements['b-detail']);
    gates.get('d').resolve(); await tick();
    assert.deepEqual(starts, ids);
    gates.get('e').resolve(); gates.get('c').resolve(); gates.get('a').resolve();
    const result = await pending;
    assert.equal(peak, 3);
    assert.equal(result.reason, 'complete');
    assert.deepEqual(result.failedTargets, []);
    assert.equal(result.requests, 11);
    inputs.forEach(spec => assert.deepEqual(spec, initial));
    const additions = published.slice(1).map(spec => ids.filter(id => spec.elements[id + '-detail']));
    assert.deepEqual(additions, [['b'], ['b', 'd'], ['b', 'd', 'e'], ['b', 'c', 'd', 'e'], ids]);
    assert.deepEqual(events.filter(e => e.phase === 'refine').map(e => e.targetId), ids);
    assert.deepEqual(events.filter(e => e.phase === 'refined').map(e => e.targetId), ['b', 'd', 'e', 'c', 'a']);
    assert.equal(events.some(e => e.phase === 'branch-error'), false);
  } finally {
    controller.abort(); gates.forEach(gate => gate.resolve()); await pending.catch(() => {});
  }
});

test('serializes async publication and merges against the latest committed sibling snapshot', async () => {
  const gates = { a: deferred(), b: deferred() }, publishing = deferred(), rendered = [], judged = [];
  const controller = new AbortController();
  const pending = run(base({ signal: controller.signal,
    generate: ({ stage, spec, targetId }) => stage === 'layout' ? layout() : gates[targetId].promise.then(() => patch(spec, targetId, targetId + '-detail')),
    judge: ({ spec, targets }) => { judged.push(targets); return scores(targets, targets.filter(id => ['a', 'b'].includes(id) && !spec.elements[id + '-detail'])); },
    onSpec: async spec => { rendered.push(spec); if (rendered.length === 2) await publishing.promise; },
  }));
  pending.catch(() => {});
  try {
    await tick(); gates.b.resolve(); await tick();
    assert.equal(rendered.length, 2);
    gates.a.resolve(); await tick();
    assert.equal(rendered.length, 2);
    assert.deepEqual(judged, [['a', 'b']]);
    publishing.resolve();
    const result = await pending;
    assert.equal(rendered.length, 3);
    assert.ok(rendered[2].elements['b-detail']);
    assert.ok(rendered[2].elements['a-detail']);
    assert.deepEqual(result.spec, rendered[2]);
    assert.equal(result.reason, 'complete');
  } finally {
    controller.abort(); publishing.resolve(); gates.a.resolve(); gates.b.resolve(); await pending.catch(() => {});
  }
});

for (const failure of [new SyntaxError('Invalid JSON'), new SyntaxError('Unexpected token in {"quota":'), new Error('The generator returned no valid JSON.'), Object.assign(new Error('Upstream unavailable'), { status: 503 }), '{bad json']) {
  test('isolates malformed or nonfatal branch failure: ' + String(failure), async () => {
    const starts = [], events = [], judged = [];
    const result = await run(base({
      generate: ({ stage, spec, targetId }) => {
        if (stage === 'layout') return layout();
        starts.push(targetId);
        if (targetId === 'a') { if (typeof failure === 'string') return failure; throw failure; }
        return patch(spec, targetId, 'b-detail');
      },
      judge: ({ spec, targets }) => {
        judged.push(targets);
        return scores(targets, spec.elements['b-detail'] ? [] : ['a', 'b']);
      }, onProgress: event => events.push(event),
    }));
    assert.deepEqual(starts, ['a', 'b']);
    assert.equal(result.reason, 'partial');
    assert.deepEqual(result.failedTargets, ['a']);
    assert.ok(result.spec.elements['b-detail']);
    assert.deepEqual(result.spec.elements.a, layout().elements.a);
    assert.deepEqual(judged, [['a', 'b'], ['b'], ['b-detail'], ['page'], ['b']]);
    assert.deepEqual(events.filter(e => e.targetId === 'a').map(e => e.phase), ['refine', 'branch-error']);
    assert.deepEqual(events.filter(e => e.targetId === 'b').map(e => e.phase), ['refine', 'refined']);
    assert.equal(typeof events.find(e => e.phase === 'branch-error').reason, 'string');
    assert.equal(events.at(-1).reason, 'partial');
  });
}

test('aborts all active siblings and suppresses queued and late publications', async () => {
  const controller = new AbortController(), gates = new Map(), publishing = deferred();
  const ids = ['a', 'b', 'c', 'd'], starts = [], signals = [], rendered = [], events = [];
  const pending = run(base({ signal: controller.signal,
    generate: ({ stage, spec, targetId, signal }) => {
      if (stage === 'layout') return { root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, stack()])) } };
      starts.push(targetId); signals.push(signal);
      const gate = deferred(); gates.set(targetId, gate);
      return gate.promise.then(() => patch(spec, targetId, targetId + '-detail'));
    },
    judge: ({ targets }) => scores(targets, targets),
    onSpec: async spec => { rendered.push(spec); if (rendered.length === 2) await publishing.promise; },
    onProgress: event => events.push(event),
  }));
  pending.catch(() => {});
  try {
    await tick(); assert.deepEqual(starts, ['a', 'b', 'c']);
    gates.get('b').resolve(); await tick(); gates.get('a').resolve(); await tick();
    assert.equal(rendered.length, 2);
    controller.abort();
    await assert.rejects(pending, error => {
      assert.equal(error.name, 'AbortError');
      assert.deepEqual(error.partialSpec, rendered[1]);
      assert.deepEqual(error.failedTargets, []);
      return true;
    });
    const count = events.length;
    signals.forEach(signal => assert.equal(signal.aborted, true));
    publishing.resolve(); gates.get('c').reject(new Error('Late failure')); await tick();
    assert.equal(rendered.length, 2);
    assert.equal(events.length, count);
    assert.deepEqual(starts, ['a', 'b', 'c']);
  } finally {
    controller.abort(); publishing.resolve(); gates.forEach(gate => gate.resolve()); await pending.catch(() => {});
  }
});

test('rejects a concurrent new-ID collision without losing the earlier sibling commit', async () => {
  const gates = { a: deferred(), b: deferred() }, events = [];
  const controller = new AbortController();
  const pending = run(base({ signal: controller.signal,
    generate: ({ stage, spec, targetId }) => stage === 'layout' ? layout() : gates[targetId].promise.then(() => patch(spec, targetId, 'shared-detail')),
    judge: ({ spec, targets }) => scores(targets, spec.elements['shared-detail'] ? [] : ['a', 'b']),
    onProgress: event => events.push(event),
  }));
  pending.catch(() => {});
  try {
    await tick(); gates.b.resolve(); await tick(); gates.a.resolve();
    const result = await pending;
    assert.equal(result.reason, 'partial');
    assert.deepEqual(result.failedTargets, ['a']);
    assert.deepEqual(result.spec.elements.a, layout().elements.a);
    assert.deepEqual(result.spec.elements.b.children, ['shared-detail']);
    assert.ok(result.spec.elements['shared-detail']);
    assert.match(events.find(e => e.phase === 'branch-error').reason, /outside|collision/i);
  } finally {
    controller.abort(); gates.a.resolve(); gates.b.resolve(); await pending.catch(() => {});
  }
});

test('reserves the last request slots before concurrent launches and drains admitted work at the cap', async () => {
  const ids = Array.from({ length: engine.limits.maxTargets }, (_, i) => 'b' + i), starts = [], gates = new Map();
  const branchDepth = engine.limits.maxDepth - 1;
  const admitted = engine.limits.maxRequests - (2 + 3 * branchDepth);
  assert.ok(admitted > 3 && admitted < ids.length);
  const controller = new AbortController();
  let calls = 0, active = 0, peak = 0, settled = false;
  const pending = run(base({ signal: controller.signal,
    generate: ({ stage, spec, targetId, depth }) => {
      calls++;
      if (stage === 'layout') return { root: 'page', elements: { page: stack() } };
      if (depth < branchDepth - 1) return patch(spec, targetId, 'level-' + (depth + 1));
      if (depth === branchDepth - 1) return { root: targetId, elements: { [targetId]: stack(ids), ...Object.fromEntries(ids.map(id => [id, stack()])) } };
      starts.push(targetId); active++; peak = Math.max(peak, active);
      const gate = deferred(); gates.set(targetId, gate);
      return gate.promise.then(() => { active--; return patch(spec, targetId, targetId + '-child'); });
    }, judge: ({ targets }) => { calls++; return scores(targets, targets); },
  })).finally(() => { settled = true; });
  pending.catch(() => {});
  try {
    await tick(); assert.deepEqual(starts, ids.slice(0, 3));
    for (let first = 0; first + 3 < admitted; first += 3) {
      ids.slice(first, first + 3).forEach(id => gates.get(id).resolve());
      await tick();
    }
    assert.deepEqual(starts, ids.slice(0, admitted));
    assert.equal(calls, engine.limits.maxRequests);
    assert.equal(peak, 3);
    assert.equal(active, admitted % 3 || 3);
    assert.equal(settled, false);
    ids.slice(0, admitted - 1).forEach(id => gates.get(id).resolve()); await tick();
    assert.equal(settled, false);
    gates.get(ids[admitted - 1]).resolve();
    const result = await pending;
    assert.equal(result.reason, 'request-limit');
    assert.equal(result.requests, engine.limits.maxRequests);
    assert.deepEqual(result.failedTargets, []);
    assert.equal(active, 0);
    assert.equal(Object.keys(result.spec.elements).length, branchDepth + ids.length + admitted);
    ids.slice(admitted).forEach(id => assert.deepEqual(result.spec.elements[id], stack()));
    const saved = structuredClone(result.spec); await tick();
    assert.deepEqual(result.spec, saved);
    assert.equal(calls, engine.limits.maxRequests);
  } finally {
    controller.abort(); gates.forEach(gate => gate.resolve()); await pending.catch(() => {});
  }
});

for (const details of [{ status: 401 }, { status: 402 }, { status: 403 }, { status: 429 },
  { code: 'rate_limit_exceeded' }, { code: 'insufficient_quota' }, { code: 'invalid_api_key' }, { code: 429 },
  { name: 'SyntaxError', status: 429 }, { name: 'SyntaxError', code: 'insufficient_quota' },
  { message: 'Quota exceeded' }, { message: 'Insufficient credits' }, { name: 'AbortError' }]) {
  test('fatal branch error stops launches and aborts active siblings: ' + JSON.stringify(details), async () => {
    const ids = ['a', 'b', 'c', 'd'], starts = [], signals = [], gates = new Map(), rendered = [], events = [];
    const controller = new AbortController(), failure = Object.assign(new Error('Provider failure'), details);
    const pending = run(base({ signal: controller.signal,
      generate: ({ stage, spec, targetId, signal }) => {
        if (stage === 'layout') return { root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, stack()])) } };
        starts.push(targetId); signals.push(signal);
        const gate = deferred(); gates.set(targetId, gate);
        return gate.promise.then(() => patch(spec, targetId, targetId + '-child'));
      }, judge: ({ targets }) => scores(targets, targets),
      onSpec: spec => rendered.push(spec), onProgress: event => events.push(event),
    }));
    pending.catch(() => {});
    try {
      await tick(); assert.deepEqual(starts, ['a', 'b', 'c']);
      gates.get('b').reject(failure);
      await assert.rejects(pending, error => {
        assert.equal(error, failure);
        assert.deepEqual(error.partialSpec, rendered[0]);
        assert.equal(error.requests, 5);
        assert.deepEqual(error.failedTargets, []);
        return true;
      });
      signals.forEach(signal => assert.equal(signal.aborted, true));
      const eventCount = events.length;
      gates.get('a').resolve(); gates.get('c').reject(new Error('Late failure')); await tick();
      assert.deepEqual(starts, ['a', 'b', 'c']);
      assert.equal(rendered.length, 1);
      assert.equal(events.length, eventCount);
      assert.equal(events.some(e => e.phase === 'done'), false);
    } finally {
      controller.abort(); gates.forEach(gate => gate.resolve()); await pending.catch(() => {});
    }
  });
}

for (const [name, make] of Object.entries({
  siblingDefinition: () => ({ root: 'a', elements: { a: stack(['title']), b: stack([], { gap: 9 }) } }),
  siblingReference: () => ({ root: 'a', elements: { a: stack(['title', 'b']) } }),
  ancestorOverlap: () => ({ root: 'a', elements: { a: stack(['title', 'page']) } }),
  sharedExistingChild: () => ({ root: 'a', elements: { a: stack(['title', 'new']), new: stack(['title']) } }),
  prototypeKey: () => JSON.parse('{"root":"a","elements":{"a":{"type":"Stack","children":["title"],"props":{"__proto__":{"polluted":true}}}}}'),
})) test('isolates unsafe branch overlap while its sibling commits: ' + name, async () => {
  const events = [], generated = [];
  const result = await run(base({
    generate: ({ stage, spec, targetId }) => {
      if (stage === 'layout') return layout();
      generated.push(targetId);
      return targetId === 'a' ? make() : patch(spec, targetId, 'b-detail');
    },
    judge: ({ spec, targets }) => scores(targets, spec.elements['b-detail'] ? [] : ['a', 'b']),
    onProgress: event => events.push(event),
  }));
  assert.equal(result.reason, 'partial');
  assert.deepEqual(result.failedTargets, ['a']);
  assert.deepEqual(generated, ['a', 'b']);
  assert.deepEqual(result.spec.elements.a, layout().elements.a);
  assert.deepEqual(result.spec.elements.title, text());
  assert.deepEqual(result.spec.elements.b.children, ['b-detail']);
  assert.deepEqual(events.filter(e => e.phase === 'branch-error').map(e => e.targetId), ['a']);
  assert.equal({}.polluted, undefined);
});

test('keeps host-captured geometry unchanged until all sibling work and publication finishes', async () => {
  const gates = { a: deferred(), b: deferred() }, seen = [], controller = new AbortController();
  let geometry = null, measured = 0;
  const pending = run(base({ signal: controller.signal,
    measure: ({ spec, targets }) => { measured++; geometry = { stable: true, version: measured, targets, elementCount: Object.keys(spec.elements).length }; return geometry; },
    generate: ({ stage, spec, targetId }) => {
      if (stage === 'layout') return layout();
      seen.push(geometry);
      return gates[targetId].promise.then(() => { assert.equal(geometry, seen[0]); return patch(spec, targetId, targetId + '-child'); });
    },
    judge: ({ spec, targets }) => scores(targets, spec.elements['a-child'] ? [] : ['a', 'b']),
  }));
  pending.catch(() => {});
  try {
    await tick(); assert.equal(seen.length, 2); assert.equal(measured, 1);
    gates.b.resolve(); await tick(); assert.equal(measured, 1);
    gates.a.resolve();
    const result = await pending;
    assert.equal(result.reason, 'complete');
    assert.equal(seen[0], seen[1]);
    assert.equal(measured, 5);
  } finally {
    controller.abort(); gates.a.resolve(); gates.b.resolve(); await pending.catch(() => {});
  }
});

test('emits refined for a valid no-op without publishing an extra snapshot', async () => {
  const events = [], rendered = [];
  const result = await run(base({ initialSpec: layout(),
    generate: ({ spec, targetId }) => ({ root: targetId, elements: { [targetId]: spec.elements[targetId] } }),
    judge: ({ targets, depth }) => scores(targets, depth === 0 ? targets : []),
    onProgress: event => events.push(event), onSpec: spec => rendered.push(spec),
  }));
  assert.equal(result.reason, 'no-progress');
  assert.deepEqual(result.failedTargets, []);
  assert.equal(rendered.length, 1);
  assert.deepEqual(events.filter(e => e.targetId === 'page').map(e => e.phase), ['refine', 'refined']);
});

test('time limit aborts a parallel batch and ignores late branch resolutions', async () => {
  let expire;
  const context = vm.createContext({ AbortController, setTimeout: fn => { expire = fn; return 1; }, clearTimeout: () => {} });
  vm.runInContext(readFileSync(file, 'utf8'), context);
  const ids = ['a', 'b', 'c', 'd'], gates = [], rendered = [], events = [], signals = [];
  const pending = context.DaubSnowflake.run(base({
    generate: ({ stage, spec, targetId, signal }) => {
      if (stage === 'layout') return { root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, stack()])) } };
      const gate = deferred(); gates.push(gate); signals.push(signal);
      return gate.promise.then(() => patch(spec, targetId, targetId + '-child'));
    }, judge: ({ targets }) => scores(targets, targets),
    onSpec: spec => rendered.push(spec), onProgress: event => events.push(event),
  }));
  try {
    await tick(); assert.equal(gates.length, 3);
    expire();
    const result = await pending;
    assert.equal(result.reason, 'time-limit');
    assert.equal(result.requests, 5);
    assert.deepEqual(result.spec, rendered[0]);
    assert.equal(result.failedTargets.length, 0);
    signals.forEach(signal => assert.equal(signal.aborted, true));
    const count = events.length;
    gates.forEach(gate => gate.resolve()); await tick();
    assert.equal(rendered.length, 1);
    assert.equal(events.length, count);
    assert.equal(gates.length, 3);
  } finally {
    expire(); gates.forEach(gate => gate.resolve()); await pending.catch(() => {});
  }
});

test('element limit aborts active siblings and rejects queued publication after the oversized patch', async () => {
  const gates = { a: deferred(), b: deferred() }, rendered = [], signals = [], controller = new AbortController();
  const pending = run(base({ signal: controller.signal,
    generate: ({ stage, spec, targetId, signal }) => {
      if (stage === 'layout') return layout();
      signals.push(signal);
      return gates[targetId].promise.then(() => {
        if (targetId === 'b') return patch(spec, targetId, 'b-detail');
        const ids = Array.from({ length: 160 }, (_, i) => 'n' + i);
        return { root: 'a', elements: { a: stack(['title', ...ids]), ...Object.fromEntries(ids.map(id => [id, text()])) } };
      });
    }, judge: ({ targets }) => scores(targets, targets),
    onSpec: spec => rendered.push(spec),
  }));
  pending.catch(() => {});
  try {
    await tick(); assert.equal(signals.length, 2);
    gates.a.resolve(); gates.b.resolve();
    const result = await pending;
    assert.equal(result.reason, 'element-limit');
    assert.deepEqual(result.failedTargets, []);
    assert.deepEqual(result.spec, layout());
    assert.equal(rendered.length, 1);
    signals.forEach(signal => assert.equal(signal.aborted, true));
    await tick(); assert.equal(rendered.length, 1);
  } finally {
    controller.abort(); gates.a.resolve(); gates.b.resolve(); await pending.catch(() => {});
  }
});

test('retains failed targets when valid siblings reach the depth limit', async () => {
  const generated = [];
  const result = await run(base({
    generate: ({ stage, spec, targetId, depth }) => {
      if (stage === 'layout') return layout();
      generated.push(targetId);
      if (targetId === 'a') throw new SyntaxError('Invalid JSON');
      return patch(spec, targetId, 'd' + depth);
    }, judge: ({ targets }) => scores(targets, targets),
  }));
  assert.deepEqual(generated, ['a', 'b', 'd1', 'd2', 'd3', 'd4']);
  assert.equal(result.reason, 'depth-limit');
  assert.deepEqual(result.failedTargets, ['a']);
  assert.ok(result.spec.elements.d5);
  assert.deepEqual(result.spec.elements.a, layout().elements.a);
});

test('all failed branches remain partial even if the ancestor judge reports complete', async () => {
  const generated = [], judged = [], events = [];
  const result = await run(base({
    generate: ({ stage, targetId }) => {
      if (stage === 'layout') return layout();
      generated.push(targetId); throw new SyntaxError('Invalid JSON');
    },
    judge: ({ targets }) => { judged.push(targets); return scores(targets, ['a', 'b']); },
    onProgress: event => events.push(event),
  }));
  assert.deepEqual(generated, ['a', 'b']);
  assert.deepEqual(judged, [['a', 'b'], ['page']]);
  assert.equal(result.reason, 'partial');
  assert.deepEqual(result.failedTargets, ['a', 'b']);
  assert.deepEqual(result.spec, layout());
  assert.deepEqual(events.filter(e => e.phase === 'branch-error').map(e => e.targetId), ['a', 'b']);
});

test('exports the framework-free CommonJS and browser APIs with immutable hard limits', () => {
  assert.equal(typeof run, 'function');
  assert.deepEqual(engine.limits, { maxDepth: 5, maxRequests: 24, maxElements: 160, maxTargets: 12, maxDurationMs: 120000, maxConcurrency: 4 });
  assert.ok(Object.isFrozen(engine.limits));
  const context = vm.createContext({ AbortController, setTimeout, clearTimeout });
  vm.runInContext(readFileSync(file, 'utf8'), context);
  assert.equal(typeof context.DaubSnowflake.run, 'function');
});

test('fresh layout starts at region children then judges refined subcomponents with geometry', async () => {
  const events = [], progress = [], snapshots = [];
  const controller = new AbortController();
  const result = await run(base({
    signal: controller.signal,
    generate: async args => {
      assert.deepEqual(Object.keys(args).sort(), ['depth', 'prompt', 'signal', 'spec', 'stage', 'targetId']);
      assert.notEqual(args.signal, controller.signal);
      assert.equal(args.signal.aborted, false);
      assert.equal(args.prompt, 'Build a dashboard');
      events.push([args.stage, args.depth, args.targetId]);
      if (args.stage === 'layout') { assert.equal(args.spec, null); return layout(); }
      return patch(args.spec, args.targetId, 'c');
    },
    measure: async ({ spec, targets, depth, signal }) => {
      assert.deepEqual(spec, snapshots.at(-1));
      assert.equal(signal.aborted, false);
      return { stable: true, targets, depth };
    },
    judge: async args => {
      assert.deepEqual(Object.keys(args).sort(), ['depth', 'geometry', 'prompt', 'signal', 'spec', 'targets']);
      assert.deepEqual(args.geometry, { stable: true, targets: args.targets, depth: args.depth });
      events.push(['judge', args.depth, args.targets]);
      return scores(args.targets, args.depth === 1 && !args.spec.elements.c ? ['a'] : []);
    },
    onSpec: spec => snapshots.push(spec),
    onProgress: event => progress.push(event),
  }));
  assert.deepEqual(events, [['layout', 0, null], ['judge', 1, ['a', 'b']], ['refine', 1, 'a'], ['judge', 1, ['a']], ['judge', 2, ['title', 'c']], ['judge', 0, ['page']], ['judge', 1, ['a']]]);
  assert.deepEqual(progress.map(p => p.phase), ['layout', 'judge', 'refine', 'refined', 'judge', 'judge', 'judge', 'judge', 'done']);
  assert.deepEqual(progress.at(-1), { phase: 'done', depth: 2, reason: 'complete', requests: 7 });
  assert.equal(result.reason, 'complete');
  assert.equal(result.depth, 2);
  assert.equal(result.requests, 7);
  assert.equal(snapshots.length, 2);
});

test('initialSpec skips layout generation and preserves independent terminal branches and globals', async () => {
  const initial = layout(), seen = [], renders = [];
  const result = await run(base({ initialSpec: initial,
    generate: ({ stage, spec, targetId }) => {
      assert.equal(stage, 'refine');
      seen.push(targetId);
      return patch(spec, targetId, targetId + '-detail');
    },
    judge: ({ spec, targets, depth, geometry }) => {
      assert.equal(geometry, null);
      return scores(targets, depth === 0 && !spec.elements['page-detail'] ? ['page'] : depth === 1 && !spec.elements['a-detail'] ? ['a'] : []);
    }, onSpec: s => renders.push(s),
  }));
  assert.deepEqual(seen, ['page', 'a']);
  assert.equal(result.reason, 'complete');
  assert.deepEqual(result.spec.elements.b, initial.elements.b);
  assert.deepEqual(result.spec.elements.title, initial.elements.title);
  assert.equal(result.spec.root, 'page');
  assert.equal(result.spec.theme, 'bone');
  assert.deepEqual(result.spec.state, { count: 1 });
  assert.deepEqual(initial, layout());
  assert.equal(renders.length, 3);
});

test('batches sibling rechecks at the same depth before judging their children', async () => {
  const calls = [];
  const result = await run(base({ initialSpec: layout(),
    generate: ({ spec, targetId }) => { calls.push(targetId); return patch(spec, targetId, targetId + '-new'); },
    judge: ({ spec, targets, depth }) => { calls.push(targets); return scores(targets, depth < 2 ? targets.filter(id => !spec.elements[id + '-new']) : []); },
  }));
  assert.deepEqual(calls, [['page'], 'page', ['page'], ['a', 'b', 'page-new'], 'a', 'b', 'page-new', ['a', 'b', 'page-new'], ['title', 'a-new', 'b-new', 'page-new-new'], ['page'], ['a', 'b', 'page-new']]);
  assert.equal(result.requests, 11);
});

test('does not generate completed atomic primitives', async () => {
  let generated = 0;
  const result = await run(base({ initialSpec: { root: 't', elements: { t: text() } },
    judge: complete, generate: () => { generated++; },
  }));
  assert.equal(result.reason, 'complete');
  assert.equal(generated, 0);
});

test('accepts an all-complete judge answer without any refinement', async () => {
  const result = await run(base());
  assert.equal(result.reason, 'complete');
  assert.equal(result.requests, 3);
  assert.equal(result.depth, 1);
});

test('detects a key-reordered no-op patch without publishing it', async () => {
  let renders = 0;
  const initial = layout();
  const result = await run(base({ initialSpec: initial, onSpec: () => renders++,
    judge: ({ targets, depth }) => scores(targets, depth === 0 ? targets : []),
    generate: () => ({ elements: { page: { children: ['a', 'b'], props: { direction: 'vertical' }, type: 'Stack' } }, root: 'page' }),
  }));
  assert.equal(result.reason, 'no-progress');
  assert.deepEqual(result.spec, initial);
  assert.equal(renders, 1);
});

test('refines depths 0 through 5 but never judges depth 6', async () => {
  const depths = [];
  const result = await run(base({ generate: ({ stage, spec, targetId, depth }) => {
    if (stage === 'layout') return { root: 'page', elements: { page: stack() } };
    depths.push(depth); return patch(spec, targetId, 'd' + depth);
  }, judge: ({ targets, depth }) => { assert.ok(depth <= 5); return scores(targets, targets); } }));
  assert.deepEqual(depths, [0, 1, 2, 3, 4, 5]);
  assert.equal(result.reason, 'depth-limit');
  assert.equal(result.depth, 5);
  assert.equal(result.requests, 19);
});

test('reports complete when the depth-5 judge marks its frontier complete', async () => {
  const result = await run(base({ initialSpec: { root: 'page', elements: { page: stack() } },
    generate: ({ spec, targetId, depth }) => patch(spec, targetId, 'd' + depth),
    judge: ({ spec, targets, depth }) => scores(targets, depth < 5 ? targets.filter(id => !spec.elements[id].children.length) : []),
  }));
  assert.equal(result.reason, 'complete');
  assert.equal(result.depth, 5);
});

test('caps total generation and judge requests at the hard budget with a partial snapshot', async () => {
  let calls = 0;
  const ids = Array.from({ length: 12 }, (_, i) => 'b' + i);
  const result = await run(base({
    generate: ({ stage, spec, targetId }) => {
      calls++;
      if (stage === 'layout') return { root: 'page', elements: { page: stack() } };
      if (targetId === 'page') return { root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, stack()])) } };
      return patch(spec, targetId, targetId + '-child');
    }, judge: ({ targets }) => { calls++; return scores(targets, targets); },
  }));
  assert.equal(calls, engine.limits.maxRequests);
  assert.equal(result.requests, engine.limits.maxRequests);
  assert.equal(result.reason, 'request-limit');
  const lastLevelRepairs = engine.limits.maxRequests - (7 + ids.length);
  assert.equal(Object.keys(result.spec.elements).length, 1 + ids.length * 2 + lastLevelRepairs);
});

test('judges a frontier of 13 in bounded same-depth batches without dropping a branch', async () => {
  const ids = Array.from({ length: 13 }, (_, i) => 'b' + i), judged = [];
  const result = await run(base({ initialSpec: { root: 'page', elements: { page: stack() } },
    generate: () => ({ root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, stack()])) } }),
    judge: ({ spec, targets }) => { judged.push(targets); return scores(targets, spec.elements.page.children.length ? [] : ['page']); },
  }));
  assert.equal(result.reason, 'complete');
  assert.equal(result.requests, 6);
  assert.deepEqual(judged, [['page'], ['page'], ids.slice(0, 12), ids.slice(12), ['page']]);
  assert.equal(Object.keys(result.spec.elements).length, 14);
});

test('aggregates wide-level judgments before refinement and batches the sibling recheck', async () => {
  const ids = Array.from({ length: 13 }, (_, i) => 'avatar-' + i), judged = [], measured = [], generated = [];
  const avatar = size => ({ type: 'Avatar', props: { initials: 'AB', size } });
  const result = await run(base({
    generate: ({ stage, spec, targetId }) => {
      if (stage === 'layout') return { root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, avatar('lg')])) } };
      assert.equal(judged.length, 2);
      assert.equal(measured.length, 2);
      ids.forEach(id => assert.equal(spec.elements[id].props.size, 'lg'));
      generated.push(targetId);
      return { root: targetId, elements: { [targetId]: avatar('sm') } };
    },
    measure: ({ targets, depth }) => { measured.push([targets, depth]); return { stable: true, targets }; },
    judge: ({ spec, targets, depth, geometry }) => {
      assert.ok(targets.length <= engine.limits.maxTargets);
      assert.deepEqual(geometry.targets, targets);
      judged.push([targets, depth]);
      return scores(targets, targets.filter(id => ids.includes(id) && spec.elements[id].props.size === 'lg'));
    },
  }));
  assert.deepEqual(generated, ids);
  assert.deepEqual(judged, [[ids.slice(0, 12), 1], [ids.slice(12), 1], [ids.slice(0, 12), 1], [ids.slice(12), 1], [['page'], 0]]);
  assert.deepEqual(measured, judged);
  assert.equal(result.reason, 'complete');
  assert.equal(result.requests, 19);
  assert.deepEqual(result.failedTargets, []);
  ids.forEach(id => assert.equal(result.spec.elements[id].props.size, 'sm'));
});

test('validation messages containing provider keywords remain isolated branch failures', async () => {
  const initial = layout(); initial.elements.a.children = ['quota-authentication'];
  delete initial.elements.title; initial.elements['quota-authentication'] = text();
  const result = await run(base({
    generate: ({ stage, spec, targetId }) => {
      if (stage === 'layout') return initial;
      if (targetId === 'a') return { root: 'a', elements: { a: spec.elements.a, 'quota-authentication': text('Lost content') } };
      return patch(spec, targetId, 'b-detail');
    }, judge: ({ spec, targets }) => scores(targets, spec.elements['b-detail'] ? [] : ['a', 'b']),
  }));
  assert.equal(result.reason, 'partial');
  assert.deepEqual(result.failedTargets, ['a']);
  assert.deepEqual(result.spec.elements['quota-authentication'], text());
  assert.ok(result.spec.elements['b-detail']);
});

test('rejects an oversized candidate with element-limit and retains the last valid layout', async () => {
  const ids = Array.from({ length: 160 }, (_, i) => 'n' + i);
  const result = await run(base({ initialSpec: layout(),
    generate: () => ({ root: 'page', elements: { page: stack(['a', 'b', ...ids]), ...Object.fromEntries(ids.map(id => [id, text()])) } }),
    judge: ({ targets }) => scores(targets, targets),
  }));
  assert.equal(result.reason, 'element-limit');
  assert.deepEqual(result.spec, layout());
});

for (const answer of [undefined, {}, { decisions: [] }, { decisions: [{ id: 'page', needsDetail: true }] },
  { decisions: [{ id: 'page', needsDetail: 'true', probability: 0.9 }] },
  { decisions: [{ id: 'page', needsDetail: false, probability: NaN }] },
  { decisions: [{ id: 'page', needsDetail: false, probability: 1.1 }] },
  { decisions: [{ id: 'other', needsDetail: false, probability: 0.9 }] },
  { decisions: [{ id: 'page', needsDetail: false, probability: 0.9 }, { id: 'page', needsDetail: true, probability: 0.9 }] },
]) test('fails closed on malformed/missing judge answer ' + JSON.stringify(answer), async () => {
  let calls = 0;
  await assert.rejects(run(base({ initialSpec: layout(), judge: () => { calls++; return answer; } })), error => {
    assert.match(error.message, /judge|decision|probability/i);
    assert.deepEqual(error.partialSpec, layout());
    assert.equal(error.requests, 1);
    return true;
  });
  assert.equal(calls, 1);
});

for (const stage of ['layout', 'judge', 'refine']) test(stage + ' 429 fails once and retains the valid snapshot', async () => {
  let failures = 0;
  const fail = () => { failures++; throw Object.assign(new Error('Quota exceeded'), { status: 429 }); };
  await assert.rejects(run(base({
    generate: ({ stage: current }) => current === stage ? fail() : layout(),
    judge: ({ targets }) => stage === 'judge' ? fail() : scores(targets, targets),
  })), error => {
    assert.equal(error.status, 429);
    assert.deepEqual(error.partialSpec, stage === 'layout' ? null : layout());
    return true;
  });
  assert.equal(failures, 1);
});

test('checks a pre-aborted signal before publishing initialSpec or calling hooks', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(run(base({ initialSpec: layout(), signal: controller.signal,
    onSpec: () => calls++, onProgress: () => calls++, generate: () => calls++,
  })), { name: 'AbortError' });
  assert.equal(calls, 0);
});

for (const boundary of ['generate', 'judge', 'measure', 'onSpec', 'onProgress']) test('aborts a hanging ' + boundary + ' hook that ignores signal', async () => {
  const controller = new AbortController();
  let start, release, combined, renders = 0;
  const started = new Promise(resolve => { start = resolve; });
  const options = base({ signal: controller.signal, onSpec: () => renders++ });
  options[boundary] = args => { combined = args.signal; start(); return new Promise(resolve => { release = resolve; }); };
  const pending = run(options);
  await started;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  if (combined) assert.equal(combined.aborted, true);
  const before = renders;
  release(boundary === 'generate' ? layout() : undefined);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(renders, before);
});

test('does not publish a generated spec when generation aborts before resolving', async () => {
  const controller = new AbortController(); let rendered = false;
  await assert.rejects(run(base({ signal: controller.signal,
    generate: () => { controller.abort(); return layout(); }, onSpec: () => { rendered = true; },
  })), { name: 'AbortError' });
  assert.equal(rendered, false);
});

for (const boundary of ['generate', 'judge', 'measure', 'onSpec', 'onProgress']) test('caps hanging ' + boundary + ' by the run deadline', async () => {
  let expire, combined;
  const context = vm.createContext({ AbortController, setTimeout: (fn, ms) => {
    assert.equal(ms, 120000); expire = fn; return 1;
  }, clearTimeout: () => {} });
  vm.runInContext(readFileSync(file, 'utf8'), context);
  let start;
  const started = new Promise(resolve => { start = resolve; });
  const options = base();
  options[boundary] = args => { combined = args.signal; start(); return new Promise(() => {}); };
  const pending = context.DaubSnowflake.run(options);
  await started; expire();
  const result = await pending;
  if (combined) assert.equal(combined.aborted, true);
  assert.equal(result.reason, 'time-limit');
  assert.deepEqual(result.spec && JSON.parse(JSON.stringify(result.spec)), ['generate', 'onProgress'].includes(boundary) ? null : layout());
  assert.equal(result.requests, boundary === 'judge' ? 2 : boundary === 'onProgress' ? 0 : 1);
});

test('checks elapsed wallclock at boundaries even before the timer fires', async () => {
  let now = 0;
  const context = vm.createContext({ AbortController, Date: { now: () => now }, performance: { now: () => now }, setTimeout, clearTimeout });
  vm.runInContext(readFileSync(file, 'utf8'), context);
  let renders = 0;
  const result = await context.DaubSnowflake.run(base({ generate: () => { now = 120001; return layout(); }, onSpec: () => renders++ }));
  assert.equal(result.reason, 'time-limit');
  assert.equal(renders, 0);
});

const invalidSpecs = {
  unknownType: () => ({ root: 'x', elements: { x: { type: 'Unknown', props: {} } } }),
  missingRoot: () => ({ root: 'x', elements: { page: stack() } }),
  orphan: () => ({ root: 'page', elements: { page: stack(), orphan: text() } }),
  cycle: () => ({ root: 'page', elements: { page: stack(['a']), a: stack(['page']) } }),
  sharedChild: () => ({ root: 'page', elements: { page: stack(['a', 'b']), a: stack(['t']), b: stack(['t']), t: text() } }),
  missingChild: () => ({ root: 'page', elements: { page: stack(['gone']) } }),
  duplicateChild: () => ({ root: 'page', elements: { page: stack(['t', 't']), t: text() } }),
  badChildren: () => ({ root: 'page', elements: { page: { type: 'Stack', props: { direction: 'vertical' }, children: 'a' } } }),
  badProps: () => ({ root: 'page', elements: { page: { type: 'Text', props: [] } } }),
  row: () => ({ root: 'page', elements: { page: stack([], { direction: 'row' }) } }),
  column: () => ({ root: 'page', elements: { page: stack([], { direction: 'column' }) } }),
  nullDirection: () => ({ root: 'page', elements: { page: stack([], { direction: null }) } }),
  prototype: () => JSON.parse('{"root":"page","elements":{"page":{"type":"Text","props":{"__proto__":{"polluted":true}}}}}'),
  constructor: () => ({ root: 'page', elements: { page: { type: 'Text', props: { constructor: {} } } } }),
  nonJson: () => ({ root: 'page', elements: { page: { type: 'Text', props: { content: () => 'bad' } } } }),
  inherited: () => ({ root: 'page', elements: { page: Object.assign(Object.create({ hidden: true }), text()) } }),
  conflictingChildren: () => ({ root: 'page', elements: { page: { ...stack(['a']), props: { direction: 'vertical', children: ['b'] } }, a: text(), b: text() } }),
};
for (const [name, make] of Object.entries(invalidSpecs)) test('rejects invalid graph: ' + name, async () => {
  let renders = 0;
  await assert.rejects(run(base({ generate: make, onSpec: () => renders++ })), error => {
    assert.equal(error.partialSpec, null); return true;
  });
  assert.equal(renders, 0);
});

test('uses validTypes as the type allowlist without silently stripping unknown nodes', async () => {
  const spec = { root: 'custom', elements: { custom: { type: 'HostPanel', props: {} } } };
  const result = await run(base({ validTypes: new Set(['HostPanel']), initialSpec: spec }));
  assert.deepEqual(result.spec, spec);
  await assert.rejects(run(base({ validTypes: ['Text'], initialSpec: layout() })), /type/i);
});

for (const [name, make] of Object.entries({
  rootIdentity: () => ({ root: 'other', elements: { other: stack() } }),
  outsideDefinition: () => ({ root: 'a', elements: { a: stack(['title']), b: stack([], { gap: 4 }) } }),
  outsideReference: () => ({ root: 'a', elements: { a: stack(['title', 'b']) } }),
  removeNode: () => ({ root: 'a', elements: { a: stack() } }),
  removeContent: () => ({ root: 'a', elements: { a: stack(['title']), title: text('') } }),
  replaceContent: () => ({ root: 'a', elements: { a: stack(['title']), title: text('Different text') } }),
  cycle: () => ({ root: 'a', elements: { a: stack(['title', 'a']) } }),
  orphan: () => ({ root: 'a', elements: { a: stack(['title']), unlinked: text() } }),
  theme: () => ({ root: 'a', theme: 'dark', elements: { a: stack(['title']) } }),
  state: () => ({ root: 'a', state: { count: 9 }, elements: { a: stack(['title']) } }),
})) test('rejects unsafe scoped patch: ' + name, async () => {
  let saved;
  const events = [];
  const result = await run(base({ initialSpec: layout(),
    generate: ({ spec, targetId }) => targetId === 'page' ? { root: 'page', elements: { page: stack(['a', 'b'], { gap: 1 }) } } : make(),
    judge: ({ targets, depth }) => scores(targets, depth === 0 ? ['page'] : ['a']),
    onSpec: spec => { saved = spec; },
    onProgress: event => events.push(event),
  }));
  assert.equal(result.reason, 'partial');
  assert.deepEqual(result.failedTargets, ['a']);
  assert.deepEqual(result.spec, saved);
  assert.deepEqual(saved.elements.b, stack());
  assert.deepEqual(saved.elements.a, layout().elements.a);
  assert.deepEqual(saved.elements.title, text());
  assert.equal(events.filter(event => event.phase === 'branch-error').length, 1);
});

test('validates named slot and props.children references as part of the tree', async () => {
  const spec = { root: 'page', elements: {
    page: { type: 'Frame', props: { header: ['h'], footer: ['f'], children: ['card'] } },
    h: text('Header'), f: text('Footer'), card: { type: 'PreviewCard', props: { trigger: ['t'], media: ['m'] } },
    t: text('Trigger'), m: { type: 'Image', props: { src: '/image.png', alt: 'Sample' } },
  } };
  assert.deepEqual((await run(base({ initialSpec: spec }))).spec, spec);
  spec.elements.card.props.media.push('h');
  await assert.rejects(run(base({ initialSpec: spec })), /tree|parent|duplicate/i);
});

test('does not expose the retained snapshot to mutation by callbacks', async () => {
  const initial = layout();
  const result = await run(base({ initialSpec: initial,
    onSpec: spec => { spec.elements.b.props.changed = true; },
    judge: ({ spec, targets }) => { spec.state.count = 50; return scores(targets); },
  }));
  assert.deepEqual(result.spec, initial);
  assert.deepEqual(initial, layout());
});

test('rejects unstable geometry without spending a judge request', async () => {
  let judges = 0;
  await assert.rejects(run(base({ measure: () => ({ stable: false }), judge: () => { judges++; } })), /geometry|stable/i);
  assert.equal(judges, 0);
});

test('fresh layout without children starts at its root at depth 0', async () => {
  const result = await run(base({ generate: () => ({ root: 'page', elements: { page: stack() } }),
    judge: ({ targets, depth }) => { assert.equal(depth, 0); assert.deepEqual(targets, ['page']); return scores(targets); },
  }));
  assert.equal(result.reason, 'complete');
  assert.equal(result.depth, 0);
});

test('existing root layout repair precedes stories refinement and a terminal Avatar judge', async () => {
  const calls = [];
  const result = await run(base({ initialSpec: { root: 'page', elements: { page: stack(['stories']), stories: stack() } },
    generate: ({ spec, targetId }) => {
      calls.push(targetId);
      if (targetId === 'page') return { root: 'page', elements: { page: stack(['stories'], { gap: 3 }) } };
      return { root: 'stories', elements: { stories: stack(['one', 'two']), one: { type: 'Avatar', props: { initials: 'AB' } }, two: { type: 'Avatar', props: { initials: 'CD' } } } };
    },
    judge: ({ spec, targets }) => {
      calls.push(targets);
      return scores(targets, targets.filter(id => id === 'page' ? spec.elements.page.props.gap !== 3 : id === 'stories' && !spec.elements.one));
    },
  }));
  assert.deepEqual(calls, [['page'], 'page', ['page'], ['stories'], 'stories', ['stories'], ['one', 'two'], ['page'], ['stories']]);
  assert.equal(result.reason, 'complete');
  assert.equal(result.requests, 9);
});

test('fresh layout depth budget ends after region, subcomponent, and deeper refinements', async () => {
  const seen = [];
  const result = await run(base({
    generate: ({ stage, spec, targetId, depth }) => {
      if (stage === 'layout') return { root: 'page', elements: { page: stack(['region']), region: stack() } };
      seen.push(depth); return patch(spec, targetId, 'd' + depth);
    }, judge: ({ targets }) => scores(targets, targets),
  }));
  assert.deepEqual(seen, [1, 2, 3, 4, 5]);
  assert.equal(result.reason, 'depth-limit');
});

test('permits omitted Stack direction using the renderer vertical default', async () => {
  const spec = { root: 'page', elements: { page: { type: 'Stack', props: { gap: 3 }, children: ['child'] }, child: { type: 'Stack' } } };
  const result = await run(base({ initialSpec: spec }));
  assert.equal(result.reason, 'complete');
  assert.deepEqual(result.spec, spec);
});

test('repairs Jev-flagged atomic props and rejudges before completing', async () => {
  const trace = [];
  const result = await run(base({ initialSpec: { root: 'avatar', elements: { avatar: { type: 'Avatar', props: { initials: 'AB', size: 'lg' } } } },
    generate: ({ spec, targetId, depth }) => {
      trace.push(['refine', targetId, depth]);
      return { root: targetId, elements: { [targetId]: { ...spec.elements[targetId], props: { initials: 'AB', size: 'sm' } } } };
    },
    judge: ({ spec, targets, depth }) => {
      trace.push(['judge', targets, depth]);
      return scores(targets, spec.elements.avatar.props.size === 'lg' ? targets : []);
    },
  }));
  assert.deepEqual(trace, [['judge', ['avatar'], 0], ['refine', 'avatar', 0], ['judge', ['avatar'], 0]]);
  assert.equal(result.spec.elements.avatar.props.size, 'sm');
  assert.equal(result.reason, 'complete');
  assert.equal(result.requests, 3);
});

test('keeps a gap-only parent repair unresolved despite complete children', async () => {
  const trace = [], measurements = [];
  const spec = { root: 'stories', elements: { stories: stack(['avatar']), avatar: { type: 'Avatar', props: { initials: 'AB' } } } };
  const result = await run(base({ initialSpec: spec,
    generate: ({ targetId }) => {
      trace.push(['refine', targetId]);
      return { root: 'stories', elements: { stories: stack(['avatar'], { gap: 3 }) } };
    },
    measure: ({ spec, targets }) => {
      measurements.push(targets);
      return { stable: true, direction: spec.elements.stories.props.direction, gap: spec.elements.stories.props.gap || 0 };
    },
    judge: ({ targets, geometry }) => {
      trace.push(['judge', targets, geometry.gap]);
      return scores(targets, geometry.direction === 'vertical' ? ['stories'] : []);
    },
  }));
  assert.deepEqual(trace, [['judge', ['stories'], 0], ['refine', 'stories'], ['judge', ['stories'], 3], ['judge', ['avatar'], 3], ['judge', ['stories'], 3]]);
  assert.deepEqual(measurements, [['stories'], ['stories'], ['avatar'], ['stories']]);
  assert.equal(result.reason, 'no-progress');
  assert.equal(result.requests, 5);
});

test('an unchanged flagged branch does not stop sibling repair or child judgment', async () => {
  const generated = [], judged = [], rendered = [];
  const result = await run(base({
    generate: ({ stage, spec, targetId }) => {
      if (stage === 'layout') return layout();
      generated.push(targetId);
      if (targetId === 'a') return { root: 'a', elements: { a: spec.elements.a } };
      return patch(spec, targetId, 'b-detail');
    },
    judge: ({ spec, targets, depth }) => {
      judged.push(targets);
      return scores(targets, depth === 1 ? ['a', ...(spec.elements['b-detail'] ? [] : ['b'])] : []);
    }, onSpec: spec => rendered.push(spec),
  }));
  assert.deepEqual(generated, ['a', 'b']);
  assert.deepEqual(judged, [['a', 'b'], ['a', 'b'], ['title', 'b-detail'], ['page'], ['a', 'b']]);
  assert.equal(result.reason, 'no-progress');
  assert.ok(result.spec.elements['b-detail']);
  assert.equal(rendered.length, 2);
  assert.equal(result.requests, 8);
});

test('persistent atomic flags stop after one repair and one recheck', async () => {
  let generated = 0;
  const result = await run(base({ initialSpec: { root: 't', elements: { t: text() } },
    judge: ({ targets }) => scores(targets, targets),
    generate: () => { generated++; return { root: 't', elements: { t: { ...text(), props: { content: 'Keep this', tag: 'h2' } } } }; },
  }));
  assert.equal(result.reason, 'no-progress');
  assert.equal(result.requests, 3);
  assert.equal(generated, 1);
});

for (const location of ['children', 'props.children', 'footer']) test('rejects reordering existing ' + location + ' references', async () => {
  const makeParent = children => location === 'children' ? stack(children) : location === 'props.children' ? { type: 'Stack', props: { children } } : { type: 'Card', props: { footer: children } };
  const spec = { root: 'page', elements: { page: makeParent(['a', 'b']), a: text('A'), b: text('B') } };
  const events = [];
  const result = await run(base({ initialSpec: spec,
    judge: ({ targets }) => scores(targets, targets),
    generate: () => ({ root: 'page', elements: { page: makeParent(['b', 'a']) } }),
    onProgress: event => events.push(event),
  }));
  assert.equal(result.reason, 'partial');
  assert.deepEqual(result.failedTargets, ['page']);
  assert.deepEqual(result.spec, spec);
  assert.match(events.find(event => event.phase === 'branch-error').reason, /order|content/i);
});

test('permits inserting child IDs while retaining existing order as a subsequence', async () => {
  const result = await run(base({ initialSpec: layout(),
    judge: ({ spec, targets }) => scores(targets, spec.elements.extra ? [] : ['page']),
    generate: () => ({ root: 'page', elements: { page: stack(['extra', 'a', 'between', 'b']), extra: text('Before'), between: text('Between') } }),
  }));
  assert.deepEqual(result.spec.elements.page.children, ['extra', 'a', 'between', 'b']);
  assert.equal(result.reason, 'complete');
});

test('final ancestor audit can clear a parent after repairing its descendants', async () => {
  const calls = [];
  const spec = { root: 'page', elements: { page: stack(['stories']), stories: stack([], { direction: 'vertical' }) } };
  const result = await run(base({ initialSpec: spec,
    generate: ({ spec, targetId }) => ({ root: targetId, elements: {
      [targetId]: targetId === 'page' ? stack(['stories'], { gap: 3 }) : stack([], { direction: 'horizontal' }),
    } }),
    judge: ({ spec, targets, depth }) => {
      calls.push([targets, depth]);
      return scores(targets, spec.elements.stories.props.direction === 'vertical' ? targets : []);
    },
  }));
  assert.deepEqual(calls, [[['page'], 0], [['page'], 0], [['stories'], 1], [['stories'], 1], [['page'], 0]]);
  assert.equal(result.reason, 'complete');
  assert.equal(result.requests, 7);
});

test('final audit includes a fresh layout root that the frontier skipped', async () => {
  const judged = [];
  const result = await run(base({
    judge: ({ targets, depth }) => { judged.push([targets, depth]); return scores(targets, ['page']); },
  }));
  assert.deepEqual(judged, [[['a', 'b'], 1], [['page'], 0]]);
  assert.equal(result.reason, 'no-progress');
  assert.equal(result.requests, 3);
});

test('missing scores in a parent recheck fail without descending or retrying', async () => {
  let judges = 0, generates = 0;
  await assert.rejects(run(base({ initialSpec: layout(),
    generate: () => { generates++; return { root: 'page', elements: { page: stack(['a', 'b'], { gap: 3 }) } }; },
    judge: ({ targets }) => { judges++; return judges === 1 ? scores(targets, targets) : { decisions: [] }; },
  })), error => { assert.equal(error.partialSpec.elements.page.props.gap, 3); return /decision/.test(error.message); });
  assert.equal(judges, 2);
  assert.equal(generates, 1);
});

for (const exhausted of [false, true]) {
  test(exhausted ? 'stops when the final ancestor audit needs one request beyond the hard budget' : 'can complete on the last request when it clears the final ancestor audit', async () => {
    const ids = Array.from({ length: engine.limits.maxTargets }, (_, i) => 'avatar-' + i), judged = [];
    // One layout, four level judges and two ancestor audits leave the repair budget.
    const parentCount = engine.limits.maxRequests - ids.length - 7 + Number(exhausted);
    const parents = Array.from({ length: parentCount }, (_, i) => 'region-' + i);
    assert.ok(parentCount > 0 && parentCount <= engine.limits.maxTargets);
    const avatar = size => ({ type: 'Avatar', props: { initials: 'AB', size } });
    const result = await run(base({
      generate: ({ stage, targetId }) => {
        if (stage === 'layout') return { root: 'page', elements: { page: stack(parents), ...Object.fromEntries(parents.map(id => [id, stack()])) } };
        if (parents.includes(targetId)) {
          const children = ids.filter((_, i) => i % parentCount === parents.indexOf(targetId));
          return { root: targetId, elements: { [targetId]: stack(children), ...Object.fromEntries(children.map(id => [id, avatar('lg')])) } };
        }
        return { root: targetId, elements: { [targetId]: avatar('sm') } };
      },
      judge: ({ spec, targets }) => {
        judged.push(targets);
        return scores(targets, targets.filter(id => parents.includes(id) ? !spec.elements[id].children.length : ids.includes(id) && spec.elements[id].props.size === 'lg'));
      },
    }));
    assert.equal(result.reason, exhausted ? 'request-limit' : 'complete');
    assert.equal(result.requests, engine.limits.maxRequests);
    assert.equal(judged.length, exhausted ? 5 : 6);
    assert.deepEqual(judged.at(-1), exhausted ? ['page'] : parents);
    assert.equal(Object.keys(result.spec.elements).length, 1 + parentCount + ids.length);
    ids.forEach(id => assert.equal(result.spec.elements[id].props.size, 'sm'));
  });
}

for (const type of ['Input', 'Field']) {
  test(type + ' permits input type configuration repair while preserving its label and value', async () => {
    const initialSpec = { root: 'email', elements: { email: { type, props: { type: 'text', label: 'Email address', value: 'person@example.com' } } } };
    const result = await run(base({ initialSpec,
      judge: ({ spec, targets }) => scores(targets, spec.elements.email.props.type === 'text' ? targets : []),
      generate: () => ({ root: 'email', elements: { email: { type, props: { type: 'email', label: 'Email address', value: 'person@example.com' } } } }),
    }));
    assert.equal(result.reason, 'complete');
    assert.equal(result.requests, 3);
    assert.deepEqual(result.spec.elements.email, { type, props: { type: 'email', label: 'Email address', value: 'person@example.com' } });
    assert.equal(initialSpec.elements.email.props.type, 'text');
  });

  test(type + ' input type repair cannot remove existing label content', async () => {
    const initialSpec = { root: 'email', elements: { email: { type, props: { type: 'text', label: 'Email address' } } } };
    const events = [];
    const result = await run(base({ initialSpec,
      judge: ({ targets }) => scores(targets, targets),
      generate: () => ({ root: 'email', elements: { email: { type, props: { type: 'email', label: '' } } } }),
      onProgress: event => events.push(event),
    }));
    assert.equal(result.reason, 'partial');
    assert.deepEqual(result.failedTargets, ['email']);
    assert.deepEqual(result.spec, initialSpec);
    assert.match(events.find(event => event.phase === 'branch-error').reason, /email.label/);
  });
}

test('input type exception does not exempt other components props.type from preservation', async () => {
  const initialSpec = { root: 'alert', elements: { alert: { type: 'Alert', props: { type: 'warning', message: 'Keep this warning' } } } };
  const events = [];
  const result = await run(base({ initialSpec,
    judge: ({ targets }) => scores(targets, targets),
    generate: () => ({ root: 'alert', elements: { alert: { type: 'Alert', props: { type: 'success', message: 'Keep this warning' } } } }),
    onProgress: event => events.push(event),
  }));
  assert.equal(result.reason, 'partial');
  assert.deepEqual(result.failedTargets, ['alert']);
  assert.deepEqual(result.spec, initialSpec);
  assert.match(events.find(event => event.phase === 'branch-error').reason, /alert.type/);
});
