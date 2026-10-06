import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';

const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');

test('solid and dashed separators paint only their active edge', async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  const browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const tag of ['hr', 'div']) {
      for (const vertical of [false, true]) {
        for (const dashed of [false, true]) {
          const classes = ['db-separator', vertical && 'db-separator--vertical', dashed && 'db-separator--dashed'].filter(Boolean).join(' ');
          await page.setContent(`<${tag} class="${classes}"></${tag}>`);
          await page.addStyleTag({ content: css });
          const borders = await page.locator('.db-separator').evaluate(element => {
            const style = getComputedStyle(element);
            return ['Top', 'Right', 'Bottom', 'Left'].map(side => ({ width: style[`border${side}Width`], style: style[`border${side}Style`] }));
          });
          const active = vertical ? 3 : 0;
          for (let edge = 0; edge < borders.length; edge++) {
            assert.equal(borders[edge].width, edge === active ? '1px' : '0px', `${tag}/${classes}: edge ${edge}`);
            if (edge === active) assert.equal(borders[edge].style, dashed ? 'dashed' : 'solid');
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
});
