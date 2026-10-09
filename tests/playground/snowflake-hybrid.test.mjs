import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const { run, responseFormat, decodeOutput, limits } = createRequire(import.meta.url)('../../playground-snowflake.js');
const stack = (children = [], props = {}) => ({ type: 'Stack', props, children });
const text = content => ({ type: 'Text', props: { content }, children: [] });
const baseline = () => ({ root: 'page', theme: 'paper', state: { count: 1 }, elements: {
  page: stack(['heading', 'save', 'duplicate']), heading: text('Profile'),
  save: { type: 'Button', props: { label: 'Save' }, children: [] }, duplicate: text('Save'),
} });
const replacement = () => ({ root: 'page', elements: {
  page: { type: 'Surface', props: {}, children: ['save', 'heading'] },
  save: { type: 'Button', props: { label: 'Save profile' }, children: [] }, heading: text('Your profile'),
} });
const scores = (targets, selected = []) => ({ decisions: targets.map(id => ({ id, needsDetail: selected.includes(id), probability: 0.9 })) });
const duplicateAudit = spec => spec.elements.duplicate ? ['Duplicate Save control'] : [];
const base = overrides => ({ prompt: 'Profile settings', generate: () => baseline(), judge: ({ targets }) => scores(targets), ...overrides });
const tick = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

for (const stage of ['design', 'reconcile']) test(stage + ' uses strict full native nodes and decodes the root/elements wire shape', () => {
  const format = responseFormat(stage), schema = format.json_schema.schema;
  assert.equal(format.json_schema.strict, true);
  assert.deepEqual(schema.required, ['root', 'elements']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.elements.items.required, ['id', 'type', 'props', 'children']);
  const types = schema.properties.elements.items.properties.type.enum;
  assert.ok(types.includes('Button') && types.includes('Surface'));
  assert.ok(!types.includes('CustomHTML') && !types.includes('Layout'));
  const wire = { root: 'page', elements: [
    { id: 'page', type: 'Stack', props: [], children: ['title'] },
    { id: 'title', type: 'Text', props: [{ name: 'content', value: 'Profile' }], children: [] },
  ] };
  assert.deepEqual(decodeOutput(wire, stage), { root: 'page', elements: { page: stack(['title']), title: text('Profile') } });
  for (const type of ['CustomHTML', 'Layout']) {
    assert.throws(() => decodeOutput({ ...wire, elements: [{ ...wire.elements[0], type }] }, stage), /component/);
  }
  assert.throws(() => decodeOutput({ ...wire, state: {} }, stage), /schema/);
  assert.throws(() => decodeOutput({ ...wire, elements: [{ ...wire.elements[0], props: {} }] }, stage), /properties/);
});

