"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const SPORT_OPTIONS = [
  { key: "baseball", label: "棒球", icon: "⚾" },
  { key: "football", label: "足球", icon: "🏆" },
  { key: "basketball", label: "籃球", icon: "🏀" },
  { key: "cycling", label: "自行車", icon: "🚲" },
  { key: "racing", label: "賽車", icon: "🏎" },
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

function isTimeTbd(event) {
  return event?.detail?.details?.time_status === "tbd";
}

function eventTimeLabel(event) {
  if (!event?.start_time || isTimeTbd(event)) return "";
  return taipeiTime(event.start_time);
}

function eventDateTimeLabel(event) {
  if (!event?.start_time) return "-";
  return isTimeTbd(event) ? `${taipeiDate(event.start_time)}（時間未定）` : taipeiDateTime(event.start_time);
}

function formatSyncTime(value) {
  return value ? taipeiDateTime(value) : "尚未同步";
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

function formatPitchers(details, event) {
  const pitchers = details?.probable_pitchers;
  if (!pitchers || typeof pitchers !== "object") return "尚未公布";
  const away = pitcherName(pitchers.away);
  const home = pitcherName(pitchers.home);
  if (away === "尚未公布" && home === "尚未公布") return pitchers.status || "尚未公布";
  const awayLabel = event?.away_team || "客隊";
  const homeLabel = event?.home_team || "主隊";
  return `${awayLabel}：${away} / ${homeLabel}：${home}`;
}

function formatFinalScore(details, event) {
  const score = details?.final_score;
  if (!score || typeof score !== "object") return "賽後更新";
  if (score.away === null || score.away === undefined || score.home === null || score.home === undefined) {
    return score.status || "賽後更新";
  }
  if (event?.away_team || event?.home_team) {
    return `${event?.away_team || "客隊"} ${score.away} - ${score.home} ${event?.home_team || "主隊"}`;
  }
  return `${score.away} - ${score.home}`;
}

function formatDistance(value) {
  if (value === undefined || value === null || value === "") return "尚未公布";
  return typeof value === "number" ? `${value} km` : String(value);
}

function sportDetailRows(event, details) {
  if (event?.sport_type === "cycling") {
    const route = [details.start_location, details.finish_location].filter(Boolean).join(" → ");
    return [
      { label: "賽段", value: details.stage_number ? `Stage ${details.stage_number}` : details.stage || "尚未公布" },
      { label: "賽段類型", value: details.stage_type || "尚未公布" },
      { label: "路線", value: route || "尚未公布" },
      { label: "距離", value: formatDistance(details.distance) }
    ];
  }
  if (event?.sport_type === "racing" || event?.sport_type === "motorsport") {
    return [
      { label: "Grand Prix", value: details.grand_prix || "尚未公布" },
      { label: "Session", value: details.session_name || details.session_type || "尚未公布" },
      { label: "賽道", value: details.circuit || "尚未公布" },
      { label: "國家 / 城市", value: [details.city, details.country].filter(Boolean).join(" / ") || "尚未公布" }
    ];
  }
  if (event?.sport_type === "baseball") {
    return [
      { label: "最終比分", value: formatFinalScore(details, event) },
      { label: "先發投手", value: formatPitchers(details, event) },
      { label: "天氣", value: formatWeather(details.weather) }
    ];
  }
  return [
    { label: "最終比分", value: formatFinalScore(details, event) },
    { label: "天氣", value: formatWeather(details.weather) }
  ];
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

function formatMatchup(event) {
  if (event.away_team && event.home_team) return `${event.away_team} @ ${event.home_team}`;
  return event.title || event.league || event.sport_type || "未命名賽事";
}

function formatChipTitle(event) {
  const parts = [
    event.league ? `[${event.league}]` : "",
    eventTimeLabel(event),
    formatMatchup(event)
  ].filter(Boolean);
  return parts.join(" ");
}

function sortEventsByTime(rows) {
  return [...rows].sort((a, b) => {
    const first = new Date(a.start_time || 0).getTime();
    const second = new Date(b.start_time || 0).getTime();
    if (first !== second) return first - second;
    return formatMatchup(a).localeCompare(formatMatchup(b), "zh-Hant-TW");
  });
}

function EventBadge({ event, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`sports-event-pill ${selected ? "is-selected" : ""} importance-${event.importance || "normal"}`}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect(event);
      }}
      title={formatChipTitle(event)}
    >
      {event.league ? <span>{event.league}</span> : null}
      {eventTimeLabel(event) ? <time>{eventTimeLabel(event)}</time> : null}
      <b>{formatMatchup(event)}</b>
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
  const [selectedDateKey, setSelectedDateKey] = useState("");
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
    map.forEach((dayEvents, dateKey) => {
      map.set(dateKey, sortEventsByTime(dayEvents));
    });
    return map;
  }, [events]);

  const cells = useMemo(() => getMonthCells(month), [month]);
  const todayKey = taipeiDate(new Date());
  const selectedDateEvents = useMemo(() => (
    selectedDateKey ? eventsByDate.get(selectedDateKey) || [] : []
  ), [eventsByDate, selectedDateKey]);

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
      setSelectedEvent((current) => rows.find((row) => row.id === current?.id) || null);
      setSelectedDateKey((current) => (current && rows.some((row) => taipeiDate(row.start_time) === current) ? current : ""));
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
      setSelectedDateKey("");
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

  function selectDate(dateKey) {
    if (!dateKey) return;
    setSelectedDateKey(dateKey);
    setSelectedEvent(null);
  }

  function selectEvent(event) {
    setSelectedDateKey(taipeiDate(event.start_time));
    setSelectedEvent(event);
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
            const visibleEvents = dayEvents.slice(0, 3);
            const hiddenEventCount = Math.max(0, dayEvents.length - visibleEvents.length);
            return (
              <div
                key={`${dateKey || "blank"}-${index}`}
                className={`sports-day-cell ${dateKey === todayKey ? "is-today" : ""} ${dateKey === selectedDateKey && !selectedEvent ? "is-selected-day" : ""}`}
                onClick={() => selectDate(dateKey)}
                onKeyDown={(event) => {
                  if (!dateKey) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectDate(dateKey);
                  }
                }}
                role={dateKey ? "button" : undefined}
                tabIndex={dateKey ? 0 : undefined}
              >
                {dateKey ? <span className="sports-day-number">{dateKey.slice(8)}</span> : null}
                {visibleEvents.map((event) => (
                  <EventBadge
                    key={event.id}
                    event={event}
                    selected={event.id === selectedEvent?.id}
                    onSelect={selectEvent}
                  />
                ))}
                {hiddenEventCount ? (
                  <span className="sports-more">+ {hiddenEventCount} 場</span>
                ) : null}
              </div>
            );
          })}
        </div>

        {emptyMessage ? <div className="sports-empty-state">{emptyMessage}</div> : null}
      </section>

      <aside className="sports-detail-panel">
        {selectedEvent ? (
          <>
            <div className="sports-summary-card">
              <div className="sports-detail-kicker">
                <span>{selectedEvent.league || selectedEvent.sport_type}</span>
                <b>{STATUS_LABELS[selectedEvent.status] || selectedEvent.status || "scheduled"}</b>
              </div>
              <h2>{formatMatchup(selectedEvent)}</h2>
              {selectedEvent.title && selectedEvent.title !== formatMatchup(selectedEvent) ? (
                <p className="sports-summary-subtitle">{selectedEvent.title}</p>
              ) : null}

              <div className="sports-summary-rows">
                <Field label="日期時間" value={eventDateTimeLabel(selectedEvent)} />
                <Field label="場地" value={selectedEvent.venue || "尚未公布"} />
                {sportDetailRows(selectedEvent, selectedDetailData).map((row) => (
                  <Field key={row.label} label={row.label} value={row.value} />
                ))}
                <Field label="最後同步時間" value={formatSyncTime(selectedDetail.last_synced_at)} />
                <LinkField label="來源連結" href={detailSourceUrl} />
              </div>
            </div>

            <details className="sports-technical-details">
              <summary>同步與來源資訊</summary>
              <Field label="detail_status" value={detailStatusLabel} />
              <Field label="detail_status 原始值" value={detailStatus} />
              <Field label="sync_phase" value={selectedDetail.sync_phase} />
              {selectedDetail.source_name ? <Field label="details 來源" value={selectedDetail.source_name} /> : null}
              <Field label="source_type" value={selectedEvent.source_type} />
              <Field label="source_name" value={selectedEvent.source_name} />
              <Field label="source_file" value={selectedEvent.source_file} />
            </details>

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
          </>
        ) : selectedDateKey ? (
          <div className="sports-day-list-panel">
            <div className="sports-detail-kicker">
              <span>{selectedDateKey}</span>
              <b>{selectedDateEvents.length} 場</b>
            </div>
            <h2>當日賽事列表</h2>
            {selectedDateEvents.length ? (
              <div className="sports-day-event-list">
                {selectedDateEvents.map((event) => (
                  <button key={event.id} type="button" className="sports-day-event-row" onClick={() => selectEvent(event)}>
                    <time>{eventTimeLabel(event) || "時間未定"}</time>
                    <span>{event.league || event.sport_type}</span>
                    <b>{formatMatchup(event)}</b>
                    <small>{STATUS_LABELS[event.status] || event.status || "-"}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="sports-detail-empty compact">
                <h2>這天沒有賽事</h2>
                <p>可改選其他日期，或調整左側分類與搜尋條件。</p>
              </div>
            )}
          </div>
        ) : (
          <div className="sports-detail-empty">
            <h2>尚未選取</h2>
            <p>{selectedSportList.length ? "請從月曆選擇日期或賽事。" : "請先從左側選擇賽事分類，再從月曆選擇日期或賽事。"}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
