const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.join(ROOT, "sports-data", "parsed", "example-events.json");
const DEFAULT_FOLDER = path.join(ROOT, "sports-data", "parsed");
const VALID_SPORTS = new Set(["baseball", "football", "basketball", "cycling", "racing", "motorsport", "tennis", "other"]);
const VALID_STATUSES = new Set(["scheduled", "live", "completed", "postponed", "cancelled"]);
const VALID_IMPORTANCE = new Set(["normal", "watch", "important", "must_watch"]);
const VALID_DETAIL_STATUSES = new Set(["not_synced", "not_announced", "pre_game_synced", "waiting_final", "post_game_synced"]);
const VALID_SYNC_PHASES = new Set(["schedule", "pre_game_3h", "pre_game_1h", "post_game", "manual"]);

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

function normalizeDateTime(value, fieldName, { required = true } = {}) {
  const text = cleanText(value, 120);
  if (!text) {
    if (required) throw new Error(`${fieldName} is required`);
    return null;
  }
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

function getSourceFile(sourcePath) {
  return path.relative(ROOT, sourcePath).replace(/\\/g, "/");
}

function readSportsFile(sourcePath) {
  const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  if (Array.isArray(raw)) return { metadata: {}, events: raw };
  if (raw && typeof raw === "object" && Array.isArray(raw.events)) {
    return { metadata: raw.metadata || {}, events: raw.events };
  }
  throw new Error("Sports import JSON must be an array or an object with an events array");
}

function normalizeSportType(value) {
  const sportType = cleanText(value, 80).toLowerCase();
  if (!VALID_SPORTS.has(sportType)) throw new Error(`sport_type is invalid: ${sportType}`);
  return sportType;
}

function normalizeEvent(event, sourcePath, metadata = {}) {
  const merged = {
    source_type: metadata.source_type,
    source_name: metadata.source_name,
    source_url: metadata.source_url,
    source_month: metadata.source_month,
    ...event
  };
  const title = cleanText(merged.title, 200);
  const sportType = normalizeSportType(merged.sport_type || metadata.sport_type);
  const status = cleanText(merged.status || "scheduled", 40).toLowerCase();
  const importance = cleanText(merged.importance || "normal", 40).toLowerCase();
  if (!title) throw new Error("title is required");
  if (!VALID_STATUSES.has(status)) throw new Error(`status is invalid: ${status}`);
  if (!VALID_IMPORTANCE.has(importance)) throw new Error(`importance is invalid: ${importance}`);

  const startTime = normalizeDateTime(merged.start_time, "start_time");
  const sourceFile = getSourceFile(sourcePath);
  return {
    event_key: cleanText(merged.event_key, 260) || buildEventKey(merged),
    title,
    sport_type: sportType,
    league: cleanText(merged.league || metadata.league, 120) || null,
    home_team: cleanText(merged.home_team, 160) || null,
    away_team: cleanText(merged.away_team, 160) || null,
    start_time: startTime,
    end_time: merged.end_time ? normalizeDateTime(merged.end_time, "end_time") : null,
    venue: cleanText(merged.venue, 240) || null,
    status,
    importance,
    notes: cleanText(merged.notes) || null,
    source_type: cleanText(merged.source_type, 120) || "json_import",
    source_name: cleanText(merged.source_name, 240) || null,
    source_file: cleanText(merged.source_file, 260) || sourceFile,
    source_month: cleanText(merged.source_month, 20) || startTime.slice(0, 7),
    raw_payload: merged,
    updated_at: new Date().toISOString()
  };
}

function normalizeDetails(event, eventId, metadata = {}) {
  if (!event.details) return null;
  const sportType = normalizeSportType(event.details.sport_type || event.sport_type || metadata.sport_type || "baseball");
  const detailStatus = cleanText(event.details.detail_status || "pre_game_synced", 80).toLowerCase();
  const syncPhase = cleanText(event.details.sync_phase || "manual", 80).toLowerCase();
  if (!VALID_DETAIL_STATUSES.has(detailStatus)) throw new Error(`detail_status is invalid: ${detailStatus}`);
  if (syncPhase && !VALID_SYNC_PHASES.has(syncPhase)) throw new Error(`sync_phase is invalid: ${syncPhase}`);
  const details = event.details.details && typeof event.details.details === "object"
    ? { ...event.details.details }
    : { ...event.details };
  delete details.sport_type;
  delete details.detail_status;
  delete details.sync_phase;
  delete details.source_name;
  delete details.source_url;
  delete details.source_updated_at;
  delete details.last_synced_at;
  delete details.raw_payload;

  const sourceUrl = cleanText(event.details.source_url || details.source_url || metadata.source_url, 1000) || null;
  if (sourceUrl && !details.source_url) details.source_url = sourceUrl;
  return {
    event_id: eventId,
    sport_type: sportType,
    detail_status: detailStatus,
    sync_phase: syncPhase || null,
    details,
    source_url: sourceUrl,
    source_name: cleanText(event.details.source_name || metadata.source_name, 240) || null,
    source_updated_at: event.details.source_updated_at
      ? normalizeDateTime(event.details.source_updated_at, "source_updated_at", { required: false })
      : null,
    last_synced_at: event.details.last_synced_at
      ? normalizeDateTime(event.details.last_synced_at, "last_synced_at", { required: false })
      : new Date().toISOString(),
    raw_payload: event.details.raw_payload === undefined ? event.details : event.details.raw_payload,
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

function findJsonFiles(inputPath) {
  const sourcePath = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(sourcePath)) throw new Error(`Path not found: ${sourcePath}`);
  const stat = fs.statSync(sourcePath);
  if (stat.isFile()) return [sourcePath];

  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("example-")) {
        files.push(fullPath);
      }
    }
  }
  walk(sourcePath);
  return files.sort();
}

