// Cloudflare Pages Function — Remote DAUB MCP Server (Streamable HTTP)
// POST /api/mcp  — handles MCP JSON-RPC protocol

// ---- Component Catalog (inlined from mcp/lib/prompt.js) ----

const COMP_PROPS = {
  Stack: 'direction: "vertical"|"horizontal", gap: 0-6 (default 2=8px), justify: "center"|"end"|"between"|"evenly", align: "center"|"end"|"start"|"stretch", wrap: bool, container: "wide"|"narrow"|true',
  Grid: 'columns: 2-6, gap: 0-6 (default 2=8px), align: "center"|"end", container: "wide"|"narrow"|true',
  Surface: 'variant: "raised"|"inset"|"pressed"',
  Text: 'tag: "h1"|"h2"|"h3"|"h4"|"p"|"span", content: string, class: string',
  Prose: 'content: string (HTML), size: "sm"|"lg"|"xl"|"2xl"',
  Separator: 'vertical: bool, dashed: bool, label: string',
  Button: 'label: string, variant: "primary"|"secondary"|"ghost"|"icon-danger"|"icon-success"|"icon-accent", size: "sm"|"lg"|"icon", loading: bool, icon: string, trigger: "overlayId"',
  ButtonGroup: '(children are Buttons)',
  Field: 'label: string, placeholder: string, type: "text"|"email"|"password"|"number", error: bool, helper: string',
  Input: 'placeholder: string, size: "sm"|"lg", error: bool, type: "text"|"email"|"password"|"number"|"tel"|"url"|"search"|"date"|"time"',
  InputGroup: 'addonBefore: string, addonAfter: string (child is Input)',
  InputIcon: 'icon: string, right: bool (child is Input)',
  Search: 'placeholder: string',
  Textarea: 'placeholder: string, rows: number, error: bool',
  Checkbox: 'label: string, checked: bool',
  RadioGroup: 'options: [{label, value}], selected: string',
  Switch: 'label: string, checked: bool',
  Slider: 'min: number, max: number, value: number, step: number, label: string',
  Toggle: 'label: string, pressed: bool, size: "sm"',
  ToggleGroup: 'options: [{label, value}], selected: string',
  Select: 'label: string, options: [{label, value}], selected: string',
  CustomSelect: 'placeholder: string, options: [{label, value, selected, disabled}], searchable: bool',
  Kbd: 'keys: [string]',
  Label: 'text: string, required: bool, optional: bool',
  Spinner: 'size: "sm"|"lg"|"xl"',
  InputOTP: 'length: number, separator: bool',
  Tabs: 'tabs: [{label, id}], active: string, children: [childIds]',
  Breadcrumbs: 'items: [{label, href}]',
  Pagination: 'current: number, total: number, perPage: number',
  Stepper: 'steps: [{label, status: "completed"|"active"|"pending"}], vertical: bool',
  NavMenu: 'items: [{label, href, active}]',
  Navbar: 'brand: string, brandHref: string',
  Menubar: 'items: [{label, dropdown: [{label, href}]}]',
  Sidebar: 'sections: [{title, items: [{label, icon, active, href}]}], collapsed: bool',
  BottomNav: 'items: [{label, icon, active, badge}]',
  Card: 'title: string, description: string, media: string, footer: [childIds], interactive: bool, clip: bool',
  Table: 'columns: [{key, label, numeric}], rows: [{}], sortable: bool',
  DataTable: 'columns: [{key, label}], rows: [{}], selectable: bool',
  List: 'items: [{title, secondary, icon}]',
  Badge: 'text: string, variant: "new"|"updated"|"warning"|"error"',
  Avatar: 'initials: string, src: string, size: "sm"|"md"|"lg"',
  AvatarGroup: 'avatars: [{initials, src}], max: number',
  Calendar: 'selected: "YYYY-MM-DD", today: "YYYY-MM-DD"',
  Chart: 'bars: [{label, value, max}]',
  Carousel: 'slides: [{content}]',
  AspectRatio: 'ratio: "16-9"|"4-3"|"1-1"|"21-9"',
  Chip: 'label: string, color: "red"|"green"|"blue"|"purple"|"amber"|"pink", active: bool, closable: bool',
  ScrollArea: 'direction: "horizontal"|"vertical"',
  Image: 'src: string, alt: string, width: number, height: number',
  Alert: 'type: "info"|"warning"|"error"|"success", title: string, message: string',
  Progress: 'value: number, indeterminate: bool',
  Skeleton: 'variant: "text"|"heading"|"avatar"|"btn", lines: number',
  EmptyState: 'icon: string, title: string, message: string',
  Tooltip: 'text: string, position: "top"|"bottom"|"left"|"right"',
  Modal: 'id: string, title: string, footer: [childIds]',
  AlertDialog: 'id: string, title: string, description: string, footer: [childIds]',
  Sheet: 'id: string, position: "right"|"left"|"top"|"bottom"',
  Drawer: 'id: string',
  Popover: 'position: "top"|"bottom"|"left"|"right"',
  HoverCard: '',
  DropdownMenu: 'items: [{label, icon, separator, groupLabel, active}]',
  ContextMenu: 'items: [{label, icon, separator}]',
  CommandPalette: 'id: string, placeholder: string, groups: [{label, items: [{label, icon, shortcut}]}]',
  Accordion: 'items: [{title, content, children: [childIds]}], multi: bool',
  Collapsible: 'label: string',
  Resizable: 'direction: "horizontal"|"vertical"',
  DatePicker: 'label: string, placeholder: string, selected: string',
  StatCard: 'label: string, value: string, trend: "up"|"down", trendValue: string, icon: string, horizontal: bool',
  ChartCard: 'title: string',
  CustomHTML: 'html: string, css: string, js: string, children: [childIds]',
};

