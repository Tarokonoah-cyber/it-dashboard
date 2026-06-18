import { requireDashboardAuth } from "../../../../lib/auth";
import { fail, ok } from "../../../../lib/supabase-rest";
import { getBaseballStandings } from "../../../../lib/sportsStandings";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const league = String(searchParams.get("league") || "").trim().toUpperCase();
    if (!league) return fail(new Error("league is required"), 400);
    return ok(await getBaseballStandings(league));
  } catch (error) {
    return fail(error, 500);
  }
}
