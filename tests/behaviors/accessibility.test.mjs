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
  const page = await browser.newPage();
  page.setDefaultTimeout(2000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('http://daub.test/', route => route.fulfill({
      contentType: 'text/html', body: `<html><head><style>${css}</style><style>*,*::before,*::after{transition:none!important;animation:none!important}</style></head><body>${html}</body></html>`
    }));
    await page.goto('http://daub.test/');
    if (setup) await page.evaluate(setup);
    await page.addScriptTag({ content: source });
    await run(page);
    assert.deepEqual(errors, [], 'browser script errors');
  } finally { await page.close(); }
}

async function attr(page, selector, name) { return page.locator(selector).getAttribute(name); }
async function focused(page) { return page.evaluate(() => document.activeElement.id); }

describe('DAUB interactive accessibility', () => {
  it('initializes and reinitializes catalog markup in an opaque-origin sandbox', async () => {
    const catalog = JSON.parse(readFileSync(new URL('../../components.json', import.meta.url), 'utf8'));
    await fixture('<iframe sandbox="allow-scripts allow-forms" id="preview"></iframe>', async page => {
      await page.locator('#preview').evaluate((iframe, source) => {
        iframe.srcdoc = `<html><body><div class="db-switch" id="initial">Switch</div><script>${source}<\/script></body></html>`;
      }, source);
      const frame = page.frames().find(frame => frame.parentFrame());
      await frame.waitForFunction(() => window.DAUB);
      assert.equal(await frame.locator('#initial').getAttribute('role'), 'switch');
      await frame.evaluate(markup => {
        document.body.innerHTML = markup;
        DAUB.init(); DAUB.init();
        DAUB.setTemperature(0.5); DAUB.setTemperature('auto'); DAUB.setTemperature(0);
        DAUB.getTemperature(); DAUB.setTexture('paper'); DAUB.setAccent('#112233');
      }, catalog.components.map(component => component.html || '').join('\n'));
      assert.equal(await frame.locator('.db-switch').first().getAttribute('role'), 'switch');
      assert.equal(await frame.locator('.db-collapsible__trigger').first().getAttribute('aria-expanded'), 'false');
    });
  });

  it('opens catalog sheet and drawer triggers and synchronizes expanded state', async () => {
    await fixture('<button id="sheet-trigger" data-db-sheet-trigger="sheet">Sheet</button><div id="sheet" class="db-sheet"><div class="db-sheet__overlay"></div><div class="db-sheet__panel"><button class="db-sheet__close">Close</button></div></div><button id="drawer-trigger" data-db-drawer-trigger="drawer">Drawer</button><div id="drawer" class="db-drawer"><div class="db-drawer__overlay"></div><div class="db-drawer__panel"><button data-action="cancel">Close</button></div></div>', async page => {
      for (const name of ['sheet', 'drawer']) {
        await page.locator(`#${name}-trigger`).click();
        assert.equal(await attr(page, `#${name}-trigger`, 'aria-expanded'), 'true');
        await page.keyboard.press('Escape');
        assert.equal(await attr(page, `#${name}-trigger`, 'aria-expanded'), 'false');
      }
    });
  });

  it('isolates background controls while an overlay owns focus', async () => {
    await fixture('<button id="background">Background</button><div class="db-sheet" id="sheet"><div class="db-sheet__panel"><button id="inside">Inside</button></div></div>', async page => {
      await page.evaluate(() => DAUB.openSheet('sheet'));
      assert.equal(await page.locator('#background').evaluate(el => el.inert), true);
      await page.evaluate(() => document.querySelector('#background').focus());
      assert.equal(await focused(page), 'inside');
      await page.evaluate(() => DAUB.closeSheet('sheet'));
      assert.equal(await page.locator('#background').evaluate(el => el.inert), false);
    });
  });

  it('keeps native dialog padding clicks inside and cleans up direct close', async () => {
    await fixture('<button id="opener">Open</button><dialog class="db-modal" id="dialog"><button>Action</button></dialog>', async page => {
      await page.locator('#opener').focus();
      await page.evaluate(() => DAUB.openModal('dialog'));
      await page.locator('#dialog').click({ position: { x: 5, y: 5 } });
      assert.equal(await page.locator('#dialog').evaluate(el => el.open), true);
      await page.evaluate(() => document.querySelector('#dialog').close());
      await page.waitForFunction(() => document.activeElement.id === 'opener' && document.querySelector('#dialog').getAttribute('aria-hidden') === 'true');
      assert.equal(await attr(page, '#dialog', 'aria-hidden'), 'true');
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    });
  });

  it('uses a theme picker inside forms without submitting', async () => {
    await fixture('<form><div class="db-theme-switcher"></div></form>', async page => {
      await page.evaluate(() => { window.submits = 0; document.querySelector('form').addEventListener('submit', e => { e.preventDefault(); window.submits++; }); });
      await page.locator('.db-theme-switcher__toggle').focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await attr(page, '.db-theme-switcher__toggle', 'aria-expanded'), 'true');
      await page.locator('[data-family="bone"]').click();
      assert.equal(await page.evaluate(() => window.submits), 0);
      await page.keyboard.press('Escape');
      assert.equal(await attr(page, '.db-theme-switcher__toggle', 'aria-expanded'), 'false');
    });
  });

  it('retains disabled calendar days and skips them with arrow keys', async () => {
    await fixture('<div class="db-calendar"><span class="db-calendar__title">January 2026</span><div class="db-calendar__grid"><button class="db-calendar__day db-calendar__day--disabled">2</button></div></div>', async page => {
      assert.equal(await page.locator('[data-day="2"]').isDisabled(), true);
      await page.locator('[data-day="1"]').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-day')), '3');
    });
  });

  it('keeps nested accordion state when opening its parent sibling', async () => {
    await fixture('<div class="db-accordion"><div class="db-accordion__item db-accordion__item--open"><button class="db-accordion__trigger" id="parent">Parent</button><div class="db-accordion__content"><div class="db-accordion"><div class="db-accordion__item db-accordion__item--open"><button class="db-accordion__trigger" id="child">Child</button><div class="db-accordion__content">Child content</div></div></div></div></div><div class="db-accordion__item"><button class="db-accordion__trigger" id="sibling">Sibling</button><div class="db-accordion__content">Sibling content</div></div></div>', async page => {
      await page.locator('#sibling').click();
      assert.equal(await attr(page, '#child', 'aria-expanded'), 'true');
      assert.equal(await attr(page, '#parent', 'aria-expanded'), 'false');
    });
  });

  it('synchronizes carousel state and prevents focus in inactive slides', async () => {
    await fixture('<div class="db-carousel"><div class="db-carousel__track"><div class="db-carousel__slide" id="slide-one"><button>One</button></div><div class="db-carousel__slide" id="slide-two"><button>Two</button></div></div><button class="db-carousel__btn--next" id="next">Next</button><button class="db-carousel__dot" id="dot-one"></button><button class="db-carousel__dot" id="dot-two"></button></div>', async page => {
      assert.equal(await page.locator('#slide-two').evaluate(el => el.inert), true);
      await page.locator('#next').click();
      assert.equal(await attr(page, '#dot-two', 'aria-current'), 'true');
      assert.equal(await attr(page, '#slide-one', 'aria-hidden'), 'true');
      assert.equal(await page.locator('#slide-two').evaluate(el => el.inert), false);
    });
  });

  it('navigates menubar entries without resetting submenu focus', async () => {
    await fixture('<div class="db-menubar"><div class="db-menubar__item" id="file" tabindex="0">File<div class="db-menubar__dropdown"><button class="db-dropdown__item" id="new">New</button><button class="db-dropdown__item" id="open">Open</button></div></div><div class="db-menubar__item" id="edit" tabindex="0">Edit<div class="db-menubar__dropdown"><button class="db-dropdown__item">Copy</button></div></div></div>', async page => {
      await page.locator('#file').focus();
      await page.keyboard.press('Enter');
      assert.equal(await attr(page, '#file', 'aria-expanded'), 'true');
      await page.keyboard.press('ArrowDown');
      assert.equal(await focused(page), 'new');
      await page.keyboard.press('ArrowDown');
      assert.equal(await focused(page), 'open');
      await page.keyboard.press('Escape');
      assert.equal(await focused(page), 'file');
      await page.keyboard.press('ArrowRight');
      assert.equal(await focused(page), 'edit');
    });
  });

  it('opens command triggers and closes the palette on pointer activation', async () => {
    await fixture('<button data-db-command-trigger="cmd" id="trigger">Commands</button><div class="db-command" id="cmd"><div class="db-command__panel"><input class="db-command__input"><div class="db-command__list"><div class="db-command__item" id="action">Action</div></div></div></div>', async page => {
      await page.locator('#trigger').click();
      assert.equal(await attr(page, '#trigger', 'aria-expanded'), 'true');
      await page.locator('#action').click();
      assert.equal(await attr(page, '#cmd', 'aria-hidden'), 'true');
      assert.equal(await focused(page), 'trigger');
    });
  });

  it('restores scroll and inert state after replacing an open preview', async () => {
    await fixture('<main id="root"><button id="outside">Outside</button><div class="db-sheet" id="sheet"><div class="db-sheet__panel"><button>Inside</button></div></div></main><aside id="preserved" inert>Existing inert</aside>', async page => {
      await page.evaluate(() => { document.body.style.overflow = 'clip'; DAUB.openSheet('sheet'); document.querySelector('#root').innerHTML = '<div class="db-switch" id="new">New</div>'; DAUB.init(); });
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'clip');
      assert.equal(await page.locator('#preserved').evaluate(el => el.inert), true);
      await page.locator('#new').click();
      assert.equal(await attr(page, '#new', 'aria-checked'), 'true');
    });
  });

  it('keeps the overlay open when Escape closes a nested dropdown', async () => {
    await fixture('<div class="db-sheet" id="sheet"><div class="db-sheet__panel"><div class="db-dropdown"><button class="db-dropdown__trigger" id="trigger">Menu</button><div class="db-dropdown__content"><div class="db-dropdown__item" id="action">Action</div></div></div></div></div>', async page => {
      await page.evaluate(() => DAUB.openSheet('sheet'));
      await page.locator('#trigger').focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
      assert.equal(await attr(page, '#sheet', 'aria-hidden'), 'false');
      assert.equal(await attr(page, '#trigger', 'aria-expanded'), 'false');
      await page.keyboard.press('Escape');
      assert.equal(await attr(page, '#sheet', 'aria-hidden'), 'true');
    });
  });

  it('shows focused tooltips and consumes Escape before the enclosing overlay', async () => {
    await fixture('<div class="db-sheet" id="sheet"><div class="db-sheet__panel"><div class="db-tooltip"><button id="trigger">Info</button><span class="db-tooltip__content" id="tip">Tip</span></div></div></div>', async page => {
      await page.evaluate(() => DAUB.openSheet('sheet'));
      assert.equal(await page.locator('#tip').isVisible(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#tip').isVisible(), false);
      assert.equal(await attr(page, '#sheet', 'aria-hidden'), 'false');
      await page.keyboard.press('Escape');
      assert.equal(await attr(page, '#sheet', 'aria-hidden'), 'true');
    });
  });

  it('closes overlays that start open in author markup', async () => {
    await fixture('<div class="db-sheet db-sheet--open" id="sheet"><div class="db-sheet__panel">Panel</div></div>', async page => {
      await page.evaluate(() => DAUB.closeSheet('sheet'));
      assert.equal(await attr(page, '#sheet', 'aria-hidden'), 'true');
      assert.equal(await page.locator('#sheet').evaluate(el => el.classList.contains('db-sheet--open')), false);
    });
  });
  it('initializes components when browser storage throws', async () => {
    await fixture('<div class="db-switch" id="switch">Enabled</div>', async page => {
      await page.locator('#switch').click();
      assert.equal(await attr(page, '#switch', 'aria-checked'), 'true');
      await page.evaluate(() => { DAUB.setTemperature(0.2); DAUB.setTexture('paper'); });
    }, () => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  });

  it('ignores disabled and loading switches and toggles a native button once', async () => {
    await fixture('<div class="db-switch" id="disabled" aria-disabled="true">Disabled</div><button class="db-switch" id="native">Native</button><button class="db-toggle db-btn--loading" id="loading">Busy</button>', async page => {
      await page.locator('#disabled').dispatchEvent('click');
      assert.equal(await attr(page, '#disabled', 'aria-checked'), 'false');
      await page.locator('#loading').dispatchEvent('click');
      assert.notEqual(await attr(page, '#loading', 'aria-pressed'), 'true');
      await page.locator('#native').focus();
      await page.keyboard.press('Enter');
      assert.equal(await attr(page, '#native', 'aria-checked'), 'true');
    });
  });

  it('deselects the active single-group toggle and synchronizes its class', async () => {
    await fixture('<div class="db-toggle-group"><button id="toggle" class="db-toggle db-toggle--active" aria-pressed="true">Bold</button></div>', async page => {
      await page.locator('#toggle').click();
      assert.equal(await attr(page, '#toggle', 'aria-pressed'), 'false');
      assert.equal(await page.locator('#toggle').evaluate(el => el.classList.contains('db-toggle--active')), false);
    });
  });

  it('skips disabled tabs, uses vertical arrows, and tolerates missing markup', async () => {
    await fixture('<div class="db-tabs"></div><div class="db-tabs"><div class="db-tabs__list" aria-orientation="vertical"><button class="db-tabs__tab" id="one">One</button><button class="db-tabs__tab" disabled>Disabled</button><button class="db-tabs__tab" id="three">Three</button></div><div class="db-tabs__panel">One</div><div class="db-tabs__panel">Disabled</div><div class="db-tabs__panel" id="panel">Three</div></div>', async page => {
      await page.locator('#one').focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await focused(page), 'three');
      assert.equal(await attr(page, '#three', 'aria-selected'), 'true');
      assert.equal(await attr(page, '#panel', 'hidden'), null);
    });
  });

  it('initializes disclosure relationships and supports repeated document init', async () => {
    await fixture('<div class="db-accordion"><div class="db-accordion__item db-accordion__item--open"><button class="db-accordion__trigger" id="question">Question</button><div class="db-accordion__content" id="answer">Answer</div></div></div>', async page => {
      assert.equal(await attr(page, '#question', 'aria-expanded'), 'true');
      assert.equal(await attr(page, '#question', 'aria-controls'), 'answer');
      await page.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend', '<div class="db-collapsible"><button class="db-collapsible__trigger" id="new">New</button><div class="db-collapsible__content" id="new-content">Content</div></div>');
        DAUB.init(); DAUB.init();
      });
      await page.locator('#new').click();
      assert.equal(await attr(page, '#new', 'aria-expanded'), 'true');
      assert.equal(await attr(page, '#new-content', 'hidden'), null);
    });
  });

  for (const name of ['sheet', 'drawer', 'alert-dialog', 'command']) {
    const methods = { sheet: 'Sheet', drawer: 'Drawer', 'alert-dialog': 'AlertDialog', command: 'Command' };
    it(`${name} traps focus, handles Escape, and restores focus and scroll`, async () => {
      await fixture(`<button id="opener">Open</button><div class="db-${name}" id="overlay"><div class="db-${name}__overlay"></div><div class="db-${name}__panel"><h2 class="db-${name}__title">Title</h2><button id="first" data-action="cancel">First</button><button id="last">Last</button></div></div>`, async page => {
        await page.locator('#opener').focus();
        await page.evaluate(method => { document.body.style.overflow = 'clip'; DAUB['open' + method]('overlay'); }, methods[name]);
        assert.equal(await attr(page, '#overlay', 'aria-hidden'), 'false');
        assert.equal(await attr(page, `.db-${name}__panel`, 'aria-modal'), 'true');
        await page.locator('#last').focus();
        await page.keyboard.press('Tab');
        assert.equal(await focused(page), 'first');
        await page.keyboard.press('Escape');
        assert.equal(await attr(page, '#overlay', 'aria-hidden'), 'true');
        assert.equal(await focused(page), 'opener');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'clip');
      });
    });
  }

  it('keeps nested modal focus and scroll ownership and focuses an empty dialog', async () => {
    await fixture('<button id="opener">Open</button><div id="outer" class="db-modal-overlay"><div class="db-modal"><button id="inner-opener">Inner</button></div></div><div id="inner" class="db-modal-overlay"><div class="db-modal" id="empty">Empty</div></div>', async page => {
      await page.locator('#opener').focus();
      await page.evaluate(() => DAUB.openModal('outer'));
      await page.locator('#inner-opener').focus();
      await page.evaluate(() => DAUB.openModal('inner'));
      assert.equal(await focused(page), 'empty');
      await page.keyboard.press('Escape');
      assert.equal(await attr(page, '#inner', 'aria-hidden'), 'true');
      assert.equal(await attr(page, '#outer', 'aria-hidden'), 'false');
      assert.equal(await focused(page), 'inner-opener');
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await page.keyboard.press('Escape');
      assert.equal(await focused(page), 'opener');
    });
  });

  it('keeps a popover open for content clicks and restores focus on Escape', async () => {
    await fixture('<div class="db-popover"><button class="db-popover__trigger" id="trigger">Open</button><div class="db-popover__content"><input id="inside"></div></div><button id="outside">Outside</button>', async page => {
      await page.locator('#trigger').click();
      assert.equal(await attr(page, '#trigger', 'aria-expanded'), 'true');
      await page.locator('#inside').click();
      assert.equal(await attr(page, '#trigger', 'aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await focused(page), 'trigger');
      assert.equal(await attr(page, '#trigger', 'aria-expanded'), 'false');
      await page.locator('#trigger').click();
      await page.locator('#outside').click();
      assert.equal(await attr(page, '#trigger', 'aria-expanded'), 'false');
    });
  });

  it('opens and traverses a dropdown menu with the keyboard', async () => {
    await fixture('<div class="db-dropdown"><button id="trigger" class="db-dropdown__trigger">Menu</button><div class="db-dropdown__content"><div id="alpha" class="db-dropdown__item">Alpha</div><div class="db-dropdown__item db-dropdown__item--disabled">Disabled</div><div id="omega" class="db-dropdown__item">Omega</div></div></div>', async page => {
      await page.locator('#trigger').focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await focused(page), 'alpha');
      assert.equal(await attr(page, '#trigger', 'aria-expanded'), 'true');
      await page.keyboard.press('ArrowDown');
      assert.equal(await focused(page), 'omega');
      await page.keyboard.press('Escape');
      assert.equal(await focused(page), 'trigger');
      assert.equal(await attr(page, '#trigger', 'aria-expanded'), 'false');
    });
  });

  it('selects a custom option by keyboard and synchronizes ARIA', async () => {
    await fixture('<div class="db-custom-select"><button class="db-custom-select__trigger" id="trigger"><span class="db-custom-select__placeholder">Select</span></button><div class="db-custom-select__dropdown"><div class="db-custom-select__option" id="a">Alpha</div><div class="db-custom-select__option db-custom-select__option--disabled">Disabled</div><div class="db-custom-select__option" id="b">Beta</div></div></div>', async page => {
      await page.locator('#trigger').focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await focused(page), 'a');
      await page.keyboard.press('ArrowDown');
      assert.equal(await focused(page), 'b');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#trigger').textContent(), 'Beta');
      assert.equal(await attr(page, '#b', 'aria-selected'), 'true');
      assert.equal(await attr(page, '#a', 'aria-selected'), 'false');
      assert.equal(await attr(page, '#trigger', 'aria-expanded'), 'false');
      assert.equal(await focused(page), 'trigger');
    });
  });

  it('opens a context menu with Shift+F10 and restores its invoker', async () => {
    await fixture('<button id="target" data-context-menu="menu">Context</button><div class="db-context-menu" id="menu"><div class="db-context-menu__item" id="action">Action</div></div>', async page => {
      await page.locator('#target').focus();
      await page.keyboard.press('Shift+F10');
      assert.equal(await focused(page), 'action');
      await page.keyboard.press('Escape');
      assert.equal(await focused(page), 'target');
    });
  });

  it('resets command filtering on reopen and activates commands by keyboard', async () => {
    await fixture('<button id="opener">Open</button><div class="db-command" id="command"><div class="db-command__overlay"></div><div class="db-command__panel"><input class="db-command__input" id="search"><div class="db-command__list"><div class="db-command__item" id="alpha">Alpha</div><div class="db-command__item" id="beta">Beta</div><div class="db-command__empty">Empty</div></div></div></div>', async page => {
      await page.evaluate(() => { window.activated = 0; document.querySelector('#beta').addEventListener('click', () => window.activated++); DAUB.openCommand('command'); });
      await page.locator('#search').fill('missing');
      await page.evaluate(() => { DAUB.closeCommand('command'); DAUB.openCommand('command'); });
      assert.equal(await page.locator('#alpha').isVisible(), true);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => window.activated), 1);
    });
  });

  it('preserves tooltip descriptions and dismisses a focused tooltip', async () => {
    await fixture('<span id="help">Help</span><div class="db-tooltip"><button id="trigger" aria-describedby="help">Info</button><span class="db-tooltip__content" id="tip">Tip</span></div>', async page => {
      assert.equal(await attr(page, '#trigger', 'aria-describedby'), 'help tip');
      await page.locator('#trigger').focus();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#tip').isVisible(), false);
    });
  });

  it('sorts a table by keyboard and excludes disabled rows from select-all', async () => {
    await fixture('<table class="db-data-table"><thead><tr><th><input class="db-data-table__check" id="all" type="checkbox"></th><th data-sortable id="sort">Name</th></tr></thead><tbody><tr><td><input class="db-data-table__check" id="locked" type="checkbox" disabled></td><td>Zulu</td></tr><tr><td><input class="db-data-table__check" id="row" type="checkbox"></td><td>Alpha</td></tr></tbody></table>', async page => {
      await page.locator('#all').check();
      assert.equal(await page.locator('#locked').isChecked(), false);
      assert.equal(await page.locator('#row').isChecked(), true);
      await page.locator('#sort').focus();
      await page.keyboard.press('Enter');
      assert.equal(await attr(page, '#sort', 'aria-sort'), 'ascending');
      assert.equal(await page.locator('tbody tr').first().textContent(), 'Alpha');
    });
  });

  it('pastes OTP from the current field and emits input events', async () => {
    await fixture('<div class="db-otp"><input class="db-otp__input" id="one" value="1"><input class="db-otp__input" id="two"><input class="db-otp__input" id="three"></div>', async page => {
      await page.evaluate(() => {
        window.inputEvents = 0;
        document.querySelector('.db-otp').addEventListener('input', () => window.inputEvents++);
        const data = new DataTransfer(); data.setData('text', '23');
        document.querySelector('#two').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      });
      assert.equal(await page.locator('#one').inputValue(), '1');
      assert.equal(await page.locator('#two').inputValue(), '2');
      assert.equal(await page.locator('#three').inputValue(), '3');
      assert.equal(await page.evaluate(() => window.inputEvents), 2);
    });
  });

  it('synchronizes navigation and chip state after keyboard interaction', async () => {
    await fixture('<nav class="db-navbar" id="nav"><button class="db-navbar__toggle" id="menu">Menu</button></nav><div class="db-sidebar" id="side"><button class="db-sidebar__toggle" id="side-toggle">Collapse</button></div><div data-db-chip-toggle data-db-chip-mode="single"><span class="db-chip" id="chip">One</span><span class="db-chip db-chip--active" id="active">Two</span></div>', async page => {
      await page.evaluate(() => { DAUB.toggleNavbar('#nav'); DAUB.toggleSidebar('#side'); });
      assert.equal(await attr(page, '#menu', 'aria-expanded'), 'true');
      assert.equal(await attr(page, '#side-toggle', 'aria-expanded'), 'false');
      await page.locator('#chip').focus();
      await page.keyboard.press('Space');
      assert.equal(await attr(page, '#chip', 'aria-pressed'), 'true');
      assert.equal(await attr(page, '#active', 'aria-pressed'), 'false');
    });
  });

  it('labels calendar dates and synchronizes selection with keyboard movement', async () => {
    await fixture('<div class="db-calendar"><div class="db-calendar__title">January 2026</div><div class="db-calendar__grid"></div></div>', async page => {
      const first = page.locator('[data-day="1"]');
      assert.equal(await first.getAttribute('aria-label'), 'January 1, 2026');
      await first.focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-day')), '2');
      await page.keyboard.press('Enter');
      assert.equal(await attr(page, '[data-day="2"]', 'aria-pressed'), 'true');
      assert.equal(await attr(page, '[data-day="1"]', 'aria-pressed'), 'false');
    });
  });

  it('supports keyboard resizing and constrains dimensions to positive values', async () => {
    await fixture('<div class="db-resizable" id="box" style="width:200px;height:120px"><div class="db-resizable__handle db-resizable__handle--right" id="handle"></div></div>', async page => {
      await page.locator('#handle').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#box').evaluate(el => el.style.width), '210px');
      assert.equal(await attr(page, '#handle', 'role'), 'separator');
    });
  });
});
