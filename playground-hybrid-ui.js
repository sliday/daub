(function(root) {
function createHybridUI(host) {
var { mainGenOpts, AUTO_MODEL, recursiveRequestError, parseSseResponse, VALID_TYPES, COMP_PROPS,
  collectCustomJS, buildIframeSrcdoc, showJsonError, applyPromptViewport, chatHistory,
  addChatBubble, updateChatState, $prompt, hideJsonError, setLoading,
  renderSpec, $json, refreshJsonTree, updatePreviewToolbar, saveChatState, $status,
  pushVersion, specVersions, buildResultBubble } = host;
var GENERATED_DOM_CONTRACT = 'data-spec-id may identify a wrapper. NumberField contains input[type="number"] and emits bubbling input/change on stepper clicks; listen to input for totals. List rows use .db-list__item and .db-list__title; delegate clicks to the closest row and map its index to props.items. RadioGroup contains native radio inputs. Use the existing markup and ONE controller. Never add diagnostic labels, raw state or test-only text to the page.';

function hybridObject(properties) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties: properties };
}

function hybridFormat(name, schema) {
  return { type: 'json_schema', json_schema: { name: name, strict: true, schema: schema } };
}

function hybridBriefSchema() {
  var text = { type: 'string', minLength: 1, maxLength: 700 }, id = { type: 'string', maxLength: 80 };
  function list(items, max, min) { return { type: 'array', items: items, minItems: min || 0, maxItems: max }; }
  return hybridObject({
    title: text, summary: text, assumptions: list(text, 4), outOfScope: list(text, 4),
    screens: list(hybridObject({ id: id, title: text, phase: { type: 'string', enum: ['initial', 'interaction', 'complete'] }, targetIds: list(id, 8, 1), layout: text, content: text, journeyId: id }), 6, 1),
    flow: list(hybridObject({ from: id, to: id, action: text, guard: text, journeyId: id }), 12),
    edgeCases: list(hybridObject({ scenario: text, expected: text, journeyId: id }), 6),
    outputs: list(hybridObject({ path: id, type: { type: 'string', enum: ['string', 'number', 'boolean', 'array', 'object', 'null'] }, description: text }), 8)
  });
}

function hybridBrief(value, contract) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 14000) throw new Error('Design brief must be a bounded object');
  function text(value, label, max, empty) {
    if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max) throw new Error('Invalid design brief ' + label);
  }
  function id(value, label) { if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value) || ['constructor', 'prototype'].includes(value)) throw new Error('Invalid design brief ' + label); }
  function list(value, label, min, max) { if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error('Invalid design brief ' + label); }
  text(value.title, 'title', 700); text(value.summary, 'summary', 700);
  ['assumptions', 'outOfScope'].forEach(function(key) { list(value[key], key, 0, 4); value[key].forEach(function(item) { text(item, key, 700); }); });
  list(value.screens, 'screens', 1, 6); list(value.flow, 'flow', 0, 12); list(value.edgeCases, 'edgeCases', 0, 6); list(value.outputs, 'outputs', 0, 8);
  var screens = new Map(), journeys = new Map(contract.journeys.map(function(journey) { return [journey.id, journey]; }));
  value.screens.forEach(function(screen) {
    if (!screen) throw new Error('Invalid design brief screen');
    id(screen.id, 'screen ID');
    if (screens.has(screen.id)) throw new Error('Duplicate design brief screen: ' + screen.id);
    ['title', 'layout', 'content'].forEach(function(key) { text(screen[key], 'screen ' + key, 700); });
    if (!['initial', 'interaction', 'complete'].includes(screen.phase)) throw new Error('Invalid design brief screen phase');
    list(screen.targetIds, 'screen targets', 1, 8);
    screen.targetIds.forEach(function(target) { id(target, 'target ID'); });
    if (new Set(screen.targetIds).size !== screen.targetIds.length) throw new Error('Duplicate design brief screen target');
    if (screen.phase === 'initial') {
      if (screen.journeyId !== '') throw new Error('Initial screen journeyId must be empty');
    } else {
      var journey = journeys.get(screen.journeyId);
      if (!journey || screen.phase === 'complete' && !journey.complete) throw new Error('Design brief screen needs a reaching journey: ' + screen.id);
      var lastInteraction = -1;
      journey.steps.forEach(function(step, index) { if (['click', 'fill', 'check', 'select'].includes(step.action)) lastInteraction = index; });
      screen.targetIds.forEach(function(target) {
        if (!journey.steps.slice(lastInteraction + 1).some(function(step) { return step.action === 'assertVisible' && step.targetId === target; })) journey.steps.push({ action: 'assertVisible', targetId: target, value: '' });
      });
      if (journey.steps.length > 40) throw new Error('Design brief screen checks exceed the journey step limit');
    }
    screens.set(screen.id, screen);
  });
  if (!value.screens.some(function(screen) { return screen.phase === 'initial'; })) throw new Error('Design brief needs an initial screen');
  value.flow.forEach(function(flow) {
    if (!flow || !screens.has(flow.from) || !screens.has(flow.to) || !journeys.has(flow.journeyId)) throw new Error('Design brief flow references an unknown screen or journey');
    text(flow.action, 'flow action', 700); text(flow.guard, 'flow guard', 700);
    var destination = screens.get(flow.to);
    if (destination.phase !== 'initial' && destination.journeyId !== flow.journeyId) throw new Error('Design brief flow must use its destination journey');
  });
  var reached = new Set(value.screens.filter(function(screen) { return screen.phase === 'initial'; }).map(function(screen) { return screen.id; }));
  for (var i = 0; i < value.screens.length; i++) value.flow.forEach(function(flow) { if (reached.has(flow.from)) reached.add(flow.to); });
  if (reached.size !== screens.size) throw new Error('Design brief has an unreachable screen');
  value.edgeCases.forEach(function(edge) {
    if (!edge || !journeys.has(edge.journeyId)) throw new Error('Design brief edge case needs a test journey');
    text(edge.scenario, 'edge case', 700); text(edge.expected, 'edge case outcome', 700);
  });
  var paths = new Set();
  value.outputs.forEach(function(output) {
    if (!output || typeof output.path !== 'string' || output.path.length > 80 || !output.path.split('.').every(function(part) { return /^[A-Za-z0-9_-]+$/.test(part) && !['__proto__', 'constructor', 'prototype'].includes(part); }) || paths.has(output.path)) throw new Error('Invalid or duplicate design brief output path');
    paths.add(output.path);
    if (!['string', 'number', 'boolean', 'array', 'object', 'null'].includes(output.type)) throw new Error('Invalid design brief output type');
    text(output.description, 'output description', 700);
  });
  if (contract.interactive && (!value.flow.length || !value.edgeCases.length || !value.outputs.length)) throw new Error('Interactive design brief needs flow, edge cases and outputs');
  return value;
}

