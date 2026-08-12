export function safeInternalPath(value, fallback = "/") {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;

  try {
    const base = new URL("https://dashboard.invalid/");
    const destination = new URL(candidate, base);
    if (destination.origin !== base.origin) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
