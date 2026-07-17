import "server-only";

import ExcelJS from "exceljs";

const COLORS = {
  navy: "17324F",
  blue: "2F6FA7",
  pale: "EAF2F9",
  light: "F6F9FC",
  white: "FFFFFF",
  line: "D8E2EC",
  green: "DDF4E8",
  red: "FCE4E4",
  amber: "FFF0D4"
};

function titleBand(sheet, title, subtitle, width) {
  sheet.mergeCells(1, 1, 1, width);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: "Microsoft JhengHei", size: 18, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 34;
  sheet.mergeCells(2, 1, 2, width);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: "Microsoft JhengHei", size: 10, color: { argb: "65798E" } };
  subtitleCell.alignment = { vertical: "middle" };
  sheet.getRow(2).height = 22;
}

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { name: "Microsoft JhengHei", size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.blue } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.line } } };
  });
  row.height = 25;
}

function styleBody(sheet, startRow, endRow, width) {
  if (endRow < startRow) return;
  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > width) return;
      cell.font = { name: "Microsoft JhengHei", size: 10, color: { argb: "233D58" } };
      cell.alignment = { vertical: "top", wrapText: col > 1 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowIndex % 2 ? COLORS.white : COLORS.light } };
      cell.border = { bottom: { style: "hair", color: { argb: COLORS.line } } };
    });
  }
}

function addFilters(sheet, filters) {
  const pairs = Object.entries(filters).filter(([, value]) => value);
  pairs.forEach(([label, value], index) => {
    const row = 4 + index;
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = { name: "Microsoft JhengHei", bold: true, color: { argb: COLORS.navy } };
    sheet.getCell(row, 2).value = value;
    sheet.getCell(row, 2).font = { name: "Microsoft JhengHei", color: { argb: "51677D" } };
  });
  return 4 + pairs.length + 1;
}

function configureSheet(sheet, widths) {
  sheet.views = [{ state: "frozen", ySplit: 3 }];
  sheet.properties.defaultRowHeight = 20;
  sheet.showGridLines = false;
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
}

