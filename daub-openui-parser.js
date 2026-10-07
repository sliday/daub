// daub-openui-parser.js — Standalone OpenUI Lang parser for DAUB
// Converts OpenUI Lang text → DAUB flat spec { theme, root, elements }
// No dependencies. Works in browser and Node.js.

(function(root) {
'use strict';

// ---- Component Schema: ordered positional args for each DAUB component ----
var COMP_SCHEMA = {
  // Layout & Structure
  Stack: ['children', 'direction', 'gap', 'justify', 'align', 'wrap', 'container'],
  Grid: ['children', 'columns', 'gap', 'align', 'container'],
  Surface: ['children', 'variant'],
  Text: ['content', 'tag', 'class'],
  Prose: ['content', 'size'],
  Separator: ['vertical', 'dashed', 'label'],
  Layout: ['children', 'direction', 'columns', 'gap', 'align', 'valign'],
  Divider: ['vertical', 'dashed', 'label'],
  Icon: ['name', 'size', 'variant'],
  Link: ['label', 'href', 'class'],
  // Controls
  Button: ['label', 'variant', 'size', 'loading', 'icon', 'trigger'],
  ButtonGroup: ['children'],
  Field: ['children', 'label', 'placeholder', 'type', 'error', 'helper', 'value'],
  Input: ['placeholder', 'size', 'error', 'type', 'value'],
  InputGroup: ['children', 'addonBefore', 'addonAfter'],
  InputIcon: ['children', 'icon', 'right'],
  Search: ['placeholder'],
  Textarea: ['placeholder', 'rows', 'error', 'value'],
  Checkbox: ['label', 'checked'],
  CheckboxGroup: ['children', 'label', 'helper', 'inline'],
  Fieldset: ['children', 'legend', 'helper', 'disabled'],
  Group: ['children', 'attached', 'vertical', 'label'],
  NumberField: ['value', 'min', 'max', 'step', 'label'],
  RadioGroup: ['options', 'selected'],
  Switch: ['label', 'checked'],
  Slider: ['min', 'max', 'value', 'step', 'label'],
  Toggle: ['label', 'pressed', 'size'],
  ToggleGroup: ['options', 'selected'],
  Select: ['label', 'options', 'selected'],
  CustomSelect: ['placeholder', 'options', 'searchable'],
  Kbd: ['keys'],
  Label: ['text', 'required', 'optional'],
  Spinner: ['size'],
  InputOTP: ['length', 'separator'],
  // Navigation
  Tabs: ['children', 'tabs', 'active'],
  Breadcrumbs: ['items'],
  Pagination: ['current', 'total', 'perPage'],
  Stepper: ['steps', 'vertical'],
  NavMenu: ['items'],
  Navbar: ['children', 'brand', 'brandHref'],
  Toolbar: ['children', 'vertical', 'label'],
  Menubar: ['items'],
  Sidebar: ['sections', 'collapsed'],
  BottomNav: ['items'],
  // Data Display
  Card: ['children', 'title', 'description', 'media', 'footer', 'interactive', 'clip'],
  Frame: ['children', 'header', 'footer', 'flush'],
  Table: ['columns', 'rows', 'sortable'],
  DataTable: ['columns', 'rows', 'selectable'],
  List: ['items'],
  Badge: ['text', 'variant'],
  Avatar: ['initials', 'src', 'size'],
  AvatarGroup: ['avatars', 'max'],
  Calendar: ['selected', 'today'],
  Chart: ['bars'],
  Carousel: ['slides'],
  AspectRatio: ['children', 'ratio'],
  Chip: ['label', 'color', 'active', 'closable'],
  ScrollArea: ['children', 'direction'],
  MessageScroller: ['children', 'height', 'autoScroll', 'defaultScrollPosition', 'peek'],
  Message: ['children', 'align', 'avatar', 'name', 'timestamp', 'messageId', 'scrollAnchor', 'footer'],
  Bubble: ['children', 'content', 'variant', 'align', 'reactions'],
  Attachment: ['children', 'name', 'description', 'src', 'alt', 'href', 'size', 'state', 'progress', 'orientation'],
  Marker: ['children', 'content', 'icon', 'variant', 'status', 'busy'],
  ChatComposer: ['models', 'model', 'effort', 'approval', 'mode', 'actions', 'capabilities', 'busy', 'placeholder', 'id'],
  Image: ['src', 'alt', 'width', 'height'],
  // Feedback
  Alert: ['type', 'title', 'message'],
  Progress: ['value', 'indeterminate'],
  Meter: ['value', 'min', 'max', 'status', 'label'],
  Skeleton: ['variant', 'lines'],
  EmptyState: ['icon', 'title', 'message', 'children'],
  Tooltip: ['children', 'text', 'position'],
  // Overlays
  Modal: ['children', 'id', 'title', 'footer'],
  AlertDialog: ['id', 'title', 'description', 'footer'],
  Sheet: ['children', 'id', 'position'],
  Drawer: ['children', 'id'],
  Popover: ['children', 'position'],
  HoverCard: ['children'],
  PreviewCard: ['children', 'trigger', 'title', 'description', 'media', 'mediaAlt'],
  DropdownMenu: ['items'],
  ContextMenu: ['items'],
  CommandPalette: ['id', 'placeholder', 'groups'],
  // Layout Utilities
  Accordion: ['items', 'multi'],
  Collapsible: ['children', 'label'],
  Resizable: ['children', 'direction'],
  DatePicker: ['label', 'placeholder', 'selected'],
  // Dashboard
  StatCard: ['label', 'value', 'trend', 'trendValue', 'icon', 'horizontal'],
  ChartCard: ['children', 'title'],
  // Custom
  CustomHTML: ['html', 'css', 'js', 'children']
};

// ---- Token types ----
var T = {
  STRING: 1,
  NUMBER: 2,
  BOOL: 3,
  NULL: 4,
  IDENT: 5,
  TYPE: 6,    // PascalCase identifier (component name)
  LPAR: 7,    // (
  RPAR: 8,    // )
  LBRK: 9,    // [
  RBRK: 10,   // ]
  LBRC: 11,   // {
  RBRC: 12,   // }
  EQ: 13,     // =
  COMMA: 14,  // ,
  COLON: 15,  // :
  EOF: 16
};

// ---- Tokenizer ----
function tokenize(input) {
  var tokens = [];
  var i = 0;
  var len = input.length;

  while (i < len) {
    var ch = input[i];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { i++; continue; }

    // Line comments
    if (ch === '/' && i + 1 < len && input[i + 1] === '/') {
      while (i < len && input[i] !== '\n') i++;
      continue;
    }

    // Strings (double or single quoted)
    if (ch === '"' || ch === "'") {
      var quote = ch;
      var s = '';
      i++;
      while (i < len && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < len) {
          var next = input[i + 1];
          if (next === 'n') { s += '\n'; i += 2; }
          else if (next === 't') { s += '\t'; i += 2; }
          else if (next === '\\') { s += '\\'; i += 2; }
          else if (next === quote) { s += quote; i += 2; }
          else if (next === '/') { s += '/'; i += 2; }
          else { s += next; i += 2; }
        } else {
          s += input[i];
          i++;
        }
      }
      if (i < len) i++; // skip closing quote
      tokens.push({ t: T.STRING, v: s });
      continue;
    }

    // Numbers (including negative)
    if ((ch >= '0' && ch <= '9') || (ch === '-' && i + 1 < len && input[i + 1] >= '0' && input[i + 1] <= '9')) {
      var num = '';
      if (ch === '-') { num += '-'; i++; }
      while (i < len && ((input[i] >= '0' && input[i] <= '9') || input[i] === '.')) {
        num += input[i];
        i++;
      }
      tokens.push({ t: T.NUMBER, v: parseFloat(num) });
      continue;
    }

    // Identifiers, booleans, null, component types
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      var id = '';
      while (i < len && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z') ||
             (input[i] >= '0' && input[i] <= '9') || input[i] === '_' || input[i] === '-' || input[i] === '$')) {
        id += input[i];
        i++;
      }
      if (id === 'true' || id === 'false') {
        tokens.push({ t: T.BOOL, v: id === 'true' });
      } else if (id === 'null') {
        tokens.push({ t: T.NULL, v: null });
      } else if (ch >= 'A' && ch <= 'Z' && COMP_SCHEMA[id]) {
        tokens.push({ t: T.TYPE, v: id });
      } else {
        tokens.push({ t: T.IDENT, v: id });
      }
      continue;
    }

    // Single-char tokens
    if (ch === '(') { tokens.push({ t: T.LPAR }); i++; continue; }
    if (ch === ')') { tokens.push({ t: T.RPAR }); i++; continue; }
    if (ch === '[') { tokens.push({ t: T.LBRK }); i++; continue; }
    if (ch === ']') { tokens.push({ t: T.RBRK }); i++; continue; }
    if (ch === '{') { tokens.push({ t: T.LBRC }); i++; continue; }
    if (ch === '}') { tokens.push({ t: T.RBRC }); i++; continue; }
    if (ch === '=') { tokens.push({ t: T.EQ }); i++; continue; }
    if (ch === ',') { tokens.push({ t: T.COMMA }); i++; continue; }
    if (ch === ':') { tokens.push({ t: T.COLON }); i++; continue; }

    // Skip unknown characters
    i++;
  }

  tokens.push({ t: T.EOF });
  return tokens;
}

