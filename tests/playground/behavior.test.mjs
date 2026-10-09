import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { chromium } from 'playwright';
import behavior from '../../playground-behavior.js';

const source = await readFile(new URL('../../playground-behavior.js', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../../daub-render.js', import.meta.url), 'utf8');
const base = {
  initial: { count: 0 },
  reduce: 'return { count: state.count + action.amount };',
  render: 'ui.text("out", state.count);',
  bind: 'ui.on("button", "click", function() { dispatch({ amount: 1 }); });',
};
let browser, page;

before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => { await browser?.close(); });
beforeEach(async () => {
  page = await browser.newPage();
  page.setDefaultTimeout(3000);
  await page.route('**/*', route => route.abort());
  await page.setContent('<section id="preview"><button data-spec-id="button">Add</button><output data-spec-id="out"></output></section>');
  await page.addScriptTag({ content: source });
});
afterEach(async () => { await page?.close(); });

async function mount(overrides = {}) {
  await page.evaluate(program => {
    window.preview = document.getElementById('preview');
    window.errors = [];
    window.program = program;
    window.controller = DaubBehavior.mount(preview, program, error => errors.push({ phase: error.phase, message: error.message }));
  }, { ...base, ...overrides });
}

test('exports mount and toScript through CommonJS, browser globals, and AMD', () => {
  assert.deepEqual(Object.keys(behavior), ['mount', 'toScript']);
  const browserGlobal = {};
  runInNewContext(source, browserGlobal);
  assert.deepEqual(Object.keys(browserGlobal.DaubBehavior), ['mount', 'toScript']);
  let amd;
  const define = (_dependencies, factory) => { amd = factory(); };
  define.amd = true;
  runInNewContext(source, { define });
  assert.deepEqual(Object.keys(amd), ['mount', 'toScript']);
});

test('clones and freezes state and actions without freezing or mutating caller data', async () => {
  await mount({
    initial: { nested: { values: [1] } },
    reduce: 'window.actionSeen = action; return { nested: { values: state.nested.values.concat(action.values) } };',
    render: 'window.stateSeen = state; ui.text("out", state.nested.values.join(","));',
  });
  const result = await page.evaluate(() => {
    const initialSeen = stateSeen;
    const action = { values: [2] };
    controller.dispatch(action);
    program.initial.nested.values.push(9);
    action.values.push(8);
    const snapshot = controller.getState();
    return {
      original: program.initial, action, state: snapshot,
      frozen: [initialSeen, initialSeen.nested, initialSeen.nested.values, stateSeen, actionSeen, actionSeen.values, snapshot.nested.values].every(Object.isFrozen),
      detached: snapshot !== stateSeen && snapshot.nested !== stateSeen.nested && actionSeen !== action,
      mutableOriginal: !Object.isFrozen(program.initial) && !Object.isFrozen(action.values),
      attached: preview.__daubBehaviorController === controller,
      text: preview.querySelector('output').textContent, errors,
    };
  });
  assert.deepEqual(result, {
    original: { nested: { values: [1, 9] } }, action: { values: [2, 8] }, state: { nested: { values: [1, 2] } },
    frozen: true, detached: true, mutableOriginal: true, attached: true, text: '1,2', errors: [],
  });
});

test('renders initialization and every accepted transition including unchanged state', async () => {
  await mount({ reduce: 'return state;', render: 'ui.preview.draws = (ui.preview.draws || 0) + 1; ui.text("out", state.count);' });
  await page.evaluate(() => { controller.dispatch(null); controller.dispatch({}); });
  assert.equal(await page.evaluate(() => preview.draws), 3);
  assert.deepEqual(await page.evaluate(() => errors), []);
});

test('prototype hidden flags override component display without changing outside elements', async () => {
  await page.addStyleTag({ content: '.notice{display:flex}' });
  await page.evaluate(() => {
    document.getElementById('preview').insertAdjacentHTML('beforeend', '<div class="notice" data-spec-id="notice">Error</div>');
    document.body.insertAdjacentHTML('beforeend', '<div id="outside" class="notice" hidden>Outside</div>');
  });
  await mount({ render: 'ui.get("notice").hidden=state.count===0; ui.text("out",state.count);' });
  assert.equal(await page.locator('[data-spec-id="notice"]').isVisible(), false);
  assert.equal(await page.locator('#outside').isVisible(), true);
  await page.locator('button').click();
  assert.equal(await page.locator('[data-spec-id="notice"]').isVisible(), true);
  await mount({ render: 'ui.get("notice").hidden=true;' });
  assert.equal(await page.locator('[data-spec-id="notice"]').isVisible(), false);
  await page.evaluate(() => controller.dispose());
  assert.equal(await page.locator('[data-spec-id="notice"]').isVisible(), true);
  assert.equal(await page.locator('#preview').getAttribute('class'), '');
});

test('output snapshots detach and freeze nested JSON without exposing or freezing projection data', async () => {
  await mount({ output: 'window.projected = {completed: false, answers: [state.count]}; return projected;' });
  const result = await page.evaluate(() => {
    const first = controller.getOutput(), second = controller.getOutput();
    projected.answers.push(99);
    let blocked = false;
    try { first.answers.push(88); } catch (_) { blocked = true; }
    controller.dispatch({ amount: 1 });
    return {
      first, current: controller.getOutput(), blocked,
      detached: first !== second && first.answers !== second.answers && second.answers !== projected.answers,
      frozen: [first, first.answers, second, second.answers].every(Object.isFrozen),
      callerMutable: !Object.isFrozen(projected) && !Object.isFrozen(projected.answers), errors,
    };
  });
  assert.deepEqual(result, {
    first: { completed: false, answers: [0] }, current: { completed: false, answers: [1] },
    blocked: true, detached: true, frozen: true, callerMutable: true, errors: [],
  });
});

test('programs without output expose null and accept subscriptions without publishing fabricated output', async () => {
  await mount();
  assert.deepEqual(await page.evaluate(() => {
    const values = [];
    const off = DaubPrototype.subscribe(value => values.push(value));
    controller.dispatch({ amount: 1 });
    off(); off();
    return { output: controller.getOutput(), global: DaubPrototype.getOutput(), values, errors };
  }), { output: null, global: null, values: [], errors: [] });
});

test('subscriptions replay initial output, publish accepted transitions, isolate listeners, and unsubscribe', async () => {
  await mount({
    reduce: 'if (action.fail) throw new Error("reject"); return {count: state.count + action.amount};',
    output: 'window.projections = (window.projections || 0) + 1; return {answers:[state.count]};',
  });
  assert.deepEqual(await page.evaluate(() => {
    const first = [], second = [], refs = [];
    const off = controller.subscribe(value => { first.push(value); refs.push(value); });
    controller.subscribe(value => { second.push(value); refs.push(value); });
    controller.dispatch({ amount: 1 });
    controller.dispatch({ amount: 0 });
    controller.dispatch({ fail: true });
    controller.dispatch({ amount: NaN });
    off(); off();
    controller.dispatch({ amount: 1 });
    return {
      first, second, projections,
      detached: refs[0] !== refs[1] && refs[0].answers !== refs[1].answers,
      phases: errors.map(error => error.phase),
    };
  }), {
    first: [{ answers: [0] }, { answers: [1] }, { answers: [1] }],
    second: [{ answers: [0] }, { answers: [1] }, { answers: [1] }, { answers: [2] }],
    projections: 4, detached: true, phases: ['reduce', 'dispatch'],
  });
});

for (const [phase, overrides] of [
  ['render', { render: 'if (state.count === 1) throw new Error("render failed"); ui.text("out", state.count);' }],
  ['render', { render: 'if (state.count === 1) return Promise.resolve(); ui.text("out", state.count);' }],
  ['output', { output: 'if (state.count === 1) throw new Error("output failed"); return {count:state.count};' }],
  ['output', { output: 'if (state.count === 1) return []; return {count:state.count};' }],
  ['output', { output: 'if (state.count === 1) return Promise.resolve({count:99}); return {count:state.count};' }],
]) {
  test(`invalidates output on ${phase} failure and publishes fresh output on recovery: ${JSON.stringify(overrides)}`, async () => {
    await mount({ output: 'return {count:state.count};', ...overrides });
    assert.deepEqual(await page.evaluate(() => {
      const values = [];
      controller.subscribe(value => values.push(value));
      controller.dispatch({ amount: 1 });
      const failed = controller.getOutput(), accepted = controller.getState();
      controller.dispatch({ amount: 1 });
      return { values, failed, accepted, current: DaubPrototype.getOutput(), phases: errors.map(error => error.phase) };
    }), {
      values: [{ count: 0 }, null, { count: 2 }], failed: null, accepted: { count: 1 }, current: { count: 2 }, phases: [phase],
    });
  });
}

test('rejects invalid and asynchronous output without publishing valid output or leaving a global', async () => {
  const results = await page.evaluate(async base => {
    const bodies = [null, 'return (', 'return null;', 'return [];', 'return 3;', 'return "x";',
      'return undefined;', 'return new Date();', 'return {bad:undefined};', 'return {bad:NaN};',
      'return {get bad(){throw new Error("getter executed");}};', 'var a={}; a.self=a; return a;',
      'return Promise.resolve({ok:true});', 'return Promise.reject(new Error("async output"));',
      'state.count++; return {};'];
    const results = [];
    for (const output of bodies) {
      const errors = [];
      const ctrl = DaubBehavior.mount(document.getElementById('preview'), { ...base, output }, error => errors.push({ phase: error.phase, message: error.message }));
      await Promise.resolve();
      results.push({ value: ctrl.getOutput(), global: 'DaubPrototype' in window, attached: '__daubBehaviorController' in document.getElementById('preview'), errors });
    }
    return results;
  }, base);
  assert.equal(results.length, 15);
  for (const result of results) {
    assert.equal(result.value, null);
    assert.equal(result.global, false);
    assert.equal(result.attached, false);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.every(error => error.phase === 'output'));
    assert.ok(result.errors.every(error => !error.message.includes('getter executed')));
  }
});

