import { createHash } from "node:crypto";
import { requireCostControlImportAuth } from "../../../../../lib/cost-control-permissions";
import { parseCostControlWorkbook } from "../../../../../lib/cost-control-excel.js";
import { createCostControlPreview, isMissingCostControlSchema, recordCostControlImportFailure } from "../../../../../lib/cost-control-service";
import { hasXlsxZipSignature, safeUploadFilename, validateCostControlUpload } from "../../../../../lib/cost-control-upload.js";
import { fail, ok } from "../../../../../lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const authError = requireCostControlImportAuth(request);
  if (authError) return authError;
  if (!String(request.headers.get("content-type") || "").toLowerCase().startsWith("multipart/form-data")) {
    return fail(new Error("請使用 multipart/form-data 上傳 .xlsx 檔案"), 415);
  }

  let failureContext = null;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const validationError = validateCostControlUpload(file);
    if (validationError) return fail(new Error(validationError), 400);
    const filename = safeUploadFilename(file.name);
    const buffer = await file.arrayBuffer();
    if (!hasXlsxZipSignature(buffer)) return fail(new Error("檔案內容不是有效的 .xlsx ZIP 格式"), 400);
    const hash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
    failureContext = { filename, fileHash: hash, fileSize: file.size };
    const parsed = await parseCostControlWorkbook(buffer, { filename });
    const record = await createCostControlPreview({
      file: { name: filename, size: file.size },
      parsed,
      hash
    });
    return ok({
      ...record,
      filename,
      fileHash: hash,
      budgetYear: parsed.budgetYear,
      dataMonth: parsed.dataMonth,
      canImport: parsed.canImport,
      fatalErrors: parsed.fatalErrors,
      warnings: parsed.warnings,
      counts: parsed.counts,
      recognizedYears: parsed.recognizedYears,
      historySheetNames: parsed.historySheetNames,
      sheets: parsed.payload.sheets.map((sheet) => ({
        name: sheet.sheet_name,
        classification: sheet.classification,
        budgetYear: sheet.budget_year,
        rows: sheet.row_count,
        columns: sheet.column_count,
        mergedRanges: sheet.merged_range_count,
        warnings: sheet.warning_count,
        visibility: sheet.visibility
      }))
    });
  } catch (error) {
    if (failureContext && !isMissingCostControlSchema(error)) {
      await recordCostControlImportFailure({ ...failureContext, errorMessage: error?.message }).catch((logError) => {
        console.error("[cost-control import failure log]", logError);
      });
    }
    if (isMissingCostControlSchema(error)) {
      return fail(new Error("成本控制 migration 尚未執行，無法建立安全的伺服器端匯入預覽紀錄"), 503);
    }
    return fail(error, /xlsx|excel|zip|worksheet|workbook/i.test(String(error?.message || "")) ? 400 : 500);
  }
}
