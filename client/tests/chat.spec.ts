import { test, expect, enterChat } from "./fixtures";
test("chat opens and sends a message without duplicating it", async ({ page, app }) => {
  await enterChat(page);
  await page.getByRole("textbox").first().fill("Hello UI");
  await page.getByRole("textbox").first().press("Enter");
  await expect.poll(() => app.requests.length).toBe(1);
  expect(app.requests[0].message).toBe("Hello UI");
  app.emit({ type: "chunk", content: "Hello Sam" });
  app.emit({ type: "end" });
  await expect(page.getByText("Hello Sam", { exact: true })).toBeVisible();
});

