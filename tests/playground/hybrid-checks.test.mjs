import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { chromium } from 'playwright';

const { probe } = createRequire(import.meta.url)('../../playground-hybrid-checks.js');
const source = await readFile(new URL('../../playground-hybrid-checks.js', import.meta.url), 'utf8');
const rendererSource = await readFile(new URL('../../daub-render.js', import.meta.url), 'utf8');
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : { channel: 'chrome' }) });
});
after(async () => { await browser?.close(); });

async function fixture(t, html, width = 800) {
  const page = await browser.newPage({ viewport: { width, height: 600 } });
  t.after(() => page.close());
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><style>body{margin:0}</style><main id="root" data-spec-id="root">' + html + '</main>');
  await page.addScriptTag({ content: 'window.probe = (' + probe.toString() + ');' });
  await page.evaluate(() => {
    window.messages = [];
    window.postMessage = (message, origin) => window.messages.push({ message, origin });
    window.__pgRuntimeErrors = [];
    window.addEventListener('error', event => window.__pgRuntimeErrors.push(event.message));
  });
  return page;
}

const requirement = targetId => ({ id: 'needs-' + targetId, targetId, text: 'Require ' + targetId });
const step = (action, targetId, value) => ({ action, targetId, ...(value === undefined ? {} : { value }) });
const journey = steps => ({ id: 'flow', steps });
async function run(page, options = {}) {
  return page.evaluate(request => window.probe(document.getElementById('root'), request, 'https://parent.example'), {
    requestId: 'probe-1', requirements: [], journey: null, ...options,
  });
}
function journeyPass(evidence, expected) {
  assert.deepEqual(evidence.checks.find(check => check.id === 'journey:flow'), { id: 'journey:flow', pass: expected });
  assert.equal(evidence.defects.some(defect => defect.kind === 'behavior'), !expected);
}

test('UMD exports a standalone async function to CommonJS and browser globals', () => {
  assert.equal(typeof probe, 'function');
  assert.equal(probe.constructor.name, 'AsyncFunction');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.equal(typeof context.DaubHybridChecks.probe, 'function');
  assert.equal(context.DaubHybridChecks.probe.toString(), probe.toString());
});

test('conditional regions use checkpoint visibility instead of global completion visibility', async t => {
  const page = await fixture(t, '<button data-spec-id="save">Save</button><p data-spec-id="error" hidden>Invalid email</p><p data-spec-id="success" hidden>Saved</p>');
  await page.evaluate(() => document.querySelector('button').onclick = () => { document.querySelector('[data-spec-id="success"]').hidden = false; });
  const evidence = await run(page, { requirements: ['error', 'success'].map(id => ({ ...requirement(id), when: 'present' })), journey: journey([
    step('assertHidden', 'error'), step('assertHidden', 'success'), step('click', 'save'), step('assertVisible', 'success'), step('assertHidden', 'error'),
  ]) });
  journeyPass(evidence, true);
  assert.deepEqual(evidence.defects, []);
});

test('clicking a multi-button wrapper needs a unique label', async t => {
  const page = await fixture(t, '<div data-spec-id="billing"><button>Monthly</button><button>Annual</button></div><p data-spec-id="price">$10</p>');
  await page.evaluate(() => document.querySelectorAll('button')[1].onclick = () => { document.querySelector('p').textContent = '$100'; });
  const ambiguous = await run(page, { journey: journey([step('click', 'billing'), step('assertText', 'price', '$10')]) });
  journeyPass(ambiguous, false);
  assert.match(ambiguous.defects[0].message, /ambiguous click/);
  const named = await run(page, { journey: journey([step('click', 'billing', 'Annual'), step('assertText', 'price', '$100')]) });
  journeyPass(named, true);
});

test('checkbox lists support unique labels without treating numbers as row indexes', async t => {
  const page = await fixture(t, '<div data-spec-id="tasks"><label><input type="checkbox" value="alpha">Alpha</label><label><input type="checkbox" value="beta">Beta</label></div>');
  const evidence = await run(page, { journey: journey([step('remember', 'tasks'), step('check', 'tasks', 'Beta'), step('assertChanged', 'tasks')]) });
  journeyPass(evidence, true);
  assert.deepEqual(await page.locator('input').evaluateAll(inputs => inputs.map(input => input.checked)), [false, true]);
});

test('hidden text cannot satisfy a visible result assertion', async t => {
  const page = await fixture(t, '<p data-spec-id="result" hidden>Success</p>');
  journeyPass(await run(page, { journey: journey([step('assertText', 'result', 'Success')]) }), false);
});

test('a hidden attribute cannot hide a CSS-visible validation alert from the probe', async t => {
  const page = await fixture(t, '<style>.notice{display:flex}</style><div data-spec-id="error" class="notice" hidden>Invalid email</div>');
  const evidence = await run(page, { journey: journey([step('assertHidden', 'error')]) });
  journeyPass(evidence, false);
  assert.match(evidence.defects[0].message, /Expected hidden target/);
});

test('serialized probe posts the returned evidence, includes root geometry, and leaves optional hidden content alone', async t => {
  const page = await fixture(t, '<h1 data-spec-id="title">Cart</h1><div data-spec-id="later" hidden>Checkout</div>');
  const evidence = await run(page, { requirements: [requirement('root'), requirement('title')] });
  assert.equal(evidence.complete, true);
  assert.deepEqual(evidence.defects, []);
  assert.deepEqual(evidence.checks, [{ id: 'requirement:needs-root', pass: true }, { id: 'requirement:needs-title', pass: true }]);
  assert.deepEqual(evidence.geometry.viewport, { width: 800, height: 600 });
  const title = evidence.geometry.elements.find(element => element.id === 'title');
  assert.equal(title.parentId, 'root');
  assert.equal(title.text, 'Cart');
  assert.ok(title.bounds.width > 0 && title.bounds.height > 0);
  assert.equal(title.layout.display, 'block');
  assert.equal(evidence.text, 'Cart');
  assert.equal(evidence.screenshot, null);
  assert.deepEqual(await page.evaluate(() => window.messages), [{
    origin: 'https://parent.example', message: { type: 'hybrid-probe-result', requestId: 'probe-1', evidence },
  }]);
});

test('hybrid-probe message can invoke the serialized function in an isolated iframe', async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.setContent('<!doctype html><iframe sandbox="allow-scripts"></iframe>');
  const result = await page.evaluate(async serialized => {
    const frame = document.querySelector('iframe');
    const message = new Promise(resolve => window.addEventListener('message', function listener(event) {
      if (event.source !== frame.contentWindow || event.data.type !== 'hybrid-probe-result') return;
      window.removeEventListener('message', listener);
      resolve(event.data);
    }));
    const ready = new Promise(resolve => frame.onload = resolve);
    frame.srcdoc = '<main data-spec-id="page">Hello</main><script>const probe = (' + serialized + '); addEventListener("message", event => { if(event.data.type === "hybrid-probe") probe(document.querySelector("main"), event.data, "*"); });<\/script>';
    await ready;
    frame.contentWindow.postMessage({ type: 'hybrid-probe', requestId: 42, requirements: [{ id: 'hello', targetId: 'page', text: 'Page' }], journey: null }, '*');
    return message;
  }, probe.toString());
  assert.equal(result.requestId, 42);
  assert.equal(result.evidence.complete, true);
  assert.deepEqual(result.evidence.checks, [{ id: 'requirement:hello', pass: true }]);
});

