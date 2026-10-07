import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const assets = new Map();
for (const file of ['docs.html', 'themes.html', 'theme-preview.html', 'site-nav.js', 'components.json', 'daub.js', 'daub.css', 'assets/lucide.min.js']) {
  assets.set('/' + file, await readFile(new URL(file, root), 'utf8'));
}
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); });

async function withPage(path, run, setup) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.setDefaultTimeout(2000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'daub.test') return route.abort();
    const body = assets.get(url.pathname);
    if (!body) return route.fulfill({ status: 404, body: '' });
    const contentType = url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.json') ? 'application/json' : 'text/html';
    return route.fulfill({ body, contentType });
  });
  try {
    if (setup) await setup(page);
    await page.goto('http://daub.test/' + path);
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.locator(path === 'docs.html' ? '#alert-dialog .docs-component__copy' : path === 'themes.html' ? '#tg-grid .tg-card' : '#css-input').first().waitFor();
    await run(page);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function withDocs(run, setup) { return withPage('docs.html', run, setup); }

async function assertAlertDialogExample(page, sample) {
  const trigger = sample.getByRole('button', { name: 'Delete draft', exact: true }).and(sample.locator('[data-db-trigger]'));
  assert.equal(await trigger.count(), 1);
  assert.equal(await trigger.isVisible(), true);
  const overlay = sample.locator('.db-alert-dialog');
  const dialog = sample.locator('.db-alert-dialog__panel');
  assert.equal(await dialog.isVisible(), false);
  assert.equal(await trigger.getAttribute('data-db-trigger'), await overlay.getAttribute('id'));
  for (const dismiss of ['cancel', 'confirm', 'escape', 'backdrop']) {
    await trigger.click();
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await sample.getByRole('alertdialog', { name: 'Delete this draft?', exact: true }).isVisible(), true);
    assert.equal(await dialog.locator('.db-alert-dialog__desc').textContent(), 'This action cannot be undone.');
    assert.equal(await dialog.getAttribute('aria-describedby'), await dialog.locator('.db-alert-dialog__desc').getAttribute('id'));
    assert.equal(await overlay.getAttribute('aria-hidden'), 'false');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
    const confirm = dialog.getByRole('button', { name: 'Delete draft', exact: true });
    assert.equal(await cancel.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await confirm.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await cancel.evaluate(element => element === document.activeElement), true);
    assert.equal(await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && element.scrollWidth <= element.clientWidth;
    }), true);
    if (dismiss === 'cancel') await cancel.click();
    else if (dismiss === 'confirm') await confirm.click();
    else if (dismiss === 'escape') await page.keyboard.press('Escape');
    else await sample.locator('.db-alert-dialog__overlay').click({ position: { x: 1, y: 1 } });
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await overlay.getAttribute('aria-hidden'), 'true');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  }
}

for (const width of [320, 1280]) {
  for (const theme of ['light', 'dark']) {
    test('docs Alert Dialog shows content, traps focus, and dismisses at ' + width + 'px in ' + theme, async () => {
      await withDocs(async page => {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        await assertAlertDialogExample(page, page.locator('#alert-dialog .docs-component__preview'));
        assert.match(await page.locator('#alert-dialog pre').textContent(), /data-db-trigger="example-alert-dialog-confirm-delete"/);
      }, page => page.addInitScript(value => localStorage.setItem('db-theme', value), theme));
    });

    test('AI Docs Alert Dialog includes a working launcher at ' + width + 'px in ' + theme, async () => {
      const reference = await readFile(new URL('llms.txt', root), 'utf8');
      const html = reference.match(/### 22\. Alert Dialog[^]*?```html\n([^]*?)\n```/)[1];
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(2000);
      try {
        await page.setContent('<html data-theme="' + theme + '"><body>' + html + '</body></html>');
        await page.addStyleTag({ content: assets.get('/daub.css') + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
        await page.addScriptTag({ content: assets.get('/daub.js') });
        await page.evaluate(() => DAUB.init());
        await assertAlertDialogExample(page, page.locator('body'));
      } finally {
        await page.close();
      }
    });
  }
}

async function assertModalExample(page, sample, { triggerName = 'Open project details', title = 'Project details', body = 'Project Aurora has 3 tasks ready for review.' } = {}) {
  const trigger = sample.getByRole('button', { name: triggerName, exact: true });
  assert.equal(await trigger.count(), 1);
  assert.equal(await trigger.isVisible(), true);
  const overlay = sample.locator('.db-modal-overlay');
  const dialog = sample.locator('.db-modal');
  assert.equal(await dialog.isVisible(), false);
  assert.equal(await trigger.getAttribute('data-db-modal-trigger'), await overlay.getAttribute('id'));
  for (const dismiss of ['footer', 'close', 'escape', 'backdrop']) {
    await trigger.click();
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.getByRole('heading', { name: title, exact: true }).isVisible(), true);
    assert.equal(await dialog.locator('.db-modal__body').textContent(), body);
    assert.equal(await overlay.getAttribute('aria-hidden'), 'false');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    const bounds = await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { fits: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, overflow: element.scrollWidth > element.clientWidth };
    });
    assert.equal(bounds.fits, true);
    assert.equal(bounds.overflow, false);
    if (dismiss === 'footer') await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    else if (dismiss === 'close') await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    else if (dismiss === 'escape') await page.keyboard.press('Escape');
    else await overlay.click({ position: { x: 1, y: 1 } });
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await overlay.getAttribute('aria-hidden'), 'true');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  }
}