const COMP_CATEGORIES = [
  ['Layout & Structure', ['Stack', 'Grid', 'Surface', 'Text', 'Prose', 'Separator']],
  ['Controls', ['Button', 'ButtonGroup', 'Field', 'Input', 'InputGroup', 'InputIcon', 'Search', 'Textarea', 'Checkbox', 'RadioGroup', 'Switch', 'Slider', 'Toggle', 'ToggleGroup', 'Select', 'CustomSelect', 'Kbd', 'Label', 'Spinner', 'InputOTP']],
  ['Navigation', ['Tabs', 'Breadcrumbs', 'Pagination', 'Stepper', 'NavMenu', 'Navbar', 'Menubar', 'Sidebar', 'BottomNav']],
  ['Data Display', ['Card', 'Table', 'DataTable', 'List', 'Badge', 'Avatar', 'AvatarGroup', 'Calendar', 'Chart', 'Carousel', 'AspectRatio', 'Chip', 'ScrollArea', 'Image']],
  ['Feedback', ['Alert', 'Progress', 'Skeleton', 'EmptyState', 'Tooltip']],
  ['Overlays', ['Modal', 'AlertDialog', 'Sheet', 'Drawer', 'Popover', 'HoverCard', 'DropdownMenu', 'ContextMenu', 'CommandPalette']],
  ['Layout Utilities', ['Accordion', 'Collapsible', 'Resizable', 'DatePicker']],
  ['Dashboard', ['StatCard', 'ChartCard']],
  ['Custom', ['CustomHTML']],
];

const VALID_TYPES = COMP_CATEGORIES.flatMap(([, types]) => types);
const validTypeSet = new Set(VALID_TYPES);

// ---- Validation (inlined from mcp/lib/validate.js) ----

function validateSpec(spec) {
  const issues = [];
  if (!spec || typeof spec !== 'object') return { valid: false, issues: ['Spec is not an object'], element_count: 0, components_used: [] };
  if (!spec.elements || typeof spec.elements !== 'object') issues.push('Missing "elements" object');
  if (!spec.root) issues.push('Missing "root"');
  if (spec.root && spec.elements && !spec.elements[spec.root]) issues.push(`Root "${spec.root}" not found in elements`);
  const componentsUsed = new Set();
  if (spec.elements) {
    for (const [id, def] of Object.entries(spec.elements)) {
      if (!def.type) {
        issues.push(`Element "${id}" missing "type"`);
      } else {
        componentsUsed.add(def.type);
        if (!validTypeSet.has(def.type)) issues.push(`Unknown type "${def.type}" on element "${id}"`);
      }
      for (const cid of (def.children || [])) {
        if (!spec.elements[cid]) issues.push(`Element "${id}" references missing child "${cid}"`);
      }
    }
  }
  return { valid: issues.length === 0, issues, element_count: spec.elements ? Object.keys(spec.elements).length : 0, components_used: [...componentsUsed] };
}