// ---- Parser ----
function Parser(tokens) {
  this.tokens = tokens;
  this.pos = 0;
}

Parser.prototype.peek = function() {
  return this.tokens[this.pos] || { t: T.EOF };
};

Parser.prototype.next = function() {
  var tok = this.tokens[this.pos] || { t: T.EOF };
  this.pos++;
  return tok;
};

Parser.prototype.expect = function(type) {
  var tok = this.next();
  if (tok.t !== type) throw new Error('Expected token type ' + type + ' but got ' + tok.t);
  return tok;
};

Parser.prototype.match = function(type) {
  if (this.peek().t === type) { this.pos++; return true; }
  return false;
};

// Parse a value expression
Parser.prototype.parseExpr = function() {
  var tok = this.peek();

  // Component call: Type(args...)
  if (tok.t === T.TYPE) {
    return this.parseComponent();
  }

  // String literal
  if (tok.t === T.STRING) {
    this.next();
    return tok.v;
  }

  // Number literal
  if (tok.t === T.NUMBER) {
    this.next();
    return tok.v;
  }

  // Boolean
  if (tok.t === T.BOOL) {
    this.next();
    return tok.v;
  }

  // Null
  if (tok.t === T.NULL) {
    this.next();
    return null;
  }

  // Array literal [...]
  if (tok.t === T.LBRK) {
    return this.parseArray();
  }

  // Object literal {...}
  if (tok.t === T.LBRC) {
    return this.parseObject();
  }

  // Identifier reference
  if (tok.t === T.IDENT) {
    this.next();
    return { __ref: tok.v };
  }

  // Can't parse — return null
  this.next();
  return null;
};