for (const width of [320, 1280]) {
  for (const theme of ['light', 'dark']) {
    test('docs Modal Overlay shows its own launcher and dismissible dialog at ' + width + 'px in ' + theme, async () => {
      const component = JSON.parse(assets.get('/components.json')).components.find(component => component.name === 'Modal Overlay');
      await withDocs(async page => {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        const body = component.html.match(/<div class="db-modal__body">([^]*?)<\/div>/)[1];
        await assertModalExample(page, page.locator('#modal-overlay .docs-component__preview'), { triggerName: 'Open release notes', title: 'Release notes', body });
        const code = await page.locator('#modal-overlay pre').textContent();
        assert.match(code, /data-db-modal-trigger="example-modal-overlay-overlay-example"/);
        assert.match(code, /aria-labelledby="example-modal-overlay-overlay-example-title"/);
      }, page => page.addInitScript(value => localStorage.setItem('db-theme', value), theme));
    });

    test('catalog Modal Overlay opens and dismisses its populated example at ' + width + 'px in ' + theme, async () => {
      const component = JSON.parse(assets.get('/components.json')).components.find(component => component.name === 'Modal Overlay');
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(2000);
      try {
        await page.setContent('<html data-theme="' + theme + '"><body>' + component.html + '</body></html>');
        await page.addStyleTag({ content: assets.get('/daub.css') + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
        await page.addScriptTag({ content: assets.get('/daub.js') });
        await page.evaluate(() => DAUB.init());
        const body = component.html.match(/<div class="db-modal__body">([^]*?)<\/div>/)[1];
        await assertModalExample(page, page.locator('body'), { triggerName: 'Open release notes', title: 'Release notes', body });
      } finally {
        await page.close();
      }
    });

    test('docs Modal shows a launcher and dismissible content at ' + width + 'px in ' + theme, async () => {
      await withDocs(async page => {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        await assertModalExample(page, page.locator('#modal .docs-component__preview'));
        assert.match(await page.locator('#modal pre').textContent(), /data-db-modal-trigger="example-modal-my-modal"/);
      }, page => page.addInitScript(value => localStorage.setItem('db-theme', value), theme));
    });

    test('AI Docs Modal includes a working launcher at ' + width + 'px in ' + theme, async () => {
      const reference = await readFile(new URL('llms.txt', root), 'utf8');
      const html = reference.match(/### 21\. Modal[^]*?```html\n([^]*?)\n```/)[1];
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        await page.setContent('<html data-theme="' + theme + '"><body>' + html + '</body></html>');
        await page.addStyleTag({ content: assets.get('/daub.css') + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
        await page.addScriptTag({ content: assets.get('/daub.js') });
        await page.evaluate(() => DAUB.init());
        await assertModalExample(page, page.locator('body'));
      } finally {
        await page.close();
      }
    });
  }
}

async function assertRevenueChart(card) {
  assert.equal(await card.locator('canvas').count(), 0);
  assert.equal(await card.getByRole('img', { name: 'Monthly revenue: January $40k, February $60k, March $80k', exact: true }).isVisible(), true);
  assert.deepEqual(await card.locator('.db-chart__labels span').allTextContents(), ['Jan', 'Feb', 'Mar']);
  const geometry = await card.evaluate(element => {
    const chart = element.querySelector('.db-chart').getBoundingClientRect();
    const bars = [...element.querySelectorAll('.db-chart__bar')].map(bar => ({
      rect: bar.getBoundingClientRect().toJSON(),
      background: getComputedStyle(bar).backgroundImage,
      title: bar.title,
    }));
    return { chart: chart.toJSON(), bars, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.equal(geometry.bars.length, 3);
  assert.deepEqual(geometry.bars.map(bar => bar.title), ['January: $40k', 'February: $60k', 'March: $80k']);
  for (const { rect, background } of geometry.bars) {
    assert.ok(rect.width > 10 && rect.height > 40, JSON.stringify(geometry));
    assert.ok(rect.left >= geometry.chart.left && rect.right <= geometry.chart.right && rect.bottom <= geometry.chart.bottom, JSON.stringify(geometry));
    assert.notEqual(background, 'none');
  }
  assert.ok(geometry.bars[0].rect.height < geometry.bars[1].rect.height && geometry.bars[1].rect.height < geometry.bars[2].rect.height);
  assert.equal(geometry.overflow, false);
}

for (const width of [320, 1280]) {
  for (const theme of ['light', 'dark']) {
    test('docs Chart Card renders revenue bars and copyable data at ' + width + 'px in ' + theme, async () => {
      await withDocs(async page => {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        const card = page.locator('#chart-card .db-chart-card');
        await assertRevenueChart(card);
        const example = await page.locator('#chart-card .docs-component__code').textContent();
        assert.ok(example.includes('class="db-chart"'));
        assert.ok(example.includes('March: $80k'));
        assert.ok(!example.includes('<canvas'));
      }, page => page.addInitScript(value => localStorage.setItem('db-theme', value), theme));
    });

    test('AI Docs Chart Card renders without chart scripts at ' + width + 'px in ' + theme, async () => {
      const reference = await readFile(new URL('llms.txt', root), 'utf8');
      const html = reference.match(/### 55\. Chart Card[^]*?```html\n([^]*?)\n```/)[1];
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.setContent('<html data-theme="' + theme + '"><body style="margin:0;padding:16px;">' + html + '</body></html>');
        await page.addStyleTag({ content: assets.get('/daub.css') });
        await assertRevenueChart(page.locator('.db-chart-card'));
        assert.equal(await page.locator('script').count(), 0);
      } finally {
        await page.close();
      }
    });
  }
}

test('docs Carousel keeps phone content clear of arrows and switches visible slides', async () => {
  await withDocs(async page => {
    await page.setViewportSize({ width: 320, height: 800 });
    const carousel = page.locator('#carousel .db-carousel');
    const checkContent = async () => {
      const geometry = await carousel.evaluate(element => {
        const slide = element.querySelector('.db-carousel__slide[aria-hidden="false"]');
        const heading = slide.querySelector('h3').getBoundingClientRect();
        const previous = element.querySelector('.db-carousel__btn--prev').getBoundingClientRect();
        const next = element.querySelector('.db-carousel__btn--next').getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const preview = element.closest('.docs-component__preview').getBoundingClientRect();
        return { clear: heading.left >= previous.right + 8 && heading.right <= next.left - 8, fits: rect.left >= preview.left && rect.right <= preview.right };
      });
      assert.equal(geometry.clear, true);
      assert.equal(geometry.fits, true);
    };
    await checkContent();
    await carousel.getByRole('button', { name: 'Next slide', exact: true }).click();
    await checkContent();
    assert.equal(await carousel.getByRole('heading', { name: 'Project Birch', exact: true }).isVisible(), true);
    assert.equal(await carousel.getByRole('button', { name: 'Go to slide 2' }).getAttribute('aria-current'), 'true');
    await carousel.getByRole('button', { name: 'Previous slide', exact: true }).click();
    assert.equal(await carousel.getByRole('heading', { name: 'Project Aurora', exact: true }).isVisible(), true);
  });
});

for (const width of [320, 1280]) {
  test('docs Theme Switcher remains in its preview and opens a complete picker at ' + width + 'px', async () => {
    await withDocs(async page => {
      await page.setViewportSize({ width, height: 900 });
      const sample = page.locator('#theme-switcher .docs-component__preview');
      const toggle = sample.getByRole('button', { name: 'Open theme picker', exact: true });
      const geometry = await toggle.evaluate(element => {
        const button = element.getBoundingClientRect();
        const preview = element.closest('.docs-component__preview').getBoundingClientRect();
        return { button: button.toJSON(), preview: preview.toJSON() };
      });
      assert.ok(geometry.button.left >= geometry.preview.left && geometry.button.right <= geometry.preview.right, JSON.stringify(geometry));
      assert.ok(geometry.button.top >= geometry.preview.top && geometry.button.bottom <= geometry.preview.bottom, JSON.stringify(geometry));
      await toggle.click();
      const picker = sample.locator('.db-theme-switcher__popover');
      assert.equal(await picker.isVisible(), true);
      assert.equal(await picker.locator('[data-family]').count(), 21);
      assert.equal(await picker.locator('.db-theme-switcher__tab').count(), 4);
      assert.equal(await picker.locator('[data-scheme]').count(), 3);
      const bounds = await picker.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const preview = element.closest('.docs-component__preview').getBoundingClientRect();
        return { rect: rect.toJSON(), preview: preview.toJSON(), overflow: element.scrollWidth > element.clientWidth };
      });
      assert.ok(bounds.rect.left >= bounds.preview.left && bounds.rect.right <= bounds.preview.right, JSON.stringify(bounds));
      assert.ok(bounds.rect.bottom <= bounds.preview.bottom, JSON.stringify(bounds));
      assert.equal(bounds.overflow, false);
      const category = await picker.locator('[data-family="github"]').evaluate(element => element.parentElement.getAttribute('data-cat'));
      await picker.locator('.db-theme-switcher__tab[data-cat="' + category + '"]').click();
      await picker.getByRole('button', { name: 'github', exact: true }).click();
      await picker.getByRole('button', { name: 'dark mode', exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'github-dark');
      assert.equal(await picker.getByRole('button', { name: 'dark mode', exact: true }).getAttribute('aria-pressed'), 'true');
      await picker.getByRole('button', { name: 'dark mode', exact: true }).press('Escape');
      assert.equal(await picker.isVisible(), false);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    });
  });
}

test('Theme Switcher retains its floating placement outside documentation previews', async () => {
  await withDocs(async page => {
    await page.evaluate(() => {
      const switcher = document.createElement('div');
      switcher.className = 'db-theme-switcher';
      document.body.appendChild(switcher);
      DAUB.init();
    });
    const floating = page.locator('body > .db-theme-switcher');
    assert.equal(await floating.evaluate(element => getComputedStyle(element).position), 'fixed');
    assert.equal(await floating.getByRole('button', { name: 'Open theme picker' }).isVisible(), true);
    await floating.getByRole('button', { name: 'Open theme picker' }).click();
    const picker = floating.locator('.db-theme-switcher__popover');
    assert.equal(await picker.isVisible(), true);
    assert.equal(await picker.evaluate(element => getComputedStyle(element).position), 'absolute');
  });
});

test('docs Sidebar navigation targets the component without duplicate IDs', async () => {
  await withDocs(async page => {
    assert.equal(await page.locator('[id="sidebar"]').count(), 1);
    await page.locator('#sidebarNav').getByRole('link', { name: 'Sidebar', exact: true }).click();
    const position = await page.locator('#sidebar .docs-component__name').boundingBox();
    assert.ok(position.y >= 0 && position.y < 100, JSON.stringify(position));
    await page.setViewportSize({ width: 375, height: 800 });
    await page.getByRole('button', { name: 'Browse categories', exact: true }).click();
    assert.equal(await page.locator('.docs-sidebar').evaluate(element => element.classList.contains('docs-sidebar--open')), true);
    await page.locator('#sidebarNav').getByRole('link', { name: 'Sidebar', exact: true }).click();
    assert.equal(await page.locator('.docs-sidebar').evaluate(element => element.classList.contains('docs-sidebar--open')), false);
    assert.equal(await page.getByRole('button', { name: 'Browse categories', exact: true }).getAttribute('aria-expanded'), 'false');
    const toggle = page.locator('#sidebar .db-sidebar__toggle');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.ok(await page.locator('#sidebar .db-sidebar').evaluate(element => {
      const rect = element.getBoundingClientRect();
      const preview = element.closest('.docs-component__preview').getBoundingClientRect();
      return element.scrollWidth <= element.clientWidth && rect.right <= preview.right;
    }));
  });
});

test('docs Toast shows anatomy and creates dismissible timed notifications outside its static preview', async () => {
  await withDocs(async page => {
    const example = page.locator('#toast .docs-component__preview');
    const sample = example.getByRole('status');
    assert.equal(await sample.locator('.db-toast__title').textContent(), 'Saved');
    assert.equal(await sample.locator('svg.lucide-circle-check').count(), 1);
    assert.doesNotMatch(await example.innerText(), /DAUB\.toast\(/);
    assert.equal(await page.locator('#toast-stack .db-toast').count(), 2);
    await example.getByRole('button', { name: 'Show toast', exact: true }).click();
    const notification = page.locator('body > .db-toast-stack .db-toast');
    await notification.waitFor();
    assert.equal(await notification.locator('.db-toast__title').textContent(), 'Saved');
    assert.equal(await notification.locator('.db-toast__message').textContent(), 'Changes saved.');
    assert.equal(await page.locator('#toast-stack .db-toast').count(), 2);
    await notification.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.clock.fastForward(201);
    await notification.waitFor({ state: 'detached' });
    await example.getByRole('button', { name: 'Show toast', exact: true }).click();
    await notification.waitFor();
    assert.equal(await page.locator('body > .db-toast-stack').count(), 1);
    await page.clock.fastForward(4000);
    await page.clock.fastForward(201);
    await notification.waitFor({ state: 'detached' });
    assert.equal(await sample.count(), 1);
  }, page => page.clock.install());
});

test('docs Toast preview and live notification fit a phone viewport', async () => {
  await withDocs(async page => {
    await page.setViewportSize({ width: 320, height: 700 });
    const preview = page.locator('#toast .docs-component__preview');
    await preview.getByRole('button', { name: 'Show toast', exact: true }).click();
    const geometry = await page.locator('body > .db-toast-stack .db-toast').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { rect: rect.toJSON(), width: innerWidth, height: innerHeight };
    });
    assert.ok(geometry.rect.left >= 0 && geometry.rect.right <= geometry.width);
    assert.ok(geometry.rect.top >= 0 && geometry.rect.bottom <= geometry.height);
    assert.ok(await preview.evaluate(element => element.scrollWidth <= element.clientWidth));
  });
});

for (const width of [320, 1280]) {
  test('docs component metadata shares a vertical center at ' + width + 'px', async () => {
    await withDocs(async page => {
      await page.setViewportSize({ width, height: 800 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => DAUB.setTheme(theme), theme);
        const rows = await page.locator('.docs-component__meta').evaluateAll(elements => elements.map(element => ({
          id: element.closest('.docs-component').id,
          items: Array.from(element.children, child => {
            const rect = child.getBoundingClientRect();
            return { text: child.textContent, center: rect.top + rect.height / 2 };
          })
        })));
        for (const row of rows) {
          for (const item of row.items.slice(1)) {
            assert.ok(Math.abs(item.center - row.items[0].center) <= 0.5, JSON.stringify({ width, theme, ...row }));
          }
        }
      }
    });
  });
}

for (const theme of ['light', 'dark']) {
  test('docs Checkbox Group shows selected checkmarks in ' + theme, async () => {
    await withDocs(async page => {
      await page.evaluate(theme => DAUB.setTheme(theme), theme);
      const group = page.getByRole('group', { name: 'Topics', exact: true });
      const design = group.getByRole('checkbox', { name: 'Design', exact: true });
      const engineering = group.getByRole('checkbox', { name: 'Engineering', exact: true });
      const marks = group.locator('.db-checkbox__box svg');
      assert.equal(await marks.count(), 2);
      assert.equal(await design.isChecked(), false);
      assert.equal(await engineering.isChecked(), false);
      assert.deepEqual(await marks.evaluateAll(elements => elements.map(element => getComputedStyle(element).opacity)), ['0', '0']);
      await group.locator('label').filter({ hasText: 'Design' }).click();
      assert.equal(await design.isChecked(), true);
      assert.equal(await engineering.isChecked(), false);
      assert.equal(await marks.nth(0).evaluate(element => getComputedStyle(element).opacity), '1');
      assert.equal(await marks.nth(0).getAttribute('fill'), 'none');
      assert.equal(await marks.nth(0).getAttribute('aria-hidden'), 'true');
      assert.ok(await marks.nth(0).evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).stroke !== 'none';
      }));
      await engineering.press('Space');
      assert.equal(await engineering.isChecked(), true);
      assert.equal(await marks.nth(1).evaluate(element => getComputedStyle(element).opacity), '1');
      await engineering.press('Space');
      assert.equal(await engineering.isChecked(), false);
      assert.equal(await marks.nth(1).evaluate(element => getComputedStyle(element).opacity), '0');
      assert.equal((await page.locator('#checkbox-group pre').textContent()).match(/<polyline/g).length, 2);
    });
  });
}

test('docs alert dialog confirmation closes its namespaced overlay', async () => {
  await withDocs(async page => {
    await page.locator('#alert-dialog [data-db-trigger]').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete this draft?' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Delete draft', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.match(await page.locator('#alert-dialog pre').textContent(), /DAUB\.closeAlertDialog\('example-alert-dialog-confirm-delete'\)/);
  });
});

test('docs command trigger opens its namespaced command palette', async () => {
  await withDocs(async page => {
    const trigger = page.locator('#command-palette [data-db-command-trigger]');
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Command palette', exact: true });
    await dialog.waitFor();
    const input = dialog.getByRole('combobox', { name: 'Search commands' });
    assert.equal(await input.evaluate(element => element === document.activeElement), true);
    await input.fill('Home');
    await input.press('ArrowDown');
    assert.equal(await dialog.getByRole('option', { name: 'Home', exact: true }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    assert.match(await page.locator('#command-palette pre').textContent(), /DAUB\.openCommand\('example-command-palette-cmd'\)/);
  });
});

test('docs renders each catalog component in its category and sidebar', async () => {
  const catalog = JSON.parse(assets.get('/components.json'));
  await withDocs(async page => {
    assert.equal(await page.locator('.docs-component').count(), catalog.components.length);
    for (const component of catalog.components) {
      const id = component.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      assert.equal(await page.locator('#' + id + ' .docs-component__name').textContent(), component.name);
      assert.equal(await page.locator('#sidebarNav a[href="#' + id + '"]').count(), 1);
    }
  });
});

for (const [width, theme] of [320, 375, 1280].flatMap(width => ['light', 'dark'].map(theme => [width, theme]))) {
  test('docs preview card stays inside its preview at ' + width + 'px in ' + theme, async () => {
    await withDocs(async page => {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(theme => DAUB.setTheme(theme), theme);
      const trigger = page.locator('#preview-card .db-preview-card__trigger');
      await trigger.focus();
      const geometry = await page.locator('#preview-card').evaluate(card => {
        const preview = card.querySelector('.docs-component__preview');
        const content = card.querySelector('.db-preview-card__content');
        const p = preview.getBoundingClientRect();
        const c = content.getBoundingClientRect();
        return { preview: p.toJSON(), content: c.toJSON(), opacity: getComputedStyle(content).opacity,
          overflow: getComputedStyle(preview).overflowY,
          bottomHit: content.contains(document.elementFromPoint(c.left + 8, c.bottom - 8)) };
      });
      assert.equal(geometry.opacity, '1');
      assert.equal(geometry.overflow, 'visible');
      assert.ok(geometry.content.left >= geometry.preview.left);
      assert.ok(geometry.content.right <= geometry.preview.right, JSON.stringify(geometry));
      assert.ok(geometry.content.bottom <= geometry.preview.bottom, JSON.stringify(geometry));
      assert.equal(geometry.bottomHit, true, JSON.stringify(geometry));
      assert.equal(await page.locator('#preview-card .db-preview-card__title').evaluate(element => getComputedStyle(element).display), 'block');
      assert.equal(await page.locator('#preview-card .db-preview-card__desc').evaluate(element => getComputedStyle(element).display), 'block');
      assert.equal(await page.locator('#preview-card pre').textContent(), JSON.parse(assets.get('/components.json')).components.find(component => component.name === 'Preview Card').html);
    });
  });
}

for (const width of [320, 1280]) {
  test('docs keeps visible bottom navigation inside its preview at ' + width + 'px', async () => {
    await withDocs(async page => {
      await page.setViewportSize({ width, height: 800 });
      const nav = page.locator('#bottom-navigation .db-bottom-nav');
      assert.equal(await nav.isVisible(), true);
      assert.equal(await nav.locator('.db-bottom-nav__item').count(), 2);
      assert.equal(await nav.locator('svg.lucide').count(), 2);
      assert.equal(await nav.locator('.db-bottom-nav__badge').isVisible(), true);
      const geometry = await page.locator('#bottom-navigation .db-bottom-nav').evaluate(nav => {
        const preview = nav.closest('.docs-component__preview').getBoundingClientRect();
        const rect = nav.getBoundingClientRect();
        return { preview: preview.toJSON(), nav: rect.toJSON(), position: getComputedStyle(nav).position };
      });
      assert.equal(geometry.position, 'static');
      assert.ok(geometry.nav.height >= 56);
      assert.ok(geometry.nav.top >= geometry.preview.top);
      assert.ok(geometry.nav.bottom <= geometry.preview.bottom);
    });
  });
}

test('docs previews plain mobile-only Bottom Navigation on desktop', async () => {
  await withDocs(async page => {
    const nav = page.locator('#bottom-navigation .db-bottom-nav');
    assert.equal(await nav.isVisible(), true);
    assert.equal(await nav.evaluate(element => getComputedStyle(element).display), 'flex');
    assert.ok((await nav.boundingBox()).height >= 56);
  }, page => page.route('**/components.json', route => {
    const catalog = JSON.parse(assets.get('/components.json'));
    const component = catalog.components.find(component => component.name === 'Bottom Navigation');
    component.html = component.html.replace(' db-bottom-nav--always', '').replace(' db-bottom-nav--static', '');
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(catalog) });
  }));
});

test('Bottom Navigation retains mobile-only visibility outside documentation previews', async () => {
  const html = JSON.parse(assets.get('/components.json')).components.find(component => component.name === 'Bottom Navigation').html;
  await withDocs(async page => {
    await page.evaluate(html => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const nav = wrapper.firstElementChild;
      nav.className = 'db-bottom-nav';
      document.body.appendChild(nav);
      lucide.createIcons();
    }, html);
    const nav = page.locator('body > .db-bottom-nav');
    assert.equal(await nav.isVisible(), false);
    await page.setViewportSize({ width: 320, height: 700 });
    assert.equal(await nav.isVisible(), true);
    assert.equal(await nav.evaluate(element => getComputedStyle(element).position), 'fixed');
    assert.equal((await nav.boundingBox()).y + (await nav.boundingBox()).height, 700);
    await page.setViewportSize({ width: 1280, height: 700 });
    await nav.evaluate(element => element.classList.add('db-bottom-nav--always'));
    assert.equal(await nav.isVisible(), true);
  });
});

test('docs renders pinned local Lucide icons without third-party requests', async () => {
  await withDocs(async page => {
    await page.locator('#input-with-icon svg.lucide-search').waitFor();
    assert.equal(await page.locator('script[src="assets/lucide.min.js"]').count(), 1);
    assert.ok(await page.locator('svg.lucide').count() >= 7);
  });
});

test('docs search preserves entered values, selected controls, and sample DOM nodes', async () => {
  await withDocs(async page => {
    await page.locator('#text-field .docs-component__preview input').fill('owner@example.com');
    await page.locator('#checkbox .docs-component__preview label').click();
    await page.locator('#radio-group .docs-component__preview label').filter({ hasText: 'Team' }).click();
    await page.evaluate(() => { window.sampleInput = document.querySelector('#text-field .docs-component__preview input'); });
    await page.getByLabel('Search components', { exact: true }).fill('nonexistent-sample');
    await page.getByText('No components match your search.', { exact: true }).waitFor();
    await page.getByLabel('Search components', { exact: true }).fill('');
    assert.equal(await page.locator('#text-field .docs-component__preview input').inputValue(), 'owner@example.com');
    assert.equal(await page.locator('#checkbox .docs-component__preview input').isChecked(), true);
    assert.equal(await page.locator('#radio-group .docs-component__preview input[value="team"]').isChecked(), true);
    assert.equal(await page.evaluate(() => window.sampleInput === document.querySelector('#text-field .docs-component__preview input')), true);
    await page.locator('#switch [role="switch"]').click();
    assert.equal(await page.locator('#switch [role="switch"]').getAttribute('aria-checked'), 'true');
  });
});

for (const mode of ['missing', 'denied']) {
  test('docs clipboard ' + mode + ' selects the displayed sample without losing form state', async () => {
    await withDocs(async page => {
      const sample = page.locator('#text-field');
      await sample.locator('.docs-component__preview input').fill('owner@example.com');
      const source = await sample.locator('pre').textContent();
      await sample.getByRole('button', { name: 'Copy Text Field example' }).click();
      await page.getByRole('status').filter({ hasText: 'Clipboard unavailable.' }).waitFor();
      assert.equal(await page.evaluate(() => getSelection().toString()), source);
      assert.equal(await sample.locator('.docs-component__preview input').inputValue(), 'owner@example.com');
      assert.equal(await sample.locator('pre').textContent(), source);
    }, page => page.addInitScript(mode => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: mode === 'missing' ? undefined : { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) }
      });
    }, mode));
  });
}

