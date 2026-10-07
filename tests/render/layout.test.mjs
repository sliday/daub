import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { renderToHTML } from '../../mcp/lib/render.js';
import { DAUB_RENDER_BODY } from '../../mcp/lib/renderers.js';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const require = createRequire(import.meta.url);
const canonical = require('../../daub-render.js');
const source = await readFile(join(root, 'daub-render.js'), 'utf8');
const css = await readFile(join(root, 'daub.css'), 'utf8');
const runtime = await readFile(join(root, 'daub.js'), 'utf8');
const lucide = await readFile(join(root, 'assets/lucide.min.js'));
const image = await readFile(join(root, 'og-image.png'));
const compact = JSON.parse(await readFile(new URL('../fixtures/layout-nested-sidebar.json', import.meta.url), 'utf8'));
const supplied = process.env.DAUB_LAYOUT_SPEC ? JSON.parse(await readFile(process.env.DAUB_LAYOUT_SPEC, 'utf8')) : null;
const specs = [['compact', compact], ...(supplied ? [['supplied', supplied]] : [])];
const widths = [390, 1000, 1480];
const engines = { chromium, firefox, webkit };
const requested = (process.env.DAUB_LAYOUT_ENGINES || 'chromium,firefox,webkit').split(',');
let work;
before(async () => { work = await mkdtemp(join(tmpdir(), 'daub-layout-')); });
after(async () => { if (work) await rm(work, { recursive: true, force: true }); });

test('layout uses the same canonical renderer in MCP exports', () => {
  assert.equal(DAUB_RENDER_BODY, canonical.DAUB_RENDER_BODY);
});
test('supplied layout spec is opt-in through DAUB_LAYOUT_SPEC', { skip: supplied ? false : 'Set DAUB_LAYOUT_SPEC to the original JSON attachment' }, () => {
  assert.equal(supplied.elements.navColumn.type, 'Stack');
  assert.deepEqual(supplied.elements.pageBody.children, ['feedColumn', 'rightRail']);
});

async function routeAssets(page, html) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/layout-test.html') return route.fulfill({ contentType: 'text/html', body: html });
    if (url.pathname === '/daub.css') return route.fulfill({ contentType: 'text/css', body: css });
    if (url.pathname === '/daub.js') return route.fulfill({ contentType: 'text/javascript', body: runtime });
    if (url.pathname === '/daub-render.js') return route.fulfill({ contentType: 'text/javascript', body: source });
    if (url.pathname.includes('lucide')) return route.fulfill({ contentType: 'text/javascript', body: lucide, headers: { 'access-control-allow-origin': '*' } });
    if (url.hostname === 'picsum.photos' || url.pathname === '/og-image.png') return route.fulfill({ contentType: 'image/png', body: image });
    if (url.origin !== 'http://daub.test' || url.pathname.startsWith('/api/')) return route.abort();
    const path = resolve(root, '.' + url.pathname);
    if (!path.startsWith(root + sep)) return route.abort();
    try {
      const contentType = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(path)] || 'application/octet-stream';
      return route.fulfill({ contentType, body: await readFile(path) });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
}

function canonicalHTML(spec) {
  return '<!doctype html><html data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<link rel="stylesheet" href="/daub.css"><style>body{margin:0;padding:16px}</style></head><body><div id="app"></div>'
    + '<script src="/daub-render.js"></script><script src="/daub.js"></script><script src="/assets/lucide.min.js"></script><script>'
    + 'var layoutSpec=' + canonical.serializeSpec(spec) + ';var app=document.getElementById("app");'
    + 'app.appendChild(renderElement(layoutSpec.elements,layoutSpec.root,0));renderOrphans(layoutSpec,app);DAUB.init(app);lucide.createIcons();'
    + '</script></body></html>';
}

async function settle(target) {
  await target.evaluate(async () => {
    await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
    await document.fonts.ready;
    await Promise.race([
      new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))),
      new Promise(done => setTimeout(done, 250)),
    ]);
  });
}