for (const scheduling of ['level', 'queue']) {
  test(scheduling + ': complete baseline publishes before root assessment; legacy keeps layout/children', async () => {
    for (const completeLayout of [false, true]) {
      const trace = [];
      const result = await run(base({ scheduling, completeLayout,
        generate: ({ stage, spec, targetId, depth }) => { trace.push([stage, spec, targetId, depth]); return baseline(); },
        onSpec: spec => { trace.push(['publish']); assert.deepEqual(spec, baseline()); },
        judge: ({ targets, depth }) => { trace.push(['judge', targets, depth]); return scores(targets); },
      }));
      assert.deepEqual(trace[0], [completeLayout ? 'design' : 'layout', null, null, 0]);
      assert.deepEqual(trace[1], ['publish']);
      assert.deepEqual(trace[2], ['judge', completeLayout ? ['page'] : ['heading', 'save', 'duplicate'], completeLayout ? 0 : 1]);
      assert.equal(result.reason, 'complete');
      assert.deepEqual(result.spec, baseline());
      assert.equal(result.requests, completeLayout ? 2 : 3);
    }
  });

  test(scheduling + ': audit triggers one root replacement that removes duplicates and changes type/content/order', async () => {
    const trace = [], published = [], auditSnapshots = [];
    const result = await run(base({ scheduling, completeLayout: true, reconcile: true,
      generate: args => {
        trace.push(args.stage);
        if (args.stage === 'design') return baseline();
        assert.equal(args.stage, 'reconcile');
        assert.equal(args.targetId, 'page'); assert.equal(args.depth, 0);
        assert.deepEqual(args.spec, baseline());
        assert.deepEqual(args.auditIssues, ['Duplicate Save control']);
        args.auditIssues.push('Mutated'); args.spec.state.count = 99;
        return replacement();
      },
      judge: ({ spec, targets }) => { trace.push('judge'); assert.deepEqual(targets, ['page']); return scores(targets); },
      audit: spec => { auditSnapshots.push(structuredClone(spec)); spec.state.count = 88; return duplicateAudit(spec); },
      onSpec: spec => { trace.push('publish'); published.push(spec); },
    }));
    assert.deepEqual(trace, ['design', 'publish', 'judge', 'reconcile', 'publish', 'judge']);
    assert.equal(auditSnapshots.length, 2);
    assert.equal(result.reason, 'complete');
    assert.equal(result.requests, 4);
    assert.deepEqual(result.spec, { ...replacement(), theme: 'paper', state: { count: 1 } });
    assert.equal(published.length, 2);
    assert.deepEqual(result.failedTargets, []);
    assert.deepEqual(result.unresolvedTargets, []);
    assert.deepEqual(result.auditIssues, []);
  });

  test(scheduling + ': hybrid retries a rejected branch once using repairError and a detached snapshot', async () => {
    const attempts = [], published = [];
    const initialSpec = { root: 'page', elements: { page: stack() } };
    const result = await run(base({ scheduling, completeLayout: true, initialSpec,
      generate: args => {
        attempts.push(args);
        if (attempts.length === 1) { args.spec.elements.page.props.mutated = true; return { root: 'wrong', elements: {} }; }
        assert.match(args.repairError, /root/i);
        assert.deepEqual(args.spec, initialSpec);
        return { root: 'page', elements: { page: stack(['title']), title: text('Ready') } };
      },
      judge: ({ spec, targets }) => scores(targets, spec.elements.title ? [] : targets),
      onSpec: spec => published.push(spec),
    }));
    assert.equal(attempts.length, 2); assert.equal(attempts[0].repairError, undefined);
    assert.equal(result.reason, 'complete'); assert.deepEqual(result.failedTargets, []);
    assert.equal(result.spec.elements.title.props.content, 'Ready');
    assert.equal(result.requests, 6); assert.equal(published.length, 2);
  });

  test(scheduling + ': two rejected attempts stop the branch and retain its last valid spec', async () => {
    let attempts = 0;
    const result = await run(base({ scheduling, completeLayout: true, initialSpec: baseline(),
      generate: () => { attempts++; throw new SyntaxError('Invalid structured component'); },
      judge: ({ targets }) => scores(targets, targets),
    }));
    assert.equal(attempts, 2); assert.equal(result.requests, 3);
    assert.equal(result.reason, 'partial'); assert.deepEqual(result.failedTargets, ['page']);
    assert.deepEqual(result.spec, baseline());
  });

  test(scheduling + ': failed branches trigger reconciliation and clear only after root verification', async () => {
    const stages = [], judged = [];
    const result = await run(base({ scheduling, reconcile: true,
      generate: ({ stage, targetId, failedTargets }) => {
        stages.push(stage);
        if (stage === 'layout') return baseline();
        if (stage === 'refine') throw new SyntaxError('Bad component');
        assert.equal(targetId, 'page'); assert.deepEqual(failedTargets, ['duplicate']);
        return replacement();
      },
      judge: ({ targets }) => { judged.push(targets); return scores(targets, targets.includes('duplicate') ? ['duplicate'] : []); },
    }));
    assert.deepEqual(stages, ['layout', 'refine', 'refine', 'reconcile']);
    assert.deepEqual(judged, [['heading', 'save', 'duplicate'], ['page'], ['page']]);
    assert.equal(result.reason, 'complete'); assert.deepEqual(result.failedTargets, []);
    assert.equal(result.spec.elements.duplicate, undefined);
  });

  test(scheduling + ': unresolved root triggers one reconciliation without a deterministic audit', async () => {
    const stages = [];
    const result = await run(base({ scheduling, initialSpec: baseline(), reconcile: true,
      generate: ({ stage, spec, targetId, unresolvedTargets }) => {
        stages.push(stage);
        if (stage === 'refine') return { root: targetId, elements: { [targetId]: spec.elements[targetId] } };
        assert.deepEqual(unresolvedTargets, ['page']); return replacement();
      },
      judge: ({ spec, targets }) => scores(targets, spec.elements.duplicate && targets.includes('page') ? ['page'] : []),
    }));
    assert.deepEqual(stages, ['refine', 'reconcile']);
    assert.equal(result.reason, 'complete'); assert.deepEqual(result.unresolvedTargets, []);
  });
}