test('required targets must exist and be visible initially; IDs do not become selectors', async t => {
  const page = await fixture(t, '<div hidden><span data-spec-id="hidden">Hidden</span></div><div style="opacity:0"><span data-spec-id="transparent">Transparent</span></div><details><summary>More</summary><p data-spec-id="closed">Closed</p></details><span data-spec-id="punctuation">Visible</span><div data-spec-id="contents" style="display:contents"><b>Contents</b></div>');
  const oddId = 'quote"[bad]\\';
  await page.evaluate(id => document.querySelector('[data-spec-id="punctuation"]').setAttribute('data-spec-id', id), oddId);
  const ids = ['hidden', 'transparent', 'closed', 'missing', oddId, 'contents'];
  const evidence = await run(page, { requirements: ids.map(requirement) });
  assert.deepEqual(evidence.checks.map(check => check.pass), [false, false, false, false, true, true]);
  assert.equal(evidence.defects.filter(defect => defect.kind === 'hidden-target').length, 3);
  assert.equal(evidence.defects.find(defect => defect.kind === 'missing-target').targetId, 'missing');
});

test('finds overflow, duplicate IDs, broken images, render failures, and runtime errors with deterministic identities', async t => {
  const page = await fixture(t, '<div data-spec-id="wide" style="width:1000px">Wide</div><div data-spec-id="duplicate">A</div><div data-spec-id="duplicate">B</div><img data-spec-id="photo" src="data:image/png;base64,invalid"><div data-spec-id="render" data-render-error="Unknown component">Error</div>');
  await page.evaluate(() => window.__pgRuntimeErrors.push('Initialization failed'));
  const first = await run(page), second = await run(page);
  assert.equal(first.complete, true);
  assert.deepEqual(first.defects.map(defect => defect.kind).sort(), ['broken-image', 'duplicate-id', 'horizontal-overflow', 'render-error', 'runtime-error']);
  assert.deepEqual(first.defects.map(defect => defect.id), second.defects.map(defect => defect.id));
  assert.match(first.defects.find(defect => defect.kind === 'runtime-error').message, /Initialization failed/);
  for (const defect of first.defects) assert.deepEqual(JSON.parse(defect.id), [800, defect.kind, defect.targetId]);
  await page.setViewportSize({ width: 375, height: 600 });
  const mobile = await run(page);
  for (const defect of mobile.defects) assert.deepEqual(JSON.parse(defect.id), [375, defect.kind, defect.targetId]);
});

test('ignores contained scrolling, intentional overlays, and 1px document overflow', async t => {
  const page = await fixture(t, '<div style="width:100px;overflow:auto"><div style="width:200px">Scroll</div></div><div data-spec-id="overlay" style="position:absolute;top:0;left:0">Overlay</div><div data-spec-id="wide" style="width:801px">Tolerance</div>');
  assert.deepEqual((await run(page)).defects, []);
  await page.evaluate(() => document.querySelector('[data-spec-id="wide"]').style.width = '802px');
  assert.equal((await run(page)).defects[0].kind, 'horizontal-overflow');
});

for (const width of [390, 1200]) {
  test(`clipping checks accept normal wrapping, controls, and below-fold content at ${width}px`, async t => {
    const page = await fixture(t, `<style>h1{font:32px/1.2 sans-serif}button{padding:12px}section{padding:16px}</style>
      <section><h1 data-spec-id="heading">A heading that wraps on narrow screens</h1>
      <button data-spec-id="button">Continue</button><input data-spec-id="input" value="Editable">
      <div style="height:700px"></div><p data-spec-id="later">Below the fold</p></section>`, width);
    assert.deepEqual((await run(page)).defects, []);
  });

  test(`clipping checks find own-box text and ancestor-clipped controls at ${width}px`, async t => {
    const page = await fixture(t, `<h1 data-spec-id="heading" style="margin:0;width:100px;height:18px;overflow:hidden;white-space:nowrap">Clipped heading content</h1>
      <div data-spec-id="label" style="width:65px;overflow:clip;white-space:nowrap"><span>Clipped nested label</span></div>
      <button data-spec-id="own-button" style="display:block;width:65px;overflow:hidden;white-space:nowrap">Continue to checkout</button>
      <div style="width:90px;overflow:hidden"><input data-spec-id="input" style="width:180px" value="Name"></div>
      <div style="height:14px;overflow:hidden"><button data-spec-id="button" style="height:40px">Continue</button></div>`, width);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    const first = await run(page), second = await run(page);
    assert.equal(first.complete, true);
    for (const targetId of ['heading', 'label', 'own-button']) {
      assert.ok(first.defects.some(d => d.kind === 'clipped-text' && d.targetId === targetId), JSON.stringify(first.defects));
    }
    for (const targetId of ['input', 'button']) {
      assert.ok(first.defects.some(d => d.kind === 'clipped-control' && d.targetId === targetId), JSON.stringify(first.defects));
    }
    assert.deepEqual(first.defects.map(d => d.id), second.defects.map(d => d.id));
    for (const d of first.defects) assert.deepEqual(JSON.parse(d.id), [width, d.kind, d.targetId]);
  });

  test(`clipping checks find viewport losses without document overflow at ${width}px`, async t => {
    const page = await fixture(t, `<h1 data-spec-id="left" style="position:relative;left:-35px;white-space:nowrap;width:200px">Heading</h1>
      <input data-spec-id="right" style="position:fixed;right:-60px;top:100px;width:120px">
      <input data-spec-id="bottom" style="position:fixed;bottom:-15px;height:40px">
      <input data-spec-id="offscreen" style="position:fixed;left:-500px;width:100px">`, width);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    const evidence = await run(page);
    assert.deepEqual(evidence.defects.map(d => [d.kind, d.targetId]).sort(), [
      ['clipped-control', 'bottom'], ['clipped-control', 'right'], ['clipped-text', 'left'],
    ]);
  });

  test(`clipping checks respect scroll, ellipsis, clamps, hidden nodes and SVG at ${width}px`, async t => {
    const page = await fixture(t, `<style>.narrow{width:70px;white-space:nowrap;overflow:hidden}</style>
      <div style="width:100px;overflow:auto"><button style="width:240px">Scrollable control</button></div>
      <div style="height:20px;overflow:scroll"><p>Scrollable text</p><input></div>
      <p class="narrow" style="text-overflow:ellipsis"><span>Intentionally shortened text</span></p>
      <p style="width:70px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden">Clamped text across several lines</p>
      <div hidden><p class="narrow">Hidden long text</p></div>
      <div style="visibility:hidden"><button style="width:180px">Hidden</button></div>
      <div style="opacity:0"><p class="narrow">Transparent long text</p></div>
      <details><summary>More</summary><p class="narrow">Closed details text</p></details>
      <span style="position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden">Screen reader text</span>
      <svg width="40" height="20"><text x="-10" y="15">SVG text outside its view box</text></svg>
      <div style="width:50px;overflow:hidden;transform:rotate(5deg)">Transformed text</div>
      <input style="width:50px" value="Native editable text scrolls inside its control">
      <textarea style="width:50px;height:20px">Native textarea scrolling</textarea>`, width);
    assert.deepEqual((await run(page)).defects, []);
  });

  test(`clipping checks handle scroll offsets and escaped positioned descendants at ${width}px`, async t => {
    const page = await fixture(t, `<div id="scroll" style="width:100px;overflow:auto"><div style="width:400px"><button style="margin-left:140px;width:180px">Scrollable action</button></div></div>
      <div style="position:relative;height:60px"><div style="width:40px;overflow:hidden">
        <button style="position:absolute;left:30px;top:10px;width:180px">Escapes intermediate clip</button>
      </div></div>
      <div style="width:50px;overflow:hidden"><button style="position:fixed;right:10px;top:160px">Fixed action</button></div>
      <div style="width:80px;overflow:hidden"><button style="width:82px;height:30px"></button></div>
      <div style="height:0;overflow:hidden"><button>Fully concealed</button></div>
      <div style="height:900px"></div><h1 style="width:50px;overflow:hidden;white-space:nowrap">Below fold clipped text</h1>`, width);
    await page.evaluate(() => document.getElementById('scroll').scrollLeft = 100);
    assert.deepEqual((await run(page)).defects, []);
  });

  test(`clipping checks retain inner failures inside scrolling containers at ${width}px`, async t => {
    const page = await fixture(t, `<div style="width:200px;overflow:auto"><div style="width:400px">
      <h2 data-spec-id="nested" style="margin:0;width:60px;height:16px;white-space:nowrap;overflow:hidden">Clipped inside a scroller</h2>
      </div></div>`, width);
    assert.deepEqual((await run(page)).defects.map(d => [d.kind, d.targetId]), [['clipped-text', 'nested']]);
  });
}

