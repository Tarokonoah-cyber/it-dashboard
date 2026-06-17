const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_LIMIT = 50;
const REQUEST_TIMEOUT_MS = 12000;
const REQUEST_DELAY_MS = 500;
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
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return taipeiDate(date);
}

function dayStartIso(dateKey) {
  return new Date(`${dateKey}T00:00:00+08:00`).toISOString();
}

function dayAfterIso(dateKey) {
  return dayStartIso(addDays(dateKey, 1));
}

function parseArgs(argv) {
  const today = taipeiDate();
  const args = {
    payload: "",
    phase: "manual",
    dryRun: false,
    force: false,
    sport: "",
    leagues: [],
    from: addDays(today, -1),
    to: addDays(today, 2),
    limit: DEFAULT_LIMIT
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const [rawKey, inlineValue] = arg.startsWith("--") ? arg.split(/=(.*)/s).filter(Boolean) : [arg, null];
    const nextValue = () => inlineValue !== null && inlineValue !== undefined ? inlineValue : argv[++index] || "";
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force") args.force = true;
    else if (rawKey === "--payload") args.payload = nextValue();
    else if (rawKey === "--phase") args.phase = nextValue() || "manual";
    else if (rawKey === "--sport") args.sport = nextValue().toLowerCase();
    else if (rawKey === "--league") args.leagues = nextValue().split(",").map((item) => item.trim()).filter(Boolean);
    else if (rawKey === "--from") args.from = nextValue();
    else if (rawKey === "--to") args.to = nextValue();
    else if (rawKey === "--limit") args.limit = Math.max(1, Math.min(200, Number(nextValue()) || DEFAULT_LIMIT));
    else if (!arg.startsWith("--") && !args.payload) args.payload = arg;
  }

  return args;
}

function cleanText(value, maxLength = 1000) {
  const text = String(value || "").trim();
  if (text.length > maxLength) throw new Error(`Text must be ${maxLength} characters or less`);
  return text;
}

function isBadText(value) {
  const text = cleanText(value);
  return !text || /^\?+$/.test(text) || text.includes("????") || /�/.test(text);
}

function safeText(value, maxLength = 1000) {
  const text = cleanText(value, maxLength);
  return isBadText(text) ? "" : text;
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

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function eventSourceUrl(event) {
  return event.raw_payload?.source_url
    || event.detail?.source_url
    || event.detail?.details?.source_url
    || event.detail?.details?.box_url
    || "";
}

function parseCpblBoxUrl(url) {
  const parsed = new URL(url);
  return {
    year: parsed.searchParams.get("year") || "",
    kindCode: parsed.searchParams.get("kindCode") || "",
    gameSno: parsed.searchParams.get("gameSno") || ""
  };
}

function formValue(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`name=["']${escaped}["'][^>]*value=["']([^"']*)["']`, "i"));
  return match ? match[1] : "";
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function firstPitcherFromStarterHtml(value, label) {
  const decoded = decodeURIComponent(String(value || ""));
  const text = stripHtml(decoded);
  const match = text.match(new RegExp(`${label}先發[：:]\\s*([^\\s　，,。；;、]+)`));
  return safeText(match?.[1] || "", 160);
}

function extractStarterFromXweData(xweData, key, label) {
  if (!xweData) return "";
  try {
    const parsed = JSON.parse(xweData);
    const custData = JSON.parse(parsed.CustData || "[]");
    for (const item of custData) {
      const value = item?.main_data?.[key];
      const name = firstPitcherFromStarterHtml(value, label);
      if (name) return name;
    }
  } catch {
    return "";
  }
  return "";
}

function cpblStatus(value) {
  const status = Number(value);
  if (status === 3) return { eventStatus: "completed", detailStatus: "post_game_synced", scoreStatus: "final" };
  if (status === 2) return { eventStatus: "live", detailStatus: "pre_game_synced", scoreStatus: "live" };
  if (status === 4) return { eventStatus: "postponed", detailStatus: "pre_game_synced", scoreStatus: "postponed" };
  if (status === 5) return { eventStatus: "cancelled", detailStatus: "pre_game_synced", scoreStatus: "cancelled" };
  return { eventStatus: "scheduled", detailStatus: "pre_game_synced", scoreStatus: "scheduled" };
}

