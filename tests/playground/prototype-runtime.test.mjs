import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { chromium } from 'playwright';
import runtime from '../../playground-prototype-runtime.js';

const source = await readFile(new URL('../../playground-prototype-runtime.js', import.meta.url), 'utf8');
let browser, page, frame;

before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => { await browser?.close(); });
beforeEach(async () => {
  page = await browser.newPage();
  page.setDefaultTimeout(3000);
  await page.route('**/*', route => route.abort());
  await page.setContent('<iframe sandbox="allow-scripts"></iframe>');
  frame = page.frames().find(candidate => candidate !== page.mainFrame());
  await frame.setContent('<main id="preview"><section id="container"><button class="add">Add</button><button class="add">Add again</button><output></output></section><button id="outside">Outside</button></main>');
  await frame.addScriptTag({ content: source });
  await frame.evaluate(() => {
    window.errors = [];
    window.__pgReportError = error => errors.push({ phase: error.phase, message: error.message });
    window.container = document.getElementById('container');
    window.preview = document.getElementById('preview');
  });
});
afterEach(async () => { await page?.close(); });

async function mount(code) {
  await frame.evaluate(code => { window.controller = DaubPrototypeRuntime.mount(container, code); }, code);
}

async function pauseClock() {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
}

test('exports CommonJS, browser, and AMD APIs without executing prototype code', () => {
  assert.deepEqual(Object.keys(runtime), ['mount', 'toScript']);
  const context = {};
  runInNewContext(source, context);
  assert.deepEqual(Object.keys(context.DaubPrototypeRuntime), ['mount', 'toScript']);
  let amd;
  const define = (_dependencies, factory) => { amd = factory(); };
  define.amd = true;
  runInNewContext(source, { define });
  assert.deepEqual(Object.keys(amd), ['mount', 'toScript']);
  assert.equal(typeof runtime.toScript('throw new Error("not executed")'), 'string');
  assert.throws(() => runtime.toScript({}), /string/i);
});

test('refuses execution outside an opaque child sandbox', async () => {
  await page.addScriptTag({ content: source });
  assert.deepEqual(await page.evaluate(() => {
    const errors = [];
    DaubPrototypeRuntime.mount(document.body, 'window.executed = true;', e => errors.push(e.message));
    return { executed: !!window.executed, errors, exposed: 'DaubPrototype' in window };
  }), { executed: false, errors: ['DaubPrototype initialize: Expected an opaque sandbox window'], exposed: false });
  assert.equal(await frame.evaluate(() => window.origin), 'null');
});

test('rejects an unsandboxed child that inherits a null origin from its parent', async () => {
  await page.evaluate(() => {
    const child = document.createElement('iframe');
    child.id = 'unsafe';
    document.body.append(child);
  });
  const child = await page.locator('#unsafe').elementHandle().then(element => element.contentFrame());
  await child.addScriptTag({ content: source });
  assert.deepEqual(await child.evaluate(() => {
    const errors = [];
    DaubPrototypeRuntime.mount(document.body, 'window.executed=true;', e => errors.push(e.phase));
    return { origin: window.origin, parentAccessible: !!window.frameElement, executed: !!window.executed, errors };
  }), { origin: 'null', parentAccessible: true, executed: false, errors: ['initialize'] });
});

test('scopes selector listeners, supports window/document keyboard events, and cancels listeners', async () => {
  await mount(`
    var count = 0;
    function publish() { api.publish({count: count}); }
    window.off = api.on('.add', 'click', function() { count++; this.textContent = 'Used'; publish(); });
    api.on(window, 'keydown', function(e) { if (e.key === 'ArrowRight') { count += 10; publish(); } });
    api.on(document, 'keyup', function(e) { if (e.key === 'ArrowLeft') { count -= 2; publish(); } });
    publish();
  `);
  await frame.locator('.add').nth(0).click();
  await frame.locator('.add').nth(1).click();
  await frame.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    document.getElementById('outside').click();
    off(); off();
    container.querySelector('button').click();
  });
  assert.deepEqual(await frame.evaluate(() => DaubPrototype.getOutput()), { count: 10 });
  assert.deepEqual(await frame.locator('.add').allTextContents(), ['Used', 'Used']);
  assert.deepEqual(await frame.evaluate(() => errors), []);
});

