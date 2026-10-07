import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const assets = new Map();
for (const name of ['chat-demo.html', 'chat-demo.css', 'chat-demo.js', 'chat-demo-shell.js', 'daub.css', 'daub.js', 'assets/lucide.min.js', 'case-studies/dashrock-overview.jpg']) {
  assets.set('/' + name, await readFile(new URL(name, root)));
}
let browser, page;
const errors = [];
before(async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true });
  page = await browser.newPage({ reducedMotion: 'reduce' });
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const body = url.hostname === 'daub.test' && assets.get(url.pathname);
    if (!body) return route.abort();
    const contentType = url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.jpg') ? 'image/jpeg' : 'text/html';
    return route.fulfill({ body, contentType });
  });
});
after(async () => { await browser?.close(); });

test('Harness-style activity details and stopped-run retry preserve the composer and user turn', async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://daub.test/chat-demo.html');
  const prompt = 'Review mobile layout <img src=x onerror=alert(1)>';
  await page.locator('#chat-prompt').fill(prompt);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const answer = page.locator('[data-db-message-id="assistant-1"]');
  await answer.locator('.chat-demo-thinking > summary').click();
  const step = answer.locator('.chat-demo-step').first();
  assert.equal(await step.count(), 1);
  await step.locator('summary').click();
  await step.locator('summary').press('Tab');
  assert.equal(await step.locator('pre').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await step.locator('summary').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await step.locator('pre').evaluate(element => element === document.activeElement), false, 'output does not trap forward Tab navigation');
  assert.ok((await step.locator('pre').textContent()).includes(prompt));
  assert.equal(await step.locator('img').count(), 0, 'request details stay plain text');
  assert.equal(await step.getAttribute('data-kind'), 'read');
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
  assert.equal(await answer.locator('.chat-demo-run-footer').getByText('Stopped', { exact: true }).isVisible(), true);
  await page.locator('#chat-prompt').fill('Unsent follow-up');
  await page.locator('#chat-file').setInputFiles({ name: 'next-request.txt', mimeType: 'text/plain', buffer: Buffer.from('Next request') });
  const retry = answer.getByRole('button', { name: 'Retry response', exact: true });
  await retry.click();
  assert.equal(await retry.isDisabled(), true);
  assert.equal(await page.locator('[data-db-message-id^="user-"]').count(), 1);
  assert.equal(await page.locator('#chat-prompt').inputValue(), 'Unsent follow-up');
  assert.equal(await page.locator('#pending-attachments .db-attachment').count(), 1);
  const retried = page.locator('[data-db-message-id="assistant-1-retry-2"]');
  assert.equal(await retried.locator('.chat-demo-run-label').first().textContent(), 'Attempt 2 (demo)');
  await page.waitForFunction(() => document.querySelector('#chat-status').textContent === 'Ready');
  assert.match(await retried.locator('.db-bubble__content').textContent(), /Check the conversation at 320px and 375px/);
  assert.equal(await retried.locator('.chat-demo-thinking__count').textContent(), '3 steps');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedHarnessReply = text; } } }));
  await retried.locator('.db-message').hover();
  await retried.getByRole('button', { name: 'Copy response', exact: true }).click();
  assert.equal(await page.evaluate(() => window.copiedHarnessReply), await retried.locator('.db-bubble__content').textContent());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Reset conversation', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Retry response', exact: true }).count(), 0);
  assert.equal(await page.locator('#pending-attachments .db-attachment').count(), 0);
});

