import crypto from "node:crypto";
import { fail, ok, supabaseRequest, todayTaipei } from "../../../../lib/supabase-rest";

const STATUS_PENDING = "\u5f85\u6e2c\u8a66";

function textOf(value) {
  return String(value || "").trim();
}

function verifyLineSignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return { success: false, message: "missing LINE_CHANNEL_SECRET" };

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
  try {
    const matched = crypto.timingSafeEqual(Buffer.from(signature || ""), Buffer.from(expected));
    return matched
      ? { success: true, message: "verified" }
      : { success: false, message: "signature mismatch" };
  } catch {
    return { success: false, message: "signature compare failed" };
  }
}

function getSource(event) {
  const source = event?.source || {};
  return {
    sourceType: textOf(source.type || "unknown"),
    sourceId: textOf(source.groupId || source.roomId || source.userId || "")
  };
}

function parseRooms(message) {
  const rooms = new Set();
  const matches = textOf(message).match(/\d{3,4}/g) || [];
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

async function safeAppendLineLog(data) {
  try {
    await appendLineLog(data);
  } catch (error) {
    console.error("line_webhook_logs insert failed", error);
  }
}

async function upsertRooms({ date, rooms, source, rawMessage }) {
  if (!rooms.length) return [];
  const payload = rooms.map((room) => ({
    date,
    room_no: room,
    source,
    raw_message: rawMessage,
    status: STATUS_PENDING,
    note: ""
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
  const date = todayTaipei();

  try {
    rawBody = await request.text();
    const signature = request.headers.get("x-line-signature") || "";
    const signatureCheck = verifyLineSignature(rawBody, signature);

    if (!signatureCheck.success) {
      await safeAppendLineLog({
        eventType: "signature_rejected",
        sourceType: "line",
        sourceId: "",
        rawMessage: rawBody.slice(0, 2000),
        rooms: [],
        result: "rejected",
        note: signatureCheck.message
      });
      return fail(new Error("LINE signature verification failed"), 401);
    }

    const payload = JSON.parse(rawBody || "{}");
    const events = Array.isArray(payload.events) ? payload.events : [];
    const allowedGroupId = textOf(process.env.LINE_ALLOWED_GROUP_ID);
    const results = [];

    for (const event of events) {
      const { sourceType, sourceId } = getSource(event);
      const rawMessage = textOf(event?.message?.text);

      if (allowedGroupId && sourceId !== allowedGroupId) {
        await safeAppendLineLog({
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
        await safeAppendLineLog({
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
      await safeAppendLineLog({
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

    return ok({
      eventCount: events.length,
      signature: signatureCheck.message,
      results
    });
  } catch (error) {
    await safeAppendLineLog({
      eventType: "error",
      sourceType: "line",
      sourceId: "",
      rawMessage: rawBody.slice(0, 2000),
      rooms: [],
      result: "error",
      note: error.message
    });

    return fail(error);
  }
}