test('global API is read-only and disposal/remount clears retained output and subscriptions', async () => {
  await mount({ output: 'return {count:state.count};' });
  assert.deepEqual(await page.evaluate(() => {
    const oldAPI = DaubPrototype, values = [];
    oldAPI.subscribe(value => values.push(value));
    const readonly = Object.isFrozen(oldAPI) && Object.getOwnPropertyDescriptor(window, 'DaubPrototype').writable === false;
    const replacement = DaubBehavior.mount(preview, { ...program, initial: { count: 7 } });
    controller.dispose(); controller.dispatch({ amount: 99 });
    oldAPI.subscribe(() => values.push('stale'))();
    const replaced = DaubPrototype !== oldAPI && DaubPrototype.getOutput().count === 7;
    replacement.dispatch({ amount: 1 });
    const stale = oldAPI.getOutput();
    replacement.dispose(); replacement.dispose();
    return { readonly, replaced, stale, values, removed: !('DaubPrototype' in window), output: replacement.getOutput(), errors };
  }), { readonly: true, replaced: true, stale: null, values: [{ count: 0 }], removed: true, output: null, errors: [] });
});

test('global belongs to the preview document and disposing another preview preserves the active API', async () => {
  await mount({ output: 'return {count:state.count};' });
  assert.deepEqual(await page.evaluate(() => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    frame.contentDocument.body.innerHTML = preview.innerHTML;
    const child = DaubBehavior.mount(frame.contentDocument.body, { ...program, initial: { count: 3 } });
    const parentAPI = DaubPrototype;
    const other = preview.cloneNode(true);
    document.body.append(other);
    const second = DaubBehavior.mount(other, { ...program, initial: { count: 5 } });
    controller.dispose();
    const result = { child: frame.contentWindow.DaubPrototype.getOutput(), parent: DaubPrototype.getOutput(), changed: DaubPrototype !== parentAPI };
    child.dispose(); second.dispose();
    return { ...result, removed: !('DaubPrototype' in frame.contentWindow) && !('DaubPrototype' in window) };
  }), { child: { count: 3 }, parent: { count: 5 }, changed: true, removed: true });
});

