import { syncBaseball } from "./baseballSync";

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function allowedSecrets() {
  return [
    process.env.CRON_SECRET,
    process.env.SPORTS_SYNC_SECRET,
    process.env.DASHBOARD_AUTH_PASSWORD
  ].filter(Boolean);
}

function isAuthorized(request) {
  const secrets = allowedSecrets();
  if (!secrets.length) return false;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  return secrets.includes(bearer) || secrets.includes(headerSecret);
}

export function baseballSyncHandler(leagues) {
  return async function GET(request) {
    if (!isAuthorized(request)) {
      return json({ success: false, message: "Unauthorized sports sync request." }, 401);
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "1" || searchParams.get("dryRun") === "true";
    const year = Number(searchParams.get("year")) || undefined;
    const result = await syncBaseball({ leagues, year, dryRun });
    return json({ success: result.ok, data: result, message: result.ok ? "ok" : "One or more leagues failed." }, result.ok ? 200 : 207);
  };
}
