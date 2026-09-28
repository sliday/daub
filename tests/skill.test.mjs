// Guards the daub-ui agent skill (SKILL.md + references/): generated blocks and index digests are
// current, facts match the source, and every example parses, lints clean and renders.
//
//   node --test tests/skill.test.mjs
//
// The render tests need Playwright with Chromium (`playwright` resolvable, or PLAYWRIGHT_MODULE=/abs/path/index.js);
// without it they skip. Icon names are checked when lucide 0.576.0 is cached or downloadable.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve, isAbsolute, normalize, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSources } from '../tools/build-skill.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { openUItoSpec, COMP_SCHEMA } = require(join(ROOT, 'daub-openui-parser.js'));
const S = loadSources();

const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const REF_FILES = readdirSync(join(ROOT, 'references')).filter(f => f.endsWith('.md')).sort();
const DOCS = ['SKILL.md', ...REF_FILES.map(f => 'references/' + f)].map(file => ({ file, text: read(file) }));

// Fenced blocks with their language and 1-based start line
function fences(file, text) {
  const out = [];
  for (const m of text.matchAll(/^```([\w-]*)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm)) {
    out.push({ file, lang: m[1], body: m[2], line: text.slice(0, m.index).split('\n').length });
  }
  return out;
}
const BLOCKS = DOCS.flatMap(d => fences(d.file, d.text));
const where = b => `${b.file}:${b.line}`;

// Spec examples: every openui block, and every json block that is a spec ({root, elements})
const EXAMPLES = [];
for (const b of BLOCKS) {
  if (b.lang === 'openui') EXAMPLES.push({ where: where(b), spec: openUItoSpec(b.body), src: b.body });
  if (b.lang === 'json') {
    let v;
    try { v = JSON.parse(b.body); } catch { continue; }
    if (v && typeof v === 'object' && v.root && v.elements) EXAMPLES.push({ where: where(b), spec: v, src: b.body });
  }
}

// The linter published in references/verify.md is the one the examples must pass
const lintBlock = BLOCKS.find(b => b.lang === 'js' && b.body.includes('function lintSpec('));
const lintSpec = lintBlock && new Function(lintBlock.body + '\nreturn lintSpec;')();
const LINT_OPTS = { types: Object.keys(COMP_SCHEMA), themes: S.themes, mcp: true };

describe('daub-ui skill: generated content', () => {
  it('generated blocks and index digests are current (else run: node tools/build-skill.mjs)', () => {
    const r = spawnSync(process.execPath, [join(ROOT, 'tools/build-skill.mjs'), '--check'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  it('index.json follows the discovery schema and lists every skill file', () => {
    const idx = JSON.parse(read('.well-known/agent-skills/index.json'));
    assert.equal(idx.$schema, 'https://schemas.agentskills.io/discovery/0.2.0/schema.json');
    const skill = idx.skills.find(s => s.name === 'daub-ui');
    assert.equal(skill.type, 'skill-md');
    assert.equal(skill.url, 'https://daub.dev/SKILL.md');
    for (const s of idx.skills) {
      assert.match(s.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, s.name);
      assert.match(s.digest, /^sha256:[0-9a-f]{64}$/, s.name);
      assert.ok(s.description.length <= 1024, s.name);
    }
    const urls = new Set(idx.skills.map(s => s.url));
    for (const f of REF_FILES) assert.ok(urls.has('https://daub.dev/references/' + f), 'index lacks references/' + f);
  });
});

describe('daub-ui skill: SKILL.md', () => {
  const md = read('SKILL.md');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(md);
  const body = md.slice(fm[0].length);

  it('has Agent Skills frontmatter', () => {
    assert.match(fm[1], /^name: daub-ui$/m);
    const desc = /^description: >-\n((?:[ ]+.*\n?)+)/m.exec(fm[1] + '\n');
    assert.ok(desc, 'description block missing');
    const text = desc[1].split('\n').map(s => s.trim()).filter(Boolean).join(' ');
    assert.ok(text.length > 0 && text.length <= 1024, `description is ${text.length} chars`);
    assert.match(fm[1], new RegExp(`daub-version: "${S.version.replace(/\./g, '\\.')}"`), 'metadata.daub-version must match package.json');
  });

  it('body stays under 250 lines', () => {
    assert.ok(body.split('\n').length <= 250, `body has ${body.split('\n').length} lines`);
  });

  it('states counts that match the source', () => {
    const counts = [
      `${S.components.components.length} components`,
      `${Object.keys(S.families).length} theme families`,
      `${S.themes.length} light and dark themes`,
      `${S.blocks.length} ready-made blocks`,
    ];
    for (const c of counts) assert.ok(md.includes(c), `SKILL.md should say "${c}"`);
    for (const t of S.mcpTools) assert.ok(md.includes('`' + t.name + '`'), `SKILL.md should name MCP tool ${t.name}`);
    const lucide = /lucide@([\d.]+)\//.exec(read('functions/api/mcp.js'))[1];
    for (const d of DOCS) for (const m of d.text.matchAll(/lucide@([\d.]+)/g)) assert.equal(m[1], lucide, `${d.file} pins lucide ${m[1]}`);
  });

  it('links every reference file, and each link resolves', () => {
    for (const m of md.matchAll(/references\/([\w-]+\.md)/g)) assert.ok(REF_FILES.includes(m[1]), `missing references/${m[1]}`);
    for (const f of REF_FILES) assert.ok(md.includes('`references/' + f + '`'), `reference map lacks ${f}`);
    const loop = /for f in ([\w -]+); do/.exec(md);
    assert.ok(loop, 'install loop missing');
    assert.deepEqual(loop[1].trim().split(/\s+/).map(f => f + '.md').sort(), REF_FILES);
  });
});

describe('daub-ui skill: examples', () => {
  it('finds the examples', () => {
    assert.ok(lintSpec, 'references/verify.md must contain the lintSpec() block');
    assert.ok(EXAMPLES.length >= 6, `only ${EXAMPLES.length} spec examples found`);
  });

  it('every json block is valid JSON', () => {
    for (const b of BLOCKS.filter(b => b.lang === 'json')) assert.doesNotThrow(() => JSON.parse(b.body), where(b));
  });

  it('every spec example parses and lints clean (strict: hosted MCP types)', () => {
    for (const ex of EXAMPLES) {
      assert.ok(ex.spec && ex.spec.elements, `${ex.where}: did not parse`);
      assert.ok(ex.spec.elements[ex.spec.root], `${ex.where}: root "${ex.spec.root}" missing`);
      const unknown = Object.entries(ex.spec.elements).filter(([, e]) => !S.renderers.includes(e.type) || !S.mcpTypes.includes(e.type));
      assert.deepEqual(unknown.map(([id, e]) => `${id}:${e.type}`), [], `${ex.where}: unknown types`);
      const r = lintSpec(ex.spec, LINT_OPTS);
      assert.deepEqual(r, { errors: [], warnings: [] }, `${ex.where}: lint`);
    }
  });

  it('the linter catches the known failure modes', () => {
    const els = {
      page: { type: 'Stack', props: { gap: 16 }, children: ['t', 'sw', 'cc', 'nav', 'tg', 'ic', 'b'] },
      t: { type: 'Text', props: { text: 'Hello' } },
      sw: openUItoSpec('x = Text("h2", "Revenue")').elements.x,
      cc: { type: 'ChartCard', props: { title: 'Revenue' } },
      nav: { type: 'Sidebar', props: { sections: ['t'] } },
      tg: { type: 'Toggle', props: { label: 'Email notifications' } },
      ic: { type: 'Icon', props: { name: 'star' } },
      b: { type: 'Button', props: { label: 'Open', trigger: 'nope' } },
      stray: { type: 'Divider' },
    };
    const r = lintSpec({ theme: 'paper', root: 'page', elements: els }, LINT_OPTS);
    const all = r.errors.concat(r.warnings).join('\n');
    for (const needle of ['unknown theme "paper"', 'Text reads "content", not "text"', 'content and tag are swapped', 'renders "No data"', 'takes data objects', 'use Switch', 'hosted MCP rejects', 'gap is a 0-6 token', 'trigger "nope"', 'stray (Divider): unknown type', 'not reachable']) {
      assert.ok(all.includes(needle), `lint should report: ${needle}\n${all}`);
    }
  });

  it('html examples use only classes daub.css defines', () => {
    const css = read('daub.css');
    for (const b of BLOCKS.filter(b => b.lang === 'html')) {
      for (const m of b.body.matchAll(/class="([^"]*)"/g)) {
        for (const cls of m[1].split(/\s+/).filter(c => c.startsWith('db-'))) {
          assert.ok(new RegExp('\\.' + cls.replace(/[-]/g, '\\-') + '(?![\\w-])').test(css), `${where(b)}: .${cls} not in daub.css`);
        }
      }
    }
  });

  it('block files named in the docs exist', () => {
    for (const d of DOCS) {
      for (const m of d.text.matchAll(/['"`/]([a-z0-9-]+\/[a-z0-9-]+-\d\d\.json)/g)) {
        assert.ok(existsSync(join(ROOT, 'blocks', m[1])), `${d.file}: blocks/${m[1]} does not exist`);
      }
    }
  });

  it('theme names in examples and prose exist', () => {
    for (const ex of EXAMPLES) if (ex.spec.theme) assert.ok(S.themes.includes(ex.spec.theme), `${ex.where}: theme ${ex.spec.theme}`);
    for (const d of DOCS) {
      for (const m of d.text.matchAll(/data-theme="([\w-]+)"|setTheme\('([\w-]+)'\)|setFamily\('([\w-]+)'\)/g)) {
        if (m[3]) assert.ok(S.families[m[3]], `${d.file}: family ${m[3]}`);
        else assert.ok(S.themes.includes(m[1] || m[2]), `${d.file}: theme ${m[1] || m[2]}`);
      }
    }
  });
});

