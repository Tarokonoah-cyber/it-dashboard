import { requireDashboardAuth } from "../../../../lib/auth";
import { fail, ok, supabaseRequest } from "../../../../lib/supabase-rest";
import {
  getTaipeiMonthRange,
  normalizeDateTime,
  normalizeEventPayload,
  parseSportTypes
} from "../../../../lib/sportsCalendar";

function encodeIn(values) {
  return `(${values.map((value) => String(value).trim()).join(",")})`;
}

function buildSearchFilter(keyword) {
  const q = String(keyword || "").trim();
  if (!q) return "";
  const escaped = q.replace(/[,*()]/g, " ");
  const pattern = `*${escaped}*`;
  const fields = ["title", "league", "home_team", "away_team", "venue"];
  return `or=(${fields.map((field) => `${field}.ilike.${encodeURIComponent(pattern)}`).join(",")})`;
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
    const searchFilter = buildSearchFilter(searchParams.get("q"));
    if (searchFilter) query.push(searchFilter);

    const rows = await supabaseRequest("sports_events", query.join("&"));
    return ok(rows);
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
