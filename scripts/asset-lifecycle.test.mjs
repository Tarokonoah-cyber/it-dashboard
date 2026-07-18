import assert from "node:assert/strict";
import test from "node:test";
import {
  assetProjectionFromSheetRecord,
  getWarrantyStatus,
  normalizeAssetProfile,
  normalizeMaintenanceRecord
} from "../lib/asset-lifecycle.js";

test("warranty status distinguishes active, expiring, expired and unset assets", () => {
  assert.deepEqual(getWarrantyStatus({}, "2026-07-17"), {
    code: "unset",
    label: "未設定",
    daysRemaining: null
  });
  assert.equal(getWarrantyStatus({ warranty_end_date: "2026-09-01" }, "2026-07-17").code, "active");
  assert.equal(getWarrantyStatus({ warranty_end_date: "2026-08-01" }, "2026-07-17").code, "expiring");
  assert.equal(getWarrantyStatus({ warranty_end_date: "2026-07-16" }, "2026-07-17").code, "expired");
});

test("asset profile validates date order and normalizes money", () => {
  const profile = normalizeAssetProfile({
    purchase_date: "2026-01-01",
    warranty_end_date: "2029-01-01",
    purchase_cost: "25,800",
    purchase_vendor: "設備商"
  });
  assert.equal(profile.purchase_cost, 25800);
  assert.equal(profile.purchase_vendor, "設備商");
  assert.throws(
    () => normalizeAssetProfile({ purchase_date: "2026-02-01", warranty_end_date: "2026-01-01" }),
    /保固期限不可早於採購日/
  );
});

test("maintenance records require a date and summary", () => {
  const record = normalizeMaintenanceRecord({
    service_date: "2026-07-17",
    summary: "更換硬碟",
    event_type: "更換",
    status: "已完成",
    cost: "3,200"
  });
  assert.equal(record.cost, 3200);
  assert.equal(record.event_type, "更換");
  assert.throws(() => normalizeMaintenanceRecord({ service_date: "2026-07-17" }), /請填寫處理摘要/);
});

test("sheet records project into the normalized asset master", () => {
  const projected = assetProjectionFromSheetRecord({
    id: "86d645a1-1664-4aed-b170-4230fcc12957",
    source_key: "assets_printer",
    source_label: "印表機",
    record_key: "printer-01",
    data: {
      設備名稱: "櫃台印表機",
      使用部門: "櫃台",
      "IP 位址": "192.168.1.20",
      硬體型號: "M404"
    }
  });
  assert.equal(projected.asset_name, "櫃台印表機");
  assert.equal(projected.department, "櫃台");
  assert.equal(projected.ip_address, "192.168.1.20");
});
