// Historical snippets, not an active test suite.
// Extracted from tests/playground/workflow.test.mjs on 2026-10-09.
// Base revision: 034b7311cd7422a2714b6ccacdb58a1b8df80969; source included
// uncommitted integration changes. These four assertions retain their original
// bodies and require the old workflow open(t, { react: true }), spec fixture,
// test/assert imports, React mount and __playgroundBridge.
// See playground-generation-modes.md.

test('React example selection fills the controlled composer and retains provider settings', async (t) => {
  const page = await open(t, { react: true });
  await page.locator('#pg-chat-mount').getByText('Settings page with tabs and form fields', { exact: true }).click();
  assert.equal(await page.locator('[data-aui-composer-input]').inputValue(), 'Settings page with tabs and form fields');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Own Key' }).click();
  assert.equal(await page.locator('#pg-byok-modal').getAttribute('aria-hidden'), 'false');
});

test('React chat commits successful responses and updates later request context', async (t) => {
  const page = await open(t, { react: true });
  let request;
  await page.route('**/api/generate', async (route) => {
    request = route.request().postDataJSON();
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(spec) } }] }) + '\n\ndata: [DONE]\n\n' });
  });
  await page.locator('[data-aui-composer-input]').fill('Build a title');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).click();
  await page.frameLocator('#pg-preview-frame').getByText('Restored preview', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__playgroundBridge.getCurrentSpec().root), 'title');
  await page.locator('[data-aui-composer-input]').fill('Change the title');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).click();
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).waitFor();
  assert.ok(request.messages.some((message) => message.role === 'assistant' && message.content === JSON.stringify(spec)));
});

test('React Stop cancels without persisting a spec', async (t) => {
  const page = await open(t, { react: true });
  let release;
  await page.route('**/api/generate', async (route) => {
    await new Promise((resolve) => { release = resolve; });
    await route.abort();
  });
  await page.locator('[data-aui-composer-input]').fill('Build a title');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).click();
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Stop' }).click();
  release?.();
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('pg-current-spec')), null);
});

test('React chat surfaces provider errors and makes one request for a quota error', async (t) => {
  const page = await open(t, { react: true });
  let requests = 0;
  await page.route('**/api/generate', async (route) => {
    requests++;
    await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Quota exceeded' } }) });
  });
  await page.locator('[data-aui-composer-input]').fill('Build a title');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).click();
  await page.locator('#pg-chat-mount [role="alert"]').waitFor();
  assert.equal(requests, 1);
  assert.equal(await page.evaluate(() => window.__playgroundBridge.getCurrentSpec()), null);
});
