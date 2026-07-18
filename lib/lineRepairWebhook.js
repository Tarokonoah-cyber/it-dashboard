import { createHmac, timingSafeEqual } from "node:crypto";
import { LineRepairPayloadError, validateLineRepairEventPayload } from "./lineRepairTask";

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
const MAX_RAW_BODY_BYTES = 128 * 1024;
const SIGNATURE_PATTERN = /^sha256=([a-f0-9]{64})$/i;
const EVENT_HEADER_PATTERN = /^repair\.(?:created|in_progress|completed|closed|reopened|cancelled|updated)$/;
const EVENT_ID_HEADER_PATTERN = /^[A-Za-z0-9._:-]{1,240}$/;

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function unauthorized() {
  return jsonResponse({ success: false, message: "Unauthorized" }, 401);
}

export function parseLineRepairTimestamp(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return Number.NaN;
  if (/^\d{10,13}$/.test(normalized)) {
    const numeric = Number(normalized);
    if (!Number.isSafeInteger(numeric)) return Number.NaN;
    return normalized.length <= 10 ? numeric * 1000 : numeric;
  }
  return Date.parse(normalized);
}

export function verifyLineRepairSignature({ rawBody, timestamp, signature, secret }) {
  const match = String(signature || "").match(SIGNATURE_PATTERN);
  if (!match || !secret) return false;
  const received = Buffer.from(match[1], "hex");
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function handleLineRepairWebhook(request, options = {}) {
  const rawBody = await request.text();
  const processEvent = options.processEvent;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const secret = String(process.env.IT_DASHBOARD_WEBHOOK_SECRET || "");

  if (!secret) {
    console.error("[line repair webhook unavailable] missing server configuration");
    return jsonResponse({ success: false, message: "Webhook unavailable" }, 503);
  }

  const eventType = String(request.headers.get("x-line-repair-event") || "").trim();
  const eventId = String(request.headers.get("x-line-repair-event-id") || "").trim();
  const timestamp = String(request.headers.get("x-line-repair-timestamp") || "").trim();
  const signature = String(request.headers.get("x-line-repair-signature") || "").trim();
  const timestampMs = parseLineRepairTimestamp(timestamp);

  if (
    !EVENT_HEADER_PATTERN.test(eventType)
    || !EVENT_ID_HEADER_PATTERN.test(eventId)
    || !Number.isFinite(timestampMs)
    || !SIGNATURE_PATTERN.test(signature)
    || Math.abs(now() - timestampMs) > MAX_TIMESTAMP_DRIFT_MS
  ) {
    return unauthorized();
  }

  if (!verifyLineRepairSignature({ rawBody, timestamp, signature, secret })) {
    return unauthorized();
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_RAW_BODY_BYTES) {
    return jsonResponse({ success: false, message: "Payload too large" }, 413);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ success: false, message: "Invalid JSON" }, 400);
  }

  let event;
  try {
    event = validateLineRepairEventPayload(parsed, { eventType, eventId });
  } catch (error) {
    if (error instanceof LineRepairPayloadError) {
      return jsonResponse({ success: false, message: error.message }, 400);
    }
    return jsonResponse({ success: false, message: "Invalid payload" }, 400);
  }

  if (typeof processEvent !== "function") {
    console.error("[line repair webhook unavailable] processor is missing");
    return jsonResponse({ success: false, message: "Webhook unavailable" }, 503);
  }

  try {
    const result = await processEvent(event);
    return jsonResponse({
      success: true,
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        duplicate: Boolean(result?.duplicate),
        stale: Boolean(result?.stale),
        action: String(result?.action || "processed"),
        taskId: result?.taskId || null
      }
    });
  } catch (error) {
    console.error("[line repair webhook processing failed]", String(error?.name || "Error").slice(0, 80));
    return jsonResponse({ success: false, message: "Webhook processing failed" }, 500);
  }
}
