import { requireDashboardAuth } from "../../../../lib/auth";
import { loadCostControlDashboard, parseCostControlFilters } from "../../../../lib/cost-control-service";
import { fail } from "../../../../lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(rows) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    const url = new URL(request.url);
    const data = await loadCostControlDashboard(parseCostControlFilters(url.searchParams));
    const type = url.searchParams.get("type") === "items" ? "items" : "vouchers";
    const rows = type === "items"
      ? [
          ["預算編號", "預算項目", "部門", "預算年度", "預算金額", "已動支", "送簽中", "可用餘額", "執行率", "狀態", "來源工作表", "來源列號"],
          ...data.items.map((item) => [item.budgetCode, item.itemName, item.department, item.budgetYear, item.budgetAmount, item.actualAmount, item.committedAmount, item.availableAmount, item.executionRate === null ? "" : item.executionRate, item.status.label, item.sourceSheetName, item.sourceRowNumber])
        ]
      : [
          ["傳票號碼", "請款日期", "科目代碼", "科目名稱", "說明", "金額", "部門", "預算編號", "關聯狀態", "來源工作表", "來源列號"],
          ...data.vouchers.map((item) => [item.voucherNumber, item.requestDate, item.accountCode, item.accountName, item.description, item.amount, item.department, item.budgetCode, item.relationshipStatus === "exact" ? "精確" : "未關聯", item.sourceSheetName, item.sourceRowNumber])
        ];
    const year = data.selection?.year || "all";
    const filename = `cost-control-${type}-${year}.csv`;
    return new Response(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return fail(error);
  }
}
