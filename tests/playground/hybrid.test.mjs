import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const { run, limits } = createRequire(import.meta.url)('../../playground-hybrid.js');
const source = readFileSync(new URL('../../playground-hybrid.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const layout = (ids = ['a', 'b', 'c']) => ({ regions: Object.fromEntries(ids.map(id => [id, 0])), required: true, behavior: false });
const defect = (targetId, kind = 'layout') => ({ id: targetId + '-' + kind, targetId, kind, message: 'Needs repair' });
const assess = spec => ({ complete: true, defects: Object.keys(spec.regions).filter(id => !spec.regions[id]).map(id => defect(id)), checks: [{ id: 'required', pass: spec.required }] });
const base = (overrides = {}) => ({
  draft: () => layout(),
  inspect: ({ spec }) => assess(spec),
  propose: ({ defect }) => ({ id: defect.targetId }),
  apply: ({ spec, patch }) => { spec.regions[patch.id] = 1; return spec; },
  finish: ({ spec }) => spec,
  ...overrides,
});
function clocked() {
  let expire, time = 0, cleared = false;
  const context = vm.createContext({ AbortController, performance: { now: () => time }, setTimeout: fn => { expire = fn; return 1; }, clearTimeout: () => { cleared = true; } });
  vm.runInContext(source, context);
  return { run: context.DaubHybrid.run, expire: () => expire(), advance: (value = 180001) => { time = value; }, cleared: () => cleared };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('reserves the last third of the deadline for behavior and final inspection', async () => {
  const clock = clocked();
  let proposals = 0, finishes = 0;
  const result = await clock.run(base({
    inspect: ({ spec }) => { clock.advance(125000); return assess(spec); },
    propose: () => { proposals++; },
    finish: ({ spec }) => { finishes++; spec.behavior = true; return spec; },
  }));
  assert.equal(proposals, 0);
  assert.equal(finishes, 1);
  assert.equal(result.spec.behavior, true);
  assert.equal(result.reason, 'incomplete');
});

test('leaves uninspected proposals private when finish time reserve starts', async () => {
  const clock = clocked();
  let applies = 0;
  const result = await clock.run(base({
    propose: ({ defect }) => { clock.advance(125000); return { id: defect.targetId }; },
    apply: () => { applies++; },
    finish: ({ spec }) => { spec.behavior = true; return spec; },
  }));
  assert.equal(applies, 0);
  assert.equal(result.accepted, 0);
  assert.equal(result.spec.behavior, true);
});

test('UMD exposes the same capped API in CommonJS, browser and AMD', () => {
  assert.deepEqual(limits, { maxRequests: 18, maxDurationMs: 180000, maxRounds: 2, maxConcurrency: 3 });
  assert.equal(Object.isFrozen(limits), true);
  const browser = vm.createContext({});
  vm.runInContext(source, browser);
  assert.equal(typeof browser.DaubHybrid.run, 'function');
  let amd;
  const define = (dependencies, factory) => { assert.equal(dependencies.length, 0); amd = factory(); };
  define.amd = true;
  vm.runInNewContext(source, { define });
  assert.deepEqual(plain(amd.limits), limits);
});

test('publishes the whole draft first, serially accepts repairs, then finishes and inspects once', async () => {
  const order = [], publications = [], events = [];
  const result = await run(base({
    draft: () => { order.push('draft'); return layout(['a', 'b']); },
    inspect: ({ spec }) => { order.push('inspect:' + Object.values(spec.regions).join('')); return assess(spec); },
    propose: ({ defect }) => { order.push('propose:' + defect.targetId); return { id: defect.targetId }; },
    apply: ({ spec, patch }) => { order.push('apply:' + patch.id); spec.regions[patch.id] = 1; return spec; },
    finish: ({ spec }) => { order.push('finish'); spec.behavior = true; return spec; },
    onSpec: spec => { order.push('publish:' + Object.values(spec.regions).join('')); publications.push(spec); },
    onProgress: event => events.push(event),
  }));
  assert.deepEqual(order, ['draft', 'publish:00', 'inspect:00', 'propose:a', 'propose:b', 'apply:a', 'inspect:10', 'publish:10', 'apply:b', 'inspect:11', 'publish:11', 'finish', 'inspect:11', 'publish:11']);
  assert.deepEqual(publications[0], layout(['a', 'b']));
  assert.deepEqual(publications.map(spec => spec.behavior), [false, false, false, true]);
  assert.deepEqual(events.map(event => event.phase), ['draft', 'round', 'accepted', 'accepted', 'finish', 'finished']);
  assert.deepEqual(Object.keys(result).sort(), ['accepted', 'assessment', 'reason', 'rejected', 'requests', 'spec']);
  assert.equal(result.reason, 'complete');
  assert.equal(result.requests, 0);
  assert.equal(result.accepted, 2);
  assert.equal(result.rejected, 0);
});

test('parallel proposals have detached snapshots; apply and inspect use the latest incumbent', { timeout: 2000 }, async () => {
  const hold = gate(), ready = gate(), started = [], applies = [], publications = [];
  let activeInspections = 0, live;
  const pending = run(base({
    onSpec: async spec => { live = structuredClone(spec); publications.push(structuredClone(spec)); spec.required = false; await tick(); },
    propose: async ({ spec, defect }) => {
      assert.deepEqual(spec, layout()); started.push(defect.targetId);
      if (started.length === 3) ready.resolve();
      spec.regions.a = 900; defect.message = 'Mutated';
      await hold.promise;
      return { id: defect.targetId };
    },
    apply: ({ spec, patch, defect }) => {
      assert.equal(defect.message, 'Needs repair');
      applies.push(structuredClone(spec));
      spec.regions[patch.id] = 1; return spec;
    },
    inspect: async ({ spec }) => {
      assert.equal(activeInspections++, 0);
      const snapshot = structuredClone(live);
      const answer = assess(spec);
      spec.required = false;
      await tick(); assert.deepEqual(live, snapshot);
      activeInspections--; return answer;
    },
  }));
  await ready.promise;
  assert.deepEqual(started, ['a', 'b', 'c']);
  assert.equal(publications.length, 1);
  hold.resolve();
  const result = await pending;
  assert.deepEqual(applies.map(spec => Object.values(spec.regions)), [[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
  assert.equal(result.reason, 'complete');
  assert.equal(result.spec.required, true);
});

test('same-target and ancestor conflicts stay out of a parallel round', async () => {
  const rounds = [], conflicts = [];
  const result = await run(base({
    draft: () => ({ fixed: [] }),
    inspect: ({ spec }) => ({ complete: true, defects: [defect('parent'), defect('parent', 'spacing'), defect('child'), defect('other')].filter(item => !spec.fixed.includes(item.id)), checks: [{ id: 'required', pass: true }] }),
    conflicts: (a, b, spec) => { conflicts.push([a.targetId, b.targetId]); spec.fixed.push('mutation'); return a.targetId === 'child' && b.targetId === 'parent'; },
    propose: ({ defect }) => defect.id,
    apply: ({ spec, patch }) => { spec.fixed.push(patch); return spec; },
    onProgress: event => { if (event.phase === 'round') rounds.push(event.targets.map(item => item.id)); },
  }));
  assert.deepEqual(rounds, [['parent-layout', 'other-layout'], ['parent-spacing']]);
  assert.ok(conflicts.some(([a, b]) => a === 'child' && b === 'parent'));
  assert.equal(result.reason, 'incomplete');
  assert.equal(result.accepted, 3);
  assert.equal(result.spec.fixed.includes('mutation'), false);
});

for (const mode of ['unresolved', 'new-defect', 'check-regression', 'missing-check', 'invalid-evidence', 'invalid-patch']) {
  test('rejects ' + mode + ' and preserves the incumbent for the next candidate', async () => {
    const events = [], publications = [];
    const result = await run(base({
      maxRounds: 1,
      draft: () => layout(['a', 'b']),
      apply: ({ spec, patch }) => {
        if (patch.id === 'a') {
          if (mode === 'invalid-patch') { spec.required = false; throw new TypeError('Invalid patch'); }
          spec.candidate = true;
        } else assert.equal(spec.candidate, undefined);
        spec.regions[patch.id] = 1; return spec;
      },
      inspect: ({ spec }) => {
        const answer = assess(spec);
        if (!spec.candidate) return answer;
        if (mode === 'unresolved') answer.defects.push({ ...defect('a'), id: 'renamed-by-inspector' });
        if (mode === 'new-defect') answer.defects.push(defect('elsewhere'));
        if (mode === 'check-regression') answer.checks[0].pass = false;
        if (mode === 'missing-check') answer.checks = [{ id: 'substitute', pass: true }];
        if (mode === 'invalid-evidence') return undefined;
        return answer;
      },
      onSpec: spec => publications.push(spec), onProgress: event => events.push(event),
    }));
    assert.equal(result.accepted, 1);
    assert.equal(result.rejected, 1);
    assert.equal(result.spec.regions.a, 0);
    assert.equal(result.spec.regions.b, 1);
    assert.equal(result.spec.candidate, undefined);
    assert.equal(publications.length, 2);
    assert.equal(events.find(event => event.phase === 'rejected').reason, mode === 'missing-check' ? 'check-regression' : mode === 'invalid-evidence' ? 'unverified' : mode);
  });
}

test('acceptance preserves checks newly made passing by an earlier repair', async () => {
  const result = await run(base({
    maxRounds: 1,
    draft: () => layout(['a', 'b']),
    inspect: ({ spec }) => ({ ...assess(spec), checks: [{ id: 'required', pass: true }, { id: 'new-pass', pass: spec.regions.a === 1 && spec.regions.b === 0 }] }),
  }));
  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 1);
  assert.deepEqual(result.spec.regions, { a: 1, b: 0 });
});

test('skips a stale proposal if an earlier accepted patch resolves its defect', async () => {
  let applies = 0;
  const result = await run(base({
    draft: () => layout(['a', 'b']),
    apply: ({ spec }) => { applies++; spec.regions = { a: 1, b: 1 }; return spec; },
  }));
  assert.equal(applies, 1);
  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 1);
  assert.equal(result.reason, 'complete');
});

test('identity falls back to id and does not treat message changes as resolution', async () => {
  let inspectCount = 0;
  const result = await run(base({
    maxRounds: 1,
    inspect: () => ({ complete: true, defects: [{ id: 'only-id', message: String(inspectCount++) }], checks: [{ id: 'required', pass: true }] }),
    apply: ({ spec }) => spec,
  }));
  assert.equal(result.rejected, 1);
  assert.equal(result.accepted, 0);
});

const malformed = [undefined, null, {}, { complete: false, defects: [], checks: [{ id: 'a', pass: true }] },
  { complete: true, defects: [], checks: [] }, { complete: true, defects: [], checks: [{ id: 'a', pass: 'yes' }] },
  { complete: true, defects: [], checks: [{ id: 'a', pass: true }, { id: 'a', pass: false }] },
  { complete: true, defects: [defect('a'), defect('a')], checks: [{ id: 'a', pass: true }] },
  { complete: true, defects: [{}], checks: [{ id: 'a', pass: true }] }];
for (const [index, invalid] of malformed.entries()) test('missing or malformed evidence remains unverified: ' + index, async () => {
  let proposals = 0, finishes = 0;
  const result = await run(base({ inspect: () => invalid, propose: () => { proposals++; }, finish: ({ spec }) => { finishes++; return spec; } }));
  assert.equal(result.reason, 'unverified');
  assert.equal(result.assessment, null);
  assert.equal(proposals, 0);
  assert.equal(finishes, 1);
});

test('finish runs once, can repair behavior internally, and leaves fresh journey evidence in the result', async () => {
  let finishes = 0, calls = 0, inspections = 0;
  const result = await run(base({
    draft: () => layout([]),
    inspect: ({ spec }) => { inspections++; return { ...assess(spec), checks: [...assess(spec).checks, ...(spec.behavior ? [{ id: 'journey-cart', pass: true }] : [])] }; },
    finish: async ({ spec, request, signal }) => {
      finishes++;
      await request(shared => { assert.equal(shared, signal); calls++; });
      await request(() => { calls++; });
      spec.behavior = true; return spec;
    },
  }));
  assert.equal(finishes, 1);
  assert.equal(inspections, 2);
  assert.equal(result.requests, calls);
  assert.equal(calls, 2);
  assert.equal(result.reason, 'complete');
  assert.deepEqual(result.assessment.checks.map(item => item.id), ['required', 'journey-cart']);
});

test('failed new journeys retain usable behavior but return incomplete', async () => {
  const publications = [];
  const result = await run(base({
    draft: () => layout([]),
    finish: ({ spec }) => { spec.behavior = true; return spec; },
    inspect: ({ spec }) => ({ complete: true, defects: spec.behavior ? [defect('cart', 'journey')] : [], checks: [{ id: 'required', pass: true }, ...(spec.behavior ? [{ id: 'journey-cart', pass: false }] : [])] }),
    onSpec: spec => publications.push(spec),
  }));
  assert.equal(result.reason, 'incomplete');
  assert.equal(result.spec.behavior, true);
  assert.equal(result.assessment.checks[1].pass, false);
  assert.equal(publications.length, 2);
});

for (const kind of ['overflow', 'layout', 'broken-image', 'content']) test('finish rejects new ' + kind + ' defects despite passing prior checks', async () => {
  const publications = [], events = [];
  const result = await run(base({
    draft: () => layout([]),
    finish: ({ spec }) => { spec.behavior = true; return spec; },
    inspect: ({ spec }) => ({ ...assess(spec), defects: spec.behavior ? [defect('page', kind)] : [] }),
    onSpec: spec => publications.push(spec), onProgress: event => events.push(event),
  }));
  assert.equal(result.reason, 'incomplete');
  assert.equal(result.spec.behavior, false);
  assert.equal(publications.length, 1);
  assert.equal(events.find(event => event.phase === 'finished').reason, 'new-defect');
  assert.equal(result.finishRejection, 'new-defect');
  assert.ok(result.attemptedAssessment.defects.some(item => item.kind === kind));
});

test('integration width and journey behavior defect kinds retain usable behavior', async () => {
  const result = await run(base({
    draft: () => layout([]), finish: ({ spec }) => { spec.behavior = true; return spec; },
    inspect: ({ spec }) => ({ ...assess(spec), defects: spec.behavior ? [defect('cart', '375:checkout:behavior')] : [] }),
  }));
  assert.equal(result.reason, 'incomplete');
  assert.equal(result.spec.behavior, true);
});

for (const scope of ['initial', 'journey', 'action']) test('completion layout handling distinguishes ' + scope + ' scope', async () => {
  const result = await run(base({
    draft: () => layout([]),
    finish: async ({ spec, request }) => { await request(() => true); spec.behavior = true; return spec; },
    inspect: ({ spec }) => ({ ...assess(spec), defects: spec.behavior ? [{ ...defect('journey-panel', '390:results:horizontal-overflow'), scope }] : [] })
  }));
  assert.equal(result.requests, 1);
  assert.equal(result.reason, 'incomplete');
  assert.equal(result.spec.behavior, scope === 'journey');
  if (scope === 'journey') assert.equal(result.assessment.defects[0].scope, 'journey');
  else assert.equal(result.finishRejection, 'new-defect');
});

test('reached-state layout evidence cannot hide a lost passing check', async () => {
  const result = await run(base({
    draft: () => layout([]), finish: ({ spec }) => { spec.behavior = true; return spec; },
    inspect: ({ spec }) => ({ complete: true, defects: spec.behavior ? [{ ...defect('results', 'clipped-text'), scope: 'journey' }] : [], checks: [{ id: 'required', pass: !spec.behavior }] })
  }));
  assert.equal(result.spec.behavior, false);
  assert.equal(result.finishRejection, 'check-regression');
});

for (const journey of ['results', 'behavior-check', 'behavior']) test('reached-state runtime errors still reject the candidate with journey ' + journey, async () => {
  const result = await run(base({
    draft: () => layout([]), finish: ({ spec }) => { spec.behavior = true; return spec; },
    inspect: ({ spec }) => ({ ...assess(spec), defects: spec.behavior ? [{ ...defect('journey-panel', '390:' + journey + ':runtime-error'), scope: 'journey' }] : [] })
  }));
  assert.equal(result.spec.behavior, false);
  assert.equal(result.finishRejection, 'new-defect');
});

for (const viaRequest of [false, true]) for (const kind of ['decode', 'validation', 'refusal']) test('local ' + kind + ' failure preserves siblings, request wrapper: ' + viaRequest, async () => {
  const events = [];
  const result = await run(base({ maxRounds: 1,
    propose: ({ defect, request }) => {
      const callback = () => {
        if (defect.targetId === 'a') {
          if (kind === 'decode') throw new SyntaxError('Invalid JSON containing quota text');
          if (kind === 'validation') throw Object.assign(new Error('Invalid Hybrid journey schema constraints'), { name: 'ValidationError' });
          throw new Error('Model rejected the candidate');
        }
        return { id: defect.targetId };
      };
      return viaRequest ? request(callback) : callback();
    }, onProgress: event => events.push(event),
  }));
  assert.equal(result.reason, 'incomplete');
  assert.equal(result.accepted, 2);
  assert.equal(result.rejected, 1);
  assert.deepEqual(result.spec.regions, { a: 0, b: 1, c: 1 });
  assert.equal(typeof result.error, 'string');
  assert.ok(events.some(event => event.phase === 'error' && event.error === result.error));
});

test('local draft validation fails gracefully with its original diagnostic', async () => {
  const result = await run(base({ draft: ({ request }) => request(() => { throw new Error('Invalid Hybrid journey schema constraints'); }) }));
  assert.equal(result.reason, 'unverified');
  assert.equal(result.spec, null);
  assert.equal(result.requests, 1);
  assert.equal(result.error, 'Invalid Hybrid journey schema constraints');
});

for (const runtime of ['CommonJS', 'browser']) for (const stage of ['draft', 'inspect']) for (const afterRequest of [false, true]) {
  test(runtime + ' reports plain local ' + stage + ' errors, after successful request: ' + afterRequest, async () => {
    const events = [];
    let execute = run, requests = 0;
    if (runtime === 'browser') {
      const context = vm.createContext({ AbortController, setTimeout, clearTimeout });
      vm.runInContext(source, context);
      execute = context.DaubHybrid.run;
    }
    const fail = () => { throw new Error('Invalid Hybrid requirement'); };
    const result = await execute(base({
      [stage]: afterRequest ? async ({ request }) => { await request(() => { requests++; return {}; }); fail(); } : fail,
      onProgress: event => events.push(event),
    }));
    assert.equal(result.reason, 'unverified');
    assert.equal(result.error, 'Invalid Hybrid requirement');
    assert.equal(result.requests, requests);
    assert.deepEqual(plain(result.spec), stage === 'draft' ? null : layout());
    const diagnostics = events.filter(event => event.phase === 'error');
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].reason, 'unverified');
    assert.equal(diagnostics[0].error, result.error);
  });
}

for (const stage of ['draft', 'inspect']) test('sanitizes local ' + stage + ' diagnostics without copying error metadata', async () => {
  const events = [];
  const result = await run(base({
    [stage]: () => { throw Object.assign(new Error('Invalid Hybrid requirement\nBearer secret-token sk-secret api_key=secret ' + 'x'.repeat(600)), { response: { body: 'PRIVATE BODY' }, detail: 'PRIVATE DETAIL' }); },
    onProgress: event => events.push(event),
  }));
  assert.equal(result.reason, 'unverified');
  assert.equal(result.error.length, 500);
  assert.equal(/secret|PRIVATE|\n/.test(result.error), false);
  assert.ok(result.error.startsWith('Invalid Hybrid requirement Bearer [redacted]'));
  assert.equal(events.find(event => event.phase === 'error').error, result.error);
});

test('a local inspection decode failure rejects only that candidate', async () => {
  const result = await run(base({ maxRounds: 1,
    inspect: ({ spec, request }) => request(() => { if (spec.regions.a) throw new SyntaxError('Invalid evidence'); return assess(spec); }),
  }));
  assert.equal(result.accepted, 2);
  assert.equal(result.rejected, 1);
  assert.equal(result.reason, 'incomplete');
});

test('fatal errors retain a bounded redacted message and do not await an error observer', { timeout: 2000 }, async () => {
  const events = [];
  const result = await run(base({
    draft: ({ request }) => request(() => { throw Object.assign(new Error('Quota\nBearer secret-token sk-secret api_key=secret ' + 'x'.repeat(600)), { status: 429, response: { body: 'PRIVATE BODY' } }); }),
    onProgress: event => { events.push(event); if (event.phase === 'error') return new Promise(() => {}); },
  }));
  assert.equal(result.reason, 'provider-error');
  assert.equal(result.error.length, 500);
  assert.equal(/secret|PRIVATE|\n/.test(result.error), false);
  assert.ok(result.error.startsWith('Quota Bearer [redacted]'));
  assert.equal(events.find(event => event.phase === 'error').error, result.error);
});

for (const mode of ['missing', 'failing', 'invalid', 'invalid-spec']) test('finish rolls back ' + mode + ' incumbent evidence', async () => {
  let inspections = 0;
  const publications = [];
  const result = await run(base({
    draft: () => layout([]),
    finish: ({ spec }) => { spec.behavior = true; return mode === 'invalid-spec' ? undefined : spec; },
    inspect: ({ spec }) => {
      if (++inspections === 1) return assess(spec);
      if (mode === 'invalid') return undefined;
      return { complete: true, defects: [], checks: [{ id: mode === 'missing' ? 'substitute' : 'required', pass: mode !== 'failing' }] };
    }, onSpec: spec => publications.push(spec),
  }));
  assert.equal(result.spec.behavior, false);
  assert.equal(publications.length, 1);
  assert.notEqual(result.reason, 'complete');
});

test('no-op finish cannot replace previously passing checks with a different checklist', async () => {
  let inspections = 0;
  const result = await run(base({ draft: () => layout([]), inspect: () => ({ complete: true, defects: [], checks: [{ id: ++inspections === 1 ? 'required' : 'replacement', pass: true }] }) }));
  assert.equal(result.reason, 'incomplete');
  assert.equal(result.assessment.checks[0].id, 'required');
});

for (const keyed of [false, true]) test('the request budget reserves one call each for finish and final inspection, keyed: ' + keyed, async () => {
  const calls = [];
  const result = await run(base({
    maxRequests: 6,
    ...(keyed ? { repairKey: (spec, defect) => defect.targetId } : {}),
    draft: ({ request }) => request(() => { calls.push('draft'); return layout(); }),
    inspect: ({ spec, request }) => request(() => { calls.push('inspect'); return assess(spec); }),
    propose: ({ defect, request }) => request(() => { calls.push('propose:' + defect.targetId); return { id: defect.targetId }; }),
    finish: ({ spec, request }) => request(() => { calls.push('finish'); return spec; }),
  }));
  assert.equal(result.reason, 'request-limit');
  assert.equal(result.requests, 6);
  assert.deepEqual(calls, ['draft', 'inspect', 'propose:a', 'propose:b', 'finish', 'inspect']);
  assert.deepEqual(result.spec, layout());
});

test('finish can catch a denied optional repair and still use its completed behavior', async () => {
  let calls = 0;
  const result = await run(base({
    maxRequests: 4,
    draft: ({ request }) => request(() => { calls++; return layout([]); }),
    inspect: ({ spec, request }) => request(() => { calls++; return assess(spec); }),
    finish: async ({ spec, request }) => {
      await request(() => { calls++; spec.behavior = true; });
      await assert.rejects(request(() => { calls++; }), error => error.reason === 'request-limit');
      return spec;
    },
  }));
  assert.equal(result.reason, 'complete');
  assert.equal(result.requests, 4);
  assert.equal(calls, 4);
  assert.equal(result.spec.behavior, true);
});

for (const concurrency of [1, 2, 3]) test('all provider requests share concurrency ' + concurrency, async () => {
  let active = 0, peak = 0, calls = 0;
  const result = await run(base({ concurrency,
    propose: async ({ defect, request }) => {
      await Promise.all([1, 2, 3].map(() => request(async () => { active++; calls++; peak = Math.max(peak, active); await tick(); active--; })));
      return { id: defect.targetId };
    },
  }));
  assert.equal(peak, concurrency);
  assert.equal(active, 0);
  assert.equal(result.requests, calls);
  assert.ok(result.requests <= limits.maxRequests);
});

test('two rounds schedule at most six proposals without retrying malformed patches', async () => {
  let proposals = 0;
  const result = await run(base({ propose: () => { proposals++; return undefined; } }));
  assert.equal(proposals, 6);
  assert.equal(result.accepted, 0);
  assert.equal(result.rejected, 6);
  assert.equal(result.reason, 'incomplete');
});

test('repairKey attempts an unresolved key once per run and finishes', async () => {
  for (const keyed of [false, true]) {
    let proposals = 0, finishes = 0;
    const options = base({
      draft: () => layout(['a']),
      propose: ({ request }) => request(() => { proposals++; return {}; }),
      apply: ({ spec }) => spec,
      finish: ({ spec }) => { finishes++; return spec; },
      ...(keyed ? { repairKey: () => 'same' } : {}),
    });
    for (let runIndex = 0; runIndex < 2; runIndex++) {
      const result = await run(options);
      assert.equal(result.rejected, keyed ? 1 : 2);
      assert.equal(result.requests, keyed ? 1 : 2);
      assert.equal(result.reason, 'incomplete');
    }
    assert.equal(proposals, keyed ? 2 : 4);
    assert.equal(finishes, 2);
  }
});

test('repairKey skips used keys and continues to an independent region', async () => {
  const proposals = [];
  const result = await run(base({
    concurrency: 1,
    draft: () => layout(['a', 'b']),
    repairKey: (spec, defect) => JSON.stringify([defect.kind, defect.targetId, spec.regions[defect.targetId]]),
    propose: ({ defect }) => { proposals.push(defect.targetId); return { id: defect.targetId }; },
    apply: ({ spec, patch }) => { if (patch.id === 'b') spec.regions.b = 1; return spec; },
  }));
  assert.deepEqual(proposals, ['a', 'b']);
  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 1);
  assert.deepEqual(result.spec.regions, { a: 0, b: 1 });
});

test('repairKey deduplicates within a round without consuming an independent slot', async () => {
  const proposals = [], rounds = [];
  const result = await run(base({
    repairKey: (spec, defect) => defect.targetId === 'c' ? 'independent' : 'same',
    propose: ({ defect }) => { proposals.push(defect.targetId); return {}; },
    apply: ({ spec }) => spec,
    onProgress: event => { if (event.phase === 'round') rounds.push(event.targets.map(item => item.targetId)); },
  }));
  assert.deepEqual(proposals, ['a', 'c']);
  assert.deepEqual(rounds, [['a', 'c']]);
  assert.equal(result.rejected, 2);
});

test('repairKey does not consume keys for conflict-blocked targets', async () => {
  const proposals = [];
  const result = await run(base({
    draft: () => layout(['a', 'b']),
    repairKey: (spec, defect) => defect.targetId,
    conflicts: () => true,
    propose: ({ defect }) => { proposals.push(defect.targetId); return { id: defect.targetId }; },
    apply: ({ spec, patch }) => { if (patch.id === 'b') spec.regions.b = 1; return spec; },
  }));
  assert.deepEqual(proposals, ['a', 'b']);
  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 1);
});

