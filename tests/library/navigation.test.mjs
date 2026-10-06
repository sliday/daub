import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const script = readFileSync(new URL('../../site-nav.js', import.meta.url), 'utf8');
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
