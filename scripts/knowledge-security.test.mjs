import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Knowledge corrective migration blocks direct browser-role reads", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260812042615_restrict_knowledge_to_service_role.sql", import.meta.url),
    "utf8"
  );

  for (const table of ["knowledge_articles", "knowledge_steps", "knowledge_assets"]) {
    assert.match(
      sql,
      new RegExp(`revoke all privileges on table public\\.${table} from anon, authenticated`, "i")
    );
  }
  assert.match(sql, /drop policy if exists "Allow public read published knowledge articles"/i);
  assert.match(sql, /drop policy if exists "Allow public read published knowledge steps"/i);
  assert.match(sql, /drop policy if exists "Allow public read published knowledge assets"/i);
  assert.doesNotMatch(sql, /grant\s+select[\s\S]*to\s+(anon|authenticated)/i);
});