// Parse Component(arg1, arg2, ...) or Component(key: val, ...)
Parser.prototype.parseComponent = function() {
  var typeTok = this.next(); // TYPE token
  var typeName = typeTok.v;
  var args = [];
  var namedArgs = {};
  var hasNamed = false;

  if (this.match(T.LPAR)) {
    while (this.peek().t !== T.RPAR && this.peek().t !== T.EOF) {
      // Check for named argument: ident: value
      if (this.peek().t === T.IDENT && this.pos + 1 < this.tokens.length && this.tokens[this.pos + 1].t === T.COLON) {
        var name = this.next().v;
        this.next(); // skip colon
        var val = this.parseExpr();
        namedArgs[name] = val;
        hasNamed = true;
      } else {
        args.push(this.parseExpr());
      }
      this.match(T.COMMA);
    }
    this.match(T.RPAR);
  }

  return { __component: typeName, __args: args, __named: namedArgs, __hasNamed: hasNamed };
};

// Parse array [expr, expr, ...]
Parser.prototype.parseArray = function() {
  this.next(); // skip [
  var arr = [];
  while (this.peek().t !== T.RBRK && this.peek().t !== T.EOF) {
    arr.push(this.parseExpr());
    this.match(T.COMMA);
  }
  this.match(T.RBRK);
  return arr;
};

// Parse object { key: value, ... }
Parser.prototype.parseObject = function() {
  this.next(); // skip {
  var obj = {};
  while (this.peek().t !== T.RBRC && this.peek().t !== T.EOF) {
    var key;
    var keyTok = this.peek();
    if (keyTok.t === T.IDENT || keyTok.t === T.TYPE) {
      key = this.next().v;
    } else if (keyTok.t === T.STRING) {
      key = this.next().v;
    } else {
      this.next(); // skip unknown
      continue;
    }
    this.expect(T.COLON);
    obj[key] = this.parseExpr();
    this.match(T.COMMA);
  }
  this.match(T.RBRC);
  return obj;
};

