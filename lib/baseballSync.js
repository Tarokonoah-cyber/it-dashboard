const SEASON = 2026;
const REQUEST_TIMEOUT_MS = 15000;
const REQUEST_DELAY_MS = 500;

const LEAGUES = ["MLB", "NPB", "CPBL"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function taipeiDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value instanceof Date ? value : new Date(value));
}

function isoNow() {
  return new Date().toISOString();
}

function seasonDateRange(year = SEASON) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`
  };
}

function monthKey(date) {
  return taipeiDate(date).slice(0, 7);
}

function toIso(value, zone = "+08:00") {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00${zone}`).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function text(value) {
  return String(value ?? "").trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function statusToDb(value) {
  const raw = text(value).toLowerCase();
  if (["final", "completed", "game over"].includes(raw)) return "completed";
  if (["live", "in progress", "warmup"].includes(raw)) return "live";
  if (["postponed", "suspended"].includes(raw)) return "postponed";
  if (["cancelled", "canceled", "cancel"].includes(raw)) return "cancelled";
  return "scheduled";
}

function scoreStatus(status) {
  if (status === "completed") return "final";
  if (status === "cancelled") return "canceled";
  return status;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "SportsCalendarBaseballSync/1.0",
        ...(options.headers || {})
      }
    });
    return response;
  } catch (error) {
    const cause = error.cause;
    const parts = [
      error.name || "FetchError",
      error.message,
      cause?.code,
      cause?.message
    ].filter(Boolean);
    throw new Error(`${url}: ${parts.join(" | ")}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  const data = await response.json().catch((error) => {
    throw new Error(`${url}: parser failed | ${error.message}`);
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} ${response.statusText}`);
  return data;
}

async function fetchText(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  const body = await response.text();
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} ${response.statusText}`);
  return body;
}

function stripHtml(html) {
  return text(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function eventTitle(away, home) {
  return `${away} @ ${home}`;
}

function detailFor(event, input) {
  const lastSyncedAt = input.lastSyncedAt || isoNow();
  const awayScore = numberOrNull(input.awayScore);
  const homeScore = numberOrNull(input.homeScore);
  const hasScore = awayScore !== null && homeScore !== null;
  const score = {
    away: awayScore,
    home: homeScore,
    status: input.scoreStatus || scoreStatus(event.status)
  };
  const finalScore = hasScore ? score : null;

  return {
    sport_type: "baseball",
    detail_status: event.status === "completed" ? "post_game_synced" : event.status === "scheduled" ? "pre_game_synced" : "pre_game_synced",
    sync_phase: event.status === "completed" ? "post_game" : event.status === "scheduled" ? "schedule" : "manual",
    source_url: event.source_url,
    source_name: event.source_name,
    last_synced_at: lastSyncedAt,
    details: {
      starting_pitchers: input.startingPitchers || { away: null, home: null },
      probable_pitchers: input.probablePitchers || { away: null, home: null, status: "尚未公布" },
      weather: input.weather || null,
      score,
      final_score: finalScore,
      box_url: event.source_url,
      source_url: event.source_url,
      source: event.source_name,
      lastSyncedAt,
      sync: {
        provider: input.provider,
        synced_at: lastSyncedAt,
        errors: input.errors || [],
        limitations: input.limitations || []
      }
    },
    raw_payload: input.rawPayload || null
  };
}

function buildEvent(base, detailInput) {
  const lastSyncedAt = detailInput.lastSyncedAt || isoNow();
  const event = {
    event_key: base.event_key,
    title: eventTitle(base.away_team, base.home_team),
    sport_type: "baseball",
    league: base.league,
    away_team: base.away_team,
    home_team: base.home_team,
    start_time: base.start_time,
    end_time: base.end_time || null,
    venue: base.venue || null,
    status: base.status,
    importance: "normal",
    source_type: base.source_type,
    source_name: base.source_name,
    source_url: base.source_url,
    source_month: monthKey(base.start_time),
    raw_payload: {
      ...(base.raw_payload || {}),
      source: base.source_name,
      lastSyncedAt
    },
    updated_at: lastSyncedAt
  };
  event.details = detailFor(event, { ...detailInput, lastSyncedAt });
  return event;
}

function mlbStatus(game) {
  return statusToDb(game.status?.detailedState || game.status?.abstractGameState);
}

export async function fetchMlbEvents({ year = SEASON, lastSyncedAt = isoNow() } = {}) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${year}&startDate=${year}-01-01&endDate=${year}-12-31&hydrate=team,venue,linescore`;
  const payload = await fetchJson(url);
  const events = [];
  for (const date of payload.dates || []) {
    for (const game of date.games || []) {
      const away = game.teams?.away || {};
      const home = game.teams?.home || {};
      const status = mlbStatus(game);
      const sourceUrl = `https://www.mlb.com/gameday/${game.gamePk}`;
      events.push(buildEvent({
        event_key: `mlb-${game.gamePk}`,
        league: "MLB",
        away_team: away.team?.name,
        home_team: home.team?.name,
        start_time: game.gameDate,
        venue: game.venue?.name,
        status,
        source_type: "official_api",
        source_name: "MLB Stats API schedule",
        source_url: sourceUrl,
        raw_payload: {
          gamePk: game.gamePk,
          status: game.status,
          officialDate: game.officialDate
        }
      }, {
        provider: "MLB Stats API schedule",
        awayScore: away.score,
        homeScore: home.score,
        scoreStatus: scoreStatus(status),
        lastSyncedAt,
        rawPayload: game
      }));
    }
  }
  return { league: "MLB", source: url, events };
}

