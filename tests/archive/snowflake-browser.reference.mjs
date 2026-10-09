// Historical integration reference, excluded from the active *.test.mjs suite.
// Moved from tests/playground/snowflake-browser.test.mjs on 2026-10-09.
// Preserves the dirty retirement-time assertions, including work after base
// 034b7311cd7422a2714b6ccacdb58a1b8df80969. Requires the historical production
// selector and Direct/Recursive host; do not run against the Hybrid-only host.
// See docs/archive/playground-generation-modes.md for scope and provenance.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
let server, browser, base;
before(async () => {
  server = createServer(async (req, res) => {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/')) return res.writeHead(403).end();
    try {
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
});
after(async () => { await browser?.close(); if (server?.listening) await new Promise(done => server.close(done)); });

const layout = { root: 'page', elements: { page: { type: 'Stack', props: { direction: 'vertical' }, children: ['stories'] }, stories: { type: 'Stack', props: { direction: 'horizontal', wrap: false }, children: [] } } };
const patch = { root: 'stories', elements: { stories: { type: 'Stack', props: { direction: 'horizontal', wrap: false }, children: ['maya', 'jonas'] }, maya: { type: 'Avatar', props: { initials: 'MC' } }, jonas: { type: 'Avatar', props: { initials: 'JW' } } } };
const completeSpec = { root: 'page', elements: { ...layout.elements, ...patch.elements } };
function structured(spec) {
  const props = object => Object.entries(object).map(([name, v]) => ({ name, value: value(v) }));
  const value = v => Array.isArray(v) ? v.map(value) : v && typeof v === 'object' ? { entries: props(v) } : v;
  return { root: spec.root, elements: Object.entries(spec.elements).map(([id, node]) => ({ id, props: props(node.props || {}), ...(node.type ? { type: node.type, children: node.children || [] } : {}) })) };
}
const sse = value => ({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: typeof value === 'string' ? value : JSON.stringify(value) }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n' });
const specResponse = spec => sse(structured(spec));
const requestContext = body => JSON.parse(typeof body.messages[1].content === 'string' ? body.messages[1].content : body.messages[1].content.find(part => part.type === 'text').text);

async function mockGeneration(t, page, recursive, options = {}) {
  const calls = [], errors = [];
  t.after(() => assert.deepEqual(errors, [], 'Mock contract failures'));
  await page.route('**/api/generate', async route => {
    const body = route.request().postDataJSON();
    try {
      const schema = body.response_format?.json_schema?.name;
      const prompt = body.messages[0].content;
      if (schema?.startsWith('daub_')) {
        const stage = schema.slice(5), context = requestContext(body);
        calls.push(stage);
        return await recursive({ route, body, stage, context });
      }
      if (prompt.startsWith('You are analyzing a UI spec')) {
        calls.push('analyze');
        const analysis = typeof options.analysis === 'function' ? await options.analysis(requestContext(body)) : options.analysis;
        return await route.fulfill(sse(analysis || { needed: false, complexity: 'none', description: '', elements: [], scaffold: '' }));
      }
      if (prompt.startsWith('You are a UI design reviewer.')) {
        calls.push('visual');
        assert.ok(body.messages[1].content.some(part => part.type === 'image_url'));
        return await route.fulfill(sse(requestContext(body)));
      }
      if (prompt.startsWith('You are a JavaScript developer.') && options.interactive) {
        calls.push('interactive');
        return await route.fulfill(sse(await options.interactive(requestContext(body), body)));
      }
      if (options.direct) {
        calls.push('direct');
        return await route.fulfill(sse(options.direct));
      }
      throw new Error('Unmocked generation: ' + prompt.slice(0, 120));
    } catch (error) {
      errors.push(error.message);
      t.diagnostic('Mock contract failure: ' + error.message);
      await route.fulfill({ status: 500, json: { error: error.message } }).catch(() => {});
    }
  });
  return calls;
}

async function submit(page, prompt) {
  await page.locator('#pg-prompt').fill(prompt);
  await page.locator('#pg-prompt').press('Enter');
}

async function pipelineFinished(page, label = 'Runtime checked; behavior needs review') {
  try {
    await page.locator('.pg-pipeline > summary').filter({ hasText: label }).waitFor({ timeout: 10000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      summary: document.querySelector('.pg-pipeline > summary')?.textContent,
      pipeline: document.querySelector('.pg-pipeline')?.textContent,
      status: document.querySelector('#pg-status').textContent,
      results: Array.from(document.querySelectorAll('.pg-result-meta'), node => node.textContent),
      error: document.querySelector('#pg-json-error')?.textContent,
      iframe: document.querySelector('#pg-preview-frame').getBoundingClientRect().toJSON(),
    }));
    throw new Error(error.message + '\nPipeline state: ' + JSON.stringify(state));
  }
  await page.waitForFunction(() => !document.querySelector('#pg-generation-mode').disabled);
}

async function open(t, width = 1440, expectedErrors = []) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  t.after(() => context.close());
  await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith(base) || url.includes('/api/')) return route.abort();
    return route.continue();
  });
  await context.route('**/api/choose', route => route.fulfill({ json: { model: 'mock-chooser', scores: { Button: .9, Avatar: .9, CustomHTML: .9 } } }));
  await context.route('**/api/figma', route => route.fulfill({ json: { connected: false } }));
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  t.after(() => assert.deepEqual(pageErrors, expectedErrors, 'Uncaught browser errors'));
  page.setDefaultTimeout(5000);
  await page.goto(base + '/playground.html?design=snowflake');
  assert.equal(await page.locator('#pg-generation-mode').inputValue(), 'snowflake');
  return page;
}

