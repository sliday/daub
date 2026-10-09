import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
let browser, server, base, finishStream;
before(async () => {
  server = createServer(async (req, res) => {
    if (req.url === '/test/hybrid-stream') {
      const text = JSON.stringify(withBrief(contract));
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: text.slice(0, 20) } }] }) + '\n\n');
      finishStream = () => res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: text.slice(20) }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
      return;
    }
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/')) return res.writeHead(403).end();
    try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
});
after(async () => { await browser?.close(); if (server?.listening) await new Promise(done => server.close(done)); });

const contract = {
  interactive: true,
  requirements: [{ id: 'question', targetId: 'question', text: 'One question at a time' }],
  journeys: [{ id: 'advance', steps: [
    { action: 'remember', targetId: 'question', value: '' },
    { action: 'click', targetId: 'next', value: '' },
    { action: 'assertChanged', targetId: 'question', value: '' },
    { action: 'assertText', targetId: 'progress', value: '2 of 10' }
  ] }]
};
const spec = { root: 'page', elements: {
  page: { type: 'Stack', props: { gap: 4 }, children: ['question', 'progress', 'next'] },
  question: { type: 'Text', props: { tag: 'h2', content: 'Question 1' }, children: [] },
  progress: { type: 'Text', props: { content: '1 of 10' }, children: [] },
  next: { type: 'Button', props: { label: 'Next' }, children: [] }
} };
const program = {
  initial: '{"index":0}',
  reduce: 'return {index: Math.min(9, state.index + 1)};',
  render: 'ui.text("question", "Question " + (state.index + 1)); ui.text("progress", (state.index + 1) + " of 10");',
  bind: 'ui.on("next", "click", function() { dispatch({type:"NEXT"}); });',
  output: 'return {step:state.index + 1};'
};
function wire(spec) {
  const value = v => Array.isArray(v) ? v.map(value) : v && typeof v === 'object' ? { entries: Object.entries(v).map(([name, v]) => ({ name, value: value(v) })) } : v;
  return { root: spec.root, elements: Object.entries(spec.elements).map(([id, node]) => ({ id, type: node.type, children: node.children || [], props: Object.entries(node.props || {}).map(([name, v]) => ({ name, value: value(v) })) })) };
}
function withBrief(result) {
  if (typeof result?.interactive !== 'boolean' || result.brief || !result.requirements?.length) return result;
  const target = result.requirements.find(item => !item.when || item.when === 'initial') || result.requirements[0];
  const journeyId = result.journeys?.[0]?.id || ({ quiz: 'recipe-complete', filter: 'recipe-empty', selection: 'recipe-select' })[result.recipe?.kind];
  return { ...result, brief: { title: 'Test interface', summary: 'Implement the frozen fixture.', assumptions: [], outOfScope: [],
    screens: [{ id: 'main', title: 'Main screen', phase: 'initial', targetIds: [target.targetId], layout: 'Responsive single column.', content: target.text, journeyId: '' }],
    flow: result.interactive ? [{ from: 'main', to: 'main', action: 'Perform the fixture interaction.', guard: 'Use the initial fixture.', journeyId }] : [],
    edgeCases: result.interactive ? [{ scenario: 'Use a fresh fixture.', expected: 'Preserve the asserted result.', journeyId }] : [],
    outputs: result.interactive ? [{ path: 'result', type: 'object', description: 'The local result object.' }] : [] } };
}
const sse = result => ({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(withBrief(result)) }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n' });

async function open(t, width = 1440, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  t.after(() => context.close());
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await context.route('**/api/figma', route => route.fulfill({ json: { connected: false } }));
  const calls = [];
  await context.route('**/api/generate', async route => {
    const body = route.request().postDataJSON();
    const stage = body.response_format?.json_schema?.name;
    calls.push(stage);
    assert.equal(body.model, 'openrouter/auto');
    assert.equal(body.response_format.json_schema.strict, true);
    if (stage === 'hybrid_contract') {
      const alternatives = body.response_format.json_schema.schema.properties.journeys.items.properties.steps.items.anyOf;
      assert.equal(alternatives.find(item => item.properties.action.enum.includes('assertText')).properties.value.minLength, 1);
    }
    if (options.route && await options.route(route, stage, body)) return;
    const responses = { hybrid_contract: contract, hybrid_draft: wire(spec), hybrid_review: { defects: [], checks: [{ id: 'question', pass: true }] }, hybrid_behavior: program };
    if (!responses[stage]) return route.fulfill({ status: 500, json: { error: 'Unexpected ' + stage } });
    await route.fulfill(sse(responses[stage]));
  });
  const page = await context.newPage(), errors = [];
  await page.addInitScript(() => {
    if (window !== window.top) return;
    window.__probeMessages = [];
    window.addEventListener('message', e => { if (e.data?.type) window.__probeMessages.push({ type: e.data.type, seq: e.data.seq, requestId: e.data.requestId }); });
  });
  page.on('pageerror', e => errors.push(e.message));
  t.after(() => assert.deepEqual(errors, [], 'Uncaught errors'));
  page.setDefaultTimeout(10000);
  await page.goto(base + '/playground.html?design=hybrid');
  return { page, calls, context };
}
async function submit(page) {
  await page.locator('#pg-prompt').fill('10-step personality test, mobile-optimized.');
  await page.locator('#pg-prompt').press('Enter');
}
async function finished(page) {
  try { await page.waitForFunction(() => window.__hybridLastRun, null, { timeout: 30000 }); }
  catch (error) { throw new Error(error.message + '\n' + JSON.stringify(await page.evaluate(() => ({ status: document.getElementById('pg-status').textContent, chat: document.getElementById('pg-chat-messages').textContent, messages: window.__probeMessages, frames: document.querySelectorAll('[data-hybrid-probe]').length })))); }
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#pg-stop-btn')).display === 'none');
}

test('saved design briefs render as text and malformed briefs do not break chat', async t => {
  const { page, calls } = await open(t);
  const result = await page.evaluate(brief => {
    const payload = '<img src=x onerror="window.briefInjected=true">';
    brief.title = payload;
    brief.screens[0].content = payload;
    const rendered = DaubHybridUI.renderBrief(brief);
    document.body.append(rendered);
    return {
      text: rendered.textContent,
      images: rendered.querySelectorAll('img').length,
      injected: window.briefInjected === true,
      malformed: [null, {}, { ...brief, screens: [null] }, { ...brief, flow: [{ from: 42 }] }, { ...brief, title: 'x'.repeat(701) }]
        .map(value => DaubHybridUI.renderBrief(value).textContent)
    };
  }, withBrief(contract).brief);
  assert.match(result.text, /<img src=x/);
  assert.equal(result.images, 0);
  assert.equal(result.injected, false);
  assert.ok(result.malformed.every(text => text.includes('Design brief unavailable.')));
  assert.deepEqual(calls, []);
});

test('healthy custom workflows spend three calls without an advisory review or layout repair', async t => {
  const { page, calls } = await open(t);
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.equal(result.reason, 'complete');
  assert.equal(result.advisory, null);
  assert.deepEqual(calls, ['hybrid_contract', 'hybrid_draft', 'hybrid_behavior']);
  assert.equal(calls.includes('hybrid_repair'), false);
});

test('sends the strict schema once without duplicating it in model messages', async t => {
  const { page, calls } = await open(t, 1440, { route: async (route, stage, body) => {
    const schema = JSON.stringify(body.response_format.json_schema.schema);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.ok(schema.length > 100);
    assert.ok(body.messages.every(message => !message.content.includes(schema)));
    if (stage === 'hybrid_draft') assert.match(body.messages[0].content, /Create a complete DAUB page/);
    return false;
  } });
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.equal(result.reason, 'complete');
  assert.equal(calls.length, 3);
});

test('an uncovered inert button triggers one behavior repair without changing frozen journeys', async t => {
  const draft = structuredClone(spec);
  draft.elements.page.children.push('checkout');
  draft.elements.checkout = { type: 'Button', props: { label: 'Checkout' }, children: [] };
  let attempts = 0;
  const { page, calls } = await open(t, 1440, { route: async (route, stage, body) => {
    if (stage === 'hybrid_draft') { await route.fulfill(sse(wire(draft))); return true; }
    if (stage !== 'hybrid_behavior') return false;
    if (++attempts === 1) {
      await route.fulfill(sse({ ...program, reduce: 'return action.type === "NEXT" ? {index: state.index + 1} : {...state};',
        bind: program.bind + 'ui.on("checkout", "click", function() { dispatch({type:"CHECKOUT"}); });' }));
      return true;
    }
    const data = JSON.parse(body.messages[1].content);
    assert.equal(data.contract.journeys.length, 1);
    assert.ok(data.failures.some(failure => failure.kind.includes('behavior-no-effect') && failure.targetId === 'checkout'));
    await route.fulfill(sse({ ...program, initial: '{"index":0,"confirmed":false}',
      reduce: 'return action.type === "CHECKOUT" ? {...state,confirmed:true} : {...state,index:state.index+1};',
      bind: program.bind + 'ui.on("checkout", "click", function() { dispatch({type:"CHECKOUT"}); });',
      output: 'return {step:state.index+1,confirmed:state.confirmed};' }));
    return true;
  } });
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.equal(result.reason, 'complete');
  assert.equal(attempts, 2);
  assert.equal(calls.length, 4);
  assert.deepEqual(result.views.filter(view => view.action).map(view => [view.width, view.action, view.evidence.actions[0].status]),
    [[1200, 'checkout', 'changed'], [390, 'checkout', 'changed']]);
  assert.equal(await page.evaluate(() => document.querySelectorAll('[data-hybrid-probe]').length), 0);
});

for (const suppression of ['hidden', 'disabled']) test('cannot repair an inert action by making it ' + suppression, async t => {
  const draft = structuredClone(spec);
  draft.elements.page.children.push('checkout');
  draft.elements.checkout = { type: 'Button', props: { label: 'Checkout' }, children: [] };
  let attempts = 0;
  const { page } = await open(t, 1440, { route: async (route, stage) => {
    if (stage === 'hybrid_draft') { await route.fulfill(sse(wire(draft))); return true; }
    if (stage !== 'hybrid_behavior') return false;
    await route.fulfill(sse({ ...program, render: program.render + (++attempts === 2 ? 'ui.get("checkout").' + suppression + '=true;' : '') }));
    return true;
  } });
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.equal(attempts, 2);
  assert.notEqual(result.reason, 'complete');
  assert.ok((result.attemptedAssessment || result.assessment).defects.some(defect => defect.kind.includes('behavior-no-effect')));
});

for (const content of ['', '{invalid']) test('keeps a tested controller after an ' + (content ? 'invalid JSON' : 'empty') + ' repair response', async t => {
  const draft = structuredClone(spec);
  draft.elements.page.children.push('checkout');
  draft.elements.checkout = { type: 'Button', props: { label: 'Checkout' }, children: [] };
  let attempts = 0;
  const { page, calls } = await open(t, 1440, { route: async (route, stage) => {
    if (stage === 'hybrid_draft') { await route.fulfill(sse(wire(draft))); return true; }
    if (stage !== 'hybrid_behavior' || ++attempts === 1) return false;
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n' });
    return true;
  } });
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.equal(result.reason, 'incomplete');
  assert.equal(calls.length, 4);
  assert.equal(attempts, 2);
  assert.ok(result.assessment.defects.some(defect => defect.kind.includes('behavior-no-effect')));
  assert.equal((await page.evaluate(() => window.DaubPlayground.getOutput())).step, 1);
  await page.frameLocator('#pg-preview-frame').locator('[data-spec-id="next"]').click();
  assert.equal((await page.evaluate(() => window.DaubPlayground.getOutput())).step, 2);
});

test('a quota error during extra-action repair stops the run without retrying', async t => {
  const draft = structuredClone(spec);
  draft.elements.page.children.push('checkout');
  draft.elements.checkout = { type: 'Button', props: { label: 'Checkout' }, children: [] };
  let attempts = 0;
  const { page, calls } = await open(t, 1440, { route: async (route, stage) => {
    if (stage === 'hybrid_draft') { await route.fulfill(sse(wire(draft))); return true; }
    if (stage !== 'hybrid_behavior' || ++attempts === 1) return false;
    await route.fulfill({ status: 429, json: { error: 'Rate limit exceeded' } }); return true;
  } });
  await submit(page); await finished(page);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'provider-error');
  assert.equal(attempts, 2);
  assert.equal(calls.length, 4);
  assert.equal(await page.locator('[data-hybrid-probe]').count(), 0);
});

