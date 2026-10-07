import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const read = name => readFileSync(new URL('../../' + name, import.meta.url), 'utf8');
const script = read('site-nav.js');
const css = read('daub.css');
const navCss = read('site-nav.css');
const icons = read('assets/lucide.min.js');
const routes = ['index', 'demo', 'themes', 'theme-preview', 'roadmap', 'case-studies', 'playground', 'components'];
const labels = ['Docs', 'Components', 'Layouts', 'Themes', 'Playground'];
let browser;
before(async () => { browser = await ({ chromium, webkit })[process.env.DAUB_TEST_BROWSER || 'chromium'].launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function fixture(name, width = 1280, suffix = '.html') {
  const source = read(name + '.html');
  const isChat = name === 'chat-demo';
  const nav = source.match(isChat ? /<header class="chat-demo-header"[\s\S]*?<\/header>/ : /<nav class="db-nav"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav);
  assert.match(source, isChat ? /<link[^>]+href="site-nav\.css[^>]+data-site-nav-style/ : /<script src="site-nav\.js" defer><\/script>/);
  const styles = isChat ? read('chat-demo.css') : [...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
  const page = await browser.newPage({ viewport: { width, height: 812 } });
  await page.route('**/*', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/site-nav.css')) return route.fulfill({ contentType: 'text/css', body: navCss });
    if (path === '/' + name + suffix.split('#')[0]) return route.fulfill({ contentType: 'text/html', body: '<style>' + css + '\n' + styles + '</style>' + (isChat ? '<link rel="stylesheet" href="site-nav.css">' : '') + nav + '<button id="outside" style="margin-top:600px">Outside</button>' });
    return route.abort();
  });
  await page.goto('http://daub.test/' + name + suffix);
  await page.addScriptTag({ content: icons });
  if (!isChat) await page.addScriptTag({ content: script });
  await page.waitForFunction(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/site-nav.css')));
  return page;
}

test('page titles use sentence case and match shared navigation', async () => {
  const page = await fixture('case-studies');
  try {
    for (const [name, heading] of [['case-studies', 'Case studies'], ['themes', 'Theme gallery'], ['theme-preview', 'Theme preview'], ['demo', 'Layout library'], ['chat-demo', 'Release review']]) {
      const result = await page.evaluate(source => {
        const doc = new DOMParser().parseFromString(source, 'text/html');
        return { heading: doc.querySelector('h1').textContent, title: doc.title, social: [...doc.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]')].map(meta => meta.content) };
      }, read(name + '.html'));
      assert.equal(result.heading, heading);
      for (const title of result.social) assert.equal(title, result.title);
    }
    await page.getByRole('button', { name: 'Resources', exact: true }).click();
    assert.equal(await page.getByRole('link', { name: 'Case studies', exact: true }).isVisible(), true);
    assert.match(read('index.html'), /Fluent in machine and human<\/h2>/);
    assert.match(read('roadmap.html'), /<h2>What makes this different<\/h2>/);
    assert.match(read('playground.html'), />What would you like to build\?<\/h3>/);
    assert.match(read('case-studies.html'), /<h2>Dwarf Land<\/h2>/);
  } finally { await page.close(); }
});

test('all site headers share wordmark typography and alignment across widths and themes', async () => {
  for (const name of [...routes, 'chat-demo']) {
    const page = await fixture(name);
    try {
      const brand = page.getByRole('link', { name: 'DAUB home', exact: true });
      assert.equal(await brand.getAttribute('href'), 'index.html');
      for (const width of [320, 768, 960, 1280]) {
        await page.setViewportSize({ width, height: 812 });
        for (const theme of ['light', 'dark', 'monospace', 'synthwave']) {
          await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
          const actual = await brand.evaluate(el => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const header = el.parentElement.getBoundingClientRect();
            return { font: style.fontFamily, size: style.fontSize, weight: style.fontWeight, line: style.lineHeight, spacing: style.letterSpacing, shadow: style.textShadow, decoration: style.textDecorationLine, x: rect.x - header.x, y: rect.y - header.y, height: rect.height, headerHeight: header.height };
          });
          assert.deepEqual(actual, { font: 'Georgia, serif', size: '20px', weight: '700', line: '20px', spacing: 'normal', shadow: 'none', decoration: 'none', x: width <= 960 ? 16 : 24, y: 13.5, height: 20, headerHeight: 48 }, name + '/' + width + '/' + theme);
        }
      }
    } finally { await page.close(); }
  }
});

for (const name of routes) {
  test(`${name} uses shared navigation, one active destination, and responsive geometry`, async () => {
    const page = await fixture(name);
    try {
      assert.deepEqual(await page.locator('.site-nav__links > a[data-page]').allTextContents(), labels);
      const expected = name === 'theme-preview' ? 'themes' : name;
      assert.deepEqual(await page.locator('[data-site-nav] [aria-current="page"]').evaluateAll(links => links.map(link => link.dataset.page)), name === 'index' ? [] : [expected]);
      for (const width of [320, 375, 768, 960, 1280]) {
        await page.setViewportSize({ width, height: 812 });
        const toggle = page.locator('.site-nav__toggle');
        if (await toggle.isVisible()) await toggle.click();
        const geometry = await page.locator('[data-site-nav]').evaluate(nav => ({
          height: nav.getBoundingClientRect().height,
          overflow: document.documentElement.scrollWidth > innerWidth,
          links: [...nav.querySelectorAll('.site-nav__links > a, .site-nav__resources-toggle')].map(link => link.getBoundingClientRect().toJSON()),
          icons: [...nav.querySelectorAll('.site-nav__github svg')].map(icon => icon.getBoundingClientRect().width)
        }));
        assert.equal(geometry.height, 48);
        assert.equal(geometry.overflow, false);
        assert.deepEqual(geometry.icons, [16], name + '/' + width + ': ' + JSON.stringify(geometry));
        for (const link of geometry.links) {
          assert.ok(link.left >= 0 && link.right <= width);
          assert.ok(link.height >= (width <= 960 ? 44 : 36));
        }
        if (await toggle.isVisible()) await page.keyboard.press('Escape');
      }
    } finally { await page.close(); }
  });
}

test('navigation disclosures support keyboard, outside dismissal and hash-based docs selection', async () => {
  const page = await fixture('components', 375, '#getting-started');
  try {
    const toggle = page.locator('.site-nav__toggle');
    const resources = page.getByRole('button', { name: 'Resources', exact: true });
    assert.equal(await page.locator('[data-site-nav] [aria-current]').textContent(), 'Docs');
    await toggle.press('Enter');
    await resources.press('Enter');
    assert.equal(await resources.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Chat demo');
    await page.keyboard.press('Escape');
    assert.equal(await resources.evaluate(el => el === document.activeElement), true);
    assert.equal(await resources.getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
    await toggle.click();
    await page.locator('#outside').click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await toggle.click();
    await page.locator('[data-site-nav] [data-page="components"]').evaluate(link => link.href = '#btn');
    await page.locator('[data-site-nav] [data-page="components"]').click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await page.waitForFunction(() => document.querySelector('[data-site-nav] [aria-current]')?.textContent === 'Components');
  } finally { await page.close(); }
});