for (const make of [
  () => ({ root: 'other', elements: { other: stack() } }),
  () => ({ root: 'page', elements: { page: stack(['missing']) } }),
  () => ({ root: 'page', elements: { page: stack(['a', 'a']), a: text('Repeated') } }),
  () => ({ root: 'page', elements: { page: stack(), orphan: text('Orphan') } }),
  () => ({ root: 'page', elements: { page: { type: 'CustomHTML', props: { html: '<script></script>' } } } }),
  () => ({ root: 'page', elements: { page: { type: 'Layout', props: {} } } }),
  () => { throw new SyntaxError('Bad reconcile JSON'); },
]) test('rejected reconciliation keeps the last valid spec and does not retry: ' + make.toString(), async () => {
  let calls = 0; const published = [];
  const result = await run(base({ scheduling: 'queue', initialSpec: baseline(), reconcile: true, audit: duplicateAudit,
    generate: ({ stage }) => { calls++; assert.equal(stage, 'reconcile'); return make(); },
    onSpec: spec => published.push(spec),
  }));
  assert.equal(calls, 1); assert.equal(published.length, 1);
  assert.equal(result.reason, 'partial'); assert.ok(result.failedTargets.includes('page'));
  assert.deepEqual(result.spec, baseline()); assert.deepEqual(result.auditIssues, ['Duplicate Save control']);
});

for (const finalFailure of ['judge', 'audit']) test('valid replacement cannot claim complete after failing final ' + finalFailure, async () => {
  let reconciles = 0;
  const result = await run(base({ initialSpec: baseline(), reconcile: true,
    audit: spec => spec.elements.duplicate || finalFailure === 'audit' ? ['Coverage missing'] : [],
    generate: ({ stage }) => { assert.equal(stage, 'reconcile'); reconciles++; return replacement(); },
    judge: ({ spec, targets }) => scores(targets, !spec.elements.duplicate && finalFailure === 'judge' ? targets : []),
  }));
  assert.equal(reconciles, 1); assert.equal(result.reason, 'no-progress');
  assert.deepEqual(result.spec.elements, replacement().elements);
  if (finalFailure === 'judge') assert.ok(result.unresolvedTargets.includes('page'));
  else assert.deepEqual(result.auditIssues, ['Coverage missing']);
});

test('audit gates completion without enabling reconciliation; explicit reconciliation reviews even a clean root', async () => {
  for (const issues of [[], ['Missing field']]) {
    let generated = 0;
    const result = await run(base({ initialSpec: baseline(), audit: () => issues,
      generate: () => { generated++; return replacement(); },
    }));
    assert.equal(generated, 0); assert.equal(result.requests, 1);
    assert.equal(result.reason, issues.length ? 'no-progress' : 'complete');
    assert.deepEqual(result.auditIssues, issues);
  }
  let reconciles = 0;
  const result = await run(base({ initialSpec: replacement(), reconcile: true, audit: duplicateAudit,
    generate: ({ stage, auditIssues, unresolvedTargets }) => {
      assert.equal(stage, 'reconcile'); assert.deepEqual(auditIssues, []); assert.deepEqual(unresolvedTargets, []);
      reconciles++; return replacement();
    },
  }));
  assert.equal(result.reason, 'complete'); assert.equal(result.requests, 3); assert.equal(reconciles, 1);
});

test('audit hook must return a synchronous string array', async () => {
  for (const audit of [true, () => null, () => [3], async () => []]) {
    await assert.rejects(run(base({ initialSpec: baseline(), audit })), /hook|audit|array|synchronous/i);
  }
});

