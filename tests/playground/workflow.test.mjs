import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { COMP_PROPS, COMP_CATEGORIES, VALID_TYPES } from '../../mcp/lib/prompt.js';

const root = resolve('.');
const spec = {
  root: 'title',
  theme: 'bone',
  elements: { title: { type: 'Text', props: { content: 'Restored preview' } } },
};
let browser;
let server;
let base;

before(async () => {
  server = createServer(async (req, res) => {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    try {
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true, timeout: 15000,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? undefined : process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
});

async function open(t, { savedSpec = null, width = 1440, query = '' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  t.after(() => context.close());
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (!url.startsWith(base) || url.includes('/api/')) return route.abort();
    return route.continue();
  });
  await context.addInitScript((value) => {
    if (window !== window.top) return;
    localStorage.setItem('isolation-secret', 'parent-only');
    if (value) sessionStorage.setItem('pg-current-spec', JSON.stringify(value));
    window.__workflowPostToPreview = message => document.querySelector('#pg-preview-frame').contentWindow.postMessage(message, '*');
  }, savedSpec);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(base + '/playground.html' + query);
  return page;
}

test('restores the preview after iframe readiness', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.frameLocator('#pg-preview-frame').getByText('Restored preview', { exact: true }).waitFor({ timeout: 3000 });
});

test('shared lexical state survives independent chunks in preview and downloaded HTML', async t => {
  const page = await open(t, { savedSpec: { root: 'root', elements: {
    root: { type: 'Stack', children: ['next', '_shared_state', 'render', 'events'] },
    next: { type: 'Button', props: { label: 'Next' } },
    _shared_state: { type: 'CustomHTML', props: { js: 'const questions = ["First question", "Second question"]; let currentQuestion = 0;' } },
    render: { type: 'CustomHTML', props: { js: 'const button = preview.querySelector("[data-spec-id=next]"); button.textContent = questions[currentQuestion];' } },
    events: { type: 'CustomHTML', props: { js: 'const button = preview.querySelector("[data-spec-id=next]"); button.addEventListener("click", () => { currentQuestion++; button.textContent = questions[currentQuestion]; });' } }
  } } });
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.getByRole('button', { name: 'First question' }).click();
  await frame.getByRole('button', { name: 'Second question' }).waitFor();
  const pending = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await pending).path(), 'utf8');
  await page.setContent(html);
  await page.getByRole('button', { name: 'First question' }).click();
  await page.getByRole('button', { name: 'Second question' }).waitFor();
});

test('preview health reports initialization and interaction exceptions', async t => {
  const page = await open(t, { savedSpec: { root: 'code', elements: {
    code: { type: 'CustomHTML', props: { html: '<button>Run</button>', js: 'container.querySelector("button").onclick = () => { throw new Error("interaction failed"); }; throw new Error("initialization failed");' } }
  } } });
  await page.frameLocator('#pg-preview-frame').getByRole('button', { name: 'Run' }).click();
  const errors = await page.evaluate(() => new Promise(resolve => {
    const frame = document.querySelector('#pg-preview-frame').contentWindow;
    const requestId = 'health-regression';
    function receive(event) {
      if (event.source !== frame || event.data?.type !== 'health' || event.data.requestId !== requestId) return;
      window.removeEventListener('message', receive);
      resolve(event.data.errors);
    }
    window.addEventListener('message', receive);
    window.__workflowPostToPreview({ type: 'health', requestId });
  }));
  assert.ok(errors.some(error => error.includes('initialization failed')), JSON.stringify(errors));
  assert.ok(errors.some(error => error.includes('interaction failed')), JSON.stringify(errors));
});

test('HTML export preserves dollar replacement patterns in generated JavaScript', async t => {
  const code = 'const tokens = ["$&", "$`", "$\'", "$$"]; container.querySelector("button").onclick = () => { container.querySelector("output").textContent = tokens.join("|") + " $" + 12; };';
  const page = await open(t, { savedSpec: { root: 'code', elements: {
    code: { type: 'CustomHTML', props: { html: '<button>Calculate</button><output></output>', js: code } }
  } } });
  const pending = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await pending).path(), 'utf8');
  await page.setContent(html);
  await page.getByRole('button', { name: 'Calculate' }).click();
  assert.equal(await page.locator('output').textContent(), "$&|$`|$'|$$ $12");
});

test('legacy behavior merged into native props still runs in preview and export', async t => {
  const page = await open(t, { savedSpec: { root: 'next', elements: {
    next: { type: 'Button', props: { label: 'First question', js: 'container.onclick = () => { container.textContent = "Second question"; };' } }
  } } });
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.getByRole('button', { name: 'First question' }).click();
  await frame.getByRole('button', { name: 'Second question' }).waitFor();
  const pending = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await pending).path(), 'utf8');
  await page.setContent(html);
  await page.getByRole('button', { name: 'First question' }).click();
  await page.getByRole('button', { name: 'Second question' }).waitFor();
});

