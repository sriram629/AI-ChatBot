import { test, expect, enterChat } from './fixtures';
test('document preparation feedback appears before the answer starts', async ({ page, app }) => {
  await enterChat(page);
  await expect.poll(() => app.sockets.length).toBeGreaterThan(0);
  app.emit({ type: 'status', content: 'Finding relevant passages in your documents…' });
  await expect(page.getByRole('status').filter({ hasText: 'Finding relevant passages' })).toBeVisible();
  app.emit({ type: 'start' });
  app.emit({ type: 'chunk', content: 'Maple launches October 14.' });
  app.emit({ type: 'end' });
  await expect(page.getByText('Maple launches October 14.', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Finding relevant passages' })).toHaveCount(0);
});