test('caps extra action probes at six per viewport and records unprobed buttons', async t => {
  const draft = structuredClone(spec), ids = Array.from({ length: 8 }, (_, index) => 'extra' + index);
  draft.elements.page.children.push(...ids);
  for (const id of ids) draft.elements[id] = { type: 'Button', props: { label: id }, children: [] };
  const { page, calls } = await open(t, 1440, { route: async (route, stage) => {
    if (stage === 'hybrid_draft') { await route.fulfill(sse(wire(draft))); return true; }
    if (stage !== 'hybrid_behavior') return false;
    await route.fulfill(sse({ ...program, bind: program.bind + ids.map(id => 'ui.on("' + id + '", "click", function() { dispatch({type:"NEXT"}); });').join('') }));
    return true;
  } });
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.equal(result.reason, 'complete');
  assert.equal(calls.length, 3);
  assert.equal(result.views.filter(view => view.action).length, 12);
  for (const view of result.views.filter(view => view.actionCoverage)) {
    assert.deepEqual(view.actionCoverage.coveredByJourneys, ['next']);
    assert.deepEqual(view.actionCoverage.selected, ids.slice(0, 6));
    assert.deepEqual(view.actionCoverage.unprobed, ids.slice(6));
  }
});

test('repairs a failed controller once using browser errors, then reuses the tested candidate', async t => {
  let attempts = 0;
  const { page, calls } = await open(t, 1440, { route: async (route, stage, body) => {
    if (stage !== 'hybrid_behavior') return false;
    attempts++;
    if (attempts === 1) { await route.fulfill(sse({ ...program, reduce: 'return state;' })); return true; }
    const data = JSON.parse(body.messages[1].content);
    assert.ok(data.failures.some(failure => /Journey/.test(failure.message)));
    assert.ok(data.program);
    return false;
  } });
  await submit(page); await finished(page);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
  assert.equal(attempts, 2);
  assert.equal(calls.filter(stage => stage === 'hybrid_review').length, 0);
});