test('waits for fonts and images before reading geometry', async t => {
  const page = await fixture(t, '<img data-spec-id="image"><p data-spec-id="label">Loading</p>');
  await page.evaluate(() => {
    const img = document.querySelector('img');
    Object.defineProperty(img, 'complete', { configurable: true, get: () => window.ready === true });
    Object.defineProperty(img, 'naturalWidth', { get: () => window.ready ? 1 : 0 });
    Object.defineProperty(document.fonts, 'status', { configurable: true, get: () => window.ready ? 'loaded' : 'loading' });
    window.setTimeout(() => {
      window.ready = true;
      document.querySelector('[data-spec-id="label"]').textContent = 'Settled';
    }, 80);
  });
  const evidence = await run(page);
  assert.equal(evidence.complete, true);
  assert.deepEqual(evidence.defects, []);
  assert.match(evidence.text, /Settled/);
});

test('bounds resource settling to 1000ms and marks unfinished images and fonts unverified', async t => {
  const page = await fixture(t, '<img data-spec-id="pending">');
  await page.evaluate(() => {
    Object.defineProperty(document.querySelector('img'), 'complete', { get: () => false });
    Object.defineProperty(document.fonts, 'status', { get: () => 'loading' });
  });
  const started = Date.now();
  const evidence = await run(page);
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 950 && elapsed < 2500, 'Settle duration: ' + elapsed);
  assert.equal(evidence.complete, false);
  assert.deepEqual(evidence.defects.map(defect => defect.kind).sort(), ['unsettled-fonts', 'unsettled-image']);
});

test('runs fill, select, hidden input check, count, remember, and changed assertions in order', async t => {
  const page = await fixture(t, '<div data-spec-id="name"><input value="old"></div><select data-spec-id="size"><option value="s">Small</option><option value="l">Large</option></select><label data-spec-id="toggle">Enabled<input hidden type="checkbox"></label><div data-spec-id="count"><input><input></div><p data-spec-id="status">Start</p>');
  await page.evaluate(() => {
    window.events = [];
    for (const type of ['input', 'change']) document.querySelector('main').addEventListener(type, event => window.events.push([type, event.target.tagName]));
    document.querySelector('[type="checkbox"]').addEventListener('click', event => document.querySelector('[data-spec-id="status"]').textContent = event.target.checked ? 'Enabled' : 'Disabled');
  });
  const evidence = await run(page, { journey: journey([
    step('remember', 'name'), step('fill', 'name', 'Ada'), step('assertValue', 'name', 'Ada'), step('assertChanged', 'name'),
    step('select', 'size', 'l'), step('assertValue', 'size', 'l'),
    step('remember', 'toggle'), step('check', 'toggle', true), step('assertChanged', 'toggle'), step('assertText', 'status', 'Enabled'),
    step('check', 'toggle', false), step('assertText', 'status', 'Disabled'), step('assertCount', 'count', 2),
  ]) });
  journeyPass(evidence, true);
  assert.deepEqual(evidence.defects, []);
  assert.deepEqual(await page.evaluate(() => window.events), [
    ['input', 'INPUT'], ['change', 'INPUT'], ['input', 'SELECT'], ['change', 'SELECT'],
    ['input', 'INPUT'], ['change', 'INPUT'], ['input', 'INPUT'], ['change', 'INPUT'],
  ]);
});

test('string checks select native RadioGroup values and the first input, and toggle hidden checkboxes', async t => {
  const page = await fixture(t, '<label data-spec-id="toggle"><input hidden type="checkbox">Enabled</label><p data-spec-id="status">Start</p>');
  await page.addScriptTag({ content: rendererSource });
  await page.evaluate(() => {
    document.querySelector('main').appendChild(renderElement({ choices: { type: 'RadioGroup', props: {
      options: [{ label: 'First', value: 'a' }, { label: 'Second', value: 'b' }, { label: 'False option', value: 'false' }],
    } } }, 'choices', 0));
    window.events = [];
    document.querySelector('main').addEventListener('change', event => {
      window.events.push([event.target.type, event.target.value, event.target.checked]);
      document.querySelector('p').textContent = event.target.type === 'radio' ? event.target.value : String(event.target.checked);
    });
  });
  const evidence = await run(page, { journey: journey([
    step('check', 'choices', 'b'), step('assertText', 'status', 'b'),
    step('check', 'choices', ''), step('assertText', 'status', 'a'),
    step('check', 'choices', 'false'), step('assertText', 'status', 'false'),
    step('check', 'toggle', 'true'), step('assertText', 'status', 'true'),
    step('check', 'toggle', 'false'), step('assertText', 'status', 'false'),
    step('check', 'toggle', ''), step('assertText', 'status', 'true'),
  ]) });
  t.diagnostic(JSON.stringify(evidence.defects));
  journeyPass(evidence, true);
  assert.deepEqual(await page.evaluate(() => window.events), [
    ['radio', 'b', true], ['radio', 'a', true], ['radio', 'false', true],
    ['checkbox', 'on', true], ['checkbox', 'on', false], ['checkbox', 'on', true],
  ]);
});

test('radio checks select numeric native values through visible labels', async t => {
  const page = await fixture(t, '<p data-spec-id="status">Start</p>');
  await page.addScriptTag({ content: rendererSource });
  await page.evaluate(() => {
    document.querySelector('main').appendChild(renderElement({ choices: { type: 'RadioGroup', props: {
      options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'].map((label, index) => ({ label, value: String(index + 1) })),
    } } }, 'choices', 0));
    document.querySelector('main').addEventListener('change', event => document.querySelector('p').textContent = event.target.value);
  });
  const evidence = await run(page, { journey: journey([step('check', 'choices', 'Agree'), step('assertText', 'status', '4')]) });
  t.diagnostic(JSON.stringify(evidence.defects));
  journeyPass(evidence, true);
  assert.equal(await page.locator('input:checked').inputValue(), '4');
});

for (const [name, html, expected] of [
  ['exact value over duplicate labels', '<label><input type="radio" name="choice" value="Agree">Other</label><label><input type="radio" name="choice" value="4">Agree</label><label><input type="radio" name="choice" value="5">Agree</label>', 'Agree'],
  ['trimmed external label', '<input id="agree" type="radio" name="choice" value="4"><label for="agree">  Agree  </label>', '4'],
  ['visible label over hidden duplicate', '<label hidden><input type="radio" name="choice" value="3">Agree</label><label><input type="radio" name="choice" value="4">Agree</label>', '4'],
  ['duplicate exact values despite unique label', '<label><input type="radio" name="choice" value="Agree">Other</label><label><input type="radio" name="choice" value="Agree">Agree</label>', null],
  ['duplicate visible labels', '<label><input type="radio" name="choice" value="4">Agree</label><label><input type="radio" name="choice" value="5">Agree</label>', null],
  ['hidden label only', '<label hidden><input type="radio" name="choice" value="4">Agree</label>', null],
]) test('radio label lookup: ' + name, async t => {
  const page = await fixture(t, '<div data-spec-id="choices">' + html + '</div><p data-spec-id="status">Start</p>');
  await page.evaluate(() => document.querySelector('main').addEventListener('change', event => document.querySelector('p').textContent = event.target.value));
  const evidence = await run(page, { journey: journey([
    step('check', 'choices', 'Agree'), step('assertText', 'status', expected || 'Start'),
  ]) });
  t.diagnostic(JSON.stringify(evidence.defects));
  journeyPass(evidence, expected !== null);
  if (expected === null) {
    assert.match(evidence.defects.find(defect => defect.kind === 'behavior').message, /Missing or ambiguous radio option: Agree/);
    assert.equal(await page.locator('input:checked').count(), 0);
  } else assert.equal(await page.locator('input:checked').inputValue(), expected);
});

