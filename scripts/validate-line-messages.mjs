import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const runningOnVercel = process.env.VERCEL === "1";
loadEnvConfig(process.cwd());

const shouldValidate = process.env.npm_lifecycle_event === "validate:line"
  || (runningOnVercel && process.env.VERCEL_ENV === "production");
if (!shouldValidate) {
  console.log("LINE validate skipped outside a production build");
  process.exit(0);
}

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

const token = String(process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");

const { buildNotificationLineFlexMessage } = (await loadModule("../lib/notifications.js")).namespace;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const sample = [{
  key: "overdue_work:validation",
  source_type: "overdue_work",
  source_id: "validation",
  category_label: "逾期工作",
  severity: "critical",
  title: "LINE Flex 格式驗證",
  description: "此訊息只送至官方驗證端點，不會推播給使用者",
  due_date: today,
  href: "/notifications"
}];
const messages = [
  buildNotificationLineFlexMessage([], today, "https://example.com", { mode: "daily_digest" }),
  buildNotificationLineFlexMessage(sample, today, "https://example.com", { mode: "critical_event" }),
  buildNotificationLineFlexMessage(sample, today, "https://example.com", { mode: "critical_follow_up" })
];

const response = await fetch("https://api.line.me/v2/bot/message/validate/push", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ messages })
});
const responseText = await response.text();
if (!response.ok) throw new Error(`LINE validate failed (${response.status}): ${responseText.slice(0, 500)}`);
console.log(`LINE validate passed: ${messages.length} Flex message variants`);