function summarizeFile(sourcePath, metadata, events, detailsCount, importedCount) {
  const sport = metadata.sport_type || events[0]?.sport_type || "mixed";
  const league = metadata.league || events[0]?.league || "-";
  return {
    file: getSourceFile(sourcePath),
    sport,
    league,
    events: events.length,
    imported: importedCount,
    details: detailsCount
  };
}

async function importFile(sourcePath) {
  const { metadata, events: rawEvents } = readSportsFile(sourcePath);
  if (!rawEvents.length) return summarizeFile(sourcePath, metadata, [], 0, 0);

  const events = rawEvents.map((event) => normalizeEvent(event, sourcePath, metadata));
  const imported = await supabaseRequest("sports_events", "select=*&on_conflict=event_key", {
    method: "POST",
    prefer: "return=representation,resolution=merge-duplicates",
    body: events
  });

  const importedByKey = new Map(imported.map((event) => [event.event_key, event]));
  const detailPayloads = [];
  rawEvents.forEach((rawEvent, index) => {
    const importedEvent = importedByKey.get(events[index].event_key);
    if (!importedEvent?.id) return;
    const detail = normalizeDetails(rawEvent, importedEvent.id, metadata);
    if (detail) detailPayloads.push(detail);
  });

  if (detailPayloads.length) {
    await supabaseRequest("sports_event_details", "select=*&on_conflict=event_id", {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: detailPayloads
    });
  }

  await supabaseRequest("sports_import_batches", "select=*", {
    method: "POST",
    body: {
      source_file: getSourceFile(sourcePath),
      source_month: metadata.source_month || events[0]?.source_month || null,
      source_name: metadata.source_name || events[0]?.source_name || null,
      imported_count: imported.length,
      skipped_count: Math.max(0, events.length - imported.length),
      status: "completed",
      message: `Imported ${imported.length} sports events and ${detailPayloads.length} details`
    }
  }).catch((error) => {
    console.warn(`Import batch log skipped for ${getSourceFile(sourcePath)}: ${error.message}`);
  });

  return summarizeFile(sourcePath, metadata, events, detailPayloads.length, imported.length);
}

async function main() {
  loadDotEnvLocal();
  const sourceArg = process.argv[2] || DEFAULT_SOURCE;
  const sourcePath = sourceArg === "--all" ? DEFAULT_FOLDER : sourceArg;
  const files = findJsonFiles(sourcePath);
  if (!files.length) {
    console.log("No sports JSON files to import.");
    return;
  }

  const summaries = [];
  for (const file of files) {
    try {
      const summary = await importFile(file);
      summaries.push(summary);
      console.log(`${summary.file}: imported ${summary.imported}/${summary.events} events, ${summary.details} details (${summary.sport}/${summary.league})`);
    } catch (error) {
      throw new Error(`${getSourceFile(file)} failed: ${error.message}`);
    }
  }

  const totals = summaries.reduce((acc, item) => {
    acc.events += item.imported;
    acc.details += item.details;
    acc.files += 1;
    acc.bySport[item.sport] = (acc.bySport[item.sport] || 0) + item.imported;
    return acc;
  }, { files: 0, events: 0, details: 0, bySport: {} });
  console.log(`Total: ${totals.events} events, ${totals.details} details from ${totals.files} files.`);
  console.log(`By sport: ${JSON.stringify(totals.bySport)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