test('indexed List clicks select native rows using zero-based integer strings', async t => {
  const page = await fixture(t, '<p data-spec-id="status">Start</p>');
  await page.addScriptTag({ content: rendererSource });
  await page.evaluate(() => {
    const list = renderElement({ inbox: { type: 'List', props: { items: ['First', 'Second'] } } }, 'inbox', 0);
    document.querySelector('main').appendChild(list);
    window.clickedRows = [];
    list.addEventListener('click', event => {
      const row = event.target.closest('.db-list__item');
      if (!row) return;
      window.clickedRows.push(event.target.className);
      document.querySelector('p').textContent = row.querySelector('.db-list__title').textContent;
    });
  });
  const evidence = await run(page, { journey: journey([
    step('click', 'inbox', '1'), step('assertText', 'status', 'Second'),
    step('click', 'inbox', '0'), step('assertText', 'status', 'First'),
  ]) });
  t.diagnostic(JSON.stringify(evidence.defects));
  journeyPass(evidence, true);
  assert.deepEqual(await page.evaluate(() => window.clickedRows), ['db-list__item', 'db-list__item']);
});

test('click resolves native child buttons; remembers text and refreshes targets after rerender', async t => {
  const page = await fixture(t, '<div data-spec-id="next"><button>Next</button></div><p data-spec-id="question">Question 1</p>');
  await page.evaluate(() => document.querySelector('button').addEventListener('click', () => {
    const question = document.querySelector('[data-spec-id="question"]');
    const next = question.cloneNode(); next.textContent = 'Question 2'; question.replaceWith(next);
  }));
  const evidence = await run(page, { requirements: [requirement('question')], journey: journey([
    step('remember', 'question'), step('click', 'next'), step('assertChanged', 'question'), step('assertText', 'question', 'Question 2'),
  ]) });
  journeyPass(evidence, true);
  assert.equal(evidence.geometry.elements.find(element => element.id === 'question').text, 'Question 2');
});

test('clicking a NumberField wrapper targets its input instead of a disabled decrement button', async t => {
  const page = await fixture(t, '<div data-spec-id="quantity"><div class="db-number-field"><button disabled>-</button><input class="db-input" type="number" min="1" value="1"><button>+</button></div></div><p data-spec-id="total">$10.00</p>');
  await page.evaluate(() => document.querySelector('input').addEventListener('input', event => {
    document.querySelector('p').textContent = '$' + (Number(event.target.value) * 10).toFixed(2);
  }));
  const evidence = await run(page, { journey: journey([
    step('click', 'quantity', ''), step('fill', 'quantity', '2'), step('assertValue', 'quantity', '2'), step('assertText', 'total', '$20.00'),
  ]) });
  journeyPass(evidence, true);
});

test('captures fresh geometry and defects after behavior while retaining initial requirement checks', async t => {
  const page = await fixture(t, '<button data-spec-id="grow">Grow</button><div data-spec-id="panel" style="width:100px">Small</div>');
  await page.evaluate(() => document.querySelector('button').onclick = () => {
    document.querySelector('[data-spec-id="panel"]').style.width = '1200px';
    document.querySelector('[data-spec-id="panel"]').textContent = 'Large';
    window.__pgRuntimeErrors.push('After interaction');
  });
  const evidence = await run(page, { requirements: [requirement('panel')], journey: journey([step('click', 'grow'), step('assertText', 'panel', 'Large')]) });
  journeyPass(evidence, true);
  assert.equal(evidence.geometry.elements.find(element => element.id === 'panel').bounds.width, 1200);
  assert.deepEqual(evidence.defects.map(defect => defect.kind), ['horizontal-overflow', 'runtime-error']);
  assert.equal(evidence.checks[0].pass, true);
});

test('a journey cannot repair an initially absent requirement into a passing initial check', async t => {
  const page = await fixture(t, '<button data-spec-id="show">Show</button><p data-spec-id="panel" hidden>Details</p>');
  await page.evaluate(() => document.querySelector('button').onclick = () => document.querySelector('p').hidden = false);
  const evidence = await run(page, { requirements: [requirement('panel')], journey: journey([step('click', 'show'), step('assertText', 'panel', 'Details')]) });
  assert.equal(evidence.checks[0].pass, false);
  assert.equal(evidence.geometry.elements.find(element => element.id === 'panel').visible, true);
  journeyPass(evidence, true);
});

async function questionnaire(t, { count = 10, completed = true, reveal = true, api = 'controller' } = {}) {
  const page = await fixture(t, '<p data-spec-id="question">Question 1</p><input data-spec-id="answer"><button data-spec-id="next">Next</button><pre data-spec-id="final" hidden>Results</pre>');
  await page.evaluate(({ count, completed, reveal, api }) => {
    const root = document.querySelector('main');
    const answers = [];
    let output = null;
    document.querySelector('button').onclick = () => {
      answers.push(document.querySelector('input').value);
      document.querySelector('p').textContent = 'Question ' + (answers.length + 1);
      if (answers.length === 10) {
        output = { answers: answers.slice(0, count), completed };
        document.querySelector('pre').hidden = !reveal;
      }
    };
    if (api === 'controller') root.__daubBehaviorController = { getOutput: () => output };
    if (api === 'public') window.DaubPrototype = { getOutput: () => output };
  }, { count, completed, reveal, api });
  return page;
}
const finalRequirement = { ...requirement('final'), when: 'complete' };
const outputAssertions = [
  { path: 'answers', operator: 'length', value: '10' },
  { path: 'completed', operator: 'equals', value: 'true' },
];
const questionnaireJourney = () => ({
  ...journey(Array.from({ length: 10 }, (_, index) => [step('fill', 'answer', String(index + 1)), step('click', 'next')]).flat()),
  complete: true,
  outputAssertions,
});

test('completion requirements allow a hidden final panel on initial and partial probes', async t => {
  const page = await questionnaire(t);
  for (const flow of [null, journey([step('assertText', 'question', 'Question 1')]), { ...journey([step('assertText', 'question', 'Question 1')]), complete: false }]) {
    const evidence = await run(page, { requirements: [requirement('question'), finalRequirement], journey: flow });
    assert.deepEqual(evidence.defects, []);
    assert.deepEqual(evidence.checks.filter(check => check.id.startsWith('requirement:')), [{ id: 'requirement:needs-question', pass: true }]);
    assert.equal(evidence.geometry.elements.find(element => element.id === 'final').visible, false);
  }
});

for (const api of ['controller', 'public']) test('completes ten questions and checks final output via ' + api, async t => {
  const page = await questionnaire(t, { api });
  const evidence = await run(page, { requirements: [requirement('question'), finalRequirement], journey: questionnaireJourney() });
  journeyPass(evidence, true);
  assert.deepEqual(evidence.defects, []);
  assert.deepEqual(evidence.checks.filter(check => check.id.startsWith('requirement:')), [
    { id: 'requirement:needs-question', pass: true }, { id: 'requirement:needs-final:complete', pass: true },
  ]);
  assert.equal(evidence.geometry.elements.find(element => element.id === 'final').visible, true);
});

