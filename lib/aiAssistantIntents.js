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
  "\u91d1\u9470"
];
const MUTATION_TERMS = [
  "\u5df2\u65b0\u589e",
  "\u5df2\u522a\u9664",
  "\u5df2\u4fee\u6539",
  "\u5df2\u66f4\u65b0",
  "\u5df2\u5efa\u7acb",
  "\u5df2\u79fb\u9664",
  "\u5df2\u5beb\u5165",
  "\u5df2\u9001\u51fa",
  "\u5df2\u5b8c\u6210"
];

const INTENTS = [
  {
    href: "/",
    label: `${OPEN_PREFIX}\u5100\u8868\u677f`,
    keywords: ["\u9996\u9801", "\u5100\u8868\u677f", "dashboard", "home", "\u7e3d\u89bd"]
  },
  {
    href: "/documents",
    label: `${OPEN_PREFIX}\u9001\u4ea4\u55ae\u64da\u7d00\u9304`,
    keywords: ["\u9001\u4ea4\u55ae\u64da", "\u55ae\u64da", "documents", "\u6587\u4ef6\u7d00\u9304"]
  },
  {
    href: "/passwords",
    label: `${OPEN_PREFIX}\u5bc6\u78bc\u7ba1\u7406`,
    keywords: ["\u5bc6\u78bc", "password", "passwords", "\u5e33\u5bc6"]
  },
  {
    href: "/contacts",
    label: `${OPEN_PREFIX}\u901a\u8a0a\u9304`,
    keywords: ["\u901a\u8a0a\u9304", "contacts", "\u806f\u7d61\u4eba", "\u5206\u6a5f"]
  },
  {
    href: "/anydesk",
    label: `${OPEN_PREFIX} AnyDesk List`,
    keywords: ["anydesk", "\u9060\u7aef", "\u9060\u7aef\u684c\u9762"]
  },
  {
    href: "/quick-notes",
    label: `${OPEN_PREFIX}\u5feb\u901f\u5099\u5fd8\u9304`,
    keywords: ["\u5feb\u901f\u5099\u5fd8", "quick notes", "quick-notes", "\u5099\u5fd8\u9304", "\u7b46\u8a18"]
  },
  {
    href: "/work",
    label: `${OPEN_PREFIX}\u5de5\u4f5c\u4e2d\u5fc3`,
    keywords: ["\u5de5\u4f5c\u4e2d\u5fc3", "\u5de5\u4f5c\u7d00\u9304", "\u65b0\u589e\u5de5\u4f5c", "work", "\u5de5\u55ae"]
  },
  {
    href: "/assets",
    label: `${OPEN_PREFIX}\u8a2d\u5099\u6e05\u55ae`,
    keywords: ["\u8a2d\u5099\u6e05\u55ae", "\u8cc7\u7522", "assets", "\u8a2d\u5099"]
  },
  {
    href: "/assets/mountain-pc",
    label: `${OPEN_PREFIX}\u5c71\u4e0a\u96fb\u8166`,
    keywords: ["\u5c71\u4e0a\u96fb\u8166", "\u5c71\u4e0a pc", "\u5c71\u4e0apc", "mountain pc", "mountain-pc"]
  },
  {
    href: "/assets/downhill-pc",
    label: `${OPEN_PREFIX}\u5c71\u4e0b\u96fb\u8166`,
    keywords: ["\u5c71\u4e0b\u96fb\u8166", "\u5c71\u4e0b pc", "\u5c71\u4e0bpc", "downhill pc", "downhill-pc"]
  },
  {
    href: "/assets/printers",
    label: `${OPEN_PREFIX}\u5370\u8868\u6a5f`,
    keywords: ["\u5370\u8868\u6a5f", "printer", "printers", "\u4e8b\u52d9\u6a5f"]
  },
  {
    href: "/assets/north-ya",
    label: `${OPEN_PREFIX}\u5317YA`,
    keywords: ["\u5317ya", "\u5317 ya", "north ya", "north-ya"]
  },
  {
    href: "/assets/iptv",
    label: `${OPEN_PREFIX} IPTV`,
    keywords: ["iptv", "\u96fb\u8996\u76d2", "\u96fb\u8996"]
  },
  {
    href: "/contracts",
    label: `${OPEN_PREFIX}\u5408\u7d04\u7e3d\u89bd`,
    keywords: ["\u5408\u7d04\u7e3d\u89bd", "\u5408\u7d04", "contracts", "\u7d04\u671f"]
  },
  {
    href: "/contracts/software",
    label: `${OPEN_PREFIX}\u8edf\u9ad4\u5408\u7d04`,
    keywords: ["\u8edf\u9ad4\u5408\u7d04", "software contract", "software contracts", "\u6388\u6b0a\u5408\u7d04"]
  },
  {
    href: "/contracts/mobile",
    label: `${OPEN_PREFIX}\u884c\u52d5\u96fb\u8a71\u7d04\u671f`,
    keywords: ["\u884c\u52d5\u96fb\u8a71", "\u624b\u6a5f\u5408\u7d04", "mobile contract", "mobile contracts", "\u9580\u865f"]
  },
  {
    href: "/sop/docs",
    label: `${OPEN_PREFIX} SOP`,
    keywords: ["sop", "\u6a19\u6e96\u4f5c\u696d", "\u4f5c\u696d\u6d41\u7a0b"]
  },
  {
    href: "/sop/soc",
    label: `${OPEN_PREFIX} SOC`,
    keywords: ["soc", "\u8cc7\u5b89\u76e3\u63a7"]
  },
  {
    href: "/settings",
    label: `${OPEN_PREFIX}\u8a2d\u5b9a`,
    keywords: ["\u8a2d\u5b9a", "settings", "\u7cfb\u7d71\u8a2d\u5b9a"]
  },
  {
    href: "/boss-kpi",
    label: `${OPEN_PREFIX}\u4e3b\u7ba1 KPI`,
    keywords: ["kpi", "\u4e3b\u7ba1kpi", "\u4e3b\u7ba1 kpi", "boss kpi", "boss-kpi"]
  }
];

