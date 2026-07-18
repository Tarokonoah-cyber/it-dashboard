export const COST_CONTROL_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const COST_CONTROL_XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip"
]);

export function safeUploadFilename(value) {
  return String(value || "").split(/[\\/]/).pop().trim().slice(0, 255);
}

export function validateCostControlUpload(file) {
  if (!file || typeof file.arrayBuffer !== "function") return "請選擇 Excel 檔案";
  const name = safeUploadFilename(file.name);
  if (!name || !/\.xlsx$/i.test(name)) return "僅接受 .xlsx 檔案";
  if (!COST_CONTROL_XLSX_MIME_TYPES.has(String(file.type || "").toLowerCase())) return "檔案 MIME type 不是有效的 .xlsx";
  if (!Number.isFinite(file.size) || file.size <= 0) return "檔案內容為空";
  if (file.size > COST_CONTROL_MAX_FILE_BYTES) return "檔案超過 15 MB 上限";
  return null;
}

export function hasXlsxZipSignature(buffer) {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (
    (bytes[2] === 0x03 && bytes[3] === 0x04) ||
    (bytes[2] === 0x05 && bytes[3] === 0x06) ||
    (bytes[2] === 0x07 && bytes[3] === 0x08)
  );
}
