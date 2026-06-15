import { requireDashboardAuth } from "../../../../lib/auth";
import { fail, ok, supabaseRequest } from "../../../../lib/supabase-rest";
import { cleanText, normalizeFavoritePayload } from "../../../../lib/sportsCalendar";

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const rows = await supabaseRequest(
      "sports_favorites",
      "select=*&order=created_at.desc&limit=500"
    );
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const payload = normalizeFavoritePayload(body);
    const rows = await supabaseRequest("sports_favorites", "select=*&on_conflict=favorite_type,favorite_value", {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: payload
    });
    return ok(rows[0] || payload);
  } catch (error) {
    return fail(error, error.name === "ValidationError" ? 400 : 500);
  }
}

export async function DELETE(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const favoriteType = cleanText(searchParams.get("favorite_type"), 40).toLowerCase();
    const favoriteValue = cleanText(searchParams.get("favorite_value"), 260);
    if (!favoriteType || !favoriteValue) {
      return fail(new Error("favorite_type and favorite_value are required"), 400);
    }

    await supabaseRequest(
      "sports_favorites",
      `favorite_type=eq.${encodeURIComponent(favoriteType)}&favorite_value=eq.${encodeURIComponent(favoriteValue)}&select=id`,
      { method: "DELETE" }
    );
    return ok({ favorite_type: favoriteType, favorite_value: favoriteValue });
  } catch (error) {
    return fail(error);
  }
}
