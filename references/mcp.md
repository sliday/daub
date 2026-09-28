# The hosted DAUB MCP server

`https://daub.dev/api/mcp` speaks MCP over Streamable HTTP: stateless JSON-RPC 2.0 over POST, CORS open to every origin, no auth. It allows 60 requests per minute per IP and up to 10 calls per JSON-RPC batch.

## Connect

- Claude Code: `claude mcp add daub --transport http https://daub.dev/api/mcp`. It lands in the local (per-project) scope by default; if `claude mcp list` does not show it, look under `projects` in `~/.claude.json`.
- Cursor, Windsurf and other clients with remote servers: add `{ "mcpServers": { "daub": { "url": "https://daub.dev/api/mcp" } } }` to the client's MCP config.
- Clients that only run stdio servers (some Codex and pi setups): `npx -y mcp-remote https://daub.dev/api/mcp` as the command.
- No MCP client at all: call the endpoint with curl. No `initialize` handshake is needed.

```bash
curl -s https://daub.dev/api/mcp -H 'Content-Type: application/json' -d '{
  "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": { "name": "validate_spec", "arguments": { "spec": "{\"root\":\"t\",\"elements\":{\"t\":{\"type\":\"Text\",\"props\":{\"content\":\"Hello\"}}}}" } }
}'
```

The reply is `{ "result": { "content": [{ "type": "text", "text": "<JSON string>" }] } }`. Parse `text` as JSON. `tools/list` returns the schemas below.

## Tools

<!-- BEGIN GENERATED:tools (tools/build-skill.mjs) -->
### `generate_ui`

Generate a complete DAUB UI from a natural language prompt. Returns a JSON spec (json-render format), self-contained HTML, validation results, and a summary.

- `prompt` (string, required): Natural language description of the UI to generate
- `theme` (string): Theme override, e.g. "dracula", "github", "bone"
- `existing_spec` (string): Existing DAUB spec JSON string to modify/refine
- `format` ("json" | "openui"): Output format for LLM generation. "openui" uses token-efficient OpenUI Lang (67% fewer tokens). Default: "json"

### `get_component_catalog`

Returns available DAUB components so you can construct specs directly without an LLM call. Includes component types, props, categories, themes, and an example spec.

- `category` (string): Filter by category name, e.g. "Controls", "Navigation"

### `validate_spec`

Validate a DAUB spec JSON string. Returns validation status, issues, element count, and components used.

- `spec` (string, required): DAUB spec JSON string to validate (a spec object also works)

### `render_spec`

Render an existing DAUB spec JSON into self-contained HTML. Returns the spec, rendered HTML, and validation results.

- `spec` (string, required): DAUB spec JSON string (a spec object also works)

### `get_block_library`

Returns available pre-made UI building blocks (layout patterns). Each block is a proven DAUB spec that can be used as-is or adapted. Use blocks as starting points for common UI patterns like dashboards, landing pages, forms, etc.

- `category` (string): Filter by category: "landing", "dashboard", "forms", "auth", "ecommerce", "data-display", "mobile"

### `parse_openui`

Parse OpenUI Lang code into a DAUB JSON spec. Useful for converting token-efficient OpenUI Lang output to the standard spec format.

- `code` (string, required): OpenUI Lang code to parse
<!-- END GENERATED:tools -->

## Workflow

1. Draft: `generate_ui` with a prompt that names the page type, sections, data and theme ("Admin dashboard for a dental clinic: sidebar, 4 KPI cards, appointments table with 6 rows, nord-light"). Add `format: "openui"` for a cheaper generation.
2. Read the result: `spec`, `html`, `validation`, and `routing` (complexity tier, `model_used`, `rag_blocks` the server retrieved, `picked_components` from Jev).
3. Edit: change the spec yourself under the golden rules, or call `generate_ui` again with `existing_spec` (a JSON string) and the change as `prompt`.
4. Check: `validate_spec`, then `render_spec` and look at the HTML in a browser (`references/verify.md`).
5. Share: build a playground link from the final spec (SKILL.md, Preview).

To build without a model, call `get_component_catalog` (optionally with `category`), write the spec, and go straight to step 4.

## Behavior to know

- `validate_spec` and `render_spec` take the spec as a JSON string or as an object. `parse_openui` takes OpenUI Lang in `code`.
- The hosted validator and parser know the playground's spec types except `Icon` and `Link` (v3.20.4). `parse_openui` turns `Icon(...)` into a stray Text and a dangling child id. Use icon props instead.
- `render_spec` HTML loads `daub.css`, `daub.js` and `daub-render.js` from daub.dev at the deployed version, plus pinned Lucide 0.576.0. The page pads the body by 16 px and caps `#app` at 1200 px. It does not run declarative state (`references/json-render.md`).
- `get_component_catalog` lists some theme names daub.js does not define (`references/themes.md`).
- `generate_ui` retrieves up to 5 similar blocks as examples, asks Jev which components the prompt needs (threshold 0.5), routes the prompt to a model tier by complexity, retries and falls back to other models, and runs `autoFixSpec()` on the result. A failed run returns `error`, `routing` and the first 1000 characters of `raw_text`.
- `get_block_library` returns ids, descriptions and tags, not the specs. Fetch a spec from `https://daub.dev/blocks/<file>` (`references/blocks.md`).
- The npm package `daub-mcp` (in `mcp/` of the repo) is a stdio variant that needs its own OpenRouter key and returns a playground `preview_url`.
