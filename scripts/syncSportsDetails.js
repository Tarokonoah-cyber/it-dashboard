const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VALID_DETAIL_STATUSES = new Set([
  "not_synced",
  "not_announced",
  "pre_game_synced",
  "waiting_final",
  "post_game_synced"
]);
const VALID_SYNC_PHASES = new Set([
  "schedule",
  "pre_game_3h",
  "pre_game_1h",
  "post_game",
  "manual"
]);

function loadDotEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = { payload: "", phase: "manual", dryRun: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--payload") args.payload = argv[++index] || "";
    else if (arg === "--phase") args.phase = argv[++index] || "manual";
    else if (!args.payload) args.payload = arg;
  }
  return args;
}

function cleanText(value, maxLength = 1000) {
  const text = String(value || "").trim();
  if (text.length > maxLength) throw new Error(`Text must be ${maxLength} characters or less`);
  return text;
}

function normalizeDateTime(value, label) {
  const text = cleanText(value, 120);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid`);
  return date.toISOString();
}

function normalizeUrl(value, label) {
  const text = cleanText(value, 1000);
  if (!text) return null;
  const url = new URL(text);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`${label} must be http or https`);
  return url.toString();
}

function normalizeDetail(row, fallbackPhase) {
  const eventId = cleanText(row.event_id, 80);
  if (!eventId) throw new Error("event_id is required");
  const sportType = cleanText(row.sport_type || "baseball", 80).toLowerCase();
  const detailStatus = cleanText(row.detail_status || "not_synced", 80).toLowerCase();
  const syncPhase = cleanText(row.sync_phase || fallbackPhase || "manual", 80).toLowerCase();
  if (!VALID_DETAIL_STATUSES.has(detailStatus)) throw new Error(`detail_status is invalid: ${detailStatus}`);
  if (!VALID_SYNC_PHASES.has(syncPhase)) throw new Error(`sync_phase is invalid: ${syncPhase}`);

  const details = row.details && typeof row.details === "object" && !Array.isArray(row.details)
    ? row.details
    : {};
  const sourceUrl = normalizeUrl(row.source_url || details.source_url, "source_url");
  if (sourceUrl && !details.source_url) details.source_url = sourceUrl;

  return {
    event_id: eventId,
    sport_type: sportType,
    detail_status: detailStatus,
    sync_phase: syncPhase,
    details,
    source_url: sourceUrl,
    source_name: cleanText(row.source_name, 240) || null,
    source_updated_at: normalizeDateTime(row.source_updated_at, "source_updated_at"),
    last_synced_at: normalizeDateTime(row.last_synced_at, "last_synced_at") || new Date().toISOString(),
    raw_payload: row.raw_payload === undefined ? row : row.raw_payload,
    updated_at: new Date().toISOString()
  };
}

async function supabaseRequest(table, query, options = {}) {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: options.method || "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation"
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];
  if (!response.ok) throw new Error(data.message || text || `HTTP ${response.status}`);
  return data;
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  if (!args.payload) {
    console.log("Usage: npm run sync:sports-details -- --payload sports-data/parsed/details-example.json --phase pre_game_3h [--dry-run]");
    console.log("This is a sync skeleton. Feed it normalized external payloads; it does not crawl CPBL or MLB yet.");
    return;
  }

  const payloadPath = path.resolve(process.cwd(), args.payload);
  const raw = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.details;
  if (!Array.isArray(rows)) throw new Error("Payload must be an array or { details: [] }");

  const normalized = rows.map((row) => normalizeDetail(row, args.phase));
  if (args.dryRun) {
    console.log(JSON.stringify({ dryRun: true, count: normalized.length, rows: normalized }, null, 2));
    return;
  }

  const upserted = await supabaseRequest("sports_event_details", "select=*&on_conflict=event_id", {
    method: "POST",
    prefer: "return=representation,resolution=merge-duplicates",
    body: normalized
  });

  console.log(`Upserted ${upserted.length} sports event detail rows from ${path.relative(ROOT, payloadPath)}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
