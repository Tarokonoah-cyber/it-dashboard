import { fail, ok, supabaseRequest } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";

const MAX_TITLE_LENGTH = 120;
const MAX_TEXT_LENGTH = 1000;

function validationError(message) {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
}

function trimText(value, maxLength, fieldName) {
  const text = String(value || "").trim();
  if (text.length > maxLength) {
    throw validationError(`${fieldName} must be ${maxLength} characters or less`);
  }
  return text;
}

function validateDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw validationError("Calendar event date is required");
  }
  return date;
}

function validateTime(value) {
  const time = String(value || "").trim();
  if (!time) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw validationError("Calendar event time must use HH:mm");
  }
  return time;
}

function normalizeEvent(row) {
  return {
    id: row.id,
    event_date: row.event_date,
    event_time: row.event_time ? String(row.event_time).slice(0, 5) : "",
    title: row.title || "",
    event_type: row.event_type || "其他",
    note: row.note || "",
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function buildPayload(body) {
  const title = trimText(body?.title, MAX_TITLE_LENGTH, "Calendar event title");
  if (!title) throw validationError("Calendar event title is required");

  const eventType = trimText(body?.event_type || body?.type || "其他", 40, "Calendar event type") || "其他";
  return {
    event_date: validateDate(body?.event_date || body?.date),
    event_time: validateTime(body?.event_time || body?.time),
    title,
    event_type: eventType,
    note: trimText(body?.note, MAX_TEXT_LENGTH, "Calendar event note") || null
  };
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const rows = await supabaseRequest(
      "calendar_events",
      "select=*&order=event_date.asc,event_time.asc.nullsfirst,created_at.asc&limit=500"
    );
    return ok(rows.map(normalizeEvent));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const rows = await supabaseRequest("calendar_events", "select=*", {
      method: "POST",
      body: buildPayload(body)
    });
    return ok(normalizeEvent(rows[0] || {}));
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function DELETE(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get("id") || "").trim();
    if (!id) return fail(validationError("Calendar event id is required"), 400);
    await supabaseRequest("calendar_events", `id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "DELETE"
    });
    return ok({ id });
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}