function hybridSchema(stage) {
  var string = { type: 'string' };
  if (stage === 'contract') {
    var contractProperties = {
    brief: hybridBriefSchema(),
    interactive: { type: 'boolean' },
    fixtures: { type: 'string', description: 'JSON object defining the exact initial data, counts, prices and selections used by all journeys.' },
    requirements: { type: 'array', minItems: 1, maxItems: 8, items: hybridObject({ id: string, targetId: string, text: string, when: { type: 'string', enum: ['initial', 'complete', 'present'] } }) },
    journeys: { type: 'array', maxItems: 3, items: hybridObject({ id: string, complete: { type: 'boolean' }, outputAssertions: { type: 'array', maxItems: 8, items: hybridObject({ path: string, operator: { type: 'string', enum: ['equals', 'length'] }, value: string }) }, steps: { type: 'array', minItems: 1, maxItems: 40, items: { anyOf: [hybridObject({
      action: { type: 'string', enum: ['assertText'] }, targetId: string, value: { type: 'string', minLength: 1 }
    }), hybridObject({
      action: { type: 'string', enum: ['click', 'fill', 'check', 'select', 'remember', 'assertChanged', 'assertValue', 'assertVisible', 'assertHidden'] }, targetId: string, value: string
    })] } } }) }
    };
    if (root.DaubBehaviorRecipes) contractProperties.recipe = { anyOf: root.DaubBehaviorRecipes.descriptorSchema().anyOf.concat({ type: 'null' }) };
    return hybridFormat('hybrid_contract', hybridObject(contractProperties));
  }
  if (stage === 'behavior') {
    var properties = { initial: string, reduce: string, render: string, bind: string, output: string };
    if (root.DaubBehaviorRecipes) properties.recipe = { anyOf: root.DaubBehaviorRecipes.descriptorSchema().anyOf.concat({ type: 'null' }) };
    return hybridFormat('hybrid_behavior', hybridObject(properties));
  }
  var format = JSON.parse(JSON.stringify(DaubSnowflake.responseFormat('design')));
  format.json_schema.name = 'hybrid_' + stage;
  return format;
}

async function requestStructured(context, stage, system, data, activity) {
  var format = hybridSchema(stage);
  if (stage === 'behavior' && root.DaubBehaviorRecipes) system += '\nPrefer a tested recipe when its bindings, behavior and output exactly fit the frozen contract. Return recipe:{kind,bindings,data}, with initial/reduce/render/bind/output all empty strings. This compiles trusted local behavior without generated JS. Otherwise return recipe:null and the custom controller fields. Never force unsupported behavior into a recipe. Recipe contracts:\n' + JSON.stringify(root.DaubBehaviorRecipes.documentation.recipes);
  if (stage === 'behavior') system += '\nAlso return output as a synchronous JavaScript FUNCTION BODY string: output(state) returns a plain JSON OBJECT for an external reader. The runtime exposes it as window.DaubPrototype.getOutput() and subscribe(listener). Derive output from canonical state, without DOM reads, side effects or promises. For a quiz expose {completed,step,total,answers:[{questionId,question,answer}],result}; use null for result before completion. Include ALL requested distinct questions in initial state and preserve answers across Back/Next. Each answer record must correspond to its actual question and selected value. Require an answer before advancing, show the result after the final answer, and publish all N answers with completed:true only then. Hide completion-only panels until completion; keep their stable IDs in the DOM. Respect the frozen outputAssertions and execute the full requested workflow, not just the first screen. Do not transmit results or store sensitive answers.';
  for (var attempt = 0; attempt < 2; attempt++) {
    var result = await context.request(async function() {
    var id = crypto.randomUUID(), bytes = 0, local = new AbortController();
    function cancel() { local.abort(context.signal.reason); }
    context.signal.addEventListener('abort', cancel, { once: true });
    if (context.signal.aborted) cancel();
    function update(state) { activity({ id: id, stage: stage, state: state, bytes: bytes, attempt: attempt }); }
    update('waiting');
    try {
    var response = await fetch('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: local.signal,
      body: JSON.stringify(Object.assign({}, mainGenOpts(), {
        model: AUTO_MODEL, response_format: format, max_tokens: attempt ? 32768 : 16384, reasoning: { effort: 'low' },
        messages: [{ role: 'system', content: system + (attempt ? '\nThe previous attempt exceeded its output limit. Generate a fresh, compact complete response. Omit optional detail and repeated content. Keep required IDs and requirements. Do not continue the truncated JSON.' : '') }, { role: 'user', content: JSON.stringify(data) }]
      }))
    });
    if (!response.ok) throw await recursiveRequestError(response);
    if (response.body) response = new Response(response.body.pipeThrough(new TransformStream({ transform: function(chunk, stream) {
      bytes += chunk.byteLength; update('receiving'); stream.enqueue(chunk);
    } })), { status: response.status, headers: response.headers });
    return await parseSseResponse(response);
    } finally { context.signal.removeEventListener('abort', cancel); update('done'); }
    });
    if (result.finishReason === 'length' && !result.refused && attempt === 0) continue;
    if (!result.completed || result.refused || result.finishReason !== 'stop' || !result.content.trim()) {
      var error = new Error(stage + ' response incomplete: ' + (result.finishReason === 'length' ? 'output limit reached after one retry' : result.finishReason || 'empty stream'));
      error.code = 'HYBRID_RESPONSE_INVALID';
      throw error;
    }
    try { return JSON.parse(result.content); }
    catch (error) { error.code = 'HYBRID_RESPONSE_INVALID'; throw error; }
  }
}