test('subscriber errors, unsubscribe during notification, and disposal cannot publish stale callbacks', async () => {
  await mount({ output: 'return {count:state.count};' });
  assert.deepEqual(await page.evaluate(() => {
    const values = [];
    let off = () => {};
    controller.subscribe(value => { if (value.count) off(); });
    off = controller.subscribe(value => values.push(value.count));
    controller.subscribe(value => { if (value.count) throw new Error('listener'); });
    controller.subscribe(value => { if (value.count === 2) controller.dispose(); });
    controller.subscribe(value => values.push('tail' + value.count));
    controller.dispatch({ amount: 1 });
    controller.dispatch({ amount: 1 });
    return { values, output: controller.getOutput(), phases: errors.map(error => error.phase), removed: !('DaubPrototype' in window) };
  }), { values: [0, 'tail0', 'tail1'], output: null, phases: ['subscribe', 'subscribe'], removed: true });
});

test('remount during render, output, and cleanup preserves the replacement global without stale publication', async () => {
  for (const phase of ['render', 'output', 'cleanup']) {
    await mount({ output: 'return {count:state.count};' });
    assert.deepEqual(await page.evaluate(phase => {
      const replacement = { ...program, initial: { count: 8 } };
      window.replace = () => DaubBehavior.mount(preview, replacement);
      const body = 'window.replace();';
      let old;
      if (phase === 'cleanup') {
        old = DaubBehavior.mount(preview, { ...program, bind: 'return function(){ window.replace(); };' });
        DaubBehavior.mount(preview, program);
      } else {
        old = DaubBehavior.mount(preview, { ...program, [phase]: body + (phase === 'output' ? 'return {count:99};' : '') });
      }
      const values = [];
      old.subscribe(value => values.push(value));
      old.dispose();
      return { output: DaubPrototype.getOutput(), old: old.getOutput(), values, errors };
    }, phase), { output: { count: 8 }, old: null, values: [], errors: [] });
  }
});

