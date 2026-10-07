import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';

const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../../daub.js', import.meta.url), 'utf8');
let browser, page, themes;
before(async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE_PATH || (engine === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH : undefined) });
  page = await browser.newPage();
  await page.route('http://daub.test/', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><button class="db-btn db-btn--primary">Save changes</button><input class="db-input" placeholder="Email address"></body></html>' }));
  await page.goto('http://daub.test/');
  await page.addStyleTag({ content: css });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  await page.addScriptTag({ content: runtime });
  themes = await page.evaluate(() => DAUB.THEMES);
});
after(async () => { await browser?.close(); });

function colors(value) {
  return [...value.matchAll(/color\(srgb ([^)]+)\)|rgba?\(([^)]+)\)/g)].map(match => {
    const numbers = (match[1] || match[2]).match(/[\d.]+/g).slice(0, 3).map(Number);
    return match[1] ? numbers.map(channel => channel * 255) : numbers;
  });
}
function luminance(color) {
  const linear = color.map(channel => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function ratio(foreground, background) {
  const [dark, light] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (light + 0.05) / (dark + 0.05);
}

test('rendered primary button text meets AA in 42 themes across interaction states', async () => {
  assert.equal(themes.length, 42);
  const button = page.locator('.db-btn');
  for (const theme of themes) {
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    for (const texture of ['none', 'glass']) {
      await page.evaluate(texture => document.documentElement.setAttribute('data-db-texture', texture), texture);
      for (const state of ['normal', 'hover', 'pressed']) {
        await page.mouse.move(700, 500);
        await button.evaluate((element, state) => element.classList.toggle('db-btn--pressed', state === 'pressed'), state);
        if (state === 'hover') await button.hover();
        const computed = await button.evaluate(element => {
          const style = getComputedStyle(element);
          return { foreground: style.color, background: style.backgroundImage === 'none' ? style.backgroundColor : style.backgroundImage };
        });
        const foreground = colors(computed.foreground)[0];
        const backgrounds = colors(computed.background);
        assert.ok(foreground && backgrounds.length, 'resolve ' + JSON.stringify(computed));
        for (const background of backgrounds) assert.ok(ratio(foreground, background) >= 4.5, `${theme}/${texture}/${state}: ${ratio(foreground, background).toFixed(2)}:1`);
      }
    }
  }
});

test('rendered input placeholders retain AA contrast in the theme field surface', async () => {
  for (const theme of themes) {
    await page.evaluate(theme => { document.documentElement.setAttribute('data-theme', theme); document.documentElement.setAttribute('data-db-texture', 'none'); }, theme);
    const computed = await page.locator('input').evaluate(element => {
      const style = getComputedStyle(element, '::placeholder');
      return { foreground: style.color, opacity: style.opacity, background: getComputedStyle(element).backgroundColor };
    });
    assert.equal(computed.opacity, '1');
    assert.ok(ratio(colors(computed.foreground)[0], colors(computed.background)[0]) >= 4.5, `${theme} placeholder contrast`);
  }
});
