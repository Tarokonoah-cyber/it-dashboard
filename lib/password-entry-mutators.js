function text(value) {
  return String(value ?? "").trim();
}

function normalizeLoginUrl(value) {
  const raw = text(value);
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw).toString();
  } catch {
    throw new Error("登入網址格式不正確");
  }
}

export function buildPasswordEntryPayload(values) {
  const body = {
    category: text(values?.category),
    system_name: text(values?.system_name),
    login_url: normalizeLoginUrl(values?.login_url),
    username: text(values?.username),
    password_item: text(values?.password_item),
    notes: text(values?.notes),
    bitwarden_item_name: text(values?.bitwarden_item_name),
    bitwarden_item_id: text(values?.bitwarden_item_id)
  };

  if (!body.category) throw new Error("分類不得為空");
  if (!body.system_name) throw new Error("系統名稱不得為空");
  return body;
}