for (const width of [1440, 390]) for (const theme of ['light', 'dark']) test(`region skeletons preserve geometry and respect motion at ${width}px in ${theme}`, async t => {
  const page = await open(t, width);
  const shell = { theme, root: 'page', elements: {
    page: { type: 'Stack', props: { direction: 'vertical', gap: 4 }, children: ['header', 'body', 'footer'] },
    header: { type: 'Stack', props: {}, children: [] },
    body: { type: 'Grid', props: { columns: 'sidebar-main', gap: 4 }, children: ['sidebar', 'content'] },
    sidebar: { type: 'Stack', props: {}, children: [] },
    content: { type: 'Stack', props: {}, children: [] },
    footer: { type: 'Stack', props: {}, children: [] }
  } };
  await page.evaluate(spec => sessionStorage.setItem('pg-current-spec', JSON.stringify(spec)), shell);
  await page.reload();
  if (width === 390) await page.locator('.pg-bottom-tabs [data-panel="preview"]').click();
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.locator('[data-spec-id="content"]').waitFor({ state: 'attached' });
  await page.evaluate(() => document.getElementById('pg-preview-frame').contentWindow.postMessage({ type: 'refinement', state: { header: 'running', sidebar: 'pending', content: 'running', footer: 'failed' } }, '*'));
  await frame.locator('.pg-region-skeleton').first().waitFor();
  assert.equal(await frame.locator('.pg-region-skeleton').count(), 4);
  assert.equal(await frame.locator('.pg-region-skeleton [data-spec-id]').count(), 0);
  assert.equal(await frame.locator('.pg-region-skeleton button, .pg-region-skeleton [tabindex]').count(), 0);
  assert.equal(await frame.locator('[data-spec-id="sidebar"]').getAttribute('data-pg-region-size'), 'sidebar');
  assert.match(await frame.locator('[data-spec-id="content"] .pg-region-skeleton').getAttribute('aria-label'), /Building/);
  const region = frame.locator('[data-spec-id="content"]');
  const before = await region.boundingBox();
  await page.waitForTimeout(100);
  assert.deepEqual(await region.boundingBox(), before);
  assert.equal(await frame.locator('html').evaluate(el => el.scrollWidth <= innerWidth), true);
  assert.equal(await region.locator('.pg-region-skeleton').evaluate(el => getComputedStyle(el).animationName), 'pg-region-pulse');
  const geometry = await page.evaluate(() => new Promise(resolve => {
    const iframe = document.getElementById('pg-preview-frame');
    function listener(event) {
      if (event.source !== iframe.contentWindow || event.data.requestId !== 'skeleton-test') return;
      window.removeEventListener('message', listener);
      resolve(event.data.geometry);
    }
    window.addEventListener('message', listener);
    iframe.contentWindow.postMessage({ type: 'screenshot', geometry: true, geometryOnly: true, requestId: 'skeleton-test' }, '*');
  }));
  assert.equal(geometry.stable, true);
  assert.equal(geometry.elements.length, 6);
  assert.equal(geometry.elements.find(el => el.id === 'content').placeholder, true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await region.locator('.pg-region-skeleton').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec'))), shell);
  await page.screenshot({ path: `/private/tmp/daub-skeleton-${width}-${theme}.png` });
  await page.evaluate(() => document.getElementById('pg-preview-frame').contentWindow.postMessage({ type: 'refinement', state: null }, '*'));
  await frame.locator('.pg-region-skeleton').first().waitFor({ state: 'detached' });
  assert.equal(await frame.locator('[data-pg-region-state], [data-pg-region-size]').count(), 0);
});

for (const [mode, codeId] of [['snowflake', 'behavior'], ['direct', 'behavior'], ['snowflake', 'counter-handler']]) test(mode + ' runs shared interactivity and runtime verification with code node ' + codeId, async t => {
  const page = await open(t);
  await page.locator('#pg-generation-mode').selectOption(mode);
  const initial = { root: 'page', elements: {
    page: { type: 'Stack', props: { gap: 3 }, children: ['heading', 'counter', 'add', 'duplicate'] },
    heading: { type: 'Text', props: { content: 'Click counter', tag: 'h1' }, children: [] },
    counter: { type: 'Text', props: { content: 'Count: 0' }, children: [] },
    add: { type: 'Button', props: { label: 'Increment' }, children: [] },
    duplicate: { type: 'Button', props: { label: 'Increment again' }, children: [] },
  } };
  const corrected = structuredClone(initial);
  corrected.elements.page = { type: 'Surface', props: {}, children: ['heading', 'add', 'counter'] };
  delete corrected.elements.duplicate;
  const judgments = [];
  await page.route('**/api/refine-judge', route => {
    const body = route.request().postDataJSON(); judgments.push(body);
    return route.fulfill({ json: { decisions: body.targets.map(id => ({ id, needsDetail: false, probability: .1 })) } });
  });
  const calls = await mockGeneration(t, page, async ({ route, stage, context, body }) => {
    if (stage === 'design') return route.fulfill(specResponse(initial));
    assert.equal(stage, 'reconcile');
    assert.equal(context.targetId, 'page'); assert.deepEqual(context.issues, []);
    assert.deepEqual(context.currentSpec, initial);
    const screenshot = body.messages[1].content.find(part => part.type === 'image_url');
    assert.match(screenshot.image_url.url, /^data:image\//);
    assert.equal(await page.frameLocator('#pg-preview-frame').getByRole('button').count(), 2);
    return route.fulfill(specResponse(corrected));
  }, {
    direct: corrected,
    analysis: { needed: true, complexity: 'trivial', description: 'Increment the counter on click', elements: ['add', 'counter'], scaffold: '' },
    interactive: spec => {
      assert.deepEqual(spec, corrected);
      const result = structuredClone(spec);
      result.elements.page.children.push('_shared_state', codeId);
      result.elements._shared_state = { type: 'CustomHTML', props: { html: '', js: 'let count = 0;' } };
      result.elements[codeId] = { type: 'CustomHTML', props: { html: '', js: 'preview.querySelector(\'[data-spec-id="add"]\').addEventListener("click", function() { count++; preview.querySelector(\'[data-spec-id="counter"]\').textContent = "Count: " + count; });' } };
      return result;
    },
  });
  await submit(page, 'A click counter with one increment button');
  await pipelineFinished(page);
  assert.deepEqual(calls, mode === 'snowflake' ? ['design', 'reconcile', 'analyze', 'visual', 'interactive'] : ['direct', 'analyze', 'visual', 'interactive']);
  if (mode === 'snowflake') {
    assert.deepEqual(judgments.map(step => [step.mode, step.targets]), [['detail', ['page']], ['detail', ['page']], ['spacing', ['page']]]);
  } else assert.deepEqual(judgments, []);
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.getByRole('button').count(), 1);
  await frame.getByRole('button', { name: 'Increment', exact: true }).click();
  assert.equal(await frame.locator('[data-spec-id="counter"]').textContent(), 'Count: 1');
  await frame.getByRole('button', { name: 'Increment', exact: true }).click();
  assert.equal(await frame.locator('[data-spec-id="counter"]').textContent(), 'Count: 2');
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')));
  assert.equal(saved.elements.page.type, 'Surface'); assert.equal(saved.elements.duplicate, undefined);
  assert.ok(saved.elements._shared_state); assert.ok(saved.elements[codeId]);
  await page.reload();
  await frame.getByRole('button', { name: 'Increment', exact: true }).click();
  await frame.getByText('Count: 1', { exact: true }).waitFor();
  const history = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-chat-history')));
  assert.equal(history.at(-1).verification, 'Runtime checked; behavior needs review');
});

test('partial refinement with a valid baseline continues shared behavior without claiming layout approval', async t => {
  const page = await open(t);
  const spec = { root: 'page', elements: {
    page: { type: 'Stack', props: { gap: 3 }, children: ['heading', 'add'] },
    heading: { type: 'Text', props: { content: 'Quantity: 1' }, children: [] },
    add: { type: 'Button', props: { label: 'Add one' }, children: [] },
  } };
  const judgments = [];
  await page.route('**/api/refine-judge', route => {
    const body = route.request().postDataJSON(); judgments.push(body);
    return route.fulfill({ json: { decisions: body.targets.map(id => ({ id, needsDetail: false, probability: .1 })) } });
  });
  const calls = await mockGeneration(t, page, ({ route, stage }) => {
    if (stage === 'design') return route.fulfill(specResponse(spec));
    assert.equal(stage, 'reconcile');
    return route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: '{}' }, finish_reason: 'error' }] }) + '\n\ndata: [DONE]\n\n' });
  }, {
    analysis: { needed: true, complexity: 'trivial', description: 'Increase quantity', elements: ['add', 'heading'], scaffold: '' },
    interactive: current => {
      assert.deepEqual(current, spec);
      const next = structuredClone(current);
      next.elements.page.children.push('behavior');
      next.elements.behavior = { type: 'CustomHTML', props: { html: '', js: 'preview.querySelector(\'[data-spec-id="add"]\').addEventListener("click", function() { preview.querySelector(\'[data-spec-id="heading"]\').textContent = "Quantity: 2"; });' } };
      return next;
    },
  });
  await submit(page, 'A quantity control');
  await pipelineFinished(page);
  assert.deepEqual(calls, ['design', 'reconcile', 'analyze', 'visual', 'interactive']);
  assert.deepEqual(judgments.map(step => step.mode), ['detail', 'spacing']);
  await page.locator('.pg-result-meta').filter({ hasText: 'Refinement paused: Some regions need another pass: page' }).waitFor();
  assert.equal(await page.getByText('Jev: no further refinement', { exact: true }).count(), 0);
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.getByRole('button', { name: 'Add one', exact: true }).click();
  await frame.getByText('Quantity: 2', { exact: true }).waitFor();
  const history = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-chat-history')));
  assert.match(history.at(-1).refinementStatus, /^Refinement paused: Some regions need another pass: page/);
  assert.equal(history.at(-1).verification, 'Runtime checked; behavior needs review');
});

