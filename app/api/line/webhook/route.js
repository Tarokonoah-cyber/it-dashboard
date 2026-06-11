import crypto from "node:crypto";
import { ok, supabaseRequest, todayTaipei } from "../../../../lib/supabase-rest";

function textOf(value) {
  return String(value || "").trim();
}

function json200(data) {
  return Response.json(data, { status: 200 });
}

function verifyLineSignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return { ok: false, reason: "missing LINE_CHANNEL_SECRET" };

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
  try {
    const matched = crypto.timingSafeEqual(Buffer.from(signature || ""), Buffer.from(expected));
    return matched ? { ok: true, reason: "verified" } : { ok: false, reason: "signature mismatch" };
  } catch {
    return { ok: false, reason: "signature compare failed" };
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
  try {
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
    status: "待測試",
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

    const payload = JSON.parse(rawBody || "{}");
    const events = Array.isArray(payload.events) ? payload.events : [];
    const allowedGroupId = textOf(process.env.LINE_ALLOWED_GROUP_ID);
    const results = [];

    if (!signatureCheck.ok) {
      await appendLineLog({
        eventType: "signature_warning",
        sourceType: "line",
        sourceId: "",
        rawMessage: rawBody.slice(0, 2000),
        rooms: [],
        result: "accepted_with_warning",
        note: signatureCheck.reason
      });
    }

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

    return json200({
      success: true,
      message: "LINE webhook accepted",
      data: {
        eventCount: events.length,
        signature: signatureCheck.reason,
        results
      }
    });
  } catch (error) {
    await appendLineLog({
      eventType: "error",
      sourceType: "line",
      sourceId: "",
      rawMessage: rawBody.slice(0, 2000),
      rooms: [],
      result: "error",
      note: error.message
    });

    return json200({
      success: false,
      message: error.message || "LINE webhook accepted with error",
      data: { date }
    });
  }
}