test('queues bind and render reentrant actions in FIFO order and snapshots on enqueue', async () => {
  await mount({
    initial: [],
    reduce: 'return state.concat(action.value);',
    render: 'ui.preview.trace = (ui.preview.trace || []).concat(state.join("")); if (state.join("") === "a") ui.get("button").click();',
    bind: 'ui.on("button", "click", function() { dispatch({value:"c"}); }); var action = {value:"a"}; dispatch(action); action.value = "wrong"; dispatch({value:"b"});',
  });
  assert.deepEqual(await page.evaluate(() => ({ trace: preview.trace, state: controller.getState(), errors })), {
    trace: ['', 'a', 'ab', 'abc'], state: ['a', 'b', 'c'], errors: [],
  });
});

test('get uses exact IDs, supports the root, and never interpolates a CSS selector', async () => {
  const id = 'x"], [data-spec-id="button\\\n#';
  await page.evaluate(id => {
    document.querySelector('output').setAttribute('data-spec-id', id);
    document.getElementById('preview').setAttribute('data-spec-id', 'root');
  }, id);
  await mount({ render: `ui.text(${JSON.stringify(id)}, "<b>literal</b>"); ui.preview.sameRoot = ui.get("root") === ui.preview;` });
  assert.deepEqual(await page.evaluate(() => ({ text: preview.querySelector('output').textContent, html: preview.querySelector('output').innerHTML, root: preview.sameRoot, errors })), {
    text: '<b>literal</b>', html: '&lt;b&gt;literal&lt;/b&gt;', root: true, errors: [],
  });
});