test('docs copy keeps source stable after editing and filtering a sample', async () => {
  await withDocs(async page => {
    const source = await page.locator('#text-field pre').textContent();
    await page.locator('#text-field .docs-component__preview input').fill('owner@example.com');
    await page.getByLabel('Search components', { exact: true }).fill('Text Field');
    await page.getByRole('button', { name: 'Copy Text Field example' }).click();
    await page.waitForFunction(() => window.copyCalls === 1);
    assert.equal(await page.evaluate(() => window.copiedExample), source);
    assert.equal(await page.locator('#text-field .docs-component__preview input').inputValue(), 'owner@example.com');
  }, page => page.addInitScript(() => {
    window.copyCalls = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: value => { window.copiedExample = value; window.copyCalls++; return Promise.resolve(); }
    } });
  }));
});

const importedTheme = {
  domain: 'example.test',
  dom: {
    colors: { semantic: { bg: { value: '#112233' }, text: '#f5f5f5', accent: '#336699' }, status: { success: { raw: '#227744' } } },
    radii: { clustered: { sm: 2, default: '7px', lg: { value: '1rem' }, xl: 14, full: 9999 } },
    shadows: {
      levels: [{ value: '0 4px 9px rgba(0,0,0,.3)' }, { value: { x: 0, y: 3, blur: 8, spread: 0, color: '#102030' } }],
      inset: 'inset 0 1px 2px rgba(0,0,0,.2)'
    },
    components: {
      button: { styles: { backgroundColor: '#336699', borderRadius: 6, fontSize: 14 } },
      field: { styles: { backgroundColor: { raw: '#ebf5ff' }, borderRadius: 3 } },
      card: { styles: { borderRadius: '1.25rem', boxShadow: { value: '0 2px 6px rgba(10,20,30,.4)' } } }
    }
  }
};