test('Thinking copy sweeps its highlight horizontally and stays static for accessible motion modes', async () => {
  const motionPage = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'no-preference' });
  motionPage.setDefaultTimeout(2000);
  await motionPage.route('**/*', route => {
    const url = new URL(route.request().url());
    const body = url.hostname === 'daub.test' && assets.get(url.pathname);
    if (!body) return route.abort();
    return route.fulfill({ body, contentType: url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.jpg') ? 'image/jpeg' : 'text/html' });
  });
  try {
    await motionPage.clock.install();
    await motionPage.goto('http://daub.test/chat-demo.html');
    await motionPage.locator('#chat-prompt').fill('Review the release');
    await motionPage.getByRole('button', { name: 'Send message', exact: true }).click();
    const thinking = motionPage.locator('[data-db-message-id="assistant-1"] .chat-demo-thinking');
    const copy = thinking.locator('.chat-demo-thinking__copy');
    assert.equal(await copy.count(), 1);
    const frames = await copy.evaluate(element => {
      const animation = element.getAnimations()[0];
      animation.pause();
      const sample = time => {
        animation.currentTime = time;
        const style = getComputedStyle(element);
        return { image: style.backgroundImage, x: parseFloat(style.backgroundPositionX), y: style.backgroundPositionY, color: style.color, stageColor: getComputedStyle(element.querySelector('.chat-demo-thinking__state')).color, clip: style.backgroundClip, easing: style.animationTimingFunction, rect: element.getBoundingClientRect().toJSON() };
      };
      return [sample(200), sample(1000)];
    });
    assert.match(frames[0].image, /^linear-gradient\(90deg,/);
    assert.equal(frames[0].color, 'rgba(0, 0, 0, 0)');
    assert.equal(frames[0].stageColor, 'rgba(0, 0, 0, 0)');
    assert.equal(frames[0].clip, 'text');
    assert.equal(frames[0].easing, 'linear');
    assert.ok(frames[1].x < frames[0].x, 'the highlight advances from left to right');
    assert.equal(frames[1].y, frames[0].y);
    assert.deepEqual(frames[1].rect, frames[0].rect);
    const imageAt = async time => {
      await copy.evaluate((element, time) => { element.getAnimations()[0].currentTime = time; }, time);
      return copy.screenshot();
    };
    assert.notDeepEqual(await imageAt(200), await imageAt(1000), 'the highlight changes rendered text pixels');
    for (const options of [{ reducedMotion: 'reduce' }, { reducedMotion: 'no-preference', forcedColors: 'active' }]) {
      await motionPage.emulateMedia(options);
      const style = await copy.evaluate(element => ({ animation: getComputedStyle(element).animationName, image: getComputedStyle(element).backgroundImage, color: getComputedStyle(element).color }));
      assert.equal(style.animation, 'none');
      assert.equal(style.image, 'none');
      assert.notEqual(style.color, 'rgba(0, 0, 0, 0)', JSON.stringify({ options, style }));
    }
    await motionPage.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' });
    await motionPage.getByRole('button', { name: 'Stop response', exact: true }).click();
    assert.equal(await copy.evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.equal(await copy.locator('.chat-demo-thinking__state').textContent(), 'Stopped');
  } finally {
    await motionPage.close();
  }
});

test('Thinking shows staged activity, preserves completion, and stops before response text', async () => {
  const activityPage = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  activityPage.setDefaultTimeout(2000);
  await activityPage.route('**/*', route => {
    const url = new URL(route.request().url());
    const body = url.hostname === 'daub.test' && assets.get(url.pathname);
    if (!body) return route.abort();
    return route.fulfill({ body, contentType: url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.jpg') ? 'image/jpeg' : 'text/html' });
  });
  try {
    await activityPage.clock.install();
    await activityPage.goto('http://daub.test/chat-demo.html');
    const initialActivity = activityPage.locator('[data-db-message-id="initial-answer"] .chat-demo-thinking');
    assert.equal(await initialActivity.count(), 1);
    assert.equal(await initialActivity.getAttribute('data-state'), 'complete');
    assert.equal(await initialActivity.locator('ol').isVisible(), false);
    await initialActivity.locator(':scope > summary').press('Enter');
    assert.equal(await initialActivity.getAttribute('open'), '');
    assert.equal(await initialActivity.locator('ol').isVisible(), true);
    assert.equal(await initialActivity.getByText('Simulated activity', { exact: true }).isVisible(), true);
    await initialActivity.locator(':scope > summary').press('Space');
    assert.equal(await initialActivity.getAttribute('open'), null);
    assert.equal(await initialActivity.locator('ol').isVisible(), false);
    await activityPage.locator('#chat-prompt').fill('Review mobile layout');
    await activityPage.getByRole('button', { name: 'Send message', exact: true }).click();
    const answer = activityPage.locator('[data-db-message-id="assistant-1"]');
    const thinking = answer.locator('.chat-demo-thinking');
    assert.equal(await thinking.getAttribute('data-state'), 'active');
    assert.equal(await thinking.locator('.chat-demo-thinking__state').textContent(), 'Reviewing the request');
    assert.equal(await thinking.locator('ol').isVisible(), false);
    assert.equal(await answer.locator('.db-bubble__content').textContent(), '');
    await thinking.locator(':scope > summary').click();
    assert.equal(await thinking.locator('ol').isVisible(), true);
    await activityPage.clock.runFor(400);
    assert.equal(await thinking.locator('.chat-demo-thinking__state').textContent(), 'Preparing the reply');
    assert.equal(await thinking.locator('[data-state="complete"]').count(), 1);
    await thinking.locator(':scope > summary').press('Space');
    assert.equal(await thinking.locator('ol').isVisible(), false);
    await activityPage.clock.runFor(600);
    assert.equal(await thinking.locator('.chat-demo-thinking__state').textContent(), 'Writing the response');
    assert.ok((await answer.locator('.db-bubble__content').textContent()).length > 0);
    assert.equal(await thinking.locator('ol').isVisible(), false, 'new stages do not reopen a collapsed disclosure');
    await thinking.locator(':scope > summary').press('Enter');
    assert.equal(await thinking.locator('ol').isVisible(), true);
    await activityPage.clock.runFor(5000);
    assert.equal(await thinking.getAttribute('data-state'), 'complete');
    assert.equal(await thinking.locator('.chat-demo-thinking__state').textContent(), 'Complete');
    assert.equal(await thinking.locator('[data-state="complete"]').count(), 3);
    assert.equal(await thinking.locator('ol').getAttribute('aria-busy'), 'false');
    assert.equal(await thinking.locator('.db-shimmer').count(), 0);
    assert.equal(await thinking.getAttribute('open'), '', 'completion preserves the reader\'s disclosure choice');
    await thinking.locator(':scope > summary').click();
    assert.equal(await thinking.locator('ol').isVisible(), false);
    await thinking.locator(':scope > summary').click();
    assert.deepEqual(await thinking.locator('li .db-marker__content').allTextContents(), ['Reviewing the request', 'Preparing the reply', 'Writing the response']);
    assert.equal(await thinking.locator('ol').isVisible(), true);
    assert.ok(await activityPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await activityPage.locator('#chat-prompt').fill('Stop during thinking');
    await activityPage.getByRole('button', { name: 'Send message', exact: true }).click();
    const stopped = activityPage.locator('[data-db-message-id="assistant-2"]');
    await activityPage.getByRole('button', { name: 'Stop response', exact: true }).click();
    await activityPage.clock.runFor(5000);
    assert.equal(await stopped.locator('.chat-demo-thinking').getAttribute('data-state'), 'stopped');
    assert.equal(await stopped.locator('.chat-demo-thinking__state').textContent(), 'Stopped');
    assert.equal(await stopped.locator('.db-bubble__content').textContent(), '');
    assert.equal(await stopped.locator('.db-shimmer').count(), 0);
    await stopped.locator('.chat-demo-thinking > summary').press('Enter');
    assert.equal(await stopped.locator('ol').isVisible(), true);
    assert.equal(await stopped.locator('li[data-state="stopped"]').isVisible(), true);
    await activityPage.getByRole('button', { name: 'Reset conversation', exact: true }).click();
    assert.equal(await activityPage.locator('.chat-demo-thinking').count(), 1);
    assert.equal(await initialActivity.getAttribute('data-state'), 'complete');
  } finally {
    await activityPage.close();
  }
});

test('expanded activity panels balance the rendered text inset on mobile and desktop', async () => {
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://daub.test/chat-demo.html');
    await page.evaluate(() => DAUB.setTheme('dark'));
    const thinking = page.locator('[data-db-message-id="initial-answer"] .chat-demo-thinking');
    await thinking.locator(':scope > summary').click();
    const step = thinking.locator('.chat-demo-step').first();
    await step.locator('summary').click();
    const detail = step.locator('.chat-demo-step__detail');
    const filled = (await detail.screenshot()).toString('base64');
    const originalStyle = await detail.evaluate(element => {
      const style = element.getAttribute('style');
      element.style.color = 'transparent';
      element.style.textShadow = 'none';
      return style;
    });
    const empty = (await detail.screenshot()).toString('base64');
    await detail.evaluate((element, style) => style === null ? element.removeAttribute('style') : element.setAttribute('style', style), originalStyle);
    const inset = await page.evaluate(async ({ filled, empty }) => {
      const images = await Promise.all([filled, empty].map(async base64 => {
        const image = new Image();
        image.src = 'data:image/png;base64,' + base64;
        await image.decode();
        return image;
      }));
      const canvas = document.createElement('canvas');
      canvas.width = images[0].width;
      canvas.height = images[0].height;
      const context = canvas.getContext('2d');
      const pixels = images.map(image => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      });
      let left = canvas.width, top = canvas.height, bottom = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4;
          const difference = [0, 1, 2].reduce((sum, channel) => sum + Math.abs(pixels[0][index + channel] - pixels[1][index + channel]), 0);
          if (difference > 60) { left = Math.min(left, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
        }
      }
      return { left, top, bottom: canvas.height - bottom - 1, visible: bottom >= top };
    }, { filled, empty });
    console.log('Activity panel text inset: ' + JSON.stringify({ width, ...inset }));
    assert.equal(inset.visible, true);
    assert.ok(Math.abs(inset.left - inset.top) <= 2, JSON.stringify(inset));
    assert.ok(Math.abs(inset.left - inset.bottom) <= 2, JSON.stringify(inset));
    assert.ok(await detail.evaluate(element => element.scrollWidth <= element.clientWidth), 'detail text wraps without horizontal overflow');
  }
  assert.deepEqual(errors, []);
});

test('message hover metadata reveals timestamps and an extensible copy action without layout shifts', async () => {
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://daub.test/chat-demo.html');
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedMessage = text; } } }));
    for (const id of ['initial-question', 'initial-answer']) {
      const message = page.locator('[data-db-message-id="' + id + '"] .db-message');
      const meta = message.locator('.db-message__footer--hover');
      assert.equal(await meta.count(), 1);
      assert.equal(await message.locator('.db-message__header time').count(), 0);
      assert.equal(await meta.locator('time[datetime]').count(), 1);
      const copy = meta.getByRole('button', { name: id === 'initial-question' ? 'Copy message' : 'Copy review checklist', exact: true });
      assert.equal(await meta.locator('.db-message__actions > button').count(), 1);
      await message.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await page.locator('#chat-prompt').focus();
      assert.equal(await meta.evaluate(element => getComputedStyle(element).opacity), '0');
      const before = await message.boundingBox();
      await message.locator('.db-bubble').hover();
      assert.equal(await meta.evaluate(element => getComputedStyle(element).opacity), '1');
      assert.deepEqual(await message.boundingBox(), before, 'hover preserves message bounds');
      await copy.click();
      assert.equal(await page.evaluate(() => window.copiedMessage), await message.locator('.db-bubble__content').textContent());
      await page.mouse.move(0, 0);
      await copy.press('Tab');
      await page.keyboard.press('Shift+Tab');
      console.log('Message metadata keyboard audit: ' + JSON.stringify(await copy.evaluate(element => ({ copyFocused: element === document.activeElement, active: document.activeElement?.outerHTML.slice(0, 180), footerFocused: element.closest('.db-message').matches(':focus-within') }))));
      assert.equal(await meta.evaluate(element => getComputedStyle(element).opacity), '1', 'keyboard focus reveals metadata');
      assert.equal(await copy.evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
      await copy.press('Enter');
      const rect = await meta.boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width, JSON.stringify(rect));
    }
    await page.getByRole('button', { name: 'Reset conversation', exact: true }).click();
    assert.equal(await page.locator('.db-message__footer--hover').count(), 2);
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Timestamp new messages');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await page.getByRole('button', { name: 'Stop response', exact: true }).click();
    for (const id of ['user-1', 'assistant-1']) {
      const date = await page.locator('[data-db-message-id="' + id + '"] time').getAttribute('datetime');
      assert.ok(Number.isFinite(Date.parse(date)), date);
    }
    assert.equal(await page.locator('[data-db-message-id="assistant-1"] .chat-demo-copy').isDisabled(), true, 'an empty stopped response cannot be copied');
    await page.locator('#chat-prompt').fill('Copy a partial response');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    const streaming = page.locator('[data-db-message-id="assistant-2"]');
    assert.equal(await streaming.locator('.chat-demo-copy').isDisabled(), true, 'copy waits for a finished or stopped response');
    await page.waitForFunction(() => document.querySelector('[data-db-message-id="assistant-2"] .db-bubble__content').textContent.length > 10);
    await page.getByRole('button', { name: 'Stop response', exact: true }).click();
    assert.equal(await streaming.locator('.chat-demo-copy').isDisabled(), false);
    await streaming.locator('.db-message').hover();
    await streaming.getByRole('button', { name: 'Copy response', exact: true }).click();
    assert.equal(await page.evaluate(() => window.copiedMessage), await streaming.locator('.db-bubble__content').textContent());
    const extended = await streaming.locator('.db-message__actions').evaluate(actions => {
      for (let i = 0; i < 2; i++) {
        const button = document.createElement('button');
        button.className = 'db-message__action';
        button.type = 'button';
        button.tabIndex = 0;
        button.setAttribute('aria-label', 'Custom message action ' + i);
        button.append(actions.querySelector('svg').cloneNode(true));
        actions.append(button);
      }
      return [...actions.children].map(button => button.getBoundingClientRect().toJSON());
    });
    assert.equal(extended.length, 3);
    assert.ok(extended.every(rect => rect.left >= 0 && rect.right <= width), JSON.stringify(extended));
  }
  assert.deepEqual(errors, []);
});

