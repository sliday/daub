import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const home = dirname(fileURLToPath(import.meta.url)), root = resolve(home, '../..');
const dir = resolve(home, 'live/01-hybrid'), output = resolve(home, 'results-verification');
await mkdir(output);
const html = await readFile(resolve(dir, 'generated.html'), 'utf8');
const spec = JSON.parse(await readFile(resolve(dir, 'spec.json'), 'utf8'));
const { bindings: b, data } = spec.hybrid.contract.recipe;
const browser = await chromium.launch({ headless: true, channel: 'chrome' }), results = [];
try {
  for (const width of [390, 1200]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.href === 'http://daub.test/') return route.fulfill({ body: '<html></html>', contentType: 'text/html' });
      if (route.request().method() === 'GET' && ['daub.dev', 'daub.test'].includes(url.hostname) && /^\/daub(?:-render)?\.(js|css)$/.test(url.pathname)) {
        return route.fulfill({ body: await readFile(resolve(root, '.' + url.pathname)), contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
      }
      return route.abort();
    });
    try {
      const page = await context.newPage();
      await page.goto('http://daub.test/'); await page.setContent(html, { waitUntil: 'load' });
      const target = id => page.locator('[data-spec-id="' + id + '"]');
      const read = () => page.evaluate(() => window.DaubPrototype.getOutput());
      assert.equal(await target(b.next).isDisabled(), true);
      assert.equal(await target(b.back).isDisabled(), true);
      assert.equal(await target(b.resultScreen).isVisible(), false);
      await target(b.choices).locator('label').first().click();
      await target(b.next).click(); await target(b.back).click();
      assert.equal(await target(b.choices).locator('input').first().isChecked(), true);
      const expected = [];
      for (const [index, question] of data.questions.entries()) {
        const optionIndex = index % question.options.length, choice = question.options[optionIndex];
        await target(b.choices).locator('label').nth(optionIndex).click();
        expected.push({ questionId: question.id, question: question.text, answer: choice.label, value: choice.value, score: choice.score });
        await target(b.next).click();
      }
      const completed = await read();
      assert.equal(completed.completed, true); assert.equal(completed.answers.length, 10);
      assert.deepEqual(completed.answers, expected);
      assert.equal(completed.result, expected.reduce((sum, answer) => sum + answer.score, 0));
      assert.equal(await target(b.resultScreen).isVisible(), true);
      assert.equal(await target(b.questionScreen).isVisible(), false);
      const review = await target(b.answerReview).innerText();
      for (const answer of expected) assert.ok(review.includes(answer.question + ': ' + answer.answer));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1);
      await page.screenshot({ path: resolve(output, 'results-' + width + '.png'), fullPage: true });
      await target(b.restart).click();
      const restarted = await read();
      assert.equal(restarted.completed, false); assert.equal(restarted.step, 1); assert.deepEqual(restarted.answers, []); assert.equal(restarted.result, null);
      assert.equal(await target(b.next).isDisabled(), true);
      assert.equal(await target(b.questionScreen).isVisible(), true);
      assert.equal(await target(b.resultScreen).isVisible(), false);
      results.push({ width, passed: true, completed, restarted, overflow });
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify({ htmlSha256: createHash('sha256').update(html).digest('hex'), modelCalls: 0, results }, null, 2));
}
console.log(JSON.stringify(results.map(({ width, passed, completed }) => ({ width, passed, answerCount: completed.answers.length, result: completed.result }))));
