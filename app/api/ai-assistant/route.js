import {
  createFallbackReply,
  matchLocalIntent,
  sanitizeAssistantAction,
  sanitizeAssistantReply
} from "../../../lib/aiAssistantIntents";

const MAX_MESSAGE_LENGTH = 500;
const GEMINI_MODEL = "gemini-1.5-flash";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function buildPrompt(message) {
  return [
    "\u4f60\u662f IT dashboard \u7684 AI \u6307\u4ee4\u52a9\u624b\uff0c\u53ea\u80fd\u5354\u52a9\u4f7f\u7528\u8005\u5224\u65b7\u8981\u524d\u5f80\u54ea\u500b\u65e2\u6709\u529f\u80fd\u9801\u9762\u3002",
    "\u4e0d\u8981\u8072\u7a31\u4f60\u5df2\u65b0\u589e\u3001\u522a\u9664\u3001\u4fee\u6539\u3001\u66f4\u65b0\u6216\u5beb\u5165\u4efb\u4f55\u8cc7\u6599\u3002",
    "\u4e0d\u8981\u8981\u6c42\u4f7f\u7528\u8005\u63d0\u4f9b\u5bc6\u78bc\u3001API key\u3001token\u3001env\u3001\u91d1\u9470\u6216\u4efb\u4f55\u654f\u611f\u8cc7\u8a0a\u3002",
    "\u4e0d\u8981\u56de\u50b3\u5916\u90e8 URL\u3002action.href \u53ea\u80fd\u662f\u7ad9\u5167\u8def\u5f91\u3002",
    "\u82e5\u7121\u6cd5\u5224\u65b7\u9801\u9762\uff0caction \u5fc5\u9808\u662f null\uff0c\u4e26\u7528\u7e41\u9ad4\u4e2d\u6587\u7c21\u77ed\u56de\u8986\u3002",
    "\u8acb\u53ea\u8f38\u51fa JSON\uff0c\u4e0d\u8981 markdown\u3002",
    'JSON \u683c\u5f0f\uff1a{"reply":"\u6587\u5b57","action":{"type":"navigate","href":"/work","label":"\u958b\u555f\u5de5\u4f5c\u4e2d\u5fc3"} \u6216 null}',
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
            maxOutputTokens: 300,
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

export async function POST(request) {
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

  const localIntent = matchLocalIntent(message);
  if (localIntent) {
    return json({ success: true, reply: localIntent.reply, action: localIntent.action });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const aiResult = apiKey ? await askGemini(message, apiKey) : null;
  const result = aiResult?.reply ? aiResult : createFallbackReply(message);
  return json({
    success: true,
    reply: sanitizeAssistantReply(result.reply),
    action: sanitizeAssistantAction(result.action)
  });
}