async function importTheme(page, theme, mode) {
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  const json = JSON.stringify(theme);
  if (mode === 'paste') {
    await page.locator('#css-input').fill(json);
    await page.locator('#css-input').dispatchEvent('paste');
  } else if (mode === 'file') {
    await page.locator('#json-file').setInputFiles({ name: 'theme.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  } else {
    await page.locator('#json-dropzone').evaluate((element, json) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([json], 'theme.json', { type: 'application/json' }));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    }, json);
  }
  await page.waitForFunction(() => document.querySelector('#source-label').textContent === 'Theme applied.');
}

async function themeSnapshot(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const button = getComputedStyle(document.querySelector('#preview .db-btn'));
    const field = getComputedStyle(document.querySelector('#preview .db-field__input'));
    const card = getComputedStyle(document.querySelector('#preview .db-card'));
    return {
      background: getComputedStyle(document.querySelector('#preview')).backgroundColor,
      backgroundToken: root.getPropertyValue('--db-color-bg').trim(),
      radius: root.getPropertyValue('--db-radius-2').trim(),
      largeRadius: root.getPropertyValue('--db-radius-3').trim(),
      success: root.getPropertyValue('--db-success').trim(),
      shadow: root.getPropertyValue('--db-shadow-1').trim(),
      secondShadow: root.getPropertyValue('--db-shadow-2').trim(),
      inset: root.getPropertyValue('--db-shadow-inset').trim(),
      buttonRadius: button.borderTopLeftRadius, buttonFont: button.fontSize, buttonBackground: button.backgroundColor,
      fieldRadius: field.borderTopLeftRadius, fieldBackground: field.backgroundColor,
      cardRadius: card.borderTopLeftRadius, cardShadow: card.boxShadow
    };
  });
}

