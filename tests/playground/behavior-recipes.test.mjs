import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { chromium } from 'playwright';
import recipes from '../../playground-behavior-recipes.js';
import behavior from '../../playground-behavior.js';

const source = await readFile(new URL('../../playground-behavior-recipes.js', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../../playground-behavior.js', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../../daub-render.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../daub.css', import.meta.url), 'utf8');
const clone = value => structuredClone(value);
const node = (type, props = {}, children = []) => ({ type, props, children });
function fixture(kind = 'quiz', count = 10) {
  const spec = { root: 'page', elements: { page: node('Stack', { gap: 3 }) } };
  let descriptor;
  if (kind === 'quiz') {
    Object.assign(spec.elements, {
      question: node('Text', { tag: 'h2' }), choices: node('RadioGroup', { label: 'Choose an answer', options: [] }),
      back: node('Button', { label: 'Back' }), next: node('Button', { label: 'Next' }),
      progress: node('Text'), result: node('Text'), navigation: node('Stack', { direction: 'horizontal' }, ['back', 'next'])
    });
    spec.elements.page.children = ['progress', 'question', 'choices', 'navigation', 'result'];
    descriptor = { kind, bindings: { question: 'question', choices: 'choices', back: 'back', next: 'next', progress: 'progress', result: 'result' }, data: {
      questions: Array.from({ length: count }, (_, i) => ({ id: 'q' + i, text: 'Question ' + (i + 1), options: [
        { value: 'yes', label: 'Yes ' + (i + 1), score: i + 1 }, { value: 'no', label: 'No ' + (i + 1), score: -1 }
      ] }))
    } };
  } else if (kind === 'selection') {
    Object.assign(spec.elements, { choices: node('RadioGroup', { label: 'Select a plan', options: [] }), summary: node('Text') });
    spec.elements.page.children = ['choices', 'summary'];
    descriptor = { kind, bindings: { choices: 'choices', summary: 'summary' }, data: { options: [
      { value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'team', label: 'Team' }
    ] } };
  } else {
    Object.assign(spec.elements, { query: node('Search', { label: 'Find an item' }), items: node('Stack'), count: node('Text') });
    spec.elements.page.children = ['query', 'count', 'items'];
    descriptor = { kind, bindings: { query: 'query', items: 'items', count: 'count' }, data: { items: [
      { id: 'alpha', label: 'Alpha notebook' }, { id: 'beta', label: 'Beta pen' }, { id: 'gamma', label: 'ALPHA pencil' }
    ] } };
    spec.elements.items.children = descriptor.data.items.map(item => item.id);
    descriptor.data.items.forEach(item => {
      spec.elements[item.id] = node('Card', { title: item.label, media: 'blob:recipe-fixture' }, [item.id + '-description']);
      spec.elements[item.id + '-description'] = node('Text', { content: 'Available in store' });
    });
  }
  return { descriptor, spec };
}
function compile({ descriptor, spec }) { return recipes.compile(descriptor, spec); }
const screenRoles = ['questionScreen', 'resultScreen', 'answerReview', 'restart'];
function screenFixture(count = 10) {
  const input = fixture('quiz', count), { descriptor, spec } = input;
  Object.assign(descriptor.bindings, Object.fromEntries(screenRoles.map(role => [role, role])));
  Object.assign(spec.elements, {
    questionScreen: node('Stack', {}, ['progress', 'question', 'choices', 'navigation']),
    resultScreen: node('Grid', {}, ['result', 'answerReview', 'restart']),
    answerReview: node('Text'), restart: node('Button', { label: 'Restart' })
  });
  spec.elements.page.children = ['questionScreen', 'resultScreen'];
  return input;
}
function reject(input, pattern) {
  assert.throws(() => compile(input), error => error instanceof TypeError && error.code === 'DAUB_RECIPE_INVALID' && typeof error.path === 'string' && /fallback/.test(error.message) && pattern.test(error.message));
}
function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function machine(input) {
  const program = compile(input);
  let state = frozen(program.initial);
  const reduce = new Function('state', 'action', '"use strict";\n' + program.reduce);
  const output = new Function('state', '"use strict";\n' + program.output);
  return {
    state: () => state,
    output: () => output(state),
    dispatch(action) { state = frozen(reduce(state, frozen(action))); return output(state); }
  };
}

test('UMD exposes compile and immutable model-facing documentation in CommonJS, browser and AMD', () => {
  assert.deepEqual(Object.keys(recipes), ['compile', 'descriptorSchema', 'documentation', 'validate']);
  const context = {};
  runInNewContext(source, context);
  assert.equal(typeof context.DaubBehaviorRecipes.compile, 'function');
  let amd;
  const define = (_, factory) => { amd = factory(); }; define.amd = true;
  runInNewContext(source, { define });
  assert.deepEqual(JSON.parse(JSON.stringify(amd.documentation)), recipes.documentation);
  assert.deepEqual(Object.keys(recipes.documentation.recipes), ['quiz', 'selection', 'filter']);
  assert.ok(Object.isFrozen(recipes.documentation.recipes.quiz.bindings.choices));
  assert.throws(() => { recipes.documentation.recipes.quiz.bindings.choices.push('Text'); }, TypeError);
  const input = fixture();
  assert.deepEqual(JSON.parse(JSON.stringify(context.DaubBehaviorRecipes.compile(input.descriptor, input.spec))), compile(input));
});