test('repairKey permits a changed key after an accepted context change', async () => {
  const proposals = [];
  const result = await run(base({
    draft: () => ({ ...layout(['a', 'b']), parentLayout: 'before' }),
    repairKey: (spec, defect) => JSON.stringify([defect.kind, defect.targetId, spec.parentLayout]),
    propose: ({ defect }) => { proposals.push(defect.targetId); return { id: defect.targetId }; },
    apply: ({ spec, patch }) => {
      if (patch.id === 'b') { spec.regions.b = 1; spec.parentLayout = 'after'; }
      else if (spec.parentLayout === 'after') spec.regions.a = 1;
      return spec;
    },
  }));
  assert.deepEqual(proposals, ['a', 'b', 'a']);
  assert.equal(result.accepted, 2);
  assert.equal(result.rejected, 1);
  assert.equal(result.reason, 'complete');
});

test('repairKey receives detached positional arguments without provider capabilities', async () => {
  const seen = [];
  const result = await run(base({
    repairKey: function (spec, item) {
      assert.equal(arguments.length, 2);
      assert.deepEqual(spec, layout());
      assert.equal(item.message, 'Needs repair');
      seen.push(item.targetId);
      const key = item.targetId;
      spec.regions.a = 999; spec.required = false;
      item.targetId = 'mutated'; item.message = 'mutated';
      return key;
    },
    propose: ({ spec, defect }) => {
      assert.deepEqual(spec, layout());
      assert.equal(defect.message, 'Needs repair');
      return { id: defect.targetId };
    },
  }));
  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.equal(result.reason, 'complete');
});

