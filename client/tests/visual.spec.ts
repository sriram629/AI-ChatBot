import { test, expect, enterChat } from './fixtures';
test('capture empty and populated chat layouts', async ({ page, app }, testInfo) => {
  await enterChat(page);
  await expect(page.getByRole('button', { name: 'Explain a concept' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('empty-chat.png'), animations: 'disabled' });
  await page.getByRole('textbox', { name: 'Message' }).fill('Summarize my project notes');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => app.requests.length).toBe(1);
  app.emit({ type: 'model', content: 'Gemini' });
  app.emit({ type: 'chunk', content: '## Your project at a glance\n\nThe notes describe a **multimodal AI assistant** that can answer questions about your documents.\n\n- Upload a PDF to get started.\n- Ask a focused question about its content.\n- Continue the discussion in the same conversation.\n\n| Feature | Status |\n|---|---|\n| Document questions | Ready |\n| Image understanding | Ready |' });
  app.emit({ type: 'end' });
  await expect(page.getByRole('region', { name: 'Response table' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('conversation.png'), animations: 'disabled' });
});
