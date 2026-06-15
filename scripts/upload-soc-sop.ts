import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BUCKET = "sop-files";
const LOCAL_FILE = "public/sop-files/soc/SOC-MIS標準作業檢查表-正式版.xlsx";
const STORAGE_PATH = "soc/soc-mis-checklist-official.xlsx";
const MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const DOCUMENT_METADATA = {
  category: "SOC",
  title: "SOC MIS 標準作業檢查表",
  version: "正式版",
  description: "SOC 日常標準作業檢查使用",
  file_path: STORAGE_PATH
};

function loadEnvFile(path = ".env.local") {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function encodeStoragePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function publicFileUrl(supabaseUrl, bucket, path) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(path)}`;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function assertOk(response, action) {
  if (response.ok) return readJsonResponse(response);
  const body = await readJsonResponse(response);
  const detail =
    body && typeof body === "object" && "message" in body ? body.message : JSON.stringify(body);
  throw new Error(`${action} failed (${response.status}): ${detail || response.statusText}`);
}

async function main() {
  loadEnvFile();

  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const filePath = resolve(LOCAL_FILE);
  const file = readFileSync(filePath);
  const fileUrl = publicFileUrl(supabaseUrl, BUCKET, STORAGE_PATH);

  const baseHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };

  await assertOk(
    await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeStoragePath(STORAGE_PATH)}`, {
      method: "PUT",
      headers: {
        ...baseHeaders,
        "Content-Type": MIME_TYPE,
        "Cache-Control": "3600",
        "x-upsert": "true"
      },
      body: file
    }),
    "Storage upload"
  );

  const metadata = {
    ...DOCUMENT_METADATA,
    file_url: fileUrl,
    updated_at: new Date().toISOString()
  };

  const rows = await assertOk(
    await fetch(`${supabaseUrl}/rest/v1/sop_documents?on_conflict=category,file_path`, {
      method: "POST",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(metadata)
    }),
    "Metadata upsert"
  );

  console.log("Uploaded SOC SOP file");
  console.log(`Local file: ${filePath}`);
  console.log(`Storage path: ${BUCKET}/${STORAGE_PATH}`);
  console.log(`File URL: ${fileUrl}`);
  console.log(`Metadata rows: ${Array.isArray(rows) ? rows.length : 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
