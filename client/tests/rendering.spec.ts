import { test, expect, enterChat } from './fixtures';
test('long code and tables fit mobile messages and links stay safe', async ({ page, app }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterChat(page);
  await page.getByRole('textbox', { name: 'Message' }).fill('Show a sample');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => app.requests.length).toBe(1);
  app.emit({ type: 'chunk', content: '```\n' + 'long_value'.repeat(80) + '\n```\n\n| Item | Value |\n|---|---|\n| A | B |\n\n[Source](https://example.com)' });
  app.emit({ type: 'end' });
  await expect(page.getByRole('region', { name: 'Response table' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Source' })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Regenerate response' })).toBeVisible();
});
test('image preview supports opening and Escape', async ({ page, app }) => {
  await page.route('**/test-image.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="teal"/></svg>' }));
  await enterChat(page);
  await page.getByRole('textbox', { name: 'Message' }).fill('Show image');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => app.requests.length).toBe(1);
  app.emit({ type: 'chunk', content: '![A teal square](/test-image.png)' }); app.emit({ type: 'end' });
  await page.getByRole('button', { name: 'Enlarge A teal square' }).click();
  await expect(page.getByRole('dialog', { name: 'A teal square' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'A teal square' })).toBeHidden();
});