test('descriptorSchema exports detached strict branches with the documented exact roles and bounded data', () => {
  const schema = recipes.descriptorSchema();
  assert.deepEqual(schema.anyOf.map(branch => branch.properties.kind.enum[0]), ['quiz', 'selection', 'filter']);
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'object') { assert.equal(value.additionalProperties, false); assert.deepEqual(value.required, Object.keys(value.properties)); }
    Object.values(value).forEach(inspect);
  }
  inspect(schema);
  for (const branch of schema.anyOf) {
    const kind = branch.properties.kind.enum[0];
    assert.deepEqual(branch.required, ['kind', 'bindings', 'data']);
    assert.deepEqual(branch.properties.bindings.required, Object.keys(recipes.documentation.recipes[kind].bindings));
  }
  assert.equal(schema.anyOf[0].properties.data.properties.questions.maxItems, 50);
  assert.deepEqual(schema.anyOf[0].properties.data.required, ['questions', 'resultLabel']);
  assert.deepEqual(schema.anyOf[1].properties.data.required, ['options', 'initialValue']);
  schema.anyOf[0].properties.bindings.properties.question.maxLength = 999;
  assert.equal(recipes.descriptorSchema().anyOf[0].properties.bindings.properties.question.maxLength, 64);
});

test('quiz screens: strict schema requires four nullable fields; validation normalizes nulls without changing legacy descriptors', () => {
  const bindings = recipes.descriptorSchema().anyOf[0].properties.bindings;
  for (const role of screenRoles) {
    assert.ok(bindings.required.includes(role));
    assert.deepEqual(bindings.properties[role].anyOf.map(option => option.type), ['string', 'null']);
    assert.equal(bindings.properties[role].anyOf[0].maxLength, 64);
  }
  const legacy = fixture(), nullable = clone(legacy);
  Object.assign(nullable.descriptor.bindings, Object.fromEntries(screenRoles.map(role => [role, null])));
  assert.deepEqual(recipes.validate(frozen(nullable.descriptor)), recipes.validate(legacy.descriptor));
  assert.deepEqual(compile(nullable), compile(legacy));
  assert.deepEqual(Object.keys(nullable.descriptor.bindings).slice(-4), screenRoles);
  const extended = screenFixture(), original = clone(extended);
  assert.deepEqual(compile(frozen(extended)).initial.bindings, extended.descriptor.bindings);
  assert.deepEqual(extended, original);
});

test('quiz screens: rejects every partial bundle after null normalization', () => {
  for (let mask = 1; mask < 15; mask++) {
    for (const nullMissing of [false, true]) {
      const input = screenFixture();
      screenRoles.forEach((role, i) => {
        if (!(mask & (1 << i))) {
          if (nullMissing) input.descriptor.bindings[role] = null;
          else delete input.descriptor.bindings[role];
        }
      });
      assert.throws(() => recipes.validate(input.descriptor), /bindings.*all four/);
      reject(input, /bindings.*all four/);
    }
  }
  for (const value of [null, '', false, 0, {}, 'constructor', 'x\"] [hidden]', 'a'.repeat(65)]) {
    const input = screenFixture(); input.descriptor.bindings.restart = value;
    reject(input, /all four|safe ID/);
  }
  const required = fixture(); required.descriptor.bindings.question = null; reject(required, /safe ID/);
  const unknown = fixture(); unknown.descriptor.bindings.reset = null; reject(unknown, /unsupported/);
  for (const kind of ['selection', 'filter']) {
    const input = fixture(kind); input.descriptor.bindings.restart = null; reject(input, /unsupported/);
  }
});

test('quiz screens: accepts existing containers, nested controls and Card footer slots', () => {
  for (const type of ['Stack', 'Grid', 'Layout', 'Surface', 'Card', 'ButtonGroup', 'Fieldset', 'Group']) {
    const input = screenFixture();
    input.spec.elements.questionScreen.type = type;
    input.spec.elements.resultScreen.type = type;
    assert.doesNotThrow(() => compile(input));
  }
  const input = screenFixture();
  input.spec.elements.resultScreen = node('Card', { footer: ['restart'], children: ['result', 'answerReview'] });
  delete input.spec.elements.resultScreen.children;
  assert.doesNotThrow(() => compile(input));
});

test('quiz screens: requires the correct controls in separate, non-nested panels', () => {
  for (const [screen, ids] of [['questionScreen', ['question', 'choices', 'back', 'next', 'progress']], ['resultScreen', ['result', 'answerReview', 'restart']]]) {
    for (const id of ids) {
      const input = screenFixture();
      Object.values(input.spec.elements).forEach(element => { element.children = element.children.filter(child => child !== id); });
      input.spec.elements.page.children.push(id);
      reject(input, new RegExp('bindings.' + screen + '.*contain.*' + id));
    }
  }
  for (const [outer, inner] of [['questionScreen', 'resultScreen'], ['resultScreen', 'questionScreen']]) {
    const input = screenFixture();
    input.spec.elements.page.children = [outer]; input.spec.elements[outer].children.push(inner);
    reject(input, /separate|contain/);
  }
});

