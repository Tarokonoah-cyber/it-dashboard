import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

const PAGE = [841.89, 595.28];
const MARGIN = 38;
const COLORS = {
  navy: rgb(0.09, 0.2, 0.31),
  blue: rgb(0.18, 0.44, 0.65),
  pale: rgb(0.92, 0.96, 0.98),
  light: rgb(0.97, 0.98, 0.99),
  line: rgb(0.83, 0.88, 0.92),
  text: rgb(0.13, 0.24, 0.34),
  muted: rgb(0.42, 0.5, 0.58),
  white: rgb(1, 1, 1)
};

async function loadFonts(pdf) {
  pdf.registerFontkit(fontkit);
  const fontRoot = join(process.cwd(), "node_modules", "@expo-google-fonts", "noto-sans-tc");
  const regularPath = join(fontRoot, "400Regular", "NotoSansTC_400Regular.ttf");
  const regularBytes = await readFile(regularPath);
  // fontkit can omit CJK glyphs while subsetting large fonts. Embedding one full
  // font keeps Traditional Chinese, Latin text and dates reliable in every PDF.
  const regular = await pdf.embedFont(regularBytes, { subset: false });
  return { regular, bold: regular };
}

function wrapText(text, font, size, width, maxLines = 2) {
  const chars = Array.from(String(text || ""));
  const lines = [];
  let current = "";
  for (const char of chars) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, size) <= width || !current) {
      current = next;
    } else {
      lines.push(current);
      current = char;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.join("").length < chars.length && lines.length) {
    let last = lines.length - 1;
    while (lines[last] && font.widthOfTextAtSize(`${lines[last]}…`, size) > width) lines[last] = lines[last].slice(0, -1);
    lines[last] = `${lines[last]}…`;
  }
  return lines.length ? lines : [""];
}

function addPage(pdf, fonts, title, subtitle) {
  const page = pdf.addPage(PAGE);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 66, width, height: 66, color: COLORS.navy });
  page.drawText("TAROKO IT", { x: MARGIN, y: height - 29, size: 10, font: fonts.bold, color: rgb(0.55, 0.78, 0.94) });
  page.drawText(title, { x: MARGIN, y: height - 51, size: 18, font: fonts.bold, color: COLORS.white });
  page.drawText(subtitle, { x: width - MARGIN - fonts.regular.widthOfTextAtSize(subtitle, 8), y: height - 47, size: 8, font: fonts.regular, color: rgb(0.75, 0.84, 0.91) });
  return { page, y: height - 90 };
}

function drawMetrics(page, fonts, metrics, y) {
  const gap = 10;
  const width = (PAGE[0] - MARGIN * 2 - gap * (metrics.length - 1)) / metrics.length;
  metrics.forEach((metric, index) => {
    const x = MARGIN + index * (width + gap);
    page.drawRectangle({ x, y: y - 48, width, height: 48, color: COLORS.pale, borderColor: COLORS.line, borderWidth: 0.7 });
    page.drawText(metric.label, { x: x + 10, y: y - 17, size: 8, font: fonts.regular, color: COLORS.muted });
    page.drawText(String(metric.value), { x: x + 10, y: y - 38, size: 16, font: fonts.bold, color: COLORS.navy });
  });
  return y - 64;
}

function drawFilters(page, fonts, filters, y) {
  const text = Object.entries(filters).filter(([, value]) => value).map(([label, value]) => `${label}：${value}`).join("　");
  const lines = wrapText(text, fonts.regular, 8, PAGE[0] - MARGIN * 2, 2);
  lines.forEach((line, index) => page.drawText(line, { x: MARGIN, y: y - index * 12, size: 8, font: fonts.regular, color: COLORS.muted }));
  return y - lines.length * 12 - 10;
}