test('touch message metadata keeps copy controls available with touch-sized targets', async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, reducedMotion: 'reduce' });
  const touchPage = await context.newPage();
  touchPage.setDefaultTimeout(3000);
  await touchPage.route('**/*', route => {
    const url = new URL(route.request().url());
    const body = url.hostname === 'daub.test' && assets.get(url.pathname);
    if (!body) return route.abort();
    return route.fulfill({ body, contentType: url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.jpg') ? 'image/jpeg' : 'text/html' });
  });
  try {
    await touchPage.goto('http://daub.test/chat-demo.html');
    await touchPage.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.touchCopiedMessage = text; } } }));
    const meta = touchPage.locator('[data-db-message-id="initial-question"] .db-message__footer--hover');
    assert.equal(await meta.evaluate(element => getComputedStyle(element).opacity), '1');
    const copy = meta.getByRole('button', { name: 'Copy message', exact: true });
    const bounds = await copy.boundingBox();
    assert.ok(bounds.width >= 44 && bounds.height >= 44, JSON.stringify(bounds));
    await copy.tap();
    assert.equal(await touchPage.evaluate(() => window.touchCopiedMessage), await touchPage.locator('[data-db-message-id="initial-question"] .db-bubble__content').textContent());
    assert.ok(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  } finally { await context.close(); }
});