for (const [label, repairKey] of [
  ['throw', () => { throw new Error('Key failed'); }],
  ['quota', () => { throw Object.assign(new Error('Quota exhausted'), { status: 429 }); }],
  ['empty', () => ''], ['blank', () => ' \t\n'], ['oversized', () => 'x'.repeat(65537)],
  ['number', () => 1], ['object', () => ({ key: 'a' })], ['undefined', () => undefined],
  ['promise', () => Promise.resolve('a')], ['rejected promise', async () => { throw new Error('Async key'); }],
]) test('repairKey fails closed for ' + label, async () => {
  let keys = 0, proposals = 0, finishes = 0;
  const result = await run(base({
    repairKey: (...args) => { if (++keys === 1) return 'first'; return repairKey(...args); },
    propose: () => { proposals++; return {}; },
    finish: ({ spec }) => { finishes++; return spec; },
  }));
  assert.equal(keys, 2);
  assert.equal(proposals, 0);
  assert.equal(finishes, 0);
  assert.equal(result.requests, 0);
  assert.equal(result.reason, label === 'quota' ? 'provider-error' : 'unverified');
  assert.equal(typeof result.error, 'string');
  assert.deepEqual(result.spec, layout());
  await tick();
});

test('repairKey accepts the maximum length and respects cancellation and deadline checks', async () => {
  const result = await run(base({ repairKey: () => 'x'.repeat(65536) }));
  assert.equal(result.accepted, 1);
  const controller = new AbortController();
  await assert.rejects(run(base({
    signal: controller.signal,
    repairKey: () => { controller.abort(); return 'key'; },
    propose: () => assert.fail('proposal after cancellation'),
    finish: () => assert.fail('finish after cancellation'),
  })), error => {
    assert.equal(error.name, 'AbortError');
    assert.deepEqual(error.partialSpec, layout());
    return true;
  });
  const clock = clocked();
  const expired = await clock.run(base({
    repairKey: () => { clock.advance(); return 'key'; },
    propose: () => assert.fail('proposal after deadline'),
    finish: () => assert.fail('finish after deadline'),
  }));
  assert.equal(expired.reason, 'time-limit');
  assert.deepEqual(plain(expired.spec), layout());
});

