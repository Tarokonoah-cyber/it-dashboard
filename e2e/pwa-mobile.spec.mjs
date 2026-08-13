import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pageMeasurements, prepareContext, waitForStablePage } from "./mobile-fixtures.mjs";

test.beforeEach(async ({ context, baseURL }) => {
  await prepareContext(context, baseURL);
});

test("PWA manifest exposes standalone mobile metadata and valid icons", async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/manifest.webmanifest`);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.orientation).toBe("portrait-primary");
  expect(manifest.theme_color).toBeTruthy();
  expect(manifest.background_color).toBeTruthy();
  expect(manifest.icons.some((icon) => String(icon.purpose || "").includes("maskable"))).toBe(true);

  for (const icon of manifest.icons) {
    const iconResponse = await request.get(`${baseURL}${icon.src}`);
    expect(iconResponse.ok(), `${icon.src} should be available`).toBe(true);
  }
});

test("mobile shell registers its service worker and reports offline state", async ({ context, page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/inspections/new", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  await page.waitForFunction(async () => Boolean(await navigator.serviceWorker.getRegistration("/")));

  await context.setOffline(true);
  try {
    await expect(page.locator(".pwa-offline-indicator")).toContainText("目前離線");
  } finally {
    await context.setOffline(false);
  }
});

test("standalone display mode keeps the dashboard within the mobile viewport", async ({ context, page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => query === "(display-mode: standalone)"
      ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }
      : nativeMatchMedia(query);
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page);

  expect(await page.evaluate(() => matchMedia("(display-mode: standalone)").matches)).toBe(true);
  const measurements = await pageMeasurements(page);
  expect(measurements.horizontalOverflow).toBe(false);
  expect(measurements.outsideElements).toEqual([]);
  expect(measurements.mainPaddingBottom).toBeGreaterThanOrEqual(measurements.bottomNavHeight);

  const outputDir = path.resolve("artifacts", "mobile-qa", "standalone", "393x852");
  await mkdir(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, "dashboard.png"), fullPage: true, animations: "disabled" });
});