for (const [name, options, message] of [
  ['incorrect count', { count: 9 }, /answers/],
  ['incomplete output', { completed: false }, /completed/],
  ['missing API', { api: 'missing' }, /output.*API/i],
  ['hidden final panel', { reveal: false }, /completion|complete/i],
]) test('completion journey fails on ' + name, async t => {
  const page = await questionnaire(t, options);
  const evidence = await run(page, { requirements: [finalRequirement], journey: questionnaireJourney() });
  journeyPass(evidence, false);
  assert.match(evidence.defects.find(defect => defect.kind === 'behavior').message, message);
  assert.deepEqual(evidence.checks.find(check => check.id === 'requirement:needs-final:complete'), {
    id: 'requirement:needs-final:complete', pass: options.reveal !== false,
  });
});

test('explicit initial requirements keep legacy IDs and completion checks cannot repair them', async t => {
  const page = await questionnaire(t);
  const evidence = await run(page, { requirements: [{ ...finalRequirement, when: 'initial' }], journey: questionnaireJourney() });
  assert.deepEqual(evidence.checks[0], { id: 'requirement:needs-final', pass: false });
  assert.equal(evidence.defects[0].kind, 'hidden-target');
  journeyPass(evidence, true);
});

test('checks output after partial journeys and retains the 40-step limit', async t => {
  const page = await fixture(t, '<p data-spec-id="status">Ready</p>');
  await page.evaluate(() => window.DaubPrototype = { getOutput: () => ({ result: { label: 'done', values: [1, null, true] } }) });
  const flow = {
    ...journey(Array.from({ length: 40 }, () => step('assertText', 'status', 'Ready'))),
    outputAssertions: [
      { path: 'result', operator: 'equals', value: '{"values":[1,null,true],"label":"done"}' },
      { path: 'result.values.2', operator: 'equals', value: 'true' },
      { path: 'result.label', operator: 'length', value: '4' },
    ],
  };
  journeyPass(await run(page, { journey: flow }), true);
  journeyPass(await run(page, { journey: { ...flow, steps: [...flow.steps, step('assertText', 'status', 'Ready')] } }), false);
  journeyPass(await run(page, { journey: { ...flow, outputAssertions: [{ path: 'result.values.2', operator: 'equals', value: '"true"' }] } }), false);
});

test('prefers the root controller output API and preserves its receiver', async t => {
  const page = await fixture(t, '<p data-spec-id="status">Ready</p>');
  await page.evaluate(() => {
    document.querySelector('main').__daubBehaviorController = { output: { completed: true }, getOutput() { return this.output; } };
    window.DaubPrototype = { getOutput() { throw new Error('Wrong API'); } };
  });
  journeyPass(await run(page, { journey: {
    ...journey([step('assertText', 'status', 'Ready')]), outputAssertions: [outputAssertions[1]],
  } }), true);
});

test('accepts eight output assertions and distinguishes null, missing, and length-like objects', async t => {
  const page = await fixture(t, '<p data-spec-id="status">Ready</p>');
  await page.evaluate(() => window.DaubPrototype = { getOutput: () => ({ value: null, answers: { length: 10 } }) });
  const flow = journey([step('assertText', 'status', 'Ready')]);
  journeyPass(await run(page, { journey: { ...flow, outputAssertions: Array(8).fill({ path: 'value', operator: 'equals', value: 'null' }) } }), true);
  journeyPass(await run(page, { journey: { ...flow, outputAssertions: [outputAssertions[0]] } }), false);
  journeyPass(await run(page, { journey: { ...flow, outputAssertions: [] } }), true);
});

test('completion requirements keep their check IDs after a failed journey step', async t => {
  const page = await questionnaire(t);
  const evidence = await run(page, { requirements: [finalRequirement], journey: {
    ...journey([step('assertText', 'question', 'Wrong question')]), complete: true,
  } });
  journeyPass(evidence, false);
  assert.deepEqual(evidence.checks.find(check => check.id === 'requirement:needs-final:complete'), {
    id: 'requirement:needs-final:complete', pass: false,
  });
});

test('rejects malformed output without coercion or executing accessors', async t => {
  const page = await fixture(t, '<p data-spec-id="status">Ready</p>');
  for (const kind of ['null', 'undefined', 'string', 'function', 'nonfinite', 'cycle', 'getter', 'hidden', 'symbol', 'sparse', 'throw', 'promise']) {
    await page.evaluate(kind => {
      window.executed = false;
      window.DaubPrototype = { getOutput() {
        if (kind === 'null') return null;
        if (kind === 'undefined') return undefined;
        if (kind === 'string') return '{"completed":true}';
        if (kind === 'throw') throw new Error('Output unavailable');
        if (kind === 'promise') return Promise.resolve({ completed: true });
        const output = { completed: true };
        if (kind === 'function') output.other = () => {};
        if (kind === 'nonfinite') output.other = NaN;
        if (kind === 'cycle') output.other = output;
        if (kind === 'getter') Object.defineProperty(output, 'other', { enumerable: true, get() { window.executed = true; return 1; } });
        if (kind === 'hidden') Object.defineProperty(output, 'other', { value: true });
        if (kind === 'symbol') output[Symbol('other')] = true;
        if (kind === 'sparse') { output.other = new Array(1); output.other.extra = true; }
        return output;
      } };
    }, kind);
    const evidence = await run(page, { journey: {
      ...journey([step('assertText', 'status', 'Ready')]), outputAssertions: [outputAssertions[1]],
    } });
    journeyPass(evidence, false);
    assert.equal(await page.evaluate(() => window.executed), false, kind);
  }
});

test('output paths traverse own properties and reject prototype keys before steps', async t => {
  const page = await fixture(t, '<button data-spec-id="button">Press</button>');
  await page.evaluate(() => {
    window.executed = false;
    document.querySelector('button').onclick = () => window.executed = true;
    window.DaubPrototype = { getOutput: () => ({ result: { completed: true } }) };
  });
  for (const path of ['__proto__', 'result.__proto__.polluted', 'constructor', 'result.constructor.name', 'result.prototype', 'result..completed', '.result', 'result.']) {
    const evidence = await run(page, { journey: {
      ...journey([step('click', 'button'), step('assertText', 'button', 'Press')]),
      outputAssertions: [{ path, operator: 'equals', value: 'true' }],
    } });
    journeyPass(evidence, false);
    assert.equal(await page.evaluate(() => window.executed), false, path);
  }
  for (const path of ['result.toString', 'result.missing', 'result.completed.valueOf']) {
    journeyPass(await run(page, { journey: {
      ...journey([step('assertText', 'button', 'Press')]), outputAssertions: [{ path, operator: 'equals', value: 'null' }],
    } }), false);
  }
});

test('validates completion flags and output assertions before running steps', async t => {
  const page = await fixture(t, '<button data-spec-id="button">Press</button>');
  await page.evaluate(() => {
    window.executed = false;
    document.querySelector('button').onclick = () => window.executed = true;
  });
  const valid = { path: 'answers', operator: 'length', value: '10' };
  for (const fields of [
    { complete: 'true' }, { complete: null }, { outputAssertions: null }, { outputAssertions: {} },
    { outputAssertions: Array(9).fill(valid) }, { outputAssertions: [null] },
    ...[{ path: '' }, { path: 1 }, { operator: 'eval' }, { value: 10 }, { value: 'NaN' }, { value: '1e999' }, { value: '"10"' }, { value: '-1' }, { value: '1.5' }].map(overrides => ({ outputAssertions: [{ ...valid, ...overrides }] })),
  ]) {
    journeyPass(await run(page, { journey: { ...journey([step('click', 'button'), step('assertText', 'button', 'Press')]), ...fields } }), false);
    assert.equal(await page.evaluate(() => window.executed), false);
  }
});

