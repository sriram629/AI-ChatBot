import { test, expect, enterChat } from './fixtures';
test('mobile drawer closes on navigation and Escape without covering the composer', async ({ page, app }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterChat(page);
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await expect(page.getByRole('dialog', { name: 'Conversations' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open sidebar' })).toBeFocused();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