test('input resolves native controls themselves and wrapped input, select, and textarea', async () => {
  await page.evaluate(() => {
    for (const tag of ['input', 'select', 'textarea']) {
      const direct = document.createElement(tag);
      direct.setAttribute('data-spec-id', tag);
      const wrapper = document.createElement('label');
      wrapper.setAttribute('data-spec-id', 'wrapped-' + tag);
      wrapper.append(document.createElement(tag));
      document.getElementById('preview').append(direct, wrapper);
    }
  });
  await mount({ render: 'ui.preview.tags = ["input", "select", "textarea"].flatMap(function(tag) { return [ui.input(tag).tagName, ui.input("wrapped-" + tag).tagName]; });' });
  assert.deepEqual(await page.evaluate(() => preview.tags), ['INPUT', 'INPUT', 'SELECT', 'SELECT', 'TEXTAREA', 'TEXTAREA']);
});

test('tracks bubbling NumberField input and change on the component wrapper', async () => {
  await page.addScriptTag({ content: renderer });
  await page.evaluate(() => document.getElementById('preview').append(renderElement({ quantity: { type: 'NumberField', props: { label: 'Quantity', value: 2, min: 1, max: 3 } } }, 'quantity', 0)));
  await mount({
    initial: { count: 2, events: [] },
    reduce: 'return { count: action.value, events: state.events.concat(action.type) };',
    render: 'ui.text("out", state.count * 68);',
    bind: '["input", "change"].forEach(function(type) { ui.on("quantity", type, function(e) { if (this !== ui.get("quantity") || e.currentTarget !== this) throw new Error("Wrong listener target"); dispatch({type:type, value:ui.input("quantity").valueAsNumber}); }); });',
  });
  await page.getByRole('button', { name: 'Increase quantity', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => ({ state: controller.getState(), text: preview.querySelector('output').textContent, errors })), {
    state: { count: 3, events: ['input', 'change'] }, text: '204', errors: [],
  });
});

test('dispose removes listeners, runs cleanup once, and makes retained callbacks and UI inert', async () => {
  await mount({ bind: `
    window.savedUI = ui; window.savedDispatch = dispatch;
    var button = ui.get("button"), add = button.addEventListener.bind(button), remove = button.removeEventListener.bind(button);
    button.addEventListener = function(type, fn) { window.savedCallback = fn; add(type, fn); };
    button.removeEventListener = function(type, fn) { ui.preview.removed = (ui.preview.removed || 0) + 1; remove(type, fn); };
    ui.on("button", "click", function() { ui.preview.called = true; dispatch({amount:1}); });
    return function() { ui.preview.cleanups = (ui.preview.cleanups || 0) + 1; dispatch({amount:99}); };
  ` });
  const result = await page.evaluate(() => {
    controller.dispose(); controller.dispose();
    savedDispatch({ amount: 4 }); savedCallback(new Event('click'));
    preview.querySelector('button').click(); savedUI.text('out', 'wrong');
    savedUI.on('button', 'click', () => { throw new Error('disposed'); });
    return { state: controller.getState(), removed: preview.removed, cleanups: preview.cleanups, called: !!preview.called, attached: '__daubBehaviorController' in preview, text: preview.querySelector('output').textContent, errors };
  });
  assert.deepEqual(result, { state: { count: 0 }, removed: 1, cleanups: 1, called: false, attached: false, text: '0', errors: [] });
});

test('on returns an idempotent unsubscribe function', async () => {
  await mount({ bind: 'var off = ui.on("button", "click", function() { dispatch({amount:1}); }); off(); off();' });
  await page.getByRole('button').click();
  assert.deepEqual(await page.evaluate(() => controller.getState()), { count: 0 });
});

