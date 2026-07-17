import { requireDashboardAuth } from "../../../lib/auth";
import { searchDashboard } from "../../../lib/global-search";
import { SEARCH_MIN_LENGTH } from "../../../lib/search-utils";
import { fail, ok } from "../../../lib/supabase-rest";

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim();
    if (query.length < SEARCH_MIN_LENGTH) return ok({ results: [], warnings: [] });
    return ok(await searchDashboard(query, { includePasswords: true }));
  } catch (error) {
    return fail(error);
  }
}
