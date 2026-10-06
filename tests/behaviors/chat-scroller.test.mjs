import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const source = readFileSync(new URL('../../daub.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }); });
after(async () => { await browser?.close(); });

function row(id, anchor = false, height = 80) {
  return `<div class="db-message-scroller__item" data-db-message-id="${id}"${anchor ? ' data-db-scroll-anchor="true"' : ''} style="min-height:${height}px">${id}</div>`;
}
function scroller(id = 'chat', attrs = '', rows = Array.from({ length: 8 }, (_, i) => row(`m${i}`)).join('')) {
  return `<section id="${id}" class="db-message-scroller" ${attrs}><div class="db-message-scroller__viewport"><div class="db-message-scroller__content">${rows}</div></div><button class="db-message-scroller__button" data-db-scroll-to="start">Start</button><button class="db-message-scroller__button" data-db-scroll-to="end">End</button></section>`;
}
async function fixture(html, run, options = {}) {
  const page = await browser.newPage({ viewport: { width: 500, height: 900 }, hasTouch: true, reducedMotion: options.reducedMotion || 'reduce' });
  page.setDefaultTimeout(2500);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const styles = options.fullCss ? `${css}\nbody{margin:0}.db-message-scroller{width:360px;--db-message-scroller-height:240px}` : '*{box-sizing:border-box}body{margin:0}.db-message-scroller{width:360px}.db-message-scroller__viewport{height:240px;overflow-y:auto;scroll-behavior:smooth;border:2px solid black}.db-message-scroller__content{padding:12px;display:flex;flex-direction:column;gap:8px}.db-message-scroller__item{flex-shrink:0}';
    await page.route('http://daub.test/', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>${styles}</style></head><body>${html}</body></html>` }));
    await page.goto('http://daub.test/');
    await page.evaluate(() => {
      window.events = [];
      document.addEventListener('db:message-scroll', e => window.events.push({ root: e.target.id, state: e.detail }));
      window.metrics = (id = 'chat') => {
        const root = document.getElementById(id), viewport = root.querySelector('.db-message-scroller__viewport');
        const handle = DAUB.createMessageScroller(root);
        return { top: viewport.scrollTop, max: viewport.scrollHeight - viewport.clientHeight, padding: root.querySelector('.db-message-scroller__content').style.paddingBottom, state: handle?.getState() };
      };
      window.append = (id, anchor = false, height = 80, rootId = 'chat') => {
        const item = document.createElement('div');
        item.className = 'db-message-scroller__item'; item.dataset.dbMessageId = id; item.style.minHeight = height + 'px'; item.textContent = id;
        if (anchor) item.dataset.dbScrollAnchor = 'true';
        document.getElementById(rootId).querySelector('.db-message-scroller__content').append(item);
      };
    });
    if (options.setup) await page.evaluate(options.setup);
    await page.addScriptTag({ content: source });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}
async function settled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
}
async function away(page, top = 180) {
  await page.evaluate(top => {
    const viewport = document.querySelector('#chat .db-message-scroller__viewport');
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    viewport.scrollTo({ top, behavior: 'instant' });
  }, top);
  await settled(page);
}

describe('Native MessageScroller', () => {
  it('exposes an idempotent handle and positions the initial end before returning', async () => {
    await fixture(scroller(), async page => {
      const result = await page.evaluate(() => {
        const root = document.getElementById('chat'), handle = DAUB.createMessageScroller(root);
        DAUB.init(); DAUB.init(root);
        return { api: typeof DAUB.createMessageScroller, same: handle === DAUB.createMessageScroller(root), ...metrics() };
      });
      assert.equal(result.api, 'function'); assert.equal(result.same, true);
      assert.equal(result.top, result.max); assert.equal(result.state.atEnd, true);
      assert.equal(result.state.atStart, false); assert.deepEqual(result.state.visibleMessageIds, ['m5', 'm6', 'm7']);
    });
  });

  it('follows appends and token growth, stays away, then resumes at the end', async () => {
    await fixture(scroller(), async page => {
      await page.evaluate(() => append('new')); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
      await page.evaluate(() => { document.querySelector('[data-db-message-id="new"]').style.minHeight = '300px'; }); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
      await away(page); const top = await page.evaluate(() => metrics().top);
      await page.evaluate(() => { append('later'); document.querySelector('[data-db-message-id="new"]').append(' streamed tokens'); }); await settled(page);
      assert.equal(await page.evaluate(() => metrics().top), top);
      await page.locator('#chat [data-db-scroll-to="end"]').click(); await settled(page);
      await page.evaluate(() => append('resumed')); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
    });
  });

  it('preserves a stable visible ID and pixel offset on prepends and media growth above it', async () => {
    await fixture(scroller(), async page => {
      await away(page, 230);
      const before = await page.evaluate(() => {
        const id = metrics().state.visibleMessageIds[0];
        return { id, y: document.querySelector(`[data-db-message-id="${id}"]`).getBoundingClientRect().top };
      });
      await page.evaluate(() => {
        const content = document.querySelector('#chat .db-message-scroller__content');
        const first = document.createElement('div'); first.dataset.dbMessageId = 'history'; first.style.height = '125px'; first.style.flexShrink = '0'; content.prepend(first);
      }); await settled(page);
      assert.equal(await page.evaluate(id => document.querySelector(`[data-db-message-id="${id}"]`).getBoundingClientRect().top, before.id), before.y);
      await page.evaluate(() => { document.querySelector('[data-db-message-id="history"]').style.height = '190px'; }); await settled(page);
      assert.equal(await page.evaluate(id => document.querySelector(`[data-db-message-id="${id}"]`).getBoundingClientRect().top, before.id), before.y);
    });
  });

  it('pins appended anchors with peek, consumes only needed spacer, and never pulls an away reader', async () => {
    await fixture(scroller('chat', 'data-db-scroll-peek="32"'), async page => {
      await page.evaluate(() => append('turn', true, 60)); await settled(page);
      let m = await page.evaluate(() => metrics());
      assert.equal(m.state.currentAnchorId, 'turn'); assert.equal(m.state.atEnd, true); assert.ok(parseFloat(m.padding) > 12);
      assert.equal(await page.evaluate(() => {
        const viewport = document.querySelector('#chat .db-message-scroller__viewport');
        return document.querySelector('[data-db-message-id="turn"]').getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop;
      }), 32);
      await page.evaluate(() => append('answer', false, 350)); await settled(page);
      m = await page.evaluate(() => metrics()); assert.equal(m.state.atEnd, true); assert.equal(m.padding, '');
      await away(page, 100); const top = await page.evaluate(() => metrics().top);
      await page.evaluate(() => append('ignored-turn', true)); await settled(page);
      assert.equal(await page.evaluate(() => metrics().top), top);
    });
  });

  it('supports initial start, last-anchor, empty-to-filled, and disabled automatic follow', async () => {
    await fixture(scroller('start', 'data-db-scroll-position="start"') + scroller('last', 'data-db-scroll-position="last-anchor" data-db-scroll-peek="0"', row('old', false, 300) + row('turn', true, 60)) + scroller('off', 'data-db-auto-scroll="false"') + scroller('empty', '', ''), async page => {
      assert.equal(await page.evaluate(() => metrics('start').top), 0);
      assert.equal(await page.evaluate(() => metrics('last').state.currentAnchorId), 'turn');
      const top = await page.evaluate(() => metrics('off').top);
      await page.evaluate(() => { append('more', false, 80, 'off'); append('first', false, 500, 'empty'); }); await settled(page);
      assert.equal(await page.evaluate(() => metrics('off').top), top);
      assert.equal(await page.evaluate(() => metrics('empty').state.atEnd), true);
    });
  });

  it('supports all message alignments, missing IDs, accessible controls, and reduced motion', async () => {
    await fixture(scroller(), async page => {
      const result = await page.evaluate(() => {
        const handle = DAUB.createMessageScroller(document.getElementById('chat'));
        const viewport = document.querySelector('#chat .db-message-scroller__viewport');
        const missing = handle.scrollToMessage('missing');
        const found = handle.scrollToMessage('m3', { behavior: 'smooth', block: 'center' });
        const centered = document.querySelector('[data-db-message-id="m3"]').getBoundingClientRect();
        const box = viewport.getBoundingClientRect();
        return { missing, found, centerDelta: centered.top + centered.height / 2 - box.top - viewport.clientTop - viewport.clientHeight / 2, tab: viewport.tabIndex, role: viewport.getAttribute('role'), label: viewport.getAttribute('aria-label'), controlLabels: [...document.querySelectorAll('[data-db-scroll-to]')].map(el => el.getAttribute('aria-label')) };
      });
      assert.equal(result.missing, false); assert.equal(result.found, true); assert.equal(result.centerDelta, 0);
      assert.equal(result.tab, 0); assert.equal(result.role, 'region'); assert.equal(result.label, 'Messages');
      assert.deepEqual(result.controlLabels, ['Scroll to first message', 'Scroll to latest message']);
      for (const block of ['start', 'end', 'nearest']) {
        assert.equal(await page.evaluate(block => DAUB.createMessageScroller(document.getElementById('chat')).scrollToMessage('m3', { block }), block), true);
      }
      await page.evaluate(() => DAUB.createMessageScroller(document.getElementById('chat')).scrollToStart()); await settled(page);
      await page.evaluate(() => append('away')); await settled(page); assert.equal(await page.evaluate(() => metrics().top), 0);
    });
  });

  it('disengages for keyboard and pointer intent, leaves editing keys alone, and resumes with End', async () => {
    await fixture(scroller(), async page => {
      const viewport = page.locator('#chat .db-message-scroller__viewport');
      await viewport.focus();
      await viewport.evaluate(el => { window.keyScrollEnded = false; el.addEventListener('scrollend', () => { window.keyScrollEnded = true; }, { once: true }); });
      await page.keyboard.press('PageUp'); await page.waitForFunction(() => window.keyScrollEnded); await settled(page);
      const top = await page.evaluate(() => metrics().top);
      await page.evaluate(() => append('key')); await settled(page); assert.equal(await page.evaluate(() => metrics().top), top);
      await page.keyboard.press('End'); await settled(page);
      await page.evaluate(() => append('end')); await settled(page); assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
      await viewport.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientY: 100 });
      await viewport.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientY: 160 });
      await page.evaluate(() => append('pointer')); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), false);
      await page.evaluate(() => {
        DAUB.createMessageScroller(document.getElementById('chat')).scrollToEnd();
        const input = document.createElement('input'); document.querySelector('[data-db-message-id="pointer"]').append(input); input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); append('edit');
      }); await settled(page); assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
    });
  });

  it('follows intrinsic image loads and viewport resizes without CSS from the library', async () => {
    await fixture(scroller(), async page => {
      await page.evaluate(() => {
        const img = document.createElement('img'); img.id = 'media';
        document.querySelector('[data-db-message-id="m7"]').append(img);
        img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="250" height="400"><rect width="250" height="400" fill="red"/></svg>');
      });
      await page.waitForFunction(() => document.getElementById('media').complete); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
      await page.evaluate(() => { document.querySelector('#chat .db-message-scroller__viewport').style.height = '180px'; }); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
    });
  });

  it('emits only changed state and cleans up on destroy, detach, and reinitialization', async () => {
    await fixture(scroller(), async page => {
      const count = await page.evaluate(() => events.length);
      await page.evaluate(() => { DAUB.init(); DAUB.init(document.getElementById('chat')); document.querySelector('[data-db-message-id="m7"]').append('token'); }); await settled(page);
      assert.equal(await page.evaluate(() => events.length), count);
      await page.evaluate(() => {
        window.oldHandle = DAUB.createMessageScroller(document.getElementById('chat'));
        oldHandle.destroy(); oldHandle.destroy();
      });
      await page.evaluate(() => append('destroyed')); await settled(page);
      assert.equal(await page.evaluate(() => events.length), count);
      assert.equal(await page.evaluate(() => oldHandle.scrollToEnd()), false);
      await page.evaluate(() => { DAUB.init(document.getElementById('chat')); window.newHandle = DAUB.createMessageScroller(document.getElementById('chat')); }); await settled(page);
      assert.equal(await page.evaluate(() => newHandle === oldHandle), false);
      await page.evaluate(() => { window.detached = document.getElementById('chat'); detached.remove(); }); await settled(page);
      assert.equal(await page.evaluate(() => newHandle.scrollToEnd()), false);
      await page.evaluate(() => { document.body.append(detached); DAUB.init(detached); }); await settled(page);
      assert.equal(await page.evaluate(() => DAUB.createMessageScroller(detached) === newHandle), false);
    });
  });

  it('keeps nested and React-owned roots, rows, controls, and event handlers independent', async () => {
    const inner = scroller('inner', '', row('nested', false, 400));
    await fixture(scroller('chat', '', row('a', false, 400) + `<div data-db-message-id="wrapper">${inner}</div>` + `<div data-db-react id="owned">${scroller('react')}</div>` + row('last', false, 300)), async page => {
      assert.equal(await page.evaluate(() => DAUB.createMessageScroller(document.getElementById('react'))), null);
      const outer = await page.evaluate(() => metrics().top);
      await page.locator('#inner [data-db-scroll-to="start"]').dispatchEvent('click'); await settled(page);
      assert.equal(await page.evaluate(() => metrics().top), outer);
      const state = await page.evaluate(() => metrics().state);
      assert.ok(!state.visibleMessageIds.includes('nested')); assert.ok(!state.visibleMessageIds.includes('m7'));
      assert.equal(await page.locator('#react .db-message-scroller__viewport').getAttribute('tabindex'), null);
      assert.equal(await page.locator('#react [data-db-scroll-to="end"]').getAttribute('aria-label'), null);
    });
  });

  it('keeps anchor detection independent of state reads and stable-ID DOM replacement', async () => {
    await fixture(scroller(), async page => {
      await page.evaluate(() => { append('turn', true, 60); metrics(); }); await settled(page);
      const top = await page.evaluate(() => metrics().top);
      assert.equal(await page.evaluate(() => metrics().state.currentAnchorId), 'turn');
      await page.evaluate(() => {
        const content = document.querySelector('#chat .db-message-scroller__content');
        content.replaceChildren(...[...content.children].map(child => child.cloneNode(true)));
      }); await settled(page);
      assert.equal(await page.evaluate(() => metrics().top), top);
      assert.equal(await page.evaluate(() => metrics().state.currentAnchorId), 'turn');
      await page.evaluate(() => append('answer', false, 90)); await settled(page);
      assert.equal(await page.evaluate(() => metrics().top), top);
    });
  });

  it('accepts explicit options, ignores invalid roots, and restores authored attributes on destroy', async () => {
    await fixture(scroller('chat', 'data-db-scroll-position="start"'), async page => {
      const result = await page.evaluate(() => {
        const root = document.getElementById('chat');
        DAUB.createMessageScroller(root).destroy();
        const viewport = root.querySelector('.db-message-scroller__viewport'), content = root.querySelector('.db-message-scroller__content');
        viewport.setAttribute('tabindex', '-1'); viewport.setAttribute('aria-label', 'Support history'); viewport.style.overflowAnchor = 'auto';
        content.style.setProperty('padding-bottom', '17px', 'important');
        const handle = DAUB.createMessageScroller(root, { scrollPosition: 'last-anchor', autoScroll: false, scrollPeek: 20 });
        const state = handle.getState();
        const invalid = DAUB.createMessageScroller(document.body), detached = DAUB.createMessageScroller(root.cloneNode(true));
        handle.destroy();
        return { state, invalid, detached, tab: viewport.getAttribute('tabindex'), label: viewport.getAttribute('aria-label'), role: viewport.getAttribute('role'), padding: content.style.paddingBottom, priority: content.style.getPropertyPriority('padding-bottom'), anchoring: viewport.style.overflowAnchor };
      });
      assert.equal(result.state.atEnd, true); assert.equal(result.invalid, null); assert.equal(result.detached, null);
      assert.equal(result.tab, '-1'); assert.equal(result.label, 'Support history'); assert.equal(result.role, null);
      assert.equal(result.padding, '17px'); assert.equal(result.priority, 'important'); assert.equal(result.anchoring, 'auto');
    });
  });

  it('keeps a smooth explicit message jump disengaged and lets a wheel gesture interrupt it', async () => {
    await fixture(scroller(), async page => {
      await page.evaluate(() => {
        const handle = DAUB.createMessageScroller(document.getElementById('chat'));
        handle.scrollToStart();
        handle.scrollToMessage('m7', { block: 'start', behavior: 'smooth' });
        document.querySelector('[data-db-message-id="m7"]').append('token');
      });
      await page.waitForFunction(() => metrics().state.atEnd);
      await page.evaluate(() => append('manual')); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), false);
      await page.evaluate(() => {
        const viewport = document.querySelector('#chat .db-message-scroller__viewport');
        DAUB.createMessageScroller(document.getElementById('chat')).scrollToEnd({ behavior: 'smooth' });
        viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }));
        append('interrupt');
      }); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), false);
    }, { reducedMotion: 'no-preference' });
  });

  it('preserves the reading offset on prepends while following the end or an anchor with parent CSS', async () => {
    await fixture(scroller('chat', 'data-db-scroll-peek="24"'), async page => {
      async function prependAndCompare() {
        const before = await page.evaluate(() => {
          const state = metrics().state, id = state.visibleMessageIds[0];
          return { id, y: document.querySelector(`[data-db-message-id="${id}"]`).getBoundingClientRect().top };
        });
        await page.evaluate(() => {
          const item = document.createElement('div'); item.className = 'db-message-scroller__item';
          item.dataset.dbMessageId = 'history-' + document.querySelectorAll('[data-db-message-id]').length;
          item.dataset.dbScrollAnchor = 'true'; item.style.minHeight = '130px';
          document.querySelector('#chat .db-message-scroller__content').prepend(item);
        }); await settled(page);
        assert.equal(await page.evaluate(id => document.querySelector(`[data-db-message-id="${id}"]`).getBoundingClientRect().top, before.id), before.y);
        assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
      }
      await prependAndCompare();
      await page.evaluate(() => append('turn', true, 50)); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.currentAnchorId), 'turn');
      await prependAndCompare();
      assert.equal(await page.evaluate(() => metrics().state.currentAnchorId), 'turn');
      await page.evaluate(() => append('answer', false, 100)); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
    }, { fullCss: true });
  });

  it('makes room for an early short anchor inside parent min-height content and shrinks padding after growth', async () => {
    await fixture(scroller('chat', 'data-db-scroll-peek="12"', row('first', false, 30)), async page => {
      await page.evaluate(() => append('turn', true, 30)); await settled(page);
      assert.equal(await page.evaluate(() => {
        const viewport = document.querySelector('#chat .db-message-scroller__viewport');
        return document.querySelector('[data-db-message-id="turn"]').getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop;
      }), 12);
      assert.equal(await page.evaluate(() => metrics().state.currentAnchorId), 'turn');
      assert.ok(parseFloat(await page.evaluate(() => metrics().padding)) > 16);
      await page.evaluate(() => append('answer', false, 400)); await settled(page);
      assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
      assert.equal(await page.evaluate(() => metrics().padding), '');
    }, { fullCss: true });
  });

  it('aligns nearest to the closest edge for messages taller than the viewport', async () => {
    await fixture(scroller('chat', 'data-db-scroll-position="start"', row('before') + row('tall', false, 400) + row('after', false, 400)), async page => {
      function bounds() {
        const viewport = document.querySelector('#chat .db-message-scroller__viewport'), rect = document.querySelector('[data-db-message-id="tall"]').getBoundingClientRect();
        return { top: rect.top - viewport.getBoundingClientRect().top - viewport.clientTop, bottom: rect.bottom - viewport.getBoundingClientRect().top - viewport.clientTop - viewport.clientHeight };
      }
      await page.evaluate(() => DAUB.createMessageScroller(document.getElementById('chat')).scrollToMessage('tall', { block: 'nearest' }));
      assert.equal((await page.evaluate(bounds)).top, 0);
      await page.evaluate(() => {
        const handle = DAUB.createMessageScroller(document.getElementById('chat'));
        handle.scrollToEnd(); handle.scrollToMessage('tall', { block: 'nearest' });
      });
      assert.equal((await page.evaluate(bounds)).bottom, 0);
      await page.evaluate(() => {
        const handle = DAUB.createMessageScroller(document.getElementById('chat'));
        handle.scrollToMessage('tall', { block: 'center' }); window.beforeNearest = metrics().top;
        handle.scrollToMessage('tall', { block: 'nearest' });
      });
      assert.equal(await page.evaluate(() => metrics().top), await page.evaluate(() => beforeNearest));
    });
  });

  it('disconnects observers on viewport removal and releases the shared cleanup observer after the final root', async () => {
    await fixture(scroller() + scroller('other'), async page => {
      const count = () => page.evaluate(() => observerTargets.filter(set => [...set].some(el => el === document.documentElement || el.matches?.('.db-message-scroller, .db-message-scroller__viewport, .db-message-scroller__content, [data-db-message-id]'))).length);
      assert.equal(await count(), 5);
      await page.evaluate(() => { DAUB.init(); DAUB.init(); }); await settled(page);
      assert.equal(await count(), 5);
      const moved = await page.evaluate(() => {
        const handle = DAUB.createMessageScroller(document.getElementById('chat'));
        document.querySelector('#chat .db-message-scroller__viewport').remove();
        return handle.scrollToEnd();
      });
      assert.equal(moved, false);
      await settled(page); assert.equal(await count(), 3);
      await page.evaluate(() => { document.getElementById('other').setAttribute('data-db-react', ''); }); await settled(page);
      assert.equal(await count(), 0);
    }, { setup: () => {
      window.observerTargets = [];
      for (const name of ['ResizeObserver', 'MutationObserver']) {
        const Native = window[name];
        window[name] = class extends Native {
          constructor(callback) { super(callback); this.targets = new Set(); observerTargets.push(this.targets); }
          observe(target, options) { this.targets.add(target); return super.observe(target, options); }
          unobserve(target) { this.targets.delete(target); return super.unobserve(target); }
          disconnect() { this.targets.clear(); return super.disconnect(); }
        };
      }
    } });
  });

  it('releases real wheel and touch scrolling and resumes after the reader scrolls back to the end', async () => {
    await fixture(scroller(), async page => {
      const viewport = page.locator('#chat .db-message-scroller__viewport'), box = await viewport.boundingBox();
      await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.wheel(0, -160);
      await page.waitForFunction(() => metrics().top < metrics().max - 100); await settled(page);
      const before = await page.evaluate(() => metrics().top);
      await page.evaluate(() => append('wheel')); await settled(page); assert.equal(await page.evaluate(() => metrics().top), before);
      await page.mouse.wheel(0, 2000); await page.waitForFunction(() => metrics().state.atEnd); await settled(page);
      await page.evaluate(() => append('wheel-resume')); await settled(page); assert.equal(await page.evaluate(() => metrics().state.atEnd), true);
      const session = await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 100, y: box.y + 70, id: 1 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 100, y: box.y + 165, id: 1 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => !metrics().state.atEnd); await settled(page);
      const at = await page.evaluate(() => metrics().top);
      await page.evaluate(() => append('touch')); await settled(page);
      assert.ok(await page.evaluate(() => metrics().top) <= at);
      await session.detach();
    });
  });
});
