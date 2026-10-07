import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const css = await readFile(new URL('daub.css', root), 'utf8');
const runtime = await readFile(new URL('daub.js', root), 'utf8');
const icons = await readFile(new URL('assets/lucide.min.js', root), 'utf8');
const catalog = JSON.parse(await readFile(new URL('components.json', root), 'utf8'));
const example = catalog.components.find(component => component.class === 'db-change-summary').html;
let browser;
before(async () => { browser = await ({ chromium, firefox, webkit })[process.env.DAUB_TEST_BROWSER || 'chromium'].launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function fixture(width, touch = false) {
  const page = await browser.newPage({ viewport: { width, height: 812 }, hasTouch: touch, reducedMotion: 'reduce' });
  await page.route('**/*', route => route.abort());
  await page.setContent('<html data-theme="light"><body style="margin:0;padding:16px">' + example + '</body></html>');
  await page.addStyleTag({ content: css + '\n*,*::before,*::after { transition:none!important; animation:none!important; }' });
  await page.addScriptTag({ content: runtime });
  await page.addScriptTag({ content: icons });
  await page.evaluate(() => lucide.createIcons());
  return page;
}

test('change summary constrains long paths, large counters and host actions at narrow widths', async () => {
  for (const [width, touch] of [[320, false], [375, true], [1440, false]]) {
    const page = await fixture(width, touch);
    try {
      await page.evaluate(() => {
        const summary = document.querySelector('.db-change-summary');
        summary.querySelector('.db-change-summary__path').textContent = 'very-long-directory/'.repeat(20) + 'release-review.ts';
        const actions = document.createElement('div');
        actions.className = 'db-change-summary__actions';
        for (const label of ['Undo', 'View changes']) {
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'db-btn db-btn--ghost db-btn--sm'; button.textContent = label;
          actions.append(button);
        }
        summary.querySelector('.db-change-summary__header').append(actions);
        for (const counter of summary.querySelectorAll('.db-change-summary__counts > span')) counter.textContent = '+' + Number.MAX_SAFE_INTEGER;
      });
      const geometry = await page.locator('.db-change-summary').evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const children = [...element.querySelectorAll('.db-change-summary__path, .db-change-summary__counts, .db-change-summary__actions button')];
        return { bounds: bounds.toJSON(), failures: children.filter(child => {
          const rect = child.getBoundingClientRect();
          return rect.left < bounds.left || rect.right > bounds.right;
        }).map(child => child.className), paths: getComputedStyle(element.querySelector('.db-change-summary__path')).textOverflow, targets: [...element.querySelectorAll('button')].map(button => button.getBoundingClientRect().height) };
      });
      assert.deepEqual(geometry.failures, [], JSON.stringify(geometry));
      assert.equal(geometry.paths, 'ellipsis');
      assert.ok(geometry.targets.every(height => height >= (touch ? 44 : 32)), JSON.stringify(geometry));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await page.locator('.db-change-summary__icon svg').count(), 1);
    } finally { await page.close(); }
  }
});

test('change summary text and signed counts meet contrast thresholds across 42 themes', async () => {
  const page = await fixture(640);
  try {
    const result = await page.evaluate(() => {
      const canvas = document.createElement('canvas').getContext('2d');
      function rgba(value) {
        canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = value; canvas.fillRect(0, 0, 1, 1);
        return [...canvas.getImageData(0, 0, 1, 1).data].map((channel, index) => index === 3 ? channel / 255 : channel);
      }
      const blend = (fg, bg) => fg.slice(0, 3).map((value, index) => value * fg[3] + bg[index] * (1 - fg[3]));
      function background(element) {
        const chain = [];
        for (let node = element; node; node = node.parentElement) chain.unshift(node);
        return chain.reduce((color, node) => blend(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255]);
      }
      const luminance = color => color.map(value => { value /= 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const failures = []; let minimum = Infinity;
      for (const theme of DAUB.THEMES) {
        DAUB.setTheme(theme);
        for (const element of document.querySelectorAll('.db-change-summary__title, .db-change-summary__description, .db-change-summary__path, .db-change-summary__additions, .db-change-summary__deletions')) {
          const bg = background(element), fg = blend(rgba(getComputedStyle(element).color), bg);
          const levels = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
          const ratio = (levels[0] + 0.05) / (levels[1] + 0.05);
          minimum = Math.min(minimum, ratio);
          if (ratio < 4.5) failures.push({ theme, className: element.className, ratio });
        }
      }
      return { themes: DAUB.THEMES.length, minimum, failures };
    });
    console.log('Change summary contrast: ' + JSON.stringify(result));
    assert.equal(result.themes, 42);
    assert.deepEqual(result.failures, []);
  } finally { await page.close(); }
});
