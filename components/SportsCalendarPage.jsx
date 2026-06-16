"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const SPORT_OPTIONS = [
  { key: "baseball", label: "棒球", icon: "⚾" },
  { key: "football", label: "足球", icon: "🏆" },
  { key: "basketball", label: "籃球", icon: "🏀" },
  { key: "cycling", label: "自行車", icon: "🚲" },
  { key: "motorsport", label: "賽車", icon: "🏎" },
  { key: "tennis", label: "網球", icon: "🎾" },
  { key: "other", label: "其他", icon: "◇" }
];

const STATUS_LABELS = {
  scheduled: "scheduled",
  live: "live",
  completed: "completed",
  postponed: "postponed",
  cancelled: "cancelled"
};

const IMPORTANCE_LABELS = {
  normal: "normal",
  watch: "watch",
  important: "important",
  must_watch: "must_watch"
};

const DETAIL_STATUS_LABELS = {
  not_synced: "尚未同步",
  not_announced: "尚未公布",
  pre_game_synced: "賽前資料已同步",
  waiting_final: "賽後更新",
  post_game_synced: "賽後資料已同步"
};

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "資料讀取失敗");
  return data.data;
}

function taipeiDate(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value ? new Date(value) : new Date());
}

function taipeiTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function taipeiDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatSyncTime(value) {
  return value ? taipeiDateTime(value) : "尚未同步";
}

function valueOrPending(value, pending = "尚未公布") {
  if (value === undefined || value === null || value === "") return pending;
  return value;
}

function formatWeather(weather) {
  if (!weather || typeof weather !== "object") return "尚未同步";
  const parts = [
    weather.summary || weather.condition,
    weather.temperature ? `${weather.temperature}°` : "",
    weather.rain_probability ? `降雨 ${weather.rain_probability}` : "",
    weather.wind ? `風 ${weather.wind}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "尚未公布";
}

function pitcherName(value) {
  if (!value) return "尚未公布";
  if (typeof value === "string") return value || "尚未公布";
  return value.name || "尚未公布";
}

function formatPitchers(details) {
  const pitchers = details?.probable_pitchers;
  if (!pitchers || typeof pitchers !== "object") return "尚未同步";
  const away = pitcherName(pitchers.away);
  const home = pitcherName(pitchers.home);
  if (away === "尚未公布" && home === "尚未公布") return pitchers.status || "尚未公布";
  return `客隊：${away} / 主隊：${home}`;
}

function formatFinalScore(details) {
  const score = details?.final_score;
  if (!score || typeof score !== "object") return "賽後更新";
  if (score.away === null || score.away === undefined || score.home === null || score.home === undefined) {
    return score.status || "賽後更新";
  }
  return `${score.away} : ${score.home}`;
}

function currentTaipeiMonth() {
  return taipeiDate(new Date()).slice(0, 7);
}

function addMonths(month, delta) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1, 4));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthCells(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const cells = [];
  for (let index = 0; index < first.getDay(); index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getWeekRange() {
  const todayKey = taipeiDate(new Date());
  const date = new Date(`${todayKey}T00:00:00+08:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return {
    from: start.toISOString(),
    to: end.toISOString()
  };
}

function favoriteKey(type, value) {
  return `${type}:${value}`;
}

function EventBadge({ event, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`sports-event-pill ${selected ? "is-selected" : ""} importance-${event.importance || "normal"}`}
      onClick={() => onSelect(event)}
      title={event.title}
    >
      <span>{event.league || event.sport_type}</span>
      <b>{event.away_team && event.home_team ? `${event.away_team} vs ${event.home_team}` : event.title}</b>
      <time>{taipeiTime(event.start_time)}</time>
    </button>
  );
}

function Field({ label, value }) {
  return (
    <div className="sports-detail-field">
      <span>{label}</span>
      <b>{value || "-"}</b>
    </div>
  );
}

function LinkField({ label, href }) {
  return (
    <div className="sports-detail-field">
      <span>{label}</span>
      {href ? <a href={href} target="_blank" rel="noreferrer">開啟來源</a> : <b>尚未同步</b>}
    </div>
  );
}

