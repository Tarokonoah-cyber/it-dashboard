import { handleLineRepairWebhook } from "../../../../lib/lineRepairWebhook";
import { processLineRepairEvent } from "../../../../lib/lineRepairSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  return handleLineRepairWebhook(request, { processEvent: processLineRepairEvent });
}
