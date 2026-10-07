import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const css = await readFile(new URL('daub.css', root), 'utf8');
const runtime = await readFile(new URL('daub.js', root), 'utf8');
const icons = await readFile(new URL('assets/lucide.min.js', root), 'utf8');
let browser;
before(async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  browser = await ({ chromium, firefox, webkit })[engine].launch({
    headless: true,
    ...(engine === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {})
  });
});
after(async () => { await browser?.close(); });

async function fixture() {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await page.route('**/*', route => route.abort());
  await page.setContent('<html data-theme="dark"><body style="padding:24px;margin:0"><main>' +
    '<h3 class="db-h3">Build your next interface</h3>' +
    '<div class="db-toggle-group" role="group" aria-label="Example view" style="margin-bottom:16px"><button class="db-toggle" aria-pressed="true" type="button">Preview</button><button class="db-toggle" aria-pressed="false" type="button">Code</button></div>' +
    '<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">' +
    '<a href="#" class="db-btn db-btn--sm db-btn--primary" id="primary"><i data-lucide="play" style="width:12px;height:12px" aria-hidden="true"></i> Code This</a>' +
    '<button class="db-btn db-btn--secondary" id="secondary">Save changes</button>' +
    '<button class="db-btn db-btn--ghost" id="ghost">Copy prompt</button></div>' +
    '<label class="db-label">Interface name</label><p class="db-caption">Settings page</p><p class="db-body" id="body-copy">Create an interface for your team.</p>' +
    '<button class="db-btn db-btn--primary db-btn--loading" id="loading">Saving</button>' +
    '</main></body></html>');
  await page.addStyleTag({ content: css });
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
  await page.addScriptTag({ content: icons });
  await page.addScriptTag({ content: runtime });
  await page.evaluate(() => { DAUB.setTheme('dark'); lucide.createIcons(); });
  return page;
}

test('letterpress text stays low-opacity across 42 themes without changing body copy', async () => {
  const page = await fixture();
  try {
    const audit = await page.evaluate(() => {
      const selectors = { '#primary': 0.1, '#secondary': 0.1, '#ghost': 0.1, '.db-label': 0.1, '.db-h3': 0.15 };
      const failures = [], samples = [];
      let primaryMaximum = 0, headingMaximum = 0, subtleMaximum = 0;
      for (const theme of DAUB.THEMES) {
        DAUB.setTheme(theme);
        for (const [selector, maximum] of Object.entries(selectors)) {
          const style = getComputedStyle(document.querySelector(selector));
          const colors = style.textShadow.match(/rgba?\([^)]+\)/g) || [];
          const alphas = colors.map(color => {
            const channels = color.match(/[\d.]+/g).map(Number);
            return channels[3] ?? 1;
          });
          const opacity = Math.max(0, ...alphas);
          if (selector === '#primary') primaryMaximum = Math.max(primaryMaximum, opacity);
          else if (selector === '.db-h3') headingMaximum = Math.max(headingMaximum, opacity);
          else subtleMaximum = Math.max(subtleMaximum, opacity);
          if (opacity > maximum) failures.push({ theme, selector, opacity, maximum });
          if (theme === 'dark') samples.push({ selector, shadow: style.textShadow, color: style.color, filter: style.filter, transform: style.transform });
        }
        if (getComputedStyle(document.querySelector('#body-copy')).textShadow !== 'none') failures.push({ theme, selector: '#body-copy', reason: 'Body copy inherits a shadow' });
        if (getComputedStyle(document.querySelector('#loading')).textShadow !== 'none') failures.push({ theme, selector: '#loading', reason: 'Loading label casts a shadow' });
      }
      DAUB.setTheme('dark');
      return { themes: DAUB.THEMES.length, primaryMaximum, headingMaximum, subtleMaximum, samples, failures };
    });
    console.log('Text shadow audit: ' + JSON.stringify({ ...audit, failures: audit.failures.slice(0, 5) }));
    if (process.env.DAUB_SHADOW_EVIDENCE) await page.screenshot({ path: process.env.DAUB_SHADOW_EVIDENCE });
    assert.equal(audit.themes, 42);
    assert.equal(audit.failures.length, 0, JSON.stringify(audit.failures.slice(0, 5)));
  } finally { await page.close(); }
});