test('reconciliation can supply metadata while retaining unspecified global keys', async () => {
  const result = await run(base({ initialSpec: baseline(), reconcile: true, audit: duplicateAudit,
    generate: () => ({ ...replacement(), theme: 'ink' }),
  }));
  assert.equal(result.spec.theme, 'ink'); assert.deepEqual(result.spec.state, { count: 1 });
});

for (const scheduling of ['level', 'queue']) {
  test(scheduling + ': quota and fatal errors never repair or reconcile', async () => {
    for (const error of [Object.assign(new Error('Rate limit'), { status: 429 }), Object.assign(new Error('Unavailable'), { code: 'insufficient_quota' }), Object.assign(new Error('Cancelled'), { name: 'AbortError' })]) {
      let generated = 0;
      await assert.rejects(run(base({ scheduling, initialSpec: baseline(), completeLayout: true, reconcile: true,
        generate: () => { generated++; throw error; }, judge: ({ targets }) => scores(targets, targets),
      })), failure => { assert.deepEqual(failure.partialSpec, baseline()); return failure === error; });
      assert.equal(generated, 1);
    }
  });

  test(scheduling + ': repairs stay inside the existing shared request budget', async () => {
    const ids = Array.from({ length: 14 }, (_, i) => 't' + i);
    const attempts = new Map(); let providers = 0;
    const result = await run(base({ scheduling, reconcile: true,
      generate: ({ stage, targetId }) => {
        providers++;
        if (stage === 'layout') return { root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, text(id)])) } };
        assert.equal(stage, 'refine'); attempts.set(targetId, (attempts.get(targetId) || 0) + 1);
        throw new SyntaxError('Invalid JSON');
      },
      judge: ({ targets }) => { providers++; return scores(targets, targets); },
    }));
    assert.equal(result.reason, 'request-limit'); assert.equal(result.requests, limits.maxRequests);
    assert.equal(providers, limits.maxRequests); assert.ok([...attempts.values()].every(count => count <= 2));
  });
}

test('queued repair recaptures the latest sibling publication and reconciliation waits for active work', async () => {
  const initialSpec = { root: 'page', elements: { page: stack(['a', 'b']), a: stack(), b: stack() } };
  const blocked = gate(); let active = 0, peak = 0, live, retries = 0, reconciles = 0;
  const pending = run(base({ scheduling: 'queue', reconcile: true, concurrency: 2,
    generate: async args => {
      if (args.stage === 'layout') return initialSpec;
      active++; peak = Math.max(peak, active);
      try {
        if (args.stage === 'reconcile') {
          reconciles++; assert.equal(active, 1); assert.equal(retries, 1);
          assert.equal(args.spec.elements.b.props.gap, 3); assert.equal(args.spec.elements.a.props.gap, 2);
          return { root: 'page', elements: { page: text('Complete') } };
        }
        if (args.targetId === 'b') return { root: 'b', elements: { b: stack([], { gap: 3 }) } };
        if (!args.repairError) { await blocked.promise; throw new SyntaxError('Rejected branch'); }
        retries++; assert.match(args.repairError, /Rejected branch/);
        assert.equal(args.spec.elements.b.props.gap, 3);
        assert.equal(args.geometry.bGap, 3);
        return { root: 'a', elements: { a: stack([], { gap: 2 }) } };
      } finally { active--; }
    },
    onSpec: spec => { live = spec; if (spec.elements.b?.props.gap === 3) blocked.resolve(); },
    measure: ({ spec }) => { assert.deepEqual(spec, live); return { stable: true, bGap: spec.elements.b?.props.gap || 0 }; },
    judge: async ({ spec, targets }) => {
      active++; peak = Math.max(peak, active);
      try { await tick(); return scores(targets, targets.filter(id => ['a', 'b'].includes(id) && !spec.elements[id].props.gap)); }
      finally { active--; }
    },
    audit: spec => spec.elements.a ? ['Merge regions'] : [],
  }));
  const result = await pending;
  assert.equal(result.reason, 'complete'); assert.equal(reconciles, 1); assert.equal(retries, 1);
  assert.equal(active, 0); assert.equal(peak, 2); assert.deepEqual(result.spec.elements, { page: text('Complete') });
});

