import { requireDashboardAuth } from "../../../../lib/auth";
import { loadReport, parseReportFilters } from "../../../../lib/report-service";
import { fail, ok } from "../../../../lib/supabase-rest";

export const dynamic = "force-dynamic";

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "zh-Hant"));
}

function previewPayload(report) {
  if (report.type === "inspection") {
    const items = report.rows.flatMap((record) => record.items.filter((item) => report.filters.period === "all" || item.period === report.filters.period));
    return {
      type: report.type,
      filters: report.filters,
      summary: { ...report.summary, abnormalItems: report.summary.abnormalItems.slice(0, 20) },
      rows: items.slice(0, 50),
      totalRows: items.length,
      options: {
        inspectors: unique(report.rows.map((row) => row.inspector)),
        statuses: unique(report.rows.map((row) => row.overallStatus))
      }
    };
  }

  return {
    type: report.type,
    filters: report.filters,
    summary: report.summary,
    rows: report.rows.slice(0, 50),
    totalRows: report.rows.length,
    options: {
      workTypes: unique(report.rows.map((row) => row.workType)),
      systems: unique(report.rows.map((row) => row.system)),
      departments: unique(report.rows.map((row) => row.department)),
      statuses: unique(report.rows.map((row) => row.status))
    }
  };
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const filters = parseReportFilters(new URL(request.url).searchParams);
    return ok(previewPayload(await loadReport(filters)));
  } catch (error) {
    return fail(error, error?.name === "ValidationError" ? 400 : 500);
  }
}