test('corrects invalid hook syntax once without executing generated hooks in the host', async t => {
  let attempts = 0;
  const { page } = await open(t, 1440, { route: async (route, stage, body) => {
    if (stage !== 'hybrid_behavior') return false;
    if (++attempts === 1) { await route.fulfill(sse({ ...program, reduce: 'return {' })); return true; }
    assert.equal(JSON.parse(body.messages[1].content).failures[0].kind, 'compile');
    return false;
  } });
  await submit(page); await finished(page);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
  assert.equal(attempts, 2);
});

test('repairs typed output mismatches without weakening the frozen numeric assertion', async t => {
  let attempts = 0;
  const typed = structuredClone(contract);
  typed.journeys[0].outputAssertions = [{ path: 'step', operator: 'equals', value: '2' }];
  const { page } = await open(t, 1440, { route: async (route, stage, body) => {
    if (stage === 'hybrid_contract') { await route.fulfill(sse(typed)); return true; }
    if (stage !== 'hybrid_behavior') return false;
    if (++attempts === 1) { await route.fulfill(sse({ ...program, output: 'return {step:String(state.index+1)};' })); return true; }
    const data = JSON.parse(body.messages[1].content);
    assert.match(data.failures[0].message, /expected 2 \(number\), received "2" \(string\)/);
    assert.equal(data.contract.journeys[0].outputAssertions[0].value, '2');
    return false;
  } });
  await submit(page); await finished(page);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
  assert.equal(attempts, 2);
});

test('static pages complete with two calls and browser evidence at both widths', async t => {
  const { page, calls } = await open(t, 1440, { route: async (route, stage) => {
    if (stage !== 'hybrid_contract') return false;
    await route.fulfill(sse({ ...contract, interactive: false, journeys: [] })); return true;
  } });
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.equal(result.reason, 'complete');
  assert.deepEqual(calls, ['hybrid_contract', 'hybrid_draft']);
  assert.deepEqual(result.views.map(view => view.width), [1200, 390]);
});

test('unchanged repair regions spend one request across viewports and rounds, with scoped context', async t => {
  const broken = { root: 'page', elements: {
    page: { type: 'Stack', props: { gap: 4 }, children: ['hero', 'other'] },
    hero: { type: 'Stack', props: { gap: 2 }, children: ['photo'] },
    photo: { type: 'Image', props: { src: 'data:image/png;base64,broken', alt: 'Photo' }, children: [] },
    other: { type: 'Text', props: { content: 'Keep this sibling' }, children: [] }
  } };
  const planned = { interactive: false, requirements: [{ id: 'other', targetId: 'other', when: 'initial', text: 'Keep sibling content' }], journeys: [] };
  const { page, calls } = await open(t, 1440, { route: async (route, stage, body) => {
    if (stage === 'hybrid_contract') { await route.fulfill(sse(planned)); return true; }
    if (stage === 'hybrid_draft') { await route.fulfill(sse(wire(broken))); return true; }
    if (stage !== 'hybrid_repair') return false;
    const data = JSON.parse(body.messages[1].content);
    assert.deepEqual(Object.keys(data.spec.elements), ['photo']);
    assert.deepEqual(data.ancestors.map(node => node.id), ['hero', 'page']);
    assert.deepEqual(data.contract, { requirements: [], requiredIds: [], brief: { summary: 'Implement the frozen fixture.', screens: [] } });
    assert.equal(data.spec.elements.other, undefined);
    await route.fulfill(sse(wire(data.spec))); return true;
  } });
  await submit(page); await finished(page);
  assert.deepEqual(calls, ['hybrid_contract', 'hybrid_draft', 'hybrid_repair']);
  const result = await page.evaluate(() => ({ run: window.__hybridLastRun, spec: JSON.parse(sessionStorage.getItem('pg-current-spec')) }));
  assert.equal(result.run.reason, 'incomplete');
  assert.equal(result.spec.elements.other.props.content, 'Keep this sibling');
  assert.ok(result.run.assessment.defects.some(defect => /broken-image/.test(defect.kind)));
});

