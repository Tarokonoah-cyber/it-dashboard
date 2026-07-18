import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const moduleCache = new Map();

async function loadModule(relativePath, parentUrl = import.meta.url) {
  let url = new URL(relativePath, parentUrl);
  if (!/\.[a-z0-9]+$/i.test(url.pathname)) url = new URL(`${url.href}.js`);
  if (moduleCache.has(url.href)) return moduleCache.get(url.href);
  const promise = (async () => {
    const code = await readFile(url, "utf8");
    const sourceModule = new vm.SourceTextModule(code, { identifier: url.href });
    await sourceModule.link((specifier, referencingModule) => loadModule(specifier, referencingModule.identifier));
    await sourceModule.evaluate();
    return sourceModule;
  })();
  moduleCache.set(url.href, promise);
  return promise;
}

async function namespace(relativePath) {
  return (await loadModule(relativePath)).namespace;
}

function response(status, body = "", headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
    headers: { get: (name) => headers[String(name).toLowerCase()] || null }
  };
}

test("Taipei business hours include 08:00 and exclude 18:00 and weekends", async () => {
  const { isTaipeiBusinessTime, taipeiDateTimeParts } = await namespace("../lib/lineNotificationPolicy.js");
  assert.deepEqual({ ...taipeiDateTimeParts(new Date("2026-07-20T00:00:00.000Z")) }, {
    date: "2026-07-20", weekday: "Mon", hour: 8, minute: 0, second: 0
  });
  assert.equal(isTaipeiBusinessTime(new Date("2026-07-20T00:00:00.000Z")), true);
  assert.equal(isTaipeiBusinessTime(new Date("2026-07-20T09:59:59.000Z")), true);
  assert.equal(isTaipeiBusinessTime(new Date("2026-07-20T10:00:00.000Z")), false);
  assert.equal(isTaipeiBusinessTime(new Date("2026-07-19T01:00:00.000Z")), false);
});

test("only transitions into critical state are selected", async () => {
  const { selectNewCriticalItems } = await namespace("../lib/lineNotificationPolicy.js");
  const before = [
    { key: "inspection_issue:a", severity: "high" },
    { key: "overdue_work:b", severity: "critical" }
  ];
  const after = [
    { key: "inspection_issue:a", severity: "critical" },
    { key: "overdue_work:b", severity: "critical" }
  ];
  assert.deepEqual(selectNewCriticalItems(before, after).map((item) => item.key), ["inspection_issue:a"]);
  assert.deepEqual(selectNewCriticalItems(after, after), []);
});

test("all four fixed critical conditions are classified as critical", async () => {
  const { buildNotificationItems } = await namespace("../lib/notifications.js");
  const items = buildNotificationItems({
    today: "2026-07-20",
    workLogs: [{ id: "work", date: "2026-07-13", title: "逾期工作", status: "未完成" }],
    contracts: [{ id: "contract", contract_name: "到期合約", end_date: "2026-07-19", status: "有效" }],
    inspectionItems: [{ id: "inspection", inspection_record_id: "record", item_name: "備份", status: "異常", handling_status: "未處理" }],
    inspectionRecords: [{ id: "record", inspection_date: "2026-07-20" }],
    recurringTemplates: [{ id: "template", title: "週期工作", recurrence_kind: "daily", is_active: true, start_date: "2026-01-01" }],
    recurringOccurrences: [{ template_id: "template", occurrence_date: "2026-07-20", status: "failed", error_message: "建立失敗" }]
  });
  assert.equal(items.length, 4);
  assert.equal(items.every((item) => item.severity === "critical"), true);
});

test("completed work and handled inspection issues leave the critical queue", async () => {
  const { buildNotificationItems } = await namespace("../lib/notifications.js");
  const items = buildNotificationItems({
    today: "2026-07-20",
    workLogs: [
      { id: "done", date: "2026-07-01", title: "完成", status: "已完成" },
      { id: "handled", date: "2026-07-01", title: "處理", status: "已處理" }
    ],
    inspectionItems: [{
      id: "inspection",
      inspection_record_id: "record",
      item_name: "備份",
      status: "異常",
      handling_status: "已處理"
    }],
    inspectionRecords: [{ id: "record", inspection_date: "2026-07-20" }]
  });
  assert.deepEqual(items, []);
});