test('text-only composer keeps Stop usable and attachment controls hidden across panel widths', async t => {
  const page = await open(t);
  await page.addScriptTag({ content: await readFile(resolve(root, 'assets/lucide.min.js'), 'utf8') });
  await page.evaluate(() => lucide.createIcons());
  for (const panelWidth of [180, 220, 260, 280, 300, 340, 360, 460]) {
    await page.evaluate(width => {
      document.querySelector('.pg-grid').style.gridTemplateColumns = width + 'px 6px 1fr';
    }, panelWidth);
    for (const generating of [false, true]) {
      await page.evaluate(active => {
        document.querySelector('#pg-stop-btn').style.display = active ? 'inline-flex' : 'none';
        document.querySelector('#pg-send-hint').style.display = active ? 'none' : '';
      }, generating);
      const state = await page.locator('.pg-chat__input-wrap').evaluate(wrap => {
        const box = wrap.getBoundingClientRect();
        const contentWidth = wrap.clientWidth;
        const buttons = [...wrap.querySelectorAll('.pg-chat__attach-btn, #pg-stop-btn')].filter(el => getComputedStyle(el).display !== 'none');
        return {
          contentWidth,
          labels: buttons.map(el => el.textContent.trim()),
          icons: buttons.map(el => {
            const icon = el.querySelector('svg');
            return { visible: getComputedStyle(icon).display !== 'none', width: icon.getBoundingClientRect().width, expected: parseFloat(icon.style.width) };
          }),
          clipped: buttons.some(el => {
            const rect = el.getBoundingClientRect();
            return rect.left < box.left || rect.right > box.right || el.scrollWidth > el.clientWidth;
          }),
          overlap: buttons.some((el, i) => buttons.slice(i + 1).some(other => {
            const a = el.getBoundingClientRect(), b = other.getBoundingClientRect();
            return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          })),
          hintVisible: getComputedStyle(wrap.querySelector('#pg-send-hint')).display !== 'none'
        };
      });
      assert.deepEqual(state.labels, generating ? ['Stop'] : []);
      for (const id of ['pg-attach-img', 'pg-attach', 'pg-weblook', 'pg-figma']) {
        assert.equal(await page.locator('#' + id).isVisible(), false);
        assert.equal(await page.locator('#' + id).isDisabled(), true);
      }
      assert.equal(state.clipped, false, JSON.stringify({ panelWidth, generating, state }));
      assert.equal(state.overlap, false);
      assert.equal(state.hintVisible, !generating && state.contentWidth > 260);
      for (const icon of state.icons) {
        assert.equal(icon.visible, state.contentWidth > 320);
        if (icon.visible) assert.equal(icon.width, icon.expected);
      }
    }
  }
});

test('the retained JSON prompt exposes all canonical props and supported types', async (t) => {
  const page = await open(t);
  const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('var COMP_PROPS ='), html.indexOf('// ---- OpenUI Lang system prompt'));
  const prompt = await page.evaluate(source => new Function('RENDERERS', 'DAUB', source + ';return SYSTEM_PROMPT;')(window.RENDERERS, window.DAUB), source);
  for (const type of VALID_TYPES) assert.ok(prompt.includes('- ' + type + ': { ' + COMP_PROPS[type] + ' }'), type + ' props missing from prompt');
  assert.deepEqual(await page.evaluate(() => Object.keys(window.RENDERERS)), VALID_TYPES);
});

test('the OpenUI prompt exposes canonical props in parser positional order', async (t) => {
  const page = await open(t);
  const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('var OPENUI_SYSTEM_PROMPT ='), html.indexOf('// ---- Output format toggle'));
  const prompt = await page.evaluate(({ source, props, categories }) => {
    const build = new Function('COMP_PROPS', 'COMP_CATEGORIES', 'RENDERERS', 'DAUB', source + ';return OPENUI_SYSTEM_PROMPT;');
    return build(props, categories, window.RENDERERS, window.DAUB);
  }, { source, props: COMP_PROPS, categories: COMP_CATEGORIES });
  const schema = await page.evaluate(() => window.DaubOpenUI.COMP_SCHEMA);
  for (const type of VALID_TYPES) {
    const signature = prompt.split('\n').find(line => line.startsWith('- ' + type + '('));
    assert.ok(signature, type + ' missing from OpenUI prompt');
    for (const match of (COMP_PROPS[type] || '').matchAll(/(?:^|,\s*)(\w+)\s*:/g)) {
      assert.ok(signature.includes(match[1] + ':'), type + '.' + match[1] + ' missing from OpenUI prompt');
    }
    const args = signature.slice(('- ' + type + '(').length, -1);
    const parts = [];
    let depth = 0, start = 0;
    for (let index = 0; index <= args.length; index++) {
      const character = args[index];
      if (['(', '[', '{'].includes(character)) depth++;
      else if ([')', ']', '}'].includes(character)) depth--;
      else if ((character === ',' && depth === 0) || index === args.length) { parts.push(args.slice(start, index).trim()); start = index + 1; }
    }
    assert.deepEqual(parts.slice(0, (schema[type] || []).length).map(part => /^\w+/.exec(part)?.[0]), schema[type] || [], type + ' positional order');
  }
});