test('publishes detached JSON, treats markup as text, and replays output to subscribers', async () => {
  await mount(`
    window.input = {answers: [1], text: '<img src=x onerror="window.injected=true">'};
    window.publish = api.publish;
    api.publish(input);
    container.querySelector('output').textContent = input.text;
  `);
  assert.deepEqual(await frame.evaluate(() => {
    const one = DaubPrototype.getOutput(), two = DaubPrototype.getOutput();
    input.answers.push(9);
    const seen = [], refs = [];
    const off = DaubPrototype.subscribe(value => { seen.push(value); refs.push(value); });
    const off2 = DaubPrototype.subscribe(value => refs.push(value));
    publish({ answers: [2] });
    off(); off(); off2();
    publish({ answers: [3] });
    return {
      one, two, seen, current: DaubPrototype.getOutput(),
      detached: one !== two && one.answers !== two.answers && refs[0] !== refs[1] && refs[0].answers !== refs[1].answers,
      frozen: [one, one.answers, two, two.answers, refs[0]].every(Object.isFrozen),
      callerMutable: !Object.isFrozen(input) && !Object.isFrozen(input.answers),
      apiKeys: Object.keys(DaubPrototype), readonly: Object.isFrozen(DaubPrototype),
      injected: !!window.injected, images: container.querySelectorAll('img').length, errors,
    };
  }), {
    one: { answers: [1], text: '<img src=x onerror="window.injected=true">' },
    two: { answers: [1], text: '<img src=x onerror="window.injected=true">' },
    seen: [{ answers: [1], text: '<img src=x onerror="window.injected=true">' }, { answers: [2] }],
    current: { answers: [3] }, detached: true, frozen: true, callerMutable: true,
    apiKeys: ['getOutput', 'subscribe'], readonly: true, injected: false, images: 0, errors: [],
  });
});

test('rejects non-JSON output without invoking getters or toJSON', async () => {
  const results = await frame.evaluate(() => {
    const bodies = ['null', '[]', '1', 'undefined', 'new Date()', '{bad:NaN}', '{bad:Infinity}',
      '{bad:undefined}', '{bad:1n}', '{bad:function(){}}', '{bad:Symbol()}', '{bad:new Map()}',
      '{bad:new Array(2)}', '{get bad(){window.touched=true;return 1;}}',
      '{toJSON:function(){window.touched=true;return {};}}',
      'Object.defineProperty({}, "bad", {value:1})', '{[Symbol()]:1}',
      '(function(){var a={};a.self=a;return a;})()'];
    return bodies.map(body => {
      const errors = [];
      const ctrl = DaubPrototypeRuntime.mount(container, 'api.publish(' + body + ');', e => errors.push(e.phase));
      return { output: ctrl.getOutput(), exposed: 'DaubPrototype' in window, touched: !!window.touched, errors };
    });
  });
  for (const result of results) assert.deepEqual(result, { output: null, exposed: false, touched: false, errors: ['execute'] });
  await mount('api.publish(JSON.parse(\'{"__proto__":{"polluted":true},"constructor":"text","nested":{"ok":true}}\'));');
  assert.deepEqual(await frame.evaluate(() => ({ value: JSON.stringify(DaubPrototype.getOutput()), polluted: !!({}).polluted, errors })), {
    value: '{"__proto__":{"polluted":true},"constructor":"text","nested":{"ok":true}}', polluted: false, errors: [],
  });
});