// Parse all statements: ident = expr
Parser.prototype.parseStatements = function() {
  var stmts = [];
  while (this.peek().t !== T.EOF) {
    if (this.peek().t === T.IDENT) {
      var saved = this.pos;
      var ident = this.next().v;
      if (this.peek().t === T.EQ) {
        this.next(); // skip =
        var expr = this.parseExpr();
        stmts.push({ name: ident, value: expr });
      } else {
        // Not an assignment — might be a bare expression, skip
        this.pos = saved;
        this.next();
      }
    } else if (this.peek().t === T.TYPE) {
      // Bare component without assignment — auto-name
      var expr2 = this.parseComponent();
      stmts.push({ name: null, value: expr2 });
    } else {
      this.next(); // skip unexpected token
    }
  }
  return stmts;
};

// ---- Resolve statements into DAUB spec ----
var _counter = 0;

// Overlays models call id-first, in AlertDialog order: Modal("upload-modal", "Upload files", ...)
var ID_FIRST = { Modal: 1, Sheet: 1, Drawer: 1 };
function isIdLike(v) {
  return typeof v === 'string' && /^[A-Za-z][\w-]*$/.test(v);
}

// A named element listed under two parents renders once: the first placement in document order wins.
// A repeat in a sibling panel of the same Tabs stays (one panel shows at a time). Mutates children arrays.
function dedupeRefs(elements, rootId) {
  var placed = Object.create(null), onPath = Object.create(null);
  (function walk(id, panel) {
    var el = elements[id];
    if (!el || !Array.isArray(el.children) || onPath[id]) return;
    onPath[id] = true;
    el.children = el.children.filter(function(cid, i) {
      var ctx = el.type === 'Tabs' ? id + '#' + i : panel;
      var prev = placed[cid];
      if (!prev) { placed[cid] = [ctx]; walk(cid, ctx); return true; }
      var tabs = ctx && ctx.split('#')[0];
      var sibling = tabs && prev.every(function(p) { return p && p !== ctx && p.split('#')[0] === tabs; });
      if (sibling) prev.push(ctx);
      return !!sibling;
    });
    delete onPath[id];
  })(rootId, null);
  return elements;
}

function genId(prefix) {
  _counter++;
  return (prefix || 'el') + '-' + _counter;
}