const addedTypes = {
  CheckboxGroup: { props: { label: 'Permissions', helper: 'Select access', inline: true }, className: 'db-checkbox-group', children: ['checkbox'] },
  Fieldset: { props: { legend: 'Contact details', helper: 'Workspace account', disabled: true }, className: 'db-fieldset', children: ['input'] },
  Frame: { props: { header: 'Profile header', footer: 'Profile footer', flush: true }, className: 'db-frame', children: ['text'] },
  Group: { props: { label: 'Formatting', attached: true, vertical: true }, className: 'db-group', children: ['toggle'] },
  Meter: { props: { label: 'Capacity', value: 15, min: 10, max: 20, status: 'warning' }, className: 'db-meter' },
  NumberField: { props: { label: 'Seats', value: 1, min: 0, max: 2 }, className: 'db-number-field' },
  PreviewCard: { props: { trigger: 'Preview profile', title: 'Sarah Chen', description: 'Design engineer' }, className: 'db-preview-card', children: ['text'] },
  Toolbar: { props: { label: 'Editor tools', vertical: true }, className: 'db-toolbar', children: ['toggle'] },
};

for (const [type, fixture] of Object.entries(addedTypes)) {
  test('JSON editor validates and renders ' + type + ' through the canonical body', async (t) => {
    const page = await open(t);
    const elements = {
      root: { type, props: fixture.props, children: fixture.children || [] },
      checkbox: { type: 'Checkbox', props: { label: 'Edit projects', checked: true } },
      input: { type: 'Input', props: { placeholder: 'Work email', type: 'email' } },
      text: { type: 'Text', props: { content: 'Profile content' } },
      toggle: { type: 'Toggle', props: { label: 'Bold' } },
    };
    const childIds = new Set(fixture.children || []);
    for (const id of Object.keys(elements)) if (id !== 'root' && !childIds.has(id)) delete elements[id];
    await page.locator('[data-tab="structure"]').click();
    await page.locator('#pg-json').fill(JSON.stringify({ root: 'root', elements }));
    await page.locator('#pg-render').click();
    assert.equal(await page.locator('.pg-json-error').isVisible(), false, await page.locator('#pg-json-error-msg').textContent());
    assert.equal(await page.locator('#pg-status').textContent(), 'Rendered');
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')).elements.root.type), type);
    await page.locator('[data-tab="design"]').click();
    const frame = page.frameLocator('#pg-preview-frame');
    const component = frame.locator('[data-spec-id="root"].' + fixture.className);
    await component.waitFor();
    assert.ok(!(await frame.locator('#pg-iframe-root').textContent()).includes('Unknown:'));
    if (type === 'CheckboxGroup') assert.equal(await component.getByRole('checkbox', { name: 'Edit projects' }).isChecked(), true);
    if (type === 'Fieldset') assert.equal(await component.locator('input').isDisabled(), true);
    if (type === 'Frame') assert.equal(await component.locator('.db-frame__footer').textContent(), 'Profile footer');
    if (type === 'Group') assert.equal(await component.getAttribute('aria-label'), 'Formatting');
    if (type === 'Meter') assert.equal(await component.getAttribute('aria-valuenow'), '15');
    if (type === 'NumberField') {
      await page.screenshot();
      await component.getByRole('button', { name: 'Increase seats', exact: true }).click();
      assert.equal(await component.getByRole('spinbutton', { name: 'Seats', exact: true }).inputValue(), '2');
      assert.equal(await component.getByRole('button', { name: 'Increase seats', exact: true }).isDisabled(), true);
    }
    if (type === 'PreviewCard') assert.equal(await component.locator('.db-preview-card__title').textContent(), 'Sarah Chen');
    if (type === 'Toolbar') assert.equal(await component.getAttribute('aria-orientation'), 'vertical');
  });
}

test('JSON editor renders canonical Link, Icon, and Image props', async (t) => {
  const page = await open(t);
  await page.locator('[data-tab="structure"]').click();
  await page.locator('#pg-json').fill(JSON.stringify({ root: 'root', elements: {
    root: { type: 'Stack', children: ['link', 'icon', 'image'] },
    link: { type: 'Link', props: { label: 'Documentation', href: '/docs.html' } },
    icon: { type: 'Icon', props: { name: 'check', size: 'xl' } },
    image: { type: 'Image', props: { src: '/og-image.png', alt: 'DAUB library', width: 160 } },
  } }));
  await page.locator('#pg-render').click();
  assert.equal(await page.locator('.pg-json-error').isVisible(), false);
  await page.locator('[data-tab="design"]').click();
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.getByRole('link', { name: 'Documentation' }).getAttribute('href'), '/docs.html');
  assert.equal(await frame.locator('[data-spec-id="icon"]').evaluate((el) => el.style.width), '32px');
  await frame.getByRole('img', { name: 'DAUB library' }).waitFor();
  assert.equal(await frame.getByRole('img', { name: 'DAUB library' }).evaluate((el) => el.naturalWidth > 0), true);
});

