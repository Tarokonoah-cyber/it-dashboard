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

test("mobile shell keeps fixed controls clear of readable content", async () => {
  const shellStyles = await readFile(new URL("../app/mobile-shell.css", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");

  assert.match(layout, /import "\.\/mobile-shell\.css";/);
  assert.match(shellStyles, /\.main-area\s*\{[\s\S]*?padding-bottom:\s*var\(--mobile-shell-clearance\)/);
  assert.match(shellStyles, /\.ai-bot-launcher\s*\{[\s\S]*?top:\s*max\(7px,[\s\S]*?bottom:\s*auto/);
  assert.match(shellStyles, /\.ai-chat-window\s*\{[\s\S]*?calc\(100% - 20px\)/);
  assert.match(shellStyles, /\.modern-dashboard-page\s*\{[\s\S]*?padding-inline:\s*12px/);
});

test("mobile contacts use labeled cards instead of a wide data grid", async () => {
  const shellStyles = await readFile(new URL("../app/mobile-shell.css", import.meta.url), "utf8");
  const remediationStyles = await readFile(new URL("../app/mobile-remediation.css", import.meta.url), "utf8");

  assert.match(shellStyles, /contact-record-row\.record-head\s*\{[\s\S]*?display:\s*none/);
  assert.match(shellStyles, /contact-record-row:not\(\.record-head\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(shellStyles, /nth-child\(7\)::before\s*\{\s*content:\s*"Email"/);
  assert.match(remediationStyles, /department-filters[\s\S]*?flex-wrap:\s*nowrap[\s\S]*?overflow-x:\s*auto/);
  assert.match(remediationStyles, /contact-record-row:not\(\.record-head\)\s*>\s*span:has\(> \.muted\)[\s\S]*?display:\s*none/);
  assert.match(remediationStyles, /content:\s*"尚無聯絡方式"/);
});