test('a late click exception updates runtime status and New Chat clears the old warning', async t => {
  const page = await open(t, 1440, ['late click fixture']);
  const spec = { root: 'page', elements: {
    page: { type: 'Stack', props: {}, children: ['trigger'] },
    trigger: { type: 'Button', props: { label: 'Trigger exception' }, children: [] },
  } };
  await page.route('**/api/refine-judge', route => {
    const { targets } = route.request().postDataJSON();
    return route.fulfill({ json: { decisions: targets.map(id => ({ id, needsDetail: false, probability: .1 })) } });
  });
  const calls = await mockGeneration(t, page, ({ route, stage, context }) => {
    assert.ok(['design', 'reconcile'].includes(stage));
    return route.fulfill(specResponse(stage === 'design' ? spec : context.currentSpec));
  }, {
    analysis: { needed: true, complexity: 'trivial', description: 'Handle the button', elements: ['trigger'], scaffold: '' },
    interactive: current => {
      const next = structuredClone(current);
      next.elements.page.children.push('behavior');
      next.elements.behavior = { type: 'CustomHTML', props: { html: '', js: 'preview.querySelector(\'[data-spec-id="trigger"]\').addEventListener("click", function() { throw new Error("late click fixture"); });' } };
      return next;
    },
  });
  await submit(page, 'A button with a click handler');
  await pipelineFinished(page);
  await page.evaluate(() => window.addEventListener('message', event => {
    if (event.source === document.querySelector('#pg-preview-frame').contentWindow && event.data?.type === 'runtime-error') window.lastRuntimeError = event.data;
  }));
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.getByRole('button', { name: 'Trigger exception', exact: true }).click();
  await page.locator('.pg-pipeline > summary').filter({ hasText: 'Runtime error: late click fixture' }).waitFor();
  const history = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-chat-history')));
  assert.equal(history.at(-1).verification, 'Runtime error: late click fixture');
  const oldError = await page.evaluate(() => window.lastRuntimeError);
  assert.equal(typeof oldError.seq, 'number');
  await page.locator('#pg-new-chat').click();
  await frame.locator('body').evaluate((_, error) => parent.postMessage(error, '*'), oldError);
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.pg-pipeline').count(), 0);
  assert.equal(await page.getByText(/Runtime error: late click fixture/).count(), 0);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('pg-current-spec')), 'null');
  assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-chat-history'))), []);
  assert.deepEqual(calls, ['design', 'reconcile', 'analyze', 'visual', 'interactive']);
});

