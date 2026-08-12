import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, test } from "node:test";
import vm from "node:vm";

let supabase;
let previousFetch;
let previousUrl;
let previousKey;

async function loadSupabaseRestModule() {
  const code = await readFile(new URL("../lib/supabase-rest.js", import.meta.url), "utf8");
  const sourceModule = new vm.SourceTextModule(code, { identifier: "supabase-rest.js" });
  await sourceModule.link(async (specifier) => {
    if (specifier === "server-only") {
      return new vm.SyntheticModule([], () => {}, { identifier: "server-only" });
    }
    if (specifier === "./auth") {
      return new vm.SyntheticModule(["assertDashboardConfigured"], function setExports() {
        this.setExport("assertDashboardConfigured", () => {});
      }, { identifier: "auth.js" });
    }
    if (specifier === "./date") {
      return new vm.SyntheticModule(["todayTaipei"], function setExports() {
        this.setExport("todayTaipei", () => "2026-08-12");
      }, { identifier: "date.js" });
    }
    throw new Error(`Unexpected test import: ${specifier}`);
  });
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

beforeEach(async () => {
  previousFetch = globalThis.fetch;
  previousUrl = process.env.SUPABASE_URL;
  previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  supabase ||= await loadSupabaseRestModule();
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  if (previousUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
});

test("Supabase REST requests keep credentials server-side and parse JSON", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify([{ id: 1 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  assert.deepEqual(await supabase.supabaseRequest("work_logs", "select=id"), [{ id: 1 }]);
  assert.equal(request.url, "https://project.supabase.co/rest/v1/work_logs?select=id");
  assert.equal(request.options.headers.Authorization, "Bearer service-role-test-key");
  assert.equal(request.options.cache, "no-store");
  assert.ok(request.options.signal instanceof AbortSignal);
});

test("Supabase REST rejects unsafe endpoint identifiers before fetch", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; };
  await assert.rejects(() => supabase.supabaseRequest("work_logs/../secrets"), /Invalid Supabase table name/);
  await assert.rejects(() => supabase.supabaseRpc("unsafe/function", {}), /Invalid Supabase function name/);
  assert.equal(called, false);
});

test("Supabase REST hides non-JSON upstream error bodies", async () => {
  globalThis.fetch = async () => new Response("<html>upstream internals</html>", { status: 502 });
  await assert.rejects(
    () => supabase.supabaseRequest("work_logs"),
    (error) => error.message === "Supabase request failed (HTTP 502)" && !error.message.includes("upstream internals")
  );
});

test("Supabase REST preserves PostgREST codes and safe messages", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: "PGRST205",
    message: "Could not find the table 'public.password_entries' in the schema cache"
  }), { status: 404 });
  await assert.rejects(
    () => supabase.supabaseRequest("password_entries"),
    (error) => error.code === "PGRST205" && /password_entries/.test(error.message)
  );
});
