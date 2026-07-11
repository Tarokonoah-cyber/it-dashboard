import { dateKey } from "./dashboard-formatters";

function numberValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function countFromDelta(value) {
  const numeric = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function calculateCompletionRate(pendingCount, completedCount) {
  const total = pendingCount + completedCount;
  return total ? Math.round((completedCount / total) * 100) : 0;
}

function adjustWorkTrend(trend, dateChanges) {
  if (!Array.isArray(trend) || !dateChanges.size) return trend;
  return trend.map((item) => {
    const change = dateChanges.get(dateKey(item?.date)) || 0;
    return change ? { ...item, count: Math.max(0, numberValue(item.count) + change) } : item;
  });
}

function updateDashboardMetrics(dashboard, openTodos, completedCount, workChanges = {}) {
  const previousOpenCount = Array.isArray(dashboard.openTodos) ? dashboard.openTodos.length : 0;
  const pendingCount = openTodos.length;
  const openTodoDelta = pendingCount - previousOpenCount;
  const todayWorkDelta = numberValue(workChanges.today);
  const monthWorkDelta = numberValue(workChanges.month);
  const todayChangeSummary = dashboard.todayChangeSummary
    ? {
        ...dashboard.todayChangeSummary,
        created: Math.max(0, numberValue(dashboard.todayChangeSummary.created) + todayWorkDelta),
        completed: Math.max(0, numberValue(dashboard.todayChangeSummary.completed) + numberValue(workChanges.completedToday))
      }
    : dashboard.todayChangeSummary;

  return {
    ...dashboard,
    openTodos,
    pendingCount,
    completedCount,
    completionRate: calculateCompletionRate(pendingCount, completedCount),
    todayWorkCount: Math.max(0, numberValue(dashboard.todayWorkCount) + openTodoDelta + todayWorkDelta),
    monthWorkCount: Math.max(0, numberValue(dashboard.monthWorkCount) + openTodoDelta + monthWorkDelta),
    workTrend: adjustWorkTrend(dashboard.workTrend, workChanges.trend || new Map()),
    todayChangeSummary,
    deltas: {
      ...(dashboard.deltas || {}),
      monthWork: dashboard.deltas?.monthWork === undefined
        ? dashboard.deltas?.monthWork
        : `+${Math.max(0, countFromDelta(dashboard.deltas.monthWork) + monthWorkDelta)}`,
      pending: `${pendingCount}`
    }
  };
}

function upsertById(rows, item, placement = "end") {
  const list = Array.isArray(rows) ? rows : [];
  const id = String(item?.id || "");
  const existingIndex = list.findIndex((row) => String(row?.id || "") === id);
  if (existingIndex >= 0) {
    return {
      existed: true,
      rows: list.map((row, index) => index === existingIndex ? { ...row, ...item } : row)
    };
  }
  return {
    existed: false,
    rows: placement === "start" ? [item, ...list] : [...list, item]
  };
}

function sortFollowUps(rows, today) {
  return [...rows].sort((left, right) => {
    const bucket = (row) => {
      const date = dateKey(row?.next_follow_date);
      if (date && date < today) return 0;
      if (date === today) return 1;
      return 2;
    };
    const bucketDelta = bucket(left) - bucket(right);
    if (bucketDelta) return bucketDelta;
    const leftDate = dateKey(left?.next_follow_date) || "9999-12-31";
    const rightDate = dateKey(right?.next_follow_date) || "9999-12-31";
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    return String(right?.created_at || "").localeCompare(String(left?.created_at || ""));
  });
}

export function isDashboardTodoPayload(todo) {
  return Boolean(
    todo
    && typeof todo === "object"
    && String(todo.id || "").trim()
    && String(todo.title || "").trim()
    && String(todo.status || "").trim()
    && dateKey(todo.due_date)
  );
}

export function applyAiTodoCreated(dashboard, todo, workLogCreated) {
  if (!dashboard || !isDashboardTodoPayload(todo)) return dashboard;
  const upserted = upsertById(dashboard.openTodos, todo);
  if (upserted.existed) {
    return updateDashboardMetrics(dashboard, upserted.rows, numberValue(dashboard.completedCount));
  }

  const today = dateKey(dashboard.today);
  const month = today.slice(0, 7);
  const workDate = dateKey(todo.due_date) || today;
  const hasWorkLog = Boolean(workLogCreated);
  const workIsToday = hasWorkLog && workDate === today;
  const workIsThisMonth = hasWorkLog && Boolean(month) && workDate.startsWith(month);
  const trend = new Map();
  if (hasWorkLog && workDate) trend.set(workDate, 1);

  return updateDashboardMetrics(dashboard, upserted.rows, numberValue(dashboard.completedCount), {
    today: workIsToday ? 1 : 0,
    month: workIsThisMonth ? 1 : 0,
    trend
  });
}

export function applyTodoConvertedToFollowUp(dashboard, sourceTodo, result) {
  if (!dashboard || !sourceTodo?.id || !result?.todo?.id || !result?.followUp?.id) return dashboard;
  const sourceId = String(sourceTodo.id);
  const openTodos = Array.isArray(dashboard.openTodos) ? dashboard.openTodos : [];
  const sourceExisted = openTodos.some((todo) => String(todo?.id || "") === sourceId);
  const nextOpenTodos = openTodos.filter((todo) => String(todo?.id || "") !== sourceId);
  const followUpRows = upsertById(dashboard.followUps, result.followUp).rows;
  const today = dateKey(dashboard.today);
  const month = today.slice(0, 7);
  const oldWorkDate = dateKey(sourceTodo.due_date) || today;
  const workMovedToToday = sourceExisted && Boolean(today) && oldWorkDate !== today;
  const workMovedToMonth = sourceExisted && Boolean(month) && !oldWorkDate.startsWith(month);
  const trend = new Map();
  if (workMovedToToday) {
    trend.set(oldWorkDate, -1);
    trend.set(today, (trend.get(today) || 0) + 1);
  }
  const completedCount = numberValue(dashboard.completedCount) + (sourceExisted ? 1 : 0);
  const nextDashboard = updateDashboardMetrics(dashboard, nextOpenTodos, completedCount, {
    today: workMovedToToday ? 1 : 0,
    month: workMovedToMonth ? 1 : 0,
    completedToday: sourceExisted && today ? 1 : 0,
    trend
  });

  return {
    ...nextDashboard,
    followUps: sortFollowUps(followUpRows, today)
  };
}