test('New Chat aborts the shared pipeline before visual review or late publication', async t => {
  const page = await open(t);
  let release, analyzing = false;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/refine-judge', route => {
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { decisions: body.targets.map(id => ({ id, needsDetail: false, probability: .1 })) } });
  });
  const calls = await mockGeneration(t, page, ({ route, stage, context }) => {
    assert.ok(['design', 'reconcile'].includes(stage));
    return route.fulfill(specResponse(stage === 'design' ? completeSpec : context.currentSpec));
  }, { analysis: async () => { analyzing = true; await held; return { needed: false, complexity: 'none', elements: [] }; } });
  try {
    await submit(page, 'A compact story strip');
    for (let i = 0; i < 100 && !analyzing; i++) await page.waitForTimeout(50);
    assert.equal(analyzing, true);
    await page.locator('#pg-new-chat').click();
    release();
    await page.waitForTimeout(300);
    assert.deepEqual(calls, ['design', 'reconcile', 'analyze']);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('pg-current-spec')), 'null');
    assert.equal(await page.locator('.pg-pipeline, .pg-result-header').count(), 0);
  } finally { release(); }
});

for (const width of [1440, 390]) test(`completed layout checks and repairs spacing at ${width}px without changing answers`, async t => {
  const page = await open(t, width);
  const spec = { root: 'page', theme: 'light', elements: {
    page: { type: 'Stack', props: { direction: 'vertical', gap: 0 }, children: ['header', 'progress', 'question', 'help', 'answers', 'actions'] },
    header: { type: 'Stack', props: { direction: 'horizontal', justify: 'between', gap: 0 }, children: ['title', 'exit'] },
    title: { type: 'Text', props: { tag: 'h1', content: 'Personality test' } },
    exit: { type: 'Button', props: { label: 'Save & exit', variant: 'ghost' } },
    progress: { type: 'Progress', props: { value: 30, label: 'Question 3 of 10' } },
    question: { type: 'Text', props: { tag: 'h2', content: 'I enjoy being the center of attention at social gatherings.' } },
    help: { type: 'Text', props: { content: 'Select the response that best reflects how you see yourself.' } },
    answers: { type: 'RadioGroup', props: { selected: 'neutral', options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'].map(label => ({ label, value: label.toLowerCase() })) } },
    actions: { type: 'Stack', props: { direction: 'horizontal', gap: 0 }, children: ['back', 'next'] },
    back: { type: 'Button', props: { label: 'Back' } },
    next: { type: 'Button', props: { label: 'Next', variant: 'primary' } }
  } };
  Object.values(spec.elements).forEach(node => { node.children ||= []; });
  const measured = [];
  let repairs = 0, reconciles = 0;
  await page.route('**/api/refine-judge', route => {
    const body = route.request().postDataJSON();
    if (body.mode === 'spacing') measured.push(body.geometry);
    const needsDetail = body.mode === 'spacing' && body.spec.elements.page.props.gap === 0;
    return route.fulfill({ json: { decisions: body.targets.map(id => ({ id, needsDetail, probability: needsDetail ? .9 : .1 })) } });
  });
  const calls = await mockGeneration(t, page, ({ route, body, stage, context }) => {
    if (stage === 'reconcile') {
      reconciles++;
      assert.equal(context.targetId, 'page');
      assert.ok(Array.isArray(body.messages[1].content), 'Reconciliation requires a full-page screenshot');
      assert.ok(body.messages[1].content.some(part => part.type === 'image_url'));
      return route.fulfill(specResponse(context.currentSpec));
    }
    repairs++;
    assert.equal(stage, 'spacing');
    assert.match(body.messages[0].content, /vertical rhythm and horizontal spacing/);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.name, 'daub_spacing');
    assert.equal(context.geometry.elements.length, Object.keys(spec.elements).length);
    const patch = { root: 'page', elements: { page: { props: { gap: 6 } }, header: { props: { gap: 4 } }, actions: { props: { gap: 3 } } } };
    return route.fulfill(specResponse(patch));
  });
  await page.evaluate(value => sessionStorage.setItem('pg-current-spec', JSON.stringify(value)), spec);
  await page.reload();
  await page.locator('#pg-prompt').fill('Check this personality test layout');
  await page.locator('#pg-prompt').press('Enter');
  await page.getByText('Spacing checked', { exact: true }).waitFor({ timeout: 20000 });
  await pipelineFinished(page);
  assert.deepEqual(calls, ['reconcile', 'spacing', 'analyze', 'visual']);
  assert.equal(reconciles, 1);
  assert.equal(repairs, 1);
  assert.equal(measured.length, 2);
  const node = (report, id) => report.elements.find(el => el.id === id);
  for (const report of measured) {
    assert.equal(report.stable, true);
    assert.equal(report.truncated, false);
    assert.equal(report.elements.length, Object.keys(spec.elements).length);
  }
  const verticalGap = report => node(report, 'actions').bounds.y - (node(report, 'answers').bounds.y + node(report, 'answers').bounds.height);
  const horizontalGap = report => node(report, 'next').bounds.x - (node(report, 'back').bounds.x + node(report, 'back').bounds.width);
  assert.ok(Math.abs(verticalGap(measured[0])) < .02);
  assert.ok(Math.abs(horizontalGap(measured[0])) < .02);
  assert.ok(Math.abs(verticalGap(measured[1]) - 32) < .02);
  assert.ok(Math.abs(horizontalGap(measured[1]) - 12) < .02);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')));
  const expected = structuredClone(spec);
  expected.elements.page.props.gap = 6;
  expected.elements.header.props.gap = 4;
  expected.elements.actions.props.gap = 3;
  assert.deepEqual(saved, expected);
  if (width === 390) await page.locator('.pg-bottom-tabs [data-panel="preview"]').click();
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.locator('[data-spec-id="answers"] input:checked').inputValue(), 'neutral');
  assert.equal(await frame.locator('html').evaluate(el => el.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `/private/tmp/daub-spacing-${width}.png` });
});

