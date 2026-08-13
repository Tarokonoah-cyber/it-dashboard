import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("expanded mobile drawer overrides the legacy four-column navigation", async () => {
  const styles = await readFile(new URL("../app/styles.css", import.meta.url), "utf8");
  const legacyTabletRule = styles.indexOf("grid-template-columns: repeat(4, minmax(0, 1fr));");
  const regressionGuard = styles.indexOf("/* Mobile drawer regression guard:");

  assert.notEqual(legacyTabletRule, -1, "expected the legacy tablet navigation rule fixture");
  assert.ok(regressionGuard > legacyTabletRule, "mobile drawer guard must win the CSS cascade");
  assert.match(
    styles.slice(regressionGuard, regressionGuard + 360),
    /\.sidebar\.mobile-open \.side-nav,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
    "expanded mobile drawer must render one full-width navigation column"
  );
});

test("mobile bottom navigation exposes five distinct primary destinations", async () => {
  const shell = await readFile(new URL("../components/AppShell.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/mobile-remediation.css", import.meta.url), "utf8");

  assert.match(shell, /router\.push\("\/"\)[\s\S]*?<b>首頁<\/b>/);
  assert.match(shell, /router\.push\("\/work"\)[\s\S]*?<b>工作<\/b>/);
  assert.match(shell, /router\.push\("\/inspections"\)[\s\S]*?<b>巡檢<\/b>/);
  assert.match(shell, /router\.push\("\/cost-control"\)[\s\S]*?<b>成本<\/b>/);
  assert.match(shell, /aria-expanded=\{mobileOpen\}[\s\S]*?<b>更多<\/b>/);
  assert.doesNotMatch(shell, /<b>(今日|月曆|新增)<\/b>/);
  assert.doesNotMatch(shell, /sidebar-session|單一帳號/);
  assert.match(shell, /aria-current=\{activeSection === "dashboard" \? "page" : undefined\}/);
  assert.match(shell, /aria-current=\{mobileWorkActive \? "page" : undefined\}/);
  assert.match(styles, /--mobile-bottom-nav-height:\s*68px/);
  assert.match(styles, /\.mobile-bottom-nav button\.active/);
});
