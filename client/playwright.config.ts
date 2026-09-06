import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", fullyParallel: true, timeout: 30000,
  expect: { timeout: 7000 }, retries: 0, workers: 2,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "webkit" } },
  ],
  webServer: { command: "VITE_API_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
});