test('SSE errors retain quota and rate-limit status instead of looking like empty JSON', async () => {
  const html = await readFile(resolve(root, 'playground.html'), 'utf8');
  const source = html.slice(html.indexOf('function parseSseResponse(res)'), html.indexOf('// ---- Content integrity guard'));
  const limits = [];
  const parse = new Function('stopForProviderLimit', source + ';return parseSseResponse;')(status => limits.push(Number(status)));
  for (const status of [401, 402, 403, 429]) {
    await assert.rejects(parse(new Response('data: ' + JSON.stringify({ error: { code: status, message: 'Provider failure' } }) + '\n\n')), error => error.status === status);
  }
  assert.deepEqual(limits, [401, 402, 403, 429]);
  const parsed = await parse(new Response('data: invalid\n\ndata: {"choices":[{"delta":{"content":"{}"}}]}\n\ndata: [DONE]\n\n'));
  assert.equal(parsed.content, '{}');
  const truncated = await parse(new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: '{}' }, finish_reason: 'length' }] }) + '\n\n'));
  assert.equal(truncated.finishReason, 'length');
  const refused = await parse(new Response('data: ' + JSON.stringify({ choices: [{ delta: { refusal: 'Declined' }, finish_reason: 'stop' }] }) + '\n\n'));
  assert.equal(refused.refused, true);
  const interrupted = await parse(new Response('data:' + JSON.stringify({ choices: [{ delta: { content: '', reasoning: 'thinking' }, finish_reason: null }] }) + '\n\n'));
  assert.equal(interrupted.completed, false);
  assert.equal(interrupted.content, '');
  const noSpace = await parse(new Response('data:' + JSON.stringify({ choices: [{ delta: { content: '{}' }, finish_reason: 'stop' }] }) + '\n\n'));
  assert.equal(noSpace.completed, true);
  assert.equal(noSpace.content, '{}');
  assert.equal((await parse(new Response('data:[DONE]\n\n'))).completed, true);
});

test('initial design repairs a located decoder error once, then reconciles and enters the shared pipeline', async t => {
  const page = await open(t);
  let designs = 0;
  await page.route('**/api/refine-judge', route => {
    const body = route.request().postDataJSON();
    assert.deepEqual(body.targets, ['page']);
    return route.fulfill({ json: { decisions: [{ id: 'page', needsDetail: false, probability: .1 }] } });
  });
  const calls = await mockGeneration(t, page, async ({ route, stage, context, body }) => {
    if (stage === 'design') {
      designs++;
      assert.equal(context.currentSpec, null);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('pg-current-spec')), null);
      if (designs === 1) {
        const invalid = structured(completeSpec);
        invalid.elements[0].props.push({ name: 'gap', value: 2 }, { name: 'gap', value: 3 });
        return route.fulfill(sse(invalid));
      }
      assert.match(body.messages[0].content, /previous patch failed validation: Invalid or duplicate property name/);
      assert.match(body.messages[0].content, /element "page"\.props: "gap"/);
      return route.fulfill(specResponse(completeSpec));
    }
    assert.equal(stage, 'reconcile');
    return route.fulfill(specResponse(context.currentSpec));
  });
  await submit(page, 'A compact story strip');
  await pipelineFinished(page);
  assert.equal(designs, 2);
  assert.deepEqual(calls, ['design', 'design', 'reconcile', 'analyze', 'visual']);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')));
  assert.deepEqual(saved.elements.stories.children, ['maya', 'jonas']);
});