function normalizeMessage(message) {
  return String(message || "").trim().toLowerCase();
}

function hasAnyTerm(text, terms) {
  const normalized = normalizeMessage(text);
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function createNavigateAction(intent) {
  return {
    type: "navigate",
    href: intent.href,
    label: intent.label
  };
}

export function matchLocalIntent(message) {
  const normalized = normalizeMessage(message);
  if (!normalized) return null;
  const intent = INTENTS.find((item) => item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())));
  if (!intent) return null;
  const pageName = intent.label.replace(OPEN_PREFIX, "");
  return {
    reply: `\u6211\u627e\u5230\u300c${pageName}\u300d\u3002\u4f60\u53ef\u4ee5\u6309\u4e0b\u6309\u9215\u524d\u5f80\u8a72\u9801\u9762\u3002`,
    action: createNavigateAction(intent)
  };
}

export function sanitizeAssistantAction(action) {
  if (!action || typeof action !== "object") return null;
  if (action.type !== "navigate") return null;
  const href = typeof action.href === "string" ? action.href.trim() : "";
  if (!ALLOWED_ASSISTANT_ROUTES.has(href)) return null;
  return {
    type: "navigate",
    href,
    label: typeof action.label === "string" && action.label.trim() ? action.label.trim().slice(0, 40) : "\u524d\u5f80\u9801\u9762"
  };
}

export function sanitizeAssistantReply(reply) {
  const text = typeof reply === "string" ? reply.trim() : "";
  if (!text) return "\u6211\u53ef\u4ee5\u5354\u52a9\u4f60\u627e\u5230 dashboard \u88e1\u7684\u529f\u80fd\u9801\u9762\u3002\u8acb\u518d\u8f38\u5165\u60f3\u524d\u5f80\u7684\u529f\u80fd\u540d\u7a31\u3002";
  if (hasAnyTerm(text, SECRET_TERMS)) {
    return "\u6211\u4e0d\u80fd\u8981\u6c42\u6216\u8655\u7406\u5bc6\u78bc\u3001API key\u3001env \u6216\u5176\u4ed6\u654f\u611f\u8cc7\u8a0a\u3002\u82e5\u4f60\u8981\u627e\u7cfb\u7d71\u9801\u9762\uff0c\u8acb\u76f4\u63a5\u63cf\u8ff0\u529f\u80fd\u540d\u7a31\u3002";
  }
  if (hasAnyTerm(text, MUTATION_TERMS)) {
    return "\u6211\u76ee\u524d\u53ea\u80fd\u5354\u52a9\u5224\u65b7\u529f\u80fd\u5165\u53e3\u8207\u5c0e\u9801\uff0c\u4e0d\u80fd\u65b0\u589e\u3001\u522a\u9664\u6216\u4fee\u6539\u8cc7\u6599\u3002";
  }
  return text.slice(0, 500);
}

export function createFallbackReply(message) {
  const localIntent = matchLocalIntent(message);
  if (localIntent) return localIntent;
  return {
    reply: "\u6211\u76ee\u524d\u53ef\u4ee5\u5354\u52a9\u4f60\u524d\u5f80\u5100\u8868\u677f\u3001\u5de5\u4f5c\u4e2d\u5fc3\u3001\u8a2d\u5099\u3001\u5408\u7d04\u3001SOP\u3001\u8a2d\u5b9a\u7b49\u9801\u9762\u3002\u8acb\u7528\u529f\u80fd\u540d\u7a31\u518d\u8a66\u4e00\u6b21\u3002",
    action: null
  };
}