test('client validation rejects types outside the canonical registry', async (t) => {
  const page = await open(t);
  await page.locator('[data-tab="structure"]').click();
  for (const type of ['UnsupportedType', 'constructor']) {
    await page.locator('#pg-json').fill(JSON.stringify({ root: 'root', elements: { root: { type } } }));
    await page.locator('#pg-render').click();
    assert.equal(await page.locator('.pg-json-error').isVisible(), true);
    assert.ok((await page.locator('#pg-json-error-msg').textContent()).includes('Unknown type "' + type + '"'));
  }
});

test('exports canonical Frame slots and working NumberField controls', async (t) => {
  const frameSpec = {
    root: 'frame', elements: {
      frame: { type: 'Frame', props: { header: ['heading'], footer: ['footer'] }, children: ['seats'] },
      heading: { type: 'Text', props: { content: 'Team settings' } },
      seats: { type: 'NumberField', props: { label: 'Seats', value: 1, min: 0, max: 2 } },
      footer: { type: 'Toolbar', props: { label: 'Settings actions' }, children: ['save'] },
      save: { type: 'Button', props: { label: 'Save settings' } },
    },
  };
  const page = await open(t, { savedSpec: frameSpec });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await downloadPromise).path(), 'utf8');
  await page.setContent(html);
  await page.getByRole('button', { name: 'Increase seats', exact: true }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Seats', exact: true }).inputValue(), '2');
  assert.equal(await page.locator('[data-spec-id="heading"]').count(), 1);
  assert.equal(await page.locator('[data-spec-id="footer"]').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Save settings', exact: true }).count(), 1);
});

test('edits JSON, persists the rendered spec, and reports invalid specs', async (t) => {
  const page = await open(t);
  await page.locator('[data-tab="structure"]').click();
  assert.equal(await page.locator('#pg-json').isVisible(), true);
  const edited = structuredClone(spec);
  edited.elements.title.props.content = 'Edited title';
  await page.locator('#pg-json').fill(JSON.stringify(edited));
  await page.locator('#pg-render').click();
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')).elements.title.props.content), 'Edited title');
  await page.locator('#pg-json').fill('{}');
  await page.locator('#pg-render').click();
  assert.equal(await page.locator('.pg-json-error').isVisible(), true);
  assert.notEqual(await page.locator('#pg-status').textContent(), 'Rendered');
});

test('keeps mobile preview, navigation, and toolbar inside the viewport', async (t) => {
  const page = await open(t, { savedSpec: spec, width: 320 });
  await page.locator('[data-panel="preview"]').click();
  await page.locator('[data-viewport="mobile"]').click();
  const bounds = await page.locator('#pg-preview-frame').boundingBox();
  assert.ok(bounds.width <= 320 && bounds.x + bounds.width <= 320, JSON.stringify(bounds));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.locator('#pg-download').isVisible(), true);
  const download = await page.locator('#pg-download').boundingBox();
  assert.ok(download.x + download.width <= 320, JSON.stringify(download));
});

test('keeps the JSON editor full width after switching from mobile preview', async (t) => {
  const page = await open(t, { savedSpec: spec, width: 390 });
  await page.locator('[data-panel="preview"]').click();
  await page.locator('[data-viewport="mobile"]').click();
  await page.locator('[data-tab="structure"]').click();
  const editor = await page.locator('#pg-json').boundingBox();
  assert.ok(editor.width >= 370, JSON.stringify(editor));
});

test('keeps the theme switcher clear of phone navigation', async (t) => {
  const page = await open(t, { savedSpec: spec, width: 320 });
  await page.locator('[data-panel="preview"]').click();
  const theme = await page.locator('.db-theme-switcher').boundingBox();
  const nav = await page.locator('.pg-bottom-tabs').boundingBox();
  assert.ok(theme.y + theme.height <= nav.y, JSON.stringify({ theme, nav }));
});

test('clears stale code when starting a new chat', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.locator('[data-tab="code"]').click();
  assert.ok((await page.locator('#pg-code-view').textContent()).includes('Restored preview'));
  await page.locator('#pg-new-chat').click();
  assert.equal(await page.locator('#pg-code-view').textContent(), '');
});

test('shows clipboard failures without an unhandled rejection', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied')) }, configurable: true }));
  await page.locator('[data-tab="structure"]').click();
  await page.locator('#pg-copy-json').click();
  await page.getByText('Could not copy. Check clipboard permissions.', { exact: true }).waitFor({ timeout: 2000 });
  assert.deepEqual(errors, []);
});

