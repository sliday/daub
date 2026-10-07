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
  const nav = source.match(/<nav class="db-nav"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav);
  assert.match(source, /<script src="site-nav\.js" defer><\/script>/);
  const styles = [...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
  const page = await browser.newPage({ viewport: { width, height: 812 } });
  await page.route('**/*', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/site-nav.css')) return route.fulfill({ contentType: 'text/css', body: navCss });
    if (path === '/' + name + suffix.split('#')[0]) return route.fulfill({ contentType: 'text/html', body: '<style>' + css + '\n' + styles + '</style>' + nav + '<button id="outside" style="margin-top:600px">Outside</button>' });
    return route.abort();
  });
  await page.goto('http://daub.test/' + name + suffix);
  await page.addScriptTag({ content: icons });
  await page.addScriptTag({ content: script });
  await page.waitForFunction(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/site-nav.css')));
  return page;
}

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