function resolveStatements(stmts) {
  _counter = 0;
  var elements = {};
  var nameToId = {};
  var theme = 'bone';
  var rootName = null;
  var state = null;
  var stmtIds = [];
  // Data statements (name = literal array/object/string/number/bool), keyed by name.
  // References to them resolve to their value wherever they are defined in the file.
  var dataStmts = Object.create(null);
  var resolvingData = Object.create(null);
  // Alias statements (name = otherName) create no element: every use of the alias resolves to its target
  var aliasOf = Object.create(null);
  function canon(n) {
    var seen = Object.create(null);
    while (aliasOf[n] && !seen[n]) { seen[n] = true; n = aliasOf[n]; }
    return n;
  }

  function isDataValue(v) {
    if (v === null || v === undefined) return false;
    if (typeof v !== 'object') return true;
    return Array.isArray(v) || (!v.__ref && !v.__component);
  }
  function isData(name) {
    return Object.prototype.hasOwnProperty.call(dataStmts, name);
  }
  // Switch(webhook1) with __state = {webhook1: true}: a bare __state key sets the control's state instead of printing as its label
  var STATE_PROP = { Switch: 'checked', Checkbox: 'checked', Toggle: 'pressed' };
  function stateKey(v) {
    var k = v && v.__ref;
    return k && !nameToId[k] && state && typeof state === 'object' && !Array.isArray(state) && Object.prototype.hasOwnProperty.call(state, k) ? k : null;
  }

  // First pass: assign IDs
  for (var i = 0; i < stmts.length; i++) {
    var stmt = stmts[i];
    if (stmt.name === '__theme') {
      theme = typeof stmt.value === 'string' ? stmt.value : 'bone';
      continue;
    }
    if (stmt.name === '__state') {
      state = stmt.value;
      continue;
    }
    var id = stmt.name || genId('auto');
    stmtIds[i] = id;
    nameToId[id] = id;
    if (stmt.name && isDataValue(stmt.value)) dataStmts[stmt.name] = stmt.value;
    else if (stmt.name && stmt.value && stmt.value.__ref && stmt.value.__ref !== stmt.name) aliasOf[stmt.name] = stmt.value.__ref;
    if (!rootName && !isData(id)) rootName = id;
    if (stmt.name === 'root') rootName = id;
  }

  // Resolve a data statement by name; a cycle falls back to the bare name (pre-resolution behavior)
  function resolveData(name) {
    if (resolvingData[name]) return name;
    resolvingData[name] = true;
    var out = resolveValue(dataStmts[name]);
    delete resolvingData[name];
    return out;
  }

  // Second pass: resolve component trees
  function resolveValue(val) {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
    if (Array.isArray(val)) return val.map(resolveValue);

    // Reference to another statement
    if (val.__ref) {
      var ref = canon(val.__ref);
      if (isData(ref)) return resolveData(ref);
      return ref; // Return as string ID reference
    }

    // Component node
    if (val.__component) {
      return resolveComponent(val);
    }

    // Plain object
    var resolved = {};
    for (var k in val) {
      if (val.hasOwnProperty(k)) {
        resolved[k] = resolveValue(val[k]);
      }
    }
    return resolved;
  }

  function resolveComponent(comp) {
    var typeName = comp.__component;
    var schema = COMP_SCHEMA[typeName];
    var args = comp.__args;
    var props = {};
    var childIds = [];
    // Modal("upload-modal", "Upload files", "Drop files here", [footer]) or Modal("upload-modal", [body], "Upload files"):
    // an id-first call (AlertDialog order). Text args are the title then the description; an array before them is the body,
    // after them the footer. Modal("Body", "id", "Title") keeps the schema order (its 2nd arg is id-shaped)
    if (ID_FIRST[typeName] && isIdLike(args[0]) && args.length > 1 && !isIdLike(args[1])) {
      props.id = args[0];
      var sawText = false;
      for (var m = 1; m < args.length; m++) {
        if (typeof args[m] === 'string') {
          if (props.title == null) props.title = args[m];
          else if (props.description == null) props.description = args[m];
          sawText = true;
        } else if (!sawText) collectChildren(args[m], childIds, typeName);
        else props.footer = resolveValue(args[m]);
      }
      args = [];
    }
    // Tabs(["All", "Active"], "All"): a first arg of only quoted labels is the tab list, not the panels
    if (typeName === 'Tabs' && Array.isArray(args[0]) && args[0].length && args[0].every(function(x) { return typeof x === 'string' && !nameToId[x]; })) schema = ['tabs', 'active'];

    var stateArg = STATE_PROP[typeName] && stateKey(args[0]);
    if (stateArg) props[STATE_PROP[typeName]] = state[stateArg];

    // Map positional args to named props using schema
    if (schema && args.length > 0) {
      for (var a = stateArg ? 1 : 0; a < args.length; a++) {
        if (a < schema.length) {
          var propName = schema[a];
          var argVal = args[a];
          if (propName === 'children') {
            // Children are component calls or references
            collectChildren(argVal, childIds, typeName);
          } else {
            props[propName] = resolveValue(argVal);
          }
        }
      }
    }

    // Apply named args (override positional)
    if (comp.__hasNamed) {
      for (var key in comp.__named) {
        if (comp.__named.hasOwnProperty(key)) {
          if (key === 'children') {
            collectChildren(comp.__named[key], childIds, typeName);
          } else {
            props[key] = resolveValue(comp.__named[key]);
          }
        }
      }
    }

    // Create element ID for this component
    var elId = genId(typeName.toLowerCase());
    elements[elId] = { type: typeName, props: props };
    if (childIds.length > 0) elements[elId].children = childIds;

    return elId;
  }

  // Push child IDs for a children value; arrays and data-statement references are expanded in place
  function collectChildren(val, out, parentType) {
    if (Array.isArray(val)) {
      for (var c = 0; c < val.length; c++) collectChildren(val[c], out, parentType);
      return;
    }
    var dref = val && val.__ref && canon(val.__ref);
    if (dref && isData(dref) && !resolvingData[dref]) {
      resolvingData[dref] = true;
      collectChildren(dataStmts[dref], out, parentType);
      delete resolvingData[dref];
      return;
    }
    var childId = processChild(val, parentType);
    if (childId) out.push(childId);
  }

  function processChild(childVal, parentType) {
    if (childVal === null || childVal === undefined) return null;
    if (typeof childVal === 'string') {
      // Could be a reference name or a literal string
      if (nameToId[childVal]) return canon(childVal);
      // Treat as inline Text
      var tid = genId('text');
      elements[tid] = { type: 'Text', props: { content: childVal } };
      return tid;
    }
    if (typeof childVal === 'number' || typeof childVal === 'boolean') {
      var tid2 = genId('text');
      elements[tid2] = { type: 'Text', props: { content: String(childVal) } };
      return tid2;
    }
    if (childVal.__ref) {
      return canon(childVal.__ref);
    }
    if (childVal.__component) {
      return resolveComponent(childVal);
    }
    return null;
  }

  // Process each statement
  for (var j = 0; j < stmts.length; j++) {
    var s = stmts[j];
    if (s.name === '__theme' || s.name === '__state') continue;
    var name = stmtIds[j];

    if (s.value && s.value.__component) {
      // Resolve the component and use the statement name as the ID
      var compResult = resolveComponent(s.value);
      // Rename the auto-generated ID to the statement name
      if (compResult !== name && elements[compResult]) {
        elements[name] = elements[compResult];
        delete elements[compResult];
        // Update any children references
        for (var eid in elements) {
          if (elements[eid].children) {
            for (var ci2 = 0; ci2 < elements[eid].children.length; ci2++) {
              if (elements[eid].children[ci2] === compResult) {
                elements[eid].children[ci2] = name;
              }
            }
          }
        }
      }
    } else {
      // Non-component value — treat as props shorthand or skip
    }
  }

  if (rootName) rootName = canon(rootName); // root = page
  if (!rootName || !elements[rootName]) {
    // Use first element as root
    var keys = Object.keys(elements);
    if (keys.length > 0) rootName = keys[0];
  }
  if (rootName) dedupeRefs(elements, rootName);

  var spec = { theme: theme, root: rootName || 'root', elements: elements };
  if (state) spec.state = state;
  return spec;
}

