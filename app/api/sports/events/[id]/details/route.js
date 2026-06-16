import { requireDashboardAuth } from "../../../../../../lib/auth";
import { fail, ok, supabaseRequest } from "../../../../../../lib/supabase-rest";
import {
  emptyEventDetails,
  normalizeEventDetailsPatch,
  normalizeEventDetailsPayload
} from "../../../../../../lib/sportsCalendar";

function isMissingDetailsTable(error) {
  const message = String(error?.message || "");
  return message.includes("sports_event_details") && (
    message.includes("does not exist") ||
    message.includes("Could not find") ||
    message.includes("schema cache")
  );
}

async function getEvent(eventId) {
  const rows = await supabaseRequest(
    "sports_events",
    `id=eq.${encodeURIComponent(eventId)}&select=id,sport_type,title`
  );
  return rows[0] || null;
}

async function getDetails(eventId) {
  const rows = await supabaseRequest(
    "sports_event_details",
    `event_id=eq.${encodeURIComponent(eventId)}&select=*&limit=1`
  );
  return rows[0] || null;
}

export async function GET(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const eventId = String(id || "").trim();
    if (!eventId) return fail(new Error("Event id is required"), 400);

    const row = await getDetails(eventId);
    return ok(row ? { ...row, exists: true } : emptyEventDetails(eventId));
  } catch (error) {
    if (isMissingDetailsTable(error)) {
      const { id } = await context.params;
      return ok(emptyEventDetails(String(id || "").trim()));
    }
    return fail(error);
  }
}

export async function POST(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const eventId = String(id || "").trim();
    if (!eventId) return fail(new Error("Event id is required"), 400);

    const event = await getEvent(eventId);
    if (!event) return fail(new Error("Sports event not found"), 404);

    const body = await request.json();
    const payload = normalizeEventDetailsPayload(body, {
      eventId,
      sportType: event.sport_type
    });
    const rows = await supabaseRequest("sports_event_details", "select=*&on_conflict=event_id", {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: payload
    });
    return ok({ ...(rows[0] || payload), exists: true });
  } catch (error) {
    if (isMissingDetailsTable(error)) {
      return fail(new Error("sports_event_details table is not available. Apply supabase_sports_calendar.sql first."), 503);
    }
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function PUT(request, context) {
  return POST(request, context);
}

export async function PATCH(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const eventId = String(id || "").trim();
    if (!eventId) return fail(new Error("Event id is required"), 400);

    const existing = await getDetails(eventId);
    if (!existing) return fail(new Error("Sports event details not found"), 404);

    const body = await request.json();
    const payload = normalizeEventDetailsPatch({
      sport_type: existing.sport_type,
      ...body
    });
    const rows = await supabaseRequest("sports_event_details", `event_id=eq.${encodeURIComponent(eventId)}&select=*`, {
      method: "PATCH",
      body: payload
    });
    return ok({ ...(rows[0] || { event_id: eventId, ...payload }), exists: true });
  } catch (error) {
    if (isMissingDetailsTable(error)) {
      return fail(new Error("sports_event_details table is not available. Apply supabase_sports_calendar.sql first."), 503);
    }
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}
