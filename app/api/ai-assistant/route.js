import { requireDashboardAuth } from "../../../lib/auth";
import { supabaseRequest, todayTaipei } from "../../../lib/supabase-rest";
import { createTodoWithWorkLog } from "../../../lib/dailyOpsSync";
import {
  createFallbackReply,
  getUnsafeRequestReply,
  matchLocalIntent,
  sanitizeAssistantAction,
  sanitizeAssistantReply
} from "../../../lib/aiAssistantIntents";

const MAX_MESSAGE_LENGTH = 500;
const GEMINI_MODEL = "gemini-1.5-flash";
const DONE_STATUSES = new Set(["\u5df2\u5b8c\u6210", "\u5b8c\u6210", "Done", "done"]);

function json(data, status = 200) {
  return Response.json(data, { status });
}

function dateKey(value) {
  return value ? String(value).slice(0, 10) : "";
}

function isDone(row) {
  return DONE_STATUSES.has(String(row?.status || "").trim());
}

function normalizeTodo(row) {
  return {
    ...row,
    title: row?.title || row?.description || row?.subject || "\u672a\u547d\u540d\u5f85\u8fa6",
    status: String(row?.status || "\u5f85\u8fa6").trim()
  };
}

function normalizeWork(row) {
  return {
    ...row,
    title: row?.title || row?.description || row?.subject || row?.content || "\u672a\u547d\u540d\u5de5\u4f5c",
    status: String(row?.status || "\u672a\u5b8c\u6210").trim(),
    category: row?.category || row?.type || "\u5de5\u4f5c"
  };
}

function buildPrompt(message) {
  return [
    "\u4f60\u662f IT dashboard \u7684 AI \u52a9\u7406\uff0c\u53ea\u80fd\u4f7f\u7528\u7cfb\u7d71\u5141\u8a31\u7684 action\u3002",
    "\u5141\u8a31 action.type\uff1anavigate, create_todo, calendar_unavailable, complete_work_item, analysis\u3002",
    "navigate.href \u53ea\u80fd\u662f\u7ad9\u5167 allowlist \u8def\u5f91\uff1b\u4e0d\u53ef\u56de\u50b3\u5916\u90e8 URL\u3002",
    "create_todo \u53ea\u80fd\u7528\u65bc\u5efa\u7acb\u5f85\u8fa6\uff0c\u8f38\u51fa title \u8207\u9078\u586b note\uff0c\u4e0d\u8981\u8072\u7a31\u5df2\u6210\u529f\uff0cserver \u6703\u771f\u6b63\u57f7\u884c\u5f8c\u8986\u5beb\u56de\u8986\u3002",
    "calendar_unavailable \u7528\u65bc dashboard \u5167\u5efa\u884c\u4e8b\u66c6\u8acb\u6c42\uff0c\u56e0\u76ee\u524d\u6c92\u6709\u5b89\u5168\u65b0\u589e API\uff0c\u4e0d\u80fd\u8072\u7a31\u5df2\u52a0\u5165\u65e5\u66c6\u3002",
    "complete_work_item \u7528\u65bc\u5b8c\u6210\u5de5\u4f5c\u9805\u76ee\u8acb\u6c42\uff0c\u53ea\u80fd\u8f38\u51fa\u8981\u5339\u914d\u7684 title\uff0cserver \u6703\u78ba\u8a8d\u552f\u4e00\u5339\u914d\u5f8c\u624d\u66f4\u65b0\u3002",
    "analysis \u53ea\u80fd\u8acb server \u7528\u73fe\u6709 dashboard/work/todo \u8cc7\u6599\u7522\u751f\u6458\u8981\uff0c\u4e0d\u8981\u7de8\u9020\u6578\u5b57\u3002",
    "\u522a\u9664\u3001\u4fee\u6539\u3001\u66f4\u65b0\u3001\u6e05\u7a7a\u8cc7\u6599\u7b49 destructive intent \u4e00\u5f8b\u62d2\u7d55\u3002",
    "\u4e0d\u8981\u8981\u6c42\u6216\u63d0\u4f9b\u5bc6\u78bc\u3001API key\u3001env\u3001service role\u3001GEMINI_API_KEY\u3002",
    "\u4e0d\u8981\u8f38\u51fa SQL\u3001Apps Script \u6216\u5916\u90e8 URL action\u3002",
    "\u8acb\u53ea\u8f38\u51fa JSON\uff0c\u4e0d\u8981 markdown\u3002",
    'JSON \u683c\u5f0f\uff1a{"reply":"\u6587\u5b57","action":{"type":"analysis","scope":"dashboard","label":"\u4e3b\u7ba1\u6458\u8981"} \u6216 null}',
    `\u4f7f\u7528\u8005\u8a0a\u606f\uff1a${message}`
  ].join("\n");
}

