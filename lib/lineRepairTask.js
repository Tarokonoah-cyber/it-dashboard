const LINE_REPAIR_EVENT_TYPES = new Set([
  "repair.created",
  "repair.in_progress",
  "repair.completed",
  "repair.closed",
  "repair.reopened",
  "repair.cancelled",
  "repair.updated"
]);

const LINE_REPAIR_TASK_STATES = new Set(["open", "completed", "cancelled"]);
const LINE_REPAIR_PRIORITIES = new Set(["general", "important"]);

export class LineRepairPayloadError extends Error {
  constructor(message) {
    super(message);
    this.name = "LineRepairPayloadError";
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return String(value ?? "").trim();
}

function requiredText(value, label, maxLength) {
  const normalized = text(value);
  if (!normalized) throw new LineRepairPayloadError(`${label} is required`);
  if (normalized.length > maxLength) throw new LineRepairPayloadError(`${label} is too long`);
  return normalized;
}

function optionalText(value, label, maxLength) {
  const normalized = text(value);
  if (normalized.length > maxLength) throw new LineRepairPayloadError(`${label} is too long`);
  return normalized;
}

function isoTimestamp(value, label, optional = false) {
  if (value === null || value === undefined || value === "") {
    if (optional) return null;
    throw new LineRepairPayloadError(`${label} is required`);
  }
  const normalized = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) {
    throw new LineRepairPayloadError(`${label} must include a timezone`);
  }
  if (!Number.isFinite(Date.parse(normalized))) {
    throw new LineRepairPayloadError(`${label} is invalid`);
  }
  return new Date(normalized).toISOString();
}

export function validateLineRepairEventPayload(payload, headers = {}) {
  if (!isObject(payload)) throw new LineRepairPayloadError("Request body must be an object");
  if (payload.schemaVersion !== 1) throw new LineRepairPayloadError("Unsupported schemaVersion");

  const eventId = requiredText(payload.eventId, "eventId", 240);
  const eventType = requiredText(payload.eventType, "eventType", 80);
  const headerEventId = requiredText(headers.eventId, "x-line-repair-event-id", 240);
  const headerEventType = requiredText(headers.eventType, "x-line-repair-event", 80);
  if (!/^[A-Za-z0-9._:-]+$/.test(eventId)) throw new LineRepairPayloadError("eventId format is invalid");
  if (eventId !== headerEventId) throw new LineRepairPayloadError("eventId does not match header");
  if (eventType !== headerEventType) throw new LineRepairPayloadError("eventType does not match header");
  if (!LINE_REPAIR_EVENT_TYPES.has(eventType)) throw new LineRepairPayloadError("Unsupported eventType");
  if (text(payload.source) !== "line-repair") throw new LineRepairPayloadError("Unsupported source");
  if (!isObject(payload.repair)) throw new LineRepairPayloadError("repair is required");

  const repair = payload.repair;
  const repairNo = requiredText(repair.repairNo, "repair.repairNo", 200);
  const title = requiredText(repair.title, "repair.title", 200);
  const taskState = requiredText(repair.taskState, "repair.taskState", 20);
  const priority = requiredText(repair.priority, "repair.priority", 20);
  if (!LINE_REPAIR_TASK_STATES.has(taskState)) throw new LineRepairPayloadError("Unsupported repair.taskState");
  if (!LINE_REPAIR_PRIORITIES.has(priority)) throw new LineRepairPayloadError("Unsupported repair.priority");

  const occurredAt = isoTimestamp(payload.occurredAt, "occurredAt");
  const updatedAt = isoTimestamp(repair.updatedAt, "repair.updatedAt");
  const createdAt = isoTimestamp(repair.createdAt, "repair.createdAt");

  const normalizedRepair = {
    ...repair,
    externalId: optionalText(repair.externalId, "repair.externalId", 200),
    repairNo,
    title,
    status: optionalText(repair.status, "repair.status", 120),
    taskState,
    priority,
    priorityLabel: optionalText(repair.priorityLabel, "repair.priorityLabel", 40),
    department: optionalText(repair.department, "repair.department", 120),
    location: optionalText(repair.location, "repair.location", 300),
    category: optionalText(repair.category, "repair.category", 120),
    categoryName: optionalText(repair.categoryName, "repair.categoryName", 120),
    itemName: optionalText(repair.itemName, "repair.itemName", 200),
    description: optionalText(repair.description, "repair.description", 4000),
    reporterUnit: optionalText(repair.reporterUnit, "repair.reporterUnit", 200),
    assignee: optionalText(repair.assignee, "repair.assignee", 200),
    note: optionalText(repair.note, "repair.note", 4000),
    createdAt,
    updatedAt,
    completedAt: isoTimestamp(repair.completedAt, "repair.completedAt", true),
    closedAt: isoTimestamp(repair.closedAt, "repair.closedAt", true),
    cancelledAt: isoTimestamp(repair.cancelledAt, "repair.cancelledAt", true)
  };

  const context = isObject(payload.context) ? {
    ...payload.context,
    previousStatus: optionalText(payload.context.previousStatus, "context.previousStatus", 120),
    actor: optionalText(payload.context.actor, "context.actor", 200),
    reason: optionalText(payload.context.reason, "context.reason", 1000)
  } : {};

  return {
    schemaVersion: 1,
    eventId,
    eventType,
    occurredAt,
    source: "line-repair",
    repair: normalizedRepair,
    context
  };
}

function taipeiDateKey(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function buildLineRepairWorkPayload(event) {
  const repair = event.repair;
  const status = repair.taskState === "open"
    ? "未完成"
    : repair.taskState === "completed"
      ? "已完成"
      : "已取消";
  const impact = repair.priority === "important" ? "重要" : "一般";

  return {
    source: "line-repair",
    sourceId: repair.repairNo,
    date: taipeiDateKey(repair.updatedAt),
    staff: repair.assignee || "共同",
    title: repair.title,
    category: repair.category || repair.categoryName || "工作",
    status,
    impact,
    description: repair.description || "",
    note: repair.note || "",
    createdAt: repair.createdAt,
    externalEventAt: event.occurredAt,
    externalUpdatedAt: repair.updatedAt,
    externalData: {
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      repair,
      context: event.context || {}
    }
  };
}

export function isLineRepairWork(work) {
  return String(work?.source || "").trim() === "line-repair";
}

export function getLineRepairEventType(work) {
  return isLineRepairWork(work) ? text(work?.external_data?.eventType) : "";
}

export function getLineRepairEventVersion(work) {
  if (!isLineRepairWork(work)) return "";
  return text(work.external_event_at || work?.external_data?.occurredAt);
}