test('reconciliation observes cancellation and discards a late valid replacement', async () => {
  const controller = new AbortController(), blocked = gate(); let publications = 0, started = false;
  const pending = run(base({ initialSpec: baseline(), reconcile: true, audit: duplicateAudit, signal: controller.signal,
    generate: async ({ stage, signal }) => { assert.equal(stage, 'reconcile'); started = true; await blocked.promise; assert.equal(signal.aborted, true); return replacement(); },
    onSpec: () => publications++,
  }));
  pending.catch(() => {});
  await tick(); assert.equal(started, true); controller.abort();
  await assert.rejects(pending, error => { assert.deepEqual(error.partialSpec, baseline()); return error.name === 'AbortError'; });
  blocked.resolve(); await tick(); assert.equal(publications, 1);
});

test('deadline interrupts reconciliation without a retry or late publication', async () => {
  let expire, started = false, publications = 0;
  const context = vm.createContext({ AbortController, setTimeout: fn => { expire = fn; return 1; }, clearTimeout() {} });
  vm.runInContext(readFileSync(new URL('../../playground-snowflake.js', import.meta.url), 'utf8'), context);
  const pending = context.DaubSnowflake.run(base({ initialSpec: baseline(), reconcile: true, audit: duplicateAudit,
    generate: () => { started = true; return new Promise(() => {}); }, onSpec: () => publications++,
  }));
  await tick(); assert.equal(started, true); expire();
  const result = await pending;
  assert.equal(result.reason, 'time-limit'); assert.equal(result.requests, 2); assert.equal(publications, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.spec)), baseline());
});

for (const count of [16, 17]) test('final root recheck uses the shared budget with ' + count + ' refined leaves', async () => {
  const ids = Array.from({ length: count }, (_, i) => 't' + i);
  let providers = 0, reconciles = 0, audits = 0;
  const result = await run(base({ reconcile: true,
    generate: ({ stage, spec, targetId }) => {
      providers++;
      if (stage === 'layout') return { root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, text(id)])) } };
      if (stage === 'reconcile') { reconciles++; return spec; }
      return { root: targetId, elements: { [targetId]: { ...text(targetId), props: { content: targetId, tag: 'h2' } } } };
    },
    judge: ({ spec, targets }) => {
      providers++; return scores(targets, targets.filter(id => id !== 'page' && !spec.elements[id].props.tag));
    },
    audit: () => { audits++; return []; },
  }));
  assert.equal(result.requests, 24); assert.equal(providers, 24); assert.equal(reconciles, 1);
  assert.equal(result.reason, count === 16 ? 'complete' : 'request-limit');
  assert.equal(audits, count === 16 ? 2 : 1);
  assert.deepEqual(result.unresolvedTargets, count === 16 ? [] : ['page']);
});

for (const finalFailure of ['judge', 'audit']) test('failed branches remain reported when reconciliation fails its final ' + finalFailure, async () => {
  const result = await run(base({ scheduling: 'queue', reconcile: true,
    generate: ({ stage }) => {
      if (stage === 'layout') return baseline();
      if (stage === 'refine') throw new SyntaxError('Bad branch');
      return replacement();
    },
    judge: ({ spec, targets }) => scores(targets, spec.elements.duplicate ? ['duplicate'] : finalFailure === 'judge' ? targets : []),
    audit: spec => !spec.elements.duplicate && finalFailure === 'audit' ? ['Still missing fields'] : [],
  }));
  assert.equal(result.reason, 'partial');
  assert.deepEqual(result.failedTargets, ['duplicate']);
  assert.deepEqual(result.spec.elements, replacement().elements);
});

test('invalid native design fails before publication or judging', async () => {
  for (const type of ['CustomHTML', 'Layout', 'Unknown']) {
    let publishes = 0, judges = 0;
    await assert.rejects(run(base({ completeLayout: true,
      generate: () => ({ root: 'page', elements: { page: { type, props: {} } } }),
      onSpec: () => publishes++, judge: () => judges++,
    })), error => { assert.equal(error.partialSpec, null); return /type/.test(error.message); });
    assert.equal(publishes, 0); assert.equal(judges, 0);
  }
});