async function geometry(target, ids) {
  return target.evaluate(ids => {
    const boxes = {};
    for (const id of ids) {
      const el = document.querySelector('[data-spec-id="' + id + '"]');
      if (!el) throw new Error('Missing layout element: ' + id);
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      boxes[id] = { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, flex: el.style.flex, display: s.display, gap: parseFloat(s.columnGap) || 0 };
    }
    return { boxes, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth };
  }, ids);
}

function beside(left, right, label) {
  assert.ok(Math.abs(left.y - right.y) < 2 && right.x >= left.right - 1, label + ': ' + JSON.stringify({ left, right }));
}

async function assertLayout(target, width, mode) {
  const g = await geometry(target, ['root', 'navColumn', 'pageBody', 'feedColumn', 'rightRail']);
  const { root: outer, navColumn: nav, pageBody: main, feedColumn: feed, rightRail: rail } = g.boxes;
  assert.equal(g.width, width);
  assert.ok(g.scrollWidth <= width + 1 && g.bodyWidth <= width + 1, 'document overflow: ' + JSON.stringify(g));
  for (const [id, box] of Object.entries(g.boxes)) {
    assert.ok(box.width > 0 && box.x >= -1 && box.right <= width + 1, id + ' outside viewport: ' + JSON.stringify(box));
  }
  if (width >= 1000) beside(nav, main, 'navigation and main must share a desktop row');
  else if (width <= 640) assert.ok(main.y >= nav.bottom, 'mobile main must wrap below navigation');
  if (main.width >= 800) beside(feed, rail, 'feed and rail must share a wide desktop row');
  else assert.ok(rail.y >= feed.bottom, 'narrow main must wrap rail below feed');
  assert.ok(feed.width >= Math.min(300, main.width - 1), 'feed must retain usable width');
  assert.ok(main.right <= outer.right + 1);
  if (width === 1480) beside(feed, rail, mode + ' wide desktop feed/rail');
  const images = await target.locator('[data-spec-id] img, img[data-spec-id]').evaluateAll(images => images.map(img => ({ width: img.getBoundingClientRect().width, natural: img.naturalWidth, right: img.getBoundingClientRect().right })));
  assert.ok(images.length > 0 && images.every(img => img.natural > 0 && img.width > 0 && img.right <= width + 1), 'images must load within viewport');
}

async function assertHelpers(target, spec) {
  const helpers = Object.entries(spec.elements).filter(([, def]) => def.type === 'CustomHTML');
  for (const [id, def] of helpers) {
    const node = target.locator('[data-spec-id="' + id + '"]');
    assert.equal(await node.count(), 1, id);
    if (!String(def.props?.html || '').trim() && !def.children?.length) {
      const state = await node.evaluate(el => ({ display: getComputedStyle(el).display, rects: el.getClientRects().length, flex: el.style.flex }));
      assert.deepEqual(state, { display: 'contents', rects: 0, flex: '' }, id + ' must not consume a flex item or gap');
    }
    if (def.props?.css) assert.equal(await node.locator(':scope > style').textContent(), def.props.css, id + ' CSS');
  }
}

async function assertOrdinaryRows(target, spec) {
  const ids = spec === compact ? ['storyRow', 'actionRow', 'actionGroup', 'toolbar'] : ['storyRow', 'p1header', 'p1actions', 'p1actionIcons'];
  const rows = await target.evaluate(ids => ids.map(id => {
    const row = document.querySelector('[data-spec-id="' + id + '"]');
    return { id, children: [...row.children].filter(el => el.getAttribute('data-spec-id')).map(el => ({ flex: el.style.flex, width: el.getBoundingClientRect().width, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom })) };
  }), ids);
  for (const row of rows) {
    assert.ok(row.children.length >= 2, row.id);
    assert.ok(row.children.every(child => child.flex === '' && child.width < 240), row.id + ' must retain intrinsic item sizing: ' + JSON.stringify(row));
    if (row.id !== 'storyRow') assert.ok(row.children.every(child => child.top < row.children[0].bottom && child.bottom > row.children[0].top), row.id + ' must stay on one row');
  }
}

