const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.join(ROOT, "sports-data", "parsed", "example-events.json");
const VALID_SPORTS = new Set(["baseball", "football", "basketball", "cycling", "motorsport", "tennis", "other"]);
const VALID_STATUSES = new Set(["scheduled", "live", "completed", "postponed", "cancelled"]);
const VALID_IMPORTANCE = new Set(["normal", "watch", "important", "must_watch"]);

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

function cleanText(value, maxLength = 1000) {
  const text = String(value || "").trim();
  if (text.length > maxLength) throw new Error(`Text must be ${maxLength} characters or less`);
  return text;
}

function normalizeDateTime(value, fieldName) {
  const text = cleanText(value, 120);
  if (!text) throw new Error(`${fieldName} is required`);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00+08:00`)
    : new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} is invalid`);
  return date.toISOString();
}

function keyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "");
}

function buildEventKey(event) {
  const start = normalizeDateTime(event.start_time, "start_time");
  const league = keyPart(event.league || "sports");
  const date = start.slice(0, 10);
  const time = start.slice(11, 16).replace(":", "");
  const away = keyPart(event.away_team);
  const home = keyPart(event.home_team);
  const title = keyPart(event.title);
  const matchup = away || home ? `${away || "na"}-${home || "na"}` : title;
  return [league, date, time, matchup || "event"].join("-");
}

function normalizeEvent(event, sourceFile) {
  const title = cleanText(event.title, 200);
  const sportType = cleanText(event.sport_type, 80).toLowerCase();
  const status = cleanText(event.status || "scheduled", 40).toLowerCase();
  const importance = cleanText(event.importance || "normal", 40).toLowerCase();
  if (!title) throw new Error("title is required");
  if (!VALID_SPORTS.has(sportType)) throw new Error(`sport_type is invalid: ${sportType}`);
  if (!VALID_STATUSES.has(status)) throw new Error(`status is invalid: ${status}`);
  if (!VALID_IMPORTANCE.has(importance)) throw new Error(`importance is invalid: ${importance}`);

  const startTime = normalizeDateTime(event.start_time, "start_time");
  return {
    event_key: cleanText(event.event_key, 260) || buildEventKey(event),
    title,
    sport_type: sportType,
    league: cleanText(event.league, 120) || null,
    home_team: cleanText(event.home_team, 160) || null,
    away_team: cleanText(event.away_team, 160) || null,
    start_time: startTime,
    end_time: event.end_time ? normalizeDateTime(event.end_time, "end_time") : null,
    venue: cleanText(event.venue, 240) || null,
    status,
    importance,
    notes: cleanText(event.notes) || null,
    source_type: cleanText(event.source_type, 120) || "json_import",
    source_name: cleanText(event.source_name, 240) || null,
    source_file: cleanText(event.source_file, 260) || path.basename(sourceFile),
    source_month: cleanText(event.source_month, 20) || startTime.slice(0, 7),
    raw_payload: event,
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
  const sourceArg = process.argv[2] || DEFAULT_SOURCE;
  const sourcePath = path.resolve(process.cwd(), sourceArg);
  const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("Sports import JSON must be an array");

  const events = raw.map((event) => normalizeEvent(event, sourcePath));
  if (!events.length) {
    console.log("No sports events to import.");
    return;
  }

  const imported = await supabaseRequest("sports_events", "select=*&on_conflict=event_key", {
    method: "POST",
    prefer: "return=representation,resolution=merge-duplicates",
    body: events
  });

  await supabaseRequest("sports_import_batches", "select=*", {
    method: "POST",
    body: {
      source_file: path.relative(ROOT, sourcePath),
      source_month: events[0]?.source_month || null,
      source_name: events[0]?.source_name || null,
      imported_count: imported.length,
      skipped_count: Math.max(0, events.length - imported.length),
      status: "completed",
      message: `Imported ${imported.length} sports events`
    }
  }).catch((error) => {
    console.warn(`Import batch log skipped: ${error.message}`);
  });

  console.log(`Imported/upserted ${imported.length} sports events from ${path.relative(ROOT, sourcePath)}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