test('downloads HTML with custom JavaScript and declarative state', async (t) => {
  const interactive = {
    root: 'counter', state: { count: 1 },
    elements: {
      counter: { type: 'CustomHTML', props: { html: '<button id="export-counter">Count</button>', js: 'container.querySelector("button").addEventListener("click", function(e) { e.target.textContent = "Clicked"; });' } },
    },
  };
  const page = await open(t, { savedSpec: interactive });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const download = await downloadPromise;
  const html = await readFile(await download.path(), 'utf8');
  assert.ok(html.includes('__initDaubState'), 'export must include the state runtime');
  await page.setContent(html);
  await page.locator('#export-counter').click();
  assert.equal(await page.locator('#export-counter').textContent(), 'Clicked');
  assert.equal(await page.evaluate(() => window.__daubState._state.count), 1);
});

test('legacy React URLs retain the vanilla composer and route generation to the quick prototype', async (t) => {
  const page = await open(t, { query: '?react-chat&design=direct' });
  const stages = [];
  await page.route('**/api/choose', route => {
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { model: 'fixture-jev', scores: Object.fromEntries(Object.keys(body.components).map(key => [key, 0.1])) } });
  });
  await page.route('**/api/generate', async route => {
    stages.push(route.request().postDataJSON().response_format?.json_schema?.name);
    await route.fulfill({ status: 429, json: { error: 'Fixture quota exceeded' } });
  });
  assert.equal(await page.locator('#pg-prompt').isVisible(), true);
  assert.equal(await page.locator('#pg-chat-mount, #pg-generation-mode').count(), 0);
  assert.equal(await page.evaluate(() => typeof window.__playgroundBridge), 'undefined');
  assert.equal(await page.locator('script[src*="index.playground-chat.js"]').count(), 0);
  await page.locator('#pg-prompt').fill('Build a title');
  await page.locator('#pg-prompt').press('Enter');
  await page.waitForFunction(() => window.__prototypeLastRun);
  assert.deepEqual(stages, ['playground_prototype']);
  assert.equal(await page.evaluate(() => window.__prototypeLastRun.reason), 'provider-error');
  assert.equal(await page.evaluate(() => window.__prototypeLastRun.requests), 1);
  assert.match(await page.evaluate(() => window.__prototypeLastRun.error), /429|quota/i);
  assert.equal(await page.locator('#pg-chat-messages .pg-result-meta').innerText(), 'Provider limit reached: Fixture quota exceeded');
  await page.locator('#pg-stop-btn').waitFor({ state: 'hidden' });
});

test('exposes accessible editor, prompt, preview, and keyboard tabs', async (t) => {
  const page = await open(t);
  assert.equal(await page.locator('#pg-prompt').getAttribute('aria-label'), 'Describe a UI');
  assert.equal(await page.locator('#pg-preview-frame').getAttribute('title'), 'UI preview');
  await page.locator('[data-tab="design"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-tab="structure"]').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#pg-json').getAttribute('aria-label'), 'UI specification JSON');
});

test('copies an edited share spec and runnable HTML', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.evaluate(() => {
    window.copied = [];
    window.LZString = { compressToEncodedURIComponent: encodeURIComponent };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (text) => { window.copied.push(text); return Promise.resolve(); } }, configurable: true });
  });
  await page.locator('[data-tab="structure"]').click();
  const edited = structuredClone(spec);
  edited.elements.title.props.content = 'Shared edit';
  await page.locator('#pg-json').fill(JSON.stringify(edited));
  await page.locator('#pg-render').click();
  await page.locator('[data-tab="design"]').click();
  await page.locator('#pg-share').click();
  const url = new URL(await page.evaluate(() => window.copied[0]));
  assert.ok(url.hash.startsWith('#s='));
  assert.equal(JSON.parse(decodeURIComponent(url.hash.slice(3))).elements.title.props.content, 'Shared edit');
  await page.locator('[data-tab="code"]').click();
  await page.locator('#pg-copy-html').click();
  assert.ok((await page.evaluate(() => window.copied[1])).startsWith('<!DOCTYPE html>'));
});

test('exports the preview theme and scheme chosen after rendering', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.evaluate(() => {
    DAUB.setTheme('dracula');
  });
  await page.frameLocator('#pg-preview-frame').locator('html[data-theme="dracula"]').waitFor();
  await page.evaluate(() => DAUB.setScheme('dark'));
  await page.frameLocator('#pg-preview-frame').locator('html[data-scheme="dark"]').waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await downloadPromise).path(), 'utf8');
  await page.setContent(html);
  await page.locator('[data-spec-id="title"]').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dracula');
  assert.equal(await page.locator('html').getAttribute('data-scheme'), 'dark');
});

test('ignores forged HTML messages from the parent window', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.evaluate(() => window.postMessage({ type: 'html', data: '<p>Forged</p>' }, '*'));
  await page.locator('[data-tab="code"]').click();
  assert.ok(!(await page.locator('#pg-code-view').textContent()).includes('Forged'));
});

