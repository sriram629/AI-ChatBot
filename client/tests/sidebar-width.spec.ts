import { test, expect, enterChat } from './fixtures';
test('long titles keep padded rename and delete controls inside the sidebar', async ({ page, app }, testInfo) => {
  const title = 'A very long conversation title about documents and project planning that must never push actions offscreen';
  app.sessions[0].title = title;
  await enterChat(page);
  if ((page.viewportSize()?.width || 0) < 1024) await page.getByRole('button', { name: 'Open sidebar' }).click();
  const sidebar = page.getByLabel('Conversations', { exact: true });
  const rename = page.getByRole('button', { name: 'Rename ' + title, exact: true });
  const remove = page.getByRole('button', { name: 'Delete ' + title, exact: true });
  await expect(rename).toBeVisible();
  const bounds = await sidebar.boundingBox();
  for (const button of [rename, remove]) {
    const box = await button.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(bounds!.x + 12);
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width - 12);
  }
  const titleText = page.getByRole('button', { name: title, exact: true }).locator('span').first();
  expect((await titleText.innerText()).split('\n')[0].length).toBeLessThanOrEqual(25);
  await page.screenshot({ path: testInfo.outputPath('long-title-sidebar.png'), animations: 'disabled' });
  await page.getByRole('button', { name: title, exact: true }).hover();
  await rename.click();
  await expect(page.getByLabel('Conversation name')).toHaveValue(title);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: title, exact: true }).hover();
  await remove.click();
  await expect(page.getByRole('dialog', { name: 'Delete conversation?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});
