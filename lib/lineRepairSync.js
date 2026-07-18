import "server-only";
import { buildLineRepairWorkPayload } from "./lineRepairTask";
import { supabaseRpc } from "./supabase-rest";

export async function processLineRepairEvent(event) {
  const work = buildLineRepairWorkPayload(event);
  const result = await supabaseRpc("process_line_repair_event", {
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_occurred_at: event.occurredAt,
    p_repair_updated_at: event.repair.updatedAt,
    p_repair_no: event.repair.repairNo,
    p_task_state: event.repair.taskState,
    p_work: work
  });

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("LINE repair sync returned an invalid result");
  }
  return result;
}
