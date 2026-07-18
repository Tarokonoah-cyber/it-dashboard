import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const TEST_SECRET = "test-only-line-repair-secret-0123456789";
const NOW = Date.parse("2026-07-18T03:30:00.000Z");
const moduleCache = new Map();
process.env.IT_DASHBOARD_WEBHOOK_SECRET = TEST_SECRET;

async function loadModule(relativePath, parentUrl = import.meta.url) {
  let url = new URL(relativePath, parentUrl);
  if (!/\.[a-z0-9]+$/i.test(url.pathname)) url = new URL(`${url.href}.js`);
  if (moduleCache.has(url.href)) return moduleCache.get(url.href);
  const promise = (async () => {
    const code = await readFile(url, "utf8");
    const sourceModule = new vm.SourceTextModule(code, { identifier: url.href });
    await sourceModule.link(async (specifier, referencingModule) => {
      if (specifier === "node:crypto") {
        return new vm.SyntheticModule(["createHmac", "timingSafeEqual"], function setExports() {
          this.setExport("createHmac", createHmac);
          this.setExport("timingSafeEqual", timingSafeEqual);
        }, { identifier: "node:crypto" });
      }
      return loadModule(specifier, referencingModule.identifier);
    });
    await sourceModule.evaluate();
    return sourceModule;
  })();
  moduleCache.set(url.href, promise);
  return promise;
}

async function namespace(relativePath) {
  return (await loadModule(relativePath)).namespace;
}

function makeEvent(overrides = {}) {
  const repair = {
    externalId: "R20260718-001",
    repairNo: "R20260718-001",
    title: "房內網路無法使用",
    status: "新案件",
    taskState: "open",
    priority: "general",
    priorityLabel: "一般",
    department: "IT",
    location: "101 房",
    category: "網路",
    categoryName: "資訊設備",
    itemName: "網路異常",
    description: "房內網路無法使用",
    reporterUnit: "房務部",
    assignee: "",
    note: "",
    createdAt: "2026-07-18T03:20:00.000Z",
    updatedAt: "2026-07-18T03:20:00.000Z",
    completedAt: null,
    closedAt: null,
    cancelledAt: null,
    ...(overrides.repair || {})
  };
  return {
    schemaVersion: 1,
    eventId: overrides.eventId || "event-created-001",
    eventType: overrides.eventType || "repair.created",
    occurredAt: overrides.occurredAt || repair.updatedAt,
    source: "line-repair",
    repair,
    context: { previousStatus: "", actor: "報修人", reason: "", ...(overrides.context || {}) }
  };
}

