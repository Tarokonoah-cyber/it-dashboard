export const MAX_TODO_TITLE_LENGTH = 120;
export const MAX_ACTION_NOTE_LENGTH = 1000;

export const ALLOWED_ASSISTANT_ROUTES = new Set([
  "/",
  "/documents",
  "/passwords",
  "/contacts",
  "/anydesk",
  "/quick-notes",
  "/work",
  "/assets",
  "/assets/mountain-pc",
  "/assets/downhill-pc",
  "/assets/printers",
  "/assets/north-ya",
  "/assets/iptv",
  "/contracts",
  "/contracts/software",
  "/contracts/mobile",
  "/sop",
  "/sop/docs",
  "/sop/soc",
  "/settings",
  "/boss-kpi"
]);

const OPEN_PREFIX = "\u958b\u555f";
const SECRET_TERMS = [
  "\u5bc6\u78bc",
  "password",
  "api key",
  "apikey",
  "token",
  "secret",
  "env",
  "\u74b0\u5883\u8b8a\u6578",
  "\u91d1\u9470",
  "service role",
  "service_role",
  "gemini_api_key",
  "supabase_service_role_key"
];

const DESTRUCTIVE_TERMS = [
  "\u522a\u9664",
  "\u6e05\u7a7a",
  "\u6e05\u6389",
  "\u79fb\u9664",
  "\u92b7\u6bc0",
  "\u6539\u6389",
  "\u4fee\u6539",
  "\u66f4\u65b0",
  "\u522a",
  "delete",
  "remove",
  "clear",
  "drop",
  "truncate",
  "update"
];

const SQL_OR_SCRIPT_TERMS = [
  "select ",
  "insert ",
  "update ",
  "delete ",
  "drop ",
  "truncate ",
  "alter ",
  "apps script",
  "appsscript",
  "script.google.com",
  "http://",
  "https://"
];

const MUTATION_CLAIM_TERMS = [
  "\u5df2\u522a\u9664",
  "\u5df2\u4fee\u6539",
  "\u5df2\u66f4\u65b0",
  "\u5df2\u79fb\u9664",
  "\u5df2\u5beb\u5165",
  "\u5df2\u9001\u51fa",
  "\u5df2\u52a0\u5165\u65e5\u66c6"
];

