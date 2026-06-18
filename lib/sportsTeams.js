const TEAM_DATA = {
  CPBL: {
    "統一7-ELEVEn獅": { shortName: "統一", fallbackLabel: "統一", aliases: ["統一獅", "統一"] },
    "樂天桃猿": { shortName: "樂天", fallbackLabel: "樂天", aliases: ["桃猿", "Rakuten Monkeys"] },
    "富邦悍將": { shortName: "富邦", fallbackLabel: "富邦", aliases: ["悍將"] },
    "味全龍": { shortName: "味全", fallbackLabel: "味全", aliases: ["龍"] },
    "台鋼雄鷹": { shortName: "雄鷹", fallbackLabel: "台鋼", aliases: ["台鋼", "TSG Hawks"] },
    "中信兄弟": { shortName: "兄弟", fallbackLabel: "中信", aliases: ["中信", "Brothers"] }
  },
  MLB: {
    "Arizona Diamondbacks": { shortName: "D-backs", fallbackLabel: "ARI", aliases: ["Arizona", "ARI"] },
    Athletics: { shortName: "Athletics", fallbackLabel: "ATH", aliases: ["Oakland Athletics", "ATH"] },
    "Atlanta Braves": { shortName: "Braves", fallbackLabel: "ATL", aliases: ["Atlanta", "ATL"] },
    "Baltimore Orioles": { shortName: "Orioles", fallbackLabel: "BAL", aliases: ["Baltimore", "BAL"] },
    "Boston Red Sox": { shortName: "Red Sox", fallbackLabel: "BOS", aliases: ["Boston", "BOS"] },
    "Chicago Cubs": { shortName: "Cubs", fallbackLabel: "CHC", aliases: ["Cubs", "CHC"] },
    "Chicago White Sox": { shortName: "White Sox", fallbackLabel: "CWS", aliases: ["White Sox", "CWS"] },
    "Cincinnati Reds": { shortName: "Reds", fallbackLabel: "CIN", aliases: ["Cincinnati", "CIN"] },
    "Cleveland Guardians": { shortName: "Guardians", fallbackLabel: "CLE", aliases: ["Cleveland", "CLE"] },
    "Colorado Rockies": { shortName: "Rockies", fallbackLabel: "COL", aliases: ["Colorado", "COL"] },
    "Detroit Tigers": { shortName: "Tigers", fallbackLabel: "DET", aliases: ["Detroit", "DET"] },
    "Houston Astros": { shortName: "Astros", fallbackLabel: "HOU", aliases: ["Houston", "HOU"] },
    "Kansas City Royals": { shortName: "Royals", fallbackLabel: "KC", aliases: ["Kansas City", "KC", "KCR"] },
    "Los Angeles Angels": { shortName: "Angels", fallbackLabel: "LAA", aliases: ["LA Angels", "Angels", "LAA"] },
    "Los Angeles Dodgers": { shortName: "Dodgers", fallbackLabel: "LAD", aliases: ["LA Dodgers", "Dodgers", "LAD"] },
    "Miami Marlins": { shortName: "Marlins", fallbackLabel: "MIA", aliases: ["Miami", "MIA"] },
    "Milwaukee Brewers": { shortName: "Brewers", fallbackLabel: "MIL", aliases: ["Milwaukee", "MIL"] },
    "Minnesota Twins": { shortName: "Twins", fallbackLabel: "MIN", aliases: ["Minnesota", "MIN"] },
    "New York Mets": { shortName: "Mets", fallbackLabel: "NYM", aliases: ["Mets", "NYM"] },
    "New York Yankees": { shortName: "Yankees", fallbackLabel: "NYY", aliases: ["Yankees", "NYY"] },
    "Philadelphia Phillies": { shortName: "Phillies", fallbackLabel: "PHI", aliases: ["Philadelphia", "PHI"] },
    "Pittsburgh Pirates": { shortName: "Pirates", fallbackLabel: "PIT", aliases: ["Pittsburgh", "PIT"] },
    "San Diego Padres": { shortName: "Padres", fallbackLabel: "SD", aliases: ["San Diego", "SD", "SDP"] },
    "San Francisco Giants": { shortName: "Giants", fallbackLabel: "SF", aliases: ["San Francisco", "SF", "SFG"] },
    "Seattle Mariners": { shortName: "Mariners", fallbackLabel: "SEA", aliases: ["Seattle", "SEA"] },
    "St. Louis Cardinals": { shortName: "Cardinals", fallbackLabel: "STL", aliases: ["St Louis Cardinals", "STL"] },
    "Tampa Bay Rays": { shortName: "Rays", fallbackLabel: "TB", aliases: ["Tampa Bay", "TB", "TBR"] },
    "Texas Rangers": { shortName: "Rangers", fallbackLabel: "TEX", aliases: ["Texas", "TEX"] },
    "Toronto Blue Jays": { shortName: "Blue Jays", fallbackLabel: "TOR", aliases: ["Toronto", "TOR"] },
    "Washington Nationals": { shortName: "Nationals", fallbackLabel: "WSH", aliases: ["Washington", "WSH"] }
  },
  NPB: {
    巨人: { shortName: "巨人", fallbackLabel: "巨人", aliases: ["読売", "読売ジャイアンツ", "Yomiuri Giants"] },
    阪神: { shortName: "阪神虎", fallbackLabel: "阪神", aliases: ["阪神タイガース", "Tigers"] },
    DeNA: { shortName: "DeNA", fallbackLabel: "DB", aliases: ["横浜DeNA", "横浜DeNAベイスターズ"] },
    広島: { shortName: "廣島", fallbackLabel: "廣島", aliases: ["広島東洋カープ", "カープ"] },
    ヤクルト: { shortName: "養樂多", fallbackLabel: "燕子", aliases: ["東京ヤクルト", "東京ヤクルトスワローズ"] },
    中日: { shortName: "中日", fallbackLabel: "中日", aliases: ["中日ドラゴンズ"] },
    オリックス: { shortName: "歐力士", fallbackLabel: "歐力士", aliases: ["オリックス・バファローズ"] },
    ソフトバンク: { shortName: "軟銀鷹", fallbackLabel: "軟銀", aliases: ["福岡ソフトバンク", "福岡ソフトバンクホークス"] },
    日本ハム: { shortName: "火腿", fallbackLabel: "火腿", aliases: ["北海道日本ハム", "北海道日本ハムファイターズ"] },
    ロッテ: { shortName: "羅德", fallbackLabel: "羅德", aliases: ["千葉ロッテ", "千葉ロッテマリーンズ"] },
    楽天: { shortName: "樂天鷲", fallbackLabel: "樂天", aliases: ["東北楽天", "東北楽天ゴールデンイーグルス"] },
    西武: { shortName: "西武", fallbackLabel: "西武", aliases: ["埼玉西武", "埼玉西武ライオンズ"] }
  }
};