test('reconciliation cannot exceed the element cap or publish an oversized replacement', async () => {
  const ids = Array.from({ length: limits.maxElements }, (_, i) => 't' + i); let publications = 0;
  const result = await run(base({ initialSpec: baseline(), reconcile: true,
    generate: () => ({ root: 'page', elements: { page: stack(ids), ...Object.fromEntries(ids.map(id => [id, text(id)])) } }),
    onSpec: () => publications++,
  }));
  assert.equal(result.reason, 'element-limit'); assert.equal(publications, 1); assert.deepEqual(result.spec, baseline());
});

test('quota during reconciliation aborts once with the last valid spec', async () => {
  let calls = 0, audits = 0; const failure = Object.assign(new Error('Quota exceeded'), { status: 402 });
  await assert.rejects(run(base({ initialSpec: baseline(), reconcile: true,
    generate: ({ stage }) => { assert.equal(stage, 'reconcile'); calls++; throw failure; },
    audit: () => { audits++; return []; },
  })), error => { assert.deepEqual(error.partialSpec, baseline()); return error === failure; });
  assert.equal(calls, 1); assert.equal(audits, 1);
});

test('retry measurement hook failure aborts instead of reporting a repaired branch', async () => {
  let measurements = 0, generated = 0;
  await assert.rejects(run(base({ initialSpec: baseline(), completeLayout: true, scheduling: 'queue',
    measure: () => { measurements++; if (measurements === 2) throw new Error('Capture failed'); return { stable: true }; },
    generate: () => { generated++; throw new SyntaxError('Invalid node'); },
    judge: ({ targets }) => scores(targets, targets),
  })), error => { assert.deepEqual(error.partialSpec, baseline()); return /Capture failed/.test(error.message); });
  assert.equal(generated, 1); assert.equal(measurements, 2);
});

test('provider-like words in local validation errors remain repairable in hybrid mode', async () => {
  let calls = 0;
  const initialSpec = { root: 'quota-authentication', elements: { 'quota-authentication': text('Keep') } };
  const result = await run(base({ initialSpec, completeLayout: true,
    generate: ({ repairError }) => {
      calls++;
      if (!repairError) return { root: initialSpec.root, elements: { [initialSpec.root]: text('Replace') } };
      assert.match(repairError, /quota-authentication/);
      return { root: initialSpec.root, elements: { [initialSpec.root]: text('Keep and extend') } };
    },
    judge: ({ spec, targets }) => scores(targets, spec.elements[initialSpec.root].props.content === 'Keep' ? targets : []),
  }));
  assert.equal(calls, 2); assert.equal(result.reason, 'complete');
});

for (const failure of ['decode', 'graph', 'json']) test('complete design repairs one initial ' + failure + ' rejection before publishing and assessing root', async () => {
  const trace = [], argsSeen = [];
  const result = await run(base({ completeLayout: true, reconcile: true, scheduling: 'queue',
    generate: args => {
      argsSeen.push(args); trace.push(args.stage);
      if (argsSeen.length === 1) {
        if (failure === 'decode') throw new Error('Invalid or duplicate property name');
        if (failure === 'json') throw new SyntaxError('Unexpected token in JSON');
        return { root: 'page', elements: { page: stack(['missing']) } };
      }
      if (args.stage === 'design') {
        assert.equal(args.spec, null); assert.equal(args.targetId, null); assert.equal(args.depth, 0);
        assert.match(args.repairError, /property name|JSON|Missing child/);
      }
      return replacement();
    },
    onSpec: () => trace.push('publish'),
    judge: ({ targets }) => { trace.push('judge'); assert.deepEqual(targets, ['page']); return scores(targets); },
  }));
  assert.deepEqual(trace, ['design', 'design', 'publish', 'judge', 'reconcile', 'judge']);
  assert.equal(result.reason, 'complete'); assert.equal(result.requests, 5);
});