const NAV_INTENTS = [
  { href: "/", label: `${OPEN_PREFIX}\u5100\u8868\u677f`, keywords: ["\u9996\u9801", "\u5100\u8868\u677f", "dashboard", "home", "\u7e3d\u89bd"] },
  { href: "/documents", label: `${OPEN_PREFIX}\u9001\u4ea4\u55ae\u64da\u7d00\u9304`, keywords: ["\u9001\u4ea4\u55ae\u64da", "\u55ae\u64da", "documents", "\u6587\u4ef6\u7d00\u9304"] },
  { href: "/passwords", label: `${OPEN_PREFIX}\u5bc6\u78bc\u7ba1\u7406`, keywords: ["\u5bc6\u78bc", "password", "passwords", "\u5e33\u5bc6"] },
  { href: "/contacts", label: `${OPEN_PREFIX}\u901a\u8a0a\u9304`, keywords: ["\u901a\u8a0a\u9304", "contacts", "\u806f\u7d61\u4eba", "\u5206\u6a5f"] },
  { href: "/anydesk", label: `${OPEN_PREFIX} AnyDesk List`, keywords: ["anydesk", "\u9060\u7aef", "\u9060\u7aef\u684c\u9762"] },
  { href: "/quick-notes", label: `${OPEN_PREFIX}\u5feb\u901f\u5099\u5fd8\u9304`, keywords: ["\u5feb\u901f\u5099\u5fd8", "quick notes", "quick-notes", "\u5099\u5fd8\u9304", "\u7b46\u8a18"] },
  { href: "/work", label: `${OPEN_PREFIX}\u5de5\u4f5c\u4e2d\u5fc3`, keywords: ["\u5de5\u4f5c\u4e2d\u5fc3", "\u5de5\u4f5c\u7d00\u9304", "\u65b0\u589e\u5de5\u4f5c", "work", "\u5de5\u55ae"] },
  { href: "/assets", label: `${OPEN_PREFIX}\u8a2d\u5099\u6e05\u55ae`, keywords: ["\u8a2d\u5099\u6e05\u55ae", "\u8cc7\u7522", "assets", "\u8a2d\u5099"] },
  { href: "/assets/mountain-pc", label: `${OPEN_PREFIX}\u5c71\u4e0a\u96fb\u8166`, keywords: ["\u5c71\u4e0a\u96fb\u8166", "\u5c71\u4e0a pc", "\u5c71\u4e0apc", "mountain pc", "mountain-pc"] },
  { href: "/assets/downhill-pc", label: `${OPEN_PREFIX}\u5c71\u4e0b\u96fb\u8166`, keywords: ["\u5c71\u4e0b\u96fb\u8166", "\u5c71\u4e0b pc", "\u5c71\u4e0bpc", "downhill pc", "downhill-pc"] },
  { href: "/assets/printers", label: `${OPEN_PREFIX}\u5370\u8868\u6a5f`, keywords: ["\u5370\u8868\u6a5f", "printer", "printers", "\u4e8b\u52d9\u6a5f"] },
  { href: "/assets/north-ya", label: `${OPEN_PREFIX}\u5317YA`, keywords: ["\u5317ya", "\u5317 ya", "north ya", "north-ya"] },
  { href: "/assets/iptv", label: `${OPEN_PREFIX} IPTV`, keywords: ["iptv", "\u96fb\u8996\u76d2", "\u96fb\u8996"] },
  { href: "/contracts", label: `${OPEN_PREFIX}\u5408\u7d04\u7e3d\u89bd`, keywords: ["\u5408\u7d04\u7e3d\u89bd", "\u5408\u7d04", "contracts", "\u7d04\u671f"] },
  { href: "/contracts/software", label: `${OPEN_PREFIX}\u8edf\u9ad4\u5408\u7d04`, keywords: ["\u8edf\u9ad4\u5408\u7d04", "software contract", "software contracts", "\u6388\u6b0a\u5408\u7d04"] },
  { href: "/contracts/mobile", label: `${OPEN_PREFIX}\u884c\u52d5\u96fb\u8a71\u7d04\u671f`, keywords: ["\u884c\u52d5\u96fb\u8a71", "\u624b\u6a5f\u5408\u7d04", "mobile contract", "mobile contracts", "\u9580\u865f"] },
  { href: "/sop/docs", label: `${OPEN_PREFIX} SOP`, keywords: ["sop", "\u6a19\u6e96\u4f5c\u696d", "\u4f5c\u696d\u6d41\u7a0b"] },
  { href: "/sop/soc", label: `${OPEN_PREFIX} SOC`, keywords: ["soc", "\u8cc7\u5b89\u76e3\u63a7"] },
  { href: "/settings", label: `${OPEN_PREFIX}\u8a2d\u5b9a`, keywords: ["\u8a2d\u5b9a", "settings", "\u7cfb\u7d71\u8a2d\u5b9a"] },
  { href: "/boss-kpi", label: `${OPEN_PREFIX}\u4e3b\u7ba1 KPI`, keywords: ["kpi", "\u4e3b\u7ba1kpi", "\u4e3b\u7ba1 kpi", "boss kpi", "boss-kpi"] }
];

function normalizeMessage(message) {
  return String(message || "").trim().toLowerCase();
}