test('recipe-first planning skips the coding request and uses deterministic journeys', async t => {
  const selection = { root: 'page', elements: {
    page: { type: 'Stack', props: { gap: 3 }, children: ['choices', 'summary'] },
    choices: { type: 'RadioGroup', props: { name: 'choices', options: [{ label: 'Monthly', value: 'monthly' }, { label: 'Annual', value: 'annual' }] }, children: [] },
    summary: { type: 'Text', props: { content: 'Monthly' }, children: [] }
  } };
  const recipe = { kind: 'selection', bindings: { choices: 'choices', summary: 'summary' }, data: { initialValue: 'monthly', options: [{ label: 'Monthly', value: 'monthly' }, { label: 'Annual', value: 'annual' }] } };
  const planned = { interactive: true, recipe, fixtures: '{}', requirements: [{ id: 'choices', targetId: 'choices', text: 'Choose billing period', when: 'initial' }], journeys: [] };
  const { page, calls } = await open(t, 1440, { route: async (route, stage) => {
    const responses = { hybrid_contract: planned, hybrid_draft: wire(selection), hybrid_review: { checks: [], defects: [] } };
    if (!responses[stage]) return false;
    await route.fulfill(sse(responses[stage])); return true;
  } });
  await submit(page); await finished(page);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
  assert.deepEqual(calls, ['hybrid_contract', 'hybrid_draft']);
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.getByText('Annual', { exact: true }).click();
  assert.equal((await page.evaluate(() => window.DaubPlayground.getOutput())).selected, 'annual');
});

test('a recipe reports an inert extra button without spending a coding request', async t => {
  const selection = { root: 'page', elements: {
    page: { type: 'Stack', props: { gap: 3 }, children: ['choices', 'summary', 'checkout'] },
    choices: { type: 'RadioGroup', props: { name: 'choices', options: [{ label: 'Monthly', value: 'monthly' }, { label: 'Annual', value: 'annual' }] }, children: [] },
    summary: { type: 'Text', props: { content: 'Monthly' }, children: [] },
    checkout: { type: 'Button', props: { label: 'Checkout' }, children: [] }
  } };
  const recipe = { kind: 'selection', bindings: { choices: 'choices', summary: 'summary' }, data: { initialValue: 'monthly', options: [{ label: 'Monthly', value: 'monthly' }, { label: 'Annual', value: 'annual' }] } };
  const planned = { interactive: true, recipe, fixtures: '{}', requirements: [{ id: 'choices', targetId: 'choices', text: 'Choose billing period', when: 'initial' }], journeys: [] };
  const { page, calls } = await open(t, 1440, { route: async (route, stage) => {
    const responses = { hybrid_contract: planned, hybrid_draft: wire(selection) };
    if (!responses[stage]) return false;
    await route.fulfill(sse(responses[stage])); return true;
  } });
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.notEqual(result.reason, 'complete');
  assert.deepEqual(calls, ['hybrid_contract', 'hybrid_draft']);
  assert.ok((result.attemptedAssessment || result.assessment).defects.some(defect => defect.kind.includes('behavior-no-effect')));
});

