import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../../playground-behavior-recipes.js', import.meta.url), 'utf8'), context);
vm.runInContext(readFileSync(new URL('../../playground-hybrid-ui.js', import.meta.url), 'utf8'), context);
const { validateContract, normalizeProgram } = context.DaubHybridUI.create({});
const contract = () => ({ interactive: true, fixtures: '{"items":[]}', requirements: [{ id: 'list', targetId: 'list', when: 'present', text: 'Task list, empty initially' }], journeys: [{ id: 'add', complete: false, steps: [{ action: 'fill', targetId: 'name', value: 'Milk' }, { action: 'click', targetId: 'add', value: '' }, { action: 'assertText', targetId: 'list', value: 'Milk' }], outputAssertions: [] }] });

function brief() {
  return { title: 'Task list', summary: 'Create and review tasks.', assumptions: ['Local data only.'], outOfScope: ['Accounts'],
    screens: [
      { id: 'entry', title: 'Entry', phase: 'initial', targetIds: ['name'], layout: 'Single column.', content: 'Task input and add action.', journeyId: '' },
      { id: 'populated', title: 'Populated list', phase: 'interaction', targetIds: ['list'], layout: 'Rows below the input.', content: 'Created tasks.', journeyId: 'add' }
    ], flow: [{ from: 'entry', to: 'populated', action: 'Add a task.', guard: 'Nonempty task name.', journeyId: 'add' }],
    edgeCases: [{ scenario: 'First task in an empty list.', expected: 'Show the created task.', journeyId: 'add' }],
    outputs: [{ path: 'tasks', type: 'array', description: 'Current tasks.' }] };
}

test('new planning requires a concise brief while legacy contracts remain readable', () => {
  assert.throws(() => validateContract(contract(), true), /design brief is required/);
  assert.ok(validateContract(contract()));
  const input = { ...contract(), brief: brief() }, result = validateContract(input, true);
  assert.equal(result.brief.title, 'Task list');
  assert.equal(result.journeys[0].steps.at(-1).action, 'assertVisible');
  assert.equal(result.journeys[0].steps.at(-1).targetId, 'list');
  assert.equal(input.journeys[0].steps.length, 3);
});

test('brief screen visibility must hold after the last interaction', () => {
  const input = { ...contract(), brief: brief() };
  input.brief.screens[1].phase = 'complete';
  input.journeys[0].complete = true;
  input.journeys[0].steps.push({ action: 'assertVisible', targetId: 'list', value: '' }, { action: 'click', targetId: 'hide', value: '' }, { action: 'assertHidden', targetId: 'list', value: '' });
  const result = validateContract(input, true);
  assert.equal(result.journeys[0].steps.at(-1).action, 'assertVisible');
  assert.equal(result.journeys[0].steps.at(-1).targetId, 'list');
  assert.equal(result.journeys[0].steps.filter(step => step.action === 'assertVisible').length, 2);
  assert.equal(validateContract(result, true).journeys[0].steps.length, result.journeys[0].steps.length);
});

for (const [name, mutate, expected] of [
  ['missing flow', value => { value.flow = []; }, /unreachable/],
  ['unknown journey', value => { value.screens[1].journeyId = 'missing'; }, /reaching journey/],
  ['wrong completion journey', value => { value.screens[1].phase = 'complete'; }, /reaching journey/],
  ['unknown edge case journey', value => { value.edgeCases[0].journeyId = 'missing'; }, /test journey/],
  ['unsafe output path', value => { value.outputs[0].path = 'constructor.prototype'; }, /output path/],
  ['duplicate screen', value => { value.screens.push(value.screens[0]); }, /Duplicate/],
  ['oversized brief', value => { value.summary = 'x'.repeat(15000); }, /bounded/],
  ['missing output contract', value => { value.outputs = []; }, /needs flow, edge cases and outputs/]
]) test('brief validation rejects ' + name, () => {
  const input = { ...contract(), brief: brief() }; mutate(input.brief);
  assert.throws(() => validateContract(input, true), expected);
});

test('freezes explicit fixtures without inferring different initial data', () => {
  const input = contract(), result = validateContract(input);
  assert.equal(JSON.stringify(result.fixtures), '{"items":[]}');
  assert.equal(input.fixtures, '{"items":[]}');
  assert.throws(() => validateContract({ ...input, fixtures: '[]' }), /fixtures/);
});

test('rejects contradictory scalar and child output assertions before generation', () => {
  const input = contract();
  input.journeys[0].outputAssertions = [{ path: 'saved.name', operator: 'equals', value: '"Ada"' }, { path: 'saved', operator: 'equals', value: 'true' }];
  assert.throws(() => validateContract(input), /Scalar output/);
  input.journeys[0].outputAssertions.reverse();
  assert.throws(() => validateContract(input), /Scalar output/);
  input.journeys[0].outputAssertions = [{ path: 'count', operator: 'equals', value: '0' }, { path: 'count', operator: 'equals', value: '1' }];
  assert.throws(() => validateContract(input), /Conflicting/);
});