test('quiz screens: retains safe IDs, reachability, leaf roles and competing-behavior safeguards', () => {
  for (const role of screenRoles) {
    let input = screenFixture(); input.descriptor.bindings[role] = 'question'; reject(input, /unique/);
    input = screenFixture(); input.descriptor.bindings[role] = 'missing'; reject(input, /reachable/);
    input = screenFixture(); input.spec.elements[role].type = 'Tabs'; reject(input, /requires|ancestor/);
    input = screenFixture();
    Object.values(input.spec.elements).forEach(element => { element.children = element.children.filter(child => child !== role); });
    reject(input, /reachable/);
    for (const props of [{ hidden: true }, { disabled: true }, { readOnly: true }, { trigger: 'dialog' }]) {
      input = screenFixture(); Object.assign(input.spec.elements[role].props, props); reject(input, /hidden|trigger/);
    }
    input = screenFixture(); input.spec.elements[role].visible = false; reject(input, /hidden/);
    input = screenFixture(); input.spec.elements[role].on = { click: 'evil' }; reject(input, /competing/);
    input = screenFixture(); input.spec.elements[role].props.content = { $state: 'evil' }; reject(input, /competing/);
  }
  for (const role of ['answerReview', 'restart', 'result', 'question']) {
    const input = screenFixture(); input.spec.elements.extra = node('Text'); input.spec.elements[role].children.push('extra');
    reject(input, /leaf/);
  }
  for (const type of ['submit', 'reset']) {
    const input = screenFixture(); input.spec.elements.restart.props.type = type; reject(input, /type button/);
  }
});

for (const kind of ['quiz', 'selection', 'filter']) test(`${kind}: emits parseable function bodies and detached JSON without mutating inputs`, () => {
  const input = fixture(kind), original = clone(input);
  const program = compile(frozen(input));
  assert.deepEqual(input, original);
  assert.deepEqual(Object.keys(program), ['initial', 'reduce', 'render', 'bind', 'output']);
  assert.deepEqual(JSON.parse(JSON.stringify(program.initial)), program.initial);
  assert.notEqual(program.initial.data, input.descriptor.data);
  for (const [name, params] of [['reduce', 'state,action'], ['render', 'state,ui'], ['bind', 'ui,dispatch'], ['output', 'state']]) {
    assert.equal(typeof program[name], 'string');
    assert.doesNotThrow(() => new Function(params, program[name]));
    assert.doesNotMatch(program[name], /\b(?:window|globalThis|parent|top|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|setTimeout|setInterval|eval|innerHTML|outerHTML|insertAdjacentHTML)\b/);
  }
});

const invalidDescriptors = [
  ['unknown kind', d => { d.kind = 'cart'; }, /kind/],
  ['unsupported todo', d => { d.kind = 'todo'; }, /kind/],
  ['prototype kind', d => { d.kind = '__proto__'; }, /kind/],
  ['unknown executable field', d => { d.js = 'alert(1)'; }, /descriptor.js/],
  ['missing role', d => { delete d.bindings.back; }, /bindings.back/],
  ['unknown role', d => { d.bindings.reset = 'next'; }, /bindings.reset/],
  ['duplicate role', d => { d.bindings.progress = 'question'; }, /unique/],
  ['unsafe ID', d => { d.bindings.choices = 'x"] button'; }, /safe ID/],
  ['long ID', d => { d.bindings.choices = 'x'.repeat(65); }, /safe ID/],
  ['reserved ID', d => { d.bindings.choices = 'constructor'; }, /safe ID/],
  ['no questions', d => { d.data.questions = []; }, /1..50/],
  ['too many questions', d => { d.data.questions = Array.from({ length: 51 }, (_, i) => ({ ...d.data.questions[0], id: 'q' + i })); }, /1..50/],
  ['duplicate question ID', d => { d.data.questions[1].id = 'q0'; }, /unique/],
  ['blank question', d => { d.data.questions[0].text = ' '; }, /nonblank/],
  ['long question', d => { d.data.questions[0].text = 'q'.repeat(2001); }, /2000/],
  ['unknown question field', d => { d.data.questions[0].render = 'evil'; }, /unsupported/],
  ['one option', d => { d.data.questions[0].options.pop(); }, /2..12/],
  ['too many options', d => { d.data.questions[0].options = Array.from({ length: 13 }, (_, i) => ({ value: 'v' + i, label: 'Option', score: i })); }, /2..12/],
  ['duplicate value', d => { d.data.questions[0].options[1].value = 'yes'; }, /unique/],
  ['missing score', d => { delete d.data.questions[0].options[0].score; }, /score/],
  ['string score', d => { d.data.questions[0].options[0].score = '5'; }, /score/],
  ['huge score', d => { d.data.questions[0].options[0].score = 1000001; }, /score/],
  ['unknown data', d => { d.data.code = 'evil'; }, /unsupported/],
  ['blank result label', d => { d.data.resultLabel = ''; }, /nonblank/]
];
for (const [name, change, pattern] of invalidDescriptors) test(`rejects descriptor: ${name}`, () => {
  const input = fixture(); change(input.descriptor); reject(input, pattern);
});

