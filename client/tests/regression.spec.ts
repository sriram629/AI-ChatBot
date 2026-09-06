import { test, expect, enterChat } from './fixtures';

test('edit and regenerate retain the conversation and send the correct action', async ({ page, app }) => {
  await enterChat(page);
  await page.getByRole('textbox', { name: 'Message' }).fill('Original question');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => app.requests.length).toBe(1);
  app.emit({ type: 'chunk', content: 'Original answer' }); app.emit({ type: 'end' });
  await page.getByRole('button', { name: 'Edit message' }).click();
  await page.getByRole('textbox', { name: 'Edit message' }).fill('Revised question');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => app.requests.length).toBe(2);
  expect(app.requests[1]).toMatchObject({ type: 'edit', newContent: 'Revised question' });
  app.emit({ type: 'chunk', content: 'Revised answer' }); app.emit({ type: 'end' });
  await page.getByRole('button', { name: 'Regenerate response' }).click();
  await expect.poll(() => app.requests.length).toBe(3);
  expect(app.requests[2].type).toBe('regenerate');
  await expect(page).toHaveURL(/session-1/);
});

test('clipboard rejection gives feedback without crashing', async ({ page, app }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied')) }, configurable: true }));
  await enterChat(page);
  await page.getByRole('textbox', { name: 'Message' }).fill('Copy this');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => app.requests.length).toBe(1);
  app.emit({ type: 'chunk', content: 'A useful answer' }); app.emit({ type: 'end' });
  await page.getByRole('button', { name: 'Copy message' }).last().click();
  await expect(page.getByText('Copy isn’t available. Select the text to copy it manually.').first()).toBeVisible();
});

test('failed rename keeps the old name and allows retry', async ({ page, app }) => {
  await enterChat(page);
  if ((page.viewportSize()?.width || 0) < 1024) await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.route('**/api/chat/sessions/session-1', route => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }));
  await page.getByRole('button', { name: 'Project notes', exact: true }).hover();
  await page.getByRole('button', { name: 'Rename Project notes' }).click();
  await page.getByLabel('Conversation name').fill('New name');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Couldn’t rename this conversation. Please try again.')).toBeVisible();
  expect(app.sessions[0].title).toBe('Project notes');
  await expect(page.getByRole('button', { name: 'Save name' })).toBeEnabled();
});