for (const [width, count] of [[1440, 10], [390, 10], [390, 1]]) test('plans and checks a designed ' + count + '-question results screen at ' + width, async t => {
  const bindings = { question: 'question', choices: 'choices', back: 'back', next: 'next', progress: 'progress', result: 'result',
    questionScreen: 'questionScreen', resultScreen: 'resultScreen', answerReview: 'answerReview', restart: 'restart' };
  const quiz = { root: 'page', elements: {
    page: { type: 'Stack', props: { container: 'narrow', gap: 6 }, children: ['questionScreen', 'resultScreen'] },
    questionScreen: { type: 'Stack', props: { gap: 4 }, children: ['question', 'progress', 'choices', 'back', 'next'] },
    question: { type: 'Text', props: { tag: 'h2', content: 'Question 1' }, children: [] },
    progress: { type: 'Text', props: { content: '1 of ' + count }, children: [] },
    choices: { type: 'RadioGroup', props: { name: 'choices', options: [{ label: 'Agree', value: 'agree' }, { label: 'Disagree', value: 'disagree' }] }, children: [] },
    back: { type: 'Button', props: { label: 'Back' }, children: [] },
    next: { type: 'Button', props: { label: 'Next' }, children: [] },
    resultScreen: { type: 'Stack', props: { gap: 4 }, children: ['resultTitle', 'result', 'answerReview', 'restart'] },
    resultTitle: { type: 'Text', props: { tag: 'h2', content: 'Your results' }, children: [] },
    result: { type: 'Text', props: { content: 'Your result' }, children: [] },
    answerReview: { type: 'Text', props: { content: 'Answer review' }, children: [] },
    restart: { type: 'Button', props: { label: 'Restart' }, children: [] }
  } };
  const planned = { interactive: true, fixtures: '{}', requirements: [{ id: 'questionScreen', targetId: 'questionScreen', text: 'Question screen', when: 'initial' }], journeys: [],
    recipe: { kind: 'quiz', bindings, data: { resultLabel: 'Illustrative score', questions: Array.from({ length: count }, (_, index) => ({ id: 'q' + index, text: 'Question ' + (index + 1), options: [{ label: 'Agree', value: 'agree', score: 1 }, { label: 'Disagree', value: 'disagree', score: 0 }] })) } },
    brief: { title: 'Personality test', summary: count + ' questions with a separate results screen.', assumptions: ['Local illustrative scoring, not a diagnosis.'], outOfScope: ['Accounts'],
      screens: [
        { id: 'questions', title: 'Questions', phase: 'initial', targetIds: ['questionScreen'], layout: 'Mobile-first column with spaced controls.', content: 'Question, answers, progress, Back and Next.', journeyId: '' },
        { id: 'results', title: 'Results', phase: 'complete', targetIds: ['resultScreen', 'answerReview'], layout: 'Score followed by answer review and restart.', content: 'All ' + count + ' answers and an illustrative score.', journeyId: 'recipe-complete' }
      ], flow: [{ from: 'questions', to: 'results', action: 'Answer ' + count + ' questions.', guard: 'Require a selection before advancing.', journeyId: 'recipe-complete' },
        { from: 'results', to: 'questions', action: 'Restart.', guard: 'Clear prior answers.', journeyId: 'recipe-restart' }],
      edgeCases: [{ scenario: count > 1 ? 'Go back.' : 'Select an answer before completion.', expected: 'Preserve the selected answer.', journeyId: 'recipe-back' }, { scenario: 'Restart after completion.', expected: 'Return to question one with no answers.', journeyId: 'recipe-restart' }],
      outputs: [{ path: 'answers', type: 'array', description: 'Question IDs and selected answers.' }, { path: 'result', type: 'number', description: 'Illustrative score on completion.' }] } };
  const { page, calls } = await open(t, width, { route: async (route, stage, body) => {
    if (stage === 'hybrid_contract') {
      assert.ok(body.response_format.json_schema.schema.properties.brief);
      await route.fulfill(sse(planned)); return true;
    }
    if (stage === 'hybrid_draft') {
      const data = JSON.parse(body.messages[1].content);
      assert.equal(data.contract.brief.screens[1].id, 'results');
      assert.ok(data.requiredIds.includes('answerReview'));
      await route.fulfill(sse(wire(quiz))); return true;
    }
    return false;
  } });
  await submit(page); await finished(page);
  const run = await page.evaluate(() => window.__hybridLastRun);
  assert.equal(run.reason, 'complete', JSON.stringify(run));
  assert.deepEqual(calls, ['hybrid_contract', 'hybrid_draft']);
  for (const view of run.views.filter(view => view.journey === 'recipe-complete')) {
    assert.ok(view.evidence.geometry.elements.find(element => element.id === 'resultScreen').visible);
    assert.equal(view.evidence.geometry.elements.find(element => element.id === 'questionScreen').visible, false);
    assert.ok(view.evidence.text.includes('Question ' + count + ': Agree'));
  }
  await page.locator('.pg-design-brief summary').click();
  assert.match(await page.locator('.pg-design-brief').innerText(), /Results/);
  if (width === 390) await page.locator('.pg-bottom-tabs [data-panel="preview"]').click();
  const frame = page.frameLocator('#pg-preview-frame');
  for (let index = 0; index < count; index++) {
    await frame.getByText('Agree', { exact: true }).click();
    await frame.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await frame.getByRole('heading', { name: 'Your results' }).waitFor();
  assert.equal((await page.evaluate(() => window.DaubPlayground.getOutput())).answers.length, count);
  await page.screenshot({ path: '/tmp/daub-brief-results-' + width + '-' + count + '.png' });
  await frame.getByRole('button', { name: 'Restart' }).click();
  const output = await page.evaluate(() => window.DaubPlayground.getOutput());
  assert.equal(output.step, 1); assert.equal(output.completed, false); assert.deepEqual(output.answers, []);
  await page.reload();
  assert.equal(await page.locator('.pg-design-brief summary').count(), 1);
});

for (const width of [1440, 390]) test(`Hybrid produces a whole draft, validates both viewports and exports one controller at ${width}`, async t => {
  const { page, calls, context } = await open(t, width);
  assert.equal(await page.locator('#pg-generation-mode').count(), 0);
  await submit(page); await finished(page);
  if (width === 390) await page.locator('.pg-bottom-tabs [data-panel="preview"]').click();
  const result = await page.evaluate(() => ({ run: window.__hybridLastRun, spec: JSON.parse(sessionStorage.getItem('pg-current-spec')) }));
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  result.html = await readFile(await (await downloadPromise).path(), 'utf8');
  assert.equal(result.run.reason, 'complete', JSON.stringify(result.run));
  assert.deepEqual([...new Set(result.run.views.map(v => v.width))], [1200, 390]);
  assert.ok(result.run.assessment.checks.every(c => c.pass));
  assert.ok(result.spec.hybrid.program);
  assert.equal(calls.filter(c => c === 'hybrid_behavior').length, 1);
  assert.equal(await page.locator('[data-hybrid-probe]').count(), 0);
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.locator('[data-spec-id="next"]').click();
  assert.equal(await frame.locator('[data-spec-id="question"]').textContent(), 'Question 2');
  const exported = await context.newPage();
  await context.route('https://daub.dev/**', async route => {
    const name = new URL(route.request().url()).pathname;
    try { await route.fulfill({ body: await readFile(resolve(root, '.' + name)), contentType: name.endsWith('.js') ? 'text/javascript' : 'text/css' }); }
    catch { await route.abort(); }
  });
  await exported.goto(base + '/playground.html');
  await exported.setContent(result.html);
  await exported.locator('[data-spec-id="next"]').click();
  assert.equal(await exported.locator('[data-spec-id="progress"]').textContent(), '2 of 10');
});

test('Hybrid rejects invalid native candidates and cannot remove frozen bindings', async t => {
  const { page } = await open(t);
  const errors = await page.evaluate(({ spec, contract }) => {
    const hybridApply = DaubHybridUI.create({ VALID_TYPES: ['Stack', 'Text', 'Button'] }).apply;
    const missing = structuredClone(spec); delete missing.elements.progress; missing.elements.page.children = ['question', 'next'];
    const script = structuredClone(spec); script.elements.next.props.js = 'alert(1)';
    return [missing, script].map(patch => { try { hybridApply(spec, patch, 'page', contract); return null; } catch (e) { return e.message; } });
  }, { spec, contract });
  assert.match(errors[0], /required binding/);
  assert.match(errors[1], /executable behavior/);
});

test('layout repairs cannot drop recipe data items that no journey targets directly', async t => {
  const { page } = await open(t);
  const error = await page.evaluate(() => {
    const apply = DaubHybridUI.create({ VALID_TYPES: ['Stack', 'Text'] }).apply;
    const spec = { root: 'items', elements: {
      items: { type: 'Stack', props: {}, children: ['first', 'second'] },
      first: { type: 'Text', props: { content: 'First' }, children: [] },
      second: { type: 'Text', props: { content: 'Second' }, children: [] }
    } };
    const patch = structuredClone(spec); patch.elements.items.children.pop(); delete patch.elements.second;
    const contract = { requirements: [{ id: 'items', targetId: 'items' }], journeys: [], recipe: { kind: 'filter', bindings: { items: 'items' }, data: { items: [{ id: 'first' }, { id: 'second' }] } } };
    try { apply(spec, patch, 'items', contract); return null; } catch (error) { return error.message; }
  });
  assert.match(error, /Candidate removed a required binding: second/);
});

test('Hybrid completes ten questions, exposes detached answers and exports the output API', async t => {
  const quiz = structuredClone(spec);
  quiz.elements.page.children = ['question', 'progress', 'answers', 'next', 'result'];
  quiz.elements.answers = { type: 'RadioGroup', props: { name: 'answer', options: [{ label: 'Agree', value: 'agree' }, { label: 'Disagree', value: 'disagree' }] }, children: [] };
  quiz.elements.result = { type: 'Text', props: { content: 'Your result' }, children: [] };
  const requirements = [...contract.requirements, { id: 'result', targetId: 'result', text: 'Your result after ten answers', when: 'complete' }];
  const journey = { id: 'complete', complete: true, steps: [], outputAssertions: [
    { path: 'answers', operator: 'length', value: '10' },
    { path: 'completed', operator: 'equals', value: 'true' }
  ] };
  for (let i = 0; i < 10; i++) journey.steps.push({ action: 'check', targetId: 'answers', value: 'agree' }, { action: 'click', targetId: 'next', value: '' });
  journey.steps.push({ action: 'assertText', targetId: 'result', value: '10 answers' });
  const quizProgram = {
    initial: JSON.stringify({ index: 0, answers: [], selected: null, completed: false, questions: Array.from({ length: 10 }, (_, i) => ({ id: 'q' + i, text: 'Question ' + (i + 1) })) }),
    reduce: 'if(action.type === "SELECT") return {...state,selected:action.value}; if(action.type !== "NEXT" || !state.selected || state.completed) return state; const answers=state.answers.concat({questionId:state.questions[state.index].id,question:state.questions[state.index].text,answer:state.selected}); return {...state,answers,index:Math.min(9,state.index+1),selected:null,completed:answers.length===10};',
    render: 'ui.text("question",state.questions[state.index].text); ui.text("progress",(state.index+1)+" of 10"); ui.get("next").disabled=!state.selected || state.completed; ui.get("result").hidden=!state.completed; ui.text("result","Your result: "+state.answers.length+" answers"); ui.get("answers").querySelectorAll("input").forEach(input=>{input.checked=input.value===state.selected;input.disabled=state.completed;});',
    bind: 'ui.on("answers","change",event=>dispatch({type:"SELECT",value:event.target.value})); ui.on("next","click",()=>dispatch({type:"NEXT"}));',
    output: 'return {completed:state.completed,answers:state.answers,total:10,step:state.index+1};'
  };
  const { page, context } = await open(t, 1440, { route: async (route, stage, body) => {
    if (stage === 'hybrid_review') assert.deepEqual(JSON.parse(body.messages.find(m => m.role === 'user').content).requirements.map(item => item.id), ['question']);
    const responses = { hybrid_contract: { interactive: true, requirements, journeys: [journey] }, hybrid_draft: wire(quiz), hybrid_behavior: quizProgram };
    if (!responses[stage]) return false;
    await route.fulfill(sse(responses[stage])); return true;
  } });
  assert.equal(await page.evaluate(() => window.DaubPlayground.getOutput()), null);
  await submit(page); await finished(page);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete', JSON.stringify(await page.evaluate(() => window.__hybridLastRun)));
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.locator('[data-spec-id="result"]').isVisible(), false);
  assert.equal((await page.evaluate(() => window.DaubPlayground.getOutput())).completed, false);
  for (let i = 0; i < 10; i++) {
    assert.equal(await frame.locator('[data-spec-id="question"]').innerText(), 'Question ' + (i + 1));
    await frame.getByText(i % 2 ? 'Disagree' : 'Agree', { exact: true }).click();
    await frame.getByRole('button', { name: 'Next', exact: true }).click();
  }
  const output = await page.evaluate(() => window.DaubPlayground.getOutput());
  assert.equal(output.completed, true);
  assert.equal(output.answers.length, 10);
  assert.equal(new Set(output.answers.map(answer => answer.questionId)).size, 10);
  assert.deepEqual(output.answers.map(answer => answer.answer), Array.from({ length: 10 }, (_, i) => i % 2 ? 'disagree' : 'agree'));
  assert.equal(await frame.locator('[data-spec-id="result"]').innerText(), 'Your result: 10 answers');
  await page.evaluate(async () => { const output = await window.DaubPlayground.getOutput(); output.answers.length = 0; });
  assert.equal((await page.evaluate(() => window.DaubPlayground.getOutput())).answers.length, 10);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await downloadPromise).path(), 'utf8');
  await context.route('https://daub.dev/**', async route => {
    const name = new URL(route.request().url()).pathname;
    try { await route.fulfill({ body: await readFile(resolve(root, '.' + name)), contentType: name.endsWith('.js') ? 'text/javascript' : 'text/css' }); }
    catch { await route.abort(); }
  });
  const exported = await context.newPage();
  await exported.goto(base + '/playground.html');
  await exported.setContent(html);
  await exported.waitForFunction(() => window.DaubPrototype?.getOutput());
  assert.equal((await exported.evaluate(() => window.DaubPrototype.getOutput())).completed, false);
  for (let i = 0; i < 10; i++) {
    await exported.getByText('Agree', { exact: true }).click();
    await exported.getByRole('button', { name: 'Next', exact: true }).click();
  }
  assert.equal((await exported.evaluate(() => window.DaubPrototype.getOutput())).answers.length, 10);
  const canceled = await page.evaluate(async () => {
    const read = window.DaubPlayground.getOutput().then(() => 'resolved', error => error.message);
    document.getElementById('pg-new-chat').click();
    return read;
  });
  assert.match(canceled, /Preview changed/);
  assert.equal(await page.evaluate(() => window.DaubPlayground.getOutput()), null);
});