test('repairKey does not retry a quota-failed proposal or finish', async () => {
  let keys = 0, calls = 0;
  const result = await run(base({
    concurrency: 1,
    repairKey: () => { keys++; return 'key'; },
    propose: ({ request }) => request(() => { calls++; throw Object.assign(new Error('Quota exhausted'), { status: 429 }); }),
    finish: () => assert.fail('finish after quota failure'),
  }));
  assert.equal(result.reason, 'provider-error');
  assert.equal(keys, 1);
  assert.equal(calls, 1);
  assert.equal(result.requests, 1);
});

for (const error of [401, 402, 403, 429, 500, 'Quota exhausted', 'Rate limit reached']) {
  test('provider failure ' + error + ' aborts and drains siblings with no late publication', { timeout: 2000 }, async () => {
    const hold = gate(), signals = [], calls = [], publications = [];
    const result = await run(base({
      propose: async ({ request, signal, defect }) => {
        signals.push(signal);
        return request(async () => {
          calls.push(defect.targetId);
          if (defect.targetId === 'a') { await tick(); throw typeof error === 'number' ? Object.assign(new Error('Provider failed'), { status: error }) : new Error(error); }
          await hold.promise; return { id: defect.targetId };
        });
      },
      finish: () => { assert.fail('finish after provider failure'); },
      onSpec: spec => publications.push(spec),
    }));
    assert.equal(result.reason, 'provider-error');
    assert.deepEqual(result.spec, layout());
    assert.equal(result.requests, 3);
    assert.deepEqual(calls, ['a', 'b', 'c']);
    assert.equal(new Set(signals).size, 1);
    assert.ok(signals.every(signal => signal.aborted));
    hold.resolve(); await tick();
    assert.equal(publications.length, 1);
  });
}