test('remount disposes the old controller before rendering and leaves other previews alone', async () => {
  await mount({ bind: base.bind + ' return function() { ui.preview.cleaned = true; };' });
  const result = await page.evaluate(program => {
    const other = preview.cloneNode(true);
    document.body.append(other);
    const second = DaubBehavior.mount(other, program, error => errors.push(error.message));
    const replacement = DaubBehavior.mount(preview, { ...program, render: 'if (!ui.preview.cleaned) throw new Error("Cleanup order"); ui.text("out", state.count);' }, error => errors.push(error.message));
    controller.dispatch({ amount: 50 });
    preview.querySelector('button').click(); other.querySelector('button').click();
    return { old: controller.getState(), current: replacement.getState(), other: second.getState(), attached: preview.__daubBehaviorController === replacement, errors };
  }, base);
  assert.deepEqual(result, { old: { count: 0 }, current: { count: 1 }, other: { count: 1 }, attached: true, errors: [] });
});

test('a failed remount still disposes the old controller', async () => {
  await mount();
  await page.evaluate(() => DaubBehavior.mount(preview, { ...program, reduce: 'return (' }, error => errors.push(error.message)));
  await page.getByRole('button').click();
  assert.deepEqual(await page.evaluate(() => ({ state: controller.getState(), attached: '__daubBehaviorController' in preview, errors: errors.length })), {
    state: { count: 0 }, attached: false, errors: 1,
  });
});

test('initialization rejects non-JSON values without freezing caller objects', async () => {
  const result = await page.evaluate(base => {
    const circular = {}; circular.self = circular;
    const accessor = { get value() { throw new Error('Getter must not execute'); } };
    const cases = [undefined, NaN, Infinity, 1n, new Date(), new Map(), /x/, new (class State {})(), { bad: undefined }, { bad() {} }, { [Symbol()]: 1 }, circular, [, 1], accessor];
    return cases.map(initial => {
      const errors = [];
      const controller = DaubBehavior.mount(document.getElementById('preview'), { ...base, initial }, error => errors.push(error));
      controller.dispatch({ amount: 1 });
      return { count: errors.length, phase: errors[0]?.phase, state: controller.getState(), message: errors[0]?.message };
    });
  }, base);
  assert.equal(result.length, 14);
  for (const item of result) {
    assert.equal(item.count, 1);
    assert.equal(item.phase, 'initialize');
    assert.equal(item.state, undefined);
    assert.doesNotMatch(item.message, /Getter must not execute/);
  }
});

test('preserves JSON primitives and __proto__ keys without prototype pollution', async () => {
  const result = await page.evaluate(base => {
    const values = [null, false, 0, 'text', [1, null], JSON.parse('{"__proto__":{"polluted":true}}')];
    return values.map(initial => {
      const errors = [];
      const ctrl = DaubBehavior.mount(document.getElementById('preview'), { ...base, initial, render: '', bind: '' }, error => errors.push(error.message));
      return { state: JSON.stringify(ctrl.getState()), polluted: ({}).polluted === true, errors };
    });
  }, base);
  assert.deepEqual(result.map(item => JSON.parse(item.state)), [null, false, 0, 'text', [1, null], JSON.parse('{"__proto__":{"polluted":true}}')]);
  assert.ok(result.every(item => !item.polluted && item.errors.length === 0));
});

for (const [name, overrides, phase] of [
  ['missing bodies', { bind: null }, 'initialize'],
  ['syntax errors', { reduce: 'return (' }, 'initialize'],
  ['initial render errors', { render: 'throw new Error("render failed");' }, 'render'],
  ['missing get IDs', { render: 'ui.get("missing");' }, 'render'],
  ['missing text IDs', { render: 'ui.text("missing", "value");' }, 'render'],
  ['missing native controls', { render: 'ui.input("button");' }, 'render'],
  ['mutating render', { render: 'state.count++;' }, 'render'],
  ['bad bindings', { bind: 'ui.on("button", "click", function() { dispatch({amount:1}); }); ui.on("missing", "click", function() {});' }, 'bind'],
  ['invalid cleanup', { bind: 'return 42;' }, 'bind'],
]) {
  test(`reports ${name} and leaves no active controller`, async () => {
    await mount(overrides);
    await page.getByRole('button').click();
    const result = await page.evaluate(() => ({ state: controller.getState(), errors, attached: '__daubBehaviorController' in preview }));
    assert.deepEqual(result.state, { count: 0 });
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].phase, phase);
    assert.equal(result.attached, false);
  });
}