test('rejects non-JSON data without executing accessors or toJSON', () => {
  let executions = 0;
  const accessor = {}; Object.defineProperty(accessor, 'value', { enumerable: true, get() { executions++; return 1; } });
  const cyclic = {}; cyclic.self = cyclic;
  const sparse = []; sparse.length = 10;
  const extended = [1]; extended.extra = 2;
  const hidden = {}; Object.defineProperty(hidden, 'x', { value: 1 });
  const symbol = { [Symbol('bad')]: 1 };
  const toJSON = { toJSON() { executions++; return {}; } };
  for (const bad of [undefined, NaN, Infinity, BigInt(1), () => 1, new Date(), new Map(), accessor, cyclic, sparse, extended, hidden, symbol, toJSON, Object.create({ x: 1 })]) {
    const input = fixture(); input.descriptor.data.bad = bad; reject(input, /plain JSON|JSON data|dense JSON|cycle/);
  }
  assert.equal(executions, 0);
});

test('bounds aggregate characters, JSON depth, node count and spec size', () => {
  const huge = fixture(); huge.descriptor.data.padding = 'a'.repeat(131073); reject(huge, /character limit/);
  const deep = fixture(); let nested = deep.descriptor.data; for (let i = 0; i < 34; i++) nested = nested.child = {}; reject(deep, /complexity/);
  const many = fixture(); many.descriptor.data.padding = Array.from({ length: 20001 }, () => 0); reject(many, /bounded|complexity/);
  const nodes = fixture(); for (let i = 0; i < 2049; i++) nodes.spec.elements['extra' + i] = { type: 'Text' }; reject(nodes, /2048/);
});

const invalidSpecs = [
  ['missing bound element', s => { delete s.elements.choices; }, /missing/],
  ['unreachable bound element', s => { s.elements.page.children = s.elements.page.children.filter(id => id !== 'choices'); }, /reachable/],
  ['wrong native type', s => { s.elements.choices.type = 'Select'; }, /RadioGroup/],
  ['nonleaf role', s => { s.elements.extra = node('Text'); s.elements.question.children = ['extra']; }, /leaf/],
  ['hidden ancestor', s => { s.elements.page.visible = false; }, /hidden/],
  ['disabled ancestor', s => { s.elements.page.type = 'Fieldset'; s.elements.page.props.disabled = true; }, /disabled/],
  ['unsupported ancestor', s => { s.elements.page.type = 'Tabs'; }, /ancestor/],
  ['disabled control', s => { s.elements.next.props.disabled = true; }, /disabled/],
  ['loading control', s => { s.elements.next.props.loading = true; }, /disabled/],
  ['button trigger', s => { s.elements.next.props.trigger = 'dialog'; }, /trigger/],
  ['submit button', s => { s.elements.next.props.type = 'submit'; }, /type button/],
  ['state handler', s => { s.elements.next.on = { click: { set: 'index' } }; }, /competing/],
  ['state expression', s => { s.elements.question.props.content = { $state: 'title' }; }, /state expressions/],
  ['duplicate roots', s => { s.elements.page.children.push('choices'); }, /repeated/],
  ['orphan duplicates binding', s => { s.elements.orphan = node('Stack', {}, ['choices']); }, /repeated/],
  ['cycle', s => { s.elements.page.children.push('page'); }, /cyclic/],
  ['ambiguous children', s => { s.elements.page.props.children = ['next']; }, /together/],
  ['prop-held reference', s => { s.elements.extra = node('List', { items: ['choices'] }); }, /prop-held/],
  ['role in destructive group', s => { s.elements.choices.children = ['question']; s.elements.page.children = s.elements.page.children.filter(id => id !== 'question'); }, /ancestor|leaf/]
];
for (const [name, change, pattern] of invalidSpecs) test(`rejects incompatible layout: ${name}`, () => {
  const input = fixture(); change(input.spec); reject(input, pattern);
});

test('supports Card footer slots and props.children without mutation', () => {
  const input = fixture(); input.spec.elements.page.type = 'Card';
  input.spec.elements.page.props.footer = ['back', 'next'];
  input.spec.elements.page.children = ['question', 'choices', 'progress', 'result', 'back', 'next'];
  delete input.spec.elements.navigation;
  input.spec.elements.page.props.children = input.spec.elements.page.children;
  delete input.spec.elements.page.children;
  assert.doesNotThrow(() => compile(frozen(input)));
});

test('allows literal names, labels, content and values equal to spec IDs', () => {
  const quiz = fixture();
  quiz.spec.elements.choices.props.name = 'choices';
  quiz.spec.elements.choices.props.label = 'choices';
  quiz.spec.elements.question.props.content = 'question';
  quiz.spec.elements.next.props.label = 'next';
  quiz.spec.elements.next.props.id = 'next';
  quiz.spec.elements.unrelated = node('Badge', { text: 'question' });
  assert.doesNotThrow(() => compile(quiz));
  const filter = fixture('filter');
  filter.spec.elements.query = node('Input', { name: 'query', label: 'query', value: 'query' });
  assert.doesNotThrow(() => compile(filter));
});