function cpblDbStatus(game) {
  if (String(game.IsGameStop) === "1") return "cancelled";
  if (Number(game.PresentStatus) === 1) return "completed";
  if (Number(game.PresentStatus) === 2) return "live";
  if (Number(game.PresentStatus) === 4) return "postponed";
  return "scheduled";
}

async function getCpblScheduleToken() {
  const page = await fetchText("https://www.cpbl.com.tw/schedule");
  const tokens = [...page.matchAll(/RequestVerificationToken: '([^']+)'/g)].map((match) => match[1]);
  if (!tokens.length) throw new Error("CPBL schedule RequestVerificationToken not found");
  return tokens[0];
}

export async function fetchCpblEvents({ year = SEASON, lastSyncedAt = isoNow() } = {}) {
  const token = await getCpblScheduleToken();
  await sleep(REQUEST_DELAY_MS);
  const body = new URLSearchParams({ calendar: `${year}/01/01`, location: "", kindCode: "A" });
  const response = await fetchWithTimeout("https://www.cpbl.com.tw/schedule/getgamedatas", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      RequestVerificationToken: token,
      Referer: "https://www.cpbl.com.tw/schedule",
      "X-Requested-With": "XMLHttpRequest"
    },
    body
  });
  const payload = await response.json();
  if (!response.ok || !payload.Success) throw new Error(`CPBL schedule/getgamedatas failed | HTTP ${response.status} ${response.statusText}`);
  const games = JSON.parse(payload.GameDatas || "[]");
  const events = games.map((game) => {
    const status = cpblDbStatus(game);
    const sourceUrl = `https://www.cpbl.com.tw/box?year=${game.Year}&kindCode=${game.KindCode}&gameSno=${game.GameSno}`;
    const start = toIso(game.PreExeDate || game.GameDateTimeS, "+08:00");
    return buildEvent({
      event_key: `cpbl-${game.Year}-${game.KindCode}-${game.GameSno}-${taipeiDate(start).replace(/-/g, "")}`,
      league: "CPBL",
      away_team: game.VisitingTeamName,
      home_team: game.HomeTeamName,
      start_time: start,
      end_time: toIso(game.GameDateTimeE, "+08:00"),
      venue: game.FieldAbbe,
      status,
      source_type: "official_endpoint",
      source_name: "CPBL official schedule/getgamedatas",
      source_url: sourceUrl,
      raw_payload: game
    }, {
      provider: "CPBL official schedule/getgamedatas",
      awayScore: game.VisitingScore,
      homeScore: game.HomeScore,
      scoreStatus: scoreStatus(status),
      startingPitchers: {
        away: game.VisitingPitcherName ? { name: game.VisitingPitcherName, team: game.VisitingTeamName } : null,
        home: game.HomePitcherName ? { name: game.HomePitcherName, team: game.HomeTeamName } : null
      },
      probablePitchers: {
        away: game.VisitingPitcherName ? { name: game.VisitingPitcherName, team: game.VisitingTeamName } : null,
        home: game.HomePitcherName ? { name: game.HomePitcherName, team: game.HomeTeamName } : null,
        status: game.VisitingPitcherName || game.HomePitcherName ? "announced" : "尚未公布"
      },
      lastSyncedAt,
      rawPayload: game
    });
  });
  return { league: "CPBL", source: "https://www.cpbl.com.tw/schedule/getgamedatas", events };
}

const NPB_MONTHS = ["03", "04", "05", "06", "07", "08", "09", "10", "11"];

