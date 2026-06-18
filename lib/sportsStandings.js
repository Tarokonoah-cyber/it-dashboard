import { normalizeTeamName } from "./sportsTeams.js";

const SUPPORTED_BASEBALL_LEAGUES = new Set(["CPBL", "MLB", "NPB"]);
const CPBL_STANDINGS_URL = "https://www.cpbl.com.tw/";
const NPB_CENTRAL_STANDINGS_URL = "https://npb.jp/bis/2026/stats/std_c.html";
const NPB_PACIFIC_STANDINGS_URL = "https://npb.jp/bis/2026/stats/std_p.html";
const MLB_STANDINGS_URL = "https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason&hydrate=team";

function unavailable(league, message, source = null) {
  return {
    league,
    status: "unavailable",
    message,
    source,
    updatedAt: new Date().toISOString(),
    divisions: []
  };
}

async function fetchText(url, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SportsCalendar/1.0 (+https://www.cpbl.com.tw/)"
      },
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"");
}

function htmlToLines(html) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/th|\/h\d)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseCpblStandings(html) {
  const lines = htmlToLines(html);
  const start = lines.findIndex((line, index) => (
    line.includes("球隊戰績")
    && lines[index + 1]?.toLowerCase() === "standing"
    && lines.slice(index, index + 20).includes("出賽數")
  ));
  if (start < 0) throw new Error("CPBL standings block not found");

  const block = lines.slice(start, start + 80);
  const season = block.find((line) => /\d{4}.*半季/.test(line)) || "2026 球季";
  const rows = [];

  for (let index = 0; index < block.length - 6; index += 1) {
    if (!/^\d+$/.test(block[index])) continue;
    const rank = Number(block[index]);
    const team = block[index + 1];
    const games = block[index + 2];
    const record = block[index + 3];
    const pct = block[index + 4];
    const gb = block[index + 5];
    const recent = block[index + 6];
    const recordMatch = record?.match(/^(\d+)-(\d+)-(\d+)$/);
    if (!recordMatch || !team || team === "球隊" || !/^\d+$/.test(games) || !/^[\d.]+$/.test(pct)) continue;
    rows.push({
      rank,
      team: normalizeTeamName(team, "CPBL"),
      teamName: team,
      games: Number(games),
      wins: Number(recordMatch[1]),
      losses: Number(recordMatch[2]),
      ties: Number(recordMatch[3]),
      pct,
      gb,
      recent,
      half: season,
      league: "CPBL"
    });
    index += 6;
  }

  if (rows.length < 6) throw new Error("CPBL standings rows incomplete");

  return {
    league: "CPBL",
    status: "ok",
    source: {
      type: "official_html",
      name: "CPBL 官方戰績",
      url: CPBL_STANDINGS_URL
    },
    updatedAt: new Date().toISOString(),
    season,
    divisions: [{
      key: "regular-season",
      name: season,
      rows
    }]
  };
}

async function fetchCpblStandings() {
  try {
    return parseCpblStandings(await fetchText(CPBL_STANDINGS_URL, "CPBL standings"));
  } catch (error) {
    return unavailable("CPBL", "CPBL 官方排名暫時無法取得", {
      type: "official_html",
      name: "CPBL 官方戰績",
      url: CPBL_STANDINGS_URL,
      error: error.message
    });
  }
}

function splitRecord(record, type) {
  const match = record.records?.splitRecords?.find((item) => item.type === type);
  return match ? `${match.wins}-${match.losses}` : "-";
}

function normalizeMlbDivisionName(division) {
  const idName = {
    201: "美聯東區",
    202: "美聯中區",
    200: "美聯西區",
    204: "國聯東區",
    205: "國聯中區",
    203: "國聯西區"
  }[division?.id];
  if (idName) return idName;

  const name = division?.name;
  return {
    "American League East": "美聯東區",
    "American League Central": "美聯中區",
    "American League West": "美聯西區",
    "National League East": "國聯東區",
    "National League Central": "國聯中區",
    "National League West": "國聯西區"
  }[name] || name || "MLB";
}

async function fetchMlbStandings() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let payload;
    try {
      const response = await fetch(MLB_STANDINGS_URL, {
        signal: controller.signal,
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`MLB standings HTTP ${response.status}`);
      payload = await response.json();
    } finally {
      clearTimeout(timeout);
    }

    const divisions = (payload.records || []).map((record) => ({
      key: normalizeMlbDivisionName(record.division),
      name: normalizeMlbDivisionName(record.division),
      rows: (record.teamRecords || []).map((teamRecord, index) => ({
        rank: index + 1,
        team: normalizeTeamName(teamRecord.team?.name, "MLB"),
        teamName: teamRecord.team?.name,
        wins: teamRecord.wins ?? 0,
        losses: teamRecord.losses ?? 0,
        pct: teamRecord.winningPercentage || ".000",
        gb: teamRecord.gamesBack || "-",
        home: splitRecord(teamRecord, "home"),
        away: splitRecord(teamRecord, "away"),
        l10: splitRecord(teamRecord, "lastTen"),
        league: "MLB"
      }))
    })).filter((division) => division.rows.length);

    if (!divisions.length) throw new Error("MLB standings rows unavailable");

    return {
      league: "MLB",
      status: "ok",
      source: {
        type: "official_api",
        name: "MLB Stats API standings",
        url: "https://statsapi.mlb.com/api/v1/standings"
      },
      updatedAt: new Date().toISOString(),
      divisions
    };
  } catch (error) {
    return unavailable("MLB", "MLB 官方排名暫時無法取得", {
      type: "official_api",
      name: "MLB Stats API standings",
      url: "https://statsapi.mlb.com/api/v1/standings",
      error: error.message
    });
  }
}