// ---- browser render ---------------------------------------------------------------

async function loadChromium() {
  const spec = process.env.PLAYWRIGHT_MODULE || 'playwright';
  try {
    const mod = await import(isAbsolute(spec) ? pathToFileURL(spec).href : spec);
    return mod.chromium || (mod.default && mod.default.chromium);
  } catch { return null; }
}

const LUCIDE_VERSION = /lucide@([\d.]+)\//.exec(read('functions/api/mcp.js'))[1];
async function lucideSource() {
  const cands = [process.env.DAUB_LUCIDE, join(ROOT, `test-results/combo-audit/vendor/lucide-${LUCIDE_VERSION}.min.js`), join(ROOT, `test-results/skill/lucide-${LUCIDE_VERSION}.min.js`)];
  for (const c of cands) if (c && existsSync(c)) return readFileSync(c);
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/lucide@${LUCIDE_VERSION}/dist/umd/lucide.min.js`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(join(ROOT, 'test-results/skill'), { recursive: true });
    writeFileSync(join(ROOT, `test-results/skill/lucide-${LUCIDE_VERSION}.min.js`), buf);
    return buf;
  } catch { return null; }
}

const SHELL = `<!doctype html><html data-theme="light"><head><meta charset="utf-8">
<link rel="stylesheet" href="http://daub.test/daub.css"><script src="http://daub.test/__lucide.js"></script>
</head><body><div id="app"></div>
<script src="http://daub.test/daub.js"></script><script src="http://daub.test/daub-render.js"></script>
</body></html>`;
const MIME = { '.css': 'text/css', '.js': 'application/javascript' };

describe('daub-ui skill: examples render in a browser', () => {
  let browser, context, lucide, skip = null;

  before(async () => {
    const chromium = await loadChromium();
    if (!chromium) { skip = 'playwright not installed'; return; }
    try { browser = await chromium.launch(); } catch (e) { skip = 'chromium did not launch: ' + e.message.split('\n')[0]; return; }
    lucide = await lucideSource();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.host !== 'daub.test') return route.abort();
      if (url.pathname === '/__lucide.js') return route.fulfill({ contentType: MIME['.js'], body: lucide || '/* lucide unavailable */' });
      const abs = normalize(join(ROOT, url.pathname));
      if (!abs.startsWith(ROOT) || !existsSync(abs)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: MIME[extname(abs)] || 'text/plain', body: readFileSync(abs) });
    });
  });

  after(async () => { if (browser) await browser.close(); });

  async function render(spec) {
    const page = await context.newPage();
    const logs = [];
    page.on('console', m => logs.push(m.text()));
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await page.setContent(SHELL, { waitUntil: 'load' });
    const report = await page.evaluate(spec => {
      document.documentElement.dataset.theme = spec.theme || 'light';
      const app = document.getElementById('app');
      const root = renderElement(spec.elements, spec.root, 0);
      if (root) app.appendChild(root);
      for (const id in spec.elements) {
        if (!app.querySelector('[data-spec-id="' + CSS.escape(id) + '"]')) app.appendChild(renderElement(spec.elements, id, 0));
      }
      DAUB.init();
      const hasLucide = typeof lucide !== 'undefined' && !!lucide.icons;
      if (hasLucide) lucide.createIcons();
      const icons = [];
      (function scan(v) {
        if (Array.isArray(v)) return v.forEach(scan);
        if (v && typeof v === 'object') for (const k in v) (k === 'icon' && typeof v[k] === 'string' ? icons.push(v[k]) : scan(v[k]));
      })(Object.values(spec.elements).map(e => e.props));
      Object.values(spec.elements).forEach(e => { if (e.type === 'Icon' && e.props) icons.push(e.props.name); });
      const known = n => { const k = String(n).toLowerCase(), a = ICON_ALIASES[k] || n; return k === 'google' || !/[a-z]/.test(k) || !!(lucide.icons[lucideKey(a)] || lucide.icons[lucideKey(k)]); };
      return {
        rootHeight: root ? root.getBoundingClientRect().height : 0,
        unknownTypes: [...app.querySelectorAll('.db-alert__title')].map(n => n.textContent).filter(t => t.startsWith('Unknown: ')),
        renderErrors: [...app.querySelectorAll('[data-render-error]')].map(n => n.getAttribute('data-render-error')),
        missingIcons: hasLucide ? icons.filter(n => !known(n)) : null,
      };
    }, spec);
    report.logs = logs.filter(l => /^\[daub-render\]|^pageerror/.test(l));
    return { page, report };
  }

  it('each spec example renders with no unknown types, render errors or missing icons', async t => {
    if (skip) return t.skip(skip);
    if (!lucide) t.diagnostic('lucide unavailable: icon names not checked');
    for (const ex of EXAMPLES) {
      const { page, report } = await render(ex.spec);
      await page.close();
      assert.ok(report.rootHeight > 0, `${ex.where}: root rendered empty`);
      assert.deepEqual(report.unknownTypes, [], `${ex.where}: unknown types`);
      assert.deepEqual(report.renderErrors, [], `${ex.where}: render errors`);
      assert.deepEqual(report.logs, [], `${ex.where}: renderer warnings`);
      if (report.missingIcons) assert.deepEqual(report.missingIcons, [], `${ex.where}: icon names lucide ${LUCIDE_VERSION} lacks`);
    }
  });

  it('the state wiring snippet in json-render.md drives visibility', async t => {
    if (skip) return t.skip(skip);
    const wiring = BLOCKS.find(b => b.file === 'references/json-render.md' && b.lang === 'js' && b.body.includes('collectStateConfig(spec)'));
    const ex = EXAMPLES.find(e => e.where.startsWith('references/json-render.md') && e.spec.state);
    assert.ok(wiring && ex, 'json-render.md needs the wiring snippet and a state example');
    const { page } = await render(ex.spec);
    const shown = id => page.evaluate(id => getComputedStyle(document.querySelector(`[data-spec-id="${id}"]`)).display !== 'none', id);
    await page.evaluate(([code, spec]) => new Function('spec', 'app', code)(spec, document.getElementById('app')), [wiring.body, ex.spec]);
    assert.equal(await shown('week'), true, 'week visible at start');
    assert.equal(await shown('month'), false, 'month hidden at start');
    await page.click('[data-spec-id="show-month"]');
    assert.equal(await shown('week'), false, 'week hidden after click');
    assert.equal(await shown('month'), true, 'month visible after click');
    await page.close();
  });
});
