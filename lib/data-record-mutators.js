const ASSET_SOURCES = new Set([
  "assets_mountain_pc",
  "assets_downhill_pc",
  "assets_printer",
  "assets_north_ya"
]);

const EDITABLE_SOURCES = new Set([
  ...ASSET_SOURCES,
  "anydesk",
  "contracts_software",
  "contracts_mobile"
]);

const SOURCE_LABELS = {
  assets_mountain_pc: "山上電腦",
  assets_downhill_pc: "山下電腦",
  assets_printer: "印表機",
  assets_north_ya: "北 YA",
  anydesk: "AnyDesk List",
  contracts_software: "軟體合約",
  contracts_mobile: "手機門號合約"
};

const FIELD_KEYS = {
  anydesk: {
    device_name: ["device_name", "設備名稱"],
    anydesk_id: ["anydesk_id", "AnyDesk ID"],
    note: ["note", "備註"],
    last_checked_at: ["last_checked_at", "最後檢查時間"]
  },
  contracts_software: {
    id: ["id", "編號"],
    contract_name: ["contract_name", "合約名稱"],
    vendor: ["vendor", "廠商"],
    start_date: ["start_date", "開始日"],
    end_date: ["end_date", "到期日"],
    amount: ["amount", "金額"],
    owner: ["owner", "負責人"],
    status: ["status", "狀態"],
    note: ["note", "備註"]
  },
  contracts_mobile: {
    id: ["id", "編號"],
    phone_no: ["phone_no", "phone", "mobile_no", "門號"],
    user_name: ["user_name", "user", "short_code", "使用者"],
    department: ["department", "部門"],
    carrier: ["carrier", "電信商"],
    plan_name: ["plan_name", "plan", "方案"],
    start_date: ["start_date", "開始日"],
    end_date: ["end_date", "expire_date", "到期日"],
    amount: ["amount", "金額"],
    owner: ["owner", "負責人"],
    status: ["status", "狀態"],
    note: ["note", "備註"]
  }
};

function text(value) {
  return String(value ?? "").trim();
}

function pick(values, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(values || {}, key)) return text(values[key]);
  }
  return "";
}

function parseAmount(value) {
  const raw = text(value);
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.-]/g, "");
  if (!cleaned) throw new Error("金額必須是有效數字");
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) throw new Error("金額必須是有效數字");
  return amount;
}

