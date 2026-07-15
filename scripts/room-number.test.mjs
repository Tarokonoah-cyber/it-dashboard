import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

async function loadRoomNumberModule() {
  const code = await readFile(new URL("../lib/room-number.js", import.meta.url), "utf8");
  const sourceModule = new vm.SourceTextModule(code, { identifier: "room-number.js" });
  await sourceModule.link(() => {
    throw new Error("Unexpected test import");
  });
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

test("only exact three-digit room numbers are accepted", async () => {
  const { isThreeDigitRoomNumber } = await loadRoomNumberModule();
  assert.equal(isThreeDigitRoomNumber("104"), true);
  assert.equal(isThreeDigitRoomNumber(" 542 "), true);
  assert.equal(isThreeDigitRoomNumber("0201"), false);
  assert.equal(isThreeDigitRoomNumber("7"), false);
  assert.equal(isThreeDigitRoomNumber("A12"), false);
});
