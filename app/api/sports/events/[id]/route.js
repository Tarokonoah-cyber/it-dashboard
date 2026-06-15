import { requireDashboardAuth } from "../../../../../lib/auth";
import { fail, ok, supabaseRequest } from "../../../../../lib/supabase-rest";
import { normalizePatchPayload } from "../../../../../lib/sportsCalendar";

export async function PATCH(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const eventId = String(id || "").trim();
    if (!eventId) return fail(new Error("Event id is required"), 400);

    const body = await request.json();
    const payload = normalizePatchPayload(body);
    const rows = await supabaseRequest("sports_events", `id=eq.${encodeURIComponent(eventId)}&select=*`, {
      method: "PATCH",
      body: payload
    });
    if (!rows.length) return fail(new Error("Sports event not found"), 404);
    return ok(rows[0]);
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function DELETE(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const eventId = String(id || "").trim();
    if (!eventId) return fail(new Error("Event id is required"), 400);
    await supabaseRequest("sports_events", `id=eq.${encodeURIComponent(eventId)}&select=id`, {
      method: "DELETE"
    });
    return ok({ id: eventId });
  } catch (error) {
    return fail(error);
  }
}