function drawTable({ pdf, fonts, title, subtitle, headers, rows, widths, startPage, startY }) {
  let page = startPage;
  let y = startY;
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  function drawHeader() {
    page.drawRectangle({ x: MARGIN, y: y - 24, width: tableWidth, height: 24, color: COLORS.blue });
    let x = MARGIN;
    headers.forEach((header, index) => {
      page.drawText(header, { x: x + 5, y: y - 16, size: 8, font: fonts.bold, color: COLORS.white });
      x += widths[index];
    });
    y -= 24;
  }
  drawHeader();
  rows.forEach((row, rowIndex) => {
    const lines = row.map((cell, index) => wrapText(cell, fonts.regular, 7.5, widths[index] - 10, 2));
    const rowHeight = Math.max(24, Math.max(...lines.map((item) => item.length)) * 10 + 8);
    if (y - rowHeight < 42) {
      ({ page, y } = addPage(pdf, fonts, title, subtitle));
      drawHeader();
    }
    page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: tableWidth, height: rowHeight, color: rowIndex % 2 ? COLORS.light : COLORS.white, borderColor: COLORS.line, borderWidth: 0.35 });
    let x = MARGIN;
    lines.forEach((cellLines, index) => {
      cellLines.forEach((line, lineIndex) => page.drawText(line, { x: x + 5, y: y - 12 - lineIndex * 10, size: 7.5, font: fonts.regular, color: COLORS.text }));
      x += widths[index];
    });
    y -= rowHeight;
  });
}

function workPdf(pdf, fonts, report) {
  const title = "工作 KPI 報表";
  const subtitle = `${report.filters.start} 至 ${report.filters.end}`;
  let { page, y } = addPage(pdf, fonts, title, subtitle);
  y = drawMetrics(page, fonts, [
    { label: "總工作件數", value: report.summary.total },
    { label: "已完成", value: report.summary.completed },
    { label: "未完成", value: report.summary.open },
    { label: "完成率", value: `${report.summary.completionRate}%` }
  ], y);
  y = drawFilters(page, fonts, { "日期": subtitle, "類型": report.filters.workType, "系統": report.filters.system, "部門": report.filters.department, "狀態": report.filters.status }, y);
  drawTable({
    pdf, fonts, title, subtitle, startPage: page, startY: y,
    headers: ["日期", "工作摘要", "類型", "系統", "狀態", "備註"],
    widths: [72, 210, 90, 95, 70, 228],
    rows: report.rows.map((row) => [row.workDate, row.summary, row.workType, row.system, row.status, row.note])
  });
}

function inspectionPdf(pdf, fonts, report) {
  const title = "巡檢報表";
  const subtitle = `${report.filters.start} 至 ${report.filters.end}`;
  let { page, y } = addPage(pdf, fonts, title, subtitle);
  y = drawMetrics(page, fonts, [
    { label: "巡檢紀錄", value: report.summary.records },
    { label: "巡檢項目", value: report.summary.items },
    { label: "異常", value: report.summary.abnormal },
    { label: "待觀察", value: report.summary.observation },
    { label: "正常率", value: `${report.summary.completionRate}%` }
  ], y);
  y = drawFilters(page, fonts, { "日期": subtitle, "週期": report.filters.period === "monthly" ? "每月" : report.filters.period === "all" ? "全部" : "每日", "人員": report.filters.inspector, "狀態": report.filters.status }, y);
  const items = report.rows.flatMap((record) => record.items.filter((item) => report.filters.period === "all" || item.period === report.filters.period));
  drawTable({
    pdf, fonts, title, subtitle, startPage: page, startY: y,
    headers: ["日期", "巡檢人員", "分類", "項目", "狀態", "異常／處理"],
    widths: [72, 85, 95, 170, 70, 273],
    rows: items.map((item) => [item.date, item.inspector, item.category, item.itemName, item.status, [item.issue, item.handlingStatus, item.handlingMethod].filter(Boolean).join("／")])
  });
}

export async function buildReportPdf(report) {
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  pdf.setTitle(report.type === "inspection" ? "巡檢報表" : "工作 KPI 報表");
  pdf.setAuthor("Taroko IT Dashboard");
  if (report.type === "inspection") inspectionPdf(pdf, fonts, report);
  else workPdf(pdf, fonts, report);
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const label = `第 ${index + 1} / ${pages.length} 頁`;
    page.drawText(label, { x: PAGE[0] - MARGIN - fonts.regular.widthOfTextAtSize(label, 8), y: 20, size: 8, font: fonts.regular, color: COLORS.muted });
  });
  return Buffer.from(await pdf.save());
}