function parseGeminiJson(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonText);
}

async function askGemini(message, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(message) }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 400,
            responseMimeType: "application/json"
          }
        })
      }
    );
    if (!response.ok) {
      console.error("[ai-assistant gemini error]", { status: response.status });
      return null;
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!text) return null;
    const parsed = parseGeminiJson(text);
    return {
      reply: sanitizeAssistantReply(parsed?.reply),
      action: sanitizeAssistantAction(parsed?.action)
    };
  } catch (error) {
    console.error("[ai-assistant gemini unavailable]", { name: error?.name || "Error" });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function createTodo(action) {
  if (!action?.title) {
    return {
      reply: "\u7121\u6cd5\u5efa\u7acb Todo\uff1a\u7f3a\u5c11\u660e\u78ba\u6a19\u984c\u3002",
      action: { type: "create_todo", status: "failed", title: "" }
    };
  }

  try {
    const { todo, workLog } = await createTodoWithWorkLog({
      title: action.title,
      note: action.note || "",
      status: "\u672a\u5b8c\u6210",
      priority: "\u4e2d",
      owner: "Noah",
      due_date: todayTaipei()
    }, "vercel-dashboard-bot");
    return {
      reply: `\u5df2\u65b0\u589e\u5f85\u8fa6\uff1a${todo.title}`,
      action: {
        type: "create_todo",
        status: "created",
        title: todo.title,
        id: todo.id || null,
        workLogId: workLog?.id || null
      }
    };
  } catch (error) {
    console.error("[ai-assistant create_todo error]", { name: error?.name || "Error" });
    const rawMessage = error?.message ? String(error.message) : "Unknown error";
    const safeMessage = rawMessage
      .replace(/eyJ[\w.-]+/g, "[redacted]")
      .replace(/Bearer\s+[\w.-]+/gi, "Bearer [redacted]")
      .replace(/apikey\s*[:=]\s*[\w.-]+/gi, "apikey=[redacted]")
      .replace(/\b[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|SERVICE_ROLE)[A-Z0-9_]*\b/g, "[redacted setting]")
      .slice(0, 180);
    return {
      reply: `Todo \u5efa\u7acb\u5931\u6557\uff1a${safeMessage}`,
      action: {
        type: "create_todo",
        status: "failed",
        title: action.title
      }
    };
  }
}

async function getAnalysisData() {
  const [todoRows, workRows] = await Promise.all([
    supabaseRequest("todo_logs", "select=*&order=created_at.desc&limit=500"),
    supabaseRequest("work_logs", "select=*&order=date.desc,updated_at.desc,created_at.desc&limit=500")
  ]);
  const todos = todoRows.map(normalizeTodo);
  const works = workRows.map(normalizeWork);
  const openTodos = todos.filter((row) => !isDone(row));
  const completedTodos = todos.filter(isDone);
  const today = todayTaipei();
  const month = today.slice(0, 7);
  const monthWorks = works.filter((row) => dateKey(row.date || row.created_at).startsWith(month));
  const typeCounts = monthWorks.reduce((acc, row) => {
    const key = row.category || "\u5de5\u4f5c";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return { todos, works, openTodos, completedTodos, monthWorks, typeCounts };
}

function formatTopCounts(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => `${label} ${count} \u7b46`)
    .join("\u3001");
}

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function latinTokens(value) {
  return String(value || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}

function cjkChars(value) {
  return Array.from(new Set((String(value || "").match(/[\u4e00-\u9fff]/g) || [])));
}

function isWorkMatch(query, work) {
  const queryText = normalizeMatchText(query);
  const titleText = normalizeMatchText(work?.title);
  if (!queryText || !titleText) return false;
  if (titleText.includes(queryText) || queryText.includes(titleText)) return true;

  const titleSource = String(work?.title || "").toLowerCase();
  const requiredLatinTokens = latinTokens(query);
  if (requiredLatinTokens.some((token) => !titleSource.includes(token))) return false;

  const requiredChars = cjkChars(query);
  if (!requiredChars.length) return requiredLatinTokens.length > 0;
  const matchedChars = requiredChars.filter((char) => titleText.includes(char)).length;
  return matchedChars / requiredChars.length >= 0.75;
}

async function createAnalysis(action) {
  try {
    const data = await getAnalysisData();
    const totalTodos = data.openTodos.length + data.completedTodos.length;
    const completionRate = totalTodos ? Math.round((data.completedTodos.length / totalTodos) * 100) : null;
    if (!data.todos.length && !data.works.length) {
      return {
        reply: "\u76ee\u524d dashboard \u8cc7\u6599\u4e0d\u8db3\uff0c\u9084\u7121\u6cd5\u7522\u751f\u53ef\u9760\u5206\u6790\u3002",
        action: { type: "analysis", label: action.label || "\u5206\u6790\u7d50\u679c", scope: action.scope, status: "insufficient_data" }
      };
    }

    let reply;
    if (action.scope === "todo") {
      const todoList = data.openTodos.slice(0, 6).map((todo) => todo.title).join("\u3001");
      reply = data.openTodos.length
        ? `\u672a\u5b8c\u6210\u4e8b\u9805\u5171 ${data.openTodos.length} \u7b46\u3002\u512a\u5148\u6aa2\u8996\uff1a${todoList}\u3002`
        : "\u76ee\u524d\u6c92\u6709\u672a\u5b8c\u6210 Todo\u3002";
    } else if (action.scope === "work") {
      const top = formatTopCounts(data.typeCounts);
      reply = top
        ? `\u672c\u6708\u5de5\u4f5c\u985e\u578b\u7d71\u8a08\uff1a${top}\u3002`
        : "\u672c\u6708\u5de5\u4f5c\u8cc7\u6599\u4e0d\u8db3\uff0c\u7121\u6cd5\u5206\u6790\u985e\u578b\u5360\u6bd4\u3002";
    } else if (action.scope === "kpi") {
      reply = `KPI \u5831\u544a\u8349\u7a3f\uff1a\u672c\u6708\u5de5\u4f5c ${data.monthWorks.length} \u7b46\uff0c\u672a\u5b8c\u6210 Todo ${data.openTodos.length} \u7b46${completionRate == null ? "" : `\uff0cTodo \u5b8c\u6210\u7387 ${completionRate}%`}\u3002\u6b64\u5167\u5bb9\u50c5\u70ba\u8349\u7a3f\uff0c\u672a\u5beb\u5165 KPI \u6216\u8cc7\u6599\u5eab\u3002`;
    } else {
      reply = `\u4e3b\u7ba1\u6458\u8981\u8349\u7a3f\uff1a\u672c\u6708\u5de5\u4f5c ${data.monthWorks.length} \u7b46\uff0c\u76ee\u524d\u672a\u5b8c\u6210 Todo ${data.openTodos.length} \u7b46${completionRate == null ? "" : `\uff0cTodo \u5b8c\u6210\u7387 ${completionRate}%`}\u3002\u5efa\u8b70\u512a\u5148\u8ffd\u8e64\u672a\u5b8c\u6210\u9805\u76ee\u8207\u7576\u6708\u5de5\u4f5c\u985e\u578b\u96c6\u4e2d\u7684\u9805\u76ee\u3002`;
    }

    return {
      reply,
      action: {
        type: "analysis",
        label: action.label || "\u5206\u6790\u7d50\u679c",
        scope: action.scope,
        status: "ready"
      }
    };
  } catch (error) {
    console.error("[ai-assistant analysis error]", { name: error?.name || "Error" });
    return {
      reply: "\u76ee\u524d\u7121\u6cd5\u8b80\u53d6\u8db3\u5920\u7684 dashboard \u8cc7\u6599\uff0c\u5206\u6790\u8cc7\u6599\u4e0d\u8db3\u3002",
      action: { type: "analysis", label: action.label || "\u5206\u6790\u7d50\u679c", scope: action.scope, status: "insufficient_data" }
    };
  }
}

function createCalendarUnavailable(action) {
  return {
    reply: "\u76ee\u524d\u5100\u8868\u677f\u884c\u4e8b\u66c6\u5c1a\u672a\u63a5\u4e0a\u65b0\u589e\u529f\u80fd\u3002",
    action: {
      type: "calendar_unavailable",
      title: action.title,
      dateText: action.dateText || "",
      timeText: action.timeText || "",
      note: action.note || ""
    }
  };
}

async function completeWorkItem(action) {
  const query = String(action?.title || "").trim();
  if (!query) {
    return {
      reply: "\u627e\u4e0d\u5230\u8981\u6a19\u8a18\u5b8c\u6210\u7684\u5de5\u4f5c\u9805\u76ee\uff0c\u8acb\u63d0\u4f9b\u66f4\u660e\u78ba\u7684\u6a19\u984c\u3002",
      action: { type: "complete_work_item", status: "not_found", title: "" }
    };
  }

  try {
    const rows = await supabaseRequest("work_logs", "select=*&order=date.desc,updated_at.desc,created_at.desc&limit=500");
    const matches = rows.map(normalizeWork).filter((work) => !isDone(work) && isWorkMatch(query, work));

    if (matches.length === 0) {
      return {
        reply: `\u627e\u4e0d\u5230\u660e\u78ba\u5339\u914d\u7684\u5de5\u4f5c\uff1a${query}`,
        action: { type: "complete_work_item", status: "not_found", title: query }
      };
    }

    if (matches.length > 1) {
      return {
        reply: `\u627e\u5230 ${matches.length} \u7b46\u53ef\u80fd\u5339\u914d\u7684\u5de5\u4f5c\uff0c\u8acb\u8f38\u5165\u66f4\u660e\u78ba\u7684\u6a19\u984c\u6216 ID\u3002`,
        action: { type: "complete_work_item", status: "ambiguous", title: query }
      };
    }

    const target = matches[0];
    const updatedRows = await supabaseRequest("work_logs", `id=eq.${encodeURIComponent(target.id)}&select=*`, {
      method: "PATCH",
      body: {
        status: "\u5df2\u5b8c\u6210",
        updated_at: new Date().toISOString()
      }
    });
    const updated = normalizeWork(updatedRows[0] || { ...target, status: "\u5df2\u5b8c\u6210" });
    return {
      reply: `\u5df2\u5c07\u5de5\u4f5c\u6a19\u8a18\u5b8c\u6210\uff1a${updated.title}`,
      action: {
        type: "complete_work_item",
        status: "completed",
        title: updated.title,
        id: updated.id || target.id
      }
    };
  } catch (error) {
    console.error("[ai-assistant complete_work_item error]", { name: error?.name || "Error" });
    return {
      reply: "\u76ee\u524d\u5c1a\u672a\u80fd\u5b89\u5168\u6a19\u8a18\u5de5\u4f5c\u5b8c\u6210\u3002",
      action: { type: "complete_work_item", status: "failed", title: query }
    };
  }
}

async function executeAction(result) {
  const action = sanitizeAssistantAction(result?.action);
  if (!action) {
    return {
      reply: sanitizeAssistantReply(result?.reply),
      action: null
    };
  }

  if (action.type === "create_todo") return createTodo(action);
  if (action.type === "calendar_unavailable") return createCalendarUnavailable(action);
  if (action.type === "complete_work_item") return completeWorkItem(action);
  if (action.type === "analysis") return createAnalysis(action);

  return {
    reply: sanitizeAssistantReply(result?.reply),
    action
  };
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "\u8acb\u8f38\u5165\u6307\u4ee4\u5167\u5bb9\u3002" }, 400);
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return json({ success: false, message: "\u8acb\u8f38\u5165\u6307\u4ee4\u5167\u5bb9\u3002" }, 400);
  if (message.length > MAX_MESSAGE_LENGTH) {
    return json({ success: false, message: `\u6307\u4ee4\u5167\u5bb9\u4e0d\u53ef\u8d85\u904e ${MAX_MESSAGE_LENGTH} \u5b57\u3002` }, 400);
  }

  const unsafeReply = getUnsafeRequestReply(message);
  if (unsafeReply) return json({ success: true, reply: unsafeReply, action: null });

  const localIntent = matchLocalIntent(message);
  if (localIntent) {
    const executed = await executeAction(localIntent);
    return json({ success: true, reply: executed.reply, action: executed.action });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const aiResult = apiKey ? await askGemini(message, apiKey) : null;
  const result = aiResult?.reply || aiResult?.action ? aiResult : createFallbackReply(message);
  const executed = await executeAction(result);
  return json({
    success: true,
    reply: executed.reply,
    action: executed.action
  });
}
