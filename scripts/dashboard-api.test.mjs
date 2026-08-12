import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, test } from "node:test";
import vm from "node:vm";

let dashboardApi;
let previousFetch;
let previousWindow;

async function loadDashboardApiModule() {
  const code = await readFile(new URL("../lib/dashboard-api.js", import.meta.url), "utf8");
  const sourceModule = new vm.SourceTextModule(code, { identifier: "dashboard-api.js" });
  await sourceModule.link(() => {
    throw new Error("dashboard-api.js must not import other modules");
  });
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

beforeEach(async () => {
  previousFetch = globalThis.fetch;
  previousWindow = globalThis.window;
  globalThis.window = {
    location: {
      pathname: "/work",
      search: "?q=network",
      replace() {}
    },
    setTimeout,
    clearTimeout
  };
  dashboardApi ||= await loadDashboardApiModule();
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});

test("dashboard API parses the standard success envelope", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, data: { count: 2 } }), { status: 200 });
  assert.deepEqual({ ...await dashboardApi.api("/api/dashboard") }, { count: 2 });
});

test("dashboard API preserves safe server messages", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "資料格式不正確" }), { status: 400 });
  await assert.rejects(() => dashboardApi.api("/api/work-logs"), /資料格式不正確/);
});

test("dashboard API gives a stable message for invalid upstream responses", async () => {
  globalThis.fetch = async () => new Response("<html>proxy failure</html>", { status: 502 });
  await assert.rejects(() => dashboardApi.api("/api/dashboard"), (error) => error.message === "資料讀取失敗");
});

test("dashboard API redirects expired sessions back to the current page", async () => {
  let redirectedTo = "";
  globalThis.window.location.replace = (value) => { redirectedTo = value; };
  globalThis.fetch = async () => new Response("Authentication required", { status: 401 });
  await assert.rejects(() => dashboardApi.api("/api/dashboard"), /資料讀取失敗/);
  assert.equal(redirectedTo, "/login?next=%2Fwork%3Fq%3Dnetwork");
});
