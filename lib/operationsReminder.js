import "server-only";
import { createTodoWithWorkLog, normalizeTodo, syncTodoToWorkLog } from "./dailyOpsSync";
import { buildLineDigest, isDigestWeekday, selectDueFollowUps, selectExpiringContracts, selectImportantWorks } from "./reminderDigest";
import { getRecurringEvaluationDates } from "./recurringTasks";
import { sendLoggedLineText } from "./lineMessaging";
import { supabaseRequest, todayTaipei } from "./supabase-rest";

const MAX_CATCH_UP_DAYS = 31;

function recurringSource(templateId, date) {
  return `recurring_task:${templateId}:${date}`;
}

async function loadActiveTemplates() {
  return supabaseRequest(
    "recurring_task_templates",
    "select=*&is_active=eq.true&archived_at=is.null&order=created_at.asc&limit=500"
  );
}

async function findOccurrence(templateId, date) {
  const rows = await supabaseRequest(
    "recurring_task_occurrences",
    `select=*&template_id=eq.${encodeURIComponent(templateId)}&occurrence_date=eq.${encodeURIComponent(date)}&limit=1`
  );
  return rows[0] || null;
}

async function patchOccurrence(id, payload) {
  const rows = await supabaseRequest("recurring_task_occurrences", `id=eq.${encodeURIComponent(id)}&select=*`, {
    method: "PATCH",
    body: { ...payload, updated_at: new Date().toISOString() }
  });
  return rows[0] || { id, ...payload };
}

async function claimOccurrence(templateId, date) {
  const now = new Date().toISOString();
  const created = await supabaseRequest("recurring_task_occurrences", "on_conflict=template_id,occurrence_date&select=*", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=representation",
    body: {
      template_id: templateId,
      occurrence_date: date,
      status: "processing",
      created_at: now,
      updated_at: now
    }
  });
  if (created[0]) return { occurrence: created[0], claimed: true };

  const existing = await findOccurrence(templateId, date);
  if (!existing) throw new Error("無法建立週期任務執行紀錄");
  if (existing.status === "generated") return { occurrence: existing, claimed: false, reason: "already_generated" };
  const age = Date.now() - new Date(existing.updated_at || existing.created_at || 0).getTime();
  if (existing.status === "processing" && age < 15 * 60 * 1000) {
    return { occurrence: existing, claimed: false, reason: "already_processing" };
  }
  const retried = await patchOccurrence(existing.id, { status: "processing", error_message: "" });
  return { occurrence: retried, claimed: true, reason: "retry" };
}

async function findTodoBySource(source) {
  const rows = await supabaseRequest(
    "todo_logs",
    `select=*&source=eq.${encodeURIComponent(source)}&order=created_at.asc&limit=1`
  );
  return rows[0] ? normalizeTodo(rows[0]) : null;
}

async function generateOccurrence(template, date) {
  const claim = await claimOccurrence(template.id, date);
  if (!claim.claimed) return { status: "skipped", reason: claim.reason };
  const source = recurringSource(template.id, date);
  try {
    const existingTodo = await findTodoBySource(source);
    const result = existingTodo
      ? { todo: existingTodo, workLog: await syncTodoToWorkLog(existingTodo) }
      : await createTodoWithWorkLog({
        title: template.title,
        note: template.note || "",
        priority: template.priority || "一般",
        owner: template.owner || "共同",
        due_date: date,
        status: "未完成"
      }, source);
    await patchOccurrence(claim.occurrence.id, {
      status: "generated",
      todo_id: result.todo?.id || null,
      work_log_id: result.workLog?.id || null,
      error_message: ""
    });
    return { status: "generated", todoId: result.todo?.id || null, workLogId: result.workLog?.id || null };
  } catch (error) {
    await patchOccurrence(claim.occurrence.id, {
      status: "failed",
      error_message: String(error?.message || error || "週期任務產生失敗").slice(0, 500)
    }).catch((patchError) => console.error("[recurring occurrence log failed]", patchError));
    throw error;
  }
}

async function markTemplateChecked(templateId, date) {
  await supabaseRequest("recurring_task_templates", `id=eq.${encodeURIComponent(templateId)}&select=id`, {
    method: "PATCH",
    body: { last_checked_date: date, updated_at: new Date().toISOString() }
  });
}

