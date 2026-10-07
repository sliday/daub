import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const css = await readFile(new URL('daub.css', root), 'utf8');
const script = await readFile(new URL('daub.js', root), 'utf8');
const icons = await readFile(new URL('assets/lucide.min.js', root), 'utf8');
const catalog = JSON.parse(await readFile(new URL('components.json', root), 'utf8'));
const example = catalog.components.find(component => component.name === 'Carousel').html;
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function withCarousel(width, run) {
  const page = await browser.newPage({ viewport: { width, height: 700 }, hasTouch: true, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  try {
    await page.setContent('<main style="padding:24px;max-width:800px">' + example + '</main>');
    await page.addStyleTag({ content: css + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.addScriptTag({ content: icons });
    await page.evaluate(() => lucide.createIcons());
    await page.addScriptTag({ content: script });
    await page.evaluate(() => { DAUB.init(); DAUB.init(); });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

for (const width of [320, 1280]) {
  test('Carousel example keeps text clear of centered navigation at ' + width + 'px', async () => {
    await withCarousel(width, async page => {
      const geometry = await page.locator('.db-carousel').evaluate(element => {
        const slide = element.querySelector('.db-carousel__slide[aria-hidden="false"]');
        const content = [slide.querySelector('h3'), slide.querySelector('p')].map(element => element.getBoundingClientRect().toJSON());
        const previous = element.querySelector('.db-carousel__btn--prev').getBoundingClientRect();
        const next = element.querySelector('.db-carousel__btn--next').getBoundingClientRect();
        const rect = slide.getBoundingClientRect();
        return { content, previous: previous.toJSON(), next: next.toJSON(), slide: rect.toJSON(), overflow: element.scrollWidth > element.clientWidth };
      });
      assert.ok(geometry.slide.height >= 160);
      for (const content of geometry.content) {
        assert.ok(content.left >= geometry.previous.right + 8, JSON.stringify(geometry));
        assert.ok(content.right <= geometry.next.left - 8, JSON.stringify(geometry));
      }
      assert.ok(Math.abs(geometry.previous.y + geometry.previous.height / 2 - geometry.slide.y - geometry.slide.height / 2) <= 1);
      assert.equal(await page.locator('.db-carousel__btn svg.lucide').count(), 2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    });
  });
}

test('Carousel arrows, keyboard buttons, dots, and slide isolation stay synchronized', async () => {
  await withCarousel(375, async page => {
    const next = page.getByRole('button', { name: 'Next slide' });
    const previous = page.getByRole('button', { name: 'Previous slide' });
    const dots = page.locator('.db-carousel__dot');
    const assertSlide = async index => {
      assert.deepEqual(await page.locator('.db-carousel__slide').evaluateAll(elements => elements.map(element => element.inert)), [index !== 0, index !== 1]);
      assert.equal(await dots.nth(index).getAttribute('aria-current'), 'true');
      assert.equal(await page.locator('.db-carousel__slide[aria-hidden="false"] h3').textContent(), index === 0 ? 'Project Aurora' : 'Project Birch');
    };
    await assertSlide(0);
    await next.click(); await assertSlide(1);
    await next.press('Enter'); await assertSlide(0);
    await previous.press('Space'); await assertSlide(1);
    await dots.nth(0).click(); await assertSlide(0);
  });
});

test('Carousel example accepts horizontal touch swipes in both directions', async () => {
  await withCarousel(375, async page => {
    const track = await page.locator('.db-carousel__track').boundingBox();
    const session = await page.context().newCDPSession(page);
    const y = track.y + track.height / 2;
    const swipe = async (start, end) => {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y, id: 1 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: end, y, id: 1 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await swipe(track.x + track.width - 70, track.x + 70);
    assert.equal(await page.locator('.db-carousel__dot').nth(1).getAttribute('aria-current'), 'true');
    await swipe(track.x + 70, track.x + track.width - 70);
    assert.equal(await page.locator('.db-carousel__dot').nth(0).getAttribute('aria-current'), 'true');
  });
});
