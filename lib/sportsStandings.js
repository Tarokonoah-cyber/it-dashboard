import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { getKnownTeams, normalizeTeamName } from "./sportsTeams.js";

const SUPPORTED_BASEBALL_LEAGUES = new Set(["CPBL", "MLB", "NPB"]);
const LOCAL_STANDINGS_MONTH = "2026-06";

const NPB_DIVISIONS = {
  "中央聯盟": ["巨人", "阪神", "DeNA", "広島", "ヤクルト", "中日"],
  "太平洋聯盟": ["オリックス", "ソフトバンク", "日本ハム", "ロッテ", "楽天", "西武"]
};

const MLB_DIVISIONS = {
  "美聯東區": ["Baltimore Orioles", "Boston Red Sox", "New York Yankees", "Tampa Bay Rays", "Toronto Blue Jays"],
  "美聯中區": ["Chicago White Sox", "Cleveland Guardians", "Detroit Tigers", "Kansas City Royals", "Minnesota Twins"],
  "美聯西區": ["Athletics", "Houston Astros", "Los Angeles Angels", "Seattle Mariners", "Texas Rangers"],
  "國聯東區": ["Atlanta Braves", "Miami Marlins", "New York Mets", "Philadelphia Phillies", "Washington Nationals"],
  "國聯中區": ["Chicago Cubs", "Cincinnati Reds", "Milwaukee Brewers", "Pittsburgh Pirates", "St. Louis Cardinals"],
  "國聯西區": ["Arizona Diamondbacks", "Colorado Rockies", "Los Angeles Dodgers", "San Diego Padres", "San Francisco Giants"]
};

function emptyRecord(team) {
  return {
    team,
    games: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    homeWins: 0,
    homeLosses: 0,
    awayWins: 0,
    awayLosses: 0,
    recentResults: []
  };
}

function ensureRecord(records, team, league) {
  const normalized = normalizeTeamName(team, league);
  if (!normalized) return null;
  if (!records.has(normalized)) records.set(normalized, emptyRecord(normalized));
  return records.get(normalized);
}

function finalScore(event) {
  return event?.details?.details?.final_score || event?.detail?.details?.final_score || null;
}

function addResult(record, result, isHome) {
  record.games += 1;
  record.recentResults.push(result);
  if (result === "W") {
    record.wins += 1;
    if (isHome) record.homeWins += 1;
    else record.awayWins += 1;
  } else if (result === "L") {
    record.losses += 1;
    if (isHome) record.homeLosses += 1;
    else record.awayLosses += 1;
  } else {
    record.ties += 1;
  }
}

async function readLocalEvents(league) {
  const leaguePath = path.join(process.cwd(), "sports-data", "parsed", "baseball", league.toLowerCase());
  const files = await readdir(leaguePath).catch(() => []);
  const jsonFiles = files.filter((file) => file.endsWith(".json")).sort();
  const events = [];

  for (const file of jsonFiles) {
    const payload = JSON.parse(await readFile(path.join(leaguePath, file), "utf8"));
    events.push(...(payload.events || []));
  }

  return events;
}

function winningPct(record) {
  const decisions = record.wins + record.losses;
  if (!decisions) return ".000";
  return (record.wins / decisions).toFixed(3).replace(/^0/, "");
}

