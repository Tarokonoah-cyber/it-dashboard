import { defineConfig } from "@playwright/test";

const port = 3015;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.015
    }
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    channel: "msedge",
    headless: true,
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    colorScheme: "light",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      DASHBOARD_LOGIN_USER: "taroko",
      DASHBOARD_LOGIN_PASSWORD: "mobile-qa-local-only",
      DASHBOARD_SESSION_SECRET: "mobile-qa-local-session-secret-2026-08-13-safe"
    }
  }
});
