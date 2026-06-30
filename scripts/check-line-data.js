const fs = require("node:fs");
const path = require("node:path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function todayTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function main() {
  const env = loadEnv();
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const request = async (table, query) => {
    const response = await fetch(`${base}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${table} ${response.status}: ${text}`);
    return text ? JSON.parse(text) : [];
  };

  const today = todayTaipei();
  const shouldRoundTrip = process.argv.includes("--round-trip");
  let roundTrip = null;

  if (shouldRoundTrip) {
    const testRoom = "9999";
    const postResponse = await fetch(`${base}/rest/v1/network_test_rooms?on_conflict=date,room_no&select=*`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        date: today,
        room_no: testRoom,
        source: "diagnostic",
        raw_message: "diagnostic 9999",
        status: "待測試",
        note: "temporary round-trip check"
      })
    });
    const postText = await postResponse.text();
    if (!postResponse.ok) throw new Error(`round-trip insert ${postResponse.status}: ${postText}`);

    const deleteResponse = await fetch(
      `${base}/rest/v1/network_test_rooms?date=eq.${encodeURIComponent(today)}&room_no=eq.${testRoom}&source=eq.diagnostic`,
      {
        method: "DELETE",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Prefer: "return=representation"
        }
      }
    );
    const deleteText = await deleteResponse.text();
    if (!deleteResponse.ok) throw new Error(`round-trip cleanup ${deleteResponse.status}: ${deleteText}`);
    roundTrip = {
      inserted: JSON.parse(postText || "[]").length,
      cleaned: JSON.parse(deleteText || "[]").length
    };
  }

  const [todayRooms, latestRooms, latestLogs] = await Promise.all([
    request(
      "network_test_rooms",
      `select=date,room_no,status,source,created_at,updated_at&date=eq.${encodeURIComponent(today)}&order=room_no.asc`
    ),
    request(
      "network_test_rooms",
      "select=date,room_no,status,source,created_at,updated_at&order=created_at.desc&limit=20"
    ),
    request(
      "line_webhook_logs",
      "select=created_at,event_type,source_type,source_id,raw_message,parsed_rooms,result,note&order=created_at.desc&limit=10"
    )
  ]);

  console.log(JSON.stringify({ today, roundTrip, todayRoomCount: todayRooms.length, todayRooms, latestRooms, latestLogs }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
