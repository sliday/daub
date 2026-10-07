import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const html = await readFile(new URL('roadmap.html', root), 'utf8');
const css = await readFile(new URL('daub.css', root), 'utf8');
const icons = await readFile(new URL('assets/lucide.min.js', root), 'utf8');
let browser;
before(async () => { browser = await ({ chromium, firefox, webkit })[process.env.DAUB_TEST_BROWSER || 'chromium'].launch({ headless: true }); });
after(async () => { await browser?.close(); });

for (const width of [320, 375, 640, 1280]) {
  for (const scheme of ['light', 'dark']) {
    test(`roadmap cards align and fit at ${width}px in ${scheme}`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.route('**/*', route => route.abort());
        await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''));
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: icons });
        await page.evaluate(scheme => {
          document.documentElement.setAttribute('data-theme', scheme);
          document.documentElement.setAttribute('data-scheme', scheme);
          lucide.createIcons();
        }, scheme);
        const grids = await page.locator('.rm-place__grid').evaluateAll(elements => elements.map(grid => ({
          bounds: grid.getBoundingClientRect().toJSON(),
          cards: [...grid.children].map(card => ({
            bounds: card.getBoundingClientRect().toJSON(),
            align: getComputedStyle(card).textAlign,
            padding: getComputedStyle(card).padding,
            children: [...card.children].map(child => child.getBoundingClientRect().toJSON()),
            icon: card.querySelector('svg').getBoundingClientRect().toJSON(),
            overflow: card.scrollWidth > card.clientWidth
          }))
        })));
        assert.deepEqual(grids.map(grid => grid.cards.length), [5, 4]);
        for (const grid of grids) {
          assert.ok(grid.bounds.left >= 0 && grid.bounds.right <= width);
          for (const card of grid.cards) {
            assert.equal(card.align, 'left');
            assert.equal(card.padding, '24px');
            assert.equal(card.overflow, false);
            assert.equal(card.icon.width, 32);
            assert.equal(card.icon.height, 32);
            for (const child of card.children) {
              assert.ok(Math.abs(child.left - card.icon.left) < 1);
              assert.ok(child.right <= card.bounds.right - 24);
              assert.ok(child.bottom <= card.bounds.bottom - 24);
            }
            assert.ok(card.children[1].top >= card.icon.bottom + 16);
            assert.ok(card.children[2].top >= card.children[1].bottom + 6);
          }
          if (width > 600) {
            assert.equal(grid.cards[0].bounds.top, grid.cards[1].bounds.top);
            assert.equal(grid.cards[0].bounds.height, grid.cards[1].bounds.height);
            if (grid.cards.length % 2) assert.equal(grid.cards.at(-1).bounds.width, grid.bounds.width);
          } else {
            for (const card of grid.cards) assert.equal(card.bounds.width, grid.bounds.width);
          }
        }
      } finally { await page.close(); }
    });
  }
}
