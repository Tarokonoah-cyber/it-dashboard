import { expect, test } from "@playwright/test";
import { REGRESSION_ROUTES, USER_ROUTES, pageMeasurements, prepareContext, waitForStablePage } from "./mobile-fixtures.mjs";

const routesBySlug = new Map(USER_ROUTES.map((route) => [route.slug, route]));

test.beforeEach(async ({ context, baseURL }) => {
  await prepareContext(context, baseURL);
});

for (const width of [393, 430]) {
  for (const slug of REGRESSION_ROUTES) {
    const route = routesBySlug.get(slug);
    test(`${route.label} ${width}px visual`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 393 ? 852 : 932 });
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await waitForStablePage(page);
      const measurements = await pageMeasurements(page);
      expect(measurements.horizontalOverflow).toBe(false);
      expect(measurements.outsideElements).toEqual([]);
      await expect(page).toHaveScreenshot(`${slug}-${width}-page.png`, { fullPage: true });
    });
  }
}

for (const slug of ["dashboard", "knowledge", "cost-control", "inspection-new"]) {
  const route = routesBySlug.get(slug);
  test(`${route.label} 360px small-mobile visual`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await waitForStablePage(page);
    await expect(page).toHaveScreenshot(`${slug}-360-page.png`, { fullPage: true });
  });
}

test("mobile navigation open state", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page);
  await page.getByRole("button", { name: "更多" }).click();
  await expect(page.locator(".sidebar.mobile-open")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-393-navigation-open.png", { fullPage: true });
});

test("mobile primary navigation uses distinct destinations", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page);
  const navigation = page.locator(".mobile-bottom-nav");
  await expect(navigation.getByRole("button")).toHaveCount(5);
  await expect(navigation).toHaveScreenshot("dashboard-393-quick-add.png");
  await navigation.getByRole("button", { name: "巡檢" }).click();
  await expect(page).toHaveURL(/\/inspections$/);
  await expect(navigation.getByRole("button", { name: "巡檢" })).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("button", { name: "成本" }).click();
  await expect(page).toHaveURL(/\/cost-control$/);
  await expect(navigation.getByRole("button", { name: "成本" })).toHaveAttribute("aria-current", "page");
});

test("dashboard calendar modal state", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page);
  await page.locator(".dashboard-day-cell:has(.today-dot)").click();
  await expect(page.locator(".mobile-calendar-detail")).toBeVisible();
  await page.locator(".mobile-calendar-add").click();
  await expect(page.locator(".calendar-modal")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-393-calendar-modal.png", { fullPage: true });
});

test("cost-control import dialog state", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/cost-control", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page);
  await page.locator(".cc-import-button").click();
  await expect(page.locator(".cc-import-dialog")).toBeVisible();
  await expect(page).toHaveScreenshot("cost-control-393-import-dialog.png", { fullPage: true });
});

test("documents entry form state", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/documents", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page);
  await page.locator(".documents-header-actions button.primary").click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page).toHaveScreenshot("documents-393-form-dialog.png", { fullPage: true });
});

test("knowledge reader state", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/incidents", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page);
  await page.locator(".knowledge-list-row").first().click();
  await expect(page.locator(".knowledge-layout.is-reader-view .knowledge-reader")).toBeVisible();
  await expect(page).toHaveScreenshot("knowledge-393-reader.png", { fullPage: true });
});

test("work record edit state", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page);
  const editButton = page.locator(".full-work-row:not(.head) .work-row-actions button").first();
  await expect(editButton).toBeVisible();
  await editButton.click();
  await expect(page.locator(".work-entry-panel")).toContainText("編輯工作");
  await expect(page).toHaveScreenshot("work-393-edit-record.png", { fullPage: true });
});
