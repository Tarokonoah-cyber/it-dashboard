const ASSET_SOURCE_KEYS = new Set([
  "assets_mountain_pc",
  "assets_downhill_pc",
  "assets_printer",
  "assets_north_ya",
  "assets_iptv"
]);

const EVENT_TYPES = new Set(["維修", "保養", "更換", "送修", "其他"]);
const MAINTENANCE_STATUSES = new Set(["待處理", "處理中", "已完成", "取消"]);

function text(value) {
  return String(value ?? "").trim();
}

function first(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== null && value !== undefined && text(value)) return text(value);
  }
  return "";
}

function inputError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function optionalText(value, label, maxLength) {
  const normalized = text(value);
  if (normalized.length > maxLength) throw inputError(`${label}不可超過 ${maxLength} 字`);
  return normalized || null;
}

function optionalDate(value, label) {
  const normalized = text(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw inputError(`${label}格式不正確`);
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw inputError(`${label}格式不正確`);
  }
  return normalized;
}

function optionalMoney(value, label) {
  if (value === null || value === undefined || text(value) === "") return null;
  const normalized = typeof value === "string" ? value.replace(/[,\s]/g, "") : value;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 9999999999.99) {
    throw inputError(`${label}必須是有效的非負數字`);
  }
  return Math.round(amount * 100) / 100;
}

export function isAssetSourceKey(value) {
  return ASSET_SOURCE_KEYS.has(text(value));
}

export function getWarrantyStatus(asset, today) {
  const endDate = optionalDate(asset?.warranty_end_date, "保固期限");
  if (!endDate) return { code: "unset", label: "未設定", daysRemaining: null };

  const todayKey = optionalDate(today, "今天") || new Date().toISOString().slice(0, 10);
  const endTime = Date.parse(`${endDate}T00:00:00Z`);
  const todayTime = Date.parse(`${todayKey}T00:00:00Z`);
  const daysRemaining = Math.round((endTime - todayTime) / 86400000);
  if (daysRemaining < 0) return { code: "expired", label: "已過保", daysRemaining };
  if (daysRemaining <= 30) return { code: "expiring", label: "即將到期", daysRemaining };
  return { code: "active", label: "保固中", daysRemaining };
}

export function normalizeAssetProfile(values) {
  const purchaseDate = optionalDate(values?.purchase_date, "採購日");
  const warrantyEndDate = optionalDate(values?.warranty_end_date, "保固期限");
  if (purchaseDate && warrantyEndDate && warrantyEndDate < purchaseDate) {
    throw inputError("保固期限不可早於採購日");
  }

  return {
    purchase_date: purchaseDate,
    purchase_vendor: optionalText(values?.purchase_vendor, "採購廠商", 160),
    purchase_cost: optionalMoney(values?.purchase_cost, "採購金額"),
    serial_number: optionalText(values?.serial_number, "序號", 160),
    warranty_end_date: warrantyEndDate,
    warranty_note: optionalText(values?.warranty_note, "保固備註", 2000)
  };
}

export function normalizeMaintenanceRecord(values) {
  const serviceDate = optionalDate(values?.service_date, "處理日期");
  const eventType = text(values?.event_type) || "維修";
  const status = text(values?.status) || "已完成";
  const summary = optionalText(values?.summary, "處理摘要", 200);
  if (!serviceDate) throw inputError("請填寫處理日期");
  if (!summary) throw inputError("請填寫處理摘要");
  if (!EVENT_TYPES.has(eventType)) throw inputError("處理類型不正確");
  if (!MAINTENANCE_STATUSES.has(status)) throw inputError("處理狀態不正確");

  return {
    service_date: serviceDate,
    event_type: eventType,
    summary,
    vendor: optionalText(values?.vendor, "處理廠商", 160),
    cost: optionalMoney(values?.cost, "處理費用"),
    status,
    note: optionalText(values?.note, "處理備註", 4000)
  };
}

export function assetProjectionFromSheetRecord(record) {
  const data = record?.data || {};
  const sourceKey = text(record?.source_key);
  if (!isAssetSourceKey(sourceKey)) throw inputError("這筆資料不是設備紀錄");

  let assetType = first(data, ["資產類型", "設備類型", "asset_type"]) || text(record?.source_label) || sourceKey;
  let assetName = first(data, ["電腦名稱", "設備名稱", "名稱", "asset_name", "computer_name"]);
  let department = first(data, ["使用部門", "部門", "department"]);
  let model = first(data, ["硬體型號", "主機型號", "設備型號", "型號", "model"]);
  let status = first(data, ["第 1 欄", "資產狀態", "盤點狀態", "狀態", "status"]);
  let note = first(data, ["備註", "盤點備註", "碳粉/墨水型號", "碳粉/墨水型號 ", "note"]);

  if (sourceKey === "assets_north_ya") {
    assetType = "北 YA 電腦";
    assetName ||= first(data, ["使用者", "使用人", "IP位址", "IP"]);
    department ||= "北 YA";
    model ||= first(data, ["主機品牌"]);
  } else if (sourceKey === "assets_iptv") {
    assetType = "IPTV";
    assetName ||= first(data, ["IP"]);
    department ||= "IPTV";
    status ||= assetName ? "正常" : "";
    note ||= first(data, ["TS", "MAC"]);
  } else if (sourceKey === "assets_printer") {
    assetType ||= "印表機";
  }

  return {
    source_record_id: record.id,
    source_key: sourceKey,
    source_label: text(record.source_label) || sourceKey,
    record_key: text(record.record_key),
    asset_type: assetType,
    asset_name: assetName || text(record.record_key) || "未命名設備",
    department,
    user_name: first(data, ["使用人", "使用者", "user_name"]),
    ip_address: first(data, ["IP位置", "IP 位址", "IP位址", "IP", "ip_address"]),
    mac_address: first(data, ["MAC", "MAC位置", "MAC位址", "mac_address"]),
    model,
    windows_version: first(data, ["WINDOWS版本", "Windows 版本", "windows_version"]),
    antivirus_installed: first(data, ["是否裝防毒", "防毒", "antivirus_installed"]),
    status,
    inventory_time: first(data, ["最後更新時間", "最後更新", "資料更新時間", "updated_at"]),
    note
  };
}

export function withWarrantyStatus(asset, today) {
  return { ...asset, warranty_status: getWarrantyStatus(asset, today) };
}