async function fetchCpblDetails(event, args = {}) {
  const sourceUrl = eventSourceUrl(event);
  if (!sourceUrl) throw new Error("CPBL event has no source URL");
  const { year, kindCode, gameSno } = parseCpblBoxUrl(sourceUrl);
  if (!year || !kindCode || !gameSno) throw new Error(`CPBL source URL is missing year/kindCode/gameSno: ${sourceUrl}`);

  const pageResponse = await fetchWithTimeout(sourceUrl, { headers: { "User-Agent": "SportsCalendarSync/1.0" } });
  const pageHtml = await pageResponse.text();
  if (!pageResponse.ok) throw new Error(`CPBL box page HTTP ${pageResponse.status}`);
  const token = formValue(pageHtml, "__RequestVerificationToken");
  const body = new URLSearchParams({
    __RequestVerificationToken: token,
    GameSno: gameSno,
    KindCode: kindCode,
    Year: year,
    PrevOrNext: "",
    PresentStatus: ""
  });

  await delay(REQUEST_DELAY_MS);
  const liveResponse = await fetchWithTimeout("https://www.cpbl.com.tw/box/getlive", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "SportsCalendarSync/1.0",
      Referer: sourceUrl
    },
    body
  });
  const liveText = await liveResponse.text();
  if (!liveResponse.ok) throw new Error(`CPBL getlive HTTP ${liveResponse.status}`);
  const payload = JSON.parse(liveText);
  if (!payload.Success) throw new Error("CPBL getlive returned Success=false");
  const current = JSON.parse(payload.CurtGameDetailJson || "{}");
  const status = cpblStatus(current.GameStatus);
  const awayPitcher = safeText(current.VisitingFirstMover, 160) || extractStarterFromXweData(current.XweData, "visiting-starter", "客隊");
  const homePitcher = safeText(current.HomeFirstMover, 160) || extractStarterFromXweData(current.XweData, "home-starter", "主隊");
  const weatherSummary = safeText(current.WeatherDesc || current.Weather, 500);
  const awayScore = current.VisitingTotalScore ?? current.VisitingScore ?? null;
  const homeScore = current.HomeTotalScore ?? current.HomeScore ?? null;
  const syncedAt = new Date().toISOString();

  return buildBaseballDetailPayload(event, {
    provider: "CPBL official /box/getlive",
    sourceUrl,
    sourceName: "CPBL official box/getlive",
    detailStatus: status.detailStatus,
    scoreStatus: status.scoreStatus,
    awayPitcher,
    homePitcher,
    weatherSummary,
    awayScore,
    homeScore,
    reasons: syncReasons(event, { force: args.force, hasPitchers: Boolean(awayPitcher || homePitcher), hasWeather: Boolean(weatherSummary), hasScore: awayScore !== null && homeScore !== null }),
    limitations: [],
    syncedAt,
    rawPayload: {
      gameStatus: current.GameStatus,
      gameStatusChi: current.GameStatusChi,
      weatherCode: current.WeatherCode,
      cpblFields: {
        VisitingFirstMover: current.VisitingFirstMover,
        HomeFirstMover: current.HomeFirstMover,
        WeatherDesc: current.WeatherDesc
      }
    }
  });
}

function npbStatus(event, details) {
  const score = details.final_score || details.score || {};
  const hasScore = score.away !== null && score.away !== undefined && score.home !== null && score.home !== undefined;
  const status = event.status === "completed" || hasScore ? "final" : event.status || "scheduled";
  const detailStatus = status === "final" ? "post_game_synced" : "not_announced";
  return { status, detailStatus, hasScore };
}