test('editing a previous interactive spec preserves its source context and recreates behavior after the native baseline', async t => {
  const page = await open(t);
  const previous = structuredClone(completeSpec);
  previous.elements.page.children = ['heading', 'stories', 'behavior'];
  previous.elements.heading = { type: 'Text', props: { content: 'My family stories' }, children: [] };
  previous.elements.behavior = { type: 'CustomHTML', props: { html: '', js: 'preview.querySelector(\'[data-spec-id="heading"]\').dataset.bound = "original";' } };
  await page.evaluate(spec => sessionStorage.setItem('pg-current-spec', JSON.stringify(spec)), previous);
  await page.reload();
  await page.frameLocator('#pg-preview-frame').locator('[data-spec-id="heading"][data-bound="original"]').waitFor();
  const native = structuredClone(previous);
  delete native.elements.behavior;
  native.elements.page.children = ['heading', 'stories'];
  native.elements.heading.props.content = 'My family stories - recent';
  await page.route('**/api/refine-judge', route => {
    const { targets } = route.request().postDataJSON();
    return route.fulfill({ json: { decisions: targets.map(id => ({ id, needsDetail: false, probability: .1 })) } });
  });
  const calls = await mockGeneration(t, page, ({ route, stage, context }) => {
    if (stage === 'design') {
      assert.deepEqual(context.currentSpec, previous);
      assert.match(context.request, /recent/);
      return route.fulfill(specResponse(native));
    }
    assert.equal(stage, 'reconcile');
    assert.equal(context.currentSpec.elements.behavior, undefined);
    return route.fulfill(specResponse(context.currentSpec));
  }, {
    analysis: { needed: true, complexity: 'trivial', description: 'Restore heading behavior', elements: ['heading'], scaffold: '' },
    interactive: spec => {
      const next = structuredClone(spec);
      next.elements.page.children.push('behavior');
      next.elements.behavior = { type: 'CustomHTML', props: { html: '', js: 'preview.querySelector(\'[data-spec-id="heading"]\').dataset.bound = "recreated";' } };
      return next;
    },
  });
  await submit(page, 'Keep my family stories and label the heading as recent');
  await pipelineFinished(page);
  assert.deepEqual(calls, ['design', 'reconcile', 'analyze', 'visual', 'interactive']);
  const heading = page.frameLocator('#pg-preview-frame').locator('[data-spec-id="heading"][data-bound="recreated"]');
  await heading.waitFor(); assert.equal(await heading.textContent(), 'My family stories - recent');
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')));
  assert.deepEqual(saved.elements.stories.children, ['maya', 'jonas']);
  assert.match(saved.elements.behavior.props.js, /recreated/);
});

test('reasoning-only interrupted stream reports interruption rather than empty JSON without retry', async t => {
  const page = await open(t);
  let calls = 0;
  await mockGeneration(t, page, ({ route, body, stage }) => {
    calls++;
    assert.equal(stage, 'design');
    assert.deepEqual(body.reasoning, { effort: 'none' });
    assert.equal(body.model, 'openrouter/auto');
    return route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: '', reasoning: 'thinking' }, finish_reason: null }] }) + '\n\n' });
  });
  await page.locator('#pg-prompt').fill('10-step personality test, mobile optimized');
  await page.locator('#pg-prompt').press('Enter');
  await page.getByText(/Refinement stopped: The generation stream ended before the model finished/).waitFor();
  assert.equal(calls, 1);
  assert.equal(await page.locator('.pg-result-header').count(), 0);
});

for (const [choice, message] of [
  [{ delta: { content: JSON.stringify(structured(layout)) }, finish_reason: 'length' }, /output limit/],
  [{ delta: { refusal: 'Declined' }, finish_reason: 'stop' }, /declined/],
  [{ delta: { content: '' }, finish_reason: 'stop' }, /empty structured response/],
]) test('structured generation stops without retry on ' + message, async t => {
  const page = await open(t);
  let calls = 0;
  await mockGeneration(t, page, ({ route, stage }) => {
    calls++;
    assert.equal(stage, 'design');
    return route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [choice] }) + '\n\ndata: [DONE]\n\n' });
  });
  await page.locator('#pg-prompt').fill('10-step personality test, mobile optimized');
  await page.locator('#pg-prompt').press('Enter');
  await page.locator('.pg-result-meta').filter({ hasText: message }).waitFor();
  assert.equal(calls, 1);
  assert.equal(await page.locator('.pg-result-header').count(), 0);
});

