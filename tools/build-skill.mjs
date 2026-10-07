#!/usr/bin/env node
// Regenerates the fact-heavy parts of the daub-ui agent skill (SKILL.md + references/) from the
// sources of truth, and the digests in .well-known/agent-skills/index.json.
//
//   node tools/build-skill.mjs           rewrite generated blocks and the index
//   node tools/build-skill.mjs --check   exit 1 and list what is stale (tests/skill.test.mjs runs this)
//
// Generated content lives between marker comments in references/*.md:
//   <!-- BEGIN GENERATED:<block> (tools/build-skill.mjs) -->  ...  <!-- END GENERATED:<block> -->
// Edit the prose around the markers by hand; never edit inside them.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://daub.dev';
const INDEX_PATH = '.well-known/agent-skills/index.json';
const INDEX_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

// ---- source extraction --------------------------------------------------------

// Balanced literal ([...] or {...}) that follows `decl` in src; skips strings and comments.
function literalAfter(src, decl, file) {
  const at = src.search(decl);
  if (at < 0) throw new Error(`build-skill: ${decl} not found in ${file}`);
  let i = at + src.slice(at).search(/[[{]/);
  const start = i;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (!depth) return vm.runInNewContext('(' + src.slice(start, i + 1) + ')'); }
  }
  throw new Error(`build-skill: unbalanced literal after ${decl} in ${file}`);
}

function read(rel) { return readFileSync(join(ROOT, rel), 'utf8'); }