for (const reduce of ['state.count++; return state;', 'action.amount++; return state;', 'return undefined;', 'return {count:NaN};', 'throw new Error("bad action");', 'return Promise.reject(new Error("async reducer"));']) {
  test(`rejects failed transitions without changing state: ${reduce}`, async () => {
    await mount({ reduce });
    await page.evaluate(() => controller.dispatch({ amount: 2 }));
    const result = await page.evaluate(() => ({ state: controller.getState(), text: preview.querySelector('output').textContent, errors }));
    assert.deepEqual(result.state, { count: 0 });
    assert.equal(result.text, '0');
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.every(error => error.phase === 'reduce'));
  });
}

test('reports invalid actions and recovers on the next valid action', async () => {
  await mount();
  await page.evaluate(() => { controller.dispatch({ amount: NaN }); controller.dispatch({ amount: 2 }); });
  assert.deepEqual(await page.evaluate(() => ({ state: controller.getState(), phases: errors.map(error => error.phase) })), { state: { count: 2 }, phases: ['dispatch'] });
});

test('keeps accepted state after a render error and tolerates a throwing reporter', async () => {
  await mount({ render: 'if (state.count === 1) throw new Error("draw"); ui.text("out", state.count);' });
  const result = await page.evaluate(() => {
    controller.dispose();
    controller = DaubBehavior.mount(preview, program, error => { errors.push(error.phase); throw new Error('reporter'); });
    controller.dispatch({ amount: 1 });
    const accepted = controller.getState();
    controller.dispatch({ amount: 1 });
    return { accepted, state: controller.getState(), text: preview.querySelector('output').textContent, errors };
  });
  assert.deepEqual(result, { accepted: { count: 1 }, state: { count: 2 }, text: '2', errors: ['render'] });
});

test('reports synchronous and asynchronous handler failures and cleanup errors', async () => {
  await mount({ bind: `
    ui.on("button", "click", function() { throw new Error("sync"); });
    ui.on("button", "click", async function() { throw new Error("async"); });
    return function() { throw new Error("cleanup"); };
  ` });
  await page.getByRole('button').click();
  await page.evaluate(() => controller.dispose());
  assert.deepEqual(await page.evaluate(() => errors.map(error => error.phase)), ['event click', 'event click', 'cleanup']);
  assert.equal(await page.evaluate(() => '__daubBehaviorController' in preview), false);
});

test('bounds render-event action loops and disposes the looping controller', async () => {
  await mount({ render: base.render + ' if (state.count) ui.get("button").click();' });
  await page.evaluate(() => controller.dispatch({ amount: 1 }));
  const result = await page.evaluate(() => ({ state: controller.getState(), errors, attached: '__daubBehaviorController' in preview }));
  assert.deepEqual(result.state, { count: 1000 });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /1000 queued transitions/);
  assert.equal(result.attached, false);
});

test('disposal during initial render skips bind', async () => {
  await mount({ render: 'ui.preview.__daubBehaviorController.dispose();', bind: 'throw new Error("must not bind");' });
  assert.deepEqual(await page.evaluate(() => errors), []);
  assert.equal(await page.evaluate(() => '__daubBehaviorController' in preview), false);
});