test('assistant activity and actions share the message gutter without a composer resize grip', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const body = url.hostname === 'daub.test' && assets.get(url.pathname);
    if (!body) return route.abort();
    return route.fulfill({ body, contentType: url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.jpg') ? 'image/jpeg' : 'text/html' });
  });
  await page.clock.install();
  try {
    for (const width of [320, 375, 1440]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto('http://daub.test/chat-demo.html');
      await page.locator('#chat-prompt').fill('Check mobile alignment');
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      await page.clock.runFor(6000);
      const answer = page.locator('[data-db-message-id="assistant-1"]');
      await answer.locator('.chat-demo-thinking > summary').click();
      const geometry = await answer.evaluate(element => {
        const left = selector => element.querySelector(selector).getBoundingClientRect().left;
        return {
          header: left('.db-message__header'), body: left('.db-bubble__content'),
          chevron: left('.chat-demo-thinking__chevron'), copy: left('.chat-demo-thinking__copy'),
          steps: [...element.querySelectorAll('.chat-demo-step')].map(step => ({
            icon: step.querySelector('.db-marker__icon').getBoundingClientRect().left,
            copy: step.querySelector('.db-marker__content').getBoundingClientRect().left
          })),
          footer: left('.db-message__footer'),
          resize: getComputedStyle(document.querySelector('#chat-prompt')).resize
        };
      });
      console.log('Assistant gutter audit: ' + JSON.stringify({ width, ...geometry }));
      for (const edge of [geometry.body, geometry.chevron, geometry.footer, ...geometry.steps.map(step => step.icon)]) {
        assert.ok(Math.abs(edge - geometry.header) <= 0.5, JSON.stringify(geometry));
      }
      for (const step of geometry.steps) assert.ok(Math.abs(step.copy - geometry.copy) <= 0.5, JSON.stringify(geometry));
      assert.equal(geometry.resize, 'none');
      assert.equal(await answer.getByRole('button', { name: 'Received', exact: true }).count(), 0);
      await answer.locator('.chat-demo-step summary').first().press('Enter');
      const detail = answer.locator('.chat-demo-step__detail').first();
      assert.equal(await detail.isVisible(), true);
      const bounds = await detail.boundingBox();
      assert.ok(bounds.x >= geometry.copy && bounds.x + bounds.width <= width, JSON.stringify(bounds));
      await page.locator('#chat-prompt').fill(Array.from({ length: 30 }, (_, i) => 'Line ' + i).join('\n'));
      const input = await page.locator('#chat-prompt').evaluate(element => ({ resize: getComputedStyle(element).resize, scrolls: element.scrollHeight > element.clientHeight, bottom: element.getBoundingClientRect().bottom }));
      assert.equal(input.resize, 'none');
      assert.equal(input.scrolls, true, 'long drafts retain internal scrolling');
      assert.ok(input.bottom <= 812, JSON.stringify(input));
      const nestedInset = await answer.locator('.db-message__content').evaluate(content => {
        const bubble = document.createElement('div');
        bubble.className = 'db-bubble';
        const reactions = document.createElement('div');
        reactions.className = 'db-bubble__reactions';
        bubble.append(reactions);
        content.append(bubble);
        const style = getComputedStyle(reactions);
        return [parseFloat(style.paddingInlineStart), parseFloat(style.paddingInlineEnd)];
      });
      assert.ok(nestedInset.every(inset => inset > 0), 'reactions inside a bubble retain their inset');
    }
  } finally { await page.close(); }
  assert.deepEqual(errors, []);
});