test('manages repeating timers and frames, pauses hidden animation, and cancels callbacks', async () => {
  await pauseClock();
  await mount(`
    window.ticks = 0; window.frames = 0;
    window.cancelTimer = api.every(20, function() { ticks++; api.publish({ticks: ticks}); });
    window.cancelFrame = api.frame(function(time) { frames++; window.lastTime = time; });
  `);
  await page.clock.runFor(65);
  const initial = await frame.evaluate(() => ({ ticks, frames, lastTime }));
  assert.equal(initial.ticks, 3);
  assert.ok(initial.frames >= 3);
  assert.equal(typeof initial.lastTime, 'number');
  await frame.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(100);
  assert.deepEqual(await frame.evaluate(() => ({ ticks, frames, lastTime })), initial);
  await frame.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(40);
  const resumed = await frame.evaluate(() => ({ ticks, frames }));
  assert.equal(resumed.ticks, 5);
  assert.ok(resumed.frames > initial.frames && resumed.frames <= initial.frames + 3);
  await frame.evaluate(() => { cancelTimer(); cancelTimer(); cancelFrame(); cancelFrame(); });
  await page.clock.runFor(100);
  assert.deepEqual(await frame.evaluate(() => ({ ticks, frames })), resumed);
});

test('disposes timers, frames, subscriptions, listeners and cleanup once across remounts', async () => {
  await pauseClock();
  await mount(`
    window.runs = 0; window.cleanups = 0; window.oldPublish = api.publish;
    api.on('window', 'keydown', function() { runs++; });
    api.on('document', 'keyup', function() { runs++; });
    api.every(10, function() { runs++; }); api.frame(function() { runs++; });
    api.publish({old:true});
    return function() { cleanups++; api.publish({stale:true}); };
  `);
  await frame.evaluate(() => {
    window.oldAPI = DaubPrototype;
    window.values = [];
    oldAPI.subscribe(value => values.push(value));
    window.oldDispose = __daubPrototypeDispose;
    window.next = DaubPrototypeRuntime.mount(preview, 'api.publish({next:true});');
    oldDispose(); controller.dispose(); oldPublish({stale:true});
    window.dispatchEvent(new KeyboardEvent('keydown'));
    document.dispatchEvent(new KeyboardEvent('keyup'));
  });
  await page.clock.runFor(100);
  assert.deepEqual(await frame.evaluate(() => ({
    runs, cleanups, values, old: oldAPI.getOutput(), current: DaubPrototype.getOutput(),
    correctDispose: __daubPrototypeDispose === next.dispose, errors,
  })), { runs: 0, cleanups: 1, values: [{ old: true }], old: null, current: { next: true }, correctDispose: true, errors: [] });
  await frame.evaluate(() => __daubPrototypeDispose());
  assert.deepEqual(await frame.evaluate(() => ({ api: 'DaubPrototype' in window, hook: '__daubPrototypeDispose' in window })), { api: false, hook: false });
});

for (const [phase, code, trigger] of [
  ['execute', 'api.every(10, function(){window.leaked=true;}); throw new Error("boom");', ''],
  ['execute', 'return (', ''],
  ['event click', 'api.on(".add", "click", function(){throw new Error("boom");});', 'container.querySelector("button").click();'],
  ['event click', 'api.on(".add", "click", async function(){throw new Error("boom");});', 'container.querySelector("button").click();'],
  ['every', 'api.every(10, function(){throw new Error("boom");});', ''],
  ['every', 'api.every(10, async function(){throw new Error("boom");});', ''],
  ['frame', 'api.frame(function(){throw new Error("boom");});', ''],
  ['frame', 'api.frame(async function(){throw new Error("boom");});', ''],
]) {
  test(`reports ${phase} errors and tears down the failed instance: ${code}`, async () => {
    await pauseClock();
    await mount(code);
    if (trigger) await frame.evaluate(trigger);
    await page.clock.runFor(80);
    assert.deepEqual(await frame.evaluate(() => ({ phases: errors.map(e => e.phase), api: 'DaubPrototype' in window, output: controller.getOutput(), leaked: !!window.leaked })), {
      phases: [phase], api: false, output: null, leaked: false,
    });
  });
}