test('remount during bind runs late cleanup without disposing the replacement', async () => {
  await mount({ bind: `
    DaubBehavior.mount(ui.preview, {initial:{count:8}, reduce:"return state;", render:'ui.text("out", state.count);', bind:""});
    return function() { ui.preview.lateCleanup = (ui.preview.lateCleanup || 0) + 1; };
  ` });
  assert.deepEqual(await page.evaluate(() => ({ count: preview.__daubBehaviorController.getState().count, cleanups: preview.lateCleanup, text: preview.querySelector('output').textContent, errors })), {
    count: 8, cleanups: 1, text: '8', errors: [],
  });
});

test('toScript runs without the module, preserves literal dollars and script terminators, and remounts', async () => {
  const payload = '</script><script>window.injected=true</script> $& $$ $` $\' ${state} \u2028\u2029';
  const program = { initial: { payload }, reduce: 'return {payload: state.payload + action};', render: 'ui.text("out", state.payload);', bind: 'ui.on("button", "click", function() { dispatch("$"); });' };
  const script = behavior.toScript(program);
  assert.doesNotMatch(script, /<\/script/i);
  await page.setContent('<section id="export"><button data-spec-id="button">Add</button><output data-spec-id="out"></output></section>');
  await page.evaluate(() => { delete window.DaubBehavior; window.errors = []; window.__pgReportError = error => errors.push(error.message); });
  await page.addScriptTag({ content: 'var preview = document.getElementById("export"); window.first = ' + script + '; window.second = ' + script + ';' });
  await page.getByRole('button').click();
  assert.deepEqual(await page.evaluate(() => ({ old: first.getState().payload, current: second.getState().payload, text: preview.querySelector('output').textContent, injected: !!window.injected, errors })), {
    old: payload, current: payload + '$', text: payload + '$', injected: false, errors: [],
  });
});

test('toScript supports inline HTML with a body default and forwards errors to the iframe reporter', async () => {
  const script = behavior.toScript({ ...base, initial: { count: '</script>$&' }, bind: 'throw new Error("export bind");' });
  await page.setContent('<output data-spec-id="out"></output><script>window.errors=[]; window.__pgReportError=function(e){errors.push(e.message);}; ' + script + ';</script>');
  assert.deepEqual(await page.evaluate(() => ({ text: document.querySelector('output').textContent, errors })), {
    text: '</script>$&', errors: ['DaubBehavior bind: export bind'],
  });
});

test('self-contained export exposes output, subscriptions, failure invalidation, and remount lifecycle', async () => {
  const script = behavior.toScript({
    ...base,
    output: 'if (state.count === 2) return Promise.resolve({count:99}); return {completed:state.count > 0, answers:[state.count]};',
  });
  await page.evaluate(() => {
    delete window.DaubBehavior;
    window.errors = [];
    window.__pgReportError = error => errors.push(error.phase);
  });
  await page.addScriptTag({ content: 'window.first = ' + script + '; window.values = []; window.off = DaubPrototype.subscribe(function(value){ values.push(value); });' });
  await page.getByRole('button').click();
  await page.getByRole('button').click();
  await page.getByRole('button').click();
  assert.deepEqual(await page.evaluate(() => {
    const current = DaubPrototype.getOutput();
    return {
      moduleAbsent: !('DaubBehavior' in window), values, current,
      frozen: Object.isFrozen(current) && Object.isFrozen(current.answers), errors,
    };
  }), {
    moduleAbsent: true,
    values: [{ completed: false, answers: [0] }, { completed: true, answers: [1] }, null, { completed: true, answers: [3] }],
    current: { completed: true, answers: [3] }, frozen: true, errors: ['output'],
  });
  await page.addScriptTag({ content: 'window.second = ' + script + ';' });
  assert.deepEqual(await page.evaluate(() => {
    off(); off();
    first.dispose();
    const current = DaubPrototype.getOutput();
    second.dispose();
    return { current, old: first.getOutput(), events: values.length, removed: !('DaubPrototype' in window) };
  }), { current: { completed: false, answers: [0] }, old: null, events: 4, removed: true });
});