test('a callback cannot swallow a provider failure and trigger another call', async () => {
  let calls = 0;
  const result = await run(base({
    draft: async ({ request }) => {
      try { await request(() => { calls++; throw new Error('Quota'); }); } catch (_) {}
      try { await request(() => { calls++; }); } catch (_) {}
      return layout();
    },
  }));
  assert.equal(result.reason, 'provider-error');
  assert.equal(result.spec, null);
  assert.equal(calls, 1);
});

test('direct callback failures also abort workers that ignore cancellation', { timeout: 2000 }, async () => {
  const result = await run(base({ propose: async ({ defect }) => { if (defect.targetId === 'a') throw new Error('quota exceeded'); return new Promise(() => {}); } }));
  assert.equal(result.reason, 'provider-error');
  assert.equal(result.requests, 0);
});

test('a failure after one accepted repair retains that repair', async () => {
  const result = await run(base({
    inspect: ({ spec }) => { if (spec.regions.b) throw Object.assign(new Error('Provider unavailable'), { status: 503 }); return assess(spec); },
  }));
  assert.equal(result.reason, 'provider-error');
  assert.equal(result.accepted, 1);
  assert.deepEqual(result.spec.regions, { a: 1, b: 0, c: 0 });
  assert.deepEqual(result.assessment.defects.map(item => item.targetId), ['b', 'c']);
});

