import ExcelJS from "exceljs";
import { parseExcelDate, parseMoney } from "./cost-control-core.js";

const MAX_WARNINGS = 500;
const HEADER_SCAN_ROWS = 14;

function cleanText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (value.error) return value.error;
    if (Object.hasOwn(value, "result")) return cleanText(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("").trim();
    if (value.text) return String(value.text).trim();
  }
  return String(value).trim();
}

function normalizedHeader(value) {
  return cleanText(value).replace(/[\s　]+/g, "").replace(/[()（）]/g, "").toLowerCase();
}

function cellValue(cell) {
  const source = cell?.isMerged && cell.master ? cell.master : cell;
  const value = source?.value;
  if (value && typeof value === "object" && (Object.hasOwn(value, "formula") || Object.hasOwn(value, "sharedFormula"))) {
    return value.result ?? null;
  }
  return value ?? null;
}

function valueAt(sheet, row, column) {
  return column ? cellValue(sheet.getCell(row, column)) : null;
}

function serializeCell(cell) {
  const source = cell?.isMerged && cell.master ? cell.master : cell;
  const value = source?.value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    if (Object.hasOwn(value, "formula") || Object.hasOwn(value, "sharedFormula")) {
      return {
        formula: value.formula || value.sharedFormula,
        result: value.result instanceof Date ? value.result.toISOString() : value.result ?? null
      };
    }
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
    if (value.error) return value.error;
    if (value.text) return value.text;
  }
  return value ?? null;
}

function rawRow(sheet, rowNumber) {
  return Array.from({ length: sheet.actualColumnCount || sheet.columnCount }, (_, index) => serializeCell(sheet.getCell(rowNumber, index + 1)));
}

function addWarning(state, warning) {
  if (state.warnings.length >= MAX_WARNINGS) return;
  state.warnings.push({ severity: "warning", ...warning });
}

function moneyAt(state, sheet, row, column, label, { allowEmpty = true } = {}) {
  if (!column) return { value: null, empty: true, error: null };
  const raw = cellValue(sheet.getCell(row, column));
  const parsed = parseMoney(raw);
  if (parsed.error || (!allowEmpty && parsed.empty)) {
    addWarning(state, {
      code: "INVALID_AMOUNT",
      message: `${label}${parsed.error ? `：${parsed.error}` : "不可空白"}`,
      sheet: sheet.name,
      row,
      column,
      raw_value: serializeCell(sheet.getCell(row, column))
    });
  }
  return parsed;
}

function dateAt(state, sheet, row, column, date1904) {
  if (!column) return { value: null, error: null };
  const raw = cellValue(sheet.getCell(row, column));
  if (raw === null || raw === "") return { value: null, error: null };
  const parsed = parseExcelDate(raw, { date1904 });
  if (parsed.error) {
    addWarning(state, {
      code: "INVALID_DATE",
      message: `請款日期：${parsed.error}`,
      sheet: sheet.name,
      row,
      column,
      raw_value: serializeCell(sheet.getCell(row, column))
    });
  }
  return parsed;
}

function rowHeaders(sheet, rowNumber) {
  return Array.from({ length: sheet.actualColumnCount || sheet.columnCount }, (_, index) => normalizedHeader(cellValue(sheet.getCell(rowNumber, index + 1))));
}

function findHeaderRow(sheet, requiredTokens) {
  const max = Math.min(HEADER_SCAN_ROWS, sheet.actualRowCount || sheet.rowCount);
  for (let row = 1; row <= max; row += 1) {
    const values = rowHeaders(sheet, row);
    if (requiredTokens.every((token) => values.some((value) => value.includes(token)))) return row;
  }
  return 0;
}

function findColumn(headers, predicates) {
  const index = headers.findIndex((header) => predicates.every((predicate) => predicate(header)));
  return index < 0 ? 0 : index + 1;
}

