import "server-only";

import { normalizeFollowUp } from "./followUps";
import { isDueFollowUp } from "./work-follow-up";
import { supabaseRequest, todayTaipei } from "./supabase-rest";

function isMissingSortOrderColumn(error) {
  const message = String(error?.message || "");
  return /sort_order/i.test(message) && /(schema cache|could not find|does not exist|PGRST204|PGRST205)/i.test(message);
}

async function createPromotedWork(followUp, today) {
  const now = new Date().toISOString();
  const payload = {
    date: today,
    staff: String(followUp.assignee || "Admin").trim() || "Admin",
    title: String(followUp.title || "待追蹤事項").trim() || "待追蹤事項",
    category: "追蹤提醒",
    impact: "重要",
    status: "未完成",
    description: `待追蹤日期已到：${String(followUp.next_follow_date || today).slice(0, 10)}`,
    note: String(followUp.note || "").trim(),
    source: "follow_ups",
    source_id: String(followUp.id),
    created_at: now,
    updated_at: now
  };
  try {
    return await supabaseRequest("work_logs", "select=*", {
      method: "POST",
      body: { ...payload, sort_order: 0 }
    });
  } catch (error) {
    if (!isMissingSortOrderColumn(error)) throw error;
    return supabaseRequest("work_logs", "select=*", { method: "POST", body: payload });
  }
}

export async function promoteDueFollowUps(today = todayTaipei()) {
  const [workRows, rawFollowUps] = await Promise.all([
    supabaseRequest("work_logs", "select=id,source,source_id&source=eq.follow_ups&limit=1000"),
    supabaseRequest("follow_ups", "select=*&order=next_follow_date.asc,updated_at.desc&limit=500")
  ]);
  const promotedIds = new Set(
    workRows.map((row) => String(row.source_id || "")).filter(Boolean)
  );
  const dueRows = rawFollowUps.map(normalizeFollowUp).filter((row) => isDueFollowUp(row, today));
  const summary = { due: dueRows.length, promoted: 0, completed: 0, failed: 0, errors: [] };

  for (const followUp of dueRows) {
    const followUpId = String(followUp.id || "");
    if (!followUpId) continue;
    try {
      if (!promotedIds.has(followUpId)) {
        await createPromotedWork(followUp, today);
        promotedIds.add(followUpId);
        summary.promoted += 1;
      }
      const completedAt = new Date().toISOString();
      await supabaseRequest("follow_ups", `id=eq.${encodeURIComponent(followUpId)}&select=id`, {
        method: "PATCH",
        body: {
          current_status: "已完成",
          completed_at: completedAt,
          updated_at: completedAt
        }
      });
      summary.completed += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({
        followUpId,
        message: String(error?.message || error || "promotion failed").slice(0, 200)
      });
    }
  }

  return summary;
}