test('theme picker category tabs keep their labels inside the row across themes and widths', async () => {
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('http://daub.test/chat-demo.html');
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    await page.getByRole('button', { name: 'Open theme picker', exact: true }).click();
    const audit = await page.locator('.db-theme-switcher__popover').evaluate(popover => {
      const failures = [];
      const row = popover.querySelector('.db-theme-switcher__tabs');
      for (const theme of DAUB.THEMES) {
        DAUB.setTheme(theme);
        const panel = popover.getBoundingClientRect();
        const track = row.getBoundingClientRect();
        const tabs = [...row.children].map(tab => {
          const range = document.createRange();
          range.selectNodeContents(tab);
          const style = getComputedStyle(tab);
          return { label: tab.textContent, rect: tab.getBoundingClientRect().toJSON(), text: range.getBoundingClientRect().toJSON(), padding: parseFloat(style.paddingLeft) };
        });
        if (panel.left < 0 || panel.right > innerWidth || row.scrollWidth > row.clientWidth + 1 || tabs.some(tab =>
          tab.rect.left < track.left + 1 || tab.rect.right > track.right - 1 ||
          tab.text.left < tab.rect.left + tab.padding - 0.5 || tab.text.right > tab.rect.right - tab.padding + 0.5
        )) failures.push({ theme, width: innerWidth, panel: panel.toJSON(), track: track.toJSON(), tabs });
      }
      DAUB.setTheme('dark');
      return { themes: DAUB.THEMES.length, failures };
    });
    console.log('Theme picker tab audit: ' + JSON.stringify({ width, themes: audit.themes, failures: audit.failures.slice(0, 1) }));
    assert.equal(audit.failures.length, 0, JSON.stringify(audit.failures.slice(0, 1)));
    const trending = page.getByRole('button', { name: 'Trending', exact: true });
    await trending.click();
    assert.equal(await trending.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'horizon', exact: true }).isVisible(), true);
    await trending.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Open theme picker', exact: true }).getAttribute('aria-expanded'), 'false');
  }
  assert.deepEqual(errors, []);
});