for (const phase of ['draft', 'inspect', 'propose', 'apply', 'finish', 'onSpec', 'onProgress', 'conflicts']) {
  test('deadline bounds an ignored abort in ' + phase, { timeout: 2000 }, async () => {
    const clock = clocked(), entered = gate(), hold = gate();
    const publications = [];
    const options = base({ onSpec: spec => publications.push(spec) });
    options[phase] = () => { entered.resolve(); return hold.promise; };
    const pending = clock.run(options);
    await entered.promise;
    clock.expire();
    const result = await pending;
    assert.equal(result.reason, 'time-limit');
    assert.equal(clock.cleared(), true);
    const expected = phase === 'draft' || phase === 'onProgress' ? null : layout();
    if (phase === 'finish') expected.regions = { a: 1, b: 1, c: 1 };
    assert.deepEqual(plain(result.spec), expected);
    const count = publications.length;
    hold.resolve(layout()); await tick();
    assert.equal(publications.length, count);
  });
}

test('the monotonic deadline stops work even before the timer fires', async () => {
  const clock = clocked(); let inspections = 0;
  const result = await clock.run(base({ onSpec: () => clock.advance(), inspect: () => { inspections++; } }));
  assert.equal(result.reason, 'time-limit');
  assert.equal(inspections, 0);
});

