import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';

const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
const controls = [
  '<button type="button" class="db-btn db-btn--secondary">Search</button>',
  '<input class="db-input" aria-label="Query" value="Project">',
  '<select class="db-select__input" aria-label="Scope"><option>All</option></select>',
];
const fixtures = [
  Array(3).fill(controls[0]),
  controls,
  [controls[1], controls[2], controls[0]],
  [controls[2], controls[0], controls[1]],
];
let browser;
before(async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  browser = await ({ chromium, firefox, webkit })[engine].launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE_PATH || (engine === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH : undefined),
  });
});
after(async () => { await browser?.close(); });

async function render(page, children, { vertical = false, attached = true, theme = 'light' } = {}) {
  const classes = ['db-group', attached && 'db-group--attached', vertical && 'db-group--vertical'].filter(Boolean).join(' ');
  await page.setContent(`<html data-theme="${theme}"><body style="padding:40px"><div class="${classes}" role="group" aria-label="Search controls" style="width:280px">${children.join('')}</div></body></html>`);
  await page.addStyleTag({ content: css });
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map(animation => animation.finished));
  });
}

async function geometry(page) {
  return page.locator('.db-group > *').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      borders: ['Top', 'Right', 'Bottom', 'Left'].map(side => [style[`border${side}Width`], style[`border${side}Style`]]),
      radii: ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(corner => style[`border${corner}Radius`]),
    };
  }));
}

function assertJoined(boxes, vertical, radius, label) {
  for (const [index, box] of boxes.entries()) {
    assert.deepEqual(box.borders, Array(4).fill(['1px', 'solid']), `${label}: control ${index} retains its borders`);
    const expected = vertical
      ? index === 0 ? [radius, radius, '0px', '0px'] : index === boxes.length - 1 ? ['0px', '0px', radius, radius] : Array(4).fill('0px')
      : index === 0 ? [radius, '0px', '0px', radius] : index === boxes.length - 1 ? ['0px', radius, radius, '0px'] : Array(4).fill('0px');
    assert.deepEqual(box.radii, expected, `${label}: control ${index} rounds only exterior corners`);
    if (index > 0) {
      const previous = boxes[index - 1];
      const overlap = vertical ? previous.y + previous.height - box.y : previous.x + previous.width - box.x;
      assert.ok(Math.abs(overlap - 1) < 0.01, `${label}: join ${index} overlaps one border pixel, got ${overlap}`);
      assert.equal(vertical ? box.x : box.y, vertical ? previous.x : previous.y, `${label}: aligned cross-axis origin`);
      assert.equal(vertical ? box.width : box.height, vertical ? previous.width : previous.height, `${label}: aligned cross-axis size`);
    }
  }
}

for (const vertical of [false, true]) {
  const axis = vertical ? 'vertical' : 'horizontal';
  test(`attached ${axis} Group joins actual buttons, inputs, and selects`, async () => {
    const page = await browser.newPage();
    try {
      for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        for (const theme of ['light', 'dark', 'github-light']) {
          for (const [index, fixture] of fixtures.entries()) {
            await render(page, fixture, { vertical, theme });
            const radius = await page.locator('.db-group').evaluate(element => getComputedStyle(element).getPropertyValue('--db-radius-2').trim());
            assertJoined(await geometry(page), vertical, radius, `${axis}/${theme}/${width}/fixture ${index}`);
          }
        }
      }
    } finally { await page.close(); }
  });

  test(`attached ${axis} Group keeps keyboard focus above shared borders without moving controls`, async () => {
    const page = await browser.newPage();
    try {
      for (const [fixtureIndex, fixture] of fixtures.entries()) {
        await render(page, fixture, { vertical });
        const beforeFocus = await geometry(page);
        for (let index = 0; index < fixture.length; index++) {
          // WebKit on macOS uses Option-Tab to include buttons in keyboard navigation.
          const tabKey = process.platform === 'darwin' && process.env.DAUB_TEST_BROWSER === 'webkit' ? 'Alt+Tab' : 'Tab';
          await page.keyboard.press(tabKey);
          const focus = await page.locator('.db-group > *').nth(index).evaluate(async element => {
            await Promise.all(element.getAnimations().map(animation => animation.finished));
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const vertical = element.parentElement.classList.contains('db-group--vertical');
            const neighbors = [element.previousElementSibling, element.nextElementSibling].filter(Boolean);
            return {
              active: document.activeElement === element,
              visible: element.matches(':focus-visible'),
              shadow: style.boxShadow,
              joinsOnTop: neighbors.map(neighbor => {
                const other = neighbor.getBoundingClientRect();
                const x = vertical ? rect.x + rect.width / 2 : Math.max(rect.x, other.x) + 0.5;
                const y = vertical ? Math.max(rect.y, other.y) + 0.5 : rect.y + rect.height / 2;
                return document.elementFromPoint(x, y) === element;
              }),
            };
          });
          assert.equal(focus.active, true);
          assert.equal(focus.visible, true);
          assert.match(focus.shadow, /0px 0px 0px 3px/, 'control retains its focus ring');
          assert.deepEqual(await geometry(page), beforeFocus, 'focus preserves borders, corners, and bounds');
          assert.ok(focus.joinsOnTop.every(Boolean), `${axis}/fixture ${fixtureIndex}/control ${index}: focused border paints above neighbors`);
        }
      }
      if (process.env.DAUB_GROUP_SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.DAUB_GROUP_SCREENSHOT_DIR}/group-${axis}.png` });
      }
    } finally { await page.close(); }
  });

  test(`attached ${axis} Group rounds all corners of a single control`, async () => {
    const page = await browser.newPage();
    try {
      for (const control of controls) {
        await render(page, [control], { vertical });
        const [box] = await geometry(page);
        assert.deepEqual(box.radii, Array(4).fill('8px'));
        assert.deepEqual(box.borders, Array(4).fill(['1px', 'solid']));
        assert.equal(await page.locator('.db-group > *').evaluate(element => getComputedStyle(element).marginLeft), '0px');
        assert.equal(await page.locator('.db-group > *').evaluate(element => getComputedStyle(element).marginTop), '0px');
      }
    } finally { await page.close(); }
  });

  test(`unattached ${axis} Group preserves spacing and standalone corners`, async () => {
    const page = await browser.newPage();
    try {
      await render(page, controls, { vertical, attached: false });
      const boxes = await geometry(page);
      for (const [index, box] of boxes.entries()) {
        assert.deepEqual(box.radii, Array(4).fill('8px'));
        assert.deepEqual(box.borders, Array(4).fill(['1px', 'solid']));
        if (index > 0) {
          const previous = boxes[index - 1];
          const gap = vertical ? box.y - previous.y - previous.height : box.x - previous.x - previous.width;
          assert.ok(Math.abs(gap - 8) < 0.01, `${axis}: detached gap stays 8px`);
        }
      }
    } finally { await page.close(); }
  });
}
