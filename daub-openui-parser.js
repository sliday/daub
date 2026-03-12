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
  // Controls
  Button: ['label', 'variant', 'size', 'loading', 'icon', 'trigger'],
  ButtonGroup: ['children'],
  Field: ['label', 'placeholder', 'type', 'error', 'helper'],
  Input: ['placeholder', 'size', 'error', 'type'],
  InputGroup: ['children', 'addonBefore', 'addonAfter'],
  InputIcon: ['children', 'icon', 'right'],
  Search: ['placeholder'],
  Textarea: ['placeholder', 'rows', 'error'],
  Checkbox: ['label', 'checked'],
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
  Menubar: ['items'],
  Sidebar: ['sections', 'collapsed'],
  BottomNav: ['items'],
  // Data Display
  Card: ['children', 'title', 'description', 'media', 'footer', 'interactive', 'clip'],
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
  Image: ['src', 'alt', 'width', 'height'],
  // Feedback
  Alert: ['type', 'title', 'message'],
  Progress: ['value', 'indeterminate'],
  Skeleton: ['variant', 'lines'],
  EmptyState: ['icon', 'title', 'message'],
  Tooltip: ['children', 'text', 'position'],
  // Overlays
  Modal: ['children', 'id', 'title', 'footer'],
  AlertDialog: ['id', 'title', 'description', 'footer'],
  Sheet: ['children', 'id', 'position'],
  Drawer: ['children', 'id'],
  Popover: ['children', 'position'],
  HoverCard: ['children'],
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
    nameToId[id] = id;
    if (!rootName) rootName = id;
    if (stmt.name === 'root') rootName = id;
  }

  // Second pass: resolve component trees
  function resolveValue(val) {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
    if (Array.isArray(val)) return val.map(resolveValue);

    // Reference to another statement
    if (val.__ref) {
      return val.__ref; // Return as string ID reference
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
    var props = {};
    var childIds = [];

    // Map positional args to named props using schema
    if (schema && comp.__args.length > 0) {
      for (var a = 0; a < comp.__args.length; a++) {
        if (a < schema.length) {
          var propName = schema[a];
          var argVal = comp.__args[a];
          if (propName === 'children') {
            // Children are component calls or references
            if (Array.isArray(argVal)) {
              for (var c = 0; c < argVal.length; c++) {
                var childVal = argVal[c];
                var childId = processChild(childVal, typeName);
                if (childId) childIds.push(childId);
              }
            } else {
              var cid = processChild(argVal, typeName);
              if (cid) childIds.push(cid);
            }
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
            var cval = comp.__named[key];
            if (Array.isArray(cval)) {
              for (var ci = 0; ci < cval.length; ci++) {
                var cid2 = processChild(cval[ci], typeName);
                if (cid2) childIds.push(cid2);
              }
            } else {
              var cid3 = processChild(cval, typeName);
              if (cid3) childIds.push(cid3);
            }
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

  function processChild(childVal, parentType) {
    if (childVal === null || childVal === undefined) return null;
    if (typeof childVal === 'string') {
      // Could be a reference name or a literal string
      if (nameToId[childVal]) return childVal;
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
      return childVal.__ref;
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
    var name = s.name || genId('auto');

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

  if (!rootName || !elements[rootName]) {
    // Use first element as root
    var keys = Object.keys(elements);
    if (keys.length > 0) rootName = keys[0];
  }

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
  COMP_SCHEMA: COMP_SCHEMA
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports;
} else {
  root.DaubOpenUI = exports;
}

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