test('isolates custom JavaScript from parent storage and DOM while retaining local behavior', async (t) => {
  const isolated = {
    root: 'custom', state: { enabled: true },
    elements: { custom: { type: 'CustomHTML', props: {
      html: '<button id="isolated-button">Run</button><output id="isolation-result"></output>',
      js: 'var result = {}; try { result.storage = parent.localStorage.getItem("isolation-secret"); } catch (error) { result.storage = error.name; } try { result.dom = parent.document.querySelector("#pg-prompt").id; } catch (error) { result.dom = error.name; } container.querySelector("output").textContent = JSON.stringify(result); container.querySelector("button").onclick = function(e) { e.target.textContent = "Local JS works"; };',
    } } },
  };
  const page = await open(t, { savedSpec: isolated });
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.locator('#isolation-result').waitFor();
  const result = JSON.parse(await frame.locator('#isolation-result').textContent());
  assert.deepEqual(result, { storage: 'SecurityError', dom: 'SecurityError' });
  await frame.locator('#isolated-button').click();
  assert.equal(await frame.locator('#isolated-button').textContent(), 'Local JS works');
  assert.equal(await page.locator('#pg-preview-frame').evaluate((el) => el.contentDocument), null);
});

test('supports highlight and unhighlight messages without parent DOM access', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const title = page.frameLocator('#pg-preview-frame').locator('[data-spec-id="title"]');
  await title.waitFor();
  await page.evaluate(() => window.__workflowPostToPreview({ type: 'highlight', elements: ['title'] }));
  await title.locator('xpath=self::*[contains(@class,"db-skeleton")]').waitFor();
  await page.evaluate(() => window.__workflowPostToPreview({ type: 'unhighlight', elements: ['title'] }));
  await title.locator('xpath=self::*[contains(@class,"db-skeleton")]').waitFor({ state: 'hidden' });
});

test('rejects a forged render message from the preview window itself', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => window.postMessage({ type: 'render', html: '<p>Forged preview</p>' }, '*'));
  await page.locator('[data-tab="structure"]').click();
  await page.locator('[data-tab="design"]').click();
  assert.equal(await preview.locator('[data-spec-id="title"]').textContent(), 'Restored preview');
});

test('accepts screenshot replies only from the expected opaque preview', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => {
    window.html2canvas = () => new Promise((resolve) => setTimeout(() => resolve({ toDataURL: () => 'data:image/jpeg;base64,preview' }), 30));
  });
  const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('function capturePreview(options)'), html.indexOf('// ---- SSE response parser'));
  const result = await page.evaluate(async (source) => {
    const capture = new Function('$previewFrame', 'currentSpec', 'postToPreview', 'var _renderSeq = 0;' + source + ';return capturePreview();');
    const pending = capture(document.querySelector('#pg-preview-frame'), JSON.parse(document.querySelector('#pg-json').value), window.__workflowPostToPreview);
    window.postMessage({ type: 'screenshot', data: 'forged' }, '*');
    return pending;
  }, source);
  assert.equal(result, 'data:image/jpeg;base64,preview');
});

test('uses the screenshot fallback when html2canvas cannot clone an opaque iframe', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => {
    window.html2canvas = () => Promise.reject(new DOMException('Opaque iframe clone', 'SecurityError'));
    window.htmlToImage = { toJpeg: () => Promise.resolve('data:image/jpeg;base64,fallback') };
  });
  const result = await page.evaluate(() => new Promise((resolve) => {
    const frame = document.querySelector('#pg-preview-frame').contentWindow;
    function receive(event) {
      if (event.source !== frame || event.data?.type !== 'screenshot') return;
      window.removeEventListener('message', receive);
      resolve(event.data.data);
    }
    window.addEventListener('message', receive);
    window.__workflowPostToPreview({ type: 'screenshot' });
  }));
  assert.equal(result, 'data:image/jpeg;base64,fallback');
});

async function captureGeometry(page, requestId = 'geometry-test') {
  return page.evaluate((requestId) => new Promise((resolve, reject) => {
    const frame = document.querySelector('#pg-preview-frame').contentWindow;
    const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('Capture timeout')); }, 5000);
    function receive(event) {
      if (event.source !== frame || event.data?.type !== 'screenshot' || event.data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      resolve(event.data);
    }
    window.addEventListener('message', receive);
    window.__workflowPostToPreview({ type: 'screenshot', geometry: true, requestId });
  }), requestId);
}