test('rejects explicitly conditional requirements marked initially visible', () => {
  const input = contract();
  input.requirements[0] = { id: 'recovery', targetId: 'recovery', when: 'initial', text: 'Recovery form, initially hidden' };
  assert.throws(() => validateContract(input), /Conditional requirement/);
  input.requirements[0].when = 'present';
  input.journeys[0].steps.unshift({ action: 'assertHidden', targetId: 'recovery', value: '' });
  assert.equal(validateContract(input).requirements[0].when, 'present');
});

test('normalizes named and anonymous function wrappers without executing hooks', () => {
  const program = { initial: '{"count":0}', reduce: 'function reduce(state, action) { return {...state,count:state.count+1}; }', render: 'function(state, ui) { throw new Error("must not execute"); }', bind: 'ui.on("next","click",()=>dispatch({type:"next"}));', output: 'function output(state) { return {count:state.count}; };' };
  const normalized = normalizeProgram(program);
  assert.equal(normalized.initial.count, 0);
  assert.equal(new Function('state', normalized.output)({ count: 2 }).count, 2);
  assert.match(normalized.render, /must not execute/);
  assert.throws(() => normalizeProgram({ ...program, output: 'function output(other) { return other; }' }), /parameters/);
  assert.throws(() => normalizeProgram({ ...program, reduce: 'return {' }), /Unexpected/);
});

test('recipe-first quiz compiles full deterministic journeys before the contract freezes', () => {
  const recipe = { kind: 'quiz', bindings: { question: 'question', choices: 'choices', back: 'back', next: 'next', progress: 'progress', result: 'result' }, data: { resultLabel: 'Your result', questions: Array.from({ length: 10 }, (_, i) => ({ id: 'q' + i, text: 'Question ' + i, options: [{ value: 'yes', label: 'Yes', score: 1 }, { value: 'no', label: 'No', score: 0 }] })) } };
  const input = { interactive: true, fixtures: '{}', recipe, requirements: [{ id: 'title', targetId: 'title', when: 'initial', text: 'Title' }], journeys: [] };
  const result = validateContract(input);
  assert.equal(result.journeys.length, 2);
  assert.equal(result.journeys[0].steps.filter(step => step.action === 'check').length, 10);
  assert.equal(result.journeys[0].steps.filter(step => step.action === 'click').length, 10);
  assert.equal(result.journeys[0].steps.length, 24);
  assert.equal(result.journeys[0].outputAssertions.find(assertion => assertion.path === 'result').value, '10');
  assert.equal(result.journeys[1].id, 'recipe-back');
  assert.equal(result.requirements.find(requirement => requirement.targetId === 'result').when, 'present');
  assert.equal(input.journeys.length, 0);
  recipe.data.questions[1].text = recipe.data.questions[0].text;
  assert.throws(() => validateContract(input), /distinct questions/);
});

test('one-question screen recipe checks answer retention without clicking hidden Back', () => {
  const recipe = { kind: 'quiz', bindings: { question: 'question', choices: 'choices', back: 'back', next: 'next', progress: 'progress', result: 'result', questionScreen: 'questions', resultScreen: 'results', answerReview: 'review', restart: 'restart' }, data: { resultLabel: 'Your result', questions: [{ id: 'q1', text: 'One question?', options: [{ value: 'yes', label: 'Yes', score: 1 }, { value: 'no', label: 'No', score: 0 }] }] } };
  const result = validateContract({ interactive: true, recipe, requirements: [{ id: 'question', targetId: 'question', text: 'Question' }], journeys: [] });
  assert.equal(result.journeys.length, 3);
  assert.equal(result.journeys[1].steps.some(step => step.action === 'click'), false);
  assert.equal(result.journeys[1].outputAssertions.find(item => item.path === 'completed').value, 'false');
  assert.equal(result.journeys[1].outputAssertions.find(item => item.path === 'answers.0.value').value, '"yes"');
});

test('recipe filter checks empty and restored outputs in separate fresh journeys', () => {
  const recipe = { kind: 'filter', bindings: { query: 'query', items: 'items', count: 'count' }, data: { items: [{ id: 'apple', label: 'Apple pie' }, { id: 'cake', label: 'Chocolate cake' }] } };
  const result = validateContract({ interactive: true, recipe, requirements: [{ id: 'search', targetId: 'query', when: 'initial', text: 'Search' }], journeys: [] });
  assert.equal(result.journeys[0].outputAssertions[0].value, '0');
  assert.equal(result.journeys[1].outputAssertions[0].value, '2');
  assert.equal(result.journeys[1].steps[1].value, '');
});
