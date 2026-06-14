import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { requireDashboardAuth } from "../../../lib/auth";

const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);

function toDateKey(value) {
  return value ? String(value).slice(0, 10) : "";
}

function isDone(row) {
  return DONE_STATUSES.has(String(row.status || "").trim());
}

function normalizeTodo(row) {
  return {
    ...row,
    title: row.title || row.description || row.subject || "未命名待辦",
    status: String(row.status || "未完成").trim()
  };
}

function normalizeWork(row) {
  return {
    ...row,
    title: row.title || row.description || row.subject || row.content || "未命名工作",
    status: String(row.status || "未開始").trim()
  };
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
    const openTodos = todos.filter((row) => !isDone(row));
    const completedTodos = todos.filter(isDone);
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
    const pendingNetworkRooms = networkRooms.filter((row) => row.status !== "完成" && row.status !== "已完成" && row.status !== "異常");
    const doneNetworkRooms = networkRooms.filter((row) => row.status === "完成" || row.status === "已完成");
    const abnormalNetworkRooms = networkRooms.filter((row) => row.status === "異常");

    return ok({
      today,
      todayWorkCount: todayWorks.length + openTodos.length,
      monthWorkCount: monthWorks.length + openTodos.length,
      pendingCount: openTodos.length,
      completionRate,
      openTodos,
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
        completed: todayWorks.filter(isDone).length + doneNetworkRooms.length
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