test('captions and controls share a faint dark upper edge and bright lower edge across themes', async () => {
  const page = await fixture();
  try {
    await page.evaluate(() => {
      const classes = ['db-field__label', 'db-field__helper', 'db-checkbox-group__label', 'db-checkbox-group__helper', 'db-slider__label', 'db-stepper__label', 'db-dropdown__label', 'db-context-menu__label', 'db-sidebar__label', 'db-sidebar__footer', 'db-separator__label', 'db-stat__label', 'db-chart__labels', 'db-chart-card__title', 'db-message__header', 'db-message__footer', 'db-attachment__description', 'db-badge', 'db-chip', 'db-pagination__btn'];
      const examples = document.createElement('div');
      examples.id = 'caption-examples'; examples.hidden = true;
      for (const className of classes) {
        const caption = document.createElement('span'); caption.className = className; caption.textContent = 'Caption'; examples.append(caption);
      }
      const tab = document.createElement('button'); tab.className = 'db-tabs__tab'; tab.textContent = 'Details'; examples.append(tab);
      for (const className of ['db-table', 'db-data-table']) {
        const table = document.createElement('table'); table.className = className;
        const row = table.createTHead().insertRow(); const th = document.createElement('th'); th.textContent = 'Name'; row.append(th); examples.append(table);
      }
      document.body.append(examples);
    });
    const result = await page.evaluate(() => {
      const failures = [];
      const captions = [...document.querySelectorAll('#caption-examples span, #caption-examples button, #caption-examples th, .db-caption, .db-label, .db-toggle, .db-btn:not(.db-btn--loading)')];
      for (const theme of DAUB.THEMES) {
        DAUB.setTheme(theme);
        const reference = getComputedStyle(document.querySelector('.db-label')).textShadow;
        for (const caption of captions) {
          const shadow = getComputedStyle(caption).textShadow;
          const edges = [...shadow.matchAll(/(rgba?\([^)]+\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g)].map(match => {
            const channels = match[1].match(/[\d.]+/g).map(Number);
            return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1, x: Number(match[2]), y: Number(match[3]), blur: Number(match[4]) };
          });
          if (shadow !== reference || edges.length !== 2 || edges[0].y !== -0.5 || edges[1].y !== 0.5 ||
              edges.some(edge => edge.x !== 0 || edge.blur !== 0 || edge.alpha > 0.08) ||
              edges[0].rgb.reduce((sum, channel) => sum + channel, 0) >= edges[1].rgb.reduce((sum, channel) => sum + channel, 0)) {
            failures.push({ theme, caption: caption.className, shadow, reference, edges });
          }
        }
      }
      return { themes: DAUB.THEMES.length, captions: captions.length, failures };
    });
    console.log('Engraved caption audit: ' + JSON.stringify({ themes: result.themes, captions: result.captions, failures: result.failures.slice(0, 4) }));
    assert.equal(result.themes, 42);
    assert.ok(result.captions >= 30);
    assert.equal(result.failures.length, 0, JSON.stringify(result.failures.slice(0, 4)));
  } finally { await page.close(); }
});

test('engraving stays out of shimmer and forced colors and respects custom caption tokens', async () => {
  const page = await fixture();
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => document.querySelector('.db-caption').classList.add('db-shimmer'));
    assert.equal(await page.locator('.db-caption').evaluate(el => getComputedStyle(el).textShadow), 'none');
    await page.emulateMedia({ forcedColors: 'active' });
    const shadows = await page.locator('.db-h3, .db-label, .db-toggle, .db-btn').evaluateAll(elements => elements.map(el => getComputedStyle(el).textShadow));
    assert.ok(shadows.every(shadow => shadow === 'none'));
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' });
    await page.evaluate(() => document.documentElement.style.setProperty('--db-text-emboss-subtle', 'none'));
    assert.equal(await page.locator('#primary').evaluate(el => getComputedStyle(el).textShadow), 'none');
    assert.equal(await page.locator('.db-toggle').first().evaluate(el => getComputedStyle(el).textShadow), 'none');
  } finally { await page.close(); }
});

test('button hover, press, focus and loading retain their surfaces and sharp text', async () => {
  const page = await fixture();
  try {
    const button = page.locator('#primary');
    const initial = await button.evaluate(el => {
      const style = getComputedStyle(el);
      return { color: style.color, shadow: style.textShadow, surface: style.boxShadow, fill: style.backgroundImage };
    });
    assert.notEqual(initial.surface, 'none');
    assert.match(initial.fill, /linear-gradient/);
    await button.hover();
    assert.equal(await button.evaluate(el => getComputedStyle(el).textShadow), initial.shadow);
    await page.mouse.move(0, 0);
    await page.keyboard.press('Tab');
    await button.focus();
    assert.match(await button.evaluate(el => getComputedStyle(el).boxShadow), /0px 0px 0px 3px/);
    await button.evaluate(el => el.classList.add('db-btn--pressed'));
    assert.match(await button.evaluate(el => getComputedStyle(el).boxShadow), /inset/);
    assert.equal(await button.evaluate(el => getComputedStyle(el).textShadow), initial.shadow);
    assert.equal(await button.evaluate(el => getComputedStyle(el).color), initial.color);
    assert.equal(await page.locator('#loading').evaluate(el => getComputedStyle(el).textShadow), 'none');
  } finally { await page.close(); }
});