function parseYearMonthText(value) {
  const text = cleanText(value);
  const range = text.match(/((?:19|20)\d{2})\s*年\s*(\d{1,2})\s*[~～\-至]\s*(\d{1,2})\s*月/u);
  if (range) return { year: Number(range[1]), startMonth: Number(range[2]), endMonth: Number(range[3]) };
  const single = text.match(/((?:19|20)\d{2})\s*年\s*(\d{1,2})\s*月/u);
  if (single) return { year: Number(single[1]), startMonth: Number(single[2]), endMonth: Number(single[2]) };
  const year = text.match(/((?:19|20)\d{2})\s*年/u);
  return year ? { year: Number(year[1]), startMonth: null, endMonth: null } : null;
}

function detectSheetPeriod(sheet) {
  const candidates = [sheet.name];
  for (let row = 1; row <= Math.min(8, sheet.actualRowCount || sheet.rowCount); row += 1) {
    for (let column = 1; column <= Math.min(8, sheet.actualColumnCount || sheet.columnCount); column += 1) {
      const value = cleanText(cellValue(sheet.getCell(row, column)));
      if (value) candidates.push(value);
    }
  }
  let detected = null;
  for (const candidate of candidates) {
    const result = parseYearMonthText(candidate);
    if (!result) continue;
    if (!detected || result.year > detected.year || (result.year === detected.year && (result.endMonth || 0) > (detected.endMonth || 0))) detected = result;
  }
  return detected;
}

