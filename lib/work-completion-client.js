import { findRelatedFollowUps } from "./work-follow-up";

async function request(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.message || "待追蹤資料更新失敗");
  return payload.data;
}

export async function loadRelatedFollowUps(work) {
  const rows = await request("/api/follow-ups");
  return findRelatedFollowUps(work, Array.isArray(rows) ? rows : []);
}

export async function settleWorkFollowUps({ work, related, mode, closeRelated, nextFollowDate }) {
  const relatedRows = Array.isArray(related) ? related : [];
  let created = null;
  let closedCount = 0;

  if (mode === "follow_up" && relatedRows.length === 0) {
    const result = await request("/api/follow-ups", {
      method: "POST",
      body: JSON.stringify({
        title: String(work?.title || "").trim() || "未命名工作",
        current_status: "等待回覆",
        next_follow_date: nextFollowDate,
        note: String(work?.note || work?.description || "").trim()
      })
    });
    created = result?.followUp || result;
  }

  if (mode === "complete" && closeRelated && relatedRows.length) {
    await Promise.all(relatedRows.map((row) => request("/api/follow-ups", {
      method: "PATCH",
      body: JSON.stringify({ id: row.id, current_status: "已完成" })
    })));
    closedCount = relatedRows.length;
  }

  return { created, closedCount, keptCount: mode === "follow_up" ? relatedRows.length : 0 };
}