for (const name of requested) {
  assert.ok(engines[name], 'Unknown DAUB_LAYOUT_ENGINES entry: ' + name);
  const executablePath = process.env['PLAYWRIGHT_' + name.toUpperCase() + '_EXECUTABLE_PATH'];
  describe(name + ' renderer layout', { skip: !existsSync(executablePath || engines[name].executablePath()) ? name + ' is not installed' : false }, () => {
    let browser;
    before(async () => { browser = await engines[name].launch({ headless: true, timeout: 15000, ...(executablePath ? { executablePath } : {}) }); });
    after(async () => { await browser?.close(); });

    async function open(t, html, width) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      t.after(() => page.close());
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await routeAssets(page, html);
      await page.goto('http://daub.test/layout-test.html');
      await settle(page);
      assert.deepEqual(errors, []);
      return page;
    }

    for (const [label, spec] of specs) {
      for (const mode of ['canonical', 'mcp']) {
        for (const width of widths) {
          test(`${mode} ${label}: nested sidebar, columns, helpers and ordinary rows at ${width}px`, async t => {
            const html = mode === 'canonical' ? canonicalHTML(spec) : await readFile(renderToHTML(spec, join(work, `${name}-${label}-${width}.html`)), 'utf8');
            assert.ok(html.includes(canonical.serializeSpec(spec)), 'export must preserve the complete spec, including helper JS');
            const page = await open(t, html, width);
            await assertLayout(page, width, mode);
            await assertHelpers(page, spec);
            await assertOrdinaryRows(page, spec);
            assert.equal(await page.locator('[data-render-error]').count(), 0);
            if (spec === compact) {
              assert.equal(await page.locator('[data-layout-markup]').textContent(), 'Custom markup');
              assert.equal(await page.locator('[data-layout-markup]').evaluate(el => getComputedStyle(el).color), 'rgb(12, 34, 56)');
              assert.equal(await page.locator('[data-spec-id="customChildren"] [data-spec-id="customChild"]').textContent(), 'Rendered child');
              for (const id of ['customMarkup', 'customChildren']) assert.notEqual(await page.locator('[data-spec-id="' + id + '"]').evaluate(el => getComputedStyle(el).display), 'contents');
            }
            if (process.env.DAUB_LAYOUT_SCREENSHOTS) {
              await mkdir(process.env.DAUB_LAYOUT_SCREENSHOTS, { recursive: true });
              await page.screenshot({ path: join(process.env.DAUB_LAYOUT_SCREENSHOTS, `${name}-${mode}-${label}-${width}.png`), fullPage: true });
            }
          });
        }
      }
    }

    for (const columns of [2, 3, 4, 5, 6]) {
      test(`numeric grid ${columns}: intrinsic wide image cannot widen tracks`, async t => {
        const spec = { root: 'grid', elements: {
          grid: { type: 'Grid', props: { columns, gap: 3 }, children: ['image', 'imageCard', ...Array.from({ length: columns - 2 }, (_, i) => 'cell' + i)] },
          imageCard: { type: 'Card', children: ['nestedImage'] },
          image: { type: 'Image', props: { src: '/og-image.png', alt: 'Intrinsic 1200px image' } },
          nestedImage: { type: 'Image', props: { src: '/og-image.png', alt: 'Nested intrinsic 1200px image' } },
          ...Object.fromEntries(Array.from({ length: columns - 2 }, (_, i) => ['cell' + i, { type: 'Text', props: { content: 'Cell ' + i } }])),
        } };
        const page = await open(t, canonicalHTML(spec), 1480);
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          await settle(page);
          const grid = await page.locator('[data-spec-id="grid"]').evaluate(el => {
            const s = getComputedStyle(el);
            return { width: el.clientWidth, gap: parseFloat(s.columnGap), tracks: s.gridTemplateColumns.split(' ').map(Number.parseFloat), scroll: document.documentElement.scrollWidth, children: [...el.children].map(child => ({ width: child.getBoundingClientRect().width, min: getComputedStyle(child).minWidth, max: getComputedStyle(child).maxWidth })), image: el.querySelector('img').naturalWidth };
          });
          const count = width <= 640 ? 1 : width <= 1023 && columns >= 4 ? 2 : columns;
          assert.equal(grid.tracks.length, count, JSON.stringify(grid));
          const expected = (grid.width - grid.gap * (count - 1)) / count;
          assert.ok(grid.tracks.every(track => Math.abs(track - expected) <= 1), 'equal constrained tracks: ' + JSON.stringify(grid));
          assert.ok(grid.children.every(child => child.width <= expected + 1 && child.min === '0px' && child.max === '100%'), 'constrained children: ' + JSON.stringify(grid));
          assert.ok(grid.image >= 1200 && grid.scroll <= width + 1, JSON.stringify(grid));
        }
      });
    }

    test('direct Sidebar with wrap:false retains desktop sibling layout', async t => {
      const spec = structuredClone(compact);
      spec.elements.root.children = ['navSidebar', 'pageBody'];
      spec.elements.root.props.wrap = false;
      delete spec.elements.navColumn;
      delete spec.elements.brand;
      delete spec.elements.search;
      delete spec.elements.scriptOnly;
      delete spec.elements.cssOnly;
      const page = await open(t, canonicalHTML(spec), 1000);
      const g = await geometry(page, ['navSidebar', 'pageBody']);
      beside(g.boxes.navSidebar, g.boxes.pageBody, 'direct sidebar');
      assert.equal(await page.locator('[data-spec-id="root"]').evaluate(el => getComputedStyle(el).flexWrap), 'nowrap');
      assert.ok(g.scrollWidth <= 1001);
    });

    for (const [label, spec] of specs) {
      test(`live Playground ${label}: JSON render, helper preservation and exported layout`, { timeout: 30000 }, async t => {
        const page = await open(t, '<!doctype html>', 1480);
        const helperErrors = [];
        page.on('console', message => { if (message.text().includes('CustomHTML JS error:')) helperErrors.push(message.text().split(/\\n|\n/)[0]); });
        await page.goto('http://daub.test/playground.html');
        await page.locator('[data-tab="structure"]').click();
        await page.locator('#pg-json').fill(JSON.stringify(spec));
        await page.locator('#pg-render').click();
        assert.equal(await page.locator('.pg-json-error').isVisible(), false);
        await page.locator('[data-tab="design"]').click();
        const frame = await page.locator('#pg-preview-frame').contentFrame();
        await frame.locator('[data-spec-id="pageBody"]').waitFor();
        const preview = page.frames().find(frame => frame.url() === 'about:srcdoc');
        assert.ok(preview, 'live preview iframe exists');
        await settle(preview);
        await assertHelpers(preview, spec);
        const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')));
        for (const [id, def] of Object.entries(spec.elements).filter(([, def]) => def.type === 'CustomHTML' && def.props.js)) {
          assert.equal(saved.elements[id].props.js, def.props.js, id + ' JS must survive JSON render');
        }
        if (spec === compact) {
          const action = preview.locator('[data-spec-id="helperAction"]');
          assert.equal(await action.getAttribute('data-helper-ready'), 'yes');
          await action.click();
          assert.equal(await action.getAttribute('data-helper-clicks'), '1');
          assert.deepEqual(helperErrors, []);
        } else if (helperErrors.length) {
          t.diagnostic('Supplied spec JS errors (separate from layout): ' + helperErrors.join(' | '));
        }
        const pendingDownload = page.waitForEvent('download');
        await page.locator('#pg-download').click();
        const download = await pendingDownload;
        const exported = await readFile(await download.path(), 'utf8');
        for (const def of Object.values(spec.elements).filter(def => def.type === 'CustomHTML' && def.props.js)) {
          assert.ok(exported.includes(JSON.stringify(def.props.js).replace(/</g, '\\u003c')), 'download must retain helper JS');
        }
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          if (width <= 1024) await page.locator('.pg-bottom-tabs [data-panel="preview"]').click();
          await settle(preview);
          const frameWidth = await preview.evaluate(() => innerWidth);
          await assertLayout(preview, frameWidth, 'live-playground');
          t.diagnostic(`Live Playground at ${width}px: preview viewport ${frameWidth}px`);
          const output = await open(t, exported, width);
          await assertLayout(output, width, 'playground-export');
          await assertHelpers(output, spec);
          if (spec === compact) {
            await output.locator('[data-spec-id="helperAction"]').click();
            assert.equal(await output.locator('[data-spec-id="helperAction"]').getAttribute('data-helper-clicks'), '1');
          }
        }
      });
    }
  });
}