const invalidJourneys = [
  ['no assertion', journey([step('click', 'button')])],
  ['unknown action', journey([step('eval', 'button', 'window.executed=true'), step('assertText', 'button', 'Press')])],
  ['missing target', journey([step('assertText', 'missing', 'Press')])],
  ['false text assertion', journey([step('assertText', 'button', 'Absent')])],
  ['empty text assertion', journey([step('assertText', 'button', '')])],
  ['changed without memory', journey([step('assertChanged', 'button')])],
  ['unchanged target', journey([step('remember', 'button'), step('assertChanged', 'button')])],
  ['wrong memory target', journey([step('remember', 'root'), step('assertChanged', 'button')])],
  ['exact value mismatch', journey([step('assertValue', 'input', 'pre')])],
  ['ambiguous control', journey([step('assertValue', 'many', '')])],
  ['non-wrapper count', journey([step('assertCount', 'input', 0)])],
  ['wrong count', journey([step('assertCount', 'many', 3)])],
  ['fractional count', journey([step('assertCount', 'many', 1.5)])],
  ['negative count', journey([step('assertCount', 'many', -1)])],
  ['string count', journey([step('assertCount', 'many', '2')])],
  ['40-step limit', journey(Array.from({ length: 41 }, () => step('assertText', 'button', 'Press')))],
  ['long title', { ...journey([step('assertText', 'button', 'Press')]), title: 'x'.repeat(241) }],
  ['long value', journey([step('assertText', 'button', 'x'.repeat(2001))])],
  ['long check value', journey([step('check', 'input', 'x'.repeat(2001)), step('assertText', 'button', 'Press')])],
  ['object check value', journey([step('check', 'input', {}), step('assertText', 'button', 'Press')])],
  ['negative click index', journey([step('click', 'button', '-1'), step('assertText', 'button', 'Press')])],
  ['fractional click index', journey([step('click', 'button', '1.5'), step('assertText', 'button', 'Press')])],
  ['unsafe click index', journey([step('click', 'button', '9007199254740992'), step('assertText', 'button', 'Press')])],
  ['non-integer click index', journey([step('click', 'button', 'first'), step('assertText', 'button', 'Press')])],
];
for (const [name, invalid] of invalidJourneys) test('rejects journey: ' + name, async t => {
  const page = await fixture(t, '<button data-spec-id="button">Press</button><input data-spec-id="input" value="prefix"><div data-spec-id="many"><input><input></div>');
  const evidence = await run(page, { journey: invalid });
  journeyPass(evidence, false);
  assert.equal(await page.evaluate(() => window.executed), undefined);
});

for (const [name, html, action] of [
  ['disabled button', '<button disabled data-spec-id="control">Press</button>', step('click', 'control')],
  ['disabled child button', '<div data-spec-id="control"><button disabled>Press</button></div>', step('click', 'control')],
  ['disabled fieldset', '<fieldset disabled><input data-spec-id="control"></fieldset>', step('fill', 'control', 'x')],
  ['readonly input', '<input data-spec-id="control" readonly>', step('fill', 'control', 'x')],
  ['inert control', '<div inert><button data-spec-id="control">Press</button></div>', step('click', 'control')],
  ['aria-disabled control', '<button aria-disabled="true" data-spec-id="control">Press</button>', step('click', 'control')],
  ['disabled option', '<select data-spec-id="control"><option value="a">A</option><option disabled value="b">B</option></select>', step('select', 'control', 'b')],
  ['disabled optgroup', '<select data-spec-id="control"><option value="a">A</option><optgroup disabled><option value="b">B</option></optgroup></select>', step('select', 'control', 'b')],
  ['missing option', '<select data-spec-id="control"><option value="a">A</option></select>', step('select', 'control', 'b')],
  ['duplicate target', '<button data-spec-id="control">A</button><button data-spec-id="control">B</button>', step('click', 'control')],
  ['missing radio option', '<div data-spec-id="control"><input type="radio" value="a"></div>', step('check', 'control', 'missing')],
  ['duplicate radio option', '<div data-spec-id="control"><input type="radio" value="a"><input type="radio" value="a"></div>', step('check', 'control', 'a')],
  ['disabled radio option', '<div data-spec-id="control"><input type="radio" value="a" disabled></div>', step('check', 'control', 'a')],
  ['disabled first input', '<div data-spec-id="control"><input type="radio" disabled><input type="radio"></div>', step('check', 'control', '')],
  ['missing check input', '<div data-spec-id="control">Empty</div>', step('check', 'control', '')],
  ['unknown checkbox value', '<input data-spec-id="control" type="checkbox">', step('check', 'control', 'yes')],
  ['out-of-range List index', '<div data-spec-id="control"><div class="db-list__item">First</div></div>', step('click', 'control', '1')],
  ['disabled List row', '<div data-spec-id="control"><div class="db-list__item" aria-disabled="true">First</div></div>', step('click', 'control', '0')],
  ['index on non-List control', '<button data-spec-id="control">Press</button>', step('click', 'control', '0')],
]) test('refuses ' + name, async t => {
  const page = await fixture(t, html + '<p data-spec-id="status">Untouched</p>');
  journeyPass(await run(page, { journey: journey([action, step('assertText', 'status', 'Untouched')]) }), false);
});

test('suppresses anchor and form navigation without suppressing local handlers, then restores browser APIs', async t => {
  const page = await fixture(t, '<a data-spec-id="link" href="https://external.example/">Link</a><form action="https://external.example/"><button data-spec-id="submit">Send</button></form><p data-spec-id="status">Start</p>');
  await page.evaluate(() => {
    window.originalFetch = window.fetch;
    document.querySelector('a').onclick = () => document.querySelector('p').textContent = 'Link handled';
    document.querySelector('form').onsubmit = () => document.querySelector('p').textContent = 'Form handled';
  });
  const evidence = await run(page, { journey: journey([
    step('click', 'link'), step('assertText', 'status', 'Link handled'), step('click', 'submit'), step('assertText', 'status', 'Form handled'),
  ]) });
  journeyPass(evidence, true);
  assert.equal(page.url(), 'about:blank');
  assert.equal(await page.evaluate(() => window.fetch === window.originalFetch), true);
});

for (const api of ['fetch', 'xhr', 'beacon', 'open', 'submit', 'socket']) test('blocks external action: ' + api, async t => {
  const page = await fixture(t, '<button data-spec-id="send">Send</button><form></form>');
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.evaluate(api => {
    window.originalFetch = window.fetch;
    document.querySelector('button').onclick = () => {
      try {
        if (api === 'fetch') fetch('https://external.example/');
        if (api === 'xhr') { const xhr = new XMLHttpRequest(); xhr.open('GET', 'https://external.example/'); xhr.send(); }
        if (api === 'beacon') navigator.sendBeacon('https://external.example/', 'data');
        if (api === 'open') window.open('https://external.example/');
        if (api === 'submit') document.querySelector('form').submit();
        if (api === 'socket') new WebSocket('wss://external.example/');
      } catch { /* The probe must record blocked actions even when the controller catches them. */ }
    };
  }, api);
  const evidence = await run(page, { journey: journey([step('click', 'send'), step('assertText', 'send', 'Send')]) });
  journeyPass(evidence, false);
  assert.match(evidence.defects.find(defect => defect.kind === 'behavior').message, /External action blocked/);
  assert.deepEqual(requests, []);
  assert.equal(await page.evaluate(() => window.fetch === window.originalFetch), true);
});

