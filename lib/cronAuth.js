export function isCronAuthorized(request, secret) {
  const expected = String(secret || "").trim();
  if (!expected) return false;
  const authorization = String(request?.headers?.get?.("authorization") || "");
  return authorization === `Bearer ${expected}`;
}