test('exports a self-contained CustomHTML body with safe script-literal encoding', async () => {
  const code = 'api.publish({text:"</script><script>window.injected=true</script>", separator:"\u2028\u2029"});';
  const script = runtime.toScript(code);
  assert.equal(script.includes('</script>'), false);
  await frame.evaluate(script => {
    delete window.DaubPrototypeRuntime;
    new Function('container', 'preview', script)(container, preview);
  }, script);
  assert.deepEqual(await frame.evaluate(() => ({ output: DaubPrototype.getOutput(), injected: !!window.injected, errors })), {
    output: { text: '</script><script>window.injected=true</script>', separator: '\u2028\u2029' }, injected: false, errors: [],
  });
  await frame.evaluate(script => {
    container.id = 'content';
    delete window.container;
    new Function('preview', script)(preview);
  }, runtime.toScript('api.publish({id:container.id});'));
  assert.deepEqual(await frame.evaluate(() => DaubPrototype.getOutput()), { id: 'preview' });
});

test('stale async callbacks cannot publish or report into a replacement instance', async () => {
  await mount(`
    api.on(container, 'click', async function() {
      await new Promise(function(resolve) { window.resume = resolve; });
      api.publish({stale:true});
      throw new Error('stale error');
    });
    api.publish({old:true});
  `);
  assert.deepEqual(await frame.evaluate(async () => {
    container.click();
    const old = DaubPrototype;
    DaubPrototypeRuntime.mount(container, 'api.publish({current:true});');
    resume();
    await Promise.resolve(); await Promise.resolve();
    return { old: old.getOutput(), current: DaubPrototype.getOutput(), errors };
  }), { old: null, current: { current: true }, errors: [] });
});

test('queues reentrant publications and skips subscribers removed during notification', async () => {
  await mount('window.publish = api.publish;');
  assert.deepEqual(await frame.evaluate(() => {
    const first = [], second = [];
    let remove = () => {};
    DaubPrototype.subscribe(value => {
      first.push(value.n);
      if (value.n === 1) publish({ n: 2 });
      if (value.n === 3) remove();
    });
    remove = DaubPrototype.subscribe(value => second.push(value.n));
    const empty = DaubPrototype.getOutput();
    publish({ n: 1 }); publish({ n: 3 });
    return { empty, first, second, output: DaubPrototype.getOutput(), errors };
  }), { empty: null, first: [1, 2, 3], second: [1, 2], output: { n: 3 }, errors: [] });
});

test('replays initial output once and clears disposed output without fabricated notifications', async () => {
  await mount('window.publish = api.publish; api.publish({ready:true});');
  assert.deepEqual(await frame.evaluate(() => {
    const api = DaubPrototype, values = [];
    const off = api.subscribe(value => values.push(value));
    const initial = api.getOutput();
    publish({ ready: true });
    __daubPrototypeDispose();
    off(); off();
    api.subscribe(() => values.push('stale'))();
    publish({ stale: true });
    return { initial, values, disposed: api.getOutput(), errors };
  }), { initial: { ready: true }, values: [{ ready: true }, { ready: true }], disposed: null, errors: [] });
});

test('subscriber throws and rejections dispose active resources and report the subscribe phase', async () => {
  await pauseClock();
  for (const asynchronous of [false, true]) {
    await mount('window.ticks = 0; api.every(10, function(){ticks++;}); api.publish({ready:true});');
    await frame.evaluate(async asynchronous => {
      errors.length = 0;
      DaubPrototype.subscribe(() => {
        if (asynchronous) return Promise.reject(new Error('subscriber failed'));
        throw new Error('subscriber failed');
      });
      await Promise.resolve();
    }, asynchronous);
    await page.clock.runFor(50);
    assert.deepEqual(await frame.evaluate(() => ({ ticks, output: controller.getOutput(), phases: errors.map(e => e.phase), exposed: 'DaubPrototype' in window })), {
      ticks: 0, output: null, phases: ['subscribe'], exposed: false,
    });
  }
});

test('bounds reentrant publication loops and disposes instead of overflowing the stack', async () => {
  await mount('window.publish = api.publish;');
  assert.deepEqual(await frame.evaluate(() => {
    let notifications = 0;
    DaubPrototype.subscribe(value => { notifications++; publish({ n: value.n + 1 }); });
    publish({ n: 1 });
    return { notifications, output: controller.getOutput(), phases: errors.map(e => e.phase), exposed: 'DaubPrototype' in window };
  }), { notifications: 1000, output: null, phases: ['publish'], exposed: false });
});