function assertDate(value, label) {
  const raw = text(value);
  if (!raw) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} 必須是有效日期`);
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || raw !== date.toISOString().slice(0, 10)) {
    throw new Error(`${label} 必須是有效日期`);
  }
}

function assertIpv4(value) {
  const raw = text(value);
  if (!raw) return;
  const parts = raw.split(".");
  if (parts.length !== 4) throw new Error("IP 位址格式不正確");
  const valid = parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
  if (!valid) throw new Error("IP 位址格式不正確");
}

function createRecordKey(source, now = new Date()) {
  return `${source}-${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function assetSearchText(data) {
  return Object.values(data || {})
    .map((value) => (value === null || value === undefined ? "" : String(value)))
    .filter(Boolean)
    .join(" ");
}

function assertEditableSource(source) {
  if (!EDITABLE_SOURCES.has(source)) throw new Error("此資料頁不支援編輯");
}

function mapAnydesk(values) {
  const mapped = {
    device_name: pick(values, FIELD_KEYS.anydesk.device_name),
    anydesk_id: pick(values, FIELD_KEYS.anydesk.anydesk_id),
    note: pick(values, FIELD_KEYS.anydesk.note),
    last_checked_at: pick(values, FIELD_KEYS.anydesk.last_checked_at)
  };
  if (!mapped.device_name) throw new Error("設備名稱不得為空");
  assertDate(mapped.last_checked_at, "最後檢查時間");
  return mapped;
}

function mapSoftwareContract(values, id) {
  const mapped = {
    id: id || pick(values, FIELD_KEYS.contracts_software.id) || createRecordKey("CON"),
    contract_name: pick(values, FIELD_KEYS.contracts_software.contract_name),
    vendor: pick(values, FIELD_KEYS.contracts_software.vendor),
    start_date: pick(values, FIELD_KEYS.contracts_software.start_date),
    end_date: pick(values, FIELD_KEYS.contracts_software.end_date),
    amount: parseAmount(pick(values, FIELD_KEYS.contracts_software.amount)),
    owner: pick(values, FIELD_KEYS.contracts_software.owner),
    status: pick(values, FIELD_KEYS.contracts_software.status),
    note: pick(values, FIELD_KEYS.contracts_software.note)
  };
  if (!mapped.contract_name) throw new Error("合約名稱不得為空");
  assertDate(mapped.start_date, "開始日");
  assertDate(mapped.end_date, "到期日");
  return mapped;
}

function mapMobileContract(values, id) {
  const mapped = {
    id: id || pick(values, FIELD_KEYS.contracts_mobile.id) || createRecordKey("MOB"),
    phone_no: pick(values, FIELD_KEYS.contracts_mobile.phone_no),
    user_name: pick(values, FIELD_KEYS.contracts_mobile.user_name),
    department: pick(values, FIELD_KEYS.contracts_mobile.department),
    carrier: pick(values, FIELD_KEYS.contracts_mobile.carrier),
    plan_name: pick(values, FIELD_KEYS.contracts_mobile.plan_name),
    start_date: pick(values, FIELD_KEYS.contracts_mobile.start_date),
    end_date: pick(values, FIELD_KEYS.contracts_mobile.end_date),
    amount: parseAmount(pick(values, FIELD_KEYS.contracts_mobile.amount)),
    owner: pick(values, FIELD_KEYS.contracts_mobile.owner),
    status: pick(values, FIELD_KEYS.contracts_mobile.status),
    note: pick(values, FIELD_KEYS.contracts_mobile.note)
  };
  if (!mapped.phone_no) throw new Error("門號不得為空");
  assertDate(mapped.start_date, "開始日");
  assertDate(mapped.end_date, "到期日");
  return mapped;
}

function validateAssetData(values) {
  const data = { ...(values || {}) };
  const name = pick(data, ["asset_name", "computer_name", "設備名稱", "電腦名稱", "名稱"]);
  if (!name) throw new Error("設備名稱不得為空");
  assertIpv4(pick(data, ["ip_address", "IP", "IP 位址", "IP位址", "IP位置"]));
  return data;
}

export function isEditableRecordSource(source) {
  return EDITABLE_SOURCES.has(source);
}

export function recordTableForSource(source) {
  if (ASSET_SOURCES.has(source)) return "sheet_records";
  if (source === "anydesk") return "anydesk_devices";
  if (source === "contracts_software") return "contracts";
  if (source === "contracts_mobile") return "mobile_contracts";
  throw new Error("此資料頁不支援編輯");
}

export function buildRecordInsert(source, values, now = new Date()) {
  assertEditableSource(source);
  if (ASSET_SOURCES.has(source)) {
    const data = validateAssetData(values);
    const recordKey = createRecordKey(source, now);
    return {
      query: "select=*",
      body: {
        source_key: source,
        source_label: SOURCE_LABELS[source] || source,
        sheet_name: SOURCE_LABELS[source] || source,
        record_key: recordKey,
        data,
        search_text: assetSearchText(data)
      }
    };
  }
  if (source === "anydesk") return { query: "select=*", body: mapAnydesk(values) };
  if (source === "contracts_software") return { query: "select=*", body: mapSoftwareContract(values) };
  return { query: "select=*", body: mapMobileContract(values) };
}

export function buildRecordUpdate(source, id, values) {
  assertEditableSource(source);
  const safeId = text(id);
  if (!safeId) throw new Error("缺少資料 ID");
  if (ASSET_SOURCES.has(source)) {
    const data = validateAssetData(values);
    return {
      query: `id=eq.${encodeURIComponent(safeId)}&select=*`,
      body: {
        data,
        search_text: assetSearchText(data)
      }
    };
  }
  if (source === "anydesk") {
    return { query: `id=eq.${encodeURIComponent(safeId)}&select=*`, body: mapAnydesk(values) };
  }
  if (source === "contracts_software") {
    const { id: _id, ...body } = mapSoftwareContract(values, safeId);
    return { query: `id=eq.${encodeURIComponent(safeId)}&select=*`, body };
  }
  const { id: _id, ...body } = mapMobileContract(values, safeId);
  return { query: `id=eq.${encodeURIComponent(safeId)}&select=*`, body };
}
