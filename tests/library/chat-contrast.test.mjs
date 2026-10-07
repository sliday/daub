import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const assets = new Map();
for (const file of ['chat-demo.html', 'chat-demo.css', 'chat-demo.js', 'chat-demo-shell.js', 'daub.css', 'daub.js', 'assets/lucide.min.js']) {
  assets.set('/' + file, await readFile(new URL(file, root)));
}

test('compact chat controls and settled text/focus contrast meet the theme contract', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      const body = url.hostname === 'daub.test' && assets.get(url.pathname);
      if (!body) return route.abort();
      return route.fulfill({ body, contentType: url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.js') ? 'application/javascript' : 'text/html' });
    });
    await page.goto('http://daub.test/chat-demo.html');
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.locator('#chat-prompt').fill('Check the release');
    const sizes = await page.locator('.chat-demo-icon-button').evaluateAll(buttons => buttons.map(button => ({ width: button.offsetWidth, height: button.offsetHeight, icon: button.querySelector('svg').getBoundingClientRect().width })));
    for (const size of sizes) assert.deepEqual(size, { width: 32, height: 32, icon: 16 });
    const result = await page.evaluate(() => {
      const context = document.createElement('canvas').getContext('2d');
      function rgba(value) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value);
      }
      const blend = (foreground, background) => foreground.slice(0, 3).map((value, index) => value * foreground[3] + background[index] * (1 - foreground[3]));
      function background(element) {
        const chain = [];
        for (let parent = element; parent; parent = parent.parentElement) chain.unshift(parent);
        return chain.reduce((color, parent) => blend(rgba(getComputedStyle(parent).backgroundColor), color), [255, 255, 255]);
      }
      function luminance(color) {
        return color.slice(0, 3).map(value => { value /= 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      }
      function ratio(foreground, bg) {
        const a = luminance(foreground), b = luminance(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }
      const checks = [], failures = [];
      const marker = document.createElement('div');
      marker.id = 'contrast-marker';
      marker.className = 'db-marker';
      marker.setAttribute('aria-busy', 'true');
      const markerText = document.createElement('span');
      markerText.className = 'db-marker__content';
      markerText.textContent = 'Generating response';
      marker.append(markerText);
      document.querySelector('#chat-messages').append(marker);
      const attempt = document.createElement('span');
      attempt.className = 'chat-demo-run-label';
      attempt.textContent = 'Attempt 1 (demo)';
      document.querySelector('.db-message__header').append(attempt);
      function check(theme, selector, foreground, bg, minimum) {
        const value = ratio(blend(foreground, bg), bg);
        const item = { theme, selector, ratio: value, minimum };
        checks.push(item);
        if (value < minimum) failures.push(item);
      }
      const textSelectors = ['.chat-demo-titlebar h1', '.chat-demo-caption', '.chat-demo-breadcrumb', '.chat-demo-docs', '.chat-demo-sidebar-heading', '.chat-demo-nav-item', '.chat-demo-nav-count', '.chat-demo-sidebar-section', '.chat-demo-sidebar-footer', '.db-message__header', '.db-message__footer', '.db-marker', '.db-attachment__title', '.db-attachment__description', '#chat-status', '.chat-demo-thinking summary', '.chat-demo-thinking__state', '.chat-demo-thinking__stages .db-marker__content', '.chat-demo-thinking__demo', '.chat-demo-thinking__count', '.chat-demo-step__detail', '.chat-demo-run-label', '#chat-prompt', '#chat-prompt::placeholder'];
      const iconSelectors = ['#copy-reply', '.db-chat-composer__add', '#load-history', '#reset-chat'];
      for (const theme of DAUB.THEMES) {
        DAUB.setTheme(theme);
        for (const query of textSelectors.concat(iconSelectors)) {
          const [selector, pseudo] = query.split('::');
          const element = document.querySelector(selector);
          check(theme, query, rgba(getComputedStyle(element, pseudo ? '::' + pseudo : null).color), background(element), 4.5);
        }
        for (const selector of ['.db-bubble:not(.db-bubble--ghost)', '#chat-send']) {
          const element = document.querySelector(selector), style = getComputedStyle(element);
          const colors = style.backgroundImage.match(/color\(srgb [^)]+\)|rgba?\([^)]+\)/g);
          for (const color of colors || [style.backgroundColor]) check(theme, selector, rgba(style.color), blend(rgba(color), background(element.parentElement)), 4.5);
        }
        for (const selector of iconSelectors.concat('.db-message-scroller__viewport', '.chat-demo-thinking summary')) {
          const element = document.querySelector(selector);
          element.focus({ preventScroll: true });
          const style = getComputedStyle(element);
          if (style.outlineStyle === 'none' || parseFloat(style.outlineWidth) < 2) failures.push({ theme, selector, error: 'Missing visible focus ring' });
          check(theme, selector + ':focus-visible', rgba(style.outlineColor), background(element), 3);
        }
        const attachment = document.querySelector('.db-attachment');
        attachment.setAttribute('data-state', 'processing');
        for (const element of [markerText, attachment.querySelector('.db-attachment__title')]) {
          const colors = getComputedStyle(element).backgroundImage.match(/color\(srgb [^)]+\)|rgba?\([^)]+\)/g) || [];
          if (!colors.length) failures.push({ theme, error: 'Missing shimmer text colors' });
          for (const color of colors) check(theme, 'shimmer text', rgba(color), background(element.parentElement), 4.5);
        }
        const thinkingCopy = document.querySelector('.chat-demo-thinking__copy');
        thinkingCopy.classList.add('db-shimmer');
        const thinkingColors = getComputedStyle(thinkingCopy).backgroundImage.match(/color\(srgb [^)]+\)|rgba?\([^)]+\)/g) || [];
        if (!thinkingColors.length) failures.push({ theme, error: 'Missing Thinking highlight colors' });
        for (const color of thinkingColors) check(theme, 'Thinking highlight', rgba(color), background(thinkingCopy.parentElement), 4.5);
        thinkingCopy.classList.remove('db-shimmer');
        attachment.removeAttribute('data-state');
      }
      return { themes: DAUB.THEMES.length, checks: checks.length, minimumText: Math.min(...checks.filter(check => check.minimum === 4.5).map(check => check.ratio)), minimumFocus: Math.min(...checks.filter(check => check.minimum === 3).map(check => check.ratio)), failures };
    });
    await writeFile(new URL('test-results/chat-contrast.json', root), JSON.stringify(result, null, 2));
    assert.equal(result.themes, 42);
    assert.deepEqual(result.failures, []);
    for (const options of [{ forcedColors: 'active' }, { forcedColors: 'none', reducedMotion: 'reduce' }]) {
      await page.emulateMedia(options);
      const status = await page.locator('#contrast-marker .db-marker__content').evaluate(element => {
        const style = getComputedStyle(element);
        return { background: style.backgroundImage, color: style.color };
      });
      assert.equal(status.background, 'none');
      assert.notEqual(status.color, 'rgba(0, 0, 0, 0)');
    }
    const touch = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const touchPage = await touch.newPage();
    await touchPage.setContent('<div class="chat-demo"><button class="db-btn chat-demo-icon-button">Send</button><details class="chat-demo-thinking"><summary>Thinking</summary></details></div>');
    await touchPage.addStyleTag({ content: assets.get('/daub.css').toString() });
    await touchPage.addStyleTag({ content: assets.get('/chat-demo.css').toString() });
    assert.deepEqual(await touchPage.locator('button').evaluate(button => ({ width: button.offsetWidth, height: button.offsetHeight })), { width: 44, height: 44 });
    assert.ok(await touchPage.locator('summary').evaluate(element => element.offsetHeight >= 44));
    await touch.close();
  } finally {
    await browser.close();
  }
});