// ---- Main entry point ----
function openUItoSpec(input) {
  if (!input || typeof input !== 'string') return null;

  // Strip markdown code fences
  input = input.trim().replace(/^```\w*\n?/, '').replace(/\n?```\s*$/, '');

  try {
    var tokens = tokenize(input);
    var parser = new Parser(tokens);
    var stmts = parser.parseStatements();
    if (stmts.length === 0) return null;
    return resolveStatements(stmts);
  } catch (e) {
    // Try partial parse on error
    try {
      // Truncate to last complete line
      var lastNewline = input.lastIndexOf('\n');
      if (lastNewline > 0) {
        var partial = input.substring(0, lastNewline);
        var tokens2 = tokenize(partial);
        var parser2 = new Parser(tokens2);
        var stmts2 = parser2.parseStatements();
        if (stmts2.length > 0) return resolveStatements(stmts2);
      }
    } catch (e2) {}
    return null;
  }
}

// ---- Streaming parser ----
function createStreamingOpenUIParser() {
  return {
    push: function(accumulated) {
      if (!accumulated || accumulated.length < 5) return { spec: null, meta: { incomplete: true } };

      // Parse only complete lines
      var lastNl = accumulated.lastIndexOf('\n');
      var toParse = lastNl > 0 ? accumulated.substring(0, lastNl) : accumulated;

      var spec = openUItoSpec(toParse);
      return {
        spec: spec,
        meta: { incomplete: lastNl < accumulated.length - 1 }
      };
    }
  };
}

// ---- Format detection ----
function detectFormat(text) {
  if (!text) return 'unknown';
  var t = text.trim().replace(/^```\w*\n?/, '');
  if (t[0] === '{') return 'json';
  if (/^[a-zA-Z_]\w*\s*=/.test(t)) return 'openui';
  return 'unknown';
}

// ---- Exports ----
var exports = {
  openUItoSpec: openUItoSpec,
  createStreamingOpenUIParser: createStreamingOpenUIParser,
  detectFormat: detectFormat,
  tokenize: tokenize,
  dedupeRefs: dedupeRefs,
  COMP_SCHEMA: COMP_SCHEMA
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports;
} else {
  root.DaubOpenUI = exports;
}

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
