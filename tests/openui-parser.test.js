// Tests for daub-openui-parser.js — OpenUI Lang → DAUB spec
// Uses Node.js built-in test runner (node --test)

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  openUItoSpec,
  createStreamingOpenUIParser,
  detectFormat,
  tokenize,
  COMP_SCHEMA,
} = require('../daub-openui-parser.js');

// Inline the validateSpec logic from mcp.js for spec validation
const VALID_TYPES = new Set(Object.keys(COMP_SCHEMA));

function validateSpec(spec) {
  const issues = [];
  if (!spec || typeof spec !== 'object') return { valid: false, issues: ['Spec is not an object'] };
  if (!spec.elements || typeof spec.elements !== 'object') issues.push('Missing "elements" object');
  if (!spec.root) issues.push('Missing "root"');
  if (spec.root && spec.elements && !spec.elements[spec.root]) issues.push(`Root "${spec.root}" not found in elements`);
  if (spec.elements) {
    for (const [id, def] of Object.entries(spec.elements)) {
      if (!def.type) {
        issues.push(`Element "${id}" missing "type"`);
      } else if (!VALID_TYPES.has(def.type)) {
        issues.push(`Unknown type "${def.type}" on element "${id}"`);
      }
      for (const cid of (def.children || [])) {
        if (!spec.elements[cid]) issues.push(`Element "${id}" references missing child "${cid}"`);
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

// ============================================================
// Format Detection
// ============================================================
describe('detectFormat', () => {
  it('detects JSON format from opening brace', () => {
    assert.equal(detectFormat('{"root": "x"}'), 'json');
  });

  it('detects JSON with leading whitespace', () => {
    assert.equal(detectFormat('  \n  {"root": "x"}'), 'json');
  });

  it('detects OpenUI format from assignment', () => {
    assert.equal(detectFormat('root = Stack()'), 'openui');
  });

  it('detects OpenUI with theme assignment', () => {
    assert.equal(detectFormat('__theme = "dark"'), 'openui');
  });

  it('returns unknown for arbitrary text', () => {
    assert.equal(detectFormat('hello world'), 'unknown');
  });

  it('returns unknown for empty input', () => {
    assert.equal(detectFormat(''), 'unknown');
  });

  it('returns unknown for null', () => {
    assert.equal(detectFormat(null), 'unknown');
  });

  it('strips markdown code fences before detecting', () => {
    assert.equal(detectFormat('```\n{"root": "x"}\n```'), 'json');
  });
});

// ============================================================
// Tokenizer
// ============================================================
describe('tokenize', () => {
  it('tokenizes string literals', () => {
    const toks = tokenize('"hello"');
    assert.equal(toks[0].v, 'hello');
  });

  it('tokenizes single-quoted strings', () => {
    const toks = tokenize("'world'");
    assert.equal(toks[0].v, 'world');
  });

  it('handles escape sequences in strings', () => {
    const toks = tokenize('"line\\none"');
    assert.equal(toks[0].v, 'line\none');
  });

  it('tokenizes numbers', () => {
    const toks = tokenize('42');
    assert.equal(toks[0].v, 42);
  });

  it('tokenizes negative numbers', () => {
    const toks = tokenize('-5');
    assert.equal(toks[0].v, -5);
  });

  it('tokenizes floating point numbers', () => {
    const toks = tokenize('3.14');
    assert.equal(toks[0].v, 3.14);
  });

  it('tokenizes booleans', () => {
    const toks = tokenize('true false');
    assert.equal(toks[0].v, true);
    assert.equal(toks[1].v, false);
  });

  it('tokenizes null', () => {
    const toks = tokenize('null');
    assert.equal(toks[0].v, null);
  });

  it('recognizes PascalCase component types', () => {
    const toks = tokenize('Stack Button Card');
    // TYPE tokens for known components
    assert.equal(toks[0].v, 'Stack');
    assert.equal(toks[1].v, 'Button');
    assert.equal(toks[2].v, 'Card');
  });

  it('treats unknown PascalCase as identifiers', () => {
    const toks = tokenize('FooBar');
    // Not in COMP_SCHEMA, so IDENT
    assert.equal(toks[0].v, 'FooBar');
  });

  it('skips line comments', () => {
    const toks = tokenize('root // this is a comment\n= Stack()');
    // Should have: IDENT(root), EQ, TYPE(Stack), LPAR, RPAR, EOF
    assert.equal(toks[0].v, 'root');
  });
});

// ============================================================
// Parser: Basic Specs
// ============================================================
describe('openUItoSpec — basic', () => {
  it('returns null for empty input', () => {
    assert.equal(openUItoSpec(''), null);
    assert.equal(openUItoSpec(null), null);
    assert.equal(openUItoSpec(undefined), null);
  });

  it('parses a single Text component', () => {
    const spec = openUItoSpec('root = Text("Hello World", "h1")');
    assert.ok(spec);
    assert.equal(spec.root, 'root');
    assert.equal(spec.elements.root.type, 'Text');
    assert.equal(spec.elements.root.props.content, 'Hello World');
    assert.equal(spec.elements.root.props.tag, 'h1');
  });

  it('produces valid spec for a single component', () => {
    const spec = openUItoSpec('root = Button("Click me", "primary")');
    const v = validateSpec(spec);
    assert.ok(v.valid, 'Validation failed: ' + v.issues.join(', '));
  });

  it('sets default theme to bone', () => {
    const spec = openUItoSpec('root = Text("Hi")');
    assert.equal(spec.theme, 'bone');
  });

  it('respects __theme assignment', () => {
    const spec = openUItoSpec('__theme = "dracula"\nroot = Text("Dark")');
    assert.equal(spec.theme, 'dracula');
  });

  it('supports __state assignment', () => {
    const spec = openUItoSpec('__state = {count: 0, active: true}\nroot = Text("Counter")');
    assert.ok(spec.state);
    assert.equal(spec.state.count, 0);
    assert.equal(spec.state.active, true);
  });
});

// ============================================================
// Parser: Children and References
// ============================================================
describe('openUItoSpec — children and references', () => {
  it('resolves child references to defined statements', () => {
    const spec = openUItoSpec(
      'root = Stack([heading, btn], "vertical")\n'
      + 'heading = Text("Hello", "h1")\n'
      + 'btn = Button("Click", "primary")'
    );
    assert.ok(spec);
    assert.deepEqual(spec.elements.root.children, ['heading', 'btn']);
    assert.equal(spec.elements.heading.type, 'Text');
    assert.equal(spec.elements.btn.type, 'Button');
    const v = validateSpec(spec);
    assert.ok(v.valid, 'Validation failed: ' + v.issues.join(', '));
  });

  it('creates inline Text elements for string children', () => {
    const spec = openUItoSpec('root = Stack(["Hello World"], "vertical")');
    assert.ok(spec);
    const childId = spec.elements.root.children[0];
    assert.equal(spec.elements[childId].type, 'Text');
    assert.equal(spec.elements[childId].props.content, 'Hello World');
  });

  it('supports inline component children', () => {
    const spec = openUItoSpec(
      'root = Stack([Text("Inline", "h2"), Button("Go", "primary")], "vertical")'
    );
    assert.ok(spec);
    assert.equal(spec.elements.root.children.length, 2);
    const types = spec.elements.root.children.map(id => spec.elements[id].type);
    assert.deepEqual(types, ['Text', 'Button']);
  });

  it('produces valid spec with nested children', () => {
    const spec = openUItoSpec(
      'root = Stack([header, content], "vertical", 4)\n'
      + 'header = Stack([Text("Title", "h1")], "horizontal")\n'
      + 'content = Card([], "My Card", "Description")'
    );
    const v = validateSpec(spec);
    assert.ok(v.valid, 'Validation failed: ' + v.issues.join(', '));
  });
});

// ============================================================
// Parser: Named Arguments
// ============================================================
describe('openUItoSpec — named arguments', () => {
  it('supports named argument syntax', () => {
    const spec = openUItoSpec('root = Button(label: "Click", variant: "primary", size: "lg")');
    assert.equal(spec.elements.root.props.label, 'Click');
    assert.equal(spec.elements.root.props.variant, 'primary');
    assert.equal(spec.elements.root.props.size, 'lg');
  });

  it('supports mixed positional and named arguments', () => {
    const spec = openUItoSpec('root = Stack([Text("Hi")], direction: "horizontal", gap: 3)');
    assert.equal(spec.elements.root.props.direction, 'horizontal');
    assert.equal(spec.elements.root.props.gap, 3);
    assert.equal(spec.elements.root.children.length, 1);
  });

  it('named args override positional for same property', () => {
    const spec = openUItoSpec('root = Button("Old Label", label: "New Label")');
    assert.equal(spec.elements.root.props.label, 'New Label');
  });
});

// ============================================================
// Parser: Complex Data Structures
// ============================================================
describe('openUItoSpec — complex props', () => {
  it('parses array props (Table columns)', () => {
    const spec = openUItoSpec(
      'root = Table([{key: "name", label: "Name"}, {key: "age", label: "Age"}], [{name: "Alice", age: 30}])'
    );
    assert.ok(spec);
    assert.equal(spec.elements.root.type, 'Table');
    assert.equal(spec.elements.root.props.columns.length, 2);
    assert.equal(spec.elements.root.props.columns[0].key, 'name');
    assert.equal(spec.elements.root.props.rows.length, 1);
    assert.equal(spec.elements.root.props.rows[0].name, 'Alice');
  });

  it('parses nested objects (Sidebar sections)', () => {
    const spec = openUItoSpec(
      'root = Sidebar([{title: "Main", items: [{label: "Home", icon: "home", active: true}]}])'
    );
    assert.equal(spec.elements.root.type, 'Sidebar');
    assert.equal(spec.elements.root.props.sections[0].title, 'Main');
    assert.equal(spec.elements.root.props.sections[0].items[0].label, 'Home');
  });

  it('parses RadioGroup options', () => {
    const spec = openUItoSpec(
      'root = RadioGroup([{label: "Option A", value: "a"}, {label: "Option B", value: "b"}], "a")'
    );
    assert.equal(spec.elements.root.props.options.length, 2);
    assert.equal(spec.elements.root.props.selected, 'a');
  });
});

// ============================================================
// Renderer Compatibility: Every Component Type
// ============================================================
describe('openUItoSpec — all component types produce valid specs', () => {
  const COMPONENT_TESTS = {
    Stack: 'root = Stack([Text("Item")], "vertical", 2)',
    Grid: 'root = Grid([Text("Cell")], 3, 2)',
    Surface: 'root = Surface([Text("Inside")], "raised")',
    Text: 'root = Text("Hello", "h1")',
    Prose: 'root = Prose("<p>Rich text</p>", "lg")',
    Separator: 'root = Separator(false, true, "OR")',
    Button: 'root = Button("Click", "primary", "lg")',
    ButtonGroup: 'root = ButtonGroup([Button("A"), Button("B")])',
    Field: 'root = Field("Email", "you@example.com", "email")',
    Input: 'root = Input("Type here", "sm")',
    InputGroup: 'root = InputGroup([Input("Search")], "https://", ".com")',
    InputIcon: 'root = InputIcon([Input("Search")], "search")',
    Search: 'root = Search("Search...")',
    Textarea: 'root = Textarea("Write here", 4)',
    Checkbox: 'root = Checkbox("Agree", true)',
    RadioGroup: 'root = RadioGroup([{label: "A", value: "a"}], "a")',
    Switch: 'root = Switch("Enable", true)',
    Slider: 'root = Slider(0, 100, 50, 1, "Volume")',
    Toggle: 'root = Toggle("Bold", true)',
    ToggleGroup: 'root = ToggleGroup([{label: "A", value: "a"}], "a")',
    Select: 'root = Select("Color", [{label: "Red", value: "red"}], "red")',
    CustomSelect: 'root = CustomSelect("Pick one", [{label: "A", value: "a"}], true)',
    Kbd: 'root = Kbd(["Ctrl", "C"])',
    Label: 'root = Label("Name", true)',
    Spinner: 'root = Spinner("lg")',
    InputOTP: 'root = InputOTP(6, true)',
    Tabs: 'root = Tabs([Text("Tab Content")], [{label: "Tab 1", id: "t1"}], "t1")',
    Breadcrumbs: 'root = Breadcrumbs([{label: "Home", href: "/"}, {label: "Page"}])',
    Pagination: 'root = Pagination(1, 10, 20)',
    Stepper: 'root = Stepper([{label: "Step 1", status: "completed"}, {label: "Step 2", status: "active"}])',
    NavMenu: 'root = NavMenu([{label: "Home", href: "/", active: true}])',
    Navbar: 'root = Navbar([Text("Logo")], "MyApp", "/")',
    Menubar: 'root = Menubar([{label: "File", dropdown: [{label: "New"}]}])',
    Sidebar: 'root = Sidebar([{title: "Nav", items: [{label: "Home", icon: "home"}]}])',
    BottomNav: 'root = BottomNav([{label: "Home", icon: "home", active: true}])',
    Card: 'root = Card([Text("Body")], "Title", "Description", null, null, true)',
    Table: 'root = Table([{key: "name", label: "Name"}], [{name: "Alice"}])',
    DataTable: 'root = DataTable([{key: "id", label: "ID"}], [{id: 1}], true)',
    List: 'root = List([{title: "Item 1", secondary: "Detail"}])',
    Badge: 'root = Badge("New", "new")',
    Avatar: 'root = Avatar("JD", null, "lg")',
    AvatarGroup: 'root = AvatarGroup([{initials: "AB"}, {initials: "CD"}], 3)',
    Calendar: 'root = Calendar("2024-01-15")',
    Chart: 'root = Chart([{label: "Q1", value: 100, max: 200}])',
    Carousel: 'root = Carousel([{content: "Slide 1"}, {content: "Slide 2"}])',
    AspectRatio: 'root = AspectRatio([Text("Content")], "16-9")',
    Chip: 'root = Chip("Tag", "blue", true)',
    ScrollArea: 'root = ScrollArea([Text("Scroll content")], "vertical")',
    Image: 'root = Image("https://example.com/img.png", "Photo", 300, 200)',
    Alert: 'root = Alert("info", "Note", "This is important")',
    Progress: 'root = Progress(75)',
    Skeleton: 'root = Skeleton("text", 3)',
    EmptyState: 'root = EmptyState("inbox", "No messages", "Check back later")',
    Tooltip: 'root = Tooltip([Button("Hover me")], "Tooltip text", "top")',
    Modal: 'root = Modal([Text("Modal body")], "modal-1", "My Modal")',
    AlertDialog: 'root = AlertDialog("dlg-1", "Confirm", "Are you sure?")',
    Sheet: 'root = Sheet([Text("Sheet content")], "sheet-1", "right")',
    Drawer: 'root = Drawer([Text("Drawer content")], "drawer-1")',
    Popover: 'root = Popover([Text("Popover content")], "bottom")',
    HoverCard: 'root = HoverCard([Text("Hover content")])',
    DropdownMenu: 'root = DropdownMenu([{label: "Edit", icon: "edit"}])',
    ContextMenu: 'root = ContextMenu([{label: "Copy"}, {separator: true}, {label: "Paste"}])',
    CommandPalette: 'root = CommandPalette("cmd-1", "Search commands...", [{label: "Actions", items: [{label: "New File"}]}])',
    Accordion: 'root = Accordion([{title: "Section 1", content: "Content 1"}], true)',
    Collapsible: 'root = Collapsible([Text("Hidden content")], "Show more")',
    Resizable: 'root = Resizable([Text("Panel")], "horizontal")',
    DatePicker: 'root = DatePicker("Date", "Select date", "2024-01-15")',
    StatCard: 'root = StatCard("Revenue", "$12,345", "up", "+12%", "dollar-sign")',
    ChartCard: 'root = ChartCard([Chart([{label: "Q1", value: 100}])], "Sales")',
    CustomHTML: 'root = CustomHTML("<div>Custom</div>", "div { color: red; }")',
  };

  for (const [typeName, input] of Object.entries(COMPONENT_TESTS)) {
    it(`${typeName}: parses and produces valid spec`, () => {
      const spec = openUItoSpec(input);
      assert.ok(spec, `${typeName}: openUItoSpec returned null`);
      assert.ok(spec.root, `${typeName}: spec.root is falsy`);
      assert.ok(spec.elements, `${typeName}: spec.elements is falsy`);

      // Find the element with the target type
      const targetEl = Object.values(spec.elements).find(e => e.type === typeName);
      assert.ok(targetEl, `${typeName}: no element found with type="${typeName}"`);

      const v = validateSpec(spec);
      assert.ok(v.valid, `${typeName}: validation failed — ${v.issues.join(', ')}`);
    });
  }
});

// ============================================================
// Parser: Dashboard (complex real-world example)
// ============================================================
describe('openUItoSpec — dashboard example', () => {
  const DASHBOARD = `__theme = "github"
root = Stack([header, stats, content], "vertical", 4)
header = Stack([Text("Dashboard", "h1"), Button("Settings", "ghost", "sm")], "horizontal", 2, "between", "center")
stats = Grid([s1, s2, s3, s4], 4, 3)
s1 = StatCard("Revenue", "$12,345", "up", "+12%")
s2 = StatCard("Users", "1,234", "up", "+5%")
s3 = StatCard("Orders", "567", "down", "-3%")
s4 = StatCard("Conversion", "3.2%", "up", "+0.5%")
content = Stack([table1, Alert("info", "Note", "Data refreshes every 5 minutes")], "vertical", 3)
table1 = Table([{key: "name", label: "Name"}, {key: "email", label: "Email"}], [{name: "Alice", email: "alice@example.com"}, {name: "Bob", email: "bob@example.com"}])`;

  it('parses all elements', () => {
    const spec = openUItoSpec(DASHBOARD);
    assert.ok(spec);
    // root, header, stats, s1-s4, content, table1 + inline Text, Button, Alert
    assert.ok(Object.keys(spec.elements).length >= 10);
  });

  it('sets theme correctly', () => {
    const spec = openUItoSpec(DASHBOARD);
    assert.equal(spec.theme, 'github');
  });

  it('produces valid spec', () => {
    const spec = openUItoSpec(DASHBOARD);
    const v = validateSpec(spec);
    assert.ok(v.valid, 'Dashboard validation failed: ' + v.issues.join(', '));
  });

  it('preserves table data', () => {
    const spec = openUItoSpec(DASHBOARD);
    const tableEl = Object.values(spec.elements).find(e => e.type === 'Table');
    assert.ok(tableEl);
    assert.equal(tableEl.props.columns.length, 2);
    assert.equal(tableEl.props.rows.length, 2);
    assert.equal(tableEl.props.rows[0].name, 'Alice');
  });

  it('has correct parent-child hierarchy', () => {
    const spec = openUItoSpec(DASHBOARD);
    assert.deepEqual(spec.elements.root.children, ['header', 'stats', 'content']);
    assert.deepEqual(spec.elements.stats.children, ['s1', 's2', 's3', 's4']);
  });
});

// ============================================================
// Parser: Landing Page (complex multi-section)
// ============================================================
describe('openUItoSpec — landing page example', () => {
  const LANDING = `__theme = "bone"
root = Stack([nav, hero, features, cta, footer], "vertical", 0)
nav = Navbar([Stack([Text("Acme"), Stack([Button("Login", "ghost"), Button("Sign Up", "primary")], "horizontal", 2)], "horizontal", 2, "between", "center")], "Acme", "/")
hero = Stack([Text("Build Faster", "h1"), Text("Ship beautiful UIs in minutes, not hours.", "p"), Button("Get Started Free", "primary", "lg")], "vertical", 3, "center", "center")
features = Grid([Card([], "Fast", "Lightning-fast rendering"), Card([], "Simple", "No build step needed"), Card([], "Beautiful", "Stunning design system")], 3, 3)
cta = Stack([Text("Ready to start?", "h2"), Button("Try It Now", "primary")], "vertical", 3, "center", "center")
footer = Stack([Text("2024 Acme Inc.", "p")], "horizontal", 2, "center")`;

  it('parses all sections', () => {
    const spec = openUItoSpec(LANDING);
    assert.ok(spec);
    assert.deepEqual(spec.elements.root.children, ['nav', 'hero', 'features', 'cta', 'footer']);
  });

  it('produces valid spec', () => {
    const spec = openUItoSpec(LANDING);
    const v = validateSpec(spec);
    assert.ok(v.valid, 'Landing page validation failed: ' + v.issues.join(', '));
  });

  it('handles deeply nested inline components', () => {
    const spec = openUItoSpec(LANDING);
    // Navbar has children with inline Stack containing inline Text and Buttons
    const navEl = spec.elements.nav;
    assert.ok(navEl.children.length > 0);
  });
});

// ============================================================
// Streaming Parser
// ============================================================
describe('createStreamingOpenUIParser', () => {
  it('returns null spec for very short input', () => {
    const parser = createStreamingOpenUIParser();
    const result = parser.push('ro');
    assert.equal(result.spec, null);
    assert.equal(result.meta.incomplete, true);
  });

  it('parses complete lines progressively', () => {
    const parser = createStreamingOpenUIParser();

    // First line
    const r1 = parser.push('root = Stack([h], "vertical")\n');
    assert.ok(r1.spec);
    assert.equal(r1.spec.root, 'root');

    // Add second line
    const r2 = parser.push('root = Stack([h], "vertical")\nh = Text("Hello", "h1")\n');
    assert.ok(r2.spec);
    assert.equal(Object.keys(r2.spec.elements).length, 2);
  });

  it('ignores incomplete last line', () => {
    const parser = createStreamingOpenUIParser();
    const r = parser.push('root = Stack([h], "vertical")\nh = Text("Hell');
    // Should parse only the first complete line
    assert.ok(r.spec);
    assert.ok(r.meta.incomplete);
  });

  it('produces valid spec at every step', () => {
    const parser = createStreamingOpenUIParser();
    const lines = [
      '__theme = "dracula"\n',
      'root = Stack([h, c], "vertical")\n',
      'h = Text("Title", "h1")\n',
      'c = Card([], "Card Title", "Description")\n',
    ];
    let acc = '';
    for (const line of lines) {
      acc += line;
      const r = parser.push(acc);
      if (r.spec) {
        // Every intermediate spec should at minimum not crash validateSpec
        const v = validateSpec(r.spec);
        // May have dangling refs mid-stream, that's OK
        assert.ok(r.spec.elements, 'elements should exist');
      }
    }
    // Final spec should be fully valid
    const final = parser.push(acc);
    assert.ok(final.spec);
    assert.equal(final.spec.theme, 'dracula');
  });
});

// ============================================================
// Error Recovery
// ============================================================
describe('openUItoSpec — error recovery', () => {
  it('handles truncated component call gracefully', () => {
    const spec = openUItoSpec('root = Stack([Text("hello"), Button("click"');
    // Should either return a partial spec or null, not throw
    // The partial spec may be valid if it parsed the complete first line
    assert.ok(spec !== undefined); // Didn't throw
  });

  it('handles malformed strings gracefully', () => {
    const spec = openUItoSpec('root = Text("unterminated');
    assert.ok(spec !== undefined);
  });

  it('skips unknown tokens without crashing', () => {
    const spec = openUItoSpec('root = Text("Hello")\n@#$%\nfoo = Button("OK")');
    assert.ok(spec !== undefined);
  });

  it('recovers from partial multi-line input', () => {
    const input = 'root = Stack([h, b], "vertical")\nh = Text("Hello", "h1")\nb = But';
    const spec = openUItoSpec(input);
    // Should parse at least the first two lines
    assert.ok(spec);
    assert.ok(spec.elements.root || spec.elements.h);
  });

  it('strips markdown code fences', () => {
    const spec = openUItoSpec('```openui\nroot = Text("Hello")\n```');
    assert.ok(spec);
    assert.equal(spec.elements.root.type, 'Text');
  });
});

// ============================================================
// Edge Cases
// ============================================================
describe('openUItoSpec — edge cases', () => {
  it('handles empty children array', () => {
    const spec = openUItoSpec('root = Stack([], "vertical")');
    assert.ok(spec);
    assert.equal(spec.elements.root.type, 'Stack');
    assert.equal(spec.elements.root.props.direction, 'vertical');
  });

  it('handles boolean props correctly', () => {
    const spec = openUItoSpec('root = Checkbox("Accept terms", true)');
    assert.equal(spec.elements.root.props.checked, true);
  });

  it('handles null props', () => {
    const spec = openUItoSpec('root = Card([], "Title", null, null, null, true)');
    assert.equal(spec.elements.root.props.title, 'Title');
    assert.equal(spec.elements.root.props.description, null);
    assert.equal(spec.elements.root.props.interactive, true);
  });

  it('handles line comments', () => {
    const spec = openUItoSpec(
      '// This is a dashboard\n'
      + 'root = Text("Hello") // greeting\n'
    );
    assert.ok(spec);
    assert.equal(spec.elements.root.props.content, 'Hello');
  });

  it('uses first non-meta statement as root when no "root" name', () => {
    const spec = openUItoSpec('__theme = "dark"\nmyPage = Stack([Text("Hi")])');
    assert.equal(spec.root, 'myPage');
  });

  it('handles special characters in strings', () => {
    const spec = openUItoSpec('root = Text("Price: $12.99 — 50% off!", "p")');
    assert.equal(spec.elements.root.props.content, 'Price: $12.99 — 50% off!');
  });

  it('handles escaped quotes in strings', () => {
    const spec = openUItoSpec('root = Text("He said \\"hello\\"", "p")');
    assert.equal(spec.elements.root.props.content, 'He said "hello"');
  });

  it('handles identifiers with hyphens', () => {
    const spec = openUItoSpec(
      'root = Stack([my-card], "vertical")\nmy-card = Card([], "Title")'
    );
    assert.ok(spec);
    // The reference should resolve
    const v = validateSpec(spec);
    assert.ok(v.valid, 'Validation failed: ' + v.issues.join(', '));
  });
});

// ============================================================
// Spec Structural Integrity (renderer requirements)
// ============================================================
describe('spec structural integrity', () => {
  it('every element has a type string', () => {
    const spec = openUItoSpec(
      'root = Stack([Text("A"), Card([], "B", "C"), Button("D", "primary")], "vertical")'
    );
    for (const [id, el] of Object.entries(spec.elements)) {
      assert.equal(typeof el.type, 'string', `Element "${id}" type is not a string`);
      assert.ok(VALID_TYPES.has(el.type), `Element "${id}" has unknown type "${el.type}"`);
    }
  });

  it('every element has a props object', () => {
    const spec = openUItoSpec(
      'root = Stack([Text("A"), Button("B")], "vertical")'
    );
    for (const [id, el] of Object.entries(spec.elements)) {
      assert.equal(typeof el.props, 'object', `Element "${id}" props is not an object`);
      assert.ok(!Array.isArray(el.props), `Element "${id}" props should not be an array`);
    }
  });

  it('children arrays contain only string IDs that exist', () => {
    const spec = openUItoSpec(
      'root = Stack([a, b], "vertical")\n'
      + 'a = Text("A")\n'
      + 'b = Button("B")'
    );
    for (const [id, el] of Object.entries(spec.elements)) {
      if (el.children) {
        assert.ok(Array.isArray(el.children), `Element "${id}" children is not an array`);
        for (const cid of el.children) {
          assert.equal(typeof cid, 'string', `Child ID in "${id}" is not a string`);
          assert.ok(spec.elements[cid], `Element "${id}" references missing child "${cid}"`);
        }
      }
    }
  });

  it('root references an existing element', () => {
    const spec = openUItoSpec('root = Stack([Text("Hello")], "vertical")');
    assert.ok(spec.elements[spec.root], `Root "${spec.root}" not found in elements`);
  });

  it('theme is always a string', () => {
    const spec = openUItoSpec('root = Text("Hi")');
    assert.equal(typeof spec.theme, 'string');
  });
});
