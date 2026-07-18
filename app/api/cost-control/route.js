import { requireDashboardAuth } from "../../../lib/auth";
import { loadCostControlDashboard, parseCostControlFilters } from "../../../lib/cost-control-service";
import { fail, ok } from "../../../lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    return ok(await loadCostControlDashboard(parseCostControlFilters(new URL(request.url).searchParams)));
  } catch (error) {
    return fail(error);
  }
}