test('cleans up reentrant mounts without replacing the newest global API', async () => {
  await mount(`
    window.cleanups = 0;
    DaubPrototypeRuntime.mount(container, 'api.publish({newest:true});');
    api.publish({stale:true});
    return function() { cleanups++; };
  `);
  assert.deepEqual(await frame.evaluate(() => ({ old: controller.getOutput(), current: DaubPrototype.getOutput(), cleanups, errors })), {
    old: null, current: { newest: true }, cleanups: 1, errors: [],
  });
  await mount(`
    return function() { DaubPrototypeRuntime.mount(container, 'api.publish({fromCleanup:true});'); };
  `);
  await mount('window.overwritten = true; api.publish({wrong:true});');
  assert.deepEqual(await frame.evaluate(() => ({ current: DaubPrototype.getOutput(), overwritten: !!window.overwritten, errors })), {
    current: { fromCleanup: true }, overwritten: false, errors: [],
  });
});

test('reports cleanup failures once and preserves a remounted instance', async () => {
  for (const cleanup of ['throw new Error("cleanup failed");', 'return Promise.reject(new Error("cleanup failed"));']) {
    await mount('return function(){' + cleanup + '};');
    assert.deepEqual(await frame.evaluate(async () => {
      errors.length = 0;
      DaubPrototypeRuntime.mount(container, 'api.publish({next:true});');
      controller.dispose();
      await Promise.resolve();
      return { output: DaubPrototype.getOutput(), phases: errors.map(e => e.phase) };
    }), { output: { next: true }, phases: ['cleanup'] });
  }
});

test('rejects invalid bindings, timer delays, callbacks, code, and cleanup returns', async () => {
  const results = await frame.evaluate(async () => {
    const codes = [null, {},
      'api.on("#outside", "click", function(){});',
      'api.on(document.getElementById("outside"), "click", function(){});',
      'api.on(container, "", function(){});', 'api.on(container, "click", null);',
      'api.every(0, function(){});', 'api.every(-1, function(){});', 'api.every(NaN, function(){});',
      'api.every(Infinity, function(){});', 'api.every(2147483648, function(){});',
      'api.every("10", function(){});', 'api.every(10, null);', 'api.frame(null);',
      'return {};', 'return Promise.reject(new Error("async initialization"));'];
    const results = [];
    for (const code of codes) {
      const errors = [];
      const ctrl = DaubPrototypeRuntime.mount(container, code, e => errors.push(e.phase));
      await Promise.resolve();
      results.push({ phases: errors, output: ctrl.getOutput(), exposed: 'DaubPrototype' in window });
    }
    return results;
  });
  for (const result of results) assert.deepEqual(result, { phases: ['execute'], output: null, exposed: false });
});

test('starts hidden animations on visibility and supports cancellation from inside a frame', async () => {
  await pauseClock();
  await frame.evaluate(() => Object.defineProperty(document, 'hidden', { value: true, configurable: true }));
  await mount(`
    window.frames = 0;
    var cancel = api.frame(function() { frames++; cancel(); });
  `);
  await page.clock.runFor(50);
  assert.equal(await frame.evaluate(() => frames), 0);
  await frame.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(50);
  assert.equal(await frame.evaluate(() => frames), 1);
});

test('exported code reports asynchronous errors through the sandbox error hook', async () => {
  await pauseClock();
  await frame.evaluate(script => {
    delete window.DaubPrototypeRuntime;
    new Function('container', 'preview', script)(container, preview);
  }, runtime.toScript('api.every(10, function(){throw new Error("export failure");});'));
  await page.clock.runFor(30);
  assert.deepEqual(await frame.evaluate(() => ({ errors, exposed: 'DaubPrototype' in window })), {
    errors: [{ phase: 'every', message: 'DaubPrototype every: export failure' }], exposed: false,
  });
});
