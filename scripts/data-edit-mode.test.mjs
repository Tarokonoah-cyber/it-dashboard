import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

async function loadEsmModule(filePath) {
  const code = await readFile(new URL(filePath, import.meta.url), "utf8");
  const sourceModule = new vm.SourceTextModule(code, {
    identifier: filePath
  });
  await sourceModule.link(() => {
    throw new Error("Unexpected test import");
  });
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

test("asset record insert keeps data in sheet_records payload", async () => {
  const { buildRecordInsert, recordTableForSource } = await loadEsmModule("../lib/data-record-mutators.js");
  const now = new Date("2026-07-12T00:00:00.000Z");
  const mutation = buildRecordInsert("assets_mountain_pc", {
    asset_name: "Test PC",
    ip_address: "192.168.1.20",
    note: "bench"
  }, now);

  assert.equal(recordTableForSource("assets_mountain_pc"), "sheet_records");
  assert.equal(mutation.body.source_key, "assets_mountain_pc");
  assert.equal(mutation.body.record_key, "assets_mountain_pc-20260712000000");
  assert.equal(mutation.body.data.asset_name, "Test PC");
  assert.match(mutation.body.search_text, /Test PC/);
});

test("record validation rejects invalid IP and amount values", async () => {
  const { buildRecordInsert } = await loadEsmModule("../lib/data-record-mutators.js");

  assert.throws(
    () => buildRecordInsert("assets_printer", { asset_name: "Printer", ip_address: "999.1.1.1" }),
    /IP 位址格式不正確/
  );
  assert.throws(
    () => buildRecordInsert("contracts_software", { contract_name: "License", amount: "abc" }),
    /金額必須是有效數字/
  );
});

test("password entry payload stores metadata only fields", async () => {
  const { buildPasswordEntryPayload } = await loadEsmModule("../lib/password-entry-mutators.js");
  const payload = buildPasswordEntryPayload({
    category: "SaaS",
    system_name: "Admin",
    login_url: "example.com",
    username: "user",
    password_item: "Vault item",
    notes: "note"
  });

  assert.equal(payload.category, "SaaS");
  assert.equal(payload.login_url, "example.com");
  assert.equal(payload.password_item, "Vault item");
  assert.ok(!("password" in payload));
});