test('recursive mode refines branches, reconciles once, and runs the shared pipeline', async t => {
  const page = await open(t);
  let generations = 0, judgments = 0;
  await page.route('**/api/refine-judge', route => {
    judgments++;
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { decisions: body.targets.map(id => ({ id, needsDetail: body.mode !== 'spacing' && (id === 'page' ? !body.spec.elements.page.props.gap : id === 'stories' && !body.spec.elements.stories.children.length), probability: .9 })) } });
  });
  await page.evaluate(value => sessionStorage.setItem('pg-current-spec', JSON.stringify(value)), layout);
  await page.reload();
  const calls = await mockGeneration(t, page, ({ route, stage, context, body }) => {
    if (stage === 'reconcile') {
      assert.equal(context.targetId, 'page');
      assert.ok(body.messages[1].content.some(part => part.type === 'image_url'));
      assert.equal(context.currentSpec.elements.stories.children.length, 2);
      return route.fulfill(specResponse(context.currentSpec));
    }
    generations++;
    assert.equal(stage, 'refine');
    const spec = generations === 1 ? { root: 'page', elements: { ...layout.elements, page: { ...layout.elements.page, props: { direction: 'vertical', gap: 3 } } } } : patch;
    return route.fulfill(specResponse(spec));
  });
  await page.locator('#pg-prompt').fill('Instagram-like app feed design');
  await page.locator('#pg-prompt').press('Enter');
  await page.getByText('Jev: no further refinement', { exact: true }).waitFor({ timeout: 20000 });
  await pipelineFinished(page);
  assert.deepEqual(calls, ['refine', 'refine', 'reconcile', 'analyze', 'visual']);
  assert.equal(generations, 2);
  assert.ok(judgments >= 2);
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.locator('[data-spec-id="stories"]').evaluate(el => getComputedStyle(el).flexDirection), 'row');
  const a = await frame.locator('[data-spec-id="maya"]').boundingBox();
  const b = await frame.locator('[data-spec-id="jonas"]').boundingBox();
  assert.equal(a.y, b.y);
  assert.ok(b.x > a.x);
  assert.equal(await page.locator('.pg-result-header').count(), 1);
});

test('recursive mode reports judge failure without retries or pretending completion', async t => {
  const page = await open(t, 390);
  let judges = 0;
  let measured;
  const calls = await mockGeneration(t, page, ({ route, stage }) => {
    assert.equal(stage, 'design'); return route.fulfill(specResponse(completeSpec));
  });
  await page.route('**/api/refine-judge', route => {
    judges++;
    measured = route.request().postDataJSON().geometry;
    return route.fulfill({ status: 429, json: { error: 'Rate limit exceeded' } });
  });
  await page.locator('#pg-prompt').fill('Instagram-like app feed design');
  await page.locator('#pg-prompt').press('Enter');
  await page.getByText(/Refinement stopped:.*Rate limit/).waitFor({ timeout: 15000 });
  assert.ok(measured?.stable);
  assert.equal(measured.viewport.width, 390);
  assert.ok(measured.capture.bounds.width > 0);
  assert.equal(judges, 1);
  assert.deepEqual(calls, ['design']);
  assert.equal(await page.locator('.pg-pipeline').count(), 0);
  assert.equal(await page.getByText('Jev: no further refinement', { exact: true }).count(), 0);
  assert.ok(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')).elements.stories));
  assert.equal(await page.locator('.pg-recursive-measure').count(), 0);
  assert.equal(await page.locator('#panel-preview').isVisible(), false);
  await page.reload();
  await page.getByText(/Refinement stopped:.*Rate limit/).waitFor();
  assert.equal(judges, 1);
});

test('New Chat cancels recursive generation without restoring a late layout', { timeout: 15000 }, async t => {
  const page = await open(t, 390);
  let requests = 0;
  await mockGeneration(t, page, async ({ route, stage }) => {
    assert.equal(stage, 'design'); requests++;
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill(specResponse(completeSpec)).catch(() => {});
  });
  await page.locator('#pg-prompt').fill('Instagram-like app feed design');
  await page.locator('#pg-prompt').press('Enter');
  for (let i = 0; i < 100 && !requests; i++) await page.waitForTimeout(50);
  assert.equal(requests, 1, 'Design request must start before cancellation');
  await page.locator('#pg-new-chat').click();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('pg-current-spec')), 'null');
  assert.equal(await page.locator('.pg-result-header').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('recursive mode rejects CustomHTML outside the native design schema before accepting a version', async t => {
  const page = await open(t);
  const broken = { root: 'sidebar', elements: { sidebar: { type: 'CustomHTML', props: { html: '<p>Not native</p>' } } } };
  let judges = 0;
  await mockGeneration(t, page, ({ route, stage }) => {
    assert.equal(stage, 'design'); return route.fulfill(specResponse(broken));
  });
  await page.route('**/api/refine-judge', route => { judges++; return route.fulfill({ json: { decisions: [] } }); });
  await page.locator('#pg-prompt').fill('A project sidebar');
  await page.locator('#pg-prompt').press('Enter');
  await page.getByText(/Refinement stopped: Invalid structured component/).waitFor();
  assert.equal(judges, 0);
  assert.equal(await page.locator('.pg-result-header').count(), 0);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('pg-current-spec')), 'null');
});