function parseNpbRows(html, year, month, sourceUrl, lastSyncedAt) {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] || "";
  const rows = [...tbody.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)];
  const events = [];
  let currentDate = "";
  for (const row of rows) {
    const rowHtml = row[2];
    const dateMatch = rowHtml.match(/<th[^>]*>(\d{1,2})\/(\d{1,2})/);
    if (dateMatch) currentDate = `${year}-${String(Number(dateMatch[1])).padStart(2, "0")}-${String(Number(dateMatch[2])).padStart(2, "0")}`;
    if (!currentDate || !rowHtml.includes("team1")) continue;
    const team1 = stripHtml(rowHtml.match(/<div class="team1">([\s\S]*?)<\/div>/)?.[1]);
    const team2 = stripHtml(rowHtml.match(/<div class="team2">([\s\S]*?)<\/div>/)?.[1]);
    if (!team1 || !team2) continue;
    const href = rowHtml.match(/<a href="([^"]+)"/)?.[1] || "";
    const place = stripHtml(rowHtml.match(/<div class="place">([\s\S]*?)<\/div>/)?.[1]);
    const gameTime = stripHtml(rowHtml.match(/<div class="time">([\s\S]*?)<\/div>/)?.[1]);
    const note = stripHtml(rowHtml.match(/<div class="comment">([\s\S]*?)<\/div>/)?.[1]);
    const score1 = numberOrNull(stripHtml(rowHtml.match(/<div class="score1">([\s\S]*?)<\/div>/)?.[1]));
    const score2 = numberOrNull(stripHtml(rowHtml.match(/<div class="score2">([\s\S]*?)<\/div>/)?.[1]));
    const cancelled = /中止|ノーゲーム|取消/.test(note);
    const status = cancelled ? "cancelled" : score1 !== null && score2 !== null ? "completed" : "scheduled";
    const startTime = gameTime && gameTime !== "-" ? toIso(`${currentDate}T${gameTime}:00+09:00`) : toIso(currentDate, "+09:00");
    const gameId = href ? href.replace(/^\/scores\/|\/$/g, "").replace(/\//g, "-") : `${currentDate}-${team1}-${team2}`;
    const fullSource = href ? new URL(href, "https://npb.jp").toString() : sourceUrl;
    events.push(buildEvent({
      event_key: `npb-${gameId}`,
      league: "NPB",
      away_team: team2,
      home_team: team1,
      start_time: startTime,
      venue: place,
      status,
      source_type: "official_html",
      source_name: "NPB.jp official schedule/results",
      source_url: fullSource,
      raw_payload: { note, sourceMonth: `${year}-${month}`, row: stripHtml(rowHtml) }
    }, {
      provider: "NPB.jp official schedule/results",
      awayScore: score2,
      homeScore: score1,
      scoreStatus: scoreStatus(status),
      lastSyncedAt,
      limitations: ["NPB monthly schedule page does not provide stable weather or probable pitcher fields."],
      rawPayload: { note, html: rowHtml }
    }));
  }
  return events;
}

export async function fetchNpbEvents({ year = SEASON, lastSyncedAt = isoNow() } = {}) {
  const events = [];
  const errors = [];
  for (const month of NPB_MONTHS) {
    const sourceUrl = `https://npb.jp/games/${year}/schedule_${month}_detail.html`;
    try {
      const html = await fetchText(sourceUrl);
      events.push(...parseNpbRows(html, year, month, sourceUrl, lastSyncedAt));
    } catch (error) {
      errors.push({ month, error: error.message });
    }
    await sleep(REQUEST_DELAY_MS);
  }
  if (!events.length) throw new Error(`NPB schedule returned no events: ${JSON.stringify(errors)}`);
  return { league: "NPB", source: "https://npb.jp/games/2026/", events, errors };
}

async function supabaseRequest(table, query, options = {}) {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    const missing = [
      !url ? "SUPABASE_URL" : "",
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""
    ].filter(Boolean);
    throw new Error(`missing env: ${missing.join(", ")}`);
  }
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
  const body = await response.text();
  const data = body ? JSON.parse(body) : [];
  if (!response.ok) throw new Error(data.message || body || `Supabase ${table} HTTP ${response.status} ${response.statusText}`);
  return data;
}