test('theme JSON paste, file, and drop preserve typed colors, radii, and shadows in rendered components', async () => {
  await withPage('theme-preview.html', async page => {
    let first;
    for (const mode of ['paste', 'file', 'drop']) {
      await importTheme(page, importedTheme, mode);
      const snapshot = await themeSnapshot(page);
      assert.equal(snapshot.background, 'rgb(17, 34, 51)', JSON.stringify(snapshot));
      assert.equal(snapshot.radius, '7px');
      assert.equal(snapshot.largeRadius, '1rem');
      assert.equal(snapshot.success, '#227744');
      assert.equal(snapshot.shadow, '0 4px 9px rgba(0,0,0,.3)');
      assert.equal(snapshot.secondShadow, '0px 3px 8px 0px #102030');
      assert.equal(snapshot.inset, 'inset 0 1px 2px rgba(0,0,0,.2)');
      assert.equal(snapshot.buttonRadius, '6px');
      assert.equal(snapshot.buttonFont, '14px');
      assert.equal(snapshot.buttonBackground, 'rgb(51, 102, 153)');
      assert.equal(snapshot.fieldRadius, '3px');
      assert.equal(snapshot.fieldBackground, 'rgb(235, 245, 255)');
      assert.equal(snapshot.cardRadius, '20px');
      assert.match(snapshot.cardShadow, /rgba\(10, 20, 30, 0\.4\)/);
      assert.doesNotMatch(await page.locator('#css-input').inputValue(), /undefinedpx|\[object Object\]|pxpx/);
      if (first) assert.deepEqual(snapshot, first);
      first = snapshot;
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
    }
  });
});

