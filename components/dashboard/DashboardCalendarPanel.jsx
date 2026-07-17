"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/dashboard-api";
import { dateKey, getLocalDateKey, getTodayKey } from "../../lib/dashboard-formatters";
import { isThreeDigitRoomNumber } from "../../lib/room-number";
import { selectTodayFollowUpReminders } from "../../lib/calendarReminders";

const CALENDAR_EVENT_TYPES = ["任務", "巡檢", "維護", "會議", "其他"];

function formatCalendarDate(dateKeyValue) {
  return dateKeyValue ? dateKeyValue.replaceAll("-", "/") : "";
}

function getMonthLabel(date) {
  return `${date.getMonth() + 1}月`;
}

function reminderSummary(label, rows, titleKey = "title") {
  const list = Array.isArray(rows) ? rows : [];
  const titles = list.slice(0, 3).map((item) => String(item?.[titleKey] || "未命名事項").trim()).filter(Boolean);
  const remaining = Math.max(0, list.length - titles.length);
  return `${label} ${list.length} 件${titles.length ? `：${titles.join("、")}${remaining ? `，另 ${remaining} 件` : ""}` : ""}`;
}

function getTodayPhoneTargets(date = new Date()) {
  const phoneMap = {
    1: ["RV", "FB"],
    2: ["FB", "FO"],
    3: ["FO", "HK"],
    4: ["HK", "SPA"],
    5: ["Rec", "RV"]
  };
  return phoneMap[date.getDay()] || [];
}

function CalendarTodayTest({ networkRooms }) {
  const streamRooms = (networkRooms || [])
    .map((room) => String(room.room_no || room.room || "").trim())
    .filter(isThreeDigitRoomNumber);
  const phoneTargets = getTodayPhoneTargets();

  return (
    <div className="calendar-today-test" aria-label="今日測試">
      <b>今日測試</b>
      <span>
        串流：{streamRooms.length ? streamRooms.join("、") : "今日尚未指派"}
      </span>
      <span>
        錄音：{phoneTargets.length ? phoneTargets.join("、") : "-"}
      </span>
    </div>
  );
}

