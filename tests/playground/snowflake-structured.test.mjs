import { test } from 'node:test';
import assert from 'node:assert/strict';
import snowflake from '../../playground-snowflake.js';

const node = () => ({ id: 'page', type: 'Stack', props: [{ name: 'gap', value: 4 }], children: [] });
const wire = () => ({ root: 'page', elements: [node()] });

for (const stage of ['layout', 'refine', 'spacing']) test(`${stage} schema uses closed objects and defined recursive references`, () => {
  const format = snowflake.responseFormat(stage);
  assert.equal(format.type, 'json_schema');
  assert.equal(format.json_schema.strict, true);
  const schema = format.json_schema.schema;
  function check(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'object') {
      assert.equal(value.additionalProperties, false);
      assert.deepEqual(value.required, Object.keys(value.properties));
    }
    if (value.$ref) assert.equal(value.$ref, '#/$defs/value');
    Object.values(value).forEach(check);
  }
  check(schema);
  assert.ok(schema.$defs.value);
});

test('decodes nested options, objects, arrays and primitives without losing JSON data', () => {
  const input = wire();
  input.elements[0].type = 'RadioGroup';
  input.elements[0].props = [
    { name: 'selected', value: 'neutral' },
    { name: 'options', value: [{ entries: [{ name: 'label', value: 'Neutral' }, { name: 'value', value: 'neutral' }, { name: 'disabled', value: false }] }] },
    { name: 'metadata', value: { entries: [{ name: 'entries', value: [null, 4, true, { entries: [] }] }] } }
  ];
  assert.deepEqual(snowflake.decodeOutput(input, 'refine').elements.page.props, {
    selected: 'neutral', options: [{ label: 'Neutral', value: 'neutral', disabled: false }], metadata: { entries: [null, 4, true, {}] }
  });
});

test('spacing decodes only changed props, including a valid no-change response', () => {
  assert.deepEqual(snowflake.decodeOutput({ root: 'page', elements: [{ id: 'page', props: [{ name: 'gap', value: 6 }] }] }, 'spacing'), { root: 'page', elements: { page: { props: { gap: 6 } } } });
  assert.deepEqual(snowflake.decodeOutput({ root: 'page', elements: [] }, 'spacing'), { root: 'page', elements: {} });
});

for (const mutate of [
  s => { s.elements.push(node()); },
  s => { s.elements[0].props.push({ name: 'gap', value: 2 }); },
  s => { s.elements[0].id = '__proto__'; },
  s => { s.elements[0].props[0].name = 'constructor'; },
  s => { s.elements[0].type = 'Sidebar'; },
  s => { s.elements[0].children = [4]; },
  s => { s.elements[0].props[0].value = { arbitrary: true }; },
  s => { s.theme = 'dark'; },
  s => { s.elements = { page: node() }; },
]) test('rejects invalid structured response: ' + mutate.toString(), () => {
  const input = wire(); mutate(input);
  assert.throws(() => snowflake.decodeOutput(input, 'layout'));
});