test('external cancellation rejects with detached partialSpec and prevents late requests', { timeout: 2000 }, async () => {
  const controller = new AbortController(), hold = gate(), signals = [], publications = [];
  let retainedRequest, calls = 0;
  const pending = run(base({ signal: controller.signal,
    propose: ({ signal, request }) => { retainedRequest = request; signals.push(signal); return hold.promise; },
    onSpec: spec => publications.push(spec),
  }));
  pending.catch(() => {});
  await tick(); controller.abort();
  await assert.rejects(pending, error => {
    assert.equal(error.name, 'AbortError');
    assert.deepEqual(error.partialSpec, layout());
    error.partialSpec.required = false; return true;
  });
  assert.ok(signals.every(signal => signal.aborted));
  await assert.rejects(retainedRequest(() => calls++), { name: 'AbortError' });
  hold.resolve({ id: 'a' }); await tick();
  assert.equal(calls, 0);
  assert.equal(publications.length, 1);
  assert.equal(publications[0].required, true);
});

test('a pre-aborted run does not enter any callback', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(run(base({ signal: controller.signal, draft: () => assert.fail('entered draft'), onProgress: () => assert.fail('entered progress') })), error => error.name === 'AbortError' && error.partialSpec === null);
});

test('closed callback request functions cannot spend the final reserve', async () => {
  let retainedRequest, calls = 0;
  const result = await run(base({
    draft: ({ request }) => { retainedRequest = request; return layout([]); },
    finish: async ({ spec }) => { await assert.rejects(retainedRequest(() => calls++), error => error.reason === 'closed'); return spec; },
  }));
  await assert.rejects(retainedRequest(() => calls++));
  assert.equal(result.reason, 'complete');
  assert.equal(result.requests, 0);
  assert.equal(calls, 0);
});

