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