test('captures bounded layout geometry with hierarchy, box model and scroll coordinates', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => {
    document.getElementById('pg-iframe-root').innerHTML = '<div data-spec-id="grid" style="display:grid;grid-template-columns:100px 120px;gap:12px;padding:8px;border:2px solid;width:248px;box-sizing:border-box"><div data-spec-id="a" style="height:40px;overflow:hidden"><div style="width:150px">A</div></div><div data-spec-id="b" style="height:40px">B</div></div><div style="height:2000px"></div>';
    window.scrollTo(0, 10);
    window.html2canvas = () => Promise.resolve({ width: 600, height: 2100, toDataURL: () => 'data:image/jpeg;base64,geometry' });
  });
  const capture = await captureGeometry(page);
  assert.equal(capture.requestId, 'geometry-test');
  assert.equal(capture.geometry.units, 'css-px');
  assert.equal(capture.geometry.stable, true);
  assert.equal(capture.geometry.viewport.scrollY, 10);
  const [grid, a, b] = capture.geometry.elements;
  assert.equal(grid.id, 'grid');
  assert.equal(grid.bounds.width, 248);
  assert.deepEqual(grid.padding, [8, 8, 8, 8]);
  assert.deepEqual(grid.border, [2, 2, 2, 2]);
  assert.equal(grid.layout.columnGap, '12px');
  assert.equal(a.parentId, 'grid');
  assert.equal(b.bounds.x - a.bounds.x - a.bounds.width, 12);
  assert.equal(a.overflow.x, true);
  assert.equal(grid.bounds.y, 16);
  assert.equal(capture.geometry.capture.bounds.y, 0);
});

test('geometry reports transformed and hidden elements and caps large previews on mobile', async (t) => {
  const page = await open(t, { savedSpec: spec, width: 390 });
  await page.locator('[data-panel="preview"]').click();
  await page.locator('[data-viewport="mobile"]').click();
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => {
    const root = document.getElementById('pg-iframe-root');
    root.innerHTML = '<div data-spec-id="scaled" style="width:100px;height:20px;transform:scale(1.5)"></div><div data-spec-id="hidden" style="display:none"></div>' + Array.from({ length: 100 }, (_, i) => '<div data-spec-id="item-' + i + '"></div>').join('');
    window.htmlToImage = { toJpeg: () => Promise.resolve('data:image/jpeg;base64,fallback') };
    window.html2canvas = () => Promise.reject(new Error('Fallback'));
  });
  const capture = await captureGeometry(page);
  assert.equal(capture.data, 'data:image/jpeg;base64,fallback');
  assert.equal(capture.geometry.capture.backend, 'html-to-image');
  assert.equal(capture.geometry.totalElements, 102);
  assert.equal(capture.geometry.elements.length, 80);
  assert.equal(capture.geometry.truncated, true);
  assert.equal(capture.geometry.elements[0].bounds.width, 150);
  assert.equal(capture.geometry.elements[1].rendered, false);
  assert.ok(capture.geometry.viewport.width <= 390);
});

test('marks geometry unstable when layout changes during screenshot capture', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => {
    window.html2canvas = () => {
      document.querySelector('[data-spec-id="title"]').style.padding = '100px';
      return Promise.resolve({ toDataURL: () => 'data:image/jpeg;base64,changed' });
    };
  });
  const capture = await captureGeometry(page);
  assert.equal(capture.geometry.stable, false);
});

test('measured capture correlates replies and rejects obsolete render revisions', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => {
    window.html2canvas = () => Promise.resolve({ toDataURL: () => 'data:image/jpeg;base64,current' });
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'screenshot') parent.postMessage({ type: 'screenshot', requestId: 'wrong', data: 'wrong', geometry: { stable: true } }, '*');
    });
  });
  const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('function capturePreview(options)'), html.indexOf('// ---- SSE response parser'));
  const result = await page.evaluate(async (source) => {
    const build = new Function('$previewFrame', 'currentSpec', 'postToPreview', 'var _renderSeq = 1;' + source + '; return { capturePreview, change: function() { _renderSeq++; } };');
    const controller = build(document.querySelector('#pg-preview-frame'), JSON.parse(document.querySelector('#pg-json').value), window.__workflowPostToPreview);
    const fresh = await controller.capturePreview({ geometry: true });
    const stale = controller.capturePreview({ geometry: true });
    controller.change();
    return { fresh, stale: await stale };
  }, source);
  assert.equal(result.fresh.screenshot, 'data:image/jpeg;base64,current');
  assert.equal(result.fresh.geometry.stable, true);
  assert.equal(result.stale, null);
  await preview.evaluate(() => {
    window.html2canvas = () => {
      document.querySelector('[data-spec-id="title"]').style.padding = '50px';
      return Promise.resolve({ toDataURL: () => 'data:image/jpeg;base64,unstable' });
    };
  });
  const unstable = await page.evaluate((source) => {
    const capture = new Function('$previewFrame', 'currentSpec', 'postToPreview', 'var _renderSeq = 1;' + source + ';return capturePreview({ geometry: true });');
    return capture(document.querySelector('#pg-preview-frame'), JSON.parse(document.querySelector('#pg-json').value), window.__workflowPostToPreview);
  }, source);
  assert.equal(unstable.screenshot, 'data:image/jpeg;base64,unstable');
  assert.equal(unstable.geometry, null);
});