export default function DashboardCalendarPanel({ dashboard, notify }) {
  const router = useRouter();
  const todayKey = getTodayKey();
  const networkRooms = dashboard?.networkRooms || [];
  const todayFollowUps = selectTodayFollowUpReminders(
    dashboard?.followUps || [],
    dashboard?.openWorks || [],
    todayKey
  );
  const todayFollowUpCount = todayFollowUps.length;
  const todayFollowUpSummary = reminderSummary("今日待追蹤", todayFollowUps);
  const contractReminders = dashboard?.contractReminders || [];
  const contractRemindersByDate = contractReminders.reduce((rowsByDate, reminder) => {
    const reminderDate = dateKey(reminder.end_date);
    if (reminderDate) rowsByDate[reminderDate] = [...(rowsByDate[reminderDate] || []), reminder];
    return rowsByDate;
  }, {});
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const today = new Date().getDate();
  const isCurrentMonth = todayKey.startsWith(`${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: "",
    date: todayKey,
    type: CALENDAR_EVENT_TYPES[0]
  });
  const [calendarEvents, setCalendarEvents] = useState({});
  const [isCalendarLoading, setIsCalendarLoading] = useState(true);
  const [calendarSetupMessage, setCalendarSetupMessage] = useState("");
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [deletingEventIds, setDeletingEventIds] = useState(() => new Set());
  const [reminderTooltip, setReminderTooltip] = useState(null);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  function showReminderTooltip(event, text) {
    const rect = event.currentTarget.getBoundingClientRect();
    const left = Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2));
    setReminderTooltip({ text, left, top: rect.bottom + 7 });
  }

  function groupCalendarEvents(rows) {
    return (Array.isArray(rows) ? rows : []).reduce((eventsByDate, event) => {
      const eventDate = dateKey(event.event_date);
      if (!eventDate) return eventsByDate;
      const nextEvent = {
        id: event.id,
        event_date: eventDate,
        event_time: event.event_time || "",
        title: event.title || "未命名行程",
        event_type: event.event_type || "任務",
        note: event.note || ""
      };
      eventsByDate[eventDate] = [...(eventsByDate[eventDate] || []), nextEvent];
      return eventsByDate;
    }, {});
  }

  useEffect(() => {
    let isMounted = true;
    async function loadCalendarEvents() {
      setIsCalendarLoading(true);
      try {
        const result = await api("/api/calendar-events");
        if (!isMounted) return;
        const rows = Array.isArray(result) ? result : result?.events || [];
        setCalendarSetupMessage(result?.needsSetup ? result.message || "行事曆資料表尚未建立" : "");
        setCalendarEvents(groupCalendarEvents(rows));
      } catch (error) {
        if (!isMounted) return;
        setCalendarSetupMessage("");
        notify?.({ tone: "error", message: error.message || "行事曆讀取失敗" });
      } finally {
        if (isMounted) setIsCalendarLoading(false);
      }
    }
    loadCalendarEvents();
    return () => {
      isMounted = false;
    };
  }, [notify]);

  useEffect(() => {
    if (!isDayDetailOpen && !isEventModalOpen) return undefined;
    function handleEscape(event) {
      if (event.key !== "Escape") return;
      if (isEventModalOpen) closeEventModal();
      else setIsDayDetailOpen(false);
    }
    document.body.classList.add("calendar-overlay-open");
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.classList.remove("calendar-overlay-open");
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isDayDetailOpen, isEventModalOpen]);

  useEffect(() => {
    function handleMobileAction(event) {
      const action = event?.detail?.action;
      if (action !== "calendar" && action !== "add-calendar") return;
      document.getElementById("dashboard-calendar-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (action !== "add-calendar") return;
      if (calendarSetupMessage) {
        notify?.({ tone: "error", message: calendarSetupMessage });
        return;
      }
      setIsDayDetailOpen(false);
      setEditingEvent(null);
      setEventForm({
        title: "",
        date: selectedDate,
        type: CALENDAR_EVENT_TYPES[0]
      });
      setIsEventModalOpen(true);
    }
    window.addEventListener("dashboard-mobile-action", handleMobileAction);
    return () => window.removeEventListener("dashboard-mobile-action", handleMobileAction);
  }, [selectedDate, calendarSetupMessage, notify]);

  function upsertCalendarEvent(current, event, previousDate = "") {
    const eventDate = dateKey(event.event_date);
    if (!eventDate) return current;
    const nextEvents = { ...current };
    if (previousDate && previousDate !== eventDate) {
      const remaining = (nextEvents[previousDate] || []).filter((item) => item.id !== event.id);
      if (remaining.length) nextEvents[previousDate] = remaining;
      else delete nextEvents[previousDate];
    }
    const existingRows = (nextEvents[eventDate] || []).filter((item) => item.id !== event.id);
    nextEvents[eventDate] = [...existingRows, event];
    return nextEvents;
  }

  function selectMonth(nextMonth) {
    setVisibleMonth(nextMonth);
    const nextMonthPrefix = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
    setSelectedDate(todayKey.startsWith(nextMonthPrefix) ? todayKey : getLocalDateKey(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
  }

  function shiftMonth(offset) {
    selectMonth(new Date(year, month + offset, 1));
  }

  function jumpToToday() {
    const now = new Date();
    selectMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey);
  }

  function openEventModal(dateValue = selectedDate) {
    if (calendarSetupMessage) {
      notify?.({ tone: "error", message: calendarSetupMessage });
      return;
    }
    setSelectedDate(dateValue);
    setIsDayDetailOpen(false);
    setEditingEvent(null);
    setEventForm({
      title: "",
      date: dateValue,
      type: CALENDAR_EVENT_TYPES[0]
    });
    setIsEventModalOpen(true);
  }

  function openEditEventModal(event) {
    if (calendarSetupMessage || !event?.id) {
      if (calendarSetupMessage) notify?.({ tone: "error", message: calendarSetupMessage });
      return;
    }
    const eventDate = dateKey(event.event_date) || selectedDate;
    setSelectedDate(eventDate);
    setIsDayDetailOpen(false);
    setEditingEvent(event);
    setEventForm({
      title: event.title || "",
      date: eventDate,
      type: event.event_type || CALENDAR_EVENT_TYPES[0]
    });
    setIsEventModalOpen(true);
  }

  function closeEventModal() {
    setIsEventModalOpen(false);
    setEditingEvent(null);
  }

  function selectCalendarDay(dateValue) {
    setSelectedDate(dateValue);
    if (window.matchMedia("(max-width: 620px)").matches) setIsDayDetailOpen(true);
  }

  async function saveCalendarEvent(event) {
    event.preventDefault();
    const title = eventForm.title.trim();
    if (!title || calendarSaving) return;
    const eventDate = dateKey(eventForm.date);
    const isEditingExistingEvent = Boolean(editingEvent?.id);
    const originalEvent = editingEvent;
    const originalDate = dateKey(originalEvent?.event_date);
    const tempId = `temp-calendar-${Date.now()}`;
    const optimisticEvent = {
      id: isEditingExistingEvent ? originalEvent.id : tempId,
      event_date: eventDate,
      event_time: "",
      title,
      event_type: eventForm.type,
      note: ""
    };
    setCalendarSaving(true);
    setSelectedDate(eventDate);
    setIsEventModalOpen(false);
    setEditingEvent(null);
    setCalendarEvents((current) => ({
      ...upsertCalendarEvent(current, optimisticEvent, isEditingExistingEvent ? originalDate : "")
    }));
    try {
      const nextEvent = await api("/api/calendar-events", {
        method: isEditingExistingEvent ? "PATCH" : "POST",
        body: JSON.stringify({
          id: isEditingExistingEvent ? originalEvent.id : undefined,
          event_date: eventForm.date,
          event_time: null,
          title,
          event_type: eventForm.type,
          note: null
        })
      });
      setCalendarEvents((current) => ({
        ...upsertCalendarEvent(current, {
          id: nextEvent.id,
          event_date: eventDate,
          event_time: "",
          title: nextEvent.title || title,
          event_type: nextEvent.event_type || eventForm.type,
          note: ""
        }, isEditingExistingEvent ? originalDate : "")
      }));
      notify?.({ tone: "success", message: isEditingExistingEvent ? "行程已更新" : `已新增到 ${formatCalendarDate(eventDate)}` });
    } catch (error) {
      setCalendarEvents((current) => {
        if (isEditingExistingEvent && originalEvent) return upsertCalendarEvent(current, originalEvent, eventDate);
        const nextEvents = { ...current };
        const remaining = (nextEvents[eventDate] || []).filter((item) => item.id !== tempId);
        if (remaining.length) nextEvents[eventDate] = remaining;
        else delete nextEvents[eventDate];
        return nextEvents;
      });
      notify?.({ tone: "error", message: error.message || (isEditingExistingEvent ? "行程更新失敗" : "行程新增失敗") });
    } finally {
      setCalendarSaving(false);
    }
  }

  async function deleteCalendarEvent(eventId, eventDate) {
    if (!eventId || deletingEventIds.has(eventId)) return;
    setDeletingEventIds((current) => new Set(current).add(eventId));
    try {
      await api(`/api/calendar-events?id=${encodeURIComponent(eventId)}`, { method: "DELETE" });
      setCalendarEvents((current) => {
        const nextEvents = { ...current };
        const remaining = (nextEvents[eventDate] || []).filter((event) => event.id !== eventId);
        if (remaining.length) nextEvents[eventDate] = remaining;
        else delete nextEvents[eventDate];
        return nextEvents;
      });
      notify?.({ tone: "success", message: "已刪除行程" });
    } catch (error) {
      notify?.({ tone: "error", message: error.message || "行程刪除失敗" });
    } finally {
      setDeletingEventIds((current) => {
        const next = new Set(current);
        next.delete(eventId);
        return next;
      });
    }
  }

  return (
    <section id="dashboard-calendar-panel" className="panel dashboard-calendar-panel">
      <header className="panel-title calendar-title">
        <div>
          <h2>行事曆 <b>{getMonthLabel(visibleMonth)}</b></h2>
        </div>
        <div className="calendar-actions">
          <div className="calendar-reminder-legend" aria-label="行事曆提醒圖例">
            <span><i className="tone-todo" aria-hidden="true" />今日待追蹤</span>
            <span><i className="tone-contract" aria-hidden="true" />50 天內到期</span>
          </div>
          <button
            type="button"
            className="sports-calendar-easter-egg"
            title="Sports Calendar"
            aria-label="Open Sports Calendar"
            onClick={() => router.push("/calendar")}
          >
            🏆
          </button>
          <button className="calendar-add-main" type="button" onClick={() => openEventModal(selectedDate)} disabled={Boolean(calendarSetupMessage)} aria-label="新增行程" title="新增行程">
            ＋
          </button>
          <button type="button" aria-label="上一月" onClick={() => shiftMonth(-1)}>‹</button>
          <button type="button" onClick={jumpToToday}>今日</button>
          <button type="button" aria-label="下一月" onClick={() => shiftMonth(1)}>›</button>
        </div>
      </header>
      <CalendarTodayTest networkRooms={networkRooms} />
      <div className="calendar-grid dashboard-calendar-grid">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <div key={day} className="weekday">{day}</div>
        ))}
        {cells.map((day, index) => {
          const cellDate = day ? getLocalDateKey(year, month, day) : "";
          const dayEvents = cellDate ? calendarEvents[cellDate] || [] : [];
          const dayContractReminders = cellDate ? contractRemindersByDate[cellDate] || [] : [];
          const hasTodayFollowUpReminder = cellDate === todayKey && todayFollowUpCount > 0;
          const contractReminderSummary = reminderSummary("合約到期", dayContractReminders);
          const visibleDayEvents = dayEvents.slice(0, 2);
          const hiddenEventCount = Math.max(0, dayEvents.length - visibleDayEvents.length);
          return (
            <div
              key={`${day || "blank"}-${index}`}
              className={`day-cell dashboard-day-cell ${cellDate === selectedDate ? "is-selected" : ""}`}
      onClick={() => day && selectCalendarDay(cellDate)}
      onDoubleClick={() => day && openEventModal(cellDate)}
            >
              {day ? (
              <>
                <button
                  className="calendar-cell-add"
                  type="button"
                  disabled={Boolean(calendarSetupMessage)}
                  aria-label={`新增到 ${formatCalendarDate(cellDate)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openEventModal(cellDate);
                  }}
                >
                  +
                </button>
                <div className="calendar-cell-date-row">
                  <span className="calendar-date-badge">
                    <span className={`calendar-day-number ${isCurrentMonth && day === today ? "today-dot" : ""}`}>{String(day).padStart(2, "0")}</span>
                    {hasTodayFollowUpReminder || dayContractReminders.length ? (
                      <span className="calendar-reminder-dots">
                        {hasTodayFollowUpReminder ? (
                          <button
                            className="calendar-reminder-trigger"
                            type="button"
                            aria-label={todayFollowUpSummary}
                            onMouseEnter={(event) => showReminderTooltip(event, todayFollowUpSummary)}
                            onMouseLeave={() => setReminderTooltip(null)}
                            onFocus={(event) => showReminderTooltip(event, todayFollowUpSummary)}
                            onBlur={() => setReminderTooltip(null)}
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}
                          >
                            <i className="calendar-reminder-dot tone-todo" aria-hidden="true" />
                          </button>
                        ) : null}
                        {dayContractReminders.length ? (
                          <button
                            className="calendar-reminder-trigger"
                            type="button"
                            aria-label={contractReminderSummary}
                            onMouseEnter={(event) => showReminderTooltip(event, contractReminderSummary)}
                            onMouseLeave={() => setReminderTooltip(null)}
                            onFocus={(event) => showReminderTooltip(event, contractReminderSummary)}
                            onBlur={() => setReminderTooltip(null)}
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}
                          >
                            <i className="calendar-reminder-dot tone-contract" aria-hidden="true" />
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </div>
                {dayEvents.length ? (
                  <span className="calendar-mobile-event-marker" aria-label={`${dayEvents.length} 個行程`}>
                    <i aria-hidden="true" />
                    {dayEvents.length > 1 ? <i aria-hidden="true" /> : null}
                    {dayEvents.length > 2 ? <i aria-hidden="true" /> : null}
                    <b>{dayEvents.length}</b>
                  </span>
                ) : null}
                {visibleDayEvents.map((event) => (
                  <em
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    title="雙擊編輯"
                    onDoubleClick={(mouseEvent) => {
                      mouseEvent.stopPropagation();
                      openEditEventModal(event);
                    }}
                    onKeyDown={(keyboardEvent) => {
                      if (keyboardEvent.key === "Enter") openEditEventModal(event);
                    }}
                  >
                    {event.title}
                  </em>
                ))}
                {hiddenEventCount ? <em className="calendar-more-events">+{hiddenEventCount} 筆</em> : null}
              </>
              ) : null}
            </div>
          );
        })}
      </div>
      {reminderTooltip ? (
        <div
          id="calendar-reminder-tooltip"
          className="calendar-reminder-tooltip"
          role="tooltip"
          style={{ left: reminderTooltip.left, top: reminderTooltip.top }}
        >
          {reminderTooltip.text}
        </div>
      ) : null}
      {isDayDetailOpen ? (
        <div className="mobile-calendar-detail-backdrop" role="presentation" onMouseDown={() => setIsDayDetailOpen(false)}>
          <section className="mobile-calendar-detail" role="dialog" aria-modal="true" aria-labelledby="mobile-calendar-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>當日行程</span>
                <h3 id="mobile-calendar-detail-title">{formatCalendarDate(selectedDate)}</h3>
              </div>
              <button type="button" aria-label="關閉當日行程" onClick={() => setIsDayDetailOpen(false)}>×</button>
            </header>
            <div className="mobile-calendar-event-list">
              {(calendarEvents[selectedDate] || []).length ? (calendarEvents[selectedDate] || []).map((event) => (
                <button type="button" key={event.id} onClick={() => openEditEventModal(event)}>
                  <span>{event.event_type || "行程"}</span>
                  <strong>{event.title}</strong>
                  <small>點擊查看或編輯</small>
                </button>
              )) : (
                <div className="mobile-calendar-empty">
                  <strong>這天還沒有行程</strong>
                  <span>可以直接建立新的工作安排。</span>
                </div>
              )}
            </div>
            <button className="mobile-calendar-add" type="button" onClick={() => openEventModal(selectedDate)} disabled={Boolean(calendarSetupMessage)}>
              ＋ 新增這天的行程
            </button>
          </section>
        </div>
      ) : null}
      {calendarSetupMessage ? <p className="calendar-setup-message">{calendarSetupMessage}</p> : null}
      {isEventModalOpen ? (
        <div className="calendar-modal-backdrop" role="presentation" onMouseDown={closeEventModal}>
          <form className="calendar-modal" role="dialog" aria-modal="true" onSubmit={saveCalendarEvent} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h3>{editingEvent ? "編輯行程" : "新增行程"}</h3>
                <span>{formatCalendarDate(eventForm.date)}</span>
              </div>
              <button type="button" aria-label="關閉新增行程" onClick={closeEventModal}>×</button>
            </header>
            <label>
              標題
              <input
                value={eventForm.title}
                onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="輸入行程標題"
                required
                autoFocus
              />
            </label>
            <label>
              日期
              <input
                type="date"
                value={eventForm.date}
                onChange={(event) => setEventForm((current) => ({ ...current, date: event.target.value }))}
                required
              />
            </label>
            <label>
              類型
              <select value={eventForm.type} onChange={(event) => setEventForm((current) => ({ ...current, type: event.target.value }))}>
                {CALENDAR_EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <footer>
              {editingEvent ? (
                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    const eventToDelete = editingEvent;
                    closeEventModal();
                    deleteCalendarEvent(eventToDelete.id, dateKey(eventToDelete.event_date));
                  }}
                  disabled={calendarSaving || deletingEventIds.has(editingEvent.id)}
                >
                  刪除
                </button>
              ) : null}
              <button type="button" onClick={closeEventModal}>取消</button>
              <button className="primary-action" type="submit" disabled={calendarSaving}>{calendarSaving ? "儲存中" : "儲存"}</button>
            </footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}