function clean(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function findTeamEntry(teamName, league) {
  const leagueKey = clean(league).toUpperCase();
  const teams = TEAM_DATA[leagueKey] || {};
  const requested = normalizeKey(teamName);
  if (!requested) return null;

  for (const [canonicalName, data] of Object.entries(teams)) {
    const names = [canonicalName, data.shortName, data.fallbackLabel, ...(data.aliases || [])];
    if (names.some((name) => normalizeKey(name) === requested)) {
      return { canonicalName, data, league: leagueKey };
    }
  }

  return null;
}

export function normalizeTeamName(teamName, league) {
  const entry = findTeamEntry(teamName, league);
  return entry?.canonicalName || clean(teamName);
}

export function getTeamShortName(teamName, league) {
  const entry = findTeamEntry(teamName, league);
  return entry?.data.shortName || clean(teamName);
}

export function getTeamLogo(teamName, league) {
  const entry = findTeamEntry(teamName, league);
  return entry?.data.logo || null;
}

export function getTeamFallbackLabel(teamName, league) {
  const entry = findTeamEntry(teamName, league);
  if (entry?.data.fallbackLabel) return entry.data.fallbackLabel;
  const text = clean(teamName);
  if (!text) return "-";
  const ascii = text.match(/\b[A-Z]{2,4}\b/g);
  if (ascii?.length) return ascii[ascii.length - 1].slice(0, 4);
  return text.slice(0, 3);
}

export function getKnownTeams(league) {
  return Object.keys(TEAM_DATA[clean(league).toUpperCase()] || {});
}
