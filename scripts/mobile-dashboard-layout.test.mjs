import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile dashboard uses stable columns and non-wrapping compact labels", async () => {
  const styles = await readFile(new URL("../app/mobile-dashboard.css", import.meta.url), "utf8");

  assert.match(styles, /dashboard-kpi-summary[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /completion-summary[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(styles, /kpi-summary-label[\s\S]*?white-space:\s*nowrap/);
  assert.match(styles, /panel-title\.calendar-title[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /calendar-reminder-legend span[\s\S]*?white-space:\s*nowrap/);
  assert.match(styles, /dashboard-calendar-grid[\s\S]*?repeat\(7, minmax\(0, 1fr\)\)/);
});

test("AppShell no longer renders or requests logout", async () => {
  const shell = await readFile(new URL("../components/AppShell.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(shell, /sidebar-logout-button/);
  assert.doesNotMatch(shell, /\/api\/logout/);
  assert.doesNotMatch(shell, /loggingOut|logoutError|重試登出/);
  assert.doesNotMatch(shell, />\s*登出\s*</);
});
