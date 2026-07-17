function cleanText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function findRelatedFollowUps(work, followUps) {
  const workTitle = cleanText(work?.title);
  const sourceId = String(work?.source_id || "").trim();
  const isTodoWork = String(work?.source || "").trim().toLowerCase() === "todo_logs";

  return (followUps || []).filter((row) => {
    if (!row || String(row.current_status || "").trim() === "已完成") return false;
    if (isTodoWork && sourceId && String(row.source_todo_id || "").trim() === sourceId) return true;

    const followUpTitle = cleanText(row.title);
    if (!workTitle || !followUpTitle) return false;
    if (workTitle === followUpTitle) return true;
    return Math.min(workTitle.length, followUpTitle.length) >= 6
      && (workTitle.includes(followUpTitle) || followUpTitle.includes(workTitle));
  });
}

export function isDueFollowUp(row, today) {
  if (!row || String(row.current_status || "").trim() === "已完成") return false;
  const date = String(row.next_follow_date || "").slice(0, 10);
  return Boolean(date && today && date <= today);
}

export function getTomorrowDate(today) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(today || ""));
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  return date.toISOString().slice(0, 10);
}