function signedRequest(event, options = {}) {
  const rawBody = options.rawBody ?? JSON.stringify(event);
  const timestamp = options.timestamp || new Date(NOW).toISOString();
  const signature = options.signature || `sha256=${createHmac("sha256", TEST_SECRET).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  return new Request("https://dashboard.example/api/integrations/line-repair", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-repair-event": options.headerEventType || event.eventType,
      "x-line-repair-event-id": options.headerEventId || event.eventId,
      "x-line-repair-timestamp": timestamp,
      "x-line-repair-signature": signature
    },
    body: rawBody
  });
}

async function post(event, processEvent, options = {}) {
  const { handleLineRepairWebhook } = await namespace("../lib/lineRepairWebhook.js");
  const response = await handleLineRepairWebhook(signedRequest(event, options), { processEvent, now: () => NOW });
  return { response, body: await response.json() };
}

async function createMemoryProcessor() {
  const { buildLineRepairWorkPayload } = await namespace("../lib/lineRepairTask.js");
  const eventIds = new Set();
  const tasks = new Map();
  let order = [];
  let sequence = 0;

  async function processEvent(event) {
    if (eventIds.has(event.eventId)) {
      const task = tasks.get(`line-repair:${event.repair.repairNo}`);
      return { duplicate: true, stale: false, action: "duplicate", taskId: task?.id || null };
    }
    eventIds.add(event.eventId);
    const key = `line-repair:${event.repair.repairNo}`;
    const existing = tasks.get(key);
    if (existing) {
      const existingUpdated = Date.parse(existing.externalUpdatedAt);
      const incomingUpdated = Date.parse(event.repair.updatedAt);
      const existingOccurred = Date.parse(existing.externalEventAt);
      const incomingOccurred = Date.parse(event.occurredAt);
      if (incomingUpdated < existingUpdated || (incomingUpdated === existingUpdated && incomingOccurred <= existingOccurred)) {
        return { duplicate: false, stale: true, action: "stale", taskId: existing.id };
      }
    }

    const work = { ...buildLineRepairWorkPayload(event), id: existing?.id || `WL-TEST-${++sequence}` };
    tasks.set(key, work);
    order = order.filter((id) => id !== work.id);
    if (work.status === "未完成") {
      if (event.eventType === "repair.created" || event.eventType === "repair.reopened" || existing?.status !== "未完成") order.unshift(work.id);
      else order.push(work.id);
    }
    const action = work.status === "已完成"
      ? "completed"
      : work.status === "已取消"
        ? "cancelled"
        : !existing
          ? "created"
          : existing.status !== "未完成" || event.eventType === "repair.reopened"
            ? "reopened"
            : "updated";
    return { duplicate: false, stale: false, action, taskId: work.id };
  }

  return {
    processEvent,
    tasks,
    seedManual(task) {
      tasks.set(`vercel-dashboard:${task.id}`, { ...task });
    },
    openTasks() {
      const byId = new Map(Array.from(tasks.values()).map((task) => [task.id, task]));
      return order.map((id) => byId.get(id)).filter(Boolean);
    }
  };
}

test("correct signature creates an open task", async () => {
  const memory = await createMemoryProcessor();
  const { response, body } = await post(makeEvent(), memory.processEvent);
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.action, "created");
  assert.equal(memory.openTasks().length, 1);
});

test("wrong signature returns 401 before processing", async () => {
  let calls = 0;
  const { response } = await post(makeEvent(), async () => { calls += 1; }, { signature: `sha256=${"0".repeat(64)}` });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("timestamp older than five minutes returns 401", async () => {
  let calls = 0;
  const staleTimestamp = new Date(NOW - 5 * 60 * 1000 - 1).toISOString();
  const event = makeEvent();
  const rawBody = JSON.stringify(event);
  const signature = `sha256=${createHmac("sha256", TEST_SECRET).update(`${staleTimestamp}.${rawBody}`).digest("hex")}`;
  const { response } = await post(event, async () => { calls += 1; }, { timestamp: staleTimestamp, signature, rawBody });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("the same eventId is idempotent", async () => {
  const memory = await createMemoryProcessor();
  const event = makeEvent();
  await post(event, memory.processEvent);
  const second = await post(event, memory.processEvent);
  assert.equal(second.body.data.duplicate, true);
  assert.equal(memory.tasks.size, 1);
});

test("completed, reopened, closed, and cancelled reuse one task", async () => {
  const memory = await createMemoryProcessor();
  const created = makeEvent();
  const createdResult = await post(created, memory.processEvent);
  const taskId = createdResult.body.data.taskId;

  const completed = makeEvent({
    eventId: "event-completed-001",
    eventType: "repair.completed",
    occurredAt: "2026-07-18T03:21:00.000Z",
    repair: { taskState: "completed", status: "已完成", updatedAt: "2026-07-18T03:21:00.000Z", completedAt: "2026-07-18T03:21:00.000Z" }
  });
  await post(completed, memory.processEvent);
  assert.equal(memory.openTasks().length, 0);

  const reopened = makeEvent({
    eventId: "event-reopened-001",
    eventType: "repair.reopened",
    occurredAt: "2026-07-18T03:22:00.000Z",
    repair: { taskState: "open", status: "新案件", updatedAt: "2026-07-18T03:22:00.000Z" }
  });
  const reopenedResult = await post(reopened, memory.processEvent);
  assert.equal(reopenedResult.body.data.taskId, taskId);
  assert.equal(memory.openTasks()[0].id, taskId);

  const closed = makeEvent({
    eventId: "event-closed-001",
    eventType: "repair.closed",
    occurredAt: "2026-07-18T03:23:00.000Z",
    repair: { taskState: "completed", status: "已結單", updatedAt: "2026-07-18T03:23:00.000Z", closedAt: "2026-07-18T03:23:00.000Z" }
  });
  await post(closed, memory.processEvent);
  assert.equal(memory.openTasks().length, 0);
  assert.equal(Array.from(memory.tasks.values()).filter((task) => task.source === "line-repair").length, 1);

  const cancelled = makeEvent({
    eventId: "event-cancelled-001",
    eventType: "repair.cancelled",
    occurredAt: "2026-07-18T03:24:00.000Z",
    repair: { taskState: "cancelled", status: "已取消", updatedAt: "2026-07-18T03:24:00.000Z", cancelledAt: "2026-07-18T03:24:00.000Z" }
  });
  const cancelledResult = await post(cancelled, memory.processEvent);
  assert.equal(cancelledResult.body.data.taskId, taskId);
  assert.equal(memory.openTasks().length, 0);
});

test("older repair updates cannot overwrite newer task state", async () => {
  const memory = await createMemoryProcessor();
  const newest = makeEvent({ eventId: "event-newest", occurredAt: "2026-07-18T03:25:00.000Z", repair: { updatedAt: "2026-07-18T03:25:00.000Z", title: "較新的標題" } });
  const older = makeEvent({ eventId: "event-older", eventType: "repair.updated", occurredAt: "2026-07-18T03:26:00.000Z", repair: { updatedAt: "2026-07-18T03:24:00.000Z", title: "舊標題" } });
  await post(newest, memory.processEvent);
  const result = await post(older, memory.processEvent);
  assert.equal(result.body.data.stale, true);
  assert.equal(memory.openTasks()[0].title, "較新的標題");
});

test("general and important keep the existing blue and orange priority mapping", async () => {
  const { buildLineRepairWorkPayload } = await namespace("../lib/lineRepairTask.js");
  assert.equal(buildLineRepairWorkPayload(makeEvent()).impact, "一般");
  assert.equal(buildLineRepairWorkPayload(makeEvent({ repair: { priority: "important", priorityLabel: "重要" } })).impact, "重要");
});

test("manual tasks remain unchanged while LINE repair tasks sync", async () => {
  const memory = await createMemoryProcessor();
  const manual = { id: "WL-MANUAL", source: "vercel-dashboard", sourceId: null, title: "手動任務", status: "未完成", impact: "一般" };
  memory.seedManual(manual);
  await post(makeEvent(), memory.processEvent);
  assert.deepEqual(memory.tasks.get("vercel-dashboard:WL-MANUAL"), manual);
});