test('conversation fits mobile and desktop widths and loads its attachment image', async () => {
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('http://daub.test/chat-demo.html');
    await page.waitForFunction(() => document.querySelector('.db-attachment img').complete);
    assert.ok(await page.locator('.db-attachment img').evaluate(image => image.naturalWidth > 0));
    const thinking = page.locator('[data-db-message-id="initial-answer"] .chat-demo-thinking');
    await thinking.locator(':scope > summary').click();
    assert.equal(await thinking.evaluate(element => {
      const parent = element.parentElement.getBoundingClientRect();
      return [...element.querySelectorAll('summary, li')].every(child => {
        const rect = child.getBoundingClientRect();
        return rect.left >= parent.left && rect.right <= parent.right && (child.tagName !== 'LI' || rect.height <= 24);
      });
    }), true, 'Thinking rows fit their column and stay compact');
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Check mobile layout');
    await page.getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Stop response', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Stop response', exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const bounds = await page.locator('.chat-demo-composer').boundingBox();
    assert.ok(bounds.y + bounds.height <= 812, 'composer remains in the viewport');
    const theme = await page.getByRole('button', { name: 'Open theme picker', exact: true }).boundingBox();
    const send = await page.getByRole('button', { name: 'Send message', exact: true }).boundingBox();
    assert.ok(theme.y + theme.height <= 56, 'theme control stays in the header');
    assert.ok(theme.y + theme.height <= send.y, 'theme control does not cover Send');
  }
  assert.deepEqual(errors, []);
});