export function loadSources() {
  const pg = read('playground.html');
  const mcp = read('functions/api/mcp.js');
  const daub = read('daub.js');
  const render = read('daub-render.js');
  const require = createRequire(import.meta.url);
  const parser = require(join(ROOT, 'daub-openui-parser.js'));
  const mcpCats = literalAfter(mcp, /const COMP_CATEGORIES\s*=/, 'mcp.js');
  let mcpCatalogThemes;
  if (/themes:\s*THEMES\b/.test(mcp)) {
    const sharedThemes = require(join(ROOT, 'daub-render.js')).THEMES;
    mcpCatalogThemes = Array.isArray(sharedThemes) ? sharedThemes : sharedThemes.light.concat(sharedThemes.dark);
  } else {
    if (!/themes:\s*\{\s*light:\s*LIGHT_THEMES,\s*dark:\s*DARK_THEMES\s*\}/.test(mcp)) throw new Error('build-skill: get_component_catalog themes not found in mcp.js');
    const mcpFamilies = literalAfter(mcp, /const THEME_FAMILIES\s*=/, 'mcp.js');
    mcpCatalogThemes = Object.values(mcpFamilies).flatMap(f => [f.light, f.dark]);
  }
  const llms = read('llms.txt');
  const character = {};
  for (const m of llms.matchAll(/^\| ([^|`]+?) \| `([^`]+)` \| `([^`]+)` \| ([^|]+?) \|$/gm)) character[m[2] + '/' + m[3]] = { label: m[1], character: m[4] };
  return {
    version: JSON.parse(read('package.json')).version,
    components: JSON.parse(read('components.json')),
    schema: parser.COMP_SCHEMA,
    props: literalAfter(pg, /var COMP_PROPS\s*=/, 'playground.html'),
    categories: literalAfter(pg, /var COMP_CATEGORIES\s*=/, 'playground.html'),
    purpose: literalAfter(pg, /var COMP_PURPOSE\s*=/, 'playground.html'),
    pickCore: literalAfter(pg, /var PICK_CORE\s*=/, 'playground.html'),
    pickThreshold: Number(/var PICK_THRESHOLD\s*=\s*([\d.]+)/.exec(pg)[1]),
    mcpPickThreshold: Number(/const PICK_THRESHOLD\s*=\s*([\d.]+)/.exec(mcp)[1]),
    mcpTypes: mcpCats.flatMap(([, types]) => types),
    mcpTools: literalAfter(mcp, /const TOOLS\s*=/, 'mcp.js'),
    mcpBlocks: literalAfter(mcp, /const BLOCK_INDEX\s*=/, 'mcp.js'),
    mcpCatalogThemes,
    themes: literalAfter(daub, /var THEMES\s*=/, 'daub.js'),
    families: literalAfter(daub, /var THEME_FAMILIES\s*=/, 'daub.js'),
    themeCategories: literalAfter(daub, /var THEME_CATEGORIES\s*=/, 'daub.js'),
    renderers: [...new Set([...render.matchAll(/RENDERERS\.(\w+)\s*=/g)].map(m => m[1]))],
    blocks: JSON.parse(read('blocks/index.json')),
    character,
  };
}

// ---- generated blocks ---------------------------------------------------------

const CORE_PURPOSE = {
  Stack: 'a flexbox row or column that lays out its children (the usual page root)',
  Grid: 'an equal-width CSS grid of 2-6 columns',
  Text: 'a heading, paragraph or inline text',
  Card: 'a titled container for related content',
  Button: 'a clickable action; trigger opens an overlay by id',
  Icon: 'a standalone Lucide icon',
  Separator: 'a horizontal or vertical divider line',
};

const code = s => '`' + String(s).replace(/`/g, "'") + '`';

function specTypes(s) {
  const mcp = new Set(s.mcpTypes);
  const out = [];
  for (const [cat, types] of s.categories) {
    out.push(`### ${cat}`, '');
    for (const t of types) {
      const purpose = s.purpose[t] || CORE_PURPOSE[t] || '';
      const notes = [];
      if (s.pickCore.includes(t)) notes.push('core');
      if (s.schema[t] && s.schema[t][0] === 'children') notes.push('children first');
      if (!mcp.has(t)) notes.push('hosted MCP rejects');
      if (!s.schema[t]) notes.push('not in OpenUI parser');
      const props = s.props[t] ? code(s.props[t]) : '(no props)';
      out.push(`- **${t}**${notes.length ? ' _(' + notes.join(', ') + ')_' : ''}: ${purpose}. Props: ${props}`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}

function htmlClasses(s) {
  const byCat = new Map();
  for (const c of s.components.components) {
    if (!byCat.has(c.category)) byCat.set(c.category, []);
    byCat.get(c.category).push(c);
  }
  const out = [];
  for (const [cat, list] of byCat) {
    out.push(`### ${cat} (${list.length})`, '');
    for (const c of list) {
      const bits = [`${code('.' + c.class)} on ${code('<' + c.element + '>')}`];
      if (c.modifiers && c.modifiers.length) bits.push('modifiers ' + c.modifiers.map(code).join(' '));
      const parts = (c.children || []).map(ch => code(ch.class) + (ch.required ? '*' : ''));
      if (parts.length) bits.push('parts ' + parts.join(' '));
      if (c.js) bits.push('needs daub.js');
      if (c.runtime_only) bits.push('created at runtime');
      if (c.aliases && c.aliases.length) bits.push('aliases ' + c.aliases.map(code).join(' '));
      out.push(`- **${c.name}**: ${bits.join('; ')}.` + (c.notes ? ' ' + c.notes.replace(/\s+/g, ' ') : ''));
    }
    out.push('');
  }
  out.push('`*` marks a required part.');
  return out.join('\n').trim();
}

// Split a COMP_PROPS string on commas outside ()/[]/{} (same rule as openUISignature() in functions/api/mcp.js)
function splitTopLevel(str) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of str) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function signature(s, t) {
  const segs = {};
  for (const seg of splitTopLevel(s.props[t] || '')) {
    const m = /^([A-Za-z_]\w*)\s*:/.exec(seg);
    if (m) segs[m[1]] = seg;
  }
  const args = s.schema[t].map(k => segs[k] || (k === 'children' ? 'children: [refs]' : k));
  const named = Object.keys(segs).filter(k => !s.schema[t].includes(k));
  return `${t}(${args.join(', ')})` + (named.length ? `  // named only: ${named.join(', ')}` : '');
}

function signatures(s) {
  const out = [];
  const seen = new Set();
  for (const [cat, types] of s.categories) {
    const list = types.filter(t => s.schema[t]);
    if (!list.length) continue;
    out.push(`### ${cat}`, '', '```text');
    for (const t of list) { out.push(signature(s, t)); seen.add(t); }
    out.push('```', '');
  }
  const rest = Object.keys(s.schema).filter(t => !seen.has(t));
  if (rest.length) out.push('### Other', '', '```text', ...rest.map(t => signature(s, t)), '```', '');
  const first = Object.keys(s.schema).filter(t => s.schema[t][0] === 'children');
  out.push(`Children-first types (${first.length}): ${first.join(', ')}.`, '');
  const last = Object.keys(s.schema).filter(t => s.schema[t].includes('children') && s.schema[t][0] !== 'children');
  if (last.length) out.push(`Children elsewhere: ${last.map(t => `${t} (position ${s.schema[t].indexOf('children') + 1})`).join(', ')}.`, '');
  out.push(`Parser types: ${Object.keys(s.schema).length}. Any other PascalCase name tokenizes as a plain identifier and becomes a dangling child reference.`);
  return out.join('\n').trim();
}

function blocksIndex(s) {
  const inMcp = new Set(s.mcpBlocks.map(b => b.id));
  const byCat = new Map();
  for (const b of s.blocks) {
    if (!byCat.has(b.category)) byCat.set(b.category, []);
    byCat.get(b.category).push(b);
  }
  const mcpTypes = new Set(s.mcpTypes);
  const outside = s.blocks.filter(b => (b.components_used || []).some(t => !mcpTypes.has(t)));
  const extra = [...new Set(outside.flatMap(b => b.components_used.filter(t => !mcpTypes.has(t))))];
  const out = [`${s.blocks.length} blocks in ${byCat.size} categories. ${inMcp.size} of them are listed by the hosted MCP ${code('get_block_library')} (marked MCP); every file is served at ${code(SITE + '/blocks/<file>')}.`, ''];
  if (outside.length) out.push(`${outside.length} blocks use ${extra.map(code).join(' or ')}, which render in the playground and with ${code('daub-render.js')} but fail the hosted MCP ${code('validate_spec')}. Before you send one of those to the MCP, move icons into props and turn links into ghost Buttons.`, '');
  for (const [cat, list] of [...byCat].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push(`### ${cat} (${list.length})`, '');
    for (const b of list) {
      out.push(`- ${code(b.id)} ${b.element_count} el${inMcp.has(b.id) ? ', MCP' : ''}: ${(b.components_used || []).join(', ')}. File ${code('blocks/' + b.file)}`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}

function themeFamilies(s) {
  const catOf = {};
  for (const [cat, fams] of Object.entries(s.themeCategories)) for (const f of fams) catOf[f] = cat;
  const out = ['| Family | Category | Light theme | Dark theme | Character |', '|---|---|---|---|---|'];
  for (const [fam, v] of Object.entries(s.families)) {
    const row = s.character[v.light + '/' + v.dark];
    if (!row) throw new Error(`build-skill: no llms.txt theme table row for ${fam} (${v.light}/${v.dark})`);
    out.push(`| ${code(fam)} | ${catOf[fam] || ''} | ${code(v.light)} | ${code(v.dark)} | ${row.character} |`);
  }
  out.push('', `${Object.keys(s.families).length} families, ${s.themes.length} theme names. ${code('light')} (the default) and ${code('dark')} are the \`default\` family.`);
  return out.join('\n');
}

function themeInvalid(s) {
  const valid = new Set(s.themes);
  const bad = [...new Set(s.mcpCatalogThemes)].filter(t => !valid.has(t));
  if (!bad.length) return 'Every theme name the hosted MCP catalog lists is valid.';
  return `The hosted MCP ${code('get_component_catalog')} still lists ${bad.map(code).join(', ')}. daub.js defines none of them, so a spec with that theme renders in the default light palette. Use the table above instead.`;
}

function mcpTools(s) {
  const out = [];
  for (const t of s.mcpTools) {
    out.push(`### ${code(t.name)}`, '', t.description, '');
    const props = (t.inputSchema && t.inputSchema.properties) || {};
    const req = new Set((t.inputSchema && t.inputSchema.required) || []);
    const names = Object.keys(props);
    if (!names.length) out.push('No arguments.', '');
    for (const n of names) {
      const p = props[n];
      const type = p.enum ? p.enum.map(v => JSON.stringify(v)).join(' | ') : p.type;
      out.push(`- ${code(n)} (${type}${req.has(n) ? ', required' : ''}): ${p.description || ''}`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}

function purposeMap(s) {
  const map = {};
  for (const [, types] of s.categories) for (const t of types) if (!s.pickCore.includes(t) && s.purpose[t]) map[t] = s.purpose[t];
  return [
    `Core set (always kept, never asked): ${s.pickCore.map(code).join(', ')}.`,
    `Threshold: ${code('p(yes) >= ' + s.pickThreshold)} in the playground (tuned value). The hosted MCP ${code('generate_ui')} uses ${code(s.mcpPickThreshold)}.`,
    '',
    `Purpose map (${Object.keys(map).length} questions, one per non-core type), copied from ${code('COMP_PURPOSE')} in playground.html:`,
    '',
    '```json',
    JSON.stringify(map, null, 2),
    '```',
  ].join('\n');
}

const BLOCKS = {
  'references/components.md': { 'spec-types': specTypes, 'html-classes': htmlClasses },
  'references/openui.md': { signatures },
  'references/blocks.md': { index: blocksIndex },
  'references/themes.md': { families: themeFamilies, 'mcp-invalid': themeInvalid },
  'references/mcp.md': { tools: mcpTools },
  'references/jev.md': { 'purpose-map': purposeMap },
};

function fill(text, name, body, file) {
  const begin = `<!-- BEGIN GENERATED:${name} (tools/build-skill.mjs) -->`;
  const end = `<!-- END GENERATED:${name} -->`;
  const a = text.indexOf(begin), b = text.indexOf(end);
  if (a < 0 || b < a) throw new Error(`build-skill: markers for "${name}" missing in ${file}`);
  return text.slice(0, a + begin.length) + '\n' + body + '\n' + text.slice(b);
}

// ---- agent-skills index -------------------------------------------------------

function frontmatter(md) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m) throw new Error('build-skill: SKILL.md has no frontmatter');
  const fm = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([a-z-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    if (kv[2] === '>-' || kv[2] === '|' || kv[2] === '>') {
      const buf = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) buf.push(lines[++i].trim());
      fm[kv[1]] = kv[2] === '|' ? buf.join('\n') : buf.join(' ');
    } else fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return fm;
}

const REF_DESC = {
  components: 'DAUB component catalog: spec types with purpose and props, plus every db-* HTML class with modifiers and parts.',
  openui: 'OpenUI Lang syntax for DAUB and every component signature in parser argument order.',
  'json-render': 'DAUB json-render flat spec format: elements, children, state, actions, visibility, validation and renderer tolerance.',
  blocks: 'Index of the DAUB block library: composable json-render sections by category.',
  themes: 'DAUB theme families, exact theme names, the theme API and selection heuristics.',
  mcp: 'The hosted DAUB MCP server: tools, arguments, plain-HTTP calls and client setup.',
  jev: 'Recipes for Jev (TypeSafe decision model on OpenRouter) in DAUB flows: component, block and theme picking.',
  verify: 'How to verify DAUB output: parse, lint, render and visual review.',
  design: 'Layout, density and hierarchy rules for DAUB pages.',
};

function sha(buf) { return createHash('sha256').update(buf).digest('hex'); }

function buildIndex(files, s) {
  const skillMd = files.get('SKILL.md');
  const fm = frontmatter(skillMd);
  const entry = (name, type, description, rel) => {
    const hex = sha(files.has(rel) ? files.get(rel) : readFileSync(join(ROOT, rel)));
    return { name, type, description, url: `${SITE}/${rel}`, digest: 'sha256:' + hex, sha256: hex };
  };
  const refs = readdirSync(join(ROOT, 'references')).filter(f => f.endsWith('.md')).sort();
  for (const f of refs) if (!REF_DESC[f.replace(/\.md$/, '')]) throw new Error(`build-skill: add a REF_DESC entry for references/${f}`);
  const count = s.components.components.length, fams = Object.keys(s.families).length;
  const index = {
    $schema: INDEX_SCHEMA,
    skills: [
      entry('daub-ui', 'skill-md', fm.description, 'SKILL.md'),
      entry('daub-llms-full', 'documentation', `Full DAUB UI reference: all ${count} components with classes, variants and HTML examples, ${fams} theme families, JS API.`, 'llms.txt'),
      entry('daub-llms-compact', 'documentation', 'Compact DAUB reference: quick start and the most used components, token-efficient for LLM context.', 'llms-compact.txt'),
      entry('daub-components', 'data', `Structured JSON catalog of all ${count} DAUB components: classes, modifiers, parts, JS needs and HTML.`, 'components.json'),
      ...refs.map(f => entry('daub-ui-ref-' + f.replace(/\.md$/, ''), 'documentation', REF_DESC[f.replace(/\.md$/, '')], 'references/' + f)),
    ],
  };
  return JSON.stringify(index, null, 2) + '\n';
}

// ---- main ---------------------------------------------------------------------

export function build() {
  const s = loadSources();
  const files = new Map();
  for (const [file, blocks] of Object.entries(BLOCKS)) {
    let text = read(file);
    for (const [name, fn] of Object.entries(blocks)) text = fill(text, name, fn(s), file);
    files.set(file, text);
  }
  files.set('SKILL.md', read('SKILL.md'));
  files.set(INDEX_PATH, buildIndex(files, s));
  return files;
}

function main() {
  const check = process.argv.includes('--check');
  const files = build();
  const stale = [];
  for (const [file, text] of files) {
    const abs = join(ROOT, file);
    const cur = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    if (cur === text) continue;
    stale.push(file);
    if (!check) writeFileSync(abs, text);
  }
  if (check) {
    if (stale.length) {
      console.error('Stale skill files (run: node tools/build-skill.mjs):\n  ' + stale.join('\n  '));
      process.exit(1);
    }
    console.log('Skill files are current.');
  } else {
    console.log(stale.length ? 'Updated:\n  ' + stale.filter(f => f !== 'SKILL.md').join('\n  ') : 'Nothing to update.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
