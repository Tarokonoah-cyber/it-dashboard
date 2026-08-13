import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MOBILE_VIEWPORTS, USER_ROUTES, pageMeasurements, prepareContext, waitForStablePage } from "./mobile-fixtures.mjs";

const phase = process.env.MOBILE_QA_PHASE || "current";
const artifactRoot = path.resolve("artifacts", "mobile-qa", phase);

for (const viewport of MOBILE_VIEWPORTS) {
  test(`complete route audit ${viewport.key}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      screen: { width: viewport.width, height: viewport.height },
      isMobile: viewport.width < 768,
      hasTouch: true,
      deviceScaleFactor: 1
    });
    await prepareContext(context, baseURL);
    const page = await context.newPage();
    const results = [];
    const viewportDir = path.join(artifactRoot, viewport.key);
    await mkdir(viewportDir, { recursive: true });

    for (const route of USER_ROUTES) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await waitForStablePage(page);
      const measurements = await pageMeasurements(page);
      const screenshotPath = path.join(viewportDir, `${route.slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
      results.push({ route: route.path, slug: route.slug, label: route.label, ...measurements });
      expect.soft(measurements.horizontalOverflow, `${route.path} should not overflow at ${viewport.key}`).toBe(false);
      expect.soft(measurements.outsideElements, `${route.path} should not have accidental off-screen elements at ${viewport.key}`).toEqual([]);
      expect.soft(measurements.undersizedControls, `${route.path} should not expose undersized touch controls at ${viewport.key}`).toEqual([]);
      if (measurements.bottomNavHeight) {
        expect.soft(measurements.mainPaddingBottom, `${route.path} should clear bottom navigation at ${viewport.key}`).toBeGreaterThanOrEqual(measurements.bottomNavHeight);
      }
    }

    await writeFile(path.join(viewportDir, "measurements.json"), `${JSON.stringify(results, null, 2)}\n`, "utf8");
    await context.close();
  });
}

for (const landscape of [
  { key: "667x375", width: 667, height: 375 },
  { key: "852x393", width: 852, height: 393 }
]) {
  test(`critical landscape audit ${landscape.key}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      viewport: { width: landscape.width, height: landscape.height },
      screen: { width: landscape.width, height: landscape.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1
    });
    await prepareContext(context, baseURL);
    const page = await context.newPage();
    const landscapeDir = path.join(artifactRoot, `landscape-${landscape.key}`);
    await mkdir(landscapeDir, { recursive: true });
    const results = [];
    for (const route of USER_ROUTES.filter((item) => ["dashboard", "work", "inspection-new", "knowledge", "cost-control", "calendar"].includes(item.slug))) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await waitForStablePage(page);
      const measurements = await pageMeasurements(page);
      await page.screenshot({ path: path.join(landscapeDir, `${route.slug}.png`), fullPage: true, animations: "disabled" });
      results.push({ route: route.path, slug: route.slug, ...measurements });
      expect.soft(measurements.horizontalOverflow, `${route.path} should not overflow in ${landscape.key} landscape`).toBe(false);
    }
    await writeFile(path.join(landscapeDir, "measurements.json"), `${JSON.stringify(results, null, 2)}\n`, "utf8");
    await context.close();
  });
}
