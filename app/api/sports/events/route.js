import { requireDashboardAuth } from "../../../../lib/auth";
import { fail, ok, supabaseRequest } from "../../../../lib/supabase-rest";
import {
  emptyEventDetails,
  getTaipeiMonthRange,
  normalizeDateTime,
  normalizeEventPayload,
  parseSportTypes
} from "../../../../lib/sportsCalendar";

function encodeIn(values) {
  return `(${values.map((value) => String(value).trim()).join(",")})`;
}

function parseLeagues(value) {
  return [...new Set(String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean))]
    .slice(0, 20);
}

function buildSearchFilter(keyword) {
  const q = String(keyword || "").trim();
  if (!q) return "";
  const escaped = q.replace(/[,*()]/g, " ");
  const pattern = `*${escaped}*`;
  const fields = ["title", "league", "home_team", "away_team", "venue"];
  return `or=(${fields.map((field) => `${field}.ilike.${encodeURIComponent(pattern)}`).join(",")})`;
}

function encodeIdIn(values) {
  return `(${values.map((value) => String(value).trim()).join(",")})`;
}

function isMissingDetailsTable(error) {
  const message = String(error?.message || "");
  return message.includes("sports_event_details") && (
    message.includes("does not exist") ||
    message.includes("Could not find") ||
    message.includes("schema cache")
  );
}

async function attachDetails(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return rows.map((row) => ({ ...row, detail: emptyEventDetails(row.id) }));

  try {
    const detailsRows = [];
    for (let index = 0; index < ids.length; index += 100) {
      const chunk = ids.slice(index, index + 100);
      detailsRows.push(...await supabaseRequest(
        "sports_event_details",
        `select=*&event_id=in.${encodeURIComponent(encodeIdIn(chunk))}`
      ));
    }
    const detailMap = new Map(detailsRows.map((detail) => [detail.event_id, { ...detail, exists: true }]));
    return rows.map((row) => ({
      ...row,
      detail: detailMap.get(row.id) || emptyEventDetails(row.id)
    }));
  } catch (error) {
    if (isMissingDetailsTable(error)) {
      return rows.map((row) => ({ ...row, detail: emptyEventDetails(row.id) }));
    }
    throw error;
  }
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const sportTypes = parseSportTypes(searchParams.get("sportTypes"));
    if (!sportTypes.length) return ok([]);

    const range = getTaipeiMonthRange(searchParams.get("month"));
    const from = searchParams.get("from")
      ? normalizeDateTime(searchParams.get("from"), "from")
      : range.from;
    const to = searchParams.get("to")
      ? normalizeDateTime(searchParams.get("to"), "to")
      : range.to;

    const query = [
      "select=*",
      `start_time=gte.${encodeURIComponent(from)}`,
      `start_time=lt.${encodeURIComponent(to)}`,
      `sport_type=in.${encodeURIComponent(encodeIn(sportTypes))}`,
      "order=start_time.asc",
      "limit=500"
    ];
    const leagues = parseLeagues(searchParams.get("leagues"));
    if (leagues.length) query.push(`league=in.${encodeURIComponent(encodeIn(leagues))}`);
    const searchFilter = buildSearchFilter(searchParams.get("q"));
    if (searchFilter) query.push(searchFilter);

    const rows = await supabaseRequest("sports_events", query.join("&"));
    return ok(await attachDetails(rows));
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const payload = normalizeEventPayload(body, { includeCreatedAt: true });
    const rows = await supabaseRequest("sports_events", "select=*&on_conflict=event_key", {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: payload
    });
    return ok(rows[0] || payload);
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}