test('rejects malformed requests and bounds requirement IDs, text, and count', async t => {
  const page = await fixture(t, '<p data-spec-id="label">Label</p>');
  for (const options of [
    { requestId: null }, { requirements: {} }, { requirements: [null] },
    { requirements: [{ ...requirement('label'), when: 'later' }] },
    { requirements: [{ ...requirement('label'), when: null }] },
    { requirements: [{ ...requirement('label'), id: 'x'.repeat(161) }] },
    { requirements: [{ ...requirement('label'), targetId: 'x'.repeat(161) }] },
    { requirements: [{ ...requirement('label'), text: 'x'.repeat(2001) }] },
    { requirements: [requirement('label'), requirement('label')] },
    { requirements: Array.from({ length: 101 }, (_, index) => requirement(String(index))) },
  ]) {
    const evidence = await run(page, options);
    assert.equal(evidence.complete, false);
    assert.equal(evidence.defects[0].kind, 'probe-error');
  }
});

test('does not run testJS or treat arbitrary selector text as executable input', async t => {
  const page = await fixture(t, '<p data-spec-id="safe">Safe</p>');
  const evidence = await run(page, { testJS: 'window.executed=true', journey: {
    ...journey([step('assertText', 'safe', 'Safe')]), testJS: 'window.executed=true',
  } });
  journeyPass(evidence, true);
  assert.equal(await page.evaluate(() => window.executed), undefined);
});

const action = { targetId: 'save' };
function actionStatus(evidence, status) {
  assert.equal(evidence.complete, true);
  assert.equal(evidence.actions.length, 1);
  assert.equal(evidence.actions[0].targetId, 'save');
  assert.equal(evidence.actions[0].status, status);
  assert.deepEqual(evidence.checks.filter(check => check.id === 'action:save'),
    status === 'skipped' ? [] : [{ id: 'action:save', pass: status === 'changed' }]);
}

test('action detects ignored saved-cart dispatch without trusting controller state', async t => {
  const page = await fixture(t, '<button data-spec-id="save">Save cart</button><p>Cart empty</p>');
  await page.evaluate(() => {
    const api = document.querySelector('main').__daubBehaviorController = {
      attempts: 0, dispatch() { this.attempts++; }, getOutput() { return { cart: [], saved: false }; },
      getState() { throw new Error('Internal state is not response evidence'); },
    };
    document.querySelector('button').onclick = () => api.dispatch('saveCart');
  });
  const evidence = await run(page, { action });
  actionStatus(evidence, 'unchanged');
  assert.deepEqual(evidence.defects.map(d => [d.kind, d.targetId]), [['behavior-no-effect', 'save']]);
  assert.equal(await page.evaluate(() => document.querySelector('main').__daubBehaviorController.attempts), 1);
});

for (const effect of ['text', 'visibility', 'input', 'checked', 'expanded', 'pressed', 'selected', 'details', 'output', 'public-output']) {
  test('action accepts observable response: ' + effect, async t => {
    const page = await fixture(t, '<button data-spec-id="save">Save</button><p>Ready</p><div hidden>Saved cart</div><input value="old"><input type="checkbox"><details><summary>More</summary>Details</details>');
    await page.evaluate(effect => {
      const button = document.querySelector('button');
      const api = { output: null, getOutput() { return this.output; } };
      if (effect === 'public-output') window.DaubPrototype = api;
      else {
        document.querySelector('main').__daubBehaviorController = api;
        window.DaubPrototype = { getOutput() { throw new Error('Wrong output API'); } };
      }
      window.clicks = 0;
      button.onclick = () => {
        window.clicks++;
        setTimeout(() => {
          if (effect === 'text') document.querySelector('p').textContent = 'Saved';
          if (effect === 'visibility') document.querySelector('div').hidden = false;
          if (effect === 'input') document.querySelector('input').value = 'new';
          if (effect === 'checked') document.querySelector('[type="checkbox"]').checked = true;
          if (['expanded', 'pressed', 'selected'].includes(effect)) button.setAttribute('aria-' + effect, 'true');
          if (effect === 'details') document.querySelector('details').open = true;
          if (effect.endsWith('output')) api.output = { cart: [{ id: 1 }], saved: true };
        }, 10);
      };
    }, effect);
    const evidence = await run(page, { action, requirements: [requirement('save')] });
    actionStatus(evidence, 'changed');
    assert.deepEqual(evidence.defects, []);
    assert.deepEqual(evidence.checks[0], { id: 'requirement:needs-save', pass: true });
    assert.equal(await page.evaluate(() => window.clicks), 1);
  });
}

for (const effect of ['focus', 'disabled', 'aria-disabled', 'style', 'class', 'hidden-text', 'reordered-output', 'rerender']) {
  test('action rejects false response proof: ' + effect, async t => {
    const page = await fixture(t, '<button data-spec-id="save">Save</button><p>Ready</p><input><div hidden>Hidden</div>');
    await page.evaluate(effect => {
      const button = document.querySelector('button');
      let output = { cart: [{ id: 1, count: 2 }], saved: false };
      window.DaubPrototype = { getOutput: () => output };
      button.onclick = () => {
        if (effect === 'focus') document.querySelector('input').focus();
        if (effect === 'disabled') button.disabled = true;
        if (effect === 'aria-disabled') button.setAttribute('aria-disabled', 'true');
        if (effect === 'style') button.style.color = 'red';
        if (effect === 'class') button.className = 'active';
        if (effect === 'hidden-text') document.querySelector('div').textContent = 'Saved';
        if (effect === 'reordered-output') output = { saved: false, cart: [{ count: 2, id: 1 }] };
        if (effect === 'rerender') document.querySelector('p').replaceWith(document.querySelector('p').cloneNode(true));
      };
    }, effect);
    const evidence = await run(page, { action });
    actionStatus(evidence, 'unchanged');
    assert.deepEqual(evidence.defects.map(d => d.kind), ['behavior-no-effect']);
  });
}

for (const [name, html, reason] of [
  ['hidden', '<button hidden data-spec-id="save">Save</button>', /Hidden/],
  ['hidden ancestor', '<div style="display:none"><button data-spec-id="save">Save</button></div>', /Hidden/],
  ['transparent', '<button style="opacity:0" data-spec-id="save">Save</button>', /Hidden/],
  ['closed details', '<details><summary>More</summary><button data-spec-id="save">Save</button></details>', /Hidden/],
  ['disabled', '<button disabled data-spec-id="save">Save</button>', /Disabled/],
  ['fieldset', '<fieldset disabled><button data-spec-id="save">Save</button></fieldset>', /Disabled/],
  ['inert', '<div inert><button data-spec-id="save">Save</button></div>', /inert/],
  ['aria-disabled', '<div aria-disabled="true"><button data-spec-id="save">Save</button></div>', /Disabled/],
  ['reset', '<button type="reset" data-spec-id="save">Save</button>', /Reset/],
  ['selected', '<button aria-selected="true" data-spec-id="save">Save</button>', /selected/],
  ['pressed', '<button aria-pressed="true" data-spec-id="save">Save</button>', /pressed/],
  ['current', '<button aria-current="page" data-spec-id="save">Save</button>', /current/],
  ['wrapper', '<div data-spec-id="save"><button>Save</button></div>', /native button/],
  ['input button', '<input type="button" data-spec-id="save" value="Save">', /native button/],
  ['link', '<a href="https://external.example" data-spec-id="save">Save</a>', /native button/],
  ['nested link', '<a href="https://external.example"><button data-spec-id="save">Save</button></a>', /Navigation/],
  ['download', '<button download data-spec-id="save">Save</button>', /Navigation/],
  ['href', '<button href="https://external.example" data-spec-id="save">Save</button>', /Navigation/],
  ['formaction', '<button formaction="https://external.example" data-spec-id="save">Save</button>', /Navigation/],
  ['external form', '<form action="https://external.example"><button data-spec-id="save">Save</button></form>', /external form/],
  ['trigger', '<button data-db-trigger="dialog" data-spec-id="save">Save</button>', /Native trigger/],
  ['popover', '<button popovertarget="panel" data-spec-id="save">Save</button>', /Native trigger/],
  ['command', '<button commandfor="panel" data-spec-id="save">Save</button>', /Native trigger/],
  ['dropdown', '<button class="db-dropdown__trigger" data-spec-id="save">Save</button>', /Native trigger/],
  ['invalid form', '<form><input required><button data-spec-id="save">Save</button></form>', /Invalid form/],
  ['invalid external control', '<input required form="form"><form id="form"><button data-spec-id="save">Save</button></form>', /Invalid form/],
]) test('action skips ' + name + ' without a passing check or click', async t => {
  const page = await fixture(t, html);
  await page.evaluate(() => {
    window.events = [];
    for (const type of ['click', 'submit', 'invalid']) document.addEventListener(type, () => window.events.push(type), true);
  });
  const evidence = await run(page, { action });
  actionStatus(evidence, 'skipped');
  assert.match(evidence.actions[0].reason, reason);
  assert.deepEqual(evidence.defects, []);
  assert.deepEqual(await page.evaluate(() => window.events), []);
});