test('send, stream, stop, reset, and composition keyboard input remain independent', async () => {
  await page.goto('http://daub.test/chat-demo.html');
  const input = page.getByRole('textbox', { name: 'Message', exact: true });
  assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true);
  await input.fill('Review attachment states');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
  assert.equal(await page.locator('[data-db-message-id^="user-"]').count(), 0);
  await input.press('Shift+Enter');
  assert.equal(await page.locator('[data-db-message-id^="user-"]').count(), 0);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-db-message-id^="assistant-"] .db-bubble__content').textContent.length > 10);
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
  const stopped = await page.locator('[data-db-message-id^="assistant-"] .db-bubble__content').textContent();
  await page.waitForTimeout(160);
  assert.equal(await page.locator('[data-db-message-id^="assistant-"] .db-bubble__content').textContent(), stopped);
  assert.equal(await page.locator('#chat-messages').getAttribute('aria-busy'), 'false');
  await page.getByRole('button', { name: 'Reset conversation', exact: true }).click();
  assert.equal(await page.locator('[data-db-message-id^="user-"]').count(), 0);
  await input.fill('Release review');
  await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chat-status').textContent === 'Ready');
  assert.equal(await page.getByRole('button', { name: 'Received', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Reset conversation', exact: true }).click();
  await page.locator('[data-db-message-id="initial-answer"] .db-message').hover();
  await page.getByRole('button', { name: 'Copy review checklist', exact: true }).click();
  await page.waitForFunction(() => /Copied|Clipboard unavailable/.test(document.querySelector('#chat-status').textContent));
  assert.deepEqual(errors, []);
});

test('local attachment actions remove files without submitting and long names do not overflow', async () => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('http://daub.test/chat-demo.html');
  const name = 'release-review-' + 'long-name-'.repeat(8) + '.txt';
  await page.locator('#chat-file').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('Local attachment') });
  assert.equal(await page.locator('#pending-attachments .db-attachment').count(), 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Remove ' + name, exact: true }).click();
  assert.equal(await page.locator('#pending-attachments .db-attachment').count(), 0);
  assert.equal(await page.locator('[data-db-message-id^="user-"]').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true);
});