function hasAnyTerm(text, terms) {
  const normalized = normalizeMessage(text);
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function stripLeadingTaskWords(message) {
  return String(message || "")
    .trim()
    .replace(/^(please\s*)?(add|create|new|todo|remind me to)[:：\s]*/i, "")
    .replace(/^(請幫我|幫我|請)?\s*(新增|建立|加入)\s*(todo|待辦|工作)?[:：\s]*/iu, "")
    .replace(/^(todo|待辦|提醒我|請)[:：\s]*/iu, "")
    .trim();
}

function inferTodoTitle(message) {
  const title = stripLeadingTaskWords(message)
    .replace(/^(一個|這個|項目)\s*/u, "")
    .trim();
  if (!title || /^(todo|待辦|工作)$/iu.test(title)) return "";
  return cleanText(title, MAX_TODO_TITLE_LENGTH);
}

function inferCalendarDraft(message) {
  const raw = String(message || "").trim();
  const dateMatch = raw.match(/(今天|今日|明天|明日|後天|下週[一二三四五六日天]?|週[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}[/-]\d{1,2}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/u);
  const timeMatch = raw.match(/(上午|早上|中午|下午|晚上)?\s*\d{1,2}\s*[:：點]\s*\d{0,2}\s*(分)?/u);
  const title = cleanText(
    raw
      .replace(/^(新增|建立|加入|排|安排|建立一個|請幫我)\s*/u, "")
      .replace(/(行事曆|日曆|會議|提醒|排程|事件)/gu, "")
      .trim() || raw,
    MAX_TODO_TITLE_LENGTH
  );
  return {
    type: "calendar_draft",
    title,
    dateText: cleanText(dateMatch?.[0] || "", 60),
    timeText: cleanText(timeMatch?.[0] || "", 60),
    note: ""
  };
}

function createNavigateAction(intent) {
  return {
    type: "navigate",
    href: intent.href,
    label: intent.label
  };
}

function createAnalysisAction(message) {
  const normalized = normalizeMessage(message);
  if (normalized.includes("kpi")) {
    return { type: "analysis", scope: "kpi", label: "\u7522\u751f KPI \u5831\u544a\u8349\u7a3f" };
  }
  if (normalized.includes("\u672a\u5b8c\u6210") || normalized.includes("\u5f85\u8fa6") || normalized.includes("todo")) {
    return { type: "analysis", scope: "todo", label: "\u6574\u7406\u672a\u5b8c\u6210\u6e05\u55ae" };
  }
  if (normalized.includes("\u985e\u578b") || normalized.includes("\u5360\u6bd4") || normalized.includes("category")) {
    return { type: "analysis", scope: "work", label: "\u5206\u6790\u5de5\u4f5c\u985e\u578b\u5360\u6bd4" };
  }
  return { type: "analysis", scope: "dashboard", label: "\u7522\u751f\u672c\u6708\u4e3b\u7ba1\u6458\u8981" };
}

export function getUnsafeRequestReply(message) {
  if (hasAnyTerm(message, SECRET_TERMS)) {
    return "\u6211\u4e0d\u80fd\u63d0\u4f9b\u6216\u8655\u7406\u5bc6\u78bc\u3001API key\u3001env\u3001service role \u6216\u5176\u4ed6\u654f\u611f\u8cc7\u8a0a\u3002";
  }
  if (hasAnyTerm(message, DESTRUCTIVE_TERMS)) {
    return "\u9019\u985e\u522a\u9664\u3001\u4fee\u6539\u3001\u66f4\u65b0\u6216\u6e05\u7a7a\u8cc7\u6599\u7684\u8acb\u6c42\u9700\u8981\u4eba\u5de5\u64cd\u4f5c\uff0cAI \u52a9\u7406\u4e0d\u6703\u76f4\u63a5\u57f7\u884c\u7834\u58de\u6027\u52d5\u4f5c\u3002";
  }
  if (hasAnyTerm(message, SQL_OR_SCRIPT_TERMS)) {
    return "\u6211\u4e0d\u80fd\u57f7\u884c SQL\u3001Apps Script \u6216\u5916\u90e8 URL \u52d5\u4f5c\u3002\u8acb\u6539\u7528\u7cfb\u7d71\u5167\u5df2\u652f\u63f4\u7684\u529f\u80fd\u3002";
  }
  return "";
}

export function matchLocalIntent(message) {
  const unsafeReply = getUnsafeRequestReply(message);
  if (unsafeReply) return { reply: unsafeReply, action: null };

  const normalized = normalizeMessage(message);
  if (!normalized) return null;

  const wantsAnalysis =
    normalized.includes("\u4e3b\u7ba1\u6458\u8981") ||
    normalized.includes("\u5831\u544a\u6587\u5b57") ||
    normalized.includes("\u672a\u5b8c\u6210\u6e05\u55ae") ||
    normalized.includes("\u985e\u578b\u5360\u6bd4") ||
    normalized.includes("\u5206\u6790") ||
    normalized.includes("\u7d71\u8a08") ||
    normalized.includes("summary") ||
    normalized.includes("report");
  if (wantsAnalysis) {
    return {
      reply: "\u6211\u6703\u4f7f\u7528\u76ee\u524d dashboard \u8cc7\u6599\u6574\u7406\u5206\u6790\u8349\u7a3f\u3002",
      action: createAnalysisAction(message)
    };
  }

  const wantsCalendar =
    normalized.includes("\u884c\u4e8b\u66c6") ||
    normalized.includes("\u65e5\u66c6") ||
    normalized.includes("\u6392\u7a0b") ||
    normalized.includes("\u6703\u8b70") ||
    normalized.includes("calendar");
  if (wantsCalendar) {
    return {
      reply: "\u5df2\u6574\u7406\u6210\u65e5\u66c6\u8349\u7a3f\uff0c\u76ee\u524d\u5c1a\u672a\u76f4\u63a5\u5beb\u5165\u65e5\u66c6\u3002",
      action: inferCalendarDraft(message)
    };
  }

  const wantsTodo =
    normalized.includes("todo") ||
    normalized.includes("\u5f85\u8fa6") ||
    normalized.includes("\u63d0\u9192") ||
    normalized.includes("\u65b0\u589e\u5de5\u4f5c") ||
    normalized.includes("\u65b0\u589e\u4e00\u500b") ||
    normalized.includes("\u5efa\u7acb\u5f85\u8fa6") ||
    normalized.includes("\u52a0\u5165\u5f85\u8fa6");
  if (wantsTodo) {
    const title = inferTodoTitle(message);
    if (!title) {
      return {
        reply: "\u7121\u6cd5\u5b89\u5168\u5efa\u7acb Todo\uff1a\u7f3a\u5c11\u660e\u78ba\u6a19\u984c\uff0c\u8acb\u88dc\u4e0a\u8981\u5efa\u7acb\u7684\u5f85\u8fa6\u5167\u5bb9\u3002",
        action: null
      };
    }
    return {
      reply: "\u6211\u6703\u5617\u8a66\u4f9d\u7167\u73fe\u6709 Todo API \u898f\u5247\u5efa\u7acb\u5f85\u8fa6\u3002",
      action: {
        type: "create_todo",
        title,
        note: ""
      }
    };
  }

  const intent = NAV_INTENTS.find((item) => item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())));
  if (!intent) return null;
  const pageName = intent.label.replace(OPEN_PREFIX, "");
  return {
    reply: `\u6211\u627e\u5230\u300c${pageName}\u300d\u3002\u4f60\u53ef\u4ee5\u6309\u4e0b\u6309\u9215\u524d\u5f80\u8a72\u9801\u9762\u3002`,
    action: createNavigateAction(intent)
  };
}