test('SSE errors retain quota and rate-limit status instead of looking like empty JSON', async () => {
  const html = await readFile(resolve(root, 'playground.html'), 'utf8');
  const source = html.slice(html.indexOf('function parseSseResponse(res)'), html.indexOf('// ---- Content integrity guard'));
  const limits = [];
  const parse = new Function('stopForProviderLimit', source + ';return parseSseResponse;')(status => limits.push(Number(status)));
  for (const status of [401, 402, 403, 429]) {
    await assert.rejects(parse(new Response('data: ' + JSON.stringify({ error: { code: status, message: 'Provider failure' } }) + '\n\n')), error => error.status === status);
  }
  assert.deepEqual(limits, [401, 402, 403, 429]);
  const parsed = await parse(new Response('data: invalid\n\ndata: {"choices":[{"delta":{"content":"{}"}}]}\n\ndata: [DONE]\n\n'));
  assert.equal(parsed.content, '{}');
  const truncated = await parse(new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: '{}' }, finish_reason: 'length' }] }) + '\n\n'));
  assert.equal(truncated.finishReason, 'length');
  const refused = await parse(new Response('data: ' + JSON.stringify({ choices: [{ delta: { refusal: 'Declined' }, finish_reason: 'stop' }] }) + '\n\n'));
  assert.equal(refused.refused, true);
  const interrupted = await parse(new Response('data:' + JSON.stringify({ choices: [{ delta: { content: '', reasoning: 'thinking' }, finish_reason: null }] }) + '\n\n'));
  assert.equal(interrupted.completed, false);
  assert.equal(interrupted.content, '');
  const noSpace = await parse(new Response('data:' + JSON.stringify({ choices: [{ delta: { content: '{}' }, finish_reason: 'stop' }] }) + '\n\n'));
  assert.equal(noSpace.completed, true);
  assert.equal(noSpace.content, '{}');
  assert.equal((await parse(new Response('data:[DONE]\n\n'))).completed, true);
});

test('both visual reviewers send measured geometry alongside images and the spec', async () => {
  const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
  const selfSource = html.slice(html.indexOf('function selfCheck('), html.indexOf('// ---- Component picker:'));
  const diffSource = html.slice(html.indexOf('function geometryReviewContext('), html.indexOf('// ---- Interactivity pipeline:'));
  const requests = [];
  const build = new Function('fetch', 'AUTO_MODEL', 'LAYOUT_RULES', 'VALID_TYPES_HINT', 'parseSseResponse', 'cleanJSON', selfSource + diffSource + ';return { selfCheck, visualDiff };');
  const reviewers = build(async (_url, options) => { requests.push(JSON.parse(options.body)); return {}; }, 'test-model', '', '', async () => ({ content: '{}' }), (value) => value);
  const geometry = { units: 'css-px', elements: [{ id: 'title', bounds: { width: 100 } }] };
  await reviewers.selfCheck(spec, 'data:image/jpeg;base64,current', undefined, geometry);
  await reviewers.visualDiff(spec, 'data:image/jpeg;base64,current', 'data:image/jpeg;base64,target', undefined, geometry);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    const content = request.messages[1].content;
    assert.ok(content.some(part => part.text === JSON.stringify(spec)));
    assert.ok(content.some(part => part.text?.includes(JSON.stringify(geometry))));
    assert.ok(content.some(part => part.text?.includes('never the reference image')));
  }
  assert.equal(requests[0].messages[1].content.filter(part => part.type === 'image_url').length, 1);
  assert.equal(requests[1].messages[1].content.filter(part => part.type === 'image_url').length, 2);
});

test('runs chunk tests in the opaque preview and rejects forged test-result replies', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.frameLocator('#pg-preview-frame').locator('[data-spec-id="title"]').waitFor();
  const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('function runChunkTests('), html.indexOf('function reviewAndAssemble('));
  const results = await page.evaluate(async (source) => {
    const run = new Function('postToPreview', source + ';return runChunkTests([{chunkId:"isolated",success:true,elements:[{id:"title",test:"return new Promise(function(resolve) { setTimeout(function() { resolve(); }, 30); });"}]}], 200);');
    const pending = run(window.__workflowPostToPreview);
    window.postMessage({ type: 'testResults', results: [{ chunkId: 'forged', pass: true }] }, '*');
    return pending;
  }, source);
  assert.deepEqual(results, [{ chunkId: 'isolated', pass: true, error: null }]);
});

test('preserves declarative state actions in the opaque preview', async (t) => {
  const stateSpec = {
    root: 'toggle', state: { enabled: false },
    elements: { toggle: { type: 'Button', props: { label: { $cond: { $state: '/enabled' }, $then: 'Enabled', $else: 'Disabled' } }, on: { click: { action: 'toggleState', params: { path: '/enabled' } } } } },
  };
  const page = await open(t, { savedSpec: stateSpec });
  const toggle = page.frameLocator('#pg-preview-frame').getByRole('button', { name: 'Disabled', exact: true });
  await toggle.click();
  await page.frameLocator('#pg-preview-frame').getByRole('button', { name: 'Enabled', exact: true }).waitFor();
});
