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
