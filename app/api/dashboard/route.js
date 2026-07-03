import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";
import { isTodoDone, normalizeTodo, normalizeWork } from "../../../lib/dailyOpsSync";
import { isFollowUpDone, normalizeFollowUp, sortFollowUps } from "../../../lib/followUps";

function toDateKey(value) {
  return value ? String(value).slice(0, 10) : "";
}

function isWorkDone(row) {
  return ["已完成", "完成", "Done", "done"].includes(String(row?.status || "").trim());
}

export async function GET(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const today = todayTaipei();
    let todoRows;
    let workRows;
    try {
      [todoRows, workRows] = await Promise.all([
        supabaseRequest("todo_logs", "select=*&order=created_at.desc&limit=500"),
        supabaseRequest("work_logs", "select=*&order=date.desc,updated_at.desc,created_at.desc&limit=500")
      ]);
    } catch (error) {
      console.error("[dashboard critical query error]", error);
      return fail(new Error("Dashboard data failed to load"));
    }

    const warnings = [];
    let networkRooms = [];
    try {
      networkRooms = await supabaseRequest(
        "network_test_rooms",
        `select=*&date=eq.${encodeURIComponent(today)}&order=room_no.asc`
      );
    } catch (error) {
      console.error("[dashboard optional query error]", { source: "network_test_rooms", error });
      warnings.push({
        source: "network_test_rooms",
        message: "Network rooms data failed to load"
      });
    }

    const todos = todoRows.map(normalizeTodo);
    const works = workRows.map(normalizeWork);
    const openTodos = todos.filter((row) => !isTodoDone(row));
    const completedTodos = todos.filter(isTodoDone);
    let followUps = [];
    try {
      const followUpRows = await supabaseRequest(
        "follow_ups",
        "select=*&order=next_follow_date.asc,created_at.desc&limit=100"
      );
      followUps = sortFollowUps(followUpRows.map(normalizeFollowUp), today)
        .filter((row) => !isFollowUpDone(row));
    } catch (error) {
      console.error("[dashboard optional query error]", { source: "follow_ups", error });
      warnings.push({
        source: "follow_ups",
        message: "Follow-up data failed to load"
      });
    }
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

    const denominator = completedTodos.length + openTodos.length;
    const completionRate = denominator ? Math.round((completedTodos.length / denominator) * 100) : 0;
    const pendingNetworkRooms = networkRooms.filter((row) => !["已完成", "完成", "異常"].includes(String(row.status || "").trim()));
    const doneNetworkRooms = networkRooms.filter((row) => ["已完成", "完成"].includes(String(row.status || "").trim()));
    const abnormalNetworkRooms = networkRooms.filter((row) => String(row.status || "").trim() === "異常");

    return ok({
      today,
      todayWorkCount: todayWorks.length + openTodos.length,
      monthWorkCount: monthWorks.length + openTodos.length,
      pendingCount: openTodos.length,
      completionRate,
      completedCount: completedTodos.length,
      openTodos,
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
        pending: `${openTodos.length}`,
        completionRate: "OK"
      },
      warnings
    });
  } catch (error) {
    return fail(error);
  }
}