test('recursive regions preserve concurrent siblings after two rejected attempts and failed reconciliation', async t => {
  const page = await open(t);
  const shell = {
    root: 'page', elements: {
      page: { type: 'Stack', props: { direction: 'vertical', gap: 4 }, children: ['header', 'body', 'footer'] },
      header: { type: 'Stack', props: { direction: 'horizontal' }, children: [] },
      body: { type: 'Grid', props: { columns: 'sidebar-main', gap: 4 }, children: ['sidebar', 'content'] },
      sidebar: { type: 'Stack', props: { direction: 'vertical' }, children: [] },
      content: { type: 'Stack', props: { direction: 'vertical' }, children: [] },
      footer: { type: 'Stack', props: { direction: 'horizontal' }, children: [] },
    },
  };
  const held = new Map(); let contentAttempts = 0;
  const calls = await mockGeneration(t, page, async ({ route, body, stage, context: step }) => {
    if (stage === 'design') return route.fulfill(specResponse(shell));
    if (stage === 'reconcile') {
      assert.ok(step.issues.includes('Empty layout region: content'));
      return route.fulfill(specResponse(step.currentSpec));
    }
    assert.equal(stage, 'refine');
    if (step.targetId === 'page') return route.fulfill(specResponse(shell));
    if (step.targetId === 'content') {
      contentAttempts++;
      if (contentAttempts === 2) assert.match(body.messages[0].content, /previous patch failed validation/);
    }
    assert.ok(step.geometry?.elements.some(element => element.id === step.targetId), 'Each branch receives its own measured geometry');
    held.set(step.targetId, { route, step });
  });
  await page.route('**/api/refine-judge', route => {
    const { targets, spec, mode } = route.request().postDataJSON();
    return route.fulfill({ json: { decisions: targets.map(id => ({
      id, probability: .9,
      needsDetail: mode !== 'spacing' && (id === 'page' ? !spec.elements.content.children.length : id === 'body' ? !spec.elements.sidebar.children.length : ['header', 'footer', 'sidebar', 'content'].includes(id) && !spec.elements[id].children.length),
    })) } });
  });
  await page.locator('#pg-prompt').fill('App with header, sidebar, content and footer');
  await page.locator('#pg-prompt').press('Enter');
  const waitForRequests = async ids => {
    for (let attempt = 0; attempt < 100 && !ids.every(id => held.has(id)); attempt++) await page.waitForTimeout(50);
    assert.ok(ids.every(id => held.has(id)), 'Concurrent requests missing: ' + ids.filter(id => !held.has(id)));
  };
  await waitForRequests(['header', 'body', 'footer']);
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.locator('[data-pg-region]').count(), 4);
  assert.equal(await frame.locator('.pg-region-skeleton').count(), 4);
  assert.equal(await page.locator('[data-branch-id].pg-chat__step--active').count(), 3);
  const boxes = {};
  for (const id of ['header', 'sidebar', 'content', 'footer']) boxes[id] = await frame.locator(`[data-spec-id="${id}"]`).boundingBox();
  assert.equal(boxes.sidebar.y, boxes.content.y);
  assert.ok(boxes.content.x >= boxes.sidebar.x + boxes.sidebar.width);
  assert.ok(boxes.header.y + boxes.header.height <= boxes.content.y);
  assert.ok(boxes.footer.y >= boxes.content.y + boxes.content.height);
  assert.ok(boxes.content.height >= 200);
  const fulfill = async id => {
    const { route, step } = held.get(id);
    const node = step.currentSpec.elements[id];
    const elements = id === 'body' ? { body: node, sidebar: shell.elements.sidebar, content: shell.elements.content } : {
      [id]: { ...node, children: [id + '-text'] },
      [id + '-text']: { type: 'Text', props: { content: id + ' ready' } },
    };
    await route.fulfill(specResponse({ root: id, elements }));
  };
  await fulfill('header');
  await frame.getByText('header ready', { exact: true }).waitFor();
  assert.equal(await frame.locator('[data-spec-id="header"] .pg-region-skeleton').count(), 0);
  assert.equal(await frame.locator('[data-spec-id="content"][data-pg-region]').count(), 1);
  assert.equal(await page.locator('[data-branch-id].pg-chat__step--active').count(), 2);
  await fulfill('body');
  await waitForRequests(['sidebar', 'content']);
  assert.equal(await page.locator('[data-branch-id="footer"].pg-chat__step--active').count(), 1);
  assert.equal(await page.locator('[data-branch-id].pg-chat__step--active').count(), 3);
  assert.equal(await page.locator('#pg-status').textContent(), '3/3 active, 0 queued');
  await page.screenshot({ path: '/private/tmp/daub-fractal-queue.png' });
  await held.get('content').route.fulfill(sse('invalid JSON'));
  for (let i = 0; i < 100 && contentAttempts < 2; i++) await page.waitForTimeout(50);
  assert.equal(contentAttempts, 2);
  await held.get('content').route.fulfill(sse('invalid JSON'));
  await page.locator('[data-branch-id="content"].pg-chat__step--error').waitFor();
  await fulfill('sidebar');
  await fulfill('footer');
  await page.getByText(/Refinement paused: Some regions need another pass: content/).waitFor({ timeout: 15000 });
  assert.equal(calls.filter(stage => stage === 'reconcile').length, 1);
  assert.equal(calls.includes('analyze'), false);
  assert.equal(await page.locator('.pg-pipeline').count(), 0);
  await frame.getByText('sidebar ready', { exact: true }).waitFor();
  await frame.getByText('footer ready', { exact: true }).waitFor();
  assert.match(await frame.locator('[data-spec-id="content"]').getAttribute('data-pg-region'), /Needs another pass/);
  assert.equal(await frame.locator('[data-pg-refining]').count(), 0);
  const saved = await page.evaluate(() => sessionStorage.getItem('pg-current-spec'));
  assert.ok(JSON.parse(saved).elements['header-text']);
  assert.ok(JSON.parse(saved).elements['sidebar-text']);
  assert.doesNotMatch(saved, /data-pg-region|Needs another pass|refinement/);
  const download = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await download).path(), 'utf8');
  const exported = await page.context().newPage();
  await exported.setContent(html);
  assert.equal(await exported.locator('[data-pg-region]').count(), 0);
  assert.equal(await exported.locator('.pg-region-skeleton').count(), 0);
  await exported.close();
});
