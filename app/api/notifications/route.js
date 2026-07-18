import { requireDashboardAuth } from "../../../lib/auth";
import { changeNotificationState, loadNotificationSnapshot, pushNotificationsToLine } from "../../../lib/notification-service";
import { fail, ok } from "../../../lib/supabase-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorStatus(error) {
  if (error?.name === "ValidationError") return 400;
  if (error?.name === "NotFoundError") return 404;
  return 500;
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    return ok(await loadNotificationSnapshot());
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    return ok(await changeNotificationState(await request.json()));
  } catch (error) {
    return fail(error, errorStatus(error));
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;
  try {
    return ok(await pushNotificationsToLine(await request.json()));
  } catch (error) {
    return fail(error, errorStatus(error));
  }
}
