#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = { leagues: ["MLB", "NPB", "CPBL"], dryRun: false, year: undefined };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    if (arg.startsWith("--league=")) {
      args.leagues = arg.slice("--league=".length).split(",").map((item) => item.trim()).filter(Boolean);
    }
    if (arg.startsWith("--year=")) {
      const year = Number(arg.slice("--year=".length));
      if (Number.isFinite(year)) args.year = year;
    }
  }
  return args;
}

async function main() {
  const cwd = process.cwd();
  loadDotEnv(path.join(cwd, ".env.local"));
  loadDotEnv(path.join(cwd, ".env"));

  const args = parseArgs(process.argv.slice(2));
  const { syncBaseball } = await import("../lib/baseballSync.js");
  const result = await syncBaseball(args);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