async function fetchNpbDetails(event, args = {}) {
  const existing = event.detail?.details || {};
  const sourceUrl = eventSourceUrl(event) || "https://npb.jp/games/2026/schedule_06_detail.html";
  const scoreSource = existing.score || existing.final_score || {};
  const scoreState = npbStatus(event, existing);
  const syncedAt = new Date().toISOString();
  return buildBaseballDetailPayload(event, {
    provider: "NPB.jp official schedule/results",
    sourceUrl,
    sourceName: "NPB.jp official schedule/results",
    detailStatus: scoreState.detailStatus,
    scoreStatus: scoreState.status,
    awayPitcher: "",
    homePitcher: "",
    weatherSummary: "",
    awayScore: scoreSource.away ?? null,
    homeScore: scoreSource.home ?? null,
    reasons: syncReasons(event, { force: args.force, hasPitchers: false, hasWeather: false, hasScore: scoreState.hasScore }),
    limitations: ["NPB official schedule/results page used here does not expose a stable probable-starting-pitcher field."],
    syncedAt,
    rawPayload: {
      source_note: existing.source_note || null,
      venue: event.venue || null
    }
  });
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function detailHasFinalScore(details) {
  const score = details?.score || details?.final_score || {};
  return (score.status === "final" || score.status === "completed")
    && score.away !== null && score.away !== undefined
    && score.home !== null && score.home !== undefined;
}

function shouldSkip(event, force) {
  if (force) return false;
  return event.status === "completed" && detailHasFinalScore(event.detail?.details);
}

function syncReasons(event, flags = {}) {
  const reasons = new Set();
  const now = Date.now();
  const start = new Date(event.start_time).getTime();
  const hours = (start - now) / 36e5;
  const eventDate = taipeiDate(new Date(event.start_time));
  const today = taipeiDate();
  if (flags.force) reasons.add("force");
  if (eventDate === today) reasons.add("upcoming_today");
  if (hours >= 0 && hours <= 6) reasons.add("within_6_hours");
  if (hours >= 0 && hours <= 3) reasons.add("within_3_hours");
  if (hours >= 0 && hours <= 1) reasons.add("within_1_hour");
  if (!flags.hasPitchers) reasons.add("missing_starting_pitchers");
  if (!flags.hasWeather) reasons.add("missing_weather");
  if (!flags.hasScore) reasons.add("missing_final_score");
  if (eventDate === addDays(today, -1) && event.status !== "completed") reasons.add("not_final_yesterday");
  if (event.status === "postponed") reasons.add("postponed_check");
  return [...reasons];
}

function buildBaseballDetailPayload(event, input) {
  const awayPitcher = safeText(input.awayPitcher, 160);
  const homePitcher = safeText(input.homePitcher, 160);
  const weatherSummary = safeText(input.weatherSummary, 500);
  const awayScore = numberOrNull(input.awayScore);
  const homeScore = numberOrNull(input.homeScore);
  const sourceUrl = input.sourceUrl || eventSourceUrl(event) || null;
  const details = {
    starting_pitchers: {
      away: awayPitcher ? { name: awayPitcher, team: event.away_team || "" } : null,
      home: homePitcher ? { name: homePitcher, team: event.home_team || "" } : null
    },
    score: {
      away: awayScore,
      home: homeScore,
      status: input.scoreStatus || event.status || "scheduled"
    },
    weather: weatherSummary ? { summary: weatherSummary } : null,
    sync: {
      provider: input.provider,
      synced_at: input.syncedAt,
      reasons: input.reasons || [],
      limitations: input.limitations || []
    },
    probable_pitchers: {
      away: awayPitcher ? { name: awayPitcher, team: event.away_team || "" } : null,
      home: homePitcher ? { name: homePitcher, team: event.home_team || "" } : null,
      status: awayPitcher || homePitcher ? "announced" : "尚未公布"
    },
    final_score: awayScore !== null || homeScore !== null ? {
      away: awayScore,
      home: homeScore,
      status: input.scoreStatus || event.status || "scheduled"
    } : null,
    box_url: sourceUrl,
    source_url: sourceUrl
  };

  return {
    event_id: event.id,
    sport_type: "baseball",
    detail_status: input.detailStatus || "pre_game_synced",
    sync_phase: "manual",
    details,
    source_url: sourceUrl,
    source_name: input.sourceName,
    source_updated_at: null,
    last_synced_at: input.syncedAt,
    raw_payload: input.rawPayload || null,
    updated_at: new Date().toISOString()
  };
}

async function fetchEvents(args) {
  if (args.sport !== "baseball") throw new Error("This sync currently supports --sport=baseball only");
  const leagues = args.leagues.filter((league) => ["CPBL", "NPB"].includes(league));
  if (!leagues.length) throw new Error("Use --league=CPBL,NPB or one of those leagues. MLB is intentionally not handled here.");
  const query = [
    "select=id,event_key,title,sport_type,league,away_team,home_team,start_time,venue,status,source_name,source_type,source_file,source_month,raw_payload",
    "sport_type=eq.baseball",
    `league=in.(${leagues.join(",")})`,
    `start_time=gte.${encodeURIComponent(dayStartIso(args.from))}`,
    `start_time=lt.${encodeURIComponent(dayAfterIso(args.to))}`,
    "order=start_time.asc",
    `limit=${args.limit}`
  ].join("&");
  const events = await supabaseRequest("sports_events", query);
  if (!events.length) return [];
  const ids = events.map((event) => event.id).join(",");
  const details = await supabaseRequest("sports_event_details", `select=*&event_id=in.(${ids})&limit=${args.limit}`);
  const detailMap = new Map(details.map((detail) => [detail.event_id, detail]));
  return events.map((event) => ({ ...event, detail: detailMap.get(event.id) || null }));
}

async function syncLeagueEvent(event, args) {
  if (event.league === "CPBL") return fetchCpblDetails(event, args);
  if (event.league === "NPB") return fetchNpbDetails(event, args);
  throw new Error(`Unsupported league: ${event.league}`);
}

async function runSportsSync(args) {
  const events = await fetchEvents(args);
  const selected = events.filter((event) => !shouldSkip(event, args.force)).slice(0, args.limit);
  const results = [];
  for (const event of selected) {
    try {
      const detail = await syncLeagueEvent(event, args);
      results.push({ event, detail, action: args.dryRun ? "dry-run" : "upsert" });
      if (!args.dryRun) {
        await supabaseRequest("sports_event_details", "select=*&on_conflict=event_id", {
          method: "POST",
          prefer: "return=representation,resolution=merge-duplicates",
          body: [detail]
        });
      }
      await delay(REQUEST_DELAY_MS);
    } catch (error) {
      results.push({ event, error: error.message, action: "error" });
    }
  }
  const summary = {
    dryRun: args.dryRun,
    sport: args.sport,
    leagues: args.leagues,
    from: args.from,
    to: args.to,
    found: events.length,
    skipped: events.length - selected.length,
    processed: selected.length,
    upserted: args.dryRun ? 0 : results.filter((item) => item.detail && !item.error).length,
    errors: results.filter((item) => item.error).length,
    results: results.map((item) => ({
      action: item.action,
      event_key: item.event.event_key,
      league: item.event.league,
      title: item.event.title,
      start_time: item.event.start_time,
      detail_status: item.detail?.detail_status,
      starting_pitchers: item.detail?.details?.starting_pitchers,
      weather: item.detail?.details?.weather,
      score: item.detail?.details?.score,
      sync: item.detail?.details?.sync,
      error: item.error
    }))
  };
  console.log(JSON.stringify(summary, null, 2));
}

async function runPayloadImport(args) {
  if (!args.payload) {
    console.log("Usage:");
    console.log("  node scripts/syncSportsDetails.js --sport=baseball --league=CPBL,NPB [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--dry-run] [--force] [--limit=50]");
    console.log("  node scripts/syncSportsDetails.js --payload sports-data/parsed/details-example.json --phase pre_game_3h [--dry-run]");
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

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  if (args.sport || args.leagues.length) await runSportsSync(args);
  else await runPayloadImport(args);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
