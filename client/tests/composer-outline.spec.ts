import { test, expect, enterChat } from './fixtures';
test('composer has one outer outline when typing', async ({ page, app }, testInfo) => {
  await enterChat(page);
  const input = page.getByRole('textbox', { name: 'Message' });
  await input.fill('A single clean input field');
  await expect(input).toBeFocused();
  const appearance = await input.evaluate(element => {
    const style = getComputedStyle(element);
    return { border: style.borderTopWidth, outline: style.outlineStyle, shadow: style.boxShadow, background: style.backgroundColor };
  });
  expect(appearance.border).toBe('0px');
  expect(appearance.outline).toBe('none');
  expect(appearance.background).toBe('rgba(0, 0, 0, 0)');
  expect(appearance.shadow === 'none' || !appearance.shadow.match(/[1-9]\d*px/)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('focused-composer.png'), animations: 'disabled' });
  expect(app.requests).toHaveLength(0);
});