function autoFixSpec(spec) {
  if (!spec || !spec.elements) return spec;
  for (const def of Object.values(spec.elements)) {
    if (def.children) def.children = def.children.filter(cid => !!spec.elements[cid]);
  }
  if (!spec.root || !spec.elements[spec.root]) {
    const ids = Object.keys(spec.elements);
    if (ids.length) spec.root = ids[0];
  }
  return spec;
}

// ---- System Prompt Builder ----

function buildSystemPrompt() {
  let prompt = 'You are a UI generator that outputs json-render flat specs using DAUB components.\n\n'
    + 'BE EXHAUSTIVE AND DETAILED. Generate complete, production-realistic UIs:\n'
    + '- Include ALL elements mentioned in the prompt\n'
    + '- Add realistic sample data: full names, plausible numbers, real-looking dates\n'
    + '- Populate tables with 5-8 rows, lists with 4-6 items, sidebars with full navigation\n'
    + '- Include secondary UI elements: badges, status indicators, tooltips, helper text, icons\n'
    + '- Build complete page structures: header/navbar, main content, sidebar if relevant\n'
    + '- Use nested layouts for visual hierarchy\n'
    + '- Aim for 20-50 elements per spec\n\n'
    + 'CRITICAL: Return ONLY a single valid JSON object. No markdown fences, no explanation.\n\n'
    + 'OUTPUT FORMAT:\n'
    + '{"theme":"<name>","root":"<id>","elements":{"<id>":{"type":"<Type>","props":{...},"children":["<child-id>"]}}}\n\n'
    + 'RULES:\n'
    + '- Every element has a unique string ID\n'
    + '- "children" is an array of element ID strings (flat, NOT nested)\n'
    + '- The "root" must reference an existing element ID\n'
    + '- Output MUST be valid JSON\n\n'
    + 'VALID COMPONENT TYPES: ' + VALID_TYPES.join(', ') + '\n\n'
    + 'COMPONENT PROPS:\n\n';

  for (const [cat, types] of COMP_CATEGORIES) {
    prompt += cat + ':\n';
    for (const t of types) {
      if (COMP_PROPS[t] !== undefined) prompt += '- ' + t + ': { ' + (COMP_PROPS[t] || '') + ' }\n';
    }
    prompt += '\n';
  }

  prompt += 'GUIDELINES:\n'
    + '- Use Stack as root with direction:"vertical" for page layouts\n'
    + '- Use Grid for equal-width arrangements\n'
    + '- Stack direction:"horizontal" justify:"between" for headers/toolbars\n'
    + '- Gap tokens: 0=0px, 1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px\n'
    + '- Wrap related content in Card components\n'
    + '- Use StatCard for KPI metrics\n'
    + '- Use trigger:"overlay-id" on Button to open overlays\n\n'
    + 'THEMES:\n'
    + '- Light: light, bone, material-light, github, nord-light, solarized-light, catppuccin, gruvbox-light, paper, grunge-light\n'
    + '- Dark: dark, material-dark, github-dark, nord, solarized-dark, catppuccin-dark, gruvbox-dark, dracula, grunge-dark, synthwave, tokyo-night\n';

  return prompt;
}

// ---- JSON Cleaning ----

function cleanJSON(raw) {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const idx = s.indexOf('{');
  if (idx > 0) s = s.slice(idx);
  const lastIdx = s.lastIndexOf('}');
  if (lastIdx >= 0 && lastIdx < s.length - 1) s = s.slice(0, lastIdx + 1);
  return s;
}

// ---- Generate Spec via OpenRouter ----

