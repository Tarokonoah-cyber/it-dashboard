import { isCronAuthorized } from "../../../../lib/cronAuth";
import { runOperationsReminder } from "../../../../lib/operationsReminder";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

async function handler(request) {
  if (!isCronAuthorized(request, process.env.CRON_SECRET)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runOperationsReminder();
    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error("[operations reminder cron failed]", error);
    return Response.json({ success: false, message: "Operations reminder failed" }, { status: 500 });
  }
}

export { handler as GET, handler as POST };