test('filter validates direct child IDs and rejects nested bindings or competing item visibility', () => {
  let input = fixture('filter'); input.descriptor.data.items[0].id = 'unknown'; reject(input, /exactly match/);
  input = fixture('filter'); input.descriptor.data.items.pop(); reject(input, /exactly match/);
  input = fixture('filter'); input.descriptor.data.items[0].id = 'alpha-description'; reject(input, /exactly match/);
  input = fixture('filter'); input.spec.elements.alpha.visible = false; reject(input, /hidden items/);
  input = fixture('filter'); input.spec.elements.page.children = ['query', 'items'];
  input.spec.elements.alpha.children.push('count'); reject(input, /another bound role/);
});

test('selection/filter reject mismatched data and unsupported controls', () => {
  let input = fixture('selection'); input.descriptor.data.initialValue = 'unknown'; reject(input, /initialValue/);
  input = fixture('selection'); input.descriptor.data.options = []; reject(input, /1..100/);
  input = fixture('selection'); input.descriptor.data.options = Array.from({ length: 101 }, (_, i) => ({ value: 'v' + i, label: 'Option' })); reject(input, /1..100/);
  input = fixture('filter'); input.descriptor.data.items[1].id = 'alpha'; reject(input, /unique/);
  input = fixture('filter'); input.descriptor.data.items = Array.from({ length: 201 }, (_, i) => ({ id: 'i' + i, label: 'Item' })); reject(input, /0..200/);
  for (const type of ['number', 'email', 'hidden', 'checkbox']) {
    input = fixture('filter'); input.spec.elements.query = node('Input', { type }); reject(input, /text\/search/);
  }
  input = fixture('filter'); input.spec.elements.query.props.readOnly = true; reject(input, /read-only/);
});

test('quiz reducer preserves edited answers across N steps and projects numeric scores', () => {
  const m = machine(fixture());
  assert.deepEqual(m.output(), { completed: false, step: 1, total: 10, answers: [], result: null });
  const first = m.state();
  for (const action of [null, {}, { type: 'BACK' }, { type: 'NEXT' }, { type: 'SELECT', questionId: 'q1', value: 'yes' }, { type: 'SELECT', questionId: 'q0', value: 'unknown' }]) m.dispatch(action);
  assert.equal(m.state(), first);
  for (let i = 0; i < 10; i++) {
    m.dispatch({ type: 'SELECT', questionId: 'q' + i, value: 'yes' }); m.dispatch({ type: 'NEXT' });
  }
  assert.equal(m.output().result, 55);
  assert.equal(m.output().completed, true);
  assert.equal(m.output().answers.length, 10);
  assert.equal(m.output().step, 10);
  m.dispatch({ type: 'SELECT', questionId: 'q9', value: 'no' }); assert.equal(m.output().result, 55);
  m.dispatch({ type: 'BACK' }); assert.equal(m.output().step, 10); assert.equal(m.output().result, null);
  m.dispatch({ type: 'BACK' }); assert.equal(m.output().step, 9);
  m.dispatch({ type: 'SELECT', questionId: 'q8', value: 'no' });
  m.dispatch({ type: 'NEXT' }); m.dispatch({ type: 'NEXT' });
  assert.equal(m.output().result, 45);
  assert.deepEqual(m.output().answers[8], { questionId: 'q8', question: 'Question 9', answer: 'No 9', value: 'no', score: -1 });
  assert.ok(Object.isFrozen(m.state().answers));
});

test('quiz handles single-step and maximum-size flows without off-by-one errors', () => {
  for (const count of [1, 50]) {
    const input = fixture('quiz', count), m = machine(input);
    for (let i = 0; i < count; i++) { m.dispatch({ type: 'SELECT', questionId: 'q' + i, value: 'yes' }); m.dispatch({ type: 'NEXT' }); }
    assert.equal(m.output().result, count * (count + 1) / 2);
    assert.equal(m.output().step, count);
    m.dispatch({ type: 'NEXT' }); assert.equal(m.output().step, count);
    m.dispatch({ type: 'BACK' }); assert.equal(m.output().step, count); assert.equal(m.output().completed, false);
  }
});

test('selection defaults and filter normalization remain plain deterministic projections', () => {
  const input = fixture('selection'); input.descriptor.data.initialValue = 'pro';
  const selection = machine(input);
  assert.deepEqual(selection.output(), { completed: true, selected: 'pro', label: 'Pro', total: 3 });
  selection.dispatch({ type: 'SELECT', value: 'unknown' }); assert.equal(selection.output().selected, 'pro');
  const filter = machine(fixture('filter'));
  assert.deepEqual(filter.dispatch({ type: 'QUERY', value: '  ALpHa  ' }), { query: '  ALpHa  ', visibleIds: ['alpha', 'gamma'], count: 2, total: 3 });
  assert.equal(filter.dispatch({ type: 'QUERY', value: 'a'.repeat(500) }).query.length, 200);
  assert.equal(filter.dispatch({ type: 'QUERY', value: 42 }).query.length, 200);
  assert.equal(filter.dispatch({ type: 'QUERY', value: '' }).count, 3);
});