test('long filenames and short windows keep the composer within reach', async () => {
  const name = 'x'.repeat(250) + '.txt';
  for (const height of [568, 320]) {
    await page.setViewportSize({ width: 320, height });
    await page.goto('http://daub.test/chat-demo.html');
    await page.addStyleTag({ content: '.chat-demo .chat-demo-icon-button{width:44px;height:44px}' });
    await page.locator('#chat-file').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('Local') });
    const title = await page.locator('#pending-attachments .db-attachment__title').boundingBox();
    const send = await page.getByRole('button', { name: 'Send message', exact: true }).boundingBox();
    const viewport = await page.locator('.db-message-scroller__viewport').boundingBox();
    assert.ok(title.height < 50, 'filename stays within two lines');
    assert.equal(await page.locator('#pending-attachments .db-attachment__title').getAttribute('title'), name);
    assert.ok(viewport.height > 0, 'transcript retains visible space');
    assert.ok(send.y + send.height <= height, 'Send remains in the viewport');
  }
});

test('delayed clipboard results cannot overwrite a newer streaming status', async () => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto('http://daub.test/chat-demo.html');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise(resolve => { window.resolveCopy = resolve; }) } }));
  await page.locator('[data-db-message-id="initial-answer"] .db-message').hover();
  await page.getByRole('button', { name: 'Copy review checklist', exact: true }).click();
  await page.getByRole('button', { name: 'Reset conversation', exact: true }).click();
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Review the release');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.evaluate(() => window.resolveCopy());
  assert.equal(await page.locator('#chat-status').textContent(), 'Simulated response');
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
});

test('chat primitives inherit 42 themes, constrain corners, and respect reduced motion', async () => {
  await page.goto('http://daub.test/chat-demo.html');
  const themes = await page.evaluate(() => DAUB.THEMES);
  for (const theme of themes) {
    await page.evaluate(theme => DAUB.setTheme(theme), theme);
    const style = await page.evaluate(() => {
      const bubble = getComputedStyle(document.querySelector('.db-bubble'));
      const button = getComputedStyle(document.querySelector('#chat-send'));
      const attachment = getComputedStyle(document.querySelector('.db-attachment'));
      return { bubbleText: bubble.color, buttonText: button.color, bubbleRadius: parseFloat(bubble.borderTopLeftRadius), attachmentRadius: parseFloat(attachment.borderTopLeftRadius) };
    });
    assert.notEqual(style.buttonText, 'rgba(0, 0, 0, 0)', theme + ' send text remains visible');
    assert.ok(style.bubbleRadius <= 8 && style.attachmentRadius <= 8, theme + ' corner limit');
  }
  await page.locator('#chat-prompt').fill('Start a reply');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  assert.equal(await page.locator('.db-shimmer').evaluate(element => getComputedStyle(element).animationName), 'none');
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
  assert.deepEqual(errors, []);
});
