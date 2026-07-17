import { requireDashboardAuth } from "../../../../lib/auth";
import { buildReportWorkbook } from "../../../../lib/report-excel";
import { buildReportPdf } from "../../../../lib/report-pdf";
import { loadReport, parseReportFilters } from "../../../../lib/report-service";
import { fail } from "../../../../lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORTS = {
  xlsx: {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    build: buildReportWorkbook
  },
  pdf: {
    contentType: "application/pdf",
    build: buildReportPdf
  }
};

function disposition(report, format) {
  const kind = report.type === "inspection" ? "inspection" : "work";
  const ascii = `${kind}-report_${report.filters.start}_${report.filters.end}.${format}`;
  const localized = `${report.type === "inspection" ? "巡檢" : "工作"}報表_${report.filters.start}_${report.filters.end}.${format}`;
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(localized)}`;
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const searchParams = new URL(request.url).searchParams;
    const format = String(searchParams.get("format") || "xlsx").toLowerCase();
    const exporter = EXPORTS[format];
    if (!exporter) throw Object.assign(new Error("僅支援 Excel 或 PDF 格式"), { name: "ValidationError" });

    const report = await loadReport(parseReportFilters(searchParams));
    const body = await exporter.build(report);
    return new Response(body, {
      headers: {
        "Content-Type": exporter.contentType,
        "Content-Disposition": disposition(report, format),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return fail(error, error?.name === "ValidationError" ? 400 : 500);
  }
}
