import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
let server, browser, base;
before(async () => {
  server = createServer(async (req, res) => {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/')) return res.writeHead(403).end();
    try {
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
});
after(async () => { await browser?.close(); if (server?.listening) await new Promise(done => server.close(done)); });

const layout = { root: 'page', elements: { page: { type: 'Stack', props: { direction: 'vertical' }, children: ['stories'] }, stories: { type: 'Stack', props: { direction: 'horizontal', wrap: false }, children: [] } } };
const patch = { root: 'stories', elements: { stories: { type: 'Stack', props: { direction: 'horizontal', wrap: false }, children: ['maya', 'jonas'] }, maya: { type: 'Avatar', props: { initials: 'MC' } }, jonas: { type: 'Avatar', props: { initials: 'JW' } } } };
async function open(t, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  t.after(() => context.close());
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(base + '/playground.html?design=snowflake');
  return page;
}

test('SSE errors retain quota and rate-limit status instead of looking like empty JSON', async () => {
  const html = await readFile(resolve(root, 'playground.html'), 'utf8');
  const source = html.slice(html.indexOf('function parseSseResponse(res)'), html.indexOf('// ---- Content integrity guard'));
  const parse = new Function(source + ';return parseSseResponse;')();
  for (const status of [401, 402, 403, 429]) {
    await assert.rejects(parse(new Response('data: ' + JSON.stringify({ error: { code: status, message: 'Provider failure' } }) + '\n\n')), error => error.status === status);
  }
  const parsed = await parse(new Response('data: invalid\n\ndata: {"choices":[{"delta":{"content":"{}"}}]}\n\ndata: [DONE]\n\n'));
  assert.equal(parsed.content, '{}');
});

test('recursive mode renders accepted steps, submits Jev branches, and stops without redundant generation', async t => {
  const page = await open(t);
  let generations = 0, judgments = 0;
  await page.route('**/api/refine-judge', route => {
    judgments++;
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { decisions: body.targets.map(id => ({ id, needsDetail: id === 'page' ? !body.spec.elements.page.props.gap : id === 'stories' && !body.spec.elements.stories.children.length, probability: .9 })) } });
  });
  await page.evaluate(value => sessionStorage.setItem('pg-current-spec', JSON.stringify(value)), layout);
  await page.reload();
  await page.route('**/api/generate', route => {
    generations++;
    const spec = generations === 1 ? { root: 'page', elements: { ...layout.elements, page: { ...layout.elements.page, props: { direction: 'vertical', gap: 3 } } } } : patch;
    return route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(spec) } }] }) + '\n\ndata: [DONE]\n\n' });
  });
  await page.locator('#pg-prompt').fill('Instagram-like app feed design');
  await page.locator('#pg-prompt').press('Enter');
  await page.getByText('Jev: no further refinement', { exact: true }).waitFor({ timeout: 20000 });
  assert.equal(generations, 2);
  assert.ok(judgments >= 2);
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.locator('[data-spec-id="stories"]').evaluate(el => getComputedStyle(el).flexDirection), 'row');
  const a = await frame.locator('[data-spec-id="maya"]').boundingBox();
  const b = await frame.locator('[data-spec-id="jonas"]').boundingBox();
  assert.equal(a.y, b.y);
  assert.ok(b.x > a.x);
  assert.equal(await page.locator('.pg-result-header').count(), 1);
});

test('recursive mode reports judge failure without retries or pretending completion', async t => {
  const page = await open(t, 390);
  let judges = 0;
  let measured;
  await page.route('**/api/generate', route => route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(layout) } }] }) + '\n\ndata: [DONE]\n\n' }));
  await page.route('**/api/refine-judge', route => {
    judges++;
    measured = route.request().postDataJSON().geometry;
    return route.fulfill({ status: 429, json: { error: 'Rate limit exceeded' } });
  });
  await page.locator('#pg-prompt').fill('Instagram-like app feed design');
  await page.locator('#pg-prompt').press('Enter');
  await page.getByText(/Refinement stopped:.*Rate limit/).waitFor({ timeout: 15000 });
  assert.ok(measured?.stable);
  assert.equal(measured.viewport.width, 390);
  assert.ok(measured.capture.bounds.width > 0);
  assert.equal(judges, 1);
  assert.equal(await page.getByText('Jev: no further refinement', { exact: true }).count(), 0);
  assert.ok(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')).elements.stories));
  assert.equal(await page.locator('.pg-recursive-measure').count(), 0);
  assert.equal(await page.locator('#panel-preview').isVisible(), false);
  await page.reload();
  await page.getByText(/Refinement stopped:.*Rate limit/).waitFor();
  assert.equal(judges, 1);
});

test('New Chat cancels recursive generation without restoring a late layout', async t => {
  const page = await open(t, 390);
  let requested;
  const started = new Promise(resolve => { requested = resolve; });
  await page.route('**/api/generate', async route => {
    requested();
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(layout) } }] }) + '\n\ndata: [DONE]\n\n' }).catch(() => {});
  });
  await page.locator('#pg-prompt').fill('Instagram-like app feed design');
  await page.locator('#pg-prompt').press('Enter');
  await started;
  await page.locator('#pg-new-chat').click();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('pg-current-spec')), 'null');
  assert.equal(await page.locator('.pg-result-header').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('recursive mode rejects a renderer error before accepting a version', async t => {
  const page = await open(t);
  const broken = { root: 'sidebar', elements: { sidebar: { type: 'Sidebar', props: { sections: [null] } } } };
  let judges = 0;
  await page.route('**/api/generate', route => route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(broken) } }] }) + '\n\ndata: [DONE]\n\n' }));
  await page.route('**/api/refine-judge', route => { judges++; return route.fulfill({ json: { decisions: [] } }); });
  await page.locator('#pg-prompt').fill('A project sidebar');
  await page.locator('#pg-prompt').press('Enter');
  await page.getByText(/Refinement stopped: A component could not render/).waitFor();
  assert.equal(judges, 0);
  assert.equal(await page.locator('.pg-result-header').count(), 0);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('pg-current-spec')), 'null');
});