test('theme JSON honors exported CSS config for parity with the CSS export', async () => {
  await withPage('theme-preview.html', async page => {
    const theme = { ...importedTheme, config: ':root { --db-color-bg: #345678; --db-btn-radius: 11px; --db-card-shadow: 0 5px 10px #102030; }' };
    await importTheme(page, theme, 'file');
    const jsonSnapshot = await themeSnapshot(page);
    assert.equal(jsonSnapshot.background, 'rgb(52, 86, 120)', JSON.stringify(jsonSnapshot));
    assert.equal(jsonSnapshot.buttonRadius, '11px');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.locator('#css-input').fill(theme.config);
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    assert.deepEqual(await themeSnapshot(page), jsonSnapshot);
  });
});

test('theme replacement, invalid JSON, and reset preserve the original page theme', async () => {
  await withPage('theme-preview.html', async page => {
    const baseline = await themeSnapshot(page);
    await importTheme(page, importedTheme, 'file');
    const imported = await themeSnapshot(page);
    await page.locator('#css-input').fill('{broken JSON');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    assert.match(await page.locator('#source-label').textContent(), /^Invalid JSON:/);
    assert.deepEqual(await themeSnapshot(page), imported);
    await page.locator('#css-input').fill(':root { --db-color-bg: #ffffff; }');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    const replaced = await themeSnapshot(page);
    assert.equal(replaced.background, 'rgb(255, 255, 255)');
    assert.equal(replaced.buttonRadius, baseline.buttonRadius);
    assert.equal(replaced.cardShadow, baseline.cardShadow);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    assert.deepEqual(await themeSnapshot(page), baseline);
    assert.equal(await page.locator('#css-input').inputValue(), '');
    assert.equal(await page.locator('#json-file').inputValue(), '');
    assert.equal(await page.locator('#token-inspector').isVisible(), false);
  });
});

