import crypto from "node:crypto";
import { fail, ok, supabaseRequest, todayTaipei } from "../../../../lib/supabase-rest";

function textOf(value) {
  return String(value || "").trim();
}

function verifyLineSignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) throw new Error("LINE_CHANNEL_SECRET is not configured");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature || ""), Buffer.from(expected));
  } catch {
    return false;
  }
}

function getSource(event) {
  const source = event?.source || {};
  const sourceType = textOf(source.type || "unknown");
  const sourceId = textOf(source.groupId || source.roomId || source.userId || "");
  return { sourceType, sourceId };
}

function parseRooms(message) {
  const text = textOf(message);
  if (!/(串流|電視|測試|房號|退房|預進)/.test(text)) return [];
  const rooms = new Set();
  const matches = text.match(/\d{3,4}/g) || [];
  for (const raw of matches) {
    const room = raw.trim();
    if (room.length >= 3 && room.length <= 4) rooms.add(room);
  }
  return Array.from(rooms);
}

async function appendLineLog({ eventType, sourceType, sourceId, rawMessage, rooms, result, note }) {
  await supabaseRequest("line_webhook_logs", "select=*", {
    method: "POST",
    body: {
      event_type: eventType,
      source_type: sourceType,
      source_id: sourceId,
      raw_message: rawMessage,
      parsed_rooms: rooms,
      result,
      note
    }
  });
}

async function upsertRooms({ date, rooms, source, rawMessage }) {
  if (!rooms.length) return [];
  const payload = rooms.map((room) => ({
    date,
    room_no: room,
    source,
    raw_message: rawMessage,
    status: "待測試"
  }));
  return supabaseRequest("network_test_rooms", "on_conflict=date,room_no&select=*", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: payload
  });
}

export async function GET() {
  return ok({
    message: "LINE webhook endpoint ready",
    webhookUrl: "/api/line/webhook"
  });
}

export async function POST(request) {
  let rawBody = "";
  try {
    rawBody = await request.text();
    const signature = request.headers.get("x-line-signature") || "";
    if (!verifyLineSignature(rawBody, signature)) {
      return fail(new Error("LINE signature verification failed"), 401);
    }

    const payload = JSON.parse(rawBody || "{}");
    const events = Array.isArray(payload.events) ? payload.events : [];
    const allowedGroupId = textOf(process.env.LINE_ALLOWED_GROUP_ID);
    const date = todayTaipei();
    const results = [];

    for (const event of events) {
      const { sourceType, sourceId } = getSource(event);
      const rawMessage = textOf(event?.message?.text);

      if (allowedGroupId && sourceId !== allowedGroupId) {
        await appendLineLog({
          eventType: textOf(event.type),
          sourceType,
          sourceId,
          rawMessage,
          rooms: [],
          result: "skipped",
          note: "group_not_allowed"
        });
        continue;
      }

      const rooms = parseRooms(rawMessage);
      if (!rooms.length) {
        await appendLineLog({
          eventType: textOf(event.type),
          sourceType,
          sourceId,
          rawMessage,
          rooms: [],
          result: "skipped",
          note: "no_room_detected"
        });
        continue;
      }

      const source = `LINE:${sourceType}:${sourceId || "unknown"}`;
      const rows = await upsertRooms({ date, rooms, source, rawMessage });
      await appendLineLog({
        eventType: textOf(event.type),
        sourceType,
        sourceId,
        rawMessage,
        rooms,
        result: "upserted",
        note: `rooms=${rooms.join(",")}`
      });
      results.push({ sourceType, sourceId, rooms, affected: rows.length });
    }

    return ok({ eventCount: events.length, results });
  } catch (error) {
    try {
      await appendLineLog({
        eventType: "error",
        sourceType: "unknown",
        sourceId: "",
        rawMessage: rawBody.slice(0, 2000),
        rooms: [],
        result: "error",
        note: error.message
      });
    } catch {
      // Ignore logging errors so LINE still receives a clear response.
    }
    return fail(error);
  }
}
