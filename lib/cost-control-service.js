import "server-only";
import { dashboardLoginUser } from "./auth";
import { budgetExecutionStatus } from "./cost-control-core.js";
import { costControlPermissionSummary } from "./cost-control-permissions";
import { supabaseRequest, supabaseRpc } from "./supabase-rest";

const PAGE_SIZE = 1000;
const MAX_ROWS = 5000;

function isMissingCostControlSchema(error) {
  return /budget_imports|budget_items|PGRST205|42P01|schema cache/i.test(String(error?.message || error || ""));
}

async function fetchPaged(table, query) {
  const rows = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const page = await supabaseRequest(table, `${query}&limit=${PAGE_SIZE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

function safeInteger(value, fallback, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function inFilter(values) {
  return values.map((value) => encodeURIComponent(value)).join(",");
}

function normalizeScope(value) {
  return new Set(["all", "used", "near", "over"]).has(value) ? value : "all";
}

function statusMatches(scope, status, actual, committed) {
  if (scope === "used") return actual !== 0 || committed !== 0;
  if (scope === "near") return status.key === "near";
  if (scope === "over") return status.key === "over";
  return true;
}

function selectImport(imports, items, year, throughMonth) {
  const itemImportIds = new Set(items.map((item) => item.import_id));
  return imports.find((item) =>
    itemImportIds.has(item.id) &&
    (item.budget_year !== year || Number(item.data_month) <= throughMonth)
  ) || imports.find((item) => itemImportIds.has(item.id)) || null;
}

function amountIncluded(entry, latestActualYear, throughMonth) {
  const actualYear = Number(entry.actual_year);
  const actualMonth = Number(entry.actual_month);
  return actualYear < latestActualYear || (actualYear === latestActualYear && actualMonth <= throughMonth);
}

function serializeMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function parseCostControlFilters(searchParams) {
  return {
    year: safeInteger(searchParams.get("year"), null, 2000, 2200),
    throughMonth: safeInteger(searchParams.get("month"), null, 1, 12),
    department: String(searchParams.get("department") || "").trim(),
    scope: normalizeScope(String(searchParams.get("scope") || "all"))
  };
}

export async function loadCostControlDashboard(filters) {
  let imports;
  try {
    imports = await supabaseRequest(
      "budget_imports",
      "select=id,original_filename,file_hash,budget_year,data_month,version_number,warning_count,confirmed_at,created_at,source_sheet_names&import_status=eq.succeeded&is_active=eq.true&order=confirmed_at.desc.nullslast,created_at.desc"
    );
  } catch (error) {
    if (!isMissingCostControlSchema(error)) throw error;
    return {
      setupRequired: true,
      message: "成本控制資料表尚未建立；請先審核並執行本次 additive migration。",
      permissions: costControlPermissionSummary(),
      options: { years: [], departments: [], months: Array.from({ length: 12 }, (_, index) => index + 1) },
      items: [], vouchers: [], monthlyAmounts: [], trend: [], summary: null, imports: []
    };
  }

  if (!imports.length) {
    return {
      setupRequired: false,
      permissions: costControlPermissionSummary(),
      options: { years: [], departments: [], months: Array.from({ length: 12 }, (_, index) => index + 1) },
      items: [], vouchers: [], monthlyAmounts: [], trend: [], summary: null, imports: []
    };
  }

  const allItemsResult = await fetchPaged(
    "budget_items",
    `select=*&import_id=in.(${inFilter(imports.map((item) => item.id))})&order=budget_year.desc,budget_code.asc`
  );
  const years = [...new Set(allItemsResult.rows.map((item) => Number(item.budget_year)))].sort((a, b) => b - a);
  const selectedYear = filters.year && years.includes(filters.year) ? filters.year : years[0];
  const requestedMonth = filters.throughMonth || 12;
  const yearItems = allItemsResult.rows.filter((item) => Number(item.budget_year) === selectedYear);
  const selectedImport = selectImport(imports, yearItems, selectedYear, requestedMonth);
  const throughMonth = filters.throughMonth || Number(selectedImport?.data_month) || 12;
  if (!selectedImport) {
    return {
      setupRequired: false,
      permissions: costControlPermissionSummary(),
      selection: { year: selectedYear, throughMonth },
      options: { years, departments: [], months: Array.from({ length: 12 }, (_, index) => index + 1) },
      items: [], vouchers: [], monthlyAmounts: [], trend: [], summary: null, imports
    };
  }

  const items = yearItems.filter((item) => item.import_id === selectedImport.id);
  const departments = await supabaseRequest(
    "budget_departments",
    `select=*&import_id=eq.${encodeURIComponent(selectedImport.id)}&budget_year=eq.${selectedYear}&order=department_name.asc`
  );
  const departmentById = new Map(departments.map((item) => [item.id, item]));
  const itemIds = items.map((item) => item.id);
  const monthlyResult = itemIds.length
    ? await fetchPaged("budget_monthly_amounts", `select=*&budget_item_id=in.(${inFilter(itemIds)})&order=actual_year.asc,actual_month.asc`)
    : { rows: [], truncated: false };
  const latestActualYear = Math.max(selectedYear, ...monthlyResult.rows.map((entry) => Number(entry.actual_year || 0)));
  const actualByItem = new Map();
  for (const entry of monthlyResult.rows) {
    if (!amountIncluded(entry, latestActualYear, throughMonth)) continue;
    actualByItem.set(entry.budget_item_id, (actualByItem.get(entry.budget_item_id) || 0) + serializeMoney(entry.amount));
  }

  const normalizedItems = items.map((item) => {
    const department = departmentById.get(item.department_id);
    const actual = actualByItem.get(item.id) || 0;
    const budget = serializeMoney(item.budget_amount);
    const committed = serializeMoney(item.committed_amount);
    const status = budgetExecutionStatus(budget, actual, committed);
    return {
      id: item.id,
      importId: item.import_id,
      budgetYear: Number(item.budget_year),
      budgetCode: item.budget_code,
      itemName: item.item_name,
      quantity: item.quantity_text,
      departmentId: item.department_id,
      department: department?.department_name || "未提供",
      departmentCode: department?.department_code || null,
      budgetAmount: budget,
      actualAmount: actual,
      committedAmount: committed,
      availableAmount: status.available,
      executionRate: Number.isFinite(status.rate) ? status.rate : null,
      status,
      sourceSheetName: item.source_sheet_name,
      sourceRowNumber: item.source_row_number
    };
  });

  const departmentFiltered = filters.department
    ? normalizedItems.filter((item) => item.department === filters.department || item.departmentCode === filters.department)
    : normalizedItems;
  const filteredItems = departmentFiltered.filter((item) => statusMatches(filters.scope, item.status, item.actualAmount, item.committedAmount));
  const allowedItemIds = new Set(filteredItems.map((item) => item.id));
  const filteredMonthly = monthlyResult.rows.filter((entry) => allowedItemIds.has(entry.budget_item_id));
  const trend = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthly = filteredMonthly
      .filter((entry) => Number(entry.actual_year) === latestActualYear && Number(entry.actual_month) === month)
      .reduce((sum, entry) => sum + serializeMoney(entry.amount), 0);
    const cumulative = filteredMonthly
      .filter((entry) => Number(entry.actual_year) < latestActualYear || (Number(entry.actual_year) === latestActualYear && Number(entry.actual_month) <= month))
      .reduce((sum, entry) => sum + serializeMoney(entry.amount), 0);
    const budget = filteredItems.reduce((sum, item) => sum + item.budgetAmount, 0);
    const committed = filteredItems.reduce((sum, item) => sum + item.committedAmount, 0);
    return { year: latestActualYear, month, monthly, cumulative, available: budget - cumulative - committed };
  });
  const summary = filteredItems.reduce((result, item) => {
    result.budget += item.budgetAmount;
    result.actual += item.actualAmount;
    result.committed += item.committedAmount;
    return result;
  }, { budget: 0, actual: 0, committed: 0 });
  summary.available = summary.budget - summary.actual - summary.committed;
  summary.executionRate = summary.budget > 0 ? ((summary.actual + summary.committed) / summary.budget) * 100 : null;
  summary.status = budgetExecutionStatus(summary.budget, summary.actual, summary.committed);

  const voucherResult = await fetchPaged(
    "budget_vouchers",
    `select=*&import_id=eq.${encodeURIComponent(selectedImport.id)}&order=request_date.desc.nullslast,source_sheet_name.asc,source_row_number.asc`
  );
  const voucherItemById = new Map(normalizedItems.map((item) => [item.id, item]));
  const vouchers = voucherResult.rows.map((voucher) => {
    const item = voucherItemById.get(voucher.budget_item_id);
    const department = departmentById.get(voucher.department_id);
    return {
      id: voucher.id,
      voucherNumber: voucher.voucher_number,
      requestDate: voucher.request_date,
      actualYear: voucher.actual_year,
      actualMonth: voucher.actual_month,
      accountCode: voucher.account_code,
      accountName: voucher.account_name,
      description: voucher.description,
      amount: serializeMoney(voucher.amount),
      department: department?.department_name || null,
      budgetCode: voucher.budget_code,
      relationshipStatus: voucher.relationship_status,
      sourceCategory: voucher.source_category,
      sourceSheetName: voucher.source_sheet_name,
      sourceRowNumber: voucher.source_row_number,
      budgetItemName: item?.itemName || null
    };
  });

  return {
    setupRequired: false,
    permissions: costControlPermissionSummary(),
    selection: { year: selectedYear, throughMonth, actualYear: latestActualYear, department: filters.department, scope: filters.scope },
    meta: {
      importId: selectedImport.id,
      filename: selectedImport.original_filename,
      dataYear: selectedImport.budget_year,
      dataMonth: selectedImport.data_month,
      version: selectedImport.version_number,
      warningCount: selectedImport.warning_count,
      lastImportedAt: selectedImport.confirmed_at || selectedImport.created_at,
      sourceSheetNames: selectedImport.source_sheet_names
    },
    options: {
      years,
      departments: [...new Set(normalizedItems.map((item) => item.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant")),
      months: Array.from({ length: 12 }, (_, index) => index + 1)
    },
    summary,
    items: filteredItems,
    monthlyAmounts: filteredMonthly,
    vouchers,
    trend,
    imports,
    truncated: allItemsResult.truncated || monthlyResult.truncated || voucherResult.truncated,
    sourceSheets: [...new Set(filteredItems.map((item) => item.sourceSheetName))]
  };
}

export async function createCostControlPreview({ file, parsed, hash }) {
  const warnings = parsed.warnings.slice(0, 500);
  const previewRecord = {
    original_filename: file.name,
    file_hash: hash,
    file_size_bytes: file.size,
    budget_year: Number.isInteger(parsed.budgetYear) ? parsed.budgetYear : null,
    data_month: Number.isInteger(parsed.dataMonth) ? parsed.dataMonth : null,
    imported_by: dashboardLoginUser() || null,
    import_status: parsed.canImport ? "preview" : "failed",
    source_sheet_names: parsed.payload.sheets.map((sheet) => sheet.sheet_name),
    preview_payload: parsed.canImport ? parsed.payload : null,
    department_count: parsed.counts.departments,
    budget_item_count: parsed.counts.budgetItems,
    voucher_count: parsed.counts.vouchers,
    warning_count: warnings.length,
    warnings,
    error_message: parsed.fatalErrors.join("；") || null
  };
  const existingPeriodQuery = parsed.budgetYear && parsed.dataMonth
    ? `select=id,original_filename,version_number,confirmed_at&budget_year=eq.${parsed.budgetYear}&data_month=eq.${parsed.dataMonth}&is_active=eq.true&import_status=eq.succeeded&limit=1`
    : null;
  const [duplicates, existingPeriod] = await Promise.all([
    supabaseRequest("budget_imports", `select=id,original_filename,budget_year,data_month,version_number,confirmed_at&file_hash=eq.${hash}&import_status=eq.succeeded&order=confirmed_at.desc&limit=5`),
    existingPeriodQuery ? supabaseRequest("budget_imports", existingPeriodQuery) : Promise.resolve([])
  ]);
  const rows = await supabaseRequest("budget_imports", "select=*", { method: "POST", body: previewRecord });
  return {
    previewId: rows[0]?.id || null,
    duplicateFiles: duplicates,
    existingPeriod: existingPeriod[0] || null
  };
}

export async function confirmCostControlPreview(previewId, mode) {
  return supabaseRpc("confirm_budget_import", {
    p_preview_id: previewId,
    p_import_mode: mode,
    p_imported_by: dashboardLoginUser() || null
  });
}

export async function recordCostControlImportFailure({ filename, fileHash, fileSize, errorMessage }) {
  return supabaseRequest("budget_imports", "select=id", {
    method: "POST",
    body: {
      original_filename: filename,
      file_hash: fileHash,
      file_size_bytes: fileSize,
      imported_by: dashboardLoginUser() || null,
      import_status: "failed",
      error_message: String(errorMessage || "Excel 解析失敗").slice(0, 1000),
      warning_count: 0,
      warnings: []
    }
  });
}

export { isMissingCostControlSchema };