function normalizeNpbTeamName(team) {
  return {
    "読売ジャイアンツ": "巨人",
    "阪神タイガース": "阪神",
    "東京ヤクルトスワローズ": "ヤクルト",
    "横浜DeNAベイスターズ": "DeNA",
    "広島東洋カープ": "広島",
    "中日ドラゴンズ": "中日",
    "埼玉西武ライオンズ": "西武",
    "福岡ソフトバンクホークス": "ソフトバンク",
    "オリックス・バファローズ": "オリックス",
    "北海道日本ハムファイターズ": "日本ハム",
    "千葉ロッテマリーンズ": "ロッテ",
    "東北楽天ゴールデンイーグルス": "楽天"
  }[team] || team;
}

const NPB_OFFICIAL_TEAM_NAMES = new Set([
  "読売ジャイアンツ",
  "阪神タイガース",
  "東京ヤクルトスワローズ",
  "横浜DeNAベイスターズ",
  "広島東洋カープ",
  "中日ドラゴンズ",
  "埼玉西武ライオンズ",
  "福岡ソフトバンクホークス",
  "オリックス・バファローズ",
  "北海道日本ハムファイターズ",
  "千葉ロッテマリーンズ",
  "東北楽天ゴールデンイーグルス"
]);

function parseNpbDivision(html, divisionName, url) {
  const lines = htmlToLines(html);
  const updatedLine = lines.find((line) => /^\d{4}年\d{1,2}月\d{1,2}日 現在$/.test(line)) || "";
  const start = lines.findIndex((line, index) => line === "チーム勝敗表" && index > 80);
  if (start < 0) throw new Error(`${divisionName} standings table not found`);

  const rows = [];
  for (let index = start + 1; index < lines.length - 6; index += 1) {
    const teamName = lines[index];
    if (teamName.startsWith("交流戦チーム勝敗表")) break;
    if (!NPB_OFFICIAL_TEAM_NAMES.has(teamName)) continue;
    const [games, wins, losses, ties, pct, gb] = lines.slice(index + 1, index + 7);
    if (!/^\d+$/.test(games) || !/^\d+$/.test(wins) || !/^\d+$/.test(losses) || !/^\d+$/.test(ties) || !/^\.\d+$/.test(pct)) continue;
    const canonicalTeam = normalizeNpbTeamName(teamName);
    rows.push({
      rank: rows.length + 1,
      team: normalizeTeamName(canonicalTeam, "NPB"),
      teamName: canonicalTeam,
      games: Number(games),
      wins: Number(wins),
      losses: Number(losses),
      ties: Number(ties),
      pct,
      gb: gb.replace("--", "-"),
      league: "NPB"
    });
  }

  if (rows.length !== 6) throw new Error(`${divisionName} standings rows incomplete`);
  return {
    key: divisionName,
    name: divisionName,
    sourceUrl: url,
    updatedLine,
    rows
  };
}

async function fetchNpbStandings() {
  try {
    const [centralHtml, pacificHtml] = await Promise.all([
      fetchText(NPB_CENTRAL_STANDINGS_URL, "NPB Central standings"),
      fetchText(NPB_PACIFIC_STANDINGS_URL, "NPB Pacific standings")
    ]);
    const divisions = [
      parseNpbDivision(centralHtml, "中央聯盟", NPB_CENTRAL_STANDINGS_URL),
      parseNpbDivision(pacificHtml, "太平洋聯盟", NPB_PACIFIC_STANDINGS_URL)
    ];

    return {
      league: "NPB",
      status: "ok",
      source: {
        type: "official_html",
        name: "NPB.jp 官方戰績",
        url: NPB_CENTRAL_STANDINGS_URL
      },
      updatedAt: new Date().toISOString(),
      sourceUpdatedLabel: divisions.find((division) => division.updatedLine)?.updatedLine || "",
      divisions
    };
  } catch (error) {
    return unavailable("NPB", "NPB 官方排名暫時無法取得", {
      type: "official_html",
      name: "NPB.jp 官方戰績",
      url: NPB_CENTRAL_STANDINGS_URL,
      error: error.message
    });
  }
}

export async function getBaseballStandings(league) {
  const normalizedLeague = String(league || "").trim().toUpperCase();
  if (!SUPPORTED_BASEBALL_LEAGUES.has(normalizedLeague)) {
    return unavailable(normalizedLeague, "目前尚未支援排名");
  }

  if (normalizedLeague === "CPBL") return fetchCpblStandings();
  if (normalizedLeague === "MLB") return fetchMlbStandings();
  if (normalizedLeague === "NPB") return fetchNpbStandings();
  return unavailable(normalizedLeague, "目前尚未支援排名");
}