test('Hybrid compiles a recipe response and exports its working controller without generated JS', async t => {
  const quiz = structuredClone(spec);
  quiz.elements.page.children = ['question', 'progress', 'answers', 'back', 'next', 'result'];
  quiz.elements.answers = { type: 'RadioGroup', props: { name: 'answers', options: [{ label: 'Agree', value: 'agree' }, { label: 'Disagree', value: 'disagree' }] }, children: [] };
  quiz.elements.back = { type: 'Button', props: { label: 'Back' }, children: [] };
  quiz.elements.result = { type: 'Text', props: { content: 'Your result' }, children: [] };
  const quizContract = structuredClone(contract);
  quizContract.requirements.push({ id: 'result', targetId: 'result', text: 'Your result', when: 'present' });
  quizContract.journeys = [{ id: 'complete', complete: true, outputAssertions: [{ path: 'answers', operator: 'length', value: '10' }, { path: 'completed', operator: 'equals', value: 'true' }], steps: [] }];
  for (let i = 0; i < 10; i++) quizContract.journeys[0].steps.push({ action: 'check', targetId: 'answers', value: 'agree' }, { action: 'click', targetId: 'next', value: '' });
  quizContract.journeys[0].steps.push({ action: 'assertText', targetId: 'result', value: 'Your result' });
  const recipe = { kind: 'quiz', bindings: { question: 'question', progress: 'progress', choices: 'answers', back: 'back', next: 'next', result: 'result' }, data: { resultLabel: 'Your result', questions: Array.from({ length: 10 }, (_, index) => ({ id: 'q' + index, text: 'Question ' + (index + 1), options: [{ value: 'agree', label: 'Agree', score: 1 }, { value: 'disagree', label: 'Disagree', score: 0 }] })) } };
  const { page, calls } = await open(t, 1440, { route: async (route, stage, body) => {
    const responses = { hybrid_contract: quizContract, hybrid_draft: wire(quiz), hybrid_behavior: { recipe, initial: '', reduce: '', render: '', bind: '', output: '' } };
    if (!responses[stage]) return false;
    if (stage === 'hybrid_behavior') assert.ok(body.response_format.json_schema.schema.properties.recipe.anyOf);
    await route.fulfill(sse(responses[stage])); return true;
  } });
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.equal(result.reason, 'complete', JSON.stringify(result));
  assert.equal(calls.filter(stage => stage === 'hybrid_behavior').length, 1);
  const frame = page.frameLocator('#pg-preview-frame');
  for (let i = 0; i < 10; i++) { await frame.getByText('Agree', { exact: true }).click(); await frame.getByRole('button', { name: 'Next', exact: true }).click(); }
  const output = await page.evaluate(() => window.DaubPlayground.getOutput());
  assert.equal(output.completed, true);
  assert.equal(output.answers.length, 10);
  assert.equal(output.answers[0].question, 'Question 1');
  assert.equal(output.answers[0].answer, 'Agree');
  const download = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await download).path(), 'utf8');
  assert.match(html, /quizReduce/);
  assert.doesNotMatch(html, /playground-behavior-recipes\.js/);
});

