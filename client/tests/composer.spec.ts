import { test, expect, enterChat } from "./fixtures";
test("attachment preview can be removed and oversized files cannot be sent", async ({ page, app }) => {
  await enterChat(page);
  await page.getByLabel("Choose attachment").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Maple") });
  await expect(page.getByText("Ready to send", { exact: false })).toBeVisible();
  await expect(page.getByText("notes.txt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove attachment" }).click();
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await page.getByLabel("Choose attachment").setInputFiles({ name: "large.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
  await expect(page.getByRole("alert").filter({ hasText: "too large" })).toBeVisible();
  expect(app.requests).toHaveLength(0);
});
test("upload failure is readable and Enter cannot send during upload", async ({ page, app }) => {
  await enterChat(page);
  await page.route("**/api/chat/upload", async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.fulfill({ status: 400, json: { detail: "No readable text found. Scanned PDFs require OCR." } });
  });
  await page.getByLabel("Choose attachment").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from("scan") });
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.getByRole("textbox", { name: "Message" }).fill("Explain this");
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
  expect(app.requests).toHaveLength(0);
  await expect(page.getByRole("alert").filter({ hasText: "Scanned PDFs require OCR" }).first()).toBeVisible();
});

