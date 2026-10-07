import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const source = readFileSync(new URL('../../daub.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
const buttonTokens = ['--db-btn-color', '--db-btn-contrast-color', '--db-btn-contrast-mix'];
const accentTokens = ['--db-terracotta', '--db-accent-dark', '--db-accent-hover', '--db-accent-pressed'];
let browser;

before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }); });
after(async () => { await browser?.close(); });

function rgb(hex) {
  if (hex.length === 4) hex = '#' + [...hex.slice(1)].map(channel => channel + channel).join('');
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance(channels) {
  return channels.reduce((sum, channel, index) => {
    const value = channel / 255;
    return sum + [0.2126, 0.7152, 0.0722][index] * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  }, 0);
}

function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function passes(colors, foreground, toward, percent) {
  const text = rgb(foreground), target = rgb(toward);
  return colors.every(color => contrast(text, rgb(color).map((channel, index) => channel * (1 - percent / 100) + target[index] * percent / 100)) >= 4.6);
}

async function fixture(run) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('http://daub.test/', route => route.fulfill({ contentType: 'text/html', body: '<html data-theme="nord-light"><head></head><body><button class="db-btn db-btn--primary">Save</button></body></html>' }));
    await page.goto('http://daub.test/');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: source });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

describe('Custom accent primary button contrast', () => {
  it('uses the smallest uniform mix that passes 4.6:1 for all four accent colors', async () => {
    await fixture(async page => {
      const samples = await page.evaluate(({ buttonTokens, accentTokens }) => {
        return ['#ffff00', '#ffffff', '#000000', '#88c0d0', '#d48b6a', '#888888', '#00ff00', '#0000ff', '#ff00ff', '#ffaa00', '#117788', '#e4bbf7'].map(hex => {
          DAUB.setAccent(hex);
          const style = document.documentElement.style;
          return { hex, button: buttonTokens.map(token => style.getPropertyValue(token)), accents: accentTokens.map(token => style.getPropertyValue(token)) };
        });
      }, { buttonTokens, accentTokens });
      for (const { hex, button: [foreground, toward, mix], accents } of samples) {
        assert.ok(['#fff', '#111'].includes(foreground), `${hex}: supported foreground`);
        assert.equal(toward, foreground === '#fff' ? '#000' : '#fff', `${hex}: mix direction`);
        assert.match(mix, /^\d+%$/, `${hex}: integer mix`);
        const percent = parseInt(mix);
        assert.ok(percent <= 100);
        assert.equal(accents[0], hex, 'preserves the custom brand accent');
        assert.ok(passes(accents, foreground, toward, percent), `${hex}: contrast at ${mix}`);
        for (let smaller = 0; smaller < percent; smaller++) {
          assert.equal(passes(accents, '#fff', '#000', smaller), false, `${hex}: a smaller dark mix must fail`);
          assert.equal(passes(accents, '#111', '#fff', smaller), false, `${hex}: a smaller light mix must fail`);
        }
      }
      assert.deepEqual(samples[0].button, ['#111', '#fff', '0%'], 'bright yellow uses dark text without changing the accent');
      assert.ok(samples.some(sample => parseInt(sample.button[2]) > 0), 'exercises a nonzero mix');
    });
  });

  it('removes component overrides on reset and restores the current theme values', async () => {
    await fixture(async page => {
      const result = await page.evaluate(tokens => {
        const root = document.documentElement;
        const read = () => tokens.map(token => getComputedStyle(root).getPropertyValue(token).trim());
        const before = read();
        DAUB.setAccent('#ffff00');
        const custom = tokens.map(token => root.style.getPropertyValue(token));
        DAUB.resetAccent();
        return { before, custom, after: read(), inline: tokens.map(token => root.style.getPropertyValue(token)), stored: localStorage.getItem('db-accent') };
      }, buttonTokens);
      assert.deepEqual(result.custom, ['#111', '#fff', '0%']);
      assert.deepEqual(result.inline, ['', '', '']);
      assert.deepEqual(result.after, result.before);
      assert.equal(result.stored, null);
    });
  });
});
