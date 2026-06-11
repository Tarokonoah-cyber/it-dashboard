import { fail, ok, supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";

const OPEN_STATUSES = ["未完成", "待處理", "未開始", "處理中"];

function toDateKey(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export async function GET() {
  try {
    const today = todayTaipei();
    const [todos, works, notes] = await Promise.all([
      supabaseRequest("todo_logs", "select=*&order=created_at.desc&limit=300"),
      supabaseRequest("work_logs", "select=*&order=date.desc,updated_at.desc&limit=300"),
      supabaseRequest("quick_notes", "select=id&limit=1").catch(() => [])
    ]);

    const openTodos = todos.filter((row) => OPEN_STATUSES.includes(row.status || "未完成"));
    const completedTodos = todos.filter((row) => row.status === "已完成");
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

    return ok({
      today,
      todayWorkCount: todayWorks.length + openTodos.length,
      monthWorkCount: monthWorks.length,
      pendingCount: openTodos.length,
      completionRate,
      openTodos,
      recentWorks: works.slice(0, 10),
      workTrend,
      notesReady: Array.isArray(notes)
    });
  } catch (error) {
    return fail(error);
  }
}
