import { test, expect, enterChat } from './fixtures';
test('stop waits for acknowledgement and preserves the next draft', async ({ page, app }) => {
  app.autoStop = false;
  await enterChat(page);
  await page.getByRole('textbox', { name: 'Message' }).fill('First question');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => app.requests.length).toBe(1);
  await page.getByRole('button', { name: 'Stop generating' }).click();
  await expect(page.getByRole('button', { name: 'Stopping', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Message' }).fill('Next question');
  await page.getByRole('textbox', { name: 'Message' }).press('Enter');
  await expect.poll(() => app.requests.length).toBe(2);
  expect(app.requests[1].type).toBe('stop');
  app.emit({ type: 'end' });
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue('Next question');
});
