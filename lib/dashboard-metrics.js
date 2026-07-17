const DONE_STATUSES = new Set(["已完成", "完成", "Done", "done"]);

function dateKey(value) {
  return String(value || "").slice(0, 10);
}

export function isCompletedWork(work) {
  return DONE_STATUSES.has(String(work?.status || "").trim());
}

export function getWorkPriorityLabel(work) {
  const values = [work?.impact, work?.priority, work?.category]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  const important = values.some((value) => /重要|緊急|urgent|critical|high/.test(value) || ["高", "中", "medium"].includes(value));
  return important ? "重要" : "一般";
}

export function getMonthCompletionMetrics(works, today) {
  const month = dateKey(today).slice(0, 7);
  const monthWorks = (Array.isArray(works) ? works : []).filter((work) => {
    const workDate = dateKey(work?.date || work?.created_at);
    return Boolean(month) && workDate.startsWith(month);
  });
  const completed = monthWorks.filter(isCompletedWork).length;
  const total = monthWorks.length;
  return {
    completed,
    total,
    rate: total ? Math.round((completed / total) * 100) : 0
  };
}
