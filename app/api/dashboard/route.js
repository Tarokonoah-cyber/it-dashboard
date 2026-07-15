import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";
import { normalizeWork } from "../../../lib/dailyOpsSync";
import { isFollowUpDone, normalizeFollowUp, sortFollowUps } from "../../../lib/followUps";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);

function toDateKey(value) {
  return value ? String(value).slice(0, 10) : "";
}

function isWorkDone(row) {
  return DONE_STATUSES.has(String(row?.status || "").trim());
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
    let workRows;
    try {
      workRows = await loadWorkRows();
    } catch (error) {
      console.error("[dashboard critical query error]", error);
      return fail(new Error("Dashboard data failed to load"));
    }

    const warnings = [];
    let networkRooms = [];
    let followUpRows = [];
    const [networkResult, followUpResult] = await Promise.allSettled([
      supabaseRequest(
        "network_test_rooms",
        `select=*&date=eq.${encodeURIComponent(today)}&order=room_no.asc`
      ),
      supabaseRequest("follow_ups", "select=*&order=next_follow_date.asc,updated_at.desc&limit=200")
    ]);

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

    const works = workRows.map(normalizeWork);
    const openWorks = works.filter((row) => !isWorkDone(row));
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

    const denominator = completedWorks.length + openWorks.length;
    const completionRate = denominator ? Math.round((completedWorks.length / denominator) * 100) : 0;
    const pendingNetworkRooms = networkRooms.filter((row) => !["已完成", "完成", "異常"].includes(String(row.status || "").trim()));
    const doneNetworkRooms = networkRooms.filter((row) => ["已完成", "完成"].includes(String(row.status || "").trim()));
    const abnormalNetworkRooms = networkRooms.filter((row) => String(row.status || "").trim() === "異常");

    return ok({
      today,
      todayWorkCount: todayWorks.length,
      monthWorkCount: monthWorks.length,
      pendingCount: openWorks.length,
      urgentCount: openWorks.filter(isUrgentWork).length,
      completionRate,
      completedCount: completedWorks.length,
      openWorks,
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