test('theme import discards invalid token types without emitting broken CSS', async () => {
  await withPage('theme-preview.html', async page => {
    const baseline = await themeSnapshot(page);
    await importTheme(page, { dom: {
      colors: { semantic: { bg: '#ffffff', text: { unexpected: 'red' }, accent: true }, status: { success: false } },
      radii: { clustered: { default: { unexpected: 9 }, lg: true, xl: -5 } },
      shadows: { levels: [false, { value: { x: 0, y: 2, blur: -3, color: '#000' } }], inset: { unexpected: 'none' } },
      components: { button: { styles: { borderRadius: [], fontSize: true } }, card: { styles: { boxShadow: { unexpected: 'none' } } } }
    } }, 'file');
    const result = await themeSnapshot(page);
    assert.equal(result.background, 'rgb(255, 255, 255)');
    for (const key of ['radius', 'largeRadius', 'success', 'shadow', 'secondShadow', 'inset', 'buttonRadius', 'buttonFont', 'cardShadow']) {
      assert.equal(result[key], baseline[key], key);
    }
    const css = await page.locator('#css-input').inputValue();
    assert.doesNotMatch(css, /undefined|\[object Object\]|true|false|NaN|pxpx/);
    assert.equal(await page.locator('#token-grid .tp-token').count(), 1);
  });
});

test('theme gallery default card retains its palette after applying dark mode', async () => {
  await withPage('themes.html', async page => {
    const card = page.locator('.tg-card[data-theme="light"]');
    const palette = () => card.evaluate(element => {
      const style = getComputedStyle(element);
      return ['--db-cream', '--db-ink', '--db-terracotta'].map(property => style.getPropertyValue(property).trim());
    });
    const before = await palette();
    await page.locator('.tg-card[data-theme="dark"] .tg-card__apply').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.deepEqual(await palette(), before);
  });
});