function recipeContract(value) {
  if (!root.DaubBehaviorRecipes || value.interactive !== true) throw new Error('Recipe needs an interactive contract');
  var recipe = root.DaubBehaviorRecipes.validate(value.recipe), b = recipe.bindings, data = recipe.data;
  function step(action, targetId, value) { return { action: action, targetId: targetId, value: value == null ? '' : value }; }
  function output(path, value, operator) { return { path: path, operator: operator || 'equals', value: JSON.stringify(value) }; }
  function requireRole(role, when) {
    var requirement = value.requirements.find(function(item) { return item.targetId === b[role]; });
    if (requirement) requirement.when = when;
    else value.requirements.push({ id: 'recipe-' + role, targetId: b[role], text: role, when: when });
  }
  value.recipe = recipe;
  var steps = [], assertions = [];
  if (recipe.kind === 'quiz') {
    if (data.questions.length > 18) throw new Error('Recipe journeys support at most 18 questions within the 40-step bound');
    if (new Set(data.questions.map(function(question) { return question.text.trim().toLowerCase(); })).size !== data.questions.length) throw new Error('Quiz recipe needs distinct questions');
    ['question', 'choices', 'back', 'next', 'progress'].forEach(function(role) { requireRole(role, 'initial'); });
    requireRole('result', 'present');
    steps.push(step('assertText', b.question, data.questions[0].text));
    data.questions.forEach(function(question) { steps.push(step('check', b.choices, question.options[0].value), step('click', b.next)); });
    steps.push(step('assertText', b.progress, data.questions.length + ' of ' + data.questions.length), step('assertVisible', b.result), step('assertText', b.result, data.resultLabel));
    assertions = [output('answers', data.questions.length, 'length'), output('completed', true), output('result', data.questions.reduce(function(sum, question) { return sum + question.options[0].score; }, 0))];
    value.journeys = [{ id: 'recipe-complete', complete: true, steps: steps, outputAssertions: assertions }, {
      id: 'recipe-back', complete: false,
      steps: [step('check', b.choices, data.questions[0].options[0].value), step('click', b.next), step('click', b.back), step('assertText', b.question, data.questions[0].text)],
      outputAssertions: [output('step', 1), output('completed', false), output('answers.0.value', data.questions[0].options[0].value)]
    }];
    if (data.questions.length === 1) value.journeys[1].steps = [step('check', b.choices, data.questions[0].options[0].value), step('assertText', b.question, data.questions[0].text)];
    if (b.resultScreen) {
      steps.splice(steps.findIndex(function(item) { return item.action === 'assertText' && item.targetId === b.progress; }), 1);
      requireRole('resultScreen', 'present');
      steps.push(step('assertVisible', b.resultScreen), step('assertHidden', b.questionScreen));
      var restartSteps = [];
      data.questions.forEach(function(question) { restartSteps.push(step('check', b.choices, question.options[0].value), step('click', b.next)); });
      restartSteps.push(step('click', b.restart), step('assertVisible', b.questionScreen), step('assertHidden', b.resultScreen), step('assertText', b.question, data.questions[0].text));
      value.journeys.push({ id: 'recipe-restart', complete: false, steps: restartSteps,
        outputAssertions: [output('step', 1), output('completed', false), output('answers', 0, 'length'), output('result', null)] });
    }
  } else if (recipe.kind === 'filter') {
    requireRole('query', 'initial'); requireRole('count', 'initial'); requireRole('items', 'present');
    var absent = '__no_match__';
    while (data.items.some(function(item) { return item.label.toLowerCase().includes(absent); }) && absent.length < 200) absent += 'x';
    if (data.items.some(function(item) { return item.label.toLowerCase().includes(absent); })) throw new Error('Cannot construct bounded empty-filter fixture');
    if (data.items.length) {
      var query = data.items[0].label.slice(0, 200);
      var matching = data.items.filter(function(item) { return item.label.toLowerCase().includes(query.trim().toLowerCase()); }).length;
      steps.push(step('fill', b.query, query), step('assertText', b.count, matching + ' of ' + data.items.length));
    }
    steps.push(step('fill', b.query, absent), step('assertText', b.count, '0 of ' + data.items.length));
    value.journeys = [{ id: 'recipe-empty', complete: false, steps: steps, outputAssertions: [output('count', 0), output('visibleIds', 0, 'length')] }, {
      id: 'recipe-restore', complete: false,
      steps: [step('fill', b.query, absent), step('fill', b.query, ''), step('assertText', b.count, data.items.length + ' of ' + data.items.length)],
      outputAssertions: [output('count', data.items.length), output('visibleIds', data.items.map(function(item) { return item.id; }))]
    }];
  } else {
    requireRole('choices', 'initial'); requireRole('summary', 'present');
    var choice = data.options.find(function(item) { return item.value !== data.initialValue; }) || data.options[0];
    value.journeys = [{ id: 'recipe-select', complete: true,
      steps: [step('check', b.choices, choice.value), step('assertText', b.summary, choice.label)],
      outputAssertions: [output('completed', true), output('selected', choice.value), output('label', choice.label)]
    }];
  }
  if (value.requirements.length > 8) throw new Error('Recipe bindings and requested regions exceed eight requirements');
  return value;
}

function hybridContract(value, requireBrief) {
  if (!value || typeof value.interactive !== 'boolean' || !Array.isArray(value.requirements) || !value.requirements.length || value.requirements.length > 8 || !Array.isArray(value.journeys) || value.journeys.length > 3) throw new Error('Hybrid needs 1 to 8 region requirements and at most 3 journeys; keep question datasets in controller state, not separate visible requirements');
  value = JSON.parse(JSON.stringify(value));
  if (value.recipe != null) value = recipeContract(value);
  if (value.fixtures == null) value.fixtures = {};
  if (typeof value.fixtures === 'string') value.fixtures = JSON.parse(value.fixtures);
  if (!value.fixtures || typeof value.fixtures !== 'object' || Array.isArray(value.fixtures) || JSON.stringify(value.fixtures).length > 16000) throw new Error('Hybrid fixtures must be a bounded JSON object');
  var ids = new Set();
  function id(value) { return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value) && !['constructor', 'prototype'].includes(value); }
  value.requirements.forEach(function(item) {
    if (!id(item.id) || !id(item.targetId) || ids.has(item.id) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 1000) throw new Error('Invalid Hybrid requirement');
    ids.add(item.id);
    if (item.when == null) item.when = 'initial';
    if (!['initial', 'complete', 'present'].includes(item.when)) throw new Error('Invalid Hybrid requirement phase');
    if (item.when === 'initial' && /initially hidden|hidden (?:until|by default)|only (?:after|when)|after (?:submitt|complet)/i.test(item.text)) throw new Error('Conditional requirement must use present with explicit visibility checkpoints: ' + item.id);
  });
  ids.clear();
  value.journeys.forEach(function(journey) {
    if (!id(journey.id) || ids.has(journey.id) || !Array.isArray(journey.steps) || !journey.steps.length || journey.steps.length > 40) throw new Error('Invalid Hybrid journey');
    ids.add(journey.id);
    if (journey.complete == null) journey.complete = false;
    if (typeof journey.complete !== 'boolean') throw new Error('Invalid Hybrid journey completion');
    if (journey.outputAssertions == null) journey.outputAssertions = [];
    if (!Array.isArray(journey.outputAssertions) || journey.outputAssertions.length > 8) throw new Error('Invalid Hybrid output assertions');
    journey.outputAssertions.forEach(function(assertion) {
      if (!assertion || typeof assertion.path !== 'string' || assertion.path.length > 200 || !assertion.path.split('.').every(function(part) { return /^[A-Za-z0-9_-]+$/.test(part) && !['__proto__', 'constructor', 'prototype'].includes(part); }) || !['equals', 'length'].includes(assertion.operator) || typeof assertion.value !== 'string' || assertion.value.length > 1000) throw new Error('Invalid Hybrid output assertion');
      var expected = JSON.parse(assertion.value);
      if (assertion.operator === 'length' && (!Number.isInteger(expected) || expected < 0)) throw new Error('Output length must be a nonnegative integer');
    });
    if (!journey.steps.some(function(step) { return /^assert/.test(step.action); })) throw new Error('Hybrid journeys must assert a visible result');
    var remembered = new Set(), setup = [], interactions = 0, baselines = new Map();
    journey.steps.forEach(function(step) {
      if (!['click', 'fill', 'check', 'select', 'remember', 'assertChanged', 'assertText', 'assertValue', 'assertVisible', 'assertHidden'].includes(step.action) || !id(step.targetId) || typeof step.value !== 'string' || step.value.length > 1000) throw new Error('Invalid Hybrid journey step');
      if (['click', 'fill', 'check', 'select'].includes(step.action)) interactions++;
      if (step.action === 'remember') { remembered.add(step.targetId); baselines.set(step.targetId, interactions); }
      if (step.action === 'assertChanged' && interactions <= (baselines.get(step.targetId) || 0)) throw new Error('assertChanged requires an interaction after its baseline');
      if (step.action === 'assertChanged' && !remembered.has(step.targetId)) {
        setup.push({ action: 'remember', targetId: step.targetId, value: '' });
        remembered.add(step.targetId);
      }
      if (step.action === 'assertText' && !step.value.trim()) throw new Error('assertText requires meaningful expected text');
      if (step.action === 'assertHidden' && !interactions && value.requirements.some(function(item) { return item.targetId === step.targetId && item.when === 'initial'; })) throw new Error('Initial visibility contradicts assertHidden: ' + step.targetId);
    });
    // Freeze missing baseline snapshots before interactions, without changing assertions.
    journey.steps = setup.concat(journey.steps);
    if (journey.steps.length > 40) throw new Error('Hybrid journey exceeds 40 steps including setup');
    journey.outputAssertions.forEach(function(assertion, index) {
      var expected = JSON.parse(assertion.value);
      journey.outputAssertions.slice(0, index).forEach(function(other) {
        if (other.path === assertion.path && other.operator === assertion.operator && JSON.stringify(JSON.parse(other.value)) !== JSON.stringify(expected)) throw new Error('Conflicting output assertions: ' + assertion.path);
        if (other.operator === 'equals' && assertion.path.startsWith(other.path + '.') && (JSON.parse(other.value) === null || typeof JSON.parse(other.value) !== 'object')) throw new Error('Scalar output cannot have child assertions: ' + other.path);
        if (assertion.operator === 'equals' && other.path.startsWith(assertion.path + '.') && (expected === null || typeof expected !== 'object')) throw new Error('Scalar output cannot have child assertions: ' + assertion.path);
      });
    });
  });
  if (value.interactive && !value.journeys.length) throw new Error('Interactive designs need at least one journey');
  if (value.requirements.some(function(item) { return item.when === 'complete'; }) && (!value.interactive || !value.journeys.some(function(journey) { return journey.complete; }))) throw new Error('Completion requirements need a completion journey');
  if (requireBrief && value.recipe && value.recipe.kind === 'quiz' && !value.recipe.bindings.resultScreen) throw new Error('A new quiz needs question and results screens, answer review and restart bindings');
  if (value.brief != null) value.brief = hybridBrief(value.brief, value);
  else if (requireBrief) throw new Error('A concise design brief is required before generation');
  return JSON.parse(JSON.stringify(value));
}