test('Hybrid rejects empty text assertions and compiles missing baseline setup before freezing', async t => {
  let contracts = 0;
  const { page, calls } = await open(t, 1440, { route: async (route, stage) => {
    if (stage !== 'hybrid_contract' || ++contracts > 1) return false;
    const invalid = structuredClone(contract);
    invalid.journeys[0].steps.at(-1).value = '';
    await route.fulfill(sse(invalid)); return true;
  } });
  await submit(page); await finished(page);
  assert.equal(calls.filter(stage => stage === 'hybrid_contract').length, 2);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
  const setup = await page.evaluate(contract => {
    contract.journeys[0].steps.shift();
    return DaubHybridUI.create({}).validateContract(contract).journeys[0].steps[0];
  }, contract);
  assert.deepEqual(setup, { action: 'remember', targetId: 'question', value: '' });
});

test('Hybrid reports a failed journey rather than passing exception-free but inert behavior', async t => {
  const { page } = await open(t, 1440, { route: async (route, stage) => {
    if (stage !== 'hybrid_behavior') return false;
    await route.fulfill(sse({ ...program, reduce: 'return state;' })); return true;
  } });
  await submit(page); await finished(page);
  const result = await page.evaluate(() => window.__hybridLastRun);
  assert.notEqual(result.reason, 'complete');
  assert.ok(result.assessment.checks.some(check => !check.pass), JSON.stringify(result));
  assert.match(await page.locator('#pg-chat-messages').innerText(), /needs review/);
});

test('Hybrid rejects contracts with premature change assertions or per-question requirement sprawl', async t => {
  const { page } = await open(t);
  const errors = await page.evaluate(contract => {
    const validate = DaubHybridUI.create({}).validateContract;
    const premature = structuredClone(contract);
    premature.journeys[0].steps = [{ action: 'assertChanged', targetId: 'question', value: '' }, ...premature.journeys[0].steps];
    const refreshed = structuredClone(contract);
    refreshed.journeys[0].steps.splice(2, 0, { action: 'remember', targetId: 'question', value: '' });
    const oversized = structuredClone(contract);
    oversized.requirements = Array.from({length:9}, (_, i) => ({ id: 'q'+i, targetId:'q'+i, text:'Question '+i, when:'initial' }));
    return [premature, refreshed, oversized].map(value => { try { validate(value); return null; } catch(error) { return error.message; } });
  }, contract);
  assert.match(errors[0], /interaction after its baseline/);
  assert.match(errors[1], /interaction after its baseline/);
  assert.match(errors[2], /1 to 8 region requirements/);
});

test('New chat aborts Hybrid and a late provider response cannot restore its draft', async t => {
  let release, ready;
  const waiting = new Promise(resolve => { ready = resolve; });
  const { page } = await open(t, 1440, { route: async (route, stage) => {
    if (stage !== 'hybrid_draft') return false;
    ready(); await new Promise(resolve => { release = resolve; });
    await route.fulfill(sse(wire(spec))).catch(() => {}); return true;
  } });
  await submit(page); await waiting;
  await page.locator('#pg-new-chat').click(); release();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec') || 'null')), null);
  assert.equal(await page.locator('[data-hybrid-probe]').count(), 0);
  assert.equal(await page.locator('#pg-stop-btn').isVisible(), false);
});