function normalizeEventForDb(event) {
  return {
    event_key: event.event_key,
    title: event.title,
    sport_type: event.sport_type,
    league: event.league,
    home_team: event.home_team,
    away_team: event.away_team,
    start_time: event.start_time,
    end_time: event.end_time,
    venue: event.venue,
    status: event.status,
    importance: event.importance || "normal",
    notes: null,
    source_type: event.source_type,
    source_name: event.source_name,
    source_file: null,
    source_month: event.source_month,
    raw_payload: event.raw_payload,
    updated_at: event.updated_at
  };
}

function normalizeDetailForDb(event, importedEvent) {
  if (!importedEvent?.id) return null;
  return {
    event_id: importedEvent.id,
    sport_type: "baseball",
    detail_status: event.details.detail_status,
    sync_phase: event.details.sync_phase,
    details: event.details.details,
    source_url: event.details.source_url,
    source_name: event.details.source_name,
    source_updated_at: null,
    last_synced_at: event.details.last_synced_at,
    raw_payload: event.details.raw_payload,
    updated_at: event.details.last_synced_at
  };
}

function validateEvents(events, lastSyncedAt) {
  const failures = [];
  for (const event of events) {
    const score = event.details?.details?.score || {};
    if (!event.away_team || !event.home_team) failures.push(`${event.event_key}: missing team`);
    if (!event.start_time) failures.push(`${event.event_key}: missing start_time`);
    if (event.status === "completed" && (score.away === null || score.home === null)) failures.push(`${event.event_key}: completed without score`);
    if (event.details?.last_synced_at !== lastSyncedAt) failures.push(`${event.event_key}: stale lastSyncedAt`);
  }
  return failures;
}

async function upsertEvents(events) {
  const imported = [];
  for (let index = 0; index < events.length; index += 500) {
    const chunk = events.slice(index, index + 500);
    imported.push(...await supabaseRequest("sports_events", "select=*&on_conflict=event_key", {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: chunk.map(normalizeEventForDb)
    }));
  }
  const byKey = new Map(imported.map((event) => [event.event_key, event]));
  const details = events.map((event) => normalizeDetailForDb(event, byKey.get(event.event_key))).filter((row) => row?.event_id);
  for (let index = 0; index < details.length; index += 500) {
    await supabaseRequest("sports_event_details", "select=*&on_conflict=event_id", {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: details.slice(index, index + 500)
    });
  }
  return { imported: imported.length, details: details.length };
}

async function fetchLeague(league, options) {
  if (league === "MLB") return fetchMlbEvents(options);
  if (league === "NPB") return fetchNpbEvents(options);
  if (league === "CPBL") return fetchCpblEvents(options);
  throw new Error(`Unsupported league: ${league}`);
}

export async function syncBaseball({ leagues = LEAGUES, year = SEASON, dryRun = false } = {}) {
  const selected = leagues.map((league) => text(league).toUpperCase()).filter((league) => LEAGUES.includes(league));
  const lastSyncedAt = isoNow();
  const startedAt = lastSyncedAt;
  const dateRange = seasonDateRange(year);
  const response = {
    ok: true,
    dryRun,
    year,
    startedAt,
    finishedAt: null,
    lastSyncedAt,
    leagues: {}
  };

  for (const league of selected) {
    const leagueStartedAt = isoNow();
    try {
      const result = await fetchLeague(league, { year, lastSyncedAt });
      const validationFailures = validateEvents(result.events, lastSyncedAt);
      if (validationFailures.length) throw new Error(`validation failed: ${validationFailures.slice(0, 10).join("; ")}`);
      const upserted = dryRun ? { imported: 0, details: 0 } : await upsertEvents(result.events);
      response.leagues[league] = {
        league,
        attempted: true,
        success: true,
        ok: true,
        source: result.source,
        dateRange,
        fetchedCount: result.events.length,
        count: result.events.length,
        upsertedEvents: upserted.imported,
        upsertedDetails: upserted.details,
        upserted,
        skipped: dryRun ? result.events.length : 0,
        errors: result.errors || [],
        startedAt: leagueStartedAt,
        finishedAt: isoNow(),
        lastSyncedAt
      };
    } catch (error) {
      response.ok = false;
      response.leagues[league] = {
        league,
        attempted: true,
        success: false,
        ok: false,
        source: null,
        dateRange,
        fetchedCount: 0,
        count: 0,
        upsertedEvents: 0,
        upsertedDetails: 0,
        upserted: { imported: 0, details: 0 },
        skipped: 0,
        errors: [error.message],
        error: error.message,
        startedAt: leagueStartedAt,
        finishedAt: isoNow(),
        lastSyncedAt
      };
    }
  }

  response.finishedAt = isoNow();
  return response;
}

export { LEAGUES, SEASON };
