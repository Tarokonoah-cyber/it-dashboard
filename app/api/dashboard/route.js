import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";
import { normalizeWork } from "../../../lib/dailyOpsSync";
import { getMonthCompletionMetrics, getWorkPriorityLabel } from "../../../lib/dashboard-metrics";
import { isFollowUpDone, normalizeFollowUp, sortFollowUps } from "../../../lib/followUps";
import { selectUpcomingContractReminders } from "../../../lib/calendarReminders";
import { addDateDays } from "../../../lib/recurringTasks";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);
const CANCELLED_STATUSES = new Set(["已取消", "取消", "Cancelled", "cancelled", "Canceled", "canceled"]);

function toDateKey(value) {
  return value ? String(value).slice(0, 10) : "";
}

function isWorkDone(row) {
  return DONE_STATUSES.has(String(row?.status || "").trim());
}

function isWorkCancelled(row) {
  return CANCELLED_STATUSES.has(String(row?.status || "").trim());
}

function isUrgentWork(row) {
  const text = `${row?.status || ""} ${row?.impact || ""} ${row?.priority || ""}`.toLowerCase();
  return /異常|逾期|緊急|urgent|critical/.test(text);
}

function isMissingSortOrderColumn(error) {
  const message = String(error?.message || "");
  return /sort_order/i.test(message) && /(schema cache|could not find|does not exist|PGRST204|PGRST205)/i.test(message);
}

async function loadWorkRows() {
  try {
    return await supabaseRequest(
      "work_logs",
      "select=*&order=sort_order.asc.nullslast,date.desc,updated_at.desc,created_at.desc&limit=1000"
    );
  } catch (error) {
    if (!isMissingSortOrderColumn(error)) throw error;
    return supabaseRequest("work_logs", "select=*&order=date.desc,updated_at.desc,created_at.desc&limit=1000");
  }
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const today = todayTaipei();
    const warnings = [];
    let workRows = [];
    let networkRooms = [];
    let followUpRows = [];
    let contractRows = [];
    let mobileContractRows = [];
    const contractReminderEndDate = addDateDays(today, 30);
    const [workResult, networkResult, followUpResult, contractResult, mobileContractResult] = await Promise.allSettled([
      loadWorkRows(),
      supabaseRequest(
        "network_test_rooms",
        `select=*&date=eq.${encodeURIComponent(today)}&order=room_no.asc`
      ),
      supabaseRequest("follow_ups", "select=*&order=next_follow_date.asc,updated_at.desc&limit=200"),
      supabaseRequest(
        "contracts",
        `select=id,contract_name,vendor,end_date,status&end_date=gte.${encodeURIComponent(today)}&end_date=lte.${encodeURIComponent(contractReminderEndDate)}&order=end_date.asc&limit=1000`
      ),
      supabaseRequest(
        "mobile_contracts",
        `select=id,phone_no,user_name,end_date,status&end_date=gte.${encodeURIComponent(today)}&end_date=lte.${encodeURIComponent(contractReminderEndDate)}&order=end_date.asc&limit=1000`
      )
    ]);

    if (workResult.status === "fulfilled") {
      workRows = workResult.value;
    } else {
      console.error("[dashboard critical query error]", workResult.reason);
      return fail(new Error("Dashboard data failed to load"));
    }

    if (networkResult.status === "fulfilled") {
      networkRooms = networkResult.value;
    } else {
      console.error("[dashboard optional query error]", { source: "network_test_rooms", error: networkResult.reason });
      warnings.push({ source: "network_test_rooms", message: "Network rooms data failed to load" });
    }

    if (followUpResult.status === "fulfilled") {
      followUpRows = followUpResult.value;
    } else {
      console.error("[dashboard optional query error]", { source: "follow_ups", error: followUpResult.reason });
      warnings.push({ source: "follow_ups", message: "Follow-up data failed to load" });
    }

    if (contractResult.status === "fulfilled") {
      contractRows = contractResult.value;
    } else {
      console.error("[dashboard optional query error]", { source: "contracts", error: contractResult.reason });
      warnings.push({ source: "contracts", message: "Software contract reminders failed to load" });
    }

    if (mobileContractResult.status === "fulfilled") {
      mobileContractRows = mobileContractResult.value;
    } else {
      console.error("[dashboard optional query error]", { source: "mobile_contracts", error: mobileContractResult.reason });
      warnings.push({ source: "mobile_contracts", message: "Mobile contract reminders failed to load" });
    }

    const works = workRows.map(normalizeWork);
    const openWorks = works.filter((row) => !isWorkDone(row) && !isWorkCancelled(row));
    const completedWorks = works.filter(isWorkDone);
    const followUps = sortFollowUps(followUpRows.map(normalizeFollowUp), today).filter((row) => !isFollowUpDone(row));
    const todayWorks = works.filter((row) => toDateKey(row.date || row.created_at) === today);
    const month = today.slice(0, 7);
    const monthWorks = works.filter((row) => toDateKey(row.date || row.created_at).startsWith(month));
    const sevenDays = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(`${today}T00:00:00+08:00`);
      d.setDate(d.getDate() - (6 - index));
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(d);
    });
    const workTrend = sevenDays.map((day) => ({
      date: day,
      count: works.filter((row) => toDateKey(row.date || row.created_at) === day).length
    }));

    const monthCompletion = getMonthCompletionMetrics(works, today);
    const pendingNetworkRooms = networkRooms.filter((row) => !["已完成", "完成", "異常"].includes(String(row.status || "").trim()));
    const doneNetworkRooms = networkRooms.filter((row) => ["已完成", "完成"].includes(String(row.status || "").trim()));
    const abnormalNetworkRooms = networkRooms.filter((row) => String(row.status || "").trim() === "異常");

    return ok({
      today,
      todayWorkCount: todayWorks.length,
      monthWorkCount: monthWorks.length,
      pendingCount: openWorks.length,
      urgentCount: openWorks.filter(isUrgentWork).length,
      importantCount: openWorks.filter((work) => getWorkPriorityLabel(work) === "重要").length,
      completionRate: monthCompletion.rate,
      completedCount: completedWorks.length,
      monthCompletedCount: monthCompletion.completed,
      monthCompletionTotal: monthCompletion.total,
      monthCompletionRate: monthCompletion.rate,
      openWorks,
      contractReminders: selectUpcomingContractReminders(contractRows, mobileContractRows, today, 30),
      followUps,
      networkRooms,
      networkSummary: {
        total: networkRooms.length,
        pending: pendingNetworkRooms.length,
        done: doneNetworkRooms.length,
        abnormal: abnormalNetworkRooms.length
      },
      todayChangeSummary: {
        created: todayWorks.length + networkRooms.length,
        updated: 0,
        completed: todayWorks.filter(isWorkDone).length + doneNetworkRooms.length
      },
      recentWorks: works.slice(0, 10),
      workTrend,
      deltas: {
        todayWork: "0",
        monthWork: `+${monthWorks.length}`,
        pending: `${openWorks.length}`,
        completionRate: "OK"
      },
      warnings
    });
  } catch (error) {
    return fail(error);
  }
}