function workWorkbook(report, workbook) {
  const detail = workbook.addWorksheet("工作明細");
  configureSheet(detail, [13, 30, 15, 17, 15, 12, 12, 12, 14, 36]);
  titleBand(detail, "工作明細", `${report.filters.start} 至 ${report.filters.end}｜共 ${report.rows.length} 筆`, 10);
  detail.addRow([]);
  detail.addRow(["日期", "工作摘要", "工作類型", "關聯系統", "部門／範圍", "狀態", "優先級", "負責人", "編號", "備註"]);
  styleHeader(detail.getRow(4));
  report.rows.forEach((row) => detail.addRow([row.workDate, row.summary, row.workType, row.system, row.department, row.status, row.priority, row.owner, row.id, row.note]));
  styleBody(detail, 5, detail.rowCount, 10);
  detail.autoFilter = { from: "A4", to: `J${Math.max(4, detail.rowCount)}` };

  const summary = workbook.addWorksheet("摘要", { properties: { tabColor: { argb: COLORS.blue } } });
  configureSheet(summary, [21, 18, 4, 22, 14]);
  titleBand(summary, "工作 KPI 報表", `產生時間：${new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, 5);
  const metricStart = addFilters(summary, { "日期區間": `${report.filters.start} 至 ${report.filters.end}`, "工作類型": report.filters.workType, "關聯系統": report.filters.system, "部門／範圍": report.filters.department, "狀態": report.filters.status });
  summary.getCell(metricStart, 1).value = "指標";
  summary.getCell(metricStart, 2).value = "數值";
  styleHeader(summary.getRow(metricStart));
  const detailEnd = Math.max(5, detail.rowCount);
  const metrics = [
    ["總工作件數", { formula: `COUNTA('工作明細'!A5:A${detailEnd})`, result: report.summary.total }],
    ["已完成", { formula: `COUNTIF('工作明細'!F5:F${detailEnd},"已完成")+COUNTIF('工作明細'!F5:F${detailEnd},"完成")`, result: report.summary.completed }],
    ["未完成", { formula: `B${metricStart + 1}-B${metricStart + 2}`, result: report.summary.open }],
    ["完成率", { formula: `IFERROR(B${metricStart + 2}/B${metricStart + 1},0)`, result: report.summary.completionRate / 100 }]
  ];
  metrics.forEach((row) => summary.addRow(row));
  summary.getCell(metricStart + 4, 2).numFmt = "0%";
  styleBody(summary, metricStart + 1, metricStart + 4, 2);

  const statStart = metricStart;
  summary.getCell(statStart, 4).value = "工作類型";
  summary.getCell(statStart, 5).value = "件數";
  [summary.getCell(statStart, 4), summary.getCell(statStart, 5)].forEach((cell) => {
    cell.font = { name: "Microsoft JhengHei", size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.blue } };
  });
  Object.entries(report.summary.byType).forEach(([label, count], index) => {
    summary.getCell(statStart + 1 + index, 4).value = label;
    summary.getCell(statStart + 1 + index, 5).value = { formula: `COUNTIF('工作明細'!C5:C${detailEnd},D${statStart + 1 + index})`, result: count };
  });
  return workbook;
}

function inspectionWorkbook(report, workbook) {
  const selectedItems = report.rows.flatMap((record) => record.items.filter((item) => report.filters.period === "all" || item.period === report.filters.period));
  const records = workbook.addWorksheet("巡檢紀錄");
  configureSheet(records, [14, 16, 16, 14, 14, 38]);
  titleBand(records, "巡檢紀錄", `${report.filters.start} 至 ${report.filters.end}｜共 ${report.rows.length} 筆`, 6);
  records.addRow([]);
  records.addRow(["日期", "巡檢人員", "整體狀態", "異常數", "待觀察數", "備註"]);
  styleHeader(records.getRow(4));
  report.rows.forEach((row) => records.addRow([row.date, row.inspector, row.overallStatus, row.items.filter((item) => item.status === "異常").length, row.items.filter((item) => item.status === "待觀察").length, row.note]));
  styleBody(records, 5, records.rowCount, 6);
  records.autoFilter = { from: "A4", to: `F${Math.max(4, records.rowCount)}` };

  const items = workbook.addWorksheet("巡檢項目");
  configureSheet(items, [14, 16, 18, 28, 12, 14, 32, 18, 32, 30]);
  titleBand(items, "巡檢項目", `週期：${report.filters.period === "monthly" ? "每月" : report.filters.period === "all" ? "全部" : "每日"}｜共 ${selectedItems.length} 項`, 10);
  items.addRow([]);
  items.addRow(["日期", "巡檢人員", "分類", "項目", "週期", "狀態", "異常說明", "處理狀態", "處理方式", "備註"]);
  styleHeader(items.getRow(4));
  selectedItems.forEach((item) => items.addRow([item.date, item.inspector, item.category, item.itemName, item.period === "monthly" ? "每月" : "每日", item.status, item.issue, item.handlingStatus, item.handlingMethod, item.note]));
  styleBody(items, 5, items.rowCount, 10);
  items.autoFilter = { from: "A4", to: `J${Math.max(4, items.rowCount)}` };

  const abnormal = workbook.addWorksheet("異常項目", { properties: { tabColor: { argb: "D9534F" } } });
  configureSheet(abnormal, [14, 16, 18, 28, 14, 32, 18, 32]);
  titleBand(abnormal, "異常與待觀察項目", `共 ${report.summary.abnormalItems.length} 項`, 8);
  abnormal.addRow([]);
  abnormal.addRow(["日期", "巡檢人員", "分類", "項目", "狀態", "異常說明", "處理狀態", "處理方式"]);
  styleHeader(abnormal.getRow(4));
  report.summary.abnormalItems.forEach((item) => abnormal.addRow([item.date, item.inspector, item.category, item.itemName, item.status, item.issue, item.handlingStatus, item.handlingMethod]));
  styleBody(abnormal, 5, abnormal.rowCount, 8);

  const summary = workbook.addWorksheet("摘要", { properties: { tabColor: { argb: COLORS.blue } } });
  configureSheet(summary, [22, 18, 4, 22, 15]);
  titleBand(summary, "巡檢報表", `產生時間：${new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, 5);
  const metricStart = addFilters(summary, { "日期區間": `${report.filters.start} 至 ${report.filters.end}`, "巡檢週期": report.filters.period === "monthly" ? "每月" : report.filters.period === "all" ? "全部" : "每日", "巡檢人員": report.filters.inspector, "整體狀態": report.filters.status });
  summary.getCell(metricStart, 1).value = "指標";
  summary.getCell(metricStart, 2).value = "數值";
  styleHeader(summary.getRow(metricStart));
  const itemEnd = Math.max(5, items.rowCount);
  const metrics = [
    ["巡檢紀錄", report.summary.records],
    ["巡檢項目", { formula: `COUNTA('巡檢項目'!D5:D${itemEnd})`, result: report.summary.items }],
    ["正常", { formula: `COUNTIF('巡檢項目'!F5:F${itemEnd},"正常")`, result: report.summary.normal }],
    ["異常", { formula: `COUNTIF('巡檢項目'!F5:F${itemEnd},"異常")`, result: report.summary.abnormal }],
    ["待觀察", { formula: `COUNTIF('巡檢項目'!F5:F${itemEnd},"待觀察")`, result: report.summary.observation }],
    ["正常率", { formula: `IFERROR(B${metricStart + 3}/B${metricStart + 2},0)`, result: report.summary.completionRate / 100 }]
  ];
  metrics.forEach((row) => summary.addRow(row));
  summary.getCell(metricStart + 6, 2).numFmt = "0%";
  styleBody(summary, metricStart + 1, metricStart + 6, 2);
  return workbook;
}

export async function buildReportWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Taroko IT Dashboard";
  workbook.created = new Date();
  workbook.modified = new Date();
  if (report.type === "inspection") inspectionWorkbook(report, workbook);
  else workWorkbook(report, workbook);
  const summary = workbook.getWorksheet("摘要");
  if (summary) summary.orderNo = 1;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
