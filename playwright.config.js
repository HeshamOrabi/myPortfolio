// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const PORT = Number(process.env.PORT || 4173);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const fullBrowsers = process.env.FULL_BROWSERS === "1";

/** @type {import('@playwright/test').Project[]} */
const projects = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  {
    name: "mobile-chrome",
    use: { ...devices["Pixel 7"] }
  },
  {
    // Device metrics for iOS Safari; Chromium engine when WebKit OS deps are unavailable.
    name: "mobile-safari-emulation",
    use: {
      ...devices["iPhone 14"],
      browserName: "chromium",
      isMobile: true,
      hasTouch: true
    }
  },
  {
    name: "tablet-landscape",
    use: {
      browserName: "chromium",
      viewport: { width: 1194, height: 834 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    }
  }
];

if (fullBrowsers) {
  projects.push(
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } }
  );
}

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --directory dist --bind 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  projects
});
