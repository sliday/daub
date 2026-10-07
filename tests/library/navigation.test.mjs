import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const script = readFileSync(new URL('../../site-nav.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }); });
after(async () => { await browser?.close(); });

for (const name of ['index.html', 'roadmap.html', 'case-studies.html']) {
  const source = readFileSync(new URL('../../' + name, import.meta.url), 'utf8');
  const nav = source.match(/<nav class="db-nav"[\s\S]*?<\/nav>/)?.[0];
  test(`${name} mobile navigation supports keyboard, outside dismissal, and links`, async () => {
    assert.ok(nav, 'navigation fixture comes from the page');
    assert.match(source, /<script src="site-nav\.js" defer><\/script>/);
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    try {
      await page.setContent('<style>.db-nav__links{display:none}.db-nav--open .db-nav__links{display:block}</style>' + nav + '<button id="outside">Outside</button>');
      await page.addScriptTag({ content: script });
      const toggle = page.locator('.db-nav__toggle');
      await toggle.press('Enter');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('.db-nav__links').getAttribute('id'), await toggle.getAttribute('aria-controls'));
      await page.keyboard.press('Escape');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await toggle.evaluate(element => element === document.activeElement), true);
      await toggle.click();
      await page.locator('#outside').click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await toggle.click();
      const componentLink = page.locator('.db-nav__links').getByRole('link', { name: 'Components', exact: true });
      assert.equal(await componentLink.getAttribute('href'), 'components.html');
      await componentLink.evaluate(element => element.addEventListener('click', event => event.preventDefault()));
      await componentLink.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    } finally { await page.close(); }
  });
}

for (const name of ['index.html', 'demo.html']) {
  const source = readFileSync(new URL('../../' + name, import.meta.url), 'utf8');
  const nav = source.match(/<nav class="db-nav"[\s\S]*?<\/nav>/)?.[0];
  const styles = [...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
  test(`${name} GitHub icon and count remain aligned in mobile and desktop navigation`, async () => {
    const page = await browser.newPage();
    try {
      await page.setContent('<style>' + css + '\n' + styles + '</style><header>' + nav + '</header>');
      await page.addScriptTag({ content: script });
      await page.locator('.db-nav__github').evaluate(link => {
        let stars = link.querySelector('#gh-stars');
        if (!stars) { stars = document.createElement('span'); stars.id = 'gh-stars'; link.append(stars); }
        stars.textContent = '41';
        stars.style.display = 'inline';
      });
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 812 });
        const toggle = page.locator('.db-nav__toggle');
        if (await toggle.isVisible()) await toggle.click();
        const layout = await page.locator('.db-nav__github').evaluate(link => {
          const icon = link.querySelector('svg').getBoundingClientRect();
          const stars = link.querySelector('#gh-stars').getBoundingClientRect();
          return { display: getComputedStyle(link).display, iconWidth: icon.width, iconRight: icon.right, countLeft: stars.left, centerDifference: Math.abs(icon.top + icon.height / 2 - stars.top - stars.height / 2) };
        });
        assert.ok(['flex', 'inline-flex'].includes(layout.display), name + '/' + width + ' uses one flex row');
        assert.equal(layout.iconWidth, 16);
        assert.ok(layout.countLeft > layout.iconRight, name + '/' + width + ' keeps count beside icon');
        assert.ok(layout.centerDifference < 1, name + '/' + width + ' centers icon and count');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
        if (await toggle.isVisible()) await page.keyboard.press('Escape');
      }
    } finally { await page.close(); }
  });
}