test('complete design stops after its second local rejection with no published spec', async () => {
  let calls = 0, publishes = 0;
  await assert.rejects(run(base({ completeLayout: true,
    generate: () => { calls++; throw new Error('Invalid or duplicate property name'); },
    onSpec: () => publishes++,
  })), error => {
    assert.equal(error.partialSpec, null); assert.equal(error.requests, 2);
    return /property name/.test(error.message);
  });
  assert.equal(calls, 2); assert.equal(publishes, 0);
});

test('initial repair never retries provider, refusal, interrupted, or fatal failures', async () => {
  for (const failure of [
    Object.assign(new Error('Invalid structured JSON'), { status: 503 }),
    Object.assign(new Error('Invalid structured JSON'), { status: 429 }),
    Object.assign(new Error('Invalid structured JSON'), { code: 'insufficient_quota' }),
    Object.assign(new Error('Invalid structured JSON'), { name: 'AbortError' }),
    new Error('The model declined this generation request.'),
    new Error('The model reached its output limit before completing the structured response.'),
    new Error('The generation stream ended before the model finished.'),
    new Error('The model returned an empty structured response.'),
    new TypeError('Failed to fetch'),
  ]) {
    let calls = 0;
    await assert.rejects(run(base({ completeLayout: true, generate: () => { calls++; throw failure; } })), failure);
    assert.equal(calls, 1);
  }
});

test('legacy layout and supplied initial specs never enter the initial design repair loop', async () => {
  let calls = 0;
  await assert.rejects(run(base({ generate: () => { calls++; throw new Error('Invalid or duplicate property name'); } })), /property name/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(run(base({ completeLayout: true, initialSpec: { root: 'missing', elements: {} }, generate: () => { calls++; } })), /root/);
  assert.equal(calls, 0);
});

test('abort and deadline during initial repair preserve an unpublished baseline', async () => {
  for (const external of [false, true]) {
    let expire, calls = 0;
    const controller = new AbortController();
    const context = vm.createContext({ AbortController, setTimeout: fn => { expire = fn; return 1; }, clearTimeout() {} });
    vm.runInContext(readFileSync(new URL('../../playground-snowflake.js', import.meta.url), 'utf8'), context);
    const pending = context.DaubSnowflake.run(base({ completeLayout: true, signal: controller.signal,
      generate: () => { calls++; if (calls === 1) throw new SyntaxError('Bad JSON'); return new Promise(() => {}); },
    }));
    pending.catch(() => {});
    await tick(); assert.equal(calls, 2);
    if (external) {
      controller.abort();
      await assert.rejects(pending, error => error.name === 'AbortError' && error.partialSpec === null);
    } else {
      expire(); const result = await pending;
      assert.equal(result.reason, 'time-limit'); assert.equal(result.spec, null);
    }
  }
});

test('decoder errors identify the offending element and nested property with bounded labels', () => {
  const wire = { root: 'profile', elements: [{ id: 'profile', type: 'Text', children: [], props: [
    { name: 'settings', value: { entries: [{ name: 'label', value: 'A' }, { name: 'label', value: 'B' }] } },
  ] }] };
  assert.throws(() => decodeOutput(wire, 'design'), error => {
    assert.match(error.message, /Invalid or duplicate property name/);
    assert.match(error.message, /profile/); assert.match(error.message, /settings/); assert.match(error.message, /label/);
    return true;
  });
  wire.elements[0].id = 'x'.repeat(10000);
  wire.elements[0].props = [{ name: 'y'.repeat(10000), value: 1 }, { name: 'y'.repeat(10000), value: 2 }];
  assert.throws(() => decodeOutput(wire, 'design'), error => error.message.length < 400);
});

test('a decoder error identifying a quota-named property remains local and repairable', async () => {
  let calls = 0;
  const result = await run(base({ completeLayout: true,
    generate: ({ repairError }) => {
      calls++;
      if (calls === 1) return decodeOutput({ root: 'profile', elements: [{ id: 'profile', type: 'Text', children: [], props: [
        { name: 'quota', value: 1 }, { name: 'quota', value: 2 },
      ] }] }, 'design');
      assert.match(repairError, /profile/); assert.match(repairError, /quota/);
      return replacement();
    },
  }));
  assert.equal(calls, 2); assert.equal(result.reason, 'complete');
});
