import { test as base, expect, type Page, type WebSocketRoute } from "@playwright/test";
export { expect };
export type Harness = {
  requests: Record<string, unknown>[];
  sessions: { session_id: string; title: string; updated_at: string }[];
  sockets: WebSocketRoute[];
  emit: (value: Record<string, unknown>) => void;
  errors: string[];
};
export const test = base.extend<{ app: Harness }>({
  app: async ({ page }, use) => {
    const app: Harness = {
      requests: [], sockets: [], sessions: [{ session_id: "session-1", title: "Project notes", updated_at: "2026-09-06T12:00:00Z" }],
      emit(value) { app.sockets.at(-1)?.send(JSON.stringify(value)); }, errors: [],
    };
    page.on("pageerror", err => app.errors.push(err.message));
    await page.addInitScript(() => localStorage.setItem("token", "ui-test-token"));
    await page.route("**/api/**", async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      if (path.endsWith("/auth/me")) return route.fulfill({ json: { email: "test@example.test", first_name: "Sam" } });
      if (path.endsWith("/messages")) return route.fulfill({ json: [] });
      if (path.endsWith("/sessions") && req.method() === "GET") return route.fulfill({ json: app.sessions });
      if (path.endsWith("/sessions") && req.method() === "POST") return route.fulfill({ json: { session_id: "session-1" } });
      if (req.method() === "PATCH") {
        const title = req.postDataJSON().title;
        app.sessions[0].title = title;
        return route.fulfill({ json: app.sessions[0] });
      }
      if (req.method() === "DELETE") { app.sessions = []; return route.fulfill({ json: { deleted: true } }); }
      if (path.endsWith("/upload")) return route.fulfill({ json: { type: "text", filename: "notes.txt", preview: "notes.txt", content: "Maple launches October 14." } });
      return route.fulfill({ status: 404, json: { detail: "Test endpoint not found" } });
    });
    await page.routeWebSocket("**/api/chat/ws/**", ws => {
      app.sockets.push(ws);
      ws.onMessage(raw => {
        const data = JSON.parse(String(raw)); app.requests.push(data);
        if (data.type === "stop") { ws.send(JSON.stringify({ type: "end" })); return; }
        ws.send(JSON.stringify({ type: "start" }));
      });
    });
    await use(app);
    expect(app.errors).toEqual([]);
  },
});
export async function enterChat(page: Page) {
  await page.goto("/chat/session-1");
  await expect(page.getByRole("textbox").first()).toBeVisible();
}

