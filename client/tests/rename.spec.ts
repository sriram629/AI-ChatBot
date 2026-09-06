import { test, expect, enterChat } from './fixtures';
test('rename saves, persists on reload, and rejects empty names', async ({ page, app }) => {
  await enterChat(page);
  if (!await page.getByRole('button', { name: 'Rename Project notes' }).isVisible()) await page.getByRole('button', { name: /Open sidebar/ }).click();
  await page.getByRole('button', { name: 'Rename Project notes' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Conversation name').fill('   ');
  await expect(page.getByRole('button', { name: 'Save name' })).toBeDisabled();
  await page.getByLabel('Conversation name').fill('Planning notes');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => app.sessions[0].title).toBe('Planning notes');
  await page.reload();
  if (!await page.getByRole('button', { name: 'Rename Planning notes' }).isVisible()) await page.getByRole('button', { name: /Open sidebar/ }).click();
  await expect(page.getByRole('button', { name: 'Rename Planning notes' })).toBeVisible();
});