function hybridProgram(value, spec) {
  if (value && value.recipe != null) {
    if (!root.DaubBehaviorRecipes) throw new Error('Behavior recipes could not load');
    return root.DaubBehaviorRecipes.compile(value.recipe, spec);
  }
  if (!value || !['initial', 'reduce', 'render', 'bind', 'output'].every(function(key) { return typeof value[key] === 'string'; })) throw new Error('Invalid Hybrid controller');
  var program = Object.assign({}, value, { initial: JSON.parse(value.initial) });
  var args = { reduce: ['state', 'action'], render: ['state', 'ui'], bind: ['ui', 'dispatch'], output: ['state'] };
  Object.keys(args).forEach(function(key) {
    var body = value[key].trim();
    var wrapped = /^function(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*;?$/.exec(body);
    if (wrapped) {
      if (wrapped[1].split(',').map(function(arg) { return arg.trim(); }).join(',') !== args[key].join(',')) throw new Error('Invalid ' + key + ' parameters; use ' + args[key].join(','));
      body = wrapped[2];
    }
    // Compile only. Generated hooks execute inside the opaque preview sandbox.
    new Function(...args[key], '"use strict";\n' + body);
    program[key] = body;
  });
  return program;
}

function hybridNative(spec) {
  var result = DaubSnowflake.validateSpec(spec, VALID_TYPES.filter(function(type) { return !['CustomHTML', 'Layout'].includes(type); }));
  Object.values(result.spec.elements).forEach(function(node) {
    if (node.props && ['js', 'html', 'css', 'on'].some(function(key) { return Object.prototype.hasOwnProperty.call(node.props, key); })) throw new Error('Hybrid layout cannot contain executable behavior');
  });
  return result;
}

function hybridSubtree(graph, id) {
  var ids = new Set(), pending = [id];
  while (pending.length) {
    var next = pending.pop();
    if (ids.has(next)) continue;
    if (!graph.has(next)) throw new Error('Unknown Hybrid region: ' + next);
    ids.add(next);
    pending.push.apply(pending, graph.get(next));
  }
  return ids;
}

function hybridRequiredIds(contract) {
  var ids = new Set(contract.requirements.map(function(item) { return item.targetId; }));
  contract.journeys.forEach(function(journey) { journey.steps.forEach(function(step) { ids.add(step.targetId); }); });
  if (contract.brief) contract.brief.screens.forEach(function(screen) { screen.targetIds.forEach(function(id) { ids.add(id); }); });
  if (contract.recipe) {
    Object.values(contract.recipe.bindings).forEach(function(id) { ids.add(id); });
    if (contract.recipe.kind === 'filter') contract.recipe.data.items.forEach(function(item) { ids.add(item.id); });
  }
  return Array.from(ids);
}

function hybridApply(spec, patch, targetId, contract) {
  var checked = hybridNative(spec), region = hybridSubtree(checked.graph, targetId);
  if (!patch || patch.root !== targetId) throw new Error('Candidate must preserve its region root');
  hybridNative(patch);
  var next = JSON.parse(JSON.stringify(spec));
  region.forEach(function(id) { delete next.elements[id]; });
  Object.keys(patch.elements).forEach(function(id) {
    if (Object.prototype.hasOwnProperty.call(next.elements, id)) throw new Error('Candidate changed a sibling region');
    next.elements[id] = patch.elements[id];
  });
  hybridNative(next);
  hybridRequiredIds(contract).forEach(function(id) { if (!next.elements[id]) throw new Error('Candidate removed a required binding: ' + id); });
  return next;
}

function hybridRepairContext(spec, defect, contract) {
  var graph = hybridNative(spec).graph, ids = hybridSubtree(graph, defect.targetId);
  var parents = new Map();
  graph.forEach(function(children, id) { children.forEach(function(child) { parents.set(child, id); }); });
  var ancestors = [], parentId = parents.get(defect.targetId);
  while (parentId) {
    var parent = spec.elements[parentId];
    ancestors.push({ id: parentId, type: parent.type, props: parent.props || {}, children: graph.get(parentId) });
    parentId = parents.get(parentId);
  }
  var required = hybridRequiredIds(contract);
  return {
    spec: { root: defect.targetId, elements: Object.fromEntries(Array.from(ids).sort().map(function(id) { return [id, spec.elements[id]]; })) },
    ancestors: ancestors,
    contract: { requirements: contract.requirements.filter(function(item) { return ids.has(item.targetId); }), requiredIds: required.filter(function(id) { return ids.has(id); }).sort(),
      brief: contract.brief ? { summary: contract.brief.summary, screens: contract.brief.screens.filter(function(screen) { return screen.targetIds.some(function(id) { return ids.has(id); }); }) } : null }
  };
}

function hybridRepairKey(spec, defect, contract) {
  var scope = hybridRepairContext(spec, defect, contract);
  return JSON.stringify({ kind: defect.kind.replace(/^\d+:[^:]+:/, ''), scope: scope }, function(key, value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(function(name) { return [name, value[name]]; }));
  });
}