export async function generateRecurringTasks(today = todayTaipei()) {
  const templates = await loadActiveTemplates();
  const summary = { templates: templates.length, generated: 0, skipped: 0, failed: 0, errors: [] };

  for (const template of templates) {
    const dates = getRecurringEvaluationDates(template, today, MAX_CATCH_UP_DAYS);
    let templateFailed = false;
    for (const date of dates) {
      try {
        const result = await generateOccurrence(template, date);
        if (result.status === "generated") summary.generated += 1;
        else summary.skipped += 1;
      } catch (error) {
        templateFailed = true;
        summary.failed += 1;
        summary.errors.push({ templateId: template.id, date, message: String(error?.message || error).slice(0, 240) });
      }
    }
    if (!templateFailed) await markTemplateChecked(template.id, today);
  }
  return summary;
}

async function loadInspectionIssues(today) {
  const fromDate = new Date(`${today}T00:00:00Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 7);
  const from = fromDate.toISOString().slice(0, 10);
  const records = await supabaseRequest(
    "inspection_records",
    `select=id,inspection_date&inspection_date=gte.${encodeURIComponent(from)}&overall_status=neq.${encodeURIComponent("正常")}&order=inspection_date.desc&limit=20`
  );
  if (!records.length) return [];
  const dateById = new Map(records.map((row) => [String(row.id), row.inspection_date]));
  const ids = records.map((row) => encodeURIComponent(row.id)).join(",");
  const items = await supabaseRequest(
    "inspection_record_items",
    `select=inspection_record_id,item_name,issue_description,status,handling_status&inspection_record_id=in.(${ids})&status=neq.${encodeURIComponent("正常")}&order=created_at.desc&limit=100`
  );
  return items
    .filter((row) => String(row.handling_status || "未處理") !== "已處理")
    .map((row) => ({ ...row, inspection_date: dateById.get(String(row.inspection_record_id)) || "" }));
}

export async function buildOperationsDigest(today = todayTaipei()) {
  const [workRows, followUpRows, calendarEvents, inspectionIssues, contracts, mobileContracts] = await Promise.all([
    supabaseRequest("work_logs", "select=id,title,status,impact,date,created_at&order=date.asc,created_at.asc&limit=1000"),
    supabaseRequest("follow_ups", `select=id,title,current_status,next_follow_date&next_follow_date=lte.${encodeURIComponent(today)}&order=next_follow_date.asc&limit=200`),
    supabaseRequest("calendar_events", `select=id,title,event_date,event_time,event_type&event_date=eq.${encodeURIComponent(today)}&order=event_time.asc.nullsfirst,created_at.asc&limit=200`),
    loadInspectionIssues(today),
    supabaseRequest("contracts", "select=id,contract_name,vendor,end_date,status&limit=1000"),
    supabaseRequest("mobile_contracts", "select=id,phone_no,user_name,end_date,status&limit=1000")
  ]);
  const importantWorks = selectImportantWorks(workRows);
  const dueFollowUps = selectDueFollowUps(followUpRows, today);
  const expiringContracts = selectExpiringContracts(contracts, mobileContracts, today, 30);
  const configuredAppUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  const appUrl = configuredAppUrl && !/^https?:\/\//i.test(configuredAppUrl)
    ? `https://${configuredAppUrl}`
    : configuredAppUrl;
  return buildLineDigest({
    today,
    importantWorks,
    dueFollowUps,
    calendarEvents,
    inspectionIssues,
    expiringContracts,
    appUrl
  });
}

export async function runOperationsReminder(today = todayTaipei()) {
  const generation = await generateRecurringTasks(today);
  if (!isDigestWeekday(today)) {
    return { today, generation, line: { status: "skipped", reason: "weekend" } };
  }
  const digest = await buildOperationsDigest(today);
  const line = await sendLoggedLineText({
    deliveryKey: `daily_digest:${today}`,
    scheduledDate: today,
    kind: "daily_digest",
    message: digest.text,
    itemCounts: digest.counts
  });
  return { today, generation, line: { status: line.status, reason: line.reason || "", counts: digest.counts } };
}