test('recursive regions reserve the whole layout and update concurrent siblings after one invalid response', async t => {
  const page = await open(t);
  const shell = {
    root: 'page', elements: {
      page: { type: 'Stack', props: { direction: 'vertical', gap: 4 }, children: ['header', 'body', 'footer'] },
      header: { type: 'Stack', props: { direction: 'horizontal' }, children: [] },
      body: { type: 'Grid', props: { columns: 'sidebar-main', gap: 4 }, children: ['sidebar', 'content'] },
      sidebar: { type: 'Stack', props: { direction: 'vertical' }, children: [] },
      content: { type: 'Stack', props: { direction: 'vertical' }, children: [] },
      footer: { type: 'Stack', props: { direction: 'horizontal' }, children: [] },
    },
  };
  const held = new Map();
  const sse = spec => ({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: typeof spec === 'string' ? spec : JSON.stringify(spec) } }] }) + '\n\ndata: [DONE]\n\n' });
  await page.route('**/api/generate', async route => {
    const body = route.request().postDataJSON();
    const step = JSON.parse(body.messages[1].content);
    if (!step.targetId) return route.fulfill(sse(shell));
    assert.ok(step.geometry?.elements.some(element => element.id === step.targetId), 'Each branch receives its own measured geometry');
    held.set(step.targetId, { route, step });
  });
  await page.route('**/api/refine-judge', route => {
    const { targets, spec } = route.request().postDataJSON();
    return route.fulfill({ json: { decisions: targets.map(id => ({
      id, probability: .9,
      needsDetail: id === 'body' ? !spec.elements.sidebar.children.length : ['header', 'footer', 'sidebar', 'content'].includes(id) && !spec.elements[id].children.length,
    })) } });
  });
  await page.locator('#pg-prompt').fill('App with header, sidebar, content and footer');
  await page.locator('#pg-prompt').press('Enter');
  const waitForRequests = async ids => {
    for (let attempt = 0; attempt < 100 && !ids.every(id => held.has(id)); attempt++) await page.waitForTimeout(50);
    assert.ok(ids.every(id => held.has(id)), 'Concurrent requests missing: ' + ids.filter(id => !held.has(id)));
  };
  await waitForRequests(['header', 'body', 'footer']);
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.locator('[data-pg-region]').count(), 4);
  assert.equal(await page.locator('[data-branch-id].pg-chat__step--active').count(), 3);
  const boxes = {};
  for (const id of ['header', 'sidebar', 'content', 'footer']) boxes[id] = await frame.locator(`[data-spec-id="${id}"]`).boundingBox();
  assert.equal(boxes.sidebar.y, boxes.content.y);
  assert.ok(boxes.content.x >= boxes.sidebar.x + boxes.sidebar.width);
  assert.ok(boxes.header.y + boxes.header.height <= boxes.content.y);
  assert.ok(boxes.footer.y >= boxes.content.y + boxes.content.height);
  assert.ok(boxes.content.height >= 200);
  const fulfill = async id => {
    const { route, step } = held.get(id);
    const node = step.currentSpec.elements[id];
    const elements = id === 'body' ? { body: node, sidebar: shell.elements.sidebar, content: shell.elements.content } : {
      [id]: { ...node, children: [id + '-text'] },
      [id + '-text']: { type: 'Text', props: { content: id + ' ready' } },
    };
    await route.fulfill(sse({ root: id, elements }));
  };
  await fulfill('header');
  await frame.getByText('header ready', { exact: true }).waitFor();
  assert.equal(await frame.locator('[data-spec-id="content"][data-pg-region]').count(), 1);
  assert.equal(await page.locator('[data-branch-id].pg-chat__step--active').count(), 2);
  await fulfill('body');
  await waitForRequests(['sidebar', 'content']);
  assert.equal(await page.locator('[data-branch-id="footer"].pg-chat__step--active').count(), 1);
  assert.equal(await page.locator('[data-branch-id].pg-chat__step--active').count(), 3);
  assert.equal(await page.locator('#pg-status').textContent(), '3/3 active, 0 queued');
  await page.screenshot({ path: '/private/tmp/daub-fractal-queue.png' });
  await held.get('content').route.fulfill(sse('invalid JSON'));
  await page.locator('[data-branch-id="content"].pg-chat__step--error').waitFor();
  await fulfill('sidebar');
  await fulfill('footer');
  await page.getByText(/Refinement paused: Some regions need another pass: content/).waitFor({ timeout: 15000 });
  await frame.getByText('sidebar ready', { exact: true }).waitFor();
  await frame.getByText('footer ready', { exact: true }).waitFor();
  assert.match(await frame.locator('[data-spec-id="content"]').getAttribute('data-pg-region'), /Needs another pass/);
  assert.equal(await frame.locator('[data-pg-refining]').count(), 0);
  const saved = await page.evaluate(() => sessionStorage.getItem('pg-current-spec'));
  assert.ok(JSON.parse(saved).elements['header-text']);
  assert.ok(JSON.parse(saved).elements['sidebar-text']);
  assert.doesNotMatch(saved, /data-pg-region|Needs another pass|refinement/);
  const download = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await download).path(), 'utf8');
  const exported = await page.context().newPage();
  await exported.setContent(html);
  assert.equal(await exported.locator('[data-pg-region]').count(), 0);
  await exported.close();
});