// Every check uses a separate opaque-origin frame; candidates never replace the visible page.
async function hybridEvidence(spec, contract, signal, behavior) {
  var output = [], covered = new Set();
  var requirements = contract.requirements.slice();
  if (contract.brief) contract.brief.screens.filter(function(screen) { return screen.phase === 'initial'; }).forEach(function(screen) {
    screen.targetIds.forEach(function(id, index) { requirements.push({ id: 'brief:' + screen.id + ':' + index, targetId: id, when: 'initial', text: screen.title }); });
  });
  if (behavior) {
    var graph = hybridNative(spec).graph;
    contract.journeys.forEach(function(journey) {
      journey.steps.filter(function(step) { return step.action === 'click'; }).forEach(function(step) {
        if (!graph.has(step.targetId)) return;
        var matches = Array.from(hybridSubtree(graph, step.targetId)).filter(function(id) {
          var node = spec.elements[id], props = node.props || {};
          return node.type === 'Button' && (!step.value || (props.ariaLabel || props.label) === step.value);
        });
        if (matches.length === 1) covered.add(matches[0]);
      });
    });
  }
  var buttons = behavior ? Object.keys(spec.elements).filter(function(id) { return spec.elements[id].type === 'Button'; }) : [];
  for (var width of [1200, 390]) {
    var cases = [null].concat(behavior ? contract.journeys : []).map(function(journey) { return { journey: journey, action: null }; });
    for (var item of cases) {
      var journey = item.journey, action = item.action;
      if (signal.aborted) throw new DOMException('Canceled', 'AbortError');
      var frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.dataset.hybridProbe = '';
      frame.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;border:0;width:' + width + 'px;height:900px;';
      var requestId = crypto.randomUUID();
      var evidence = await new Promise(function(resolve, reject) {
        var timer = setTimeout(function() { cleanup(); resolve(null); }, 8000);
        function cleanup() { clearTimeout(timer); window.removeEventListener('message', receive); signal.removeEventListener('abort', cancel); frame.remove(); }
        function cancel() { cleanup(); reject(new DOMException('Canceled', 'AbortError')); }
        function receive(event) {
          if (event.source !== frame.contentWindow || !event.data) return;
          if (event.data.type === 'html' && event.data.seq === requestId) {
            frame.contentWindow.postMessage({ type: 'hybrid-probe', requestId: requestId, requirements: requirements, journey: journey, action: action }, '*');
          }
          if (event.data.type === 'hybrid-probe-result' && event.data.requestId === requestId) { var value = event.data.evidence; cleanup(); resolve(value); }
        }
        window.addEventListener('message', receive);
        signal.addEventListener('abort', cancel, { once: true });
        frame.addEventListener('load', function() {
          if (signal.aborted) { cancel(); return; }
          frame.contentWindow.postMessage({ type: 'render', seq: requestId, html: '', spec: spec, js: behavior ? collectCustomJS(spec) : [] }, '*');
        }, { once: true });
        frame.srcdoc = buildIframeSrcdoc(spec.theme).replace('</head>', '<meta http-equiv="Content-Security-Policy" content="connect-src \'none\'; form-action \'none\'"></head>');
        document.body.appendChild(frame);
      });
      var view = { width: width, journey: journey && journey.id, action: action && action.targetId, evidence: evidence };
      output.push(view);
      if (behavior && !journey && !action && evidence && evidence.complete) {
        var visible = new Set(evidence.geometry.elements.filter(function(node) { return node.visible; }).map(function(node) { return node.id; }));
        var candidates = buttons.filter(function(id) { return !covered.has(id) && visible.has(id); });
        var selected = candidates.slice(0, 6);
        view.actionCoverage = { limit: 6, coveredByJourneys: buttons.filter(function(id) { return covered.has(id); }), selected: selected,
          unprobed: buttons.filter(function(id) { return !covered.has(id) && !selected.includes(id); }) };
        selected.forEach(function(id) { cases.push({ journey: null, action: { targetId: id } }); });
      }
    }
  }
  return output;
}

function hybridPreservesActionCoverage(previous, next) {
  var tested = new Set();
  next.forEach(function(view) {
    ((view.evidence || {}).actions || []).forEach(function(action) {
      if (action.status === 'changed' || action.status === 'unchanged') tested.add(JSON.stringify([view.width, action.targetId]));
    });
  });
  return previous.every(function(view) {
    return ((view.evidence || {}).actions || []).every(function(action) {
      return action.status === 'skipped' || tested.has(JSON.stringify([view.width, action.targetId]));
    });
  });
}

function hybridAssessment(views) {
  var result = { complete: true, defects: [], checks: [] };
  views.forEach(function(view) {
    var prefix = view.width + ':' + (view.action ? 'action(' + view.action + ')' : view.journey || 'initial') + ':';
    var evidence = view.evidence;
    if (!evidence || evidence.complete !== true || !Array.isArray(evidence.defects) || !Array.isArray(evidence.checks)) { result.complete = false; return; }
    evidence.defects.forEach(function(defect) { result.defects.push(Object.assign({}, defect, { id: prefix + defect.id, kind: prefix + defect.kind, scope: view.journey ? 'journey' : view.action ? 'action' : 'initial' })); });
    evidence.checks.forEach(function(check) { result.checks.push({ id: prefix + check.id, pass: check.pass === true }); });
  });
  return result;
}

