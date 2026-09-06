import { test, expect, enterChat } from './fixtures';
test('provider indicator reflects the server including fallback', async ({ page, app }) => {
  await enterChat(page);
  await expect.poll(() => app.sockets.length).toBeGreaterThan(0);
  await expect(page.getByLabel('Response provider')).toHaveCount(0);
  app.emit({ type: 'model', content: 'Gemini' });
  await expect(page.getByLabel('Response provider')).toHaveText('Gemini');
  app.emit({ type: 'model', content: 'Groq' });
  await expect(page.getByLabel('Response provider')).toHaveText('Groq · backup');
});
