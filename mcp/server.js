#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { generateSpec } from './lib/generate.js';
import { validateSpec } from './lib/validate.js';
import { renderToHTML, buildPreviewURL, specSummary } from './lib/render.js';
import { COMP_PROPS, COMP_CATEGORIES, VALID_TYPES } from './lib/prompt.js';

const server = new McpServer({
  name: 'daub-mcp',
  version: '1.0.0',
});

// ---- Tool 1: generate_ui ----
server.tool(
  'generate_ui',
  'Generate a complete DAUB UI from a natural language prompt. Returns a JSON spec, a rendered HTML file path, and a playground preview URL.',
  {
    prompt: z.string().describe('Natural language description of the UI to generate, e.g. "Admin dashboard with user table, stat cards, sidebar navigation"'),
    theme: z.string().optional().describe('Theme override, e.g. "dracula", "github", "bone"'),
    existing_spec: z.string().optional().describe('Existing DAUB spec JSON string to modify/refine'),
  },
  async ({ prompt, theme, existing_spec }) => {
    try {
      const options = { theme };
      if (existing_spec) {
        try {
          options.existing_spec = JSON.parse(existing_spec);
        } catch {
          options.existing_spec = existing_spec;
        }
      }

      const { spec, validation } = await generateSpec(prompt, options);
      const htmlFile = renderToHTML(spec);
      const previewUrl = buildPreviewURL(spec);
      const summary = specSummary(spec);

      const result = {
        spec,
        html_file: htmlFile,
        preview_url: previewUrl,
        summary,
        validation: { valid: validation.valid, issues: validation.issues },
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `Error generating UI: ${e.message}` }],
        isError: true,
      };
    }
  }
);

// ---- Tool 2: get_component_catalog ----
server.tool(
  'get_component_catalog',
  'Returns available DAUB components so you can construct specs directly without an LLM call. Includes component types, props, categories, themes, and an example spec.',
  {
    category: z.string().optional().describe('Filter by category name, e.g. "Controls", "Navigation", "Data Display"'),
  },
  async ({ category }) => {
    let categories = COMP_CATEGORIES;
    if (category) {
      categories = categories.filter(([name]) =>
        name.toLowerCase().includes(category.toLowerCase())
      );
    }

    const catalog = {};
    for (const [catName, types] of categories) {
      catalog[catName] = {};
      for (const t of types) {
        catalog[catName][t] = COMP_PROPS[t] || '(no props)';
      }
    }

    const result = {
      categories: catalog,
      all_types: VALID_TYPES,
      themes: {
        light: ['light', 'bone', 'material-light', 'github', 'nord-light', 'solarized-light', 'catppuccin', 'gruvbox-light', 'paper', 'grunge-light'],
        dark: ['dark', 'material-dark', 'github-dark', 'nord', 'solarized-dark', 'catppuccin-dark', 'gruvbox-dark', 'dracula', 'grunge-dark', 'synthwave', 'tokyo-night'],
      },
      spec_format: {
        description: 'DAUB specs use a flat element map with ID references',
        format: '{"theme":"<name>","root":"<element-id>","elements":{"<id>":{"type":"<ComponentType>","props":{...},"children":["<child-id>"]}}}',
      },
      example: {
        theme: 'bone',
        root: 'page',
        elements: {
          page: { type: 'Stack', props: { direction: 'vertical', gap: 4 }, children: ['heading', 'card-1'] },
          heading: { type: 'Text', props: { tag: 'h1', content: 'Hello DAUB' } },
          'card-1': { type: 'Card', props: { title: 'Welcome', description: 'This is a DAUB component' } },
        },
      },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---- Tool 3: render_spec ----
server.tool(
  'render_spec',
  'Render an existing DAUB spec JSON into a self-contained HTML file and playground preview URL.',
  {
    spec: z.string().describe('DAUB spec JSON string'),
    output_path: z.string().optional().describe('Where to save the HTML file (default: /tmp/daub-mcp/)'),
  },
  async ({ spec: specStr, output_path }) => {
    try {
      const spec = JSON.parse(specStr);
      const validation = validateSpec(spec);
      const htmlFile = renderToHTML(spec, output_path);
      const previewUrl = buildPreviewURL(spec);

      const result = {
        html_file: htmlFile,
        preview_url: previewUrl,
        validation,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `Error rendering spec: ${e.message}` }],
        isError: true,
      };
    }
  }
);

// ---- Tool 4: validate_spec ----
server.tool(
  'validate_spec',
  'Validate a DAUB spec JSON string. Returns validation status, issues, element count, and components used.',
  {
    spec: z.string().describe('DAUB spec JSON string to validate'),
  },
  async ({ spec: specStr }) => {
    try {
      const spec = JSON.parse(specStr);
      const result = validateSpec(spec);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            valid: false,
            issues: [`Invalid JSON: ${e.message}`],
            element_count: 0,
            components_used: [],
          }, null, 2),
        }],
      };
    }
  }
);

// ---- Start ----
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DAUB MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
