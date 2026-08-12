import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function syntheticModule(identifier, exports) {
  const names = Object.keys(exports);
  const synthetic = new vm.SyntheticModule(names, function setExports() {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  }, { identifier });
  return synthetic;
}

async function loadAssistantRoute({ prepareAssistantAction, searchDashboard }) {
  const [routeCode, intentsCode] = await Promise.all([
    readFile(new URL("../app/api/ai-assistant/route.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/aiAssistantIntents.js", import.meta.url), "utf8")
  ]);
  const intentsModule = new vm.SourceTextModule(intentsCode, { identifier: "aiAssistantIntents.js" });
  await intentsModule.link(() => {
    throw new Error("aiAssistantIntents.js must not import other modules");
  });
  await intentsModule.evaluate();

  const routeModule = new vm.SourceTextModule(routeCode, { identifier: "ai-assistant-route.js" });
  await routeModule.link(async (specifier) => {
    if (specifier === "../../../lib/auth") {
      return syntheticModule("auth-stub.js", { requireDashboardAuth: () => null });
    }
    if (specifier === "../../../lib/supabase-rest") {
      return syntheticModule("supabase-rest-stub.js", {
        supabaseRequest: async () => [],
        todayTaipei: () => "2026-08-12"
      });
    }
    if (specifier === "../../../lib/assistant-actions") {
      return syntheticModule("assistant-actions-stub.js", { prepareAssistantAction });
    }
    if (specifier === "../../../lib/global-search") {
      return syntheticModule("global-search-stub.js", { searchDashboard });
    }
    if (specifier === "../../../lib/dailyOpsSync") {
      return syntheticModule("daily-ops-stub.js", { createTodoWithWorkLog: async () => ({}) });
    }
    if (specifier === "../../../lib/aiAssistantIntents") return intentsModule;
    throw new Error(`Unexpected AI route import: ${specifier}`);
  });
  await routeModule.evaluate();
  return routeModule.namespace.POST;
}

async function withGeminiKey(callback) {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key/with-symbols";
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
}

test("Gemini 3.6 request preserves tool routing and confirmation flow", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  const preparedActions = [];
  try {
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        async json() {
          return {
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    reply: "我會先準備待辦。",
                    action: { type: "create_todo", title: "檢查測試設備", note: "由 Gemini 建議" }
                  })
                }]
              }
            }]
          };
        }
      };
    };
    const POST = await loadAssistantRoute({
      prepareAssistantAction: async (action) => {
        preparedActions.push(action);
        return { ...action, status: "needs_confirmation", token: "signed-confirmation-token" };
      },
      searchDashboard: async () => ({ results: [], warnings: [] })
    });

    const response = await withGeminiKey(() => POST(new Request("https://dashboard.test/api/ai-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "這個系統有什麼特色？" })
    })));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /\/v1beta\/models\/gemini-3\.6-flash:generateContent\?key=test-key%2Fwith-symbols$/);
    assert.equal(fetchCalls[0].options.method, "POST");
    const geminiBody = JSON.parse(fetchCalls[0].options.body);
    assert.equal(geminiBody.contents[0].role, "user");
    assert.equal(geminiBody.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(preparedActions, [{
      type: "create_todo",
      title: "檢查測試設備",
      note: "由 Gemini 建議"
    }]);
    assert.equal(body.success, true);
    assert.equal(body.action.status, "needs_confirmation");
    assert.equal(body.action.token, "signed-confirmation-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini upstream errors fall back without executing an action", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const preparedActions = [];
  try {
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    console.error = () => {};
    const POST = await loadAssistantRoute({
      prepareAssistantAction: async (action) => {
        preparedActions.push(action);
        return action;
      },
      searchDashboard: async () => ({ results: [], warnings: [] })
    });

    const response = await withGeminiKey(() => POST(new Request("https://dashboard.test/api/ai-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "這個系統有什麼特色？" })
    })));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.action, null);
    assert.equal(typeof body.reply, "string");
    assert.ok(body.reply.length > 0);
    assert.deepEqual(preparedActions, []);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