export function sanitizeAssistantAction(action) {
  if (!action || typeof action !== "object") return null;

  if (action.type === "navigate") {
    const href = typeof action.href === "string" ? action.href.trim() : "";
    if (!ALLOWED_ASSISTANT_ROUTES.has(href)) return null;
    return {
      type: "navigate",
      href,
      label: typeof action.label === "string" && action.label.trim() ? action.label.trim().slice(0, 40) : "\u524d\u5f80\u9801\u9762"
    };
  }

  if (action.type === "create_todo") {
    const title = cleanText(action.title || action.description || action.note, MAX_TODO_TITLE_LENGTH);
    if (!title) return null;
    return {
      type: "create_todo",
      title,
      note: cleanText(action.note || action.description || "", MAX_ACTION_NOTE_LENGTH)
    };
  }

  if (action.type === "calendar_draft") {
    const title = cleanText(action.title, MAX_TODO_TITLE_LENGTH);
    if (!title) return null;
    return {
      type: "calendar_draft",
      title,
      dateText: cleanText(action.dateText || action.date || "", 60),
      timeText: cleanText(action.timeText || action.time || "", 60),
      note: cleanText(action.note || "", MAX_ACTION_NOTE_LENGTH)
    };
  }

  if (action.type === "analysis") {
    const allowedScopes = new Set(["dashboard", "todo", "work", "kpi"]);
    const scope = allowedScopes.has(action.scope) ? action.scope : "dashboard";
    return {
      type: "analysis",
      scope,
      label: cleanText(action.label || "\u5206\u6790\u7d50\u679c", 60)
    };
  }

  return null;
}

export function sanitizeAssistantReply(reply) {
  const text = typeof reply === "string" ? reply.trim() : "";
  if (!text) return "\u6211\u53ef\u4ee5\u5354\u52a9\u4f60\u5efa\u7acb Todo\u3001\u6574\u7406\u65e5\u66c6\u8349\u7a3f\u3001\u7522\u751f\u5206\u6790\u6458\u8981\uff0c\u6216\u5e36\u4f60\u524d\u5f80 dashboard \u5167\u7684\u529f\u80fd\u9801\u9762\u3002";
  if (hasAnyTerm(text, SECRET_TERMS)) return getUnsafeRequestReply("api key");
  if (hasAnyTerm(text, MUTATION_CLAIM_TERMS)) {
    return "\u6211\u76ee\u524d\u53ea\u6703\u57f7\u884c\u5df2\u5141\u8a31\u7684 Todo \u5efa\u7acb\u52d5\u4f5c\uff1b\u5176\u4ed6\u8cc7\u6599\u8b8a\u66f4\u9700\u8981\u4eba\u5de5\u64cd\u4f5c\u3002";
  }
  return text.slice(0, 700);
}

export function createFallbackReply(message) {
  const localIntent = matchLocalIntent(message);
  if (localIntent) return localIntent;
  return {
    reply: "\u6211\u76ee\u524d\u53ef\u4ee5\u5354\u52a9\u5efa\u7acb Todo\u3001\u7522\u751f\u65e5\u66c6\u8349\u7a3f\u3001\u6574\u7406\u672a\u5b8c\u6210\u6e05\u55ae\u3001\u5206\u6790\u5de5\u4f5c\u985e\u578b\u6216\u7522\u751f KPI \u5831\u544a\u8349\u7a3f\u3002\u8acb\u518d\u8f38\u5165\u66f4\u660e\u78ba\u7684\u4efb\u52d9\u3002",
    action: null
  };
}