let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => { await browser?.close(); });
const scriptJSON = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
async function open(t, input, width, exported = false) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, ...(width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  t.after(() => context.close());
  const requests = [], errors = [];
  await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
  const page = await context.newPage(); page.setDefaultTimeout(4000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}iframe{display:block;border:0;width:100%;height:850px}</style><iframe title="Recipe preview" sandbox="allow-scripts"></iframe>');
  const program = compile(input);
  const setup = `var preview=document.getElementById('preview');var errors=[];var snapshots=[];var controller=null;
    var spec=${scriptJSON(input.spec)};var program=${scriptJSON(program)};
    Object.values(spec.elements).forEach(function(node){if(node.props&&node.props.media==='blob:recipe-fixture')node.props.media=URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="green"/></svg>'],{type:'image/svg+xml'}));});
    var render=DAUB_RENDER_FACTORY();preview.appendChild(render.renderElement(spec.elements,spec.root,0));render.renderOrphans(spec,preview);
    var roots=Array.from(preview.querySelectorAll('[data-spec-id]'));
    var globalsBefore=Reflect.ownKeys(window);
    var reportError=function(error){errors.push({phase:error.phase,message:error.message});};
    controller=${exported ? behavior.toScript(program) : 'DaubBehavior.mount(preview,program,reportError)'};
    controller.subscribe(function(value){snapshots.push(value);});`;
  const html = '<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\';script-src \'unsafe-inline\' \'unsafe-eval\';style-src \'unsafe-inline\';img-src blob:">' +
    '<style>' + css + '</style><style>body{margin:0;padding:16px}*{box-sizing:border-box}iframe{max-width:100%}</style></head><body><main id="preview"></main>' +
    '<script>' + renderer + '</script>' + (exported ? '' : '<script>' + runtime + '</script>') + '<script>' + setup + '</script></body></html>';
  await page.locator('iframe').evaluate((frame, html) => { frame.srcdoc = html; }, html);
  const frame = await page.locator('iframe').elementHandle().then(handle => handle.contentFrame());
  await frame.waitForFunction(() => typeof controller !== 'undefined' && controller?.getOutput() !== null);
  assert.equal(await frame.evaluate(() => innerWidth), width, 'iframe must use the requested viewport width');
  t.after(async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, [], 'recipes should make no network requests');
  });
  return { page, frame, program, output: () => frame.evaluate(() => DaubPrototype.getOutput()) };
}
async function sound(frame) {
  const result = await frame.evaluate(() => ({
    errors, rootsStable: roots.every(root => root.isConnected && preview.contains(root)),
    ids: Array.from(preview.querySelectorAll('[data-spec-id]'), node => node.getAttribute('data-spec-id')),
    globals: Reflect.ownKeys(window).filter(key => !globalsBefore.includes(key)),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    origin: self.origin
  }));
  assert.deepEqual(result.errors, []);
  assert.equal(result.rootsStable, true);
  assert.equal(result.ids.length, new Set(result.ids).size);
  assert.deepEqual(result.globals, ['DaubPrototype']);
  assert.equal(result.overflow, false);
  assert.equal(result.origin, 'null');
}

for (const width of [1440, 390]) test(`quiz: complete ten questions, back/edit/recomplete, numeric output and stable roots at ${width}px`, async t => {
  const { frame, output } = await open(t, fixture(), width);
  assert.equal(await frame.getByRole('button', { name: 'Back', exact: true }).isDisabled(), true);
  assert.equal(await frame.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true);
  for (let i = 0; i < 10; i++) {
    assert.equal(await frame.locator('[data-spec-id="question"]').textContent(), 'Question ' + (i + 1));
    const radio = frame.getByRole('radio', { name: 'Yes ' + (i + 1), exact: true });
    await frame.locator('label').filter({ has: radio }).click();
    if (i === 0) {
      await radio.focus(); await frame.evaluate(() => controller.dispatch({ type: 'UNKNOWN' }));
      assert.equal(await radio.evaluate(el => el === el.ownerDocument.activeElement), true);
    }
    await frame.getByRole('button', { name: 'Next', exact: true }).click();
  }
  assert.deepEqual(await output(), { completed: true, step: 10, total: 10, answers: Array.from({ length: 10 }, (_, i) => ({ questionId: 'q' + i, question: 'Question ' + (i + 1), answer: 'Yes ' + (i + 1), value: 'yes', score: i + 1 })), result: 55 });
  assert.equal(await frame.locator('[data-spec-id="result"]').textContent(), 'Result: 55');
  assert.equal(await frame.getByRole('radio', { name: 'Yes 10', exact: true }).isDisabled(), true);
  assert.equal(await frame.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true);
  await frame.getByRole('button', { name: 'Back', exact: true }).click();
  assert.equal((await output()).step, 10);
  await frame.getByRole('button', { name: 'Back', exact: true }).click();
  assert.equal(await frame.getByRole('radio', { name: 'Yes 9', exact: true }).isChecked(), true);
  await frame.locator('label').filter({ has: frame.getByRole('radio', { name: 'No 9', exact: true }) }).click();
  await frame.getByRole('button', { name: 'Next', exact: true }).click();
  assert.equal(await frame.getByRole('radio', { name: 'Yes 10', exact: true }).isChecked(), true);
  await frame.getByRole('button', { name: 'Next', exact: true }).click();
  assert.equal((await output()).result, 45);
  await sound(frame);
  await frame.locator('body').screenshot({ path: '/tmp/daub-behavior-recipes-quiz-' + width + '.png' });
});

