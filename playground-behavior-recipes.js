(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.DaubBehaviorRecipes = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  var own = function(value, key) { return Object.prototype.hasOwnProperty.call(value, key); };
  var roles = {
    quiz: { question: ['Text'], choices: ['RadioGroup'], back: ['Button'], next: ['Button'], progress: ['Text'], result: ['Text'] },
    selection: { choices: ['RadioGroup'], summary: ['Text'] },
    filter: { query: ['Input', 'Search'], items: ['Stack', 'Grid'], count: ['Text'] }
  };
  var containers = ['Stack', 'Grid', 'Layout', 'Surface', 'Card', 'ButtonGroup', 'Fieldset', 'Group'];
  var quizScreenRoles = ['questionScreen', 'resultScreen', 'answerReview', 'restart'];
  Object.assign(roles.quiz, { questionScreen: containers, resultScreen: containers, answerReview: ['Text'], restart: ['Button'] });
  var referenceProps = {
    Frame: ['header', 'footer'], PreviewCard: ['trigger', 'media'], Sidebar: ['sections'],
    Breadcrumbs: ['items'], List: ['items'], AvatarGroup: ['avatars'], Carousel: ['slides'],
    Table: ['columns', 'rows'], DataTable: ['columns', 'rows'], Accordion: ['items'],
    Modal: ['footer'], AlertDialog: ['footer']
  };
  var documentation = {
    version: 1,
    interface: 'compile(descriptor, spec) returns {initial:plainJSON,reduce,render,bind,output}; the last four fields are function BODY strings for DaubBehavior.mount/toScript.',
    descriptor: '{kind:"quiz"|"selection"|"filter",bindings:{role:existingSpecId},data:plainJSON}. Unknown fields and roles are errors. Quiz screen bindings are an optional all-or-none bundle; descriptorSchema requires all four nullable fields, with null denoting absence. validate removes those nulls and accepts legacy omissions. cart and todo are unsupported.',
    limits: { questions: 50, optionsPerQuestion: 12, selectionOptions: 100, filterItems: 200, text: 2000, value: 128, query: 200, descriptorCharacters: 131072, jsonNodes: 20000, jsonDepth: 32, specElements: 2048, layoutDepth: 18, scoreAbsolute: 1000000 },
    ids: 'Spec IDs, question IDs and item IDs must match ^[A-Za-z_][A-Za-z0-9_-]{0,63}$; __proto__, constructor and prototype are forbidden. IDs and option values must be unique within their collection.',
    layout: 'Bindings must be distinct and reachable. All roles are required except the optional quiz screen bundle. Roles must be leaf nodes except quiz.questionScreen/resultScreen (existing containers) and filter.items: a Stack/Grid whose direct children exactly match data.items IDs. Other bindings cannot be inside filter.items. Use children (or props.children, not both). Ancestors may be Stack, Grid, Layout, Surface, Card, ButtonGroup, Fieldset or Group. Card.footer may contain direct child IDs. No other prop-held element references, repeated children, hidden/disabled ancestors, declarative handlers/state expressions, button triggers, submit/reset buttons or read-only inputs. RadioGroup and Input labels may wrap the native control.',
    errors: 'Throws TypeError with code DAUB_RECIPE_INVALID, path and a fallback message. Compile against the final spec. Do not silently repair bindings or select recipes from prompt text.',
    recipes: {
      quiz: {
        bindings: roles.quiz,
        screens: 'Optional bundle: questionScreen, resultScreen, answerReview, restart. Supply all four IDs or omit/null all four. questionScreen must contain question, choices, back, next and progress. resultScreen must contain result, answerReview and restart. Panels must be separate; neither may contain the other. Screen types use the existing container allowlist; answerReview is a Text leaf and restart a Button leaf. Do not set initial hidden flags; the recipe controls visibility.',
        data: '{questions:[{id,text,options:[{value,label,score}]}],resultLabel?:string}. 1..50 questions; 2..12 options each; score is a finite number in [-1000000,1000000]. resultLabel defaults to Result.',
        output: '{completed:boolean,step:number,total:number,answers:[{questionId:string,question:string,answer:string,value:string,score:number}],result:number|null}. question is question text; answer is the selected option label. step is 1-based; answers contains answered questions in question order; result is the sum of scores only after completion. Scores are illustrative sums, not medical assessments or diagnostic claims.',
        behavior: 'Next requires an answer. Back preserves answers, including from completion (reopens the last question). Editing an answer replaces it. Next on the last question completes; completion disables Next and choices. Progress is step of total. With the screen bundle, init shows questionScreen and hides resultScreen; completion reverses them and renders all question/answer labels as text in answerReview. Restart clears answers, index and completion and shows the first question. Controller BACK reopens the last question and clears result/review text; controller RESTART also resets the quiz. Without screens, Back remains visible on completion.'
      },
      selection: {
        bindings: roles.selection,
        data: '{options:[{value,label}],initialValue?:string|null}. 1..100 options; initialValue must match an option or be null (default).',
        output: '{completed:boolean,selected:string|null,label:string|null,total:number}. completed means an option is selected.',
        behavior: 'Native single-choice radio group. Summary shows the selected label or an empty string. Selection persists across render calls.'
      },
      filter: {
        bindings: roles.filter,
        data: '{items:[{id:existingSpecId,label:searchableText}]}. 0..200 items; IDs must exactly match the direct children of the items Stack/Grid. Input.type must be text/search (or omitted); Search is supported including its clear button.',
        output: '{query:string,visibleIds:string[],count:number,total:number}. query retains entered spaces; matching uses a trimmed, case-insensitive literal substring of label, in source order.',
        behavior: 'Starts with an empty query and all items visible. Query is capped at 200 characters. Toggles only existing item hidden flags; preserves cards, images and descendants. A scoped hidden CSS rule overrides native flex/grid display. Count displays count of total, including zero. Input focus and bound roots survive updates.'
      }
    }
  };

  function freeze(value) {
    if (value && typeof value === 'object') { Object.keys(value).forEach(function(key) { freeze(value[key]); }); Object.freeze(value); }
    return value;
  }
  freeze(documentation);

  function descriptorSchema() {
    function object(properties) { return { type: 'object', properties: properties, required: Object.keys(properties), additionalProperties: false }; }
    function array(items, min, max) { return { type: 'array', items: items, minItems: min, maxItems: max }; }
    function string(max) { return { type: 'string', minLength: 1, maxLength: max }; }
    function identifier() { return { type: 'string', minLength: 1, maxLength: 64 }; }
    function option(scored) {
      var properties = { value: string(128), label: string(2000) };
      if (scored) properties.score = { type: 'number', minimum: -1000000, maximum: 1000000 };
      return object(properties);
    }
    return { anyOf: Object.keys(roles).map(function(kind) {
      var bindings = {};
      Object.keys(roles[kind]).forEach(function(role) {
        var binding = Object.assign(identifier(), { description: 'Existing ' + roles[kind][role].join('/') + ' spec ID for ' + role });
        bindings[role] = kind === 'quiz' && quizScreenRoles.indexOf(role) >= 0 ? { anyOf: [binding, { type: 'null' }], description: 'Optional quiz screen bundle: supply all four IDs or null for all four.' } : binding;
      });
      var data;
      if (kind === 'quiz') data = object({ questions: array(object({ id: identifier(), text: string(2000), options: array(option(true), 2, 12) }), 1, 50), resultLabel: string(2000) });
      else if (kind === 'selection') data = object({ options: array(option(false), 1, 100), initialValue: { anyOf: [string(128), { type: 'null' }] } });
      else data = object({ items: array(object({ id: Object.assign(identifier(), { description: 'Existing direct child spec ID of the bound items Stack/Grid; list every direct child once.' }), label: string(2000) }), 0, 200) });
      return object({ kind: { type: 'string', enum: [kind] }, bindings: object(bindings), data: data });
    }) };
  }

  function invalid(path, message) {
    var error = new TypeError('DaubBehaviorRecipes: ' + path + ' ' + message + '; use generated behavior fallback.');
    error.code = 'DAUB_RECIPE_INVALID';
    error.path = path;
    throw error;
  }

  function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === null || Object.getPrototypeOf(proto) === null;
  }

  // Inspect descriptors before reading values: reject getters, sparse arrays and cycles without invoking user code.
  function jsonCopy(value, path, budget, ancestors, depth) {
    if (++budget.nodes > 20000 || depth > 32) invalid(path, 'exceeds JSON complexity limits');
    if (typeof value === 'string') {
      budget.characters += value.length;
      if (budget.characters > budget.max) invalid(path, 'exceeds JSON character limit');
      return value;
    }
    if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
    var array = Array.isArray(value);
    if (!array && !record(value)) invalid(path, 'must contain plain JSON');
    if (ancestors.has(value)) invalid(path, 'contains a cycle');
    var keys = Reflect.ownKeys(value).filter(function(key) { return !array || key !== 'length'; });
    if (keys.length > 20000 || array && keys.length !== value.length) invalid(path, 'must be bounded dense JSON');
    ancestors.add(value);
    var result = array ? [] : {};
    keys.forEach(function(key, index) {
      var property = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !property.enumerable || !own(property, 'value') || array && key !== String(index)) invalid(path, 'must contain JSON data properties');
      budget.characters += key.length;
      if (budget.characters > budget.max) invalid(path, 'exceeds JSON character limit');
      Object.defineProperty(result, key, { value: jsonCopy(property.value, path + '.' + key, budget, ancestors, depth + 1), enumerable: true, writable: true, configurable: true });
    });
    ancestors.delete(value);
    return result;
  }

  function fields(value, required, optional, path) {
    if (!record(value)) invalid(path, 'must be an object');
    required.forEach(function(key) { if (!own(value, key)) invalid(path + '.' + key, 'is required'); });
    Object.keys(value).forEach(function(key) { if (required.concat(optional).indexOf(key) < 0) invalid(path + '.' + key, 'is unsupported'); });
  }
  function text(value, max, path) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) invalid(path, 'must be nonblank text of at most ' + max + ' characters');
  }
  function id(value, path) {
    if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(value) || ['__proto__', 'constructor', 'prototype'].indexOf(value) >= 0) invalid(path, 'must be a safe ID of at most 64 characters');
  }
  function list(value, min, max, path) {
    if (!Array.isArray(value) || value.length < min || value.length > max) invalid(path, 'must be an array of ' + min + '..' + max + ' entries');
  }
  function unique(value, seen, path) {
    if (seen.has(value)) invalid(path, 'must be unique');
    seen.add(value);
  }
  function options(value, scored, path) {
    list(value, scored ? 2 : 1, scored ? 12 : 100, path);
    var seen = new Set();
    value.forEach(function(option, index) {
      var at = path + '.' + index;
      fields(option, scored ? ['value', 'label', 'score'] : ['value', 'label'], [], at);
      text(option.value, 128, at + '.value'); text(option.label, 2000, at + '.label');
      unique(option.value, seen, at + '.value');
      if (scored && (typeof option.score !== 'number' || !Number.isFinite(option.score) || Math.abs(option.score) > 1000000)) invalid(at + '.score', 'must be a finite number between -1000000 and 1000000');
    });
  }

  function validateData(descriptor) {
    var data = descriptor.data;
    if (descriptor.kind === 'quiz') {
      fields(data, ['questions'], ['resultLabel'], 'data');
      list(data.questions, 1, 50, 'data.questions');
      var seen = new Set();
      data.questions.forEach(function(question, index) {
        var at = 'data.questions.' + index;
        fields(question, ['id', 'text', 'options'], [], at);
        id(question.id, at + '.id'); unique(question.id, seen, at + '.id'); text(question.text, 2000, at + '.text');
        options(question.options, true, at + '.options');
      });
      if (own(data, 'resultLabel')) text(data.resultLabel, 2000, 'data.resultLabel');
      else data.resultLabel = 'Result';
    } else if (descriptor.kind === 'selection') {
      fields(data, ['options'], ['initialValue'], 'data');
      options(data.options, false, 'data.options');
      if (!own(data, 'initialValue')) data.initialValue = null;
      if (data.initialValue !== null && !data.options.some(function(option) { return option.value === data.initialValue; })) invalid('data.initialValue', 'must match an option value or be null');
    } else {
      fields(data, ['items'], [], 'data');
      list(data.items, 0, 200, 'data.items');
      var items = new Set();
      data.items.forEach(function(item, index) {
        var at = 'data.items.' + index;
        fields(item, ['id', 'label'], [], at);
        id(item.id, at + '.id'); unique(item.id, items, at + '.id'); text(item.label, 2000, at + '.label');
      });
    }
  }

  function validateSpec(descriptor, spec) {
    if (!record(spec) || !record(spec.elements)) invalid('spec', 'must have root and elements');
    id(spec.root, 'spec.root');
    var elements = spec.elements, keys = Object.keys(elements), paths = new Map(), children = new Map(), parents = new Set();
    if (!keys.length || keys.length > 2048) invalid('spec.elements', 'must contain 1..2048 nodes');
    var contract = roles[descriptor.kind], bindings = descriptor.bindings;
    keys.forEach(function(key) {
      id(key, 'spec.elements ID');
      var node = elements[key], at = 'spec.elements.' + key;
      if (!record(node) || typeof node.type !== 'string' || node.props != null && !record(node.props)) invalid(at, 'must be a component definition');
      var props = node.props || {};
      if (own(node, 'children') && own(props, 'children')) invalid(at, 'cannot have children and props.children together');
      var childIds = own(node, 'children') ? node.children : own(props, 'children') ? props.children : [];
      list(childIds, 0, 2048, at + '.children');
      childIds.forEach(function(child) { id(child, at + '.children'); });
      childIds = childIds.slice();
      if (node.type === 'Card' && props.footer != null) {
        list(props.footer, 0, 2048, at + '.props.footer');
        var footer = new Set();
        props.footer.forEach(function(child) {
          id(child, at + '.props.footer'); unique(child, footer, at + '.props.footer');
          if (childIds.indexOf(child) < 0) childIds.push(child);
        });
      }
      children.set(key, childIds);
      if (node.on != null || node.state != null) invalid(at, 'has competing declarative behavior');
      function inspect(value, path, references) {
        if (references && typeof value === 'string' && own(elements, value)) invalid(path, 'uses an unsupported prop-held element reference');
        if (value && typeof value === 'object') Object.keys(value).forEach(function(name) {
          if (/^\$(state|bindState|cond|template)$/.test(name)) invalid(path, 'has competing state expressions');
          inspect(value[name], path + '.' + name, references);
        });
      }
      Object.keys(props).forEach(function(name) {
        if (name !== 'children' && !(name === 'footer' && node.type === 'Card')) inspect(props[name], at + '.props.' + name, own(referenceProps, node.type) && referenceProps[node.type].indexOf(name) >= 0);
      });
    });
    children.forEach(function(ids) {
      ids.forEach(function(key) {
        if (!own(elements, key)) invalid('spec.elements.' + key, 'is missing');
        if (key === spec.root || parents.has(key)) invalid('spec.elements.' + key, 'is repeated or cyclic');
        parents.add(key);
      });
    });
    function visit(key, trail) {
      if (!own(elements, key)) invalid('spec.elements.' + key, 'is missing');
      if (trail.length > 18) invalid('spec.elements.' + key, 'exceeds layout depth');
      if (paths.has(key)) invalid('spec.elements.' + key, 'is repeated or cyclic');
      paths.set(key, trail);
      children.get(key).forEach(function(child) { visit(child, trail.concat(key)); });
    }
    visit(spec.root, []);
    Object.keys(bindings).forEach(function(role) {
      var key = bindings[role], node = elements[key], at = 'bindings.' + role;
      if (!paths.has(key)) invalid(at, 'must reference a reachable element');
      if (contract[role].indexOf(node.type) < 0) invalid(at, 'requires ' + contract[role].join(' or '));
      if (descriptor.kind === 'filter' && role === 'items') {
        var itemIds = descriptor.data.items.map(function(item) { return item.id; }), direct = children.get(key);
        if (direct.length !== itemIds.length || direct.some(function(child) { return itemIds.indexOf(child) < 0; })) invalid(at, 'direct children must exactly match data.items IDs');
        Object.keys(bindings).forEach(function(other) {
          if (other !== 'items' && paths.has(bindings[other]) && paths.get(bindings[other]).indexOf(key) >= 0) invalid(at, 'cannot contain another bound role');
        });
        direct.forEach(function(child) {
          var item = elements[child];
          if (item.visible != null && item.visible !== true || item.props && item.props.hidden) invalid(at, 'cannot contain independently hidden items');
        });
      } else if (!(descriptor.kind === 'quiz' && (role === 'questionScreen' || role === 'resultScreen')) && children.get(key).length) invalid(at, 'must reference a leaf, preserving other bound roots');
      paths.get(key).concat(key).forEach(function(ancestor) {
        var parent = elements[ancestor], props = parent.props || {};
        if (ancestor !== key && containers.indexOf(parent.type) < 0) invalid(at, 'has unsupported ancestor ' + parent.type);
        if (parent.visible != null && parent.visible !== true || props.disabled || props.readOnly || props.loading || props.hidden || props.variant === 'disabled') invalid(at, 'has hidden, disabled or read-only layout');
        if (props.trigger) invalid(at, 'has a competing trigger');
      });
      var props = node.props || {};
      if (node.type === 'Button' && props.type != null && props.type !== 'button') invalid(at, 'requires type button');
      if (node.type === 'Input' && props.type != null && ['text', 'search'].indexOf(props.type) < 0) invalid(at, 'requires a text/search Input');
    });
    if (descriptor.kind === 'quiz' && bindings.questionScreen) {
      if (paths.get(bindings.questionScreen).indexOf(bindings.resultScreen) >= 0 || paths.get(bindings.resultScreen).indexOf(bindings.questionScreen) >= 0) invalid('bindings', 'screen panels must be separate and cannot contain each other');
      var screenContents = { questionScreen: ['question', 'choices', 'back', 'next', 'progress'], resultScreen: ['result', 'answerReview', 'restart'] };
      Object.keys(screenContents).forEach(function(screen) {
        screenContents[screen].forEach(function(role) {
          if (paths.get(bindings[role]).indexOf(bindings[screen]) < 0) invalid('bindings.' + screen, 'must contain ' + role);
        });
      });
    }
  }

  function drawOptions(root, options, value, key, disabled, label) {
    var group = root.matches('.db-radio-group') ? root : root.querySelector('.db-radio-group');
    if (!group) throw new Error('Recipe requires a native DAUB RadioGroup');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', label);
    var signature = JSON.stringify([key, options]);
    if (group.getAttribute('data-recipe-options') !== signature) {
      var doc = root.ownerDocument, fragment = doc.createDocumentFragment();
      options.forEach(function(option) {
        var item = doc.createElement('label'), input = doc.createElement('input'), circle = doc.createElement('span'), text = doc.createElement('span');
        item.className = 'db-radio';
        item.style.minHeight = '44px';
        item.style.overflowWrap = 'anywhere';
        input.className = 'db-radio__input'; input.type = 'radio';
        input.name = 'daub-recipe-' + root.getAttribute('data-spec-id');
        input.value = option.value;
        input.setAttribute('data-recipe-key', key);
        circle.className = 'db-radio__circle';
        text.textContent = option.label;
        item.append(input, circle, text); fragment.appendChild(item);
      });
      group.replaceChildren(fragment);
      group.setAttribute('data-recipe-options', signature);
    }
    group.querySelectorAll('input[type="radio"]').forEach(function(input) { input.checked = input.value === value; input.disabled = disabled; });
  }

  function quizReduce(state, action) {
    if (!action || typeof action !== 'object') return state;
    if (action.type === 'RESTART') return Object.assign({}, state, { answers: state.data.questions.map(function() { return null; }), index: 0, completed: false });
    var question = state.data.questions[state.index];
    if (action.type === 'SELECT' && !state.completed && action.questionId === question.id && question.options.some(function(option) { return option.value === action.value; })) {
      var answers = state.answers.slice(); answers[state.index] = action.value;
      return Object.assign({}, state, { answers: answers });
    }
    if (action.type === 'BACK' && (state.index > 0 || state.completed)) return Object.assign({}, state, { completed: false, index: state.completed ? state.index : state.index - 1 });
    if (action.type === 'NEXT' && !state.completed && state.answers[state.index] !== null) {
      if (state.index === state.data.questions.length - 1) return Object.assign({}, state, { completed: true });
      return Object.assign({}, state, { index: state.index + 1 });
    }
    return state;
  }
  function quizOutput(state) {
    var answers = [];
    state.data.questions.forEach(function(question, index) {
      var choice = question.options.find(function(option) { return option.value === state.answers[index]; });
      if (choice) answers.push({ questionId: question.id, question: question.text, answer: choice.label, value: choice.value, score: choice.score });
    });
    return { completed: state.completed, step: state.index + 1, total: state.data.questions.length, answers: answers, result: state.completed ? answers.reduce(function(sum, answer) { return sum + answer.score; }, 0) : null };
  }
  function quizRender(state, ui) {
    var b = state.bindings, question = state.data.questions[state.index], result = quizOutput(state);
    ui.text(b.question, question.text);
    ui.get(b.question).style.overflowWrap = 'anywhere';
    ui.text(b.progress, result.step + ' of ' + result.total);
    ui.get(b.progress).setAttribute('aria-live', 'polite');
    drawOptions(ui.get(b.choices), question.options, state.answers[state.index], question.id, state.completed, question.text);
    ui.get(b.back).disabled = state.index === 0 && !state.completed;
    ui.get(b.next).disabled = state.completed || state.answers[state.index] === null;
    ui.get(b.result).hidden = !state.completed;
    ui.get(b.result).setAttribute('aria-live', 'polite');
    ui.get(b.result).style.overflowWrap = 'anywhere';
    ui.text(b.result, state.completed ? state.data.resultLabel + ': ' + result.result : '');
    if (b.questionScreen) {
      ui.get(b.questionScreen).hidden = state.completed;
      ui.get(b.resultScreen).hidden = !state.completed;
      ui.text(b.answerReview, state.completed ? result.answers.map(function(answer) { return answer.question + ': ' + answer.answer; }).join('\n') : '');
      ui.get(b.answerReview).style.whiteSpace = 'pre-wrap';
      ui.get(b.answerReview).style.overflowWrap = 'anywhere';
    }
  }
  function quizBind(ui, dispatch, bindings) {
    ui.on(bindings.choices, 'change', function(event) {
      var input = event.target;
      if (input.matches('input[type="radio"][data-recipe-key]') && input.checked && !input.disabled) dispatch({ type: 'SELECT', questionId: input.getAttribute('data-recipe-key'), value: input.value });
    });
    ui.on(bindings.back, 'click', function(event) { event.preventDefault(); dispatch({ type: 'BACK' }); });
    ui.on(bindings.next, 'click', function(event) { event.preventDefault(); dispatch({ type: 'NEXT' }); });
    if (bindings.restart) ui.on(bindings.restart, 'click', function(event) { event.preventDefault(); dispatch({ type: 'RESTART' }); });
  }
  function selectionReduce(state, action) {
    if (action && action.type === 'SELECT' && state.data.options.some(function(option) { return option.value === action.value; })) return Object.assign({}, state, { selected: action.value });
    return state;
  }
  function selectionOutput(state) {
    var choice = state.data.options.find(function(option) { return option.value === state.selected; });
    return { completed: !!choice, selected: choice ? choice.value : null, label: choice ? choice.label : null, total: state.data.options.length };
  }
  function selectionRender(state, ui) {
    var root = ui.get(state.bindings.choices), group = root.matches('.db-radio-group') ? root : root.querySelector('.db-radio-group');
    drawOptions(root, state.data.options, state.selected, 'selection', false, group && group.getAttribute('aria-label') || 'Options');
    ui.text(state.bindings.summary, selectionOutput(state).label || '');
    ui.get(state.bindings.summary).style.overflowWrap = 'anywhere';
    ui.get(state.bindings.summary).setAttribute('aria-live', 'polite');
  }
  function selectionBind(ui, dispatch, bindings) {
    ui.on(bindings.choices, 'change', function(event) {
      var input = event.target;
      if (input.matches('input[type="radio"][data-recipe-key]') && input.checked && !input.disabled) dispatch({ type: 'SELECT', value: input.value });
    });
  }
  function filterReduce(state, action) {
    if (action && action.type === 'QUERY' && typeof action.value === 'string') return Object.assign({}, state, { query: action.value.slice(0, 200) });
    return state;
  }
  function filterOutput(state) {
    var query = state.query.trim().toLowerCase();
    var ids = state.data.items.filter(function(item) { return item.label.toLowerCase().indexOf(query) >= 0; }).map(function(item) { return item.id; });
    return { query: state.query, visibleIds: ids, count: ids.length, total: state.data.items.length };
  }
  function filterRender(state, ui) {
    var b = state.bindings, result = filterOutput(state), input = ui.input(b.query), root = ui.get(b.items);
    input.maxLength = 200;
    if (input.value !== state.query) input.value = state.query;
    var clear = ui.get(b.query).querySelector('.db-search__clear');
    if (clear) clear.hidden = !state.query;
    if (!root.querySelector('style[data-recipe-visibility]')) {
      var style = root.ownerDocument.createElement('style');
      style.setAttribute('data-recipe-visibility', '');
      style.textContent = '[data-spec-id="' + b.items + '"] > [data-spec-id][hidden]{display:none!important}';
      root.appendChild(style);
    }
    state.data.items.forEach(function(item) {
      ui.get(item.id).hidden = result.visibleIds.indexOf(item.id) < 0;
    });
    ui.text(b.count, result.count + ' of ' + result.total);
    ui.get(b.count).setAttribute('aria-live', 'polite');
  }
  function filterBind(ui, dispatch, bindings) {
    ui.on(bindings.query, 'input', function(event) { if (event.target === ui.input(bindings.query)) dispatch({ type: 'QUERY', value: event.target.value }); });
    ui.on(bindings.query, 'click', function(event) {
      if (event.target.closest('.db-search__clear')) { event.preventDefault(); dispatch({ type: 'QUERY', value: '' }); ui.input(bindings.query).focus(); }
    });
  }

  function body(fn, parameters, helpers) {
    return (helpers || []).map(function(helper) { return helper.toString() + '\n'; }).join('') + 'return (' + fn.toString() + ')(' + parameters + ');';
  }
  function validate(descriptor) {
    descriptor = jsonCopy(descriptor, 'descriptor', { nodes: 0, characters: 0, max: 131072 }, new Set(), 0);
    fields(descriptor, ['kind', 'bindings', 'data'], [], 'descriptor');
    if (typeof descriptor.kind !== 'string' || !own(roles, descriptor.kind)) invalid('descriptor.kind', 'must be quiz, selection or filter');
    validateData(descriptor);
    var optional = descriptor.kind === 'quiz' ? quizScreenRoles : [];
    fields(descriptor.bindings, Object.keys(roles[descriptor.kind]).filter(function(role) { return optional.indexOf(role) < 0; }), optional, 'bindings');
    optional.forEach(function(role) { if (descriptor.bindings[role] === null) delete descriptor.bindings[role]; });
    var supplied = optional.filter(function(role) { return own(descriptor.bindings, role); });
    if (supplied.length && supplied.length !== optional.length) invalid('bindings', 'quiz screens require all four roles: ' + optional.join(', '));
    var bound = new Set();
    Object.keys(descriptor.bindings).forEach(function(role) { id(descriptor.bindings[role], 'bindings.' + role); unique(descriptor.bindings[role], bound, 'bindings.' + role); });
    return descriptor;
  }
  function compile(descriptor, spec) {
    descriptor = validate(descriptor);
    spec = jsonCopy(spec, 'spec', { nodes: 0, characters: 0, max: 2097152 }, new Set(), 0);
    validateSpec(descriptor, spec);
    var kind = descriptor.kind, initial = { bindings: descriptor.bindings, data: descriptor.data }, reduce, render, bind, output, helpers;
    if (kind === 'quiz') {
      initial.index = 0; initial.answers = descriptor.data.questions.map(function() { return null; }); initial.completed = false;
      reduce = quizReduce; render = quizRender; bind = quizBind; output = quizOutput; helpers = [drawOptions, quizOutput];
    } else if (kind === 'selection') {
      initial.selected = descriptor.data.initialValue;
      reduce = selectionReduce; render = selectionRender; bind = selectionBind; output = selectionOutput; helpers = [drawOptions, selectionOutput];
    } else {
      initial.query = '';
      reduce = filterReduce; render = filterRender; bind = filterBind; output = filterOutput; helpers = [filterOutput];
    }
    // Only validated IDs enter bind's JSON literal. All content stays in plain initial state, never in source.
    return { initial: initial, reduce: body(reduce, 'state,action'), render: body(render, 'state,ui', helpers), bind: body(bind, 'ui,dispatch,' + JSON.stringify(descriptor.bindings)), output: body(output, 'state') };
  }

  return Object.freeze({ compile: compile, descriptorSchema: descriptorSchema, documentation: documentation, validate: validate });
}));
