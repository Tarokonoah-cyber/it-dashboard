export const SPORT_TYPES = new Set([
  "baseball",
  "football",
  "basketball",
  "cycling",
  "motorsport",
  "tennis",
  "other"
]);

export const EVENT_STATUSES = new Set([
  "scheduled",
  "live",
  "completed",
  "postponed",
  "cancelled"
]);

export const EVENT_IMPORTANCE = new Set([
  "normal",
  "watch",
  "important",
  "must_watch"
]);

export const FAVORITE_TYPES = new Set(["event", "league", "team"]);

export const DETAIL_STATUSES = new Set([
  "not_synced",
  "not_announced",
  "pre_game_synced",
  "waiting_final",
  "post_game_synced"
]);

export const SYNC_PHASES = new Set([
  "schedule",
  "pre_game_3h",
  "pre_game_1h",
  "post_game",
  "manual"
]);

const MAX_TEXT_LENGTH = 1000;

function validationError(message) {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
}

export function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = String(value || "").trim();
  if (text.length > maxLength) {
    throw validationError(`Text must be ${maxLength} characters or less`);
  }
  return text;
}

export function nullableText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = cleanText(value, maxLength);
  return text || null;
}

export function normalizeMonth(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date()).slice(0, 7);
}

export function getTaipeiMonthRange(monthValue) {
  const month = normalizeMonth(monthValue);
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1, -8, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex, 1, -8, 0, 0));
  return {
    month,
    from: start.toISOString(),
    to: end.toISOString()
  };
}