for (const exported of [false, true]) for (const width of [1440, 390]) test(`quiz screens: ten answers, results, reopen/edit and restart (${exported ? 'export' : 'mount'}, ${width}px)`, async t => {
  const input = screenFixture();
  const hostile = '</script><img src="https://invalid.example/attack" onerror="globalThis.attacked=1">';
  input.descriptor.data.questions[0].text = hostile;
  input.descriptor.data.questions[0].options[0].label = hostile;
  const { frame, output } = await open(t, input, width, exported);
  const questionScreen = frame.locator('[data-spec-id="questionScreen"]');
  const resultScreen = frame.locator('[data-spec-id="resultScreen"]');
  const review = frame.locator('[data-spec-id="answerReview"]');
  const score = frame.locator('[data-spec-id="result"]');
  async function screens(completed) {
    assert.equal(await questionScreen.isVisible(), !completed);
    assert.equal(await resultScreen.isVisible(), completed);
    assert.equal(await questionScreen.evaluate(el => el.hidden), completed);
    assert.equal(await resultScreen.evaluate(el => el.hidden), !completed);
  }
  await screens(false);
  assert.equal(await review.textContent(), '');
  for (let i = 0; i < 10; i++) {
    await frame.locator('.db-radio').first().click();
    await frame.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await screens(true);
  const completed = await output();
  assert.equal(completed.completed, true); assert.equal(completed.result, 55);
  assert.equal(completed.answers.length, 10);
  assert.equal(await score.textContent(), 'Result: 55');
  assert.equal(await review.textContent(), completed.answers.map(answer => answer.question + ': ' + answer.answer).join('\n'));
  assert.equal(await review.locator('*').count(), 0);
  assert.equal(await frame.evaluate(() => typeof attacked), 'undefined');
  assert.equal(await frame.evaluate(() => typeof DaubBehavior), exported ? 'undefined' : 'object');
  await frame.evaluate(() => controller.dispatch({ type: 'BACK' }));
  await screens(false);
  assert.equal((await output()).step, 10);
  assert.equal((await output()).answers.length, 10);
  assert.equal((await output()).result, null);
  assert.equal(await review.textContent(), ''); assert.equal(await score.textContent(), '');
  assert.equal(await frame.getByRole('radio', { name: 'Yes 10', exact: true }).isChecked(), true);
  await frame.getByRole('button', { name: 'Back', exact: true }).click();
  await frame.locator('.db-radio').last().click();
  await frame.getByRole('button', { name: 'Next', exact: true }).click();
  await frame.getByRole('button', { name: 'Next', exact: true }).click();
  await screens(true);
  assert.equal((await output()).result, 45);
  assert.match(await review.textContent(), /Question 9: No 9/);
  await sound(frame);
  await frame.locator('body').screenshot({ path: `/tmp/daub-recipe-results-${exported ? 'export' : 'mount'}-${width}.png` });
  await frame.getByRole('button', { name: 'Restart', exact: true }).click();
  await screens(false);
  assert.deepEqual(await output(), { completed: false, step: 1, total: 10, answers: [], result: null });
  assert.deepEqual(await frame.evaluate(() => controller.getState().answers), Array(10).fill(null));
  assert.equal(await review.textContent(), ''); assert.equal(await score.textContent(), '');
  assert.equal(await frame.locator('input:checked').count(), 0);
  assert.equal(await frame.getByRole('button', { name: 'Back', exact: true }).isDisabled(), true);
  assert.equal(await frame.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true);
  await frame.locator('.db-radio').last().click();
  await frame.getByRole('button', { name: 'Next', exact: true }).click();
  assert.equal((await output()).step, 2);
  assert.equal((await output()).answers.length, 1);
  assert.equal(await frame.locator('input:checked').count(), 0);
  await frame.evaluate(() => controller.dispatch({ type: 'RESTART' }));
  assert.deepEqual(await output(), { completed: false, step: 1, total: 10, answers: [], result: null });
  await sound(frame);
});

for (const width of [1440, 390]) test(`selection: initial value, keyboard choice and detached subscription output at ${width}px`, async t => {
  const input = fixture('selection'); input.descriptor.data.initialValue = 'pro';
  const { frame, output } = await open(t, input, width);
  const radio = frame.getByRole('radio', { name: 'Pro', exact: true });
  assert.equal(await radio.isChecked(), true);
  await radio.focus(); await radio.press('ArrowDown');
  assert.deepEqual(await output(), { completed: true, selected: 'team', label: 'Team', total: 3 });
  assert.equal(await frame.locator('[data-spec-id="summary"]').textContent(), 'Team');
  const check = await frame.evaluate(() => {
    const first = controller.getOutput(), second = controller.getOutput();
    return { detached: first !== second, frozen: Object.isFrozen(first), snapshots };
  });
  assert.equal(check.detached, true); assert.equal(check.frozen, true);
  assert.deepEqual(check.snapshots.map(value => value.selected), ['pro', 'team']);
  await sound(frame);
});

for (const width of [1440, 390]) test(`filter: search, clear, no matches, focus and canonical count at ${width}px`, async t => {
  const data = fixture('filter');
  data.spec.elements.items.type = width === 390 ? 'Stack' : 'Grid';
  const { frame, output } = await open(t, data, width);
  await frame.evaluate(() => {
    preview.__itemNodes = ['alpha', 'beta', 'gamma'].map(id => preview.querySelector('[data-spec-id="' + id + '"]'));
    preview.__itemMarkup = preview.__itemNodes.map(node => node.innerHTML);
    preview.__images = Array.from(preview.querySelectorAll('img'));
  });
  await frame.waitForFunction(() => preview.__images.length === 3 && preview.__images.every(image => image.complete && image.naturalWidth > 0));
  const input = frame.getByRole('searchbox');
  await input.fill('  ALpHa  ');
  assert.deepEqual(await output(), { query: '  ALpHa  ', visibleIds: ['alpha', 'gamma'], count: 2, total: 3 });
  assert.equal(await frame.locator('[data-spec-id="items"] > [data-spec-id]:visible').count(), 2);
  assert.equal(await input.evaluate(el => el === el.ownerDocument.activeElement), true);
  await input.fill('['); assert.equal((await output()).count, 0);
  assert.equal(await frame.locator('[data-spec-id="items"] > [data-spec-id]:visible').count(), 0);
  await frame.getByRole('button', { name: 'Clear search' }).click();
  assert.equal(await input.inputValue(), ''); assert.equal((await output()).count, 3);
  assert.equal(await input.evaluate(el => el === el.ownerDocument.activeElement), true);
  assert.equal(await frame.locator('[data-spec-id="count"]').textContent(), '3 of 3');
  assert.deepEqual(await frame.evaluate(() => preview.__itemNodes.map((node, index) => node.isConnected && node.innerHTML === preview.__itemMarkup[index])), [true, true, true]);
  assert.equal(await frame.evaluate(() => preview.__images.every(image => image.isConnected && image.naturalWidth > 0)), true);
  await sound(frame);
});

test('labeled and bare Inputs support filtering and empty datasets', async t => {
  for (const labeled of [true, false]) {
    const input = fixture('filter'); input.spec.elements.query = node('Input', labeled ? { label: 'Filter items' } : { ariaLabel: 'Filter items' });
    input.descriptor.data.items = [];
    input.spec.elements.items.children.forEach(id => { delete input.spec.elements[id + '-description']; delete input.spec.elements[id]; });
    input.spec.elements.items.children = [];
    const { frame, output } = await open(t, input, 390);
    await frame.getByRole('textbox', { name: 'Filter items' }).fill('x');
    assert.deepEqual(await output(), { query: 'x', visibleIds: [], count: 0, total: 0 });
    await sound(frame);
  }
});

test('opaque exported controller treats hostile labels and values as text, with no runtime module dependency', async t => {
  const input = fixture('quiz', 1);
  const hostile = '</script><img src="https://invalid.example/attack" onerror="globalThis.attacked=1">\u2028\u2029';
  input.descriptor.data.questions[0].text = hostile;
  input.descriptor.data.questions[0].options[0].label = hostile;
  input.descriptor.data.questions[0].options[0].value = '";globalThis.attacked=1;//';
  input.descriptor.data.resultLabel = hostile;
  const { frame, output, program } = await open(t, input, 390, true);
  assert.ok(Object.values(program).filter(value => typeof value === 'string').every(value => !value.includes(hostile)));
  assert.equal(await frame.locator('[data-spec-id="question"]').textContent(), hostile);
  await frame.locator('.db-radio').first().click();
  await frame.getByRole('button', { name: 'Next', exact: true }).click();
  assert.equal((await output()).result, 1);
  assert.equal(await frame.locator('[data-spec-id="result"]').textContent(), hostile + ': 1');
  assert.deepEqual(await frame.evaluate(() => {
    let parentBlocked = false, storageBlocked = false;
    try { parent.document.body; } catch (_) { parentBlocked = true; }
    try { localStorage.getItem('recipe'); } catch (_) { storageBlocked = true; }
    return { attacked: typeof attacked, runtime: typeof DaubBehavior, images: preview.querySelectorAll('img').length, parentBlocked, storageBlocked };
  }), { attacked: 'undefined', runtime: 'undefined', images: 0, parentBlocked: true, storageBlocked: true });
  await sound(frame);
});

test('recipe disposal and remount remove old listeners and refresh existing option nodes', async t => {
  const { frame } = await open(t, fixture('selection'), 390);
  await frame.locator('label').filter({ has: frame.getByRole('radio', { name: 'Pro', exact: true }) }).click();
  await frame.evaluate(() => {
    controller.dispose();
    program.initial.data.options[0].label = 'Updated free plan';
    controller = DaubBehavior.mount(preview, program, reportError);
    snapshots.length = 0; controller.subscribe(value => snapshots.push(value));
  });
  await frame.locator('label').filter({ has: frame.getByRole('radio', { name: 'Updated free plan', exact: true }) }).click();
  assert.deepEqual(await frame.evaluate(() => snapshots.map(value => value.selected)), [null, 'free']);
  await frame.evaluate(() => controller.dispose());
  await frame.locator('label').filter({ has: frame.getByRole('radio', { name: 'Pro', exact: true }) }).click();
  assert.deepEqual(await frame.evaluate(() => ({ output: controller.getOutput(), values: snapshots.map(value => value.selected), errors })), { output: null, values: [null, 'free'], errors: [] });
});
