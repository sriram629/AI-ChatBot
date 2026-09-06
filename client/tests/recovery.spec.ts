import { test, expect, enterChat } from './fixtures';
test('chat errors remain visible until dismissed', async ({ page, app }) => {
  await enterChat(page);
  await expect.poll(() => app.sockets.length).toBeGreaterThan(0);
  app.emit({ type: 'error', content: 'The service is busy. Please try again.' });
  await expect(page.getByRole('alert').filter({ hasText: 'service is busy' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss chat error' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'service is busy' })).toHaveCount(0);
});
test('offline feedback does not navigate away from the conversation', async ({ page, app }) => {
  await enterChat(page);
  await expect.poll(() => app.sockets.length).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByRole('status').filter({ hasText: 'You’re offline' })).toBeVisible();
  await expect(page).toHaveURL(/session-1/);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('status').filter({ hasText: 'You’re offline' })).toHaveCount(0);
});
