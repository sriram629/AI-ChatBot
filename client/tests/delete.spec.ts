import { test, expect, enterChat } from './fixtures';
test('deleting requires confirmation and clears the active conversation', async ({ page, app }) => {
  await enterChat(page);
  if ((page.viewportSize()?.width || 0) < 1024) await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Project notes', exact: true }).hover();
  await page.getByRole('button', { name: 'Delete Project notes' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(app.sessions).toHaveLength(1);
  await page.getByRole('button', { name: 'Project notes', exact: true }).hover();
  await page.getByRole('button', { name: 'Delete Project notes' }).click();
  await page.getByRole('button', { name: 'Delete conversation', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect.poll(() => app.sessions.length).toBe(0);
});
