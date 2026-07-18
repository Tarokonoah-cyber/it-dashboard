import { isRetryableLineStatus } from "./lineNotificationPolicy";

function responseDetail(responseText) {
  let detail = responseText;
  try {
    const payload = JSON.parse(responseText);
    const reasons = Array.isArray(payload?.details)
      ? payload.details.map((item) => String(item?.message || item || "").trim()).filter(Boolean)
      : [];
    detail = [payload?.message, ...reasons].filter(Boolean).join("：") || responseText;
  } catch {
    // Keep the original response text.
  }
  return String(detail || "推播失敗").slice(0, 240);
}

async function sendRequest({ url, token, userId, messages, retryKey, fetchImpl, timeoutMs }) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Line-Retry-Key": retryKey
      },
      body: JSON.stringify({ to: userId, messages }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (error && typeof error === "object") {
      error.lineRetryable = error.name === "TimeoutError" || error.name === "AbortError";
    }
    throw error;
  }

  const responseText = await response.text();
  const requestId = String(response.headers.get("x-line-request-id") || "").trim();
  const acceptedRequestId = String(response.headers.get("x-line-accepted-request-id") || "").trim();
  if (response.ok || response.status === 409) {
    return { status: response.status, accepted: true, requestId, acceptedRequestId, retryKey };
  }

  const suffix = requestId ? ` (request ${requestId})` : "";
  const error = new Error(`LINE API ${response.status}: ${responseDetail(responseText)}${suffix}`);
  error.status = response.status;
  error.requestId = requestId;
  error.lineRetryable = isRetryableLineStatus(response.status);
  throw error;
}

export async function sendLinePushRequest({
  url,
  token,
  userId,
  messages,
  retryKey,
  fetchImpl = fetch,
  timeoutMs = 12000
}) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await sendRequest({ url, token, userId, messages, retryKey, fetchImpl, timeoutMs });
    } catch (error) {
      lastError = error;
      if (attempt === 0 && error?.lineRetryable) continue;
      throw error;
    }
  }
  throw lastError;
}