test('Hybrid stops after a quota response without another generation request', async t => {
  const { page, calls } = await open(t, 1440, { route: async (route) => {
    await route.fulfill({ status: 429, json: { error: 'Rate limit exceeded' } }); return true;
  } });
  await submit(page);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#pg-stop-btn')).display === 'none');
  assert.deepEqual(calls, ['hybrid_contract']);
  assert.equal(await page.locator('[data-hybrid-probe]').count(), 0);
});

for (const target of ['hybrid_contract', 'hybrid_draft']) test('Hybrid retries truncated ' + target + ' once with a larger strict output budget', async t => {
  let attempts = 0;
  const { page, calls } = await open(t, 1440, { route: async (route, stage, body) => {
    if (stage !== target) return false;
    attempts++;
    assert.equal(body.max_tokens, attempts === 1 ? 16384 : 32768);
    if (attempts > 1) { assert.match(body.messages[0].content, /fresh, compact complete/); return false; }
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: '{"incomplete":' }, finish_reason: 'length' }] }) + '\n\ndata: [DONE]\n\n' });
    return true;
  } });
  await submit(page); await finished(page);
  assert.equal(calls.filter(stage => stage === target).length, 2);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
});

test('Hybrid stops after its second truncated response without parsing or publishing partial JSON', async t => {
  const { page, calls } = await open(t, 1440, { route: async (route, stage) => {
    if (stage !== 'hybrid_draft') return false;
    const packet = { choices: [{ delta: { content: JSON.stringify(wire(spec)) }, finish_reason: 'length' }] };
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify(packet) + '\n\ndata: [DONE]\n\n' }); return true;
  } });
  await submit(page); await finished(page);
  assert.equal(calls.filter(stage => stage === 'hybrid_draft').length, 2);
  assert.equal(calls.includes('hybrid_review'), false);
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec') || 'null')), null);
  assert.equal(await page.getByText(/Hybrid needs review:/).count(), 1);
  assert.match(await page.locator('#pg-chat-messages').innerText(), /output limit reached after one retry/);
});

test('Hybrid shows the active request stage and elapsed time, then stops its progress timer', async t => {
  let release, ready;
  const waiting = new Promise(resolve => { ready = resolve; });
  const { page } = await open(t, 1440, { route: async (route, stage) => {
    if (stage !== 'hybrid_draft') return false;
    ready(); await new Promise(resolve => { release = resolve; });
    await route.fulfill(sse(wire(spec))); return true;
  } });
  await submit(page); await waiting;
  try {
    await page.waitForFunction(() => /Building page.*[1-9]\d*s.*Waiting for model/.test(document.getElementById('pg-status').textContent));
    assert.match(await page.locator('#pg-chat-messages').innerText(), /Building page/);
    assert.equal(await page.locator('#pg-status').isVisible(), false);
    assert.doesNotMatch(await page.locator('#panel-preview > .pg-panel__toolbar').innerText(), /Building page/);
    await page.screenshot({ path: '/tmp/daub-hybrid-progress-2026-10-08.png' });
  } finally { release(); }
  await finished(page);
  const completed = await page.locator('#pg-chat-messages').innerText();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('#pg-chat-messages').innerText(), completed);
  assert.equal(await page.locator('#pg-status').textContent(), '');
});

test('Hybrid reports received stream bytes before the structured response completes', async t => {
  const { page } = await open(t, 1440, { route: async (route, stage) => {
    if (stage !== 'hybrid_contract') return false;
    await route.continue({ url: base + '/test/hybrid-stream' }); return true;
  } });
  await submit(page);
  try {
    await page.waitForFunction(() => /Reading requirements.*KB received/.test(document.getElementById('pg-status').textContent));
    assert.equal(await page.locator('#pg-stop-btn').isVisible(), true);
  } finally { finishStream?.(); }
  await finished(page);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
});

test('Hybrid corrects an invalid complete draft before publication', async t => {
  let attempts = 0;
  const { page, calls } = await open(t, 1440, { route: async (route, stage, body) => {
    if (stage !== 'hybrid_draft') return false;
    if (++attempts > 1) { assert.match(JSON.parse(body.messages[1].content).validationError, /Missing child/); return false; }
    const invalid = structuredClone(spec); invalid.elements.page.children[2] = 'nextBtn';
    await route.fulfill(sse(wire(invalid))); return true;
  } });
  await submit(page); await finished(page);
  assert.equal(calls.filter(stage => stage === 'hybrid_draft').length, 2);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
});

test('draft correction carries an explicit checklist including page-level bindings', async t => {
  const planned = structuredClone(contract);
  planned.requirements.push({ id: 'screen', targetId: 'screen', text: 'The whole page', when: 'initial' });
  let attempts = 0;
  const { page } = await open(t, 1440, { route: async (route, stage, body) => {
    if (stage === 'hybrid_contract') { await route.fulfill(sse(planned)); return true; }
    if (stage !== 'hybrid_draft') return false;
    const data = JSON.parse(body.messages[1].content);
    assert.deepEqual(data.requiredIds.slice().sort(), ['next', 'progress', 'question', 'screen']);
    if (++attempts === 1) return false;
    assert.match(data.validationError, /Missing required binding: screen/);
    const corrected = structuredClone(spec);
    corrected.root = 'screen'; corrected.elements.screen = corrected.elements.page; delete corrected.elements.page;
    await route.fulfill(sse(wire(corrected))); return true;
  } });
  await submit(page); await finished(page);
  assert.equal(attempts, 2);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
});

test('Hybrid runs an assertChanged journey with compiled baseline setup without another model call', async t => {
  const { page, calls } = await open(t, 1440, { route: async (route, stage) => {
    if (stage !== 'hybrid_contract') return false;
    const missingSetup = structuredClone(contract);
    missingSetup.journeys[0].steps.shift();
    await route.fulfill(sse(missingSetup)); return true;
  } });
  await submit(page); await finished(page);
  assert.equal(calls.filter(stage => stage === 'hybrid_contract').length, 1);
  assert.equal(await page.evaluate(() => window.__hybridLastRun.reason), 'complete');
});