test('fire-and-forget requests drain before inspection and count toward the shared budget', async () => {
  let completed = false;
  const result = await run(base({
    draft: ({ request }) => { request(async () => { await tick(); completed = true; }); return layout([]); },
    inspect: ({ spec }) => { assert.equal(completed, true); return assess(spec); },
  }));
  assert.equal(result.requests, 1);
  assert.equal(result.reason, 'complete');
});

test('quota failure discards queued provider calls behind the global semaphore', async () => {
  const calls = [];
  const result = await run(base({ concurrency: 1,
    draft: async ({ request }) => {
      await Promise.all([1, 2, 3].map(id => request(() => { calls.push(id); throw new Error('Quota'); })));
      return layout();
    },
  }));
  assert.equal(result.reason, 'provider-error');
  assert.deepEqual(calls, [1]);
  assert.equal(result.requests, 1);
});

test('limits object overrides defaults and a zero-round run skips proposals', async () => {
  const result = await run(base({ limits: { maxRounds: 0, maxRequests: 4, maxConcurrency: 1, maxDurationMs: 1000 }, propose: () => assert.fail('unexpected proposal') }));
  assert.equal(result.reason, 'incomplete');
  assert.equal(result.accepted, 0);
});

for (const options of [{ concurrency: 0 }, { concurrency: 4 }, { maxRounds: 3 }, { maxRequests: 19 }, { maxRequests: 1 }, { maxDurationMs: 180001 }, { maxDurationMs: NaN }, { maxRounds: 0.5 }, { inspect: null }, { repairKey: null }, { repairKey: 'key' }]) {
  test('rejects invalid options ' + JSON.stringify(options), async () => {
    await assert.rejects(run(base(options)), /Invalid|must be a function/);
  });
}