export function normalizeDateTime(value, fieldName = "date") {
  const text = cleanText(value, 120);
  if (!text) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00+08:00`)
    : new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`${fieldName} is invalid`);
  }
  return date.toISOString();
}

export function parseSportTypes(value) {
  const types = String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(types)].filter((type) => SPORT_TYPES.has(type));
}

function keyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "");
}

export function buildEventKey(input) {
  const league = keyPart(input.league || "sports");
  const start = normalizeDateTime(input.start_time, "start_time");
  if (!start) {
    throw validationError("start_time is required");
  }
  const date = start.slice(0, 10);
  const time = start.slice(11, 16).replace(":", "");
  const away = keyPart(input.away_team);
  const home = keyPart(input.home_team);
  const title = keyPart(input.title);
  const matchup = away || home ? `${away || "na"}-${home || "na"}` : title;
  return [league, date, time, matchup || "event"].filter(Boolean).join("-");
}

export function normalizeEventPayload(body, options = {}) {
  const title = cleanText(body.title, 200);
  const sportType = cleanText(body.sport_type, 80).toLowerCase();
  if (!title) {
    throw validationError("title is required");
  }
  if (!SPORT_TYPES.has(sportType)) {
    throw validationError("sport_type is invalid");
  }

  const status = cleanText(body.status || "scheduled", 40).toLowerCase();
  const importance = cleanText(body.importance || "normal", 40).toLowerCase();
  if (!EVENT_STATUSES.has(status)) {
    throw validationError("status is invalid");
  }
  if (!EVENT_IMPORTANCE.has(importance)) {
    throw validationError("importance is invalid");
  }

  const payload = {
    title,
    sport_type: sportType,
    league: nullableText(body.league, 120),
    home_team: nullableText(body.home_team, 160),
    away_team: nullableText(body.away_team, 160),
    start_time: normalizeDateTime(body.start_time, "start_time"),
    end_time: body.end_time ? normalizeDateTime(body.end_time, "end_time") : null,
    venue: nullableText(body.venue, 240),
    status,
    importance,
    notes: nullableText(body.notes),
    source_type: nullableText(body.source_type, 120),
    source_name: nullableText(body.source_name, 240),
    source_file: nullableText(body.source_file, 260),
    source_month: nullableText(body.source_month || normalizeMonth(body.start_time?.slice?.(0, 7)), 20),
    raw_payload: body.raw_payload === undefined ? body : body.raw_payload,
    updated_at: new Date().toISOString()
  };

  if (options.includeCreatedAt) payload.created_at = new Date().toISOString();
  payload.event_key = cleanText(body.event_key, 260) || buildEventKey(payload);
  return payload;
}

export function normalizePatchPayload(body) {
  const allowed = new Set([
    "title",
    "sport_type",
    "league",
    "home_team",
    "away_team",
    "start_time",
    "end_time",
    "venue",
    "status",
    "importance",
    "notes",
    "source_type",
    "source_name",
    "source_file",
    "source_month"
  ]);
  const payload = {};

  for (const key of Object.keys(body || {})) {
    if (!allowed.has(key)) continue;
    if (["title", "league", "home_team", "away_team", "venue", "source_type", "source_name", "source_file", "source_month", "notes"].includes(key)) {
      payload[key] = key === "title" ? cleanText(body[key], 200) : nullableText(body[key], key === "source_file" ? 260 : 1000);
    } else if (key === "sport_type") {
      const sportType = cleanText(body[key], 80).toLowerCase();
      if (!SPORT_TYPES.has(sportType)) throw validationError("sport_type is invalid");
      payload[key] = sportType;
    } else if (key === "status") {
      const status = cleanText(body[key], 40).toLowerCase();
      if (!EVENT_STATUSES.has(status)) throw validationError("status is invalid");
      payload[key] = status;
    } else if (key === "importance") {
      const importance = cleanText(body[key], 40).toLowerCase();
      if (!EVENT_IMPORTANCE.has(importance)) throw validationError("importance is invalid");
      payload[key] = importance;
    } else if (key === "start_time" || key === "end_time") {
      payload[key] = body[key] ? normalizeDateTime(body[key], key) : null;
    }
  }

  if (!Object.keys(payload).length) {
    throw validationError("No supported fields to update");
  }

  payload.updated_at = new Date().toISOString();
  return payload;
}

export function normalizeFavoritePayload(body) {
  const favoriteType = cleanText(body.favorite_type, 40).toLowerCase();
  const favoriteValue = cleanText(body.favorite_value, 260);
  if (!FAVORITE_TYPES.has(favoriteType)) {
    throw validationError("favorite_type is invalid");
  }
  if (!favoriteValue) {
    throw validationError("favorite_value is required");
  }
  return {
    favorite_type: favoriteType,
    favorite_value: favoriteValue,
    display_name: nullableText(body.display_name || favoriteValue, 260),
    metadata: body.metadata || {}
  };
}

function cleanUrl(value, label) {
  const text = cleanText(value, 1000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol");
    return url.toString();
  } catch {
    throw validationError(`${label} must be a valid http or https URL`);
  }
}

function cleanObject(value, label) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw validationError(`${label} must be an object`);
  }
  return value;
}

function normalizePitcher(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return cleanText(value, 160) || null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw validationError("probable pitcher must be a string or object");
  }
  return {
    name: nullableText(value.name, 160),
    throws: nullableText(value.throws, 40),
    source_status: nullableText(value.source_status || value.status, 80)
  };
}

function normalizeBaseballDetails(details) {
  const input = cleanObject(details, "details");
  const probablePitchers = cleanObject(input.probable_pitchers, "probable_pitchers");
  const finalScore = cleanObject(input.final_score, "final_score");
  const weather = cleanObject(input.weather, "weather");
  const awayScore = finalScore.away === undefined || finalScore.away === null || finalScore.away === "" ? null : Number(finalScore.away);
  const homeScore = finalScore.home === undefined || finalScore.home === null || finalScore.home === "" ? null : Number(finalScore.home);
  if (awayScore !== null && Number.isNaN(awayScore)) throw validationError("final_score.away must be a number");
  if (homeScore !== null && Number.isNaN(homeScore)) throw validationError("final_score.home must be a number");

  return {
    ...input,
    probable_pitchers: {
      away: normalizePitcher(probablePitchers.away),
      home: normalizePitcher(probablePitchers.home),
      status: nullableText(probablePitchers.status || input.probable_pitchers_status, 80)
    },
    weather: Object.keys(weather).length ? weather : null,
    final_score: Object.keys(finalScore).length ? {
      away: awayScore,
      home: homeScore,
      status: nullableText(finalScore.status, 80)
    } : null,
    box_url: cleanUrl(input.box_url, "box_url"),
    source_url: cleanUrl(input.source_url, "source_url")
  };
}

export function emptyEventDetails(eventId = "") {
  return {
    id: null,
    event_id: eventId || null,
    sport_type: null,
    detail_status: "not_synced",
    sync_phase: null,
    details: {},
    source_url: null,
    source_name: null,
    source_updated_at: null,
    last_synced_at: null,
    raw_payload: null,
    exists: false
  };
}

export function normalizeEventDetailsPayload(body, options = {}) {
  const eventId = cleanText(body.event_id || options.eventId, 80);
  if (!eventId) throw validationError("event_id is required");

  const sportType = cleanText(body.sport_type || options.sportType || "baseball", 80).toLowerCase();
  if (!SPORT_TYPES.has(sportType)) throw validationError("sport_type is invalid");

  const detailStatus = cleanText(body.detail_status || "not_synced", 80).toLowerCase();
  if (!DETAIL_STATUSES.has(detailStatus)) throw validationError("detail_status is invalid");

  const syncPhase = nullableText(body.sync_phase, 80);
  if (syncPhase && !SYNC_PHASES.has(syncPhase)) throw validationError("sync_phase is invalid");

  const inputDetails = body.details === undefined ? {} : body.details;
  const details = sportType === "baseball"
    ? normalizeBaseballDetails(inputDetails)
    : cleanObject(inputDetails, "details");

  const sourceUrl = cleanUrl(body.source_url || details.source_url, "source_url");
  if (sourceUrl && !details.source_url) details.source_url = sourceUrl;

  return {
    event_id: eventId,
    sport_type: sportType,
    detail_status: detailStatus,
    sync_phase: syncPhase,
    details,
    source_url: sourceUrl,
    source_name: nullableText(body.source_name, 240),
    source_updated_at: body.source_updated_at ? normalizeDateTime(body.source_updated_at, "source_updated_at") : null,
    last_synced_at: body.last_synced_at ? normalizeDateTime(body.last_synced_at, "last_synced_at") : new Date().toISOString(),
    raw_payload: body.raw_payload === undefined ? body : body.raw_payload,
    updated_at: new Date().toISOString()
  };
}

export function normalizeEventDetailsPatch(body) {
  const payload = {};

  if (body.sport_type !== undefined) {
    const sportType = cleanText(body.sport_type, 80).toLowerCase();
    if (!SPORT_TYPES.has(sportType)) throw validationError("sport_type is invalid");
    payload.sport_type = sportType;
  }

  if (body.detail_status !== undefined) {
    const detailStatus = cleanText(body.detail_status, 80).toLowerCase();
    if (!DETAIL_STATUSES.has(detailStatus)) throw validationError("detail_status is invalid");
    payload.detail_status = detailStatus;
  }

  if (body.sync_phase !== undefined) {
    const syncPhase = nullableText(body.sync_phase, 80);
    if (syncPhase && !SYNC_PHASES.has(syncPhase)) throw validationError("sync_phase is invalid");
    payload.sync_phase = syncPhase;
  }

  if (body.details !== undefined) {
    const sportType = payload.sport_type || cleanText(body.sport_type || "baseball", 80).toLowerCase();
    payload.details = sportType === "baseball"
      ? normalizeBaseballDetails(body.details)
      : cleanObject(body.details, "details");
  }

  if (body.source_url !== undefined) payload.source_url = cleanUrl(body.source_url, "source_url");
  if (body.source_name !== undefined) payload.source_name = nullableText(body.source_name, 240);
  if (body.source_updated_at !== undefined) {
    payload.source_updated_at = body.source_updated_at ? normalizeDateTime(body.source_updated_at, "source_updated_at") : null;
  }
  if (body.last_synced_at !== undefined) {
    payload.last_synced_at = body.last_synced_at ? normalizeDateTime(body.last_synced_at, "last_synced_at") : null;
  }
  if (body.raw_payload !== undefined) payload.raw_payload = body.raw_payload;

  if (!Object.keys(payload).length) throw validationError("No supported detail fields to update");
  payload.updated_at = new Date().toISOString();
  return payload;
}
