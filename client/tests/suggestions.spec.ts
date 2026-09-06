import { test, expect, enterChat } from './fixtures';
test('starter prompts populate an editable draft without sending it', async ({ page, app }) => {
  await enterChat(page);
  await page.getByRole('button', { name: 'Explain a concept' }).click();
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue(/neural networks/);
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeFocused();
  expect(app.requests).toHaveLength(0);
  await page.getByRole('textbox', { name: 'Message' }).fill('Explain gravity');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => app.requests.length).toBe(1);
});