async function generateHybrid(prompt) {
  if (!window.DaubHybrid || !window.DaubBehavior) { showJsonError('Hybrid could not load. Reload or choose Direct.'); return; }
  if (!host.isDefaultMode || host.hasAttachments) { showJsonError('The Playground currently accepts text prompts through DAUB AI.'); return; }
  if (prompt.length > 4000) { showJsonError('Hybrid prompts must be 4,000 characters or fewer.'); return; }
  var controller = new AbortController(), started = Date.now(), contract = null, lastViews = [], lastSpec = null, advisory = null, candidateCache = null;
  var sourceSpec = host.currentSpec;
  host.controller = controller;
  applyPromptViewport(prompt);
  chatHistory.push({ role: 'user', content: prompt });
  addChatBubble('user', prompt);
  updateChatState();
  $prompt.value = ''; $prompt.style.height = '';
  var bubble = addChatBubble('ai', 'Building complete draft...');
  host.stream.streamBubble = bubble;
  hideJsonError(); setLoading(true);
  function active() { return host.controller === controller && !controller.signal.aborted; }
  var pending = new Map(), phase = 'Reading requirements';
  var stageLabels = { contract: 'Reading requirements', draft: 'Building page', repair: 'Repairing layout', behavior: 'Adding interactions' };
  function paintProgress() {
    if (!active()) return;
    var jobs = Array.from(pending.values()), job = jobs[0];
    var label = job ? stageLabels[job.stage] : phase;
    if (jobs.length > 1) label += ' (' + jobs.length + ' requests)';
    if (job && job.attempt) label += ' (retrying shorter output)';
    label += ' · ' + Math.floor((Date.now() - started) / 1000) + 's';
    var bytes = jobs.reduce(function(sum, item) { return sum + item.bytes; }, 0);
    if (jobs.length) label += bytes ? ' · ' + Math.ceil(bytes / 1024) + ' KB received' : ' · Waiting for model';
    $status.textContent = label; bubble.textContent = label;
  }
  function activity(event) {
    if (event.state === 'done') pending.delete(event.id); else pending.set(event.id, event);
    paintProgress();
  }
  function hybridRequest(context, stage, system, data) { return requestStructured(context, stage, system, data, activity); }
  var progressTimer = setInterval(paintProgress, 1000);
  paintProgress();
  var nativePrompt = 'Create a complete DAUB page. Return the required structured element ARRAY, with props as name/value entries. Encode object values as {entries:[{name,value}]}, arrays and primitives directly. Use native components only, no HTML/JS/CSS. Each element has id,type,props,children (ID array). One root; no orphans or duplicate parents. Preserve every required targetId and journey targetId. All required regions must contain useful content now. Use only documented props:\n'
    + VALID_TYPES.filter(function(type) { return !['CustomHTML', 'Layout'].includes(type); }).map(function(type) { return type + ': ' + (COMP_PROPS[type] || 'children'); }).join('\n')
    + '\nBuild the requested usable screen, no marketing page unless requested. Choose columns to fit the task. Forms and quizzes rarely need sidebars. Stack direction is horizontal or vertical, not row or column. Use Grid for responsive page columns; sidebar-main reserves a narrow FIRST column, so do not put primary cart items there. Keep headings, spacing, images and controls proportional. Use sentence capitalization. Fit 390px and 1200px. One responsibility per region; do not duplicate progress, forms, or totals. No empty containers. Keep IDs stable and use at most 160 elements.';
  nativePrompt += '\nUse container:"narrow" on the root Stack for a single-column form or quiz. App layouts may use container:"wide". Keep a header outside the columns that hold a sidebar and main content.';
  nativePrompt += '\nFor a multi-step quiz, start on question one unless the user explicitly requests a welcome screen. Render ONE question and ONE stable RadioGroup reused across steps, with progress and Back/Next controls. Do not add a Start screen, use Tabs or pre-render ten question panels. The later coding stage supplies the full question dataset in state. Keep a result region with stable IDs for completion, but do not fabricate completed scores in the initial draft. The controller will hide that region until completion.';
  nativePrompt += '\nPrefer recipe-compatible native bindings when they fit the task: quiz question/progress/result are Text leaves, choices is one RadioGroup leaf, back/next are Button leaves without trigger/on/action/type:submit props. A searchable collection uses Input or Search, a Stack/Grid whose direct children are the existing item cards, and a Text count. Radio selection uses a RadioGroup and Text summary. Preserve all designed content; the later controller updates these bindings. Do not use a recipe layout for extra workflows it cannot represent.';
  nativePrompt += '\nBINDING CHECKLIST: Emit exactly one reachable element for EACH requiredIds entry. These are literal element IDs, not descriptions or props. A page-level requirement can use its required ID on the root Stack. Keep all other children reachable. Populate visible Text content and component props; empty prop arrays are not a completed screen.';
  nativePrompt += '\nDESIGN BRIEF: Treat contract.brief as the frozen product and screen specification. Design ALL listed screens/states, including completion/results and relevant errors, in this single coherent spec. Give each screen its specified container, content hierarchy, spacing, and controls, with stable targetIds. Conditional screens share the same design system; the controller will manage visibility. A quiz results screen needs a heading, score with a clear illustrative meaning, a readable answer review, and Restart. Do not leave results as a stray line under the question. For quiz screen bindings, place question/choices/back/next/progress inside questionScreen and result/answerReview/restart inside a separate resultScreen. Keep bound text leaves separate from container children.';
  try {
    var result = await DaubHybrid.run({
      signal: controller.signal,
      draft: async function(context) {
        var contractPrompt = 'Extract user requirements and acceptance journeys for a small usable page. Assign stable short targetId values that the page generator MUST use. Include at most 8 requirements and 2 focused journeys. Every step has action,targetId,value strings. Tests follow the request and remain frozen during repairs. Each journey starts fresh. Steps: click native control (value empty), fill/check/select input, remember text/value BEFORE an interaction, assertChanged on that SAME remembered target AFTER the interaction, assertText contains value, assertValue exact value. A RadioGroup keeps ONE stable target across quiz steps; check value empty selects its first input, or value names an exact radio value or unique visible label. List click value is a zero-based row index string such as "1". Use value:"" when unused. Assert semantic outcomes, not only a button/input changing. Cart: specify fixture prices and initial quantities in requirements, change quantity and assert the FULL calculated currency total. Inbox: click a different list row and assert body/metadata. Forms: validation and local demo submission feedback, never real submission. Static pages use interactive:false and journeys:[]. No unrelated features. Every journey needs a visible assertion.';
        contractPrompt += '\nassertText MUST have a nonempty expected phrase, never value:"". To check changing text without knowing the phrase, remember the target before the action and assertChanged afterward. Requirements already check that elements are visible; do not add empty text assertions for visibility.';
        contractPrompt += '\nQuizzes start on question one unless the user explicitly requests a welcome screen. Do not add an introductory Start button or welcome requirement. Question, answer group and progress are initial requirements; the result is a completion requirement. Require ten questions in the dataset, not ten initially visible question panels. Preserve this initial screen in the later controller.';
        contractPrompt += '\nEach requirement has id,targetId,text,when ("initial" or "complete"). Results, confirmation and success panels use when:"complete", and may start hidden. Each journey has id,steps,complete:boolean,outputAssertions:[]. A completion journey must perform the ENTIRE requested workflow, not stop after the first transition. For an N-step quiz/test, use ONE question-region requirement and reuse the SAME answer targetId and Next targetId for all steps. Do not enumerate the question dataset as visible requirements or create q1/q2/etc bindings. The coding stage creates N distinct questions in state. Answer and advance through ALL N steps, then assert the visible result. For 10 questions this takes 20 check/click actions plus assertions, within the 40-step limit. Include a complete:true journey with outputAssertions [{path:"answers",operator:"length",value:"10"},{path:"completed",operator:"equals",value:"true"}]. Output assertion values are JSON-encoded expected values; paths are dot-separated own properties. Use these assertions to test the read-only result object, not just visible text. Other workflows should expose their useful local result object and test its relevant values. Non-completion journeys use complete:false; static pages use no journeys.';
        contractPrompt += '\nCONTRACT RULES: fixtures is a JSON-encoded object specifying initial data, selections and sample prices. Each journey starts from exactly that fixture. Account for added/deleted/edited items in order; final assertions describe the LAST state, not an earlier checkpoint. Numeric quantities, counts and totals in the output API must be JSON numbers, display strings belong in separate formatted fields. A scalar output cannot also have child paths. For conditional errors, empty states, recovery panels and success use when:"present" (the node exists, visibility varies), then assertHidden/assertVisible with value:"" at the relevant journey step. Reserve when:"complete" for a panel that ALL completion journeys should display. A click on a group of buttons MUST provide the unique visible button label (e.g. Annual), not an empty value. Checkbox lists use the exact value or visible label, never an index. A List row click may use a zero-based numeric index. Do not invent global completion requirements for transient validation errors.';
        contractPrompt += '\nWhen the request fits these standard outputs, prefer their field names: quiz {completed,step,total,answers:[{questionId,question,answer,value,score}],result:number|null}; filter {query,visibleIds,count,total}; single radio selection {completed,selected,label,total}. Quiz displays "<resultLabel>: <score>" in a result Text; filter count displays "<count> of <total>". These are optional reusable behavior contracts, not reasons to drop requested features. Use custom behavior for other workflows.';
        contractPrompt += '\nFor custom workflows, use the second journey for recovery or edits after completion when applicable. A cart or form must either freeze its confirmed result and disable edits, or invalidate confirmation after an edit and permit a new submission. Assert both visible state and typed output at the end. A search empty-state journey must END empty; put clearing/restoring the query in a separate fresh journey so its output assertions describe the restored state. Do not put assertions from different checkpoints in one terminal outputAssertions list.';
        if (root.DaubBehaviorRecipes) contractPrompt += '\nRECIPE-FIRST PLANNING: For a quiz of at most 18 questions, a simple searchable collection, or one radio selection, put the complete structured recipe in recipe NOW. Include all requested distinct questions/items/options and stable binding IDs. Set fixtures:"{}" (recipe.data is the canonical fixture) and journeys:[]; the application builds deterministic journeys from the recipe before freezing the contract. This skips the coding request entirely. Use recipe:null only when the requested workflow needs unsupported behavior; then supply fixtures and journeys as above. Keep requirements within 8 including the recipe bindings. A filter data.items ID identifies the direct child card in the later draft. Do not duplicate recipe content in fixtures. Recipes:\n' + JSON.stringify(root.DaubBehaviorRecipes.documentation.recipes);
        contractPrompt += '\nReturn brief in this SAME response: a concise PRD-like design document, bounded to 14,000 characters, not extra features. Include title, summary, assumptions, outOfScope, screens, flow, edgeCases, outputs. Each screen has id,title,phase(initial/interaction/complete), targetIds (1-3 stable rendered region IDs), layout,content,journeyId. Initial screens use journeyId:""; other screens name a journey whose END reaches that screen so browser geometry can check it. Flow entries have from/to screen IDs, action, guard and journeyId; every noninitial screen must be reachable. Edge cases have scenario,expected,journeyId and must refer to actual acceptance journeys; focus on relevant validation/back/restart/empty recovery cases. Outputs have path,type,description; describe result values at completion, not placeholder strings. Static pages can have empty flow/edgeCases/outputs. Interactive pages need at least one of each. Keep new feature scope within the original request; state assumptions instead of inventing accounts/backends. Test fixtures must match the brief. For recipes, refer to deterministic journey IDs: quiz recipe-complete, recipe-back, recipe-restart (if screen bindings supplied); filter recipe-empty, recipe-restore; selection recipe-select. Quiz new briefs MUST use questionScreen/resultScreen/answerReview/restart bindings and describe a designed results screen, answer review and Restart. Use at most 16 questions with this recipe because browser journeys cap at 40 steps; larger requested quizzes need custom behavior, never reduce the requested count. Quiz results are illustrative, not a diagnostic assessment. Avoid blanket claims such as handling all errors.';
        var rawContract = await hybridRequest(context, 'contract', contractPrompt, { request: prompt, currentSpec: sourceSpec });
        try { contract = hybridContract(rawContract, true); }
        catch (error) {
          contract = hybridContract(await hybridRequest(context, 'contract', contractPrompt, { request: prompt, invalidContract: rawContract, validationError: error.message }), true);
        }
        var required = hybridRequiredIds(contract);
        var draftInput = { request: prompt, requiredIds: required, contract: contract, currentSpec: sourceSpec };
        for (var draftAttempt = 0; draftAttempt < 2; draftAttempt++) {
          var raw = await hybridRequest(context, 'draft', nativePrompt, draftInput);
          try {
            var spec = DaubSnowflake.decodeOutput(raw, 'design');
            hybridNative(spec);
            required.forEach(function(id) { if (!spec.elements[id]) throw new Error('Missing required binding: ' + id); });
            if (contract.recipe) root.DaubBehaviorRecipes.compile(contract.recipe, spec);
            spec.hybrid = { contract: contract };
            return spec;
          } catch (error) {
            if (draftAttempt) throw error;
            phase = 'Correcting draft'; paintProgress();
            draftInput = { request: prompt, requiredIds: required, contract: contract, invalidDraft: raw, validationError: error.message, instruction: 'Return the complete corrected draft. Emit an element for EVERY requiredIds entry, including any omitted page-level requirement. Fix all child references and preserve the frozen contract IDs.' };
          }
        }
      },
      inspect: async function(context) {
        phase = 'Testing desktop and mobile'; paintProgress();
        var key = JSON.stringify(context.spec);
        lastViews = candidateCache && candidateCache.key === key ? candidateCache.views : await hybridEvidence(context.spec, contract, context.signal, !!(context.spec.hybrid && context.spec.hybrid.program));
        var assessment = hybridAssessment(lastViews);
        assessment.defects.forEach(function(defect) { if (!context.spec.elements[defect.targetId]) defect.targetId = context.spec.root; });
        if (!assessment.complete) return assessment;
        return assessment;
      },
      conflicts: function(a, b, spec) {
        var graph = hybridNative(spec).graph;
        return hybridSubtree(graph, a.targetId).has(b.targetId) || hybridSubtree(graph, b.targetId).has(a.targetId);
      },
      repairKey: function(spec, defect) { return hybridRepairKey(spec, defect, contract); },
      propose: async function(context) {
        var scope = hybridRepairContext(context.spec, context.defect, contract);
        var ids = new Set(Object.keys(scope.spec.elements).concat(scope.ancestors.map(function(node) { return node.id; })));
        var raw = await hybridRequest(context, 'repair', nativePrompt + '\nRepair ONLY the supplied defect target subtree. Return a complete replacement subtree rooted at its unchanged targetId. Ancestors are read-only layout context. You may simplify wrappers or change layout within the subtree. Do not touch siblings or ancestors. Keep all requiredIds and meaningful content. Prefix new IDs with targetId and a hyphen. Do not add behavior.', Object.assign({ request: prompt, defect: context.defect, evidence: lastViews.filter(function(view) { return !view.journey; }).map(function(view) { return { width: view.width, elements: view.evidence.geometry.elements.filter(function(node) { return ids.has(node.id); }) }; }) }, scope));
        return DaubSnowflake.decodeOutput(raw, 'design');
      },
      apply: function(context) { return hybridApply(context.spec, context.patch, context.defect.targetId, contract); },
      finish: async function(context) {
        if (!contract.interactive) return context.spec;
        var spec = JSON.parse(JSON.stringify(context.spec));
        if (contract.recipe) {
          spec.hybrid = { contract: contract, program: root.DaubBehaviorRecipes.compile(contract.recipe, spec) };
          return spec;
        }
        var program = await hybridRequest(context, 'behavior', 'Implement ALL requested interactions in ONE controller for this frozen DAUB page. Return initial as a JSON-encoded state string and reduce/render/bind as JavaScript FUNCTION BODY strings, not function declarations. reduce(state,action) returns a NEW plain JSON state; inputs are deeply frozen. render(state,ui) runs on initialization and after EVERY dispatch, and updates ALL dependent text, counters, prices and disabled states from state. bind(ui,dispatch) runs ONCE after initial render. Use ui.on(id,event,handler) to track listeners on stable roots (events bubble); handler dispatches plain JSON actions. No shared globals, no custom event bus, no competing controllers. ui.get(id) returns data-spec-id element; ui.input(id) returns native input/select/textarea; ui.text(id,value) sets text; ui.preview is whole root. Use ui.get(id).querySelector to access native component internals. Preserve DAUB classes, input markup and bound IDs. Event delegation on a stable RadioGroup root survives rendering new questions. render must not replace containers holding bound child IDs. Avoid rebuilding text inputs on keystrokes. Keep state canonical, derive counts/totals/progress. Include realistic complete data for all requested steps, not placeholders. Handle form errors and show local submission feedback. No network calls, timers, storage, external navigation or real transactions. Every supplied journey must work, but do not special-case test values. Return code only in the structured fields.', { request: prompt, contract: contract, spec: spec, domContract: GENERATED_DOM_CONTRACT });
        var compileError = null, views = null, checked = null;
        try { program = hybridProgram(program, spec); }
        catch (error) { compileError = error.message; }
        if (!compileError) {
          spec.hybrid = { contract: contract, program: program };
          views = await hybridEvidence(spec, contract, context.signal, true);
          checked = hybridAssessment(views);
        }
        if (compileError || checked.complete && checked.defects.some(function(defect) { return /behavior|runtime-error/.test(defect.kind); })) {
          var repaired;
          try { repaired = await hybridRequest(context, 'behavior', 'Repair only the failing behavior in this controller. Preserve layout, bindings, fixtures and passing journeys. Return initial as a JSON state string and reduce/render/bind/output as synchronous FUNCTION BODY strings. Use one canonical state, preserve numeric output types and all requested data. Do not change tests, add test-only labels, use network/storage or external actions. ' + GENERATED_DOM_CONTRACT, {
            request: prompt, contract: contract, program: program,
            failures: compileError ? [{ kind: 'compile', message: compileError }] : checked.defects.map(function(defect) { return { kind: defect.kind, targetId: defect.targetId, message: defect.message }; }),
            elements: spec.elements
          }); } catch (error) {
            if (!views || context.signal.aborted || error.code !== 'HYBRID_RESPONSE_INVALID') throw error;
            candidateCache = { key: JSON.stringify(spec), views: views };
            return spec;
          }
          try {
            var candidate = JSON.parse(JSON.stringify(spec));
            candidate.hybrid.program = hybridProgram(repaired, candidate);
            var repairedViews = await hybridEvidence(candidate, contract, context.signal, true);
            var repairedCheck = hybridAssessment(repairedViews);
            var previousPassing = checked ? checked.checks.filter(function(check) { return check.pass; }) : [];
            var nextPassing = new Set(repairedCheck.checks.filter(function(check) { return check.pass; }).map(function(check) { return check.id; }));
            var previousDefects = new Set(checked ? checked.defects.map(function(defect) { return defect.id; }) : []);
            if (repairedCheck.complete && (!checked || repairedCheck.defects.length < checked.defects.length && repairedCheck.defects.every(function(defect) { return previousDefects.has(defect.id); })) && previousPassing.every(function(check) { return nextPassing.has(check.id); }) && (!views || hybridPreservesActionCoverage(views, repairedViews))) { spec = candidate; views = repairedViews; }
          } catch (error) {
            if (context.signal.aborted) throw error;
          }
        }
        if (!views) throw new Error(compileError || 'Controller checks did not complete');
        candidateCache = { key: JSON.stringify(spec), views: views };
        return spec;
      },
      onSpec: function(spec) {
        if (!active()) return;
        lastSpec = JSON.parse(JSON.stringify(spec)); host.currentSpec = lastSpec;
        renderSpec(lastSpec); $json.value = JSON.stringify(lastSpec, null, 2);
        refreshJsonTree(); updatePreviewToolbar(); saveChatState();
      },
      onProgress: function(event) {
        if (!active()) return;
        phase = ({ draft: 'Reading requirements', round: 'Preparing repairs', accepted: 'Repair accepted', rejected: 'Keeping current page', finish: 'Adding interactions', finished: 'Checks finished', error: 'Checking response' })[event.phase] || event.phase;
        paintProgress();
      }
    });
    if (!active()) return;
    var unresolved = (result.attemptedAssessment || result.assessment || {}).defects || [];
    var detail = result.error || (result.finishRejection ? 'Kept prior draft: ' + result.finishRejection : '');
    if (unresolved.length) detail += (detail ? '. ' : '') + unresolved[0].message;
    var label = result.reason === 'complete' ? 'Browser checks passed; review design' : 'Hybrid needs review: ' + result.reason + (detail ? ' (' + detail.slice(0, 700) + ')' : '');
    if (lastSpec) {
      lastSpec.hybrid.status = label;
      lastSpec.hybrid.advisory = advisory;
      pushVersion(lastSpec, prompt + ' (hybrid)');
      specVersions[specVersions.length - 1].ms = Date.now() - started;
      buildResultBubble(bubble, lastSpec);
      chatHistory.push({ role: 'assistant', content: label, refinementStatus: label, versionIdx: specVersions.length - 1 });
    } else bubble.textContent = '';
    var note = document.createElement('p'); note.className = 'pg-result-meta'; note.textContent = label; bubble.appendChild(note);
    window.__hybridLastRun = { reason: result.reason, error: result.error || null, requests: result.requests, assessment: result.assessment, finishRejection: result.finishRejection || null, attemptedAssessment: result.attemptedAssessment || null, advisory: advisory, views: lastViews };
    saveChatState();
  } catch (error) {
    if (active()) { bubble.textContent = 'Hybrid stopped: ' + error.message; showJsonError(error.message); }
  } finally {
    clearInterval(progressTimer);
    if (host.controller === controller) { $status.textContent = ''; setLoading(false); host.controller = null; }
  }
}
return { generate: generateHybrid, apply: hybridApply, validateContract: hybridContract, normalizeProgram: hybridProgram };
}
function renderBrief(brief) {
  var details = document.createElement('details'), summary = document.createElement('summary'), body = document.createElement('div');
  details.className = 'pg-design-brief'; summary.textContent = 'Design brief';
  body.style.whiteSpace = 'pre-line'; body.style.overflowWrap = 'anywhere';
  function entries(key, max, fields) {
    return Array.isArray(brief[key]) && brief[key].length <= max && brief[key].every(function(item) {
      return fields ? item && fields.every(function(field) { return typeof item[field] === 'string' && item[field].length <= 700; }) : typeof item === 'string' && item.length <= 700;
    });
  }
  if (!brief || typeof brief.title !== 'string' || typeof brief.summary !== 'string' || brief.title.length > 700 || brief.summary.length > 700 ||
      !entries('assumptions', 4) || !entries('outOfScope', 4) || !entries('screens', 6, ['title', 'phase', 'layout', 'content']) ||
      !entries('flow', 12, ['from', 'to', 'action', 'guard']) || !entries('edgeCases', 6, ['scenario', 'expected']) || !entries('outputs', 8, ['path', 'type', 'description'])) {
    body.textContent = 'Design brief unavailable.'; details.append(summary, body); return details;
  }
  var lines = [brief.title, brief.summary];
  if (brief.assumptions.length) lines.push('\nAssumptions', brief.assumptions.join('\n'));
  if (brief.outOfScope.length) lines.push('\nOut of scope', brief.outOfScope.join('\n'));
  lines.push('\nScreens');
  brief.screens.forEach(function(screen) { lines.push(screen.title + ' (' + screen.phase + ')', screen.layout, screen.content); });
  if (brief.flow.length) { lines.push('\nFlow'); brief.flow.forEach(function(flow) { lines.push(flow.from + ' -> ' + flow.to + ': ' + flow.action + '. ' + flow.guard); }); }
  if (brief.edgeCases.length) { lines.push('\nEdge cases'); brief.edgeCases.forEach(function(edge) { lines.push(edge.scenario + ': ' + edge.expected); }); }
  if (brief.outputs.length) { lines.push('\nOutputs'); brief.outputs.forEach(function(output) { lines.push(output.path + ' (' + output.type + '): ' + output.description); }); }
  body.textContent = lines.join('\n'); details.append(summary, body); return details;
}
root.DaubHybridUI = { create: createHybridUI, renderBrief: renderBrief };
}(globalThis));