test("follow-up policy includes read critical items and excludes snoozed items", async () => {
  const { selectActiveNotificationItems, excludeRecentlyPushedItems } = await namespace("../lib/lineNotificationPolicy.js");
  const items = [
    { key: "a", severity: "critical", is_read: true, is_snoozed: false },
    { key: "b", severity: "critical", is_read: false, is_snoozed: true },
    { key: "c", severity: "high", is_read: false, is_snoozed: false }
  ];
  const critical = selectActiveNotificationItems(items, { criticalOnly: true });
  assert.deepEqual(critical.map((item) => item.key), ["a"]);
  assert.deepEqual(excludeRecentlyPushedItems(critical, new Set(["a"])), []);
});

test("daily Flex supports all-clear and recent-push suppression cards", async () => {
  const { buildNotificationLineFlexMessage } = await namespace("../lib/notifications.js");
  const allClear = buildNotificationLineFlexMessage([], "2026-07-20", "https://example.test", { mode: "daily_digest" });
  assert.match(allClear.altText, /今日一切正常/);
  assert.match(JSON.stringify(allClear.contents), /目前沒有待處理通知或今日行程/);

  const summaryItems = [{
    key: "overdue_work:a",
    source_type: "overdue_work",
    category_label: "逾期工作",
    severity: "critical",
    title: "已即時推播",
    due_date: "2026-07-10"
  }];
  const suppressed = buildNotificationLineFlexMessage([], "2026-07-20", "https://example.test", {
    mode: "daily_digest",
    summaryItems,
    recentCount: 1
  });
  assert.match(JSON.stringify(suppressed.contents), /最近 4 小時通知/);
  assert.equal(suppressed.contents.body.contents[0].contents[2].contents[0].text, "1");
});

test("LINE transport retries one 5xx with the same retry UUID", async () => {
  const { sendLinePushRequest } = await namespace("../lib/lineTransport.js");
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push(options);
    return requests.length === 1 ? response(503, JSON.stringify({ message: "busy" })) : response(200, "{}", { "x-line-request-id": "ok-1" });
  };
  const result = await sendLinePushRequest({
    url: "https://example.test/push",
    token: "token",
    userId: `U${"a".repeat(32)}`,
    messages: [{ type: "text", text: "test" }],
    retryKey: "11111111-1111-4111-8111-111111111111",
    fetchImpl
  });
  assert.equal(result.status, 200);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers["X-Line-Retry-Key"], requests[1].headers["X-Line-Retry-Key"]);
});

test("LINE transport treats 409 as accepted and does not retry permanent 4xx", async () => {
  const { sendLinePushRequest } = await namespace("../lib/lineTransport.js");
  let acceptedCalls = 0;
  const accepted = await sendLinePushRequest({
    url: "https://example.test/push",
    token: "token",
    userId: `U${"a".repeat(32)}`,
    messages: [{ type: "text", text: "test" }],
    retryKey: "11111111-1111-4111-8111-111111111111",
    fetchImpl: async () => {
      acceptedCalls += 1;
      return response(409, "{}", { "x-line-accepted-request-id": "accepted-1" });
    }
  });
  assert.equal(accepted.acceptedRequestId, "accepted-1");
  assert.equal(acceptedCalls, 1);

  let failedCalls = 0;
  await assert.rejects(() => sendLinePushRequest({
    url: "https://example.test/push",
    token: "token",
    userId: `U${"a".repeat(32)}`,
    messages: [{ type: "text", text: "test" }],
    retryKey: "11111111-1111-4111-8111-111111111111",
    fetchImpl: async () => {
      failedCalls += 1;
      return response(400, JSON.stringify({ message: "invalid" }));
    }
  }), /LINE API 400/);
  assert.equal(failedCalls, 1);
});

test("LINE transport retries a timeout once", async () => {
  const { sendLinePushRequest } = await namespace("../lib/lineTransport.js");
  let calls = 0;
  const result = await sendLinePushRequest({
    url: "https://example.test/push",
    token: "token",
    userId: `U${"a".repeat(32)}`,
    messages: [{ type: "text", text: "test" }],
    retryKey: "11111111-1111-4111-8111-111111111111",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error("timeout");
        error.name = "TimeoutError";
        throw error;
      }
      return response(200, "{}");
    }
  });
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
});