test('action recognizes native Button trigger props from the renderer', async t => {
  const page = await fixture(t, '');
  await page.addScriptTag({ content: rendererSource });
  await page.evaluate(() => document.querySelector('main').appendChild(renderElement({
    save: { type: 'Button', props: { label: 'Open', trigger: 'dialog' } },
  }, 'save', 0)));
  const evidence = await run(page, { action });
  actionStatus(evidence, 'skipped');
  assert.match(evidence.actions[0].reason, /Native trigger/);
});

for (const validation of ['', 'novalidate', 'formnovalidate']) test('action runs local submit with ' + (validation || 'valid form'), async t => {
  const page = await fixture(t, `<form ${validation === 'novalidate' ? validation : ''}><input required value="${validation ? '' : 'Ada'}"><button data-spec-id="save" ${validation === 'formnovalidate' ? validation : ''}>Save</button></form><p>Ready</p>`);
  await page.evaluate(() => document.querySelector('form').onsubmit = event => {
    event.preventDefault(); document.querySelector('p').textContent = 'Saved';
  });
  const evidence = await run(page, { action });
  actionStatus(evidence, 'changed');
  assert.deepEqual(evidence.defects, []);
  assert.equal(page.url(), 'about:blank');
});

for (const html of ['', '<button data-spec-id="save">A</button><button data-spec-id="save">B</button>']) {
  test('action refuses missing or ambiguous IDs before clicking: ' + (html ? 'ambiguous' : 'missing'), async t => {
    const page = await fixture(t, html);
    await page.evaluate(() => document.addEventListener('click', () => window.clicked = true));
    const evidence = await run(page, { action });
    actionStatus(evidence, 'unchanged');
    assert.match(evidence.defects.find(d => d.kind === 'behavior').message, /Missing|Ambiguous/);
    assert.equal(await page.evaluate(() => window.clicked), undefined);
  });
}

test('action validates requests before interaction and leaves no-action evidence unchanged', async t => {
  const page = await fixture(t, '<button data-spec-id="save">Save</button>');
  await page.evaluate(() => document.querySelector('button').onclick = () => window.clicked = true);
  for (const options of [
    { action: {} }, { action: [] }, { action: 'save' }, { action: { targetId: '' } },
    { action: { targetId: 'x'.repeat(161) } }, { action: { targetId: 1 } },
    { action, journey: journey([step('assertText', 'save', 'Save')]) },
  ]) {
    const evidence = await run(page, options);
    assert.equal(evidence.complete, false);
    assert.equal(evidence.defects[0].kind, 'probe-error');
    assert.equal(await page.evaluate(() => window.clicked), undefined);
  }
  const baseline = await run(page);
  assert.equal(Object.hasOwn(baseline, 'actions'), false);
  assert.deepEqual(await run(page, { action: null }), baseline);
  const legacy = await run(page, { journey: journey([step('click', 'save'), step('assertText', 'save', 'Save')]) });
  journeyPass(legacy, true);
  assert.equal(Object.hasOwn(legacy, 'actions'), false);
});

for (const api of ['fetch', 'xhr', 'beacon', 'open', 'submit', 'socket', 'eventSource', 'worker', 'sharedWorker', 'writeText', 'write', 'link', 'requestSubmit']) {
  test('action blocks ' + api + ' despite text changes and restores guards', async t => {
    const page = await fixture(t, '<button data-spec-id="save">Save</button><form></form><p>Ready</p>');
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.evaluate(api => {
      const clipboard = { writeText() { window.transaction = true; }, write() { window.transaction = true; } };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
      window.guarded = [
        ...['fetch', 'open', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker'].map(key => [window, key]),
        [navigator, 'sendBeacon'], [XMLHttpRequest.prototype, 'send'], [HTMLFormElement.prototype, 'submit'],
        [clipboard, 'writeText'], [clipboard, 'write'],
      ].map(([object, key]) => [object, key, object[key], Object.getOwnPropertyDescriptor(object, key)]);
      document.querySelector('button').onclick = () => {
        document.querySelector('p').textContent = 'Saved';
        try {
          if (api === 'fetch') fetch('https://external.example/');
          if (api === 'xhr') { const xhr = new XMLHttpRequest(); xhr.open('GET', 'https://external.example/'); xhr.send(); }
          if (api === 'beacon') navigator.sendBeacon('https://external.example/', 'data');
          if (api === 'open') window.open('https://external.example/');
          if (api === 'submit') document.querySelector('form').submit();
          if (api === 'socket') new WebSocket('wss://external.example/');
          if (api === 'eventSource') new EventSource('https://external.example/');
          if (api === 'worker') new Worker('https://external.example/');
          if (api === 'sharedWorker') new SharedWorker('https://external.example/');
          if (api === 'writeText') navigator.clipboard.writeText('text');
          if (api === 'write') navigator.clipboard.write([]);
          if (api === 'link') {
            const link = document.createElement('a'); link.href = 'https://external.example/';
            document.querySelector('main').appendChild(link); link.click();
          }
          if (api === 'requestSubmit') {
            const form = document.querySelector('form'); form.action = 'https://external.example/'; form.requestSubmit();
          }
        } catch { /* Caught failures must still fail the probe. */ }
      };
    }, api);
    const evidence = await run(page, { action });
    actionStatus(evidence, 'unchanged');
    assert.match(evidence.defects.find(d => d.kind === 'behavior' && d.targetId === 'save').message, /External action blocked/);
    assert.equal(await page.evaluate(() => window.transaction), undefined);
    assert.deepEqual(requests, []);
    assert.equal(await page.evaluate(() => window.guarded.every(([object, key, original, descriptor]) =>
      object[key] === original && JSON.stringify(Object.getOwnPropertyDescriptor(object, key)) === JSON.stringify(descriptor))), true);
    assert.equal(await page.evaluate(() => {
      const event = new Event('submit', { bubbles: true, cancelable: true });
      document.querySelector('form').dispatchEvent(event);
      return event.defaultPrevented;
    }), false);
  });
}

test('action fails closed on malformed output without executing accessors and restores APIs', async t => {
  const page = await fixture(t, '<button data-spec-id="save">Save</button>');
  await page.evaluate(() => {
    window.originalFetch = window.fetch;
    const output = {};
    Object.defineProperty(output, 'saved', { enumerable: true, get() { window.executed = true; return true; } });
    window.DaubPrototype = { getOutput: () => output };
    document.querySelector('button').onclick = () => window.clicked = true;
  });
  const evidence = await run(page, { action });
  actionStatus(evidence, 'unchanged');
  assert.match(evidence.defects.find(d => d.kind === 'behavior').message, /Malformed JSON/);
  assert.deepEqual(await page.evaluate(() => [!!window.executed, !!window.clicked, window.fetch === window.originalFetch]), [false, false, true]);
});
