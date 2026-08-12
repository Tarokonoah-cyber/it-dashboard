const API_TIMEOUT_MS = 20_000;

function redirectForAuthenticationFailure(status) {
  if (typeof window === "undefined") return;
  if (status === 401) {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?next=${encodeURIComponent(currentPath)}`);
  }
}

export async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("系統回應逾時，請稍後再試");
    throw new Error("目前無法連線到系統，請檢查網路後再試");
  } finally {
    window.clearTimeout(timeout);
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  if (!response.ok || !data.success) {
    redirectForAuthenticationFailure(response.status);
    throw new Error(data.message || "資料讀取失敗");
  }
  return data.data;
}