function gamesBack(record, leader) {
  if (!leader || record === leader) return "-";
  const value = ((leader.wins - record.wins) + (record.losses - leader.losses)) / 2;
  if (value <= 0) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function sortRecords(records) {
  return [...records].sort((a, b) => {
    const pctDiff = Number(winningPct(b)) - Number(winningPct(a));
    if (pctDiff) return pctDiff;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });
}

function recent(record, count = 5) {
  const values = record.recentResults.slice(-count).reverse();
  return values.length ? values.join("") : "-";
}

function l10(record) {
  const values = record.recentResults.slice(-10);
  const wins = values.filter((value) => value === "W").length;
  const losses = values.filter((value) => value === "L").length;
  return values.length ? `${wins}-${losses}` : "-";
}

function buildRows(records, league) {
  const sorted = sortRecords(records);
  const leader = sorted[0] || null;
  return sorted.map((record, index) => ({
    rank: index + 1,
    team: record.team,
    teamName: record.team,
    games: record.games,
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    pct: winningPct(record),
    gb: gamesBack(record, leader),
    recent: recent(record),
    home: `${record.homeWins}-${record.homeLosses}`,
    away: `${record.awayWins}-${record.awayLosses}`,
    l10: l10(record),
    league
  }));
}

function recordsForDivision(recordMap, league, teams) {
  teams.forEach((team) => ensureRecord(recordMap, team, league));
  return teams.map((team) => recordMap.get(normalizeTeamName(team, league))).filter(Boolean);
}

function fallbackDivisions(league, recordMap) {
  if (league === "NPB") {
    return Object.entries(NPB_DIVISIONS).map(([name, teams]) => ({
      key: name,
      name,
      rows: buildRows(recordsForDivision(recordMap, league, teams), league)
    }));
  }

  if (league === "MLB") {
    return Object.entries(MLB_DIVISIONS).map(([name, teams]) => ({
      key: name,
      name,
      rows: buildRows(recordsForDivision(recordMap, league, teams), league)
    }));
  }

  return [{
    key: "regular-season",
    name: "例行賽",
    rows: buildRows(recordsForDivision(recordMap, league, getKnownTeams(league)), league)
  }];
}

async function buildLocalStandings(league) {
  const events = await readLocalEvents(league);
  const records = new Map();

  for (const event of events.sort((a, b) => new Date(a.start_time || 0) - new Date(b.start_time || 0))) {
    const score = finalScore(event);
    if (!score || score.away === null || score.away === undefined || score.home === null || score.home === undefined) continue;
    const away = ensureRecord(records, event.away_team, league);
    const home = ensureRecord(records, event.home_team, league);
    if (!away || !home) continue;

    if (Number(score.away) > Number(score.home)) {
      addResult(away, "W", false);
      addResult(home, "L", true);
    } else if (Number(score.away) < Number(score.home)) {
      addResult(away, "L", false);
      addResult(home, "W", true);
    } else {
      addResult(away, "T", false);
      addResult(home, "T", true);
    }
  }

  return {
    league,
    status: "fallback",
    source: {
      type: "local_results",
      name: `${league} local schedule/results JSON`,
      note: `以 sports-data/parsed/baseball/${league.toLowerCase()} 的已完成賽事推算，非完整官方排名。`
    },
    updatedAt: new Date().toISOString(),
    divisions: fallbackDivisions(league, records)
  };
}

function splitRecord(record, type) {
  const match = record.records?.splitRecords?.find((item) => item.type === type);
  return match ? `${match.wins}-${match.losses}` : "-";
}

function normalizeMlbDivisionName(name) {
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch("https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason&hydrate=team", {
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`MLB standings HTTP ${response.status}`);
    const payload = await response.json();
    const divisions = (payload.records || []).map((record) => ({
      key: normalizeMlbDivisionName(record.division?.name),
      name: normalizeMlbDivisionName(record.division?.name),
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
    }));

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
  } finally {
    clearTimeout(timeout);
  }
}

export async function getBaseballStandings(league) {
  const normalizedLeague = String(league || "").trim().toUpperCase();
  if (!SUPPORTED_BASEBALL_LEAGUES.has(normalizedLeague)) {
    return {
      league: normalizedLeague,
      status: "unsupported",
      message: "目前尚未支援排名",
      divisions: []
    };
  }

  if (normalizedLeague === "MLB") {
    try {
      return await fetchMlbStandings();
    } catch (error) {
      const fallback = await buildLocalStandings(normalizedLeague);
      return {
        ...fallback,
        message: `MLB 官方排名暫時無法讀取，已顯示 ${LOCAL_STANDINGS_MONTH} 本地結果推算。`
      };
    }
  }

  return buildLocalStandings(normalizedLeague);
}
