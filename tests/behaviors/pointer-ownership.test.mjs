import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const source = readFileSync(new URL('../../daub.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }); });
after(async () => { await browser?.close(); });

async function fixture(html, run, setup) {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true });
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('http://daub.test/', route => route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><style>*,*::before,*::after{transition:none!important;animation:none!important}</style></head><body style="padding:20px">${html}</body></html>` }));
    await page.goto('http://daub.test/');
    if (setup) await page.evaluate(setup);
    await page.addScriptTag({ content: source });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

async function touchSession(page) {
  const session = await page.context().newCDPSession(page);
  return {
    start: (x, y) => session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }),
    move: (x, y) => session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }),
    end: () => session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    cancel: () => session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }),
  };
}

const carousel = '<div class="db-carousel" style="width:320px"><div class="db-carousel__track" id="track"><div class="db-carousel__slide" style="height:140px">Slide one</div><div class="db-carousel__slide" style="height:140px">Slide two</div><div class="db-carousel__slide" style="height:140px">Slide three</div></div><button class="db-carousel__btn db-carousel__btn--prev" id="prev">Previous</button><button class="db-carousel__btn db-carousel__btn--next" id="next">Next</button><div class="db-carousel__dots"><button class="db-carousel__dot" id="dot-one">One</button><button class="db-carousel__dot" id="dot-two">Two</button><button class="db-carousel__dot" id="dot-three">Three</button></div></div>';
const resize = '<div class="db-resizable" id="panel" style="width:200px;height:120px"><div class="db-resizable__handle db-resizable__handle--corner" id="corner"></div><div class="db-resizable__handle db-resizable__handle--right" id="right"></div></div>';

describe('Native pointer interactions', () => {
  it('swipes a carousel in both directions, wraps, and retains keyboard buttons', async () => {
    await fixture(carousel, async page => {
      const touch = await touchSession(page);
      const box = await page.locator('.db-carousel').boundingBox();
      const y = box.y + 70;
      await touch.start(box.x + 240, y); await touch.move(box.x + 100, y); await touch.end();
      assert.equal(await page.locator('#dot-two').getAttribute('aria-current'), 'true');
      assert.equal(await page.locator('.db-carousel__slide').first().evaluate(el => el.inert), true);
      await touch.start(box.x + 100, y); await touch.move(box.x + 240, y); await touch.end();
      assert.equal(await page.locator('#dot-one').getAttribute('aria-current'), 'true');
      await touch.start(box.x + 100, y); await touch.move(box.x + 240, y); await touch.end();
      assert.equal(await page.locator('#dot-three').getAttribute('aria-current'), 'true');
      await page.locator('#next').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#dot-one').getAttribute('aria-current'), 'true');
      await page.locator('#prev').focus(); await page.keyboard.press('Space');
      assert.equal(await page.locator('#dot-three').getAttribute('aria-current'), 'true');
    });
  });

  it('ignores short and vertical gestures, cancellation, and disabled carousels', async () => {
    await fixture(carousel + '<div style="height:1600px"></div>', async page => {
      const touch = await touchSession(page);
      const box = await page.locator('.db-carousel').boundingBox();
      const x = box.x + 220, y = box.y + 70;
      await touch.start(x, y); await touch.move(x - 10, y); await touch.end();
      assert.equal(await page.locator('#dot-one').getAttribute('aria-current'), 'true');
      await touch.start(x, y); await touch.move(x - 120, y); await touch.cancel();
      assert.equal(await page.locator('#dot-one').getAttribute('aria-current'), 'true');
      await touch.start(x, y); await touch.move(x - 15, y - 50); await touch.end();
      assert.equal(await page.locator('#dot-one').getAttribute('aria-current'), 'true');
      await page.waitForFunction(() => window.scrollY > 0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('.db-carousel').evaluate(el => el.setAttribute('aria-disabled', 'true'));
      await touch.start(x, y); await touch.move(x - 120, y); await touch.end();
      assert.equal(await page.locator('#dot-one').getAttribute('aria-current'), 'true');
    });
  });

  it('preserves taps on slide links and suppresses link activation after a swipe', async () => {
    await fixture(carousel.replace('Slide one', '<a href="#chosen" id="link" style="display:block;width:100%;height:140px">Choose slide</a>'), async page => {
      await page.evaluate(() => { window.linkClicks = 0; document.querySelector('#link').addEventListener('click', e => { e.preventDefault(); window.linkClicks++; }); });
      const touch = await touchSession(page);
      const box = await page.locator('#link').boundingBox();
      const x = box.x + 240, y = box.y + 70;
      await touch.start(x, y); await touch.end();
      assert.equal(await page.evaluate(() => window.linkClicks), 1);
      await touch.start(x, y); await touch.move(x - 140, y); await touch.end();
      assert.equal(await page.locator('#dot-two').getAttribute('aria-current'), 'true');
      assert.equal(await page.evaluate(() => window.linkClicks), 1);
    });
  });

  it('captures touch resizing outside the handle and retains mouse and keyboard sizing', async () => {
    await fixture(resize, async page => {
      const touch = await touchSession(page);
      const box = await page.locator('#corner').boundingBox();
      await page.locator('#corner').evaluate(handle => handle.addEventListener('pointerdown', e => { window.resizePointer = e.pointerId; }));
      const x = box.x + box.width / 4, y = box.y + box.height / 2;
      await touch.start(x, y);
      assert.equal(await page.locator('#corner').evaluate(el => el.hasPointerCapture(window.resizePointer)), true);
      await touch.move(x + 60, y + 40); await touch.end();
      assert.equal(await page.locator('#panel').evaluate(el => el.style.width), '260px');
      assert.equal(await page.locator('#panel').evaluate(el => el.style.height), '160px');
      const right = await page.locator('#right').boundingBox();
      await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2);
      await page.mouse.down(); await page.mouse.move(right.x + right.width / 2 + 20, right.y + right.height / 2); await page.mouse.up();
      assert.equal(await page.locator('#panel').evaluate(el => el.style.width), '280px');
      await page.locator('#right').focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#panel').evaluate(el => el.style.width), '290px');
      assert.equal(await page.locator('#right').getAttribute('aria-valuenow'), '290');
    });
  });

  it('cleans up cancelled pointer resizing and ignores disabled handles', async () => {
    await fixture(resize, async page => {
      const touch = await touchSession(page);
      const box = await page.locator('#right').boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await touch.start(x, y); await touch.move(x + 30, y); await touch.cancel();
      assert.equal(await page.locator('#panel').evaluate(el => el.style.width), '230px');
      await page.locator('#right').dispatchEvent('pointermove', { pointerId: 2, isPrimary: true, clientX: x + 90, clientY: y });
      assert.equal(await page.locator('#panel').evaluate(el => el.style.width), '230px');
      await page.locator('#right').evaluate(el => el.setAttribute('aria-disabled', 'true'));
      const current = await page.locator('#right').boundingBox();
      await touch.start(current.x + current.width / 2, current.y + current.height / 2);
      await touch.move(current.x - 70, current.y + current.height / 2); await touch.end();
      assert.equal(await page.locator('#panel').evaluate(el => el.style.width), '230px');
    });
  });
});

describe('React ownership boundaries', () => {
  it('does not bind marked triggers inside native component wrappers', async () => {
    await fixture('<div class="db-collapsible" id="wrapper"><button data-db-react class="db-collapsible__trigger" id="controlled" aria-expanded="true">Controlled</button><div class="db-collapsible__content">Content</div></div>', async page => {
      assert.equal(await page.locator('#controlled').getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#controlled').getAttribute('aria-controls'), null);
      await page.locator('#controlled').click();
      assert.equal(await page.locator('#wrapper').evaluate(el => el.classList.contains('db-collapsible--open')), false);
    });
  });

  it('leaves marked catalog markup unchanged during document and scoped initialization', async () => {
    const catalog = JSON.parse(readFileSync(new URL('../../components.json', import.meta.url), 'utf8'));
    const markup = catalog.components.map(component => component.html || '').join('\n');
    await fixture(`<button class="db-switch" id="native">Native</button><div data-db-react id="owned">${markup}</div>`, async page => {
      await page.evaluate(() => { DAUB.init(); DAUB.init(document.querySelector('#owned')); DAUB.setScheme('dark'); DAUB.setAccent('#ffff00'); });
      const result = await page.locator('#owned').evaluate(el => ({ unchanged: el.innerHTML === window.ownedBefore, initialized: [...el.querySelectorAll('*')].some(child => child._dbInit || child._dbTriggerInit || child._dbSidebar || child._dbNavbar || child._dbChipToggle || child._dbTempInit) }));
      assert.deepEqual(result, { unchanged: true, initialized: false });
      await page.locator('#native').click();
      assert.equal(await page.locator('#native').getAttribute('aria-checked'), 'true');
    }, () => { window.ownedBefore = document.querySelector('#owned').innerHTML; });
  });

  it('does not toggle controlled wrappers or swallow their consumer handlers', async () => {
    await fixture('<div data-db-react><button class="db-switch" id="switch" aria-checked="false">Switch</button><button class="db-toggle db-btn--loading" id="toggle" aria-pressed="false">Toggle</button></div>', async page => {
      await page.locator('#switch').click();
      assert.equal(await page.locator('#switch').getAttribute('aria-checked'), 'false');
      await page.locator('#switch').focus(); await page.keyboard.press('Space');
      await page.locator('#toggle').dispatchEvent('click');
      assert.equal(await page.locator('#switch').getAttribute('aria-checked'), 'false');
      assert.equal(await page.locator('#toggle').getAttribute('aria-pressed'), 'false');
      assert.deepEqual(await page.evaluate(() => window.consumerClicks), ['switch', 'switch', 'toggle']);
    }, () => {
      window.consumerClicks = [];
      document.querySelectorAll('[data-db-react] button').forEach(el => el.addEventListener('click', () => window.consumerClicks.push(el.id)));
    });
  });

  it('leaves React-owned open menus alone when native outside-click handlers run', async () => {
    await fixture('<div data-db-react><div class="db-context-menu db-context-menu--open" id="context"><div class="db-context-menu__item">Action</div></div><nav class="db-navbar db-navbar--open" id="navbar"><button class="db-navbar__toggle" aria-expanded="true">Menu</button></nav></div><button id="outside">Outside</button>', async page => {
      await page.locator('#outside').dispatchEvent('click');
      assert.equal(await page.locator('#context').evaluate(el => el.classList.contains('db-context-menu--open')), true);
      assert.equal(await page.locator('#navbar').evaluate(el => el.classList.contains('db-navbar--open')), true);
    });
  });

  it('includes React-owned controls in native modal focus and respects cancelled Escape', async () => {
    await fixture('<button id="outside">Outside</button><div class="db-modal-overlay" id="modal"><div class="db-modal"><div data-db-react id="react-controls"><input id="field" aria-label="Name"><button class="db-toggle" aria-pressed="false" id="save">Save</button></div></div></div>', async page => {
      await page.locator('#outside').focus();
      await page.evaluate(() => DAUB.openModal('modal'));
      assert.equal(await page.evaluate(() => document.activeElement.id), 'field');
      await page.locator('#save').click();
      assert.equal(await page.locator('#save').getAttribute('aria-pressed'), 'false');
      await page.locator('#save').focus(); await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'field');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'save');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#modal').getAttribute('aria-hidden'), 'false');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'save');
      await page.evaluate(() => { window.cancelEscape = false; });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#modal').getAttribute('aria-hidden'), 'true');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');
    }, () => {
      window.cancelEscape = true;
      document.querySelector('#react-controls').addEventListener('keydown', event => {
        if (event.key === 'Escape' && window.cancelEscape) event.preventDefault();
      });
    });
  });
});