function detectFilenamePeriod(filename) {
  const match = String(filename || "").match(/((?:19|20)\d{2}).*?(\d{1,2})\s*月/u);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

function classifySheet(sheet, primaryYear) {
  const voucherHeader = findHeaderRow(sheet, ["傳票號碼", "科目代碼", "金額"]);
  if (voucherHeader) return { classification: "voucher", headerRow: voucherHeader };
  const spendHeader = findHeaderRow(sheet, ["月份", "項目", "目前已動支"]);
  if (spendHeader) return { classification: "spend_detail", headerRow: spendHeader };
  const budgetHeader = findHeaderRow(sheet, ["部門", "預算編號", "項目"]);
  if (budgetHeader) {
    const period = detectSheetPeriod(sheet);
    return {
      classification: period?.year === primaryYear && sheet.state === "visible" ? "budget_summary" : "historical_budget",
      headerRow: budgetHeader
    };
  }
  return { classification: "unrecognized", headerRow: 0 };
}

function departmentInfo(value) {
  const name = cleanText(value);
  const code = /^[A-Z][A-Z&-]{1,11}$/i.test(name) ? name.toUpperCase() : null;
  return {
    key: (code || name).replace(/[\s　]+/g, "").toUpperCase(),
    code,
    name
  };
}

function ensureDepartment(state, { value, year, sheet, row }) {
  const info = departmentInfo(value);
  if (!info.key) return null;
  const mapKey = `${year}:${info.key}`;
  if (!state.departmentMap.has(mapKey)) {
    const department = {
      budget_year: year,
      department_key: info.key,
      department_code: info.code,
      department_name: info.name,
      source_sheet_name: sheet.name,
      source_row_number: row,
      raw_data: { source_value: value }
    };
    state.departmentMap.set(mapKey, department);
    state.departments.push(department);
  }
  return info.key;
}

function itemDedupKey(year, budgetCode) {
  return `${year}:${cleanText(budgetCode).replace(/[\s　]+/g, "").toUpperCase()}`;
}

function addBudgetItem(state, item) {
  const dedupKey = itemDedupKey(item.budget_year, item.budget_code);
  if (state.itemByBudgetCode.has(dedupKey)) {
    addWarning(state, {
      code: "DUPLICATE_BUDGET_ITEM",
      message: `預算編號 ${item.budget_code} 已由其他工作表保留，本列不重複匯入`,
      sheet: item.source_sheet_name,
      row: item.source_row_number
    });
    return null;
  }
  state.itemByBudgetCode.set(dedupKey, item.source_key);
  state.items.push(item);
  return item.source_key;
}

function monthHeader(value, fallbackYear) {
  const text = cleanText(value).replace(/[\s　]+/g, "");
  const explicit = text.match(/((?:19|20)\d{2})[/-](\d{1,2})月?/u);
  if (explicit) return { year: Number(explicit[1]), month: Number(explicit[2]) };
  const month = text.match(/^(\d{1,2})月$/u);
  return month ? { year: fallbackYear, month: Number(month[1]) } : null;
}

function combinedHeaders(sheet, topRow) {
  const count = sheet.actualColumnCount || sheet.columnCount;
  return Array.from({ length: count }, (_, index) => {
    const parent = cleanText(cellValue(sheet.getCell(topRow, index + 1)));
    const child = cleanText(cellValue(sheet.getCell(topRow + 1, index + 1)));
    return normalizedHeader(parent === child ? parent : `${parent}|${child}`);
  });
}

function parseMonthlySummarySheet(state, sheet, meta, date1904) {
  const year = meta.budget_year;
  const headerRow = meta.raw_metadata.header_row;
  const headers = combinedHeaders(sheet, headerRow);
  const childHeaders = rowHeaders(sheet, headerRow + 1);
  const hasChildMonths = childHeaders.some((header) => /^\d{1,2}月$/.test(header) || /(?:19|20)\d{2}[/-]\d{1,2}月/.test(header));
  const dataStart = headerRow + (hasChildMonths ? 2 : 1);
  const departmentColumn = findColumn(headers, [(value) => value.includes("部門")]);
  const codeColumn = findColumn(headers, [(value) => value.includes("預算編號")]);
  const itemColumn = findColumn(headers, [(value) => value.includes("項目")]);
  const quantityColumn = findColumn(headers, [(value) => value.includes("數量")]);
  const budgetColumn = findColumn(headers, [(value) => (value.includes("金額未稅") || value.includes("預算金額")) && !value.includes("累計")]);
  const actualColumn = findColumn(headers, [(value) => value.includes("累計") && (value.includes("動支") || value.includes("動資"))]);
  const availableColumn = findColumn(headers, [(value) => value.includes("可用餘額")]);
  const committedColumn = findColumn(headers, [(value) => value.includes("送簽中") || value.includes("請購中金額")]);
  const monthColumns = [];
  for (let column = 1; column <= headers.length; column += 1) {
    const child = cellValue(sheet.getCell(headerRow + 1, column));
    const top = cellValue(sheet.getCell(headerRow, column));
    const period = monthHeader(child, year) || monthHeader(top, year);
    if (period && period.month >= 1 && period.month <= 12) monthColumns.push({ column, ...period });
  }

  if (!departmentColumn || !codeColumn || !itemColumn || !budgetColumn) {
    addWarning(state, { code: "UNRECOGNIZED_BUDGET_COLUMNS", message: "無法完整辨識預算彙總欄位", sheet: sheet.name, row: headerRow });
    return;
  }

  for (let row = dataStart; row <= (sheet.actualRowCount || sheet.rowCount); row += 1) {
    const department = cleanText(cellValue(sheet.getCell(row, departmentColumn)));
    const budgetCode = cleanText(cellValue(sheet.getCell(row, codeColumn)));
    const itemName = cleanText(cellValue(sheet.getCell(row, itemColumn)));
    if (!department && !budgetCode && !itemName) continue;
    if (/小計|合計|總計/u.test(`${budgetCode}${itemName}`)) continue;
    if (!department || !budgetCode || !itemName) {
      addWarning(state, {
        code: "INCOMPLETE_BUDGET_ITEM",
        message: "預算項目缺少部門、預算編號或項目名稱，已保留警告但未寫入正式預算項目",
        sheet: sheet.name,
        row
      });
      continue;
    }

    const budget = moneyAt(state, sheet, row, budgetColumn, "預算金額", { allowEmpty: false });
    if (budget.error || budget.empty || budget.value < 0) continue;
    const committed = moneyAt(state, sheet, row, committedColumn, "送簽中");
    const reportedActual = moneyAt(state, sheet, row, actualColumn, "來源累計動支");
    const reportedAvailable = moneyAt(state, sheet, row, availableColumn, "來源可用餘額");
    const departmentKey = ensureDepartment(state, { value: department, year, sheet, row });
    const sourceKey = `${sheet.name}:${row}`;
    const acceptedKey = addBudgetItem(state, {
      department_key: departmentKey,
      source_key: sourceKey,
      budget_year: year,
      budget_code: budgetCode.trim(),
      item_name: itemName,
      quantity_text: cleanText(valueAt(sheet, row, quantityColumn)) || null,
      budget_amount: budget.value,
      committed_amount: committed.value || 0,
      source_reported_actual_amount: reportedActual.value,
      source_reported_available_amount: reportedAvailable.value,
      source_sheet_name: sheet.name,
      source_row_number: row,
      raw_data: { row: rawRow(sheet, row) }
    });
    if (!acceptedKey) continue;

    let monthlyTotal = 0;
    for (const month of monthColumns) {
      const amount = moneyAt(state, sheet, row, month.column, `${month.year} 年 ${month.month} 月動支`);
      if (amount.error || amount.empty || amount.value === 0) continue;
      monthlyTotal += amount.value;
      state.monthlyAmounts.push({
        item_source_key: acceptedKey,
        actual_year: month.year,
        actual_month: month.month,
        amount: amount.value,
        source_sheet_name: sheet.name,
        source_row_number: row,
        source_column_number: month.column,
        raw_value: cleanText(serializeCell(sheet.getCell(row, month.column)))
      });
    }
    if (reportedActual.value !== null && Math.abs(monthlyTotal - reportedActual.value) > 0.01) {
      addWarning(state, {
        code: "MONTHLY_TOTAL_MISMATCH",
        message: `月別金額 ${monthlyTotal} 與來源累計動支 ${reportedActual.value} 不一致`,
        sheet: sheet.name,
        row
      });
    }
  }
}

function parseLegacyBudgetSheet(state, sheet, meta, date1904) {
  const year = meta.budget_year;
  const headerRow = meta.raw_metadata.header_row;
  const headers = rowHeaders(sheet, headerRow);
  const departmentColumn = findColumn(headers, [(value) => value.includes("部門")]);
  const codeColumn = findColumn(headers, [(value) => value.includes("預算編號")]);
  const itemColumn = findColumn(headers, [(value) => value === "項目" || value.includes("項目")]);
  const quantityColumn = findColumn(headers, [(value) => value.includes("數量")]);
  const budgetColumn = findColumn(headers, [(value) => value.includes("預算金額")]);
  const dateColumn = findColumn(headers, [(value) => value.includes("請款日期")]);
  const descriptionColumn = findColumn(headers, [(value) => value.includes("請款明細")]);
  const amountColumn = findColumn(headers, [(value) => value.includes("請款金額")]);
  const actualColumn = findColumn(headers, [(value) => value.includes("累計金額")]);
  const availableColumn = findColumn(headers, [(value) => value.includes("可用餘額") || value.includes("餘額")]);
  const committedColumn = findColumn(headers, [(value) => value.includes("請購中金額")]);
  if (!departmentColumn || !codeColumn || !itemColumn || !budgetColumn) return;

  const sheetItems = new Map();
  let currentSourceKey = null;
  let currentBudgetCode = null;
  let currentDepartmentKey = null;

  for (let row = headerRow + 1; row <= (sheet.actualRowCount || sheet.rowCount); row += 1) {
    const department = cleanText(cellValue(sheet.getCell(row, departmentColumn)));
    const rawCode = cleanText(cellValue(sheet.getCell(row, codeColumn)));
    const itemName = cleanText(cellValue(sheet.getCell(row, itemColumn)));
    const isSubtotal = /小計|合計|總計/u.test(`${rawCode}${itemName}`);
    if (isSubtotal) {
      currentSourceKey = null;
      currentBudgetCode = null;
      continue;
    }

    if (department) currentDepartmentKey = ensureDepartment(state, { value: department, year, sheet, row });
    const normalizedCode = rawCode.replace(/[\s　]+/g, "").toUpperCase();
    if (/無預算/u.test(`${rawCode}${itemName}`)) {
      currentSourceKey = null;
      currentBudgetCode = null;
    }
    const isBudgetCode = Boolean(normalizedCode && !/無預算/u.test(normalizedCode));
    if (isBudgetCode && !sheetItems.has(normalizedCode)) {
      const budget = moneyAt(state, sheet, row, budgetColumn, "預算金額", { allowEmpty: false });
      if (!currentDepartmentKey || !itemName || budget.error || budget.empty || budget.value < 0) {
        addWarning(state, {
          code: "INCOMPLETE_BUDGET_ITEM",
          message: "歷史預算項目缺少必要欄位，未寫入正式預算項目",
          sheet: sheet.name,
          row
        });
        sheetItems.set(normalizedCode, null);
      } else {
        const committed = moneyAt(state, sheet, row, committedColumn, "請購中");
        const reportedActual = moneyAt(state, sheet, row, actualColumn, "來源累計動支");
        const reportedAvailable = moneyAt(state, sheet, row, availableColumn, "來源可用餘額");
        const sourceKey = addBudgetItem(state, {
          department_key: currentDepartmentKey,
          source_key: `${sheet.name}:${row}`,
          budget_year: year,
          budget_code: rawCode.trim(),
          item_name: itemName,
          quantity_text: cleanText(valueAt(sheet, row, quantityColumn)) || null,
          budget_amount: budget.value,
          committed_amount: committed.value || 0,
          source_reported_actual_amount: reportedActual.value,
          source_reported_available_amount: reportedAvailable.value,
          source_sheet_name: sheet.name,
          source_row_number: row,
          raw_data: { row: rawRow(sheet, row) }
        });
        sheetItems.set(normalizedCode, sourceKey);
      }
    }

    if (isBudgetCode) {
      currentBudgetCode = rawCode.trim();
      currentSourceKey = sheetItems.get(normalizedCode) || null;
    }

    const requestDate = dateAt(state, sheet, row, dateColumn, date1904);
    const amount = moneyAt(state, sheet, row, amountColumn, "請款金額");
    if (!amount.error && !amount.empty && amount.value !== 0) {
      const hasExactLink = Boolean(currentSourceKey && currentBudgetCode);
      const actualYear = requestDate.value ? Number(requestDate.value.slice(0, 4)) : null;
      const actualMonth = requestDate.value ? Number(requestDate.value.slice(5, 7)) : null;
      state.vouchers.push({
        department_key: currentDepartmentKey,
        item_source_key: hasExactLink ? currentSourceKey : null,
        budget_year: year,
        voucher_number: null,
        request_date: requestDate.value,
        actual_year: actualYear,
        actual_month: actualMonth,
        account_code: null,
        account_name: null,
        description: cleanText(valueAt(sheet, row, descriptionColumn)) || itemName || null,
        amount: amount.value,
        budget_code: hasExactLink ? currentBudgetCode : null,
        relationship_status: hasExactLink ? "exact" : "unlinked",
        source_category: "actual_spend",
        source_sheet_name: sheet.name,
        source_row_number: row,
        raw_data: { row: rawRow(sheet, row) }
      });
      if (hasExactLink && actualYear && actualMonth) {
        state.monthlyAmounts.push({
          item_source_key: currentSourceKey,
          actual_year: actualYear,
          actual_month: actualMonth,
          amount: amount.value,
          source_sheet_name: sheet.name,
          source_row_number: row,
          source_column_number: amountColumn,
          raw_value: cleanText(serializeCell(sheet.getCell(row, amountColumn)))
        });
      }
    }
  }
}

function parseSpendDetailSheet(state, sheet, meta) {
  const headerRow = meta.raw_metadata.header_row;
  const headers = rowHeaders(sheet, headerRow);
  const monthColumn = findColumn(headers, [(value) => value.includes("月份")]);
  const itemColumn = findColumn(headers, [(value) => value.includes("項目")]);
  const actualColumn = findColumn(headers, [(value) => value.includes("目前已動支")]);
  const plannedCurrentColumn = findColumn(headers, [(value) => value.includes(`${meta.budget_year}請款`) || value.includes("規劃中項目")]);
  const plannedOtherColumns = headers
    .map((value, index) => (value.includes("請款") && value.includes("規劃中項目")) ? index + 1 : 0)
    .filter((column) => column && column !== plannedCurrentColumn);
  let period = null;
  let warnedMissingKeys = false;
  for (let row = headerRow + 1; row <= (sheet.actualRowCount || sheet.rowCount); row += 1) {
    const monthText = cleanText(cellValue(sheet.getCell(row, monthColumn)));
    const detected = parseYearMonthText(monthText);
    if (detected?.startMonth) period = { year: detected.year, month: detected.startMonth };
    const itemName = cleanText(cellValue(sheet.getCell(row, itemColumn)));
    if (!itemName || /合計|總額/u.test(itemName)) continue;
    if (!warnedMissingKeys) {
      addWarning(state, {
        code: "UNLINKED_SPEND_DETAIL",
        message: "此支出明細未提供部門與預算編號，將保留為未關聯傳票資料，不會猜測對應預算項目",
        sheet: sheet.name,
        row
      });
      warnedMissingKeys = true;
    }
    const actual = moneyAt(state, sheet, row, actualColumn, "目前已動支");
    if (!actual.error && !actual.empty && actual.value !== 0) {
      state.vouchers.push({
        department_key: null,
        item_source_key: null,
        budget_year: meta.budget_year,
        voucher_number: null,
        request_date: null,
        actual_year: period?.year || null,
        actual_month: period?.month || null,
        account_code: null,
        account_name: null,
        description: itemName,
        amount: actual.value,
        budget_code: null,
        relationship_status: "unlinked",
        source_category: "actual_spend",
        source_sheet_name: sheet.name,
        source_row_number: row,
        raw_data: { row: rawRow(sheet, row) }
      });
    }
    for (const column of [plannedCurrentColumn, ...plannedOtherColumns].filter(Boolean)) {
      const planned = moneyAt(state, sheet, row, column, "請款／規劃中金額");
      if (planned.error || planned.empty || planned.value === 0) continue;
      state.vouchers.push({
        department_key: null,
        item_source_key: null,
        budget_year: meta.budget_year,
        voucher_number: null,
        request_date: null,
        actual_year: null,
        actual_month: null,
        account_code: null,
        account_name: null,
        description: itemName,
        amount: planned.value,
        budget_code: null,
        relationship_status: "unlinked",
        source_category: "planned_spend",
        source_sheet_name: sheet.name,
        source_row_number: row,
        raw_data: { row: rawRow(sheet, row), source_column: column }
      });
    }
  }
}

function parseVoucherSheet(state, sheet, meta, date1904) {
  const headerRow = meta.raw_metadata.header_row;
  const headers = rowHeaders(sheet, headerRow);
  const voucherColumn = findColumn(headers, [(value) => value.includes("傳票號碼")]);
  const dateColumn = findColumn(headers, [(value) => value.includes("請款日期") || value === "日期"]);
  const accountCodeColumn = findColumn(headers, [(value) => value.includes("科目代碼")]);
  const accountNameColumn = findColumn(headers, [(value) => value.includes("科目名稱")]);
  const descriptionColumn = findColumn(headers, [(value) => value.includes("說明")]);
  const amountColumn = findColumn(headers, [(value) => value.includes("金額")]);
  const departmentColumn = findColumn(headers, [(value) => value.includes("部門")]);
  const budgetCodeColumn = findColumn(headers, [(value) => value.includes("預算編號")]);
  let warnedMissing = false;
  for (let row = headerRow + 1; row <= (sheet.actualRowCount || sheet.rowCount); row += 1) {
    const voucherNumber = cleanText(cellValue(sheet.getCell(row, voucherColumn)));
    if (!voucherNumber) continue;
    const amount = moneyAt(state, sheet, row, amountColumn, "傳票金額", { allowEmpty: false });
    if (amount.error || amount.empty) continue;
    const requestDate = dateAt(state, sheet, row, dateColumn, date1904);
    const department = cleanText(valueAt(sheet, row, departmentColumn));
    const budgetCode = cleanText(valueAt(sheet, row, budgetCodeColumn));
    const year = requestDate.value ? Number(requestDate.value.slice(0, 4)) : meta.budget_year;
    const departmentKey = department && year ? ensureDepartment(state, { value: department, year, sheet, row }) : null;
    const matchingKeys = budgetCode
      ? [...state.itemByBudgetCode.entries()].filter(([key]) => key.endsWith(`:${budgetCode.replace(/[\s　]+/g, "").toUpperCase()}`))
      : [];
    const exactKey = matchingKeys.length === 1 ? matchingKeys[0][1] : null;
    if (!warnedMissing && (!dateColumn || !departmentColumn || !budgetCodeColumn)) {
      addWarning(state, {
        code: "VOUCHER_FIELDS_MISSING",
        message: "傳票來源未提供請款日期、部門或預算編號；缺少欄位將保留空值，且不建立猜測式關聯",
        sheet: sheet.name,
        row: headerRow
      });
      warnedMissing = true;
    }
    state.vouchers.push({
      department_key: departmentKey,
      item_source_key: exactKey,
      budget_year: year || null,
      voucher_number: voucherNumber,
      request_date: requestDate.value,
      actual_year: requestDate.value ? Number(requestDate.value.slice(0, 4)) : null,
      actual_month: requestDate.value ? Number(requestDate.value.slice(5, 7)) : null,
      account_code: cleanText(valueAt(sheet, row, accountCodeColumn)) || null,
      account_name: cleanText(valueAt(sheet, row, accountNameColumn)) || null,
      description: cleanText(valueAt(sheet, row, descriptionColumn)) || null,
      amount: amount.value,
      budget_code: exactKey ? budgetCode : null,
      relationship_status: exactKey ? "exact" : "unlinked",
      source_category: "voucher",
      source_sheet_name: sheet.name,
      source_row_number: row,
      raw_data: { row: rawRow(sheet, row) }
    });
  }
}

export async function parseCostControlWorkbook(buffer, { filename = "cost-control.xlsx" } = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const periods = workbook.worksheets.map(detectSheetPeriod).filter(Boolean);
  const filenamePeriod = detectFilenamePeriod(filename);
  const primaryYear = filenamePeriod?.year || Math.max(...periods.map((period) => period.year));
  const dataMonth = filenamePeriod?.month || Math.max(1, ...periods.filter((period) => period.year === primaryYear).map((period) => period.endMonth || 0));
  const state = {
    warnings: [],
    departments: [],
    departmentMap: new Map(),
    items: [],
    itemByBudgetCode: new Map(),
    monthlyAmounts: [],
    vouchers: [],
    sheets: []
  };
  const sheetPlans = workbook.worksheets.map((sheet, index) => {
    const period = detectSheetPeriod(sheet);
    const classified = classifySheet(sheet, primaryYear);
    const meta = {
      sheet_name: sheet.name,
      sheet_index: index,
      visibility: sheet.state || "visible",
      classification: classified.classification,
      budget_year: period?.year || null,
      row_count: sheet.actualRowCount || 0,
      column_count: sheet.actualColumnCount || 0,
      merged_range_count: sheet.model.merges?.length || 0,
      warning_count: 0,
      raw_metadata: {
        header_row: classified.headerRow || null,
        detected_period: period,
        formula_cells: 0,
        formula_error_cells: 0
      }
    };
    sheet.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value;
      if (value && typeof value === "object" && (Object.hasOwn(value, "formula") || Object.hasOwn(value, "sharedFormula"))) {
        meta.raw_metadata.formula_cells += 1;
        if (value.result && typeof value.result === "object" && value.result.error) meta.raw_metadata.formula_error_cells += 1;
      }
    }));
    state.sheets.push(meta);
    return { sheet, meta };
  });

  const priority = { budget_summary: 0, historical_budget: 1, spend_detail: 2, voucher: 3, unrecognized: 4 };
  sheetPlans.sort((left, right) => {
    const classCompare = priority[left.meta.classification] - priority[right.meta.classification];
    if (classCompare !== 0) return classCompare;
    const leftConsolidated = /預算控制表|彙總/u.test(left.sheet.name) ? 0 : 1;
    const rightConsolidated = /預算控制表|彙總/u.test(right.sheet.name) ? 0 : 1;
    return leftConsolidated - rightConsolidated || left.meta.sheet_index - right.meta.sheet_index;
  });

  for (const { sheet, meta } of sheetPlans) {
    const warningStart = state.warnings.length;
    if (meta.classification === "voucher") parseVoucherSheet(state, sheet, meta, Boolean(workbook.properties?.date1904));
    else if (meta.classification === "spend_detail") parseSpendDetailSheet(state, sheet, meta);
    else if (meta.classification === "budget_summary" || meta.classification === "historical_budget") {
      const headers = combinedHeaders(sheet, meta.raw_metadata.header_row);
      const hasMonths = headers.some((header) => /(?:^|\|)\d{1,2}月(?:$|\|)/.test(header) || /(?:19|20)\d{2}[/-]\d{1,2}月/.test(header));
      if (hasMonths) parseMonthlySummarySheet(state, sheet, meta, Boolean(workbook.properties?.date1904));
      else parseLegacyBudgetSheet(state, sheet, meta, Boolean(workbook.properties?.date1904));
    } else {
      addWarning(state, { code: "UNRECOGNIZED_SHEET", message: "無法辨識工作表用途，僅保留工作表中繼資料", sheet: sheet.name });
    }
    meta.warning_count = state.warnings.length - warningStart;
  }

  const fatalErrors = [];
  if (!Number.isInteger(primaryYear) || primaryYear < 2000 || primaryYear > 2200) fatalErrors.push("無法辨識預算年度");
  if (!Number.isInteger(dataMonth) || dataMonth < 1 || dataMonth > 12) fatalErrors.push("無法辨識匯入資料月份");
  if (!state.departments.length) fatalErrors.push("無法辨識任何部門");
  if (!state.items.length) fatalErrors.push("無法辨識任何正式預算項目");

  const payload = {
    sheets: state.sheets,
    departments: state.departments,
    items: state.items,
    monthlyAmounts: state.monthlyAmounts,
    vouchers: state.vouchers
  };
  return {
    budgetYear: primaryYear,
    dataMonth,
    canImport: fatalErrors.length === 0,
    fatalErrors,
    warnings: state.warnings,
    historySheetNames: state.sheets.filter((sheet) => sheet.classification === "historical_budget").map((sheet) => sheet.sheet_name),
    recognizedYears: [...new Set(state.items.map((item) => item.budget_year))].sort((a, b) => b - a),
    counts: {
      sheets: state.sheets.length,
      departments: state.departments.length,
      budgetItems: state.items.length,
      monthlyAmounts: state.monthlyAmounts.length,
      vouchers: state.vouchers.length,
      warnings: state.warnings.length
    },
    payload
  };
}
