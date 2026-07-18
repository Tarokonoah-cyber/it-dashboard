import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ExcelJS from "exceljs";
import { budgetExecutionStatus, parseExcelDate, parseMoney, summarizeBudget } from "../lib/cost-control-core.js";
import { parseCostControlWorkbook } from "../lib/cost-control-excel.js";
import { hasXlsxZipSignature, validateCostControlUpload } from "../lib/cost-control-upload.js";

async function buildFixture() {
  const workbook = new ExcelJS.Workbook();
  const current = workbook.addWorksheet("A26-資本預算彙總");
  current.addRow(["測試公司 - 2026年資本預算"]);
  current.addRow(["部門", "預算編號", "項目", "數量", "金額(未稅)", "簽呈(未稅)", "2026/1-12月請款(未稅)", null, null, null, null, null, null, null, null, null, null, null, "累計動支金額", "送簽中", "可用餘額"]);
  current.addRow([null, null, null, null, null, null, "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]);
  current.addRow(["資訊室", "A26-MIS001", "去識別化設備更新", "1式", { formula: "500+500", result: 1000 }, null, 700, 200, null, null, null, null, null, null, null, null, null, null, { formula: "SUM(G4:R4)+50", result: 950 }, 200, -100]);
  current.addRow([]);
  current.addRow(["資訊室", "資訊室小計", null, null, 1000]);
  current.mergeCells("A1:F1");
  current.mergeCells("A2:A3");
  current.mergeCells("B2:B3");
  current.mergeCells("C2:C3");
  current.mergeCells("D2:D3");
  current.mergeCells("E2:E3");
  current.mergeCells("F2:F3");
  current.mergeCells("G2:R2");
  current.mergeCells("S2:S3");
  current.mergeCells("T2:T3");
  current.mergeCells("U2:U3");

  const history = workbook.addWorksheet("A25-資本預算彙總");
  history.addRow(["測試公司 - 2025年資本預算"]);
  history.addRow(["部門", "預算編號", "項目", "數量", "金額(未稅)", "簽呈(未稅)", "2025/1-12月請款(未稅)", null, null, null, null, null, null, null, null, null, null, null, "2026/1月", "累計動支金額", "送簽中", "可用餘額"]);
  history.addRow([null, null, null, null, null, null, "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "2026/1月"]);
  history.addRow(["資訊室", "A25-MIS001", "去識別化歷史設備", 1, 500, null, 100, null, null, null, null, null, null, null, null, null, null, null, 50, 150, null, 350]);
  history.mergeCells("A1:F1");
  history.mergeCells("A2:A3");
  history.mergeCells("B2:B3");
  history.mergeCells("C2:C3");
  history.mergeCells("D2:D3");
  history.mergeCells("E2:E3");
  history.mergeCells("F2:F3");
  history.mergeCells("G2:R2");
  history.mergeCells("T2:T3");
  history.mergeCells("U2:U3");
  history.mergeCells("V2:V3");

  const duplicate = workbook.addWorksheet("MIS");
  duplicate.state = "hidden";
  duplicate.addRow(["測試公司"]);
  duplicate.addRow(["2026年預算控制表"]);
  duplicate.addRow(["部門", "預算編號", "項目", "數量", "預算金額", "簽呈金額", "再途金額", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "累計動支金額", "可用餘額"]);
  duplicate.addRow(["MIS", "A26-MIS001", "不可重複匯入", 1, 1000]);

  const vouchers = workbook.addWorksheet("工作表1");
  vouchers.state = "hidden";
  vouchers.addRow(["傳票號碼", "科目代碼", "科目名稱", "說明", "金額"]);
  vouchers.addRow(["TEST-001", "13703", "生財設備", "去識別化傳票", "NT$ 1,234"]);
  vouchers.addRow([null, null, "合計", null, 1234]);

  return workbook.xlsx.writeBuffer();
}

test("成本控制金額解析保留負數、貨幣與無效字串", () => {
  assert.equal(parseMoney("NT$ 1,234.50").value, 1234.5);
  assert.equal(parseMoney("(2,000)").value, -2000);
  assert.equal(parseMoney("-").empty, true);
  assert.equal(parseMoney("無法解析").value, null);
  assert.match(parseMoney("無法解析").error, /有效金額/);
  assert.match(parseMoney({ error: "#REF!" }).error, /#REF/);
});

test("成本控制日期解析支援 Excel serial、字串與民國年", () => {
  assert.equal(parseExcelDate(1).value, "1899-12-31");
  assert.equal(parseExcelDate("2026.06.30").value, "2026-06-30");
  assert.equal(parseExcelDate("115/06/30").value, "2026-06-30");
  assert.equal(parseExcelDate("2026/02/30").value, null);
});

test("真實結構 fixture 可辨識多層表頭、合併儲存格、空白列與跨年度月份", async () => {
  const buffer = await buildFixture();
  const parsed = await parseCostControlWorkbook(buffer, { filename: "2026-Cost Control Report-06月.xlsx" });
  assert.equal(parsed.canImport, true);
  assert.equal(parsed.budgetYear, 2026);
  assert.equal(parsed.dataMonth, 6);
  assert.deepEqual(parsed.recognizedYears, [2026, 2025]);
  assert.equal(parsed.payload.items.filter((item) => item.budget_code === "A26-MIS001").length, 1);
  assert.ok(parsed.payload.sheets.find((sheet) => sheet.sheet_name === "A26-資本預算彙總").merged_range_count > 0);
  assert.ok(parsed.payload.monthlyAmounts.some((entry) => entry.actual_year === 2026 && entry.actual_month === 1 && entry.item_source_key.startsWith("A25-")));
  assert.ok(parsed.warnings.some((warning) => warning.code === "MONTHLY_TOTAL_MISMATCH"));
  assert.ok(parsed.warnings.some((warning) => warning.code === "DUPLICATE_BUDGET_ITEM"));
  const voucher = parsed.payload.vouchers.find((item) => item.voucher_number === "TEST-001");
  assert.equal(voucher.amount, 1234);
  assert.equal(voucher.relationship_status, "unlinked");
  assert.equal(voucher.department_key, null);
});

test("系統重算執行率、月別合計與負數餘額", () => {
  const status = budgetExecutionStatus(1000, 900, 200);
  assert.equal(status.key, "over");
  assert.equal(status.available, -100);
  const summary = summarizeBudget(
    [{ source_key: "a", budget_amount: 1000, committed_amount: 100 }],
    [{ item_source_key: "a", actual_month: 1, amount: 200 }, { item_source_key: "a", actual_month: 2, amount: 300 }],
    1
  );
  assert.deepEqual(summary, { budget: 1000, actual: 200, committed: 100 });
});

test("上傳驗證拒絕非 xlsx、錯誤 MIME、超大檔案與假 ZIP", () => {
  const fake = (name, type, size = 10) => ({ name, type, size, arrayBuffer: async () => new ArrayBuffer(size) });
  assert.match(validateCostControlUpload(fake("data.csv", "text/csv")), /xlsx/);
  assert.match(validateCostControlUpload(fake("data.xlsx", "text/plain")), /MIME/);
  assert.match(validateCostControlUpload(fake("data.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 16 * 1024 * 1024)), /15 MB/);
  assert.equal(validateCostControlUpload(fake("data.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")), null);
  assert.equal(hasXlsxZipSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer), true);
  assert.equal(hasXlsxZipSignature(new Uint8Array([1, 2, 3, 4]).buffer), false);
});

test("migration 以 transaction RPC 處理重複期間與覆蓋，且不開放匿名呼叫", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260718064338_cost_control.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.confirm_budget_import/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /已存在 %s 年 %s 月資料/);
  assert.match(sql, /import_status = 'superseded'/);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /revoke all on function public\.confirm_budget_import\(uuid, text, text\) from public, anon, authenticated/i);
});

test("匯入 API 經過現有登入與專用權限邊界，手機版提供卡片流程", async () => {
  const [previewRoute, permissions, css, component] = await Promise.all([
    readFile(new URL("../app/api/cost-control/import/preview/route.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/cost-control-permissions.js", import.meta.url), "utf8"),
    readFile(new URL("../app/cost-control/cost-control.css", import.meta.url), "utf8"),
    readFile(new URL("../components/CostControlPage.jsx", import.meta.url), "utf8")
  ]);
  assert.ok(previewRoute.indexOf("requireCostControlImportAuth(request)") < previewRoute.indexOf("request.formData()"));
  assert.match(permissions, /return requireDashboardAuth\(request\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.cc-table-wrap \{ display: none; \}/);
  assert.match(css, /\.cc-mobile-list \{ display: grid;/);
  assert.match(component, /role="tablist"/);
  assert.match(component, /ItemDrawer/);
});