export default function SportsCalendarPage() {
  const [month, setMonth] = useState(currentTaipeiMonth);
  const [selectedSports, setSelectedSports] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [rangeMode, setRangeMode] = useState("month");
  const [viewMode, setViewMode] = useState("month");
  const [events, setEvents] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detailDraft, setDetailDraft] = useState({ importance: "normal", notes: "" });

  const selectedSportList = useMemo(() => [...selectedSports], [selectedSports]);
  const selectedSportKey = selectedSportList.join(",");
  const favoriteMap = useMemo(() => {
    const map = new Set();
    favorites.forEach((favorite) => map.add(favoriteKey(favorite.favorite_type, favorite.favorite_value)));
    return map;
  }, [favorites]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const key = taipeiDate(event.start_time);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    });
    return map;
  }, [events]);

  const cells = useMemo(() => getMonthCells(month), [month]);
  const todayKey = taipeiDate(new Date());

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadEvents = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        month,
        sportTypes: selectedSportKey
      });
      if (query.trim()) params.set("q", query.trim());
      if (rangeMode === "today") {
        const today = taipeiDate(new Date());
        params.set("from", today);
        const tomorrow = new Date(`${today}T00:00:00+08:00`);
        tomorrow.setDate(tomorrow.getDate() + 1);
        params.set("to", tomorrow.toISOString());
      }
      if (rangeMode === "week") {
        const range = getWeekRange();
        params.set("from", range.from);
        params.set("to", range.to);
      }
      const rows = await api(`/api/sports/events?${params.toString()}`, { signal });
      setEvents(rows);
      setSelectedEvent((current) => rows.find((row) => row.id === current?.id) || rows[0] || null);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "賽事資料讀取失敗");
        setEvents([]);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [month, query, rangeMode, selectedSportKey]);

  useEffect(() => {
    if (!selectedSportList.length) {
      setEvents([]);
      setSelectedEvent(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    loadEvents(controller.signal);
    return () => controller.abort();
  }, [loadEvents, selectedSportList.length]);

  useEffect(() => {
    if (!selectedEvent) {
      setDetailDraft({ importance: "normal", notes: "" });
      return;
    }
    setDetailDraft({
      importance: selectedEvent.importance || "normal",
      notes: selectedEvent.notes || ""
    });
  }, [selectedEvent]);

  async function loadFavorites() {
    setFavoritesLoading(true);
    try {
      setFavorites(await api("/api/sports/favorites"));
    } catch (err) {
      setError(err.message || "收藏資料讀取失敗");
    } finally {
      setFavoritesLoading(false);
    }
  }

  function toggleSport(type) {
    setSelectedSports((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleAllSports() {
    setSelectedSports((current) => (
      current.size === SPORT_OPTIONS.length ? new Set() : new Set(SPORT_OPTIONS.map((item) => item.key))
    ));
  }

  async function saveEventDetails() {
    if (!selectedEvent) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api(`/api/sports/events/${selectedEvent.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          importance: detailDraft.importance,
          notes: detailDraft.notes
        })
      });
      setSelectedEvent(updated);
      setEvents((current) => current.map((event) => (event.id === updated.id ? updated : event)));
    } catch (err) {
      setError(err.message || "賽事更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite(type, value, displayName, metadata = {}) {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) return;
    const key = favoriteKey(type, cleanValue);
    setSaving(true);
    setError("");
    try {
      if (favoriteMap.has(key)) {
        const params = new URLSearchParams({ favorite_type: type, favorite_value: cleanValue });
        await api(`/api/sports/favorites?${params.toString()}`, { method: "DELETE" });
      } else {
        await api("/api/sports/favorites", {
          method: "POST",
          body: JSON.stringify({
            favorite_type: type,
            favorite_value: cleanValue,
            display_name: displayName || cleanValue,
            metadata
          })
        });
      }
      await loadFavorites();
    } catch (err) {
      setError(err.message || "收藏更新失敗");
    } finally {
      setSaving(false);
    }
  }

  function selectQuickRange(mode) {
    setRangeMode(mode);
    if (mode === "today") setMonth(todayKey.slice(0, 7));
  }

  function selectedRangeMessage() {
    if (!selectedSportList.length) return "請從左側選擇賽事分類";
    if (loading) return "賽事讀取中...";
    if (!events.length && query.trim()) return "搜尋結果沒有符合條件的賽事";
    if (!events.length) return "目前月份沒有符合條件的賽事";
    return "";
  }

  const emptyMessage = selectedRangeMessage();
  const selectedEventValue = selectedEvent?.event_key || selectedEvent?.id;
  const selectedDetail = selectedEvent?.detail || {};
  const selectedDetailData = selectedDetail.details || {};
  const detailStatus = selectedDetail.detail_status || "not_synced";
  const detailStatusLabel = DETAIL_STATUS_LABELS[detailStatus] || detailStatus;
  const detailSourceUrl = selectedDetail.source_url || selectedDetailData.source_url || selectedDetailData.box_url || "";

  return (
    <div className="sports-calendar-page">
      <aside className="sports-filter-panel">
        <div className="sports-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋球隊、聯盟或賽事"
          />
        </div>

        <section className="sports-filter-section">
          <button type="button" className={rangeMode === "today" ? "active" : ""} onClick={() => selectQuickRange("today")}>今天</button>
          <button type="button" className={rangeMode === "week" ? "active" : ""} onClick={() => selectQuickRange("week")}>本週</button>
          <button type="button" className={rangeMode === "month" ? "active" : ""} onClick={() => selectQuickRange("month")}>本月</button>
        </section>

        <section className="sports-side-block">
          <h2>收藏</h2>
          {favoritesLoading ? <p>讀取中...</p> : null}
          {!favoritesLoading && favorites.length === 0 ? <p>尚未收藏任何項目。</p> : null}
          <div className="sports-favorite-list">
            {favorites.map((favorite) => (
              <span key={favorite.id || favoriteKey(favorite.favorite_type, favorite.favorite_value)}>
                <b>{favorite.favorite_type}</b>
                {favorite.display_name || favorite.favorite_value}
              </span>
            ))}
          </div>
        </section>

        <section className="sports-side-block">
          <h2>賽事分類</h2>
          <button type="button" className="sports-check-row" onClick={toggleAllSports}>
            <span className={selectedSports.size === SPORT_OPTIONS.length ? "checked" : ""} />
            <b>全選</b>
            <small>{selectedSports.size}</small>
          </button>
          {SPORT_OPTIONS.map((sport) => (
            <button key={sport.key} type="button" className="sports-check-row" onClick={() => toggleSport(sport.key)}>
              <span className={selectedSports.has(sport.key) ? "checked" : ""} />
              <b>{sport.icon} {sport.label}</b>
            </button>
          ))}
        </section>
      </aside>

      <section className="sports-calendar-main">
        <header className="sports-calendar-header">
          <div>
            <h1>Sports Calendar 體育賽事日曆</h1>
            <p>{month.replace("-", " / ")} · GMT+8</p>
          </div>
          <div className="sports-calendar-controls">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="上一月">‹</button>
            <button type="button" onClick={() => setMonth(currentTaipeiMonth())}>今天</button>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="下一月">›</button>
            <div className="sports-segmented" role="tablist" aria-label="Calendar view">
              {["day", "week", "month"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={viewMode === mode ? "active" : ""}
                  onClick={() => setViewMode(mode)}
                  title={mode === "month" ? "月視圖" : "此版本保留切換按鈕"}
                >
                  {mode === "day" ? "日" : mode === "week" ? "週" : "月"}
                </button>
              ))}
            </div>
          </div>
        </header>

        {error ? <div className="sports-alert">{error}</div> : null}

        <div className="sports-month-grid">
          {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
            <div key={day} className="sports-weekday">{day}</div>
          ))}
          {cells.map((dateKey, index) => {
            const dayEvents = dateKey ? eventsByDate.get(dateKey) || [] : [];
            return (
              <div key={`${dateKey || "blank"}-${index}`} className={`sports-day-cell ${dateKey === todayKey ? "is-today" : ""}`}>
                {dateKey ? <span className="sports-day-number">{dateKey.slice(8)}</span> : null}
                {dayEvents.slice(0, 4).map((event) => (
                  <EventBadge
                    key={event.id}
                    event={event}
                    selected={event.id === selectedEvent?.id}
                    onSelect={setSelectedEvent}
                  />
                ))}
                {dayEvents.length > 4 ? <small className="sports-more">+{dayEvents.length - 4}</small> : null}
              </div>
            );
          })}
        </div>

        {emptyMessage ? <div className="sports-empty-state">{emptyMessage}</div> : null}
      </section>

      <aside className="sports-detail-panel">
        {selectedEvent ? (
          <>
            <div className="sports-detail-kicker">
              <span>{selectedEvent.league || selectedEvent.sport_type}</span>
              <b>{detailStatusLabel}</b>
            </div>
            <h2>{selectedEvent.title}</h2>
            <div className="sports-detail-grid">
              <Field label="運動分類" value={selectedEvent.sport_type} />
              <Field label="聯盟" value={selectedEvent.league} />
              <Field label="主隊" value={selectedEvent.home_team} />
              <Field label="客隊" value={selectedEvent.away_team} />
              <Field label="開始時間" value={taipeiDateTime(selectedEvent.start_time)} />
              <Field label="結束時間" value={taipeiDateTime(selectedEvent.end_time)} />
              <Field label="地點" value={selectedEvent.venue} />
              <Field label="狀態" value={STATUS_LABELS[selectedEvent.status] || selectedEvent.status} />
            </div>

            <div className="sports-detail-grid sports-live-detail-grid">
              <Field label="details 狀態" value={detailStatusLabel} />
              <Field label="天氣" value={formatWeather(selectedDetailData.weather)} />
              <Field label="先發投手" value={selectedEvent.sport_type === "baseball" ? formatPitchers(selectedDetailData) : "此運動暫無此欄位"} />
              <Field label="最終比分" value={formatFinalScore(selectedDetailData)} />
              <Field label="最後同步時間" value={formatSyncTime(selectedDetail.last_synced_at)} />
              <LinkField label="來源連結" href={detailSourceUrl} />
              {selectedDetail.source_name ? <Field label="details 來源" value={selectedDetail.source_name} /> : null}
              {selectedDetail.sync_phase ? <Field label="同步階段" value={selectedDetail.sync_phase} /> : null}
            </div>

            <div className="sports-editor">
              <label>
                <span>重要程度</span>
                <select value={detailDraft.importance} onChange={(event) => setDetailDraft((current) => ({ ...current, importance: event.target.value }))}>
                  {Object.keys(IMPORTANCE_LABELS).map((value) => (
                    <option key={value} value={value}>{IMPORTANCE_LABELS[value]}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>備註 notes</span>
                <textarea
                  value={detailDraft.notes}
                  onChange={(event) => setDetailDraft((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  placeholder="加入內部備註..."
                />
              </label>
              <button type="button" onClick={saveEventDetails} disabled={saving}>
                {saving ? "儲存中" : "儲存變更"}
              </button>
            </div>

            <div className="sports-favorite-actions">
              <button
                type="button"
                onClick={() => toggleFavorite("event", selectedEventValue, selectedEvent.title, { event_id: selectedEvent.id })}
                className={favoriteMap.has(favoriteKey("event", selectedEventValue)) ? "active" : ""}
                disabled={saving}
              >
                ☆ 收藏此賽事
              </button>
              {selectedEvent.league ? (
                <button
                  type="button"
                  onClick={() => toggleFavorite("league", selectedEvent.league, selectedEvent.league)}
                  className={favoriteMap.has(favoriteKey("league", selectedEvent.league)) ? "active" : ""}
                  disabled={saving}
                >
                  ☆ 收藏此聯盟
                </button>
              ) : null}
              {[selectedEvent.away_team, selectedEvent.home_team].filter(Boolean).map((team) => (
                <button
                  key={team}
                  type="button"
                  onClick={() => toggleFavorite("team", team, team)}
                  className={favoriteMap.has(favoriteKey("team", team)) ? "active" : ""}
                  disabled={saving}
                >
                  ☆ 收藏 {team}
                </button>
              ))}
            </div>

            <div className="sports-source-box">
              <Field label="source_type" value={selectedEvent.source_type} />
              <Field label="source_name" value={selectedEvent.source_name} />
              <Field label="source_file" value={selectedEvent.source_file} />
            </div>
          </>
        ) : (
          <div className="sports-detail-empty">
            <h2>尚未選取賽事</h2>
            <p>{selectedSportList.length ? "點選月曆中的賽事查看詳情。" : "請先從左側選擇賽事分類。"}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
