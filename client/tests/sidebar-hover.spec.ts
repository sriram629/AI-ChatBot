import { test, expect, enterChat } from './fixtures';
test('only the hovered conversation reveals actions on pointer devices', async ({ page, app }) => {
  app.sessions.push({ session_id: 'session-2', title: 'Another conversation', updated_at: '2026-09-06T12:00:00Z' });
  await enterChat(page);
  if ((page.viewportSize()?.width || 0) < 1024) await page.getByRole('button', { name: 'Open sidebar' }).click();
  const first = page.getByRole('button', { name: 'Rename Project notes' }).locator('..');
  const second = page.getByRole('button', { name: 'Rename Another conversation' }).locator('..');
  if (await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)) {
    await expect(first).toHaveCSS('opacity', '0');
    await page.getByRole('button', { name: 'Project notes', exact: true }).hover();
    await expect(first).toHaveCSS('opacity', '1');
    await expect(second).toHaveCSS('opacity', '0');
    await page.getByRole('button', { name: 'Another conversation', exact: true }).hover();
    await expect(first).toHaveCSS('opacity', '0');
    await expect(second).toHaveCSS('opacity', '1');
    await page.getByRole('button', { name: 'Rename Project notes' }).focus();
    await expect(first).toHaveCSS('opacity', '1');
  } else {
    await expect(first).toHaveCSS('opacity', '1');
  }
});