async function generateSpec(prompt, options, apiKey) {
  const model = 'google/gemini-2.5-flash';
  const messages = [{ role: 'system', content: buildSystemPrompt() }];

  if (options.existing_spec) {
    messages.push({
      role: 'assistant',
      content: typeof options.existing_spec === 'string' ? options.existing_spec : JSON.stringify(options.existing_spec),
    });
    messages.push({ role: 'user', content: `Modify the existing spec above according to these instructions: ${prompt}` });
  } else {
    let userContent = prompt;
    if (options.theme) userContent += `\n\nUse the "${options.theme}" theme.`;
    messages.push({ role: 'user', content: userContent });
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daub.dev',
      'X-Title': 'DAUB MCP Server',
    },
    body: JSON.stringify({ model, messages, max_tokens: 32768, temperature: 0.7, response_format: { type: 'json_object' } }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error('No content in OpenRouter response');

  let spec;
  try {
    spec = JSON.parse(cleanJSON(rawContent));
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e.message}`);
  }

  spec = autoFixSpec(spec);
  const validation = validateSpec(spec);
  return { spec, validation };
}

// ---- Spec Summary ----

function specSummary(spec) {
  if (!spec || !spec.elements) return 'Empty spec';
  const types = new Set();
  for (const def of Object.values(spec.elements)) {
    if (def.type) types.add(def.type);
  }
  return `${Object.keys(spec.elements).length} elements, ${types.size} component types, theme: ${spec.theme || 'light'}`;
}

// ---- Render spec to self-contained HTML ----

function renderToHTML(spec) {
  const theme = spec.theme || 'light';
  const specJSON = JSON.stringify(spec);
  return `<!DOCTYPE html>
<html data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAUB UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daub-ui@3/daub.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"><\/script>
  <style>
    body { margin: 0; padding: 16px; font-family: Inter, system-ui, sans-serif; background: var(--db-bg); color: var(--db-fg); }
    #app { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/daub-ui@3/daub.js"><\/script>
  <script>
  (function() {
    var spec = ${specJSON};
    // Load renderer from playground and render spec
    var s = document.createElement('script');
    s.src = 'https://daub.dev/daub-render.js';
    s.onload = function() {
      if (typeof renderElement === 'function') {
        var root = renderElement(spec.elements, spec.root, 0);
        if (root) document.getElementById('app').appendChild(root);
        var rendered = {};
        document.querySelectorAll('[data-spec-id]').forEach(function(n) { rendered[n.getAttribute('data-spec-id')] = true; });
        Object.keys(spec.elements).forEach(function(id) {
          if (id !== spec.root && !rendered[id]) {
            var orphan = renderElement(spec.elements, id, 0);
            if (orphan) document.getElementById('app').appendChild(orphan);
          }
        });
        if (typeof DAUB !== 'undefined') DAUB.init();
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    };
    document.body.appendChild(s);
  })();
  <\/script>
</body>
</html>`;
}

// ---- MCP Tool Definitions ----

const TOOLS = [
  {
    name: 'generate_ui',
    description: 'Generate a complete DAUB UI from a natural language prompt. Returns a JSON spec (json-render format), self-contained HTML, validation results, and a summary.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Natural language description of the UI to generate' },
        theme: { type: 'string', description: 'Theme override, e.g. "dracula", "github", "bone"' },
        existing_spec: { type: 'string', description: 'Existing DAUB spec JSON string to modify/refine' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'get_component_catalog',
    description: 'Returns available DAUB components so you can construct specs directly without an LLM call. Includes component types, props, categories, themes, and an example spec.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category name, e.g. "Controls", "Navigation"' },
      },
    },
  },
  {
    name: 'validate_spec',
    description: 'Validate a DAUB spec JSON string. Returns validation status, issues, element count, and components used.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'string', description: 'DAUB spec JSON string to validate' },
      },
      required: ['spec'],
    },
  },
  {
    name: 'render_spec',
    description: 'Render an existing DAUB spec JSON into self-contained HTML. Returns the spec, rendered HTML, and validation results.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'string', description: 'DAUB spec JSON string' },
      },
      required: ['spec'],
    },
  },
];

// ---- MCP Tool Handlers ----

async function handleToolCall(name, args, env) {
  switch (name) {
    case 'generate_ui': {
      const apiKey = env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('Server misconfigured: missing OPENROUTER_API_KEY');
      const options = { theme: args.theme };
      if (args.existing_spec) {
        try { options.existing_spec = JSON.parse(args.existing_spec); } catch { options.existing_spec = args.existing_spec; }
      }
      const { spec, validation } = await generateSpec(args.prompt, options, apiKey);
      const summary = specSummary(spec);
      const html = renderToHTML(spec);
      return JSON.stringify({ spec, html, summary, validation: { valid: validation.valid, issues: validation.issues } }, null, 2);
    }

    case 'get_component_catalog': {
      let categories = COMP_CATEGORIES;
      if (args.category) {
        categories = categories.filter(([name]) => name.toLowerCase().includes(args.category.toLowerCase()));
      }
      const catalog = {};
      for (const [catName, types] of categories) {
        catalog[catName] = {};
        for (const t of types) catalog[catName][t] = COMP_PROPS[t] || '(no props)';
      }
      return JSON.stringify({
        categories: catalog,
        all_types: VALID_TYPES,
        themes: {
          light: ['light', 'bone', 'material-light', 'github', 'nord-light', 'solarized-light', 'catppuccin', 'gruvbox-light', 'paper', 'grunge-light'],
          dark: ['dark', 'material-dark', 'github-dark', 'nord', 'solarized-dark', 'catppuccin-dark', 'gruvbox-dark', 'dracula', 'grunge-dark', 'synthwave', 'tokyo-night'],
        },
        spec_format: '{"theme":"<name>","root":"<id>","elements":{"<id>":{"type":"<Type>","props":{...},"children":["<child-id>"]}}}',
        example: {
          theme: 'bone',
          root: 'page',
          elements: {
            page: { type: 'Stack', props: { direction: 'vertical', gap: 4 }, children: ['heading', 'card-1'] },
            heading: { type: 'Text', props: { tag: 'h1', content: 'Hello DAUB' } },
            'card-1': { type: 'Card', props: { title: 'Welcome', description: 'This is a DAUB component' } },
          },
        },
      }, null, 2);
    }

    case 'validate_spec': {
      const spec = JSON.parse(args.spec);
      return JSON.stringify(validateSpec(spec), null, 2);
    }

    case 'render_spec': {
      const spec = JSON.parse(args.spec);
      const validation = validateSpec(spec);
      const html = renderToHTML(spec);
      return JSON.stringify({ spec, html, validation }, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---- JSON-RPC Helpers ----

function jsonrpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// ---- MCP Protocol Handler ----

async function handleMcpRequest(body, env) {
  const { method, id, params } = body;

  // Notifications (no id) — acknowledge with 202
  if (id === undefined || id === null) {
    return { status: 202, body: null };
  }

  switch (method) {
    case 'initialize':
      return {
        status: 200,
        body: jsonrpcResult(id, {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'daub-mcp', version: '1.0.0' },
        }),
      };

    case 'tools/list':
      return {
        status: 200,
        body: jsonrpcResult(id, { tools: TOOLS }),
      };

    case 'tools/call': {
      const { name, arguments: args } = params || {};
      try {
        const text = await handleToolCall(name, args || {}, env);
        return {
          status: 200,
          body: jsonrpcResult(id, { content: [{ type: 'text', text }] }),
        };
      } catch (e) {
        return {
          status: 200,
          body: jsonrpcResult(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }),
        };
      }
    }

    case 'ping':
      return { status: 200, body: jsonrpcResult(id, {}) };

    default:
      return {
        status: 200,
        body: jsonrpcError(id, -32601, `Method not found: ${method}`),
      };
  }
}

// ---- Cloudflare Pages Function: POST ----

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify(jsonrpcError(null, -32700, 'Parse error')), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Handle batch requests
  if (Array.isArray(body)) {
    const results = [];
    for (const req of body) {
      const res = await handleMcpRequest(req, env);
      if (res.body) results.push(res.body);
    }
    if (results.length === 0) {
      return new Response(null, { status: 202, headers: corsHeaders });
    }
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const result = await handleMcpRequest(body, env);

  if (result.status === 202) {
    return new Response(null, { status: 202, headers: corsHeaders });
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---- Cloudflare Pages Function: GET (SSE — not needed for stateless, return 405) ----

export async function onRequestGet() {
  return new Response(JSON.stringify({ error: 'SSE not supported — use POST for MCP requests' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ---- Cloudflare Pages Function: DELETE (session cleanup — no-op for stateless) ----

export async function onRequestDelete() {
  return new Response(null, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

// ---- Cloudflare Pages Function: OPTIONS (CORS preflight) ----

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    },
  });
}
