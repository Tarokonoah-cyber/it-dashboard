const MLB_LOGO = (id) => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const CPBL_LOGO = (file) => `https://www.cpbl.com.tw/files/atts/${file}`;
const NPB_LOGO = (code) => `https://npb.jp/bis/teams/logo_${code}.svg`;

const TEAM_DATA = {
  CPBL: {
    "\u4e2d\u4fe1\u5144\u5f1f": { teamId: "ACN011", shortName: "\u4e2d\u4fe1", abbreviation: "CTBC", fallbackLabel: "\u4e2d\u4fe1", primaryColor: "#f2c300", logo: CPBL_LOGO("0L021497108709222204/logo_brothers.png"), aliases: ["Brothers", "CTBC Brothers", "\u4e2d\u4fe1\u5144\u5f1f"] },
    "\u7d71\u4e007-ELEVEn\u7345": { teamId: "ADD011", shortName: "\u7d71\u4e00", abbreviation: "UNI", fallbackLabel: "\u7d71\u4e00", primaryColor: "#f47b20", logo: CPBL_LOGO("0L021496162893869773/logo_lions.png"), aliases: ["Uni-President Lions", "Uni-Lions", "\u7d71\u4e00\u7345", "\u7d71\u4e00"] },
    "\u6a02\u5929\u6843\u733f": { teamId: "AJL011", shortName: "\u6a02\u5929", abbreviation: "RKM", fallbackLabel: "\u6a02\u5929", primaryColor: "#7a0019", logo: CPBL_LOGO("0L015574823122453305/2024_CPBL%E6%A8%82%E5%A4%A9Logo_R2_%E6%AD%A3%E5%BC%8F.png"), aliases: ["Rakuten Monkeys", "Rakuten", "\u6843\u733f"] },
    "\u5bcc\u90a6\u608d\u5c07": { teamId: "AEO011", shortName: "\u5bcc\u90a6", abbreviation: "FBG", fallbackLabel: "\u5bcc\u90a6", primaryColor: "#005bac", logo: CPBL_LOGO("0L021495969510091777/logo_fubon.png"), aliases: ["Fubon Guardians", "Fubon", "\u608d\u5c07"] },
    "\u5473\u5168\u9f8d": { teamId: "AAA011", shortName: "\u5473\u5168", abbreviation: "WDR", fallbackLabel: "\u5473\u5168", primaryColor: "#c8102e", logo: CPBL_LOGO("0L021497845061333235/logo_dragon.png"), aliases: ["Wei Chuan Dragons", "Dragons"] },
    "\u53f0\u92fc\u96c4\u9df9": { teamId: "AKP011", shortName: "\u96c4\u9df9", abbreviation: "TSG", fallbackLabel: "\u96c4\u9df9", primaryColor: "#0c4f38", logo: CPBL_LOGO("0M259522048557486065/%E5%8F%B0%E9%8B%BCT-100x100.png"), aliases: ["TSG Hawks", "Hawks", "\u53f0\u92fc"] }
  },
  MLB: {
    "Arizona Diamondbacks": { teamId: 109, shortName: "D-backs", abbreviation: "ARI", fallbackLabel: "ARI", primaryColor: "#a71930", logo: MLB_LOGO(109), aliases: ["Arizona", "ARI"] },
    "Athletics": { teamId: 133, shortName: "Athletics", abbreviation: "ATH", fallbackLabel: "ATH", primaryColor: "#003831", logo: MLB_LOGO(133), aliases: ["Oakland Athletics", "A's", "ATH"] },
    "Atlanta Braves": { teamId: 144, shortName: "Braves", abbreviation: "ATL", fallbackLabel: "ATL", primaryColor: "#13274f", logo: MLB_LOGO(144), aliases: ["Atlanta", "ATL"] },
    "Baltimore Orioles": { teamId: 110, shortName: "Orioles", abbreviation: "BAL", fallbackLabel: "BAL", primaryColor: "#df4601", logo: MLB_LOGO(110), aliases: ["Baltimore", "BAL"] },
    "Boston Red Sox": { teamId: 111, shortName: "Red Sox", abbreviation: "BOS", fallbackLabel: "BOS", primaryColor: "#bd3039", logo: MLB_LOGO(111), aliases: ["Boston", "BOS"] },
    "Chicago Cubs": { teamId: 112, shortName: "Cubs", abbreviation: "CHC", fallbackLabel: "CHC", primaryColor: "#0e3386", logo: MLB_LOGO(112), aliases: ["Cubs", "CHC"] },
    "Chicago White Sox": { teamId: 145, shortName: "White Sox", abbreviation: "CWS", fallbackLabel: "CWS", primaryColor: "#27251f", logo: MLB_LOGO(145), aliases: ["White Sox", "CWS"] },
    "Cincinnati Reds": { teamId: 113, shortName: "Reds", abbreviation: "CIN", fallbackLabel: "CIN", primaryColor: "#c6011f", logo: MLB_LOGO(113), aliases: ["Cincinnati", "CIN"] },
    "Cleveland Guardians": { teamId: 114, shortName: "Guardians", abbreviation: "CLE", fallbackLabel: "CLE", primaryColor: "#e50022", logo: MLB_LOGO(114), aliases: ["Cleveland", "CLE"] },
    "Colorado Rockies": { teamId: 115, shortName: "Rockies", abbreviation: "COL", fallbackLabel: "COL", primaryColor: "#33006f", logo: MLB_LOGO(115), aliases: ["Colorado", "COL"] },
    "Detroit Tigers": { teamId: 116, shortName: "Tigers", abbreviation: "DET", fallbackLabel: "DET", primaryColor: "#0c2340", logo: MLB_LOGO(116), aliases: ["Detroit", "DET"] },
    "Houston Astros": { teamId: 117, shortName: "Astros", abbreviation: "HOU", fallbackLabel: "HOU", primaryColor: "#eb6e1f", logo: MLB_LOGO(117), aliases: ["Houston", "HOU"] },
    "Kansas City Royals": { teamId: 118, shortName: "Royals", abbreviation: "KC", fallbackLabel: "KC", primaryColor: "#004687", logo: MLB_LOGO(118), aliases: ["Kansas City", "KC", "KCR"] },
    "Los Angeles Angels": { teamId: 108, shortName: "Angels", abbreviation: "LAA", fallbackLabel: "LAA", primaryColor: "#ba0021", logo: MLB_LOGO(108), aliases: ["LA Angels", "Angels", "LAA"] },
    "Los Angeles Dodgers": { teamId: 119, shortName: "Dodgers", abbreviation: "LAD", fallbackLabel: "LAD", primaryColor: "#005a9c", logo: MLB_LOGO(119), aliases: ["LA Dodgers", "Dodgers", "LAD"] },
    "Miami Marlins": { teamId: 146, shortName: "Marlins", abbreviation: "MIA", fallbackLabel: "MIA", primaryColor: "#00a3e0", logo: MLB_LOGO(146), aliases: ["Miami", "MIA"] },
    "Milwaukee Brewers": { teamId: 158, shortName: "Brewers", abbreviation: "MIL", fallbackLabel: "MIL", primaryColor: "#ffc52f", logo: MLB_LOGO(158), aliases: ["Milwaukee", "MIL"] },
    "Minnesota Twins": { teamId: 142, shortName: "Twins", abbreviation: "MIN", fallbackLabel: "MIN", primaryColor: "#002b5c", logo: MLB_LOGO(142), aliases: ["Minnesota", "MIN"] },
    "New York Mets": { teamId: 121, shortName: "Mets", abbreviation: "NYM", fallbackLabel: "NYM", primaryColor: "#ff5910", logo: MLB_LOGO(121), aliases: ["Mets", "NYM"] },
    "New York Yankees": { teamId: 147, shortName: "Yankees", abbreviation: "NYY", fallbackLabel: "NYY", primaryColor: "#003087", logo: MLB_LOGO(147), aliases: ["Yankees", "NYY"] },
    "Philadelphia Phillies": { teamId: 143, shortName: "Phillies", abbreviation: "PHI", fallbackLabel: "PHI", primaryColor: "#e81828", logo: MLB_LOGO(143), aliases: ["Philadelphia", "PHI"] },
    "Pittsburgh Pirates": { teamId: 134, shortName: "Pirates", abbreviation: "PIT", fallbackLabel: "PIT", primaryColor: "#fdb827", logo: MLB_LOGO(134), aliases: ["Pittsburgh", "PIT"] },
    "San Diego Padres": { teamId: 135, shortName: "Padres", abbreviation: "SD", fallbackLabel: "SD", primaryColor: "#2f241d", logo: MLB_LOGO(135), aliases: ["San Diego", "SD", "SDP"] },
    "San Francisco Giants": { teamId: 137, shortName: "Giants", abbreviation: "SF", fallbackLabel: "SF", primaryColor: "#fd5a1e", logo: MLB_LOGO(137), aliases: ["San Francisco", "SF", "SFG"] },
    "Seattle Mariners": { teamId: 136, shortName: "Mariners", abbreviation: "SEA", fallbackLabel: "SEA", primaryColor: "#005c5c", logo: MLB_LOGO(136), aliases: ["Seattle", "SEA"] },
    "St. Louis Cardinals": { teamId: 138, shortName: "Cardinals", abbreviation: "STL", fallbackLabel: "STL", primaryColor: "#c41e3a", logo: MLB_LOGO(138), aliases: ["St Louis Cardinals", "STL"] },
    "Tampa Bay Rays": { teamId: 139, shortName: "Rays", abbreviation: "TB", fallbackLabel: "TB", primaryColor: "#092c5c", logo: MLB_LOGO(139), aliases: ["Tampa Bay", "TB", "TBR"] },
    "Texas Rangers": { teamId: 140, shortName: "Rangers", abbreviation: "TEX", fallbackLabel: "TEX", primaryColor: "#003278", logo: MLB_LOGO(140), aliases: ["Texas", "TEX"] },
    "Toronto Blue Jays": { teamId: 141, shortName: "Blue Jays", abbreviation: "TOR", fallbackLabel: "TOR", primaryColor: "#134a8e", logo: MLB_LOGO(141), aliases: ["Toronto", "TOR"] },
    "Washington Nationals": { teamId: 120, shortName: "Nationals", abbreviation: "WSH", fallbackLabel: "WSH", primaryColor: "#ab0003", logo: MLB_LOGO(120), aliases: ["Washington", "WSH"] }
  },
  NPB: {
    "\u962a\u795e": { teamId: "t", shortName: "\u962a\u795e\u864e", abbreviation: "T", fallbackLabel: "\u962a\u795e", primaryColor: "#ffe100", logo: NPB_LOGO("t"), aliases: ["Hanshin Tigers", "Tigers", "\u962a\u795e\u30bf\u30a4\u30ac\u30fc\u30b9"] },
    "DeNA": { teamId: "db", shortName: "DeNA", abbreviation: "DB", fallbackLabel: "DB", primaryColor: "#005bac", logo: NPB_LOGO("db"), aliases: ["YOKOHAMA DeNA BAYSTARS", "BayStars", "\u6a2a\u6d5cDeNA\u30d9\u30a4\u30b9\u30bf\u30fc\u30ba"] },
    "\u5de8\u4eba": { teamId: "g", shortName: "\u5de8\u4eba", abbreviation: "G", fallbackLabel: "\u5de8\u4eba", primaryColor: "#f97700", logo: NPB_LOGO("g"), aliases: ["Yomiuri Giants", "Giants", "\u8aad\u58f2\u30b8\u30e3\u30a4\u30a2\u30f3\u30c4"] },
    "\u4e2d\u65e5": { teamId: "d", shortName: "\u4e2d\u65e5", abbreviation: "D", fallbackLabel: "\u4e2d\u65e5", primaryColor: "#003f8e", logo: NPB_LOGO("d"), aliases: ["Chunichi Dragons", "Dragons", "\u4e2d\u65e5\u30c9\u30e9\u30b4\u30f3\u30ba"] },
    "\u5e83\u5cf6": { teamId: "c", shortName: "\u5e83\u5cf6", abbreviation: "C", fallbackLabel: "\u5e83\u5cf6", primaryColor: "#e50012", logo: NPB_LOGO("c"), aliases: ["Hiroshima Toyo Carp", "Carp", "\u5e83\u5cf6\u6771\u6d0b\u30ab\u30fc\u30d7"] },
    "\u30e4\u30af\u30eb\u30c8": { teamId: "s", shortName: "\u30e4\u30af\u30eb\u30c8", abbreviation: "S", fallbackLabel: "YS", primaryColor: "#073180", logo: NPB_LOGO("s"), aliases: ["Tokyo Yakult Swallows", "Swallows", "\u30e4\u30af\u30eb\u30c8\u30b9\u30ef\u30ed\u30fc\u30ba"] },
    "\u30bd\u30d5\u30c8\u30d0\u30f3\u30af": { teamId: "h", shortName: "\u30bd\u30d5\u30c8\u30d0\u30f3\u30af", abbreviation: "H", fallbackLabel: "SB", primaryColor: "#ffcc00", logo: NPB_LOGO("h"), aliases: ["Fukuoka SoftBank Hawks", "Hawks", "\u30bd\u30d5\u30c8\u30d0\u30f3\u30af\u30db\u30fc\u30af\u30b9"] },
    "\u65e5\u672c\u30cf\u30e0": { teamId: "f", shortName: "\u65e5\u672c\u30cf\u30e0", abbreviation: "F", fallbackLabel: "\u65e5\u30cf\u30e0", primaryColor: "#0069b4", logo: NPB_LOGO("f"), aliases: ["Hokkaido Nippon-Ham Fighters", "Fighters", "\u5317\u6d77\u9053\u65e5\u672c\u30cf\u30e0\u30d5\u30a1\u30a4\u30bf\u30fc\u30ba"] },
    "\u30aa\u30ea\u30c3\u30af\u30b9": { teamId: "b", shortName: "\u30aa\u30ea\u30c3\u30af\u30b9", abbreviation: "B", fallbackLabel: "B", primaryColor: "#1d2970", logo: NPB_LOGO("b"), aliases: ["ORIX Buffaloes", "Buffaloes", "\u30aa\u30ea\u30c3\u30af\u30b9\u30fb\u30d0\u30d5\u30a1\u30ed\u30fc\u30ba"] },
    "\u697d\u5929": { teamId: "e", shortName: "\u697d\u5929", abbreviation: "E", fallbackLabel: "\u697d\u5929", primaryColor: "#870010", logo: NPB_LOGO("e"), aliases: ["Tohoku Rakuten Golden Eagles", "Eagles", "\u6771\u5317\u697d\u5929\u30b4\u30fc\u30eb\u30c7\u30f3\u30a4\u30fc\u30b0\u30eb\u30b9"] },
    "\u897f\u6b66": { teamId: "l", shortName: "\u897f\u6b66", abbreviation: "L", fallbackLabel: "\u897f\u6b66", primaryColor: "#00214d", logo: NPB_LOGO("l"), aliases: ["Saitama Seibu Lions", "Lions", "\u57fc\u7389\u897f\u6b66\u30e9\u30a4\u30aa\u30f3\u30ba"] },
    "\u30ed\u30c3\u30c6": { teamId: "m", shortName: "\u30ed\u30c3\u30c6", abbreviation: "M", fallbackLabel: "M", primaryColor: "#000000", logo: NPB_LOGO("m"), aliases: ["Chiba Lotte Marines", "Marines", "\u5343\u8449\u30ed\u30c3\u30c6\u30de\u30ea\u30fc\u30f3\u30ba"] }
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
    const names = [canonicalName, data.teamId, data.shortName, data.abbreviation, data.fallbackLabel, ...(data.aliases || [])];
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
  const ascii = text.match(/\b[A-Z]{1,4}\b/g);
  if (ascii?.length) return ascii[ascii.length - 1].slice(0, 4);
  return text.slice(0, 3);
}

export function getTeamMeta(teamName, league) {
  const entry = findTeamEntry(teamName, league);
  if (!entry) return null;
  return {
    teamId: entry.data.teamId,
    league: entry.league,
    name: entry.canonicalName,
    shortName: entry.data.shortName,
    abbreviation: entry.data.abbreviation,
    logoUrl: entry.data.logo,
    primaryColor: entry.data.primaryColor,
    fallbackLogo: entry.data.fallbackLabel
  };
}

export function getKnownTeams(league) {
  return Object.keys(TEAM_DATA[clean(league).toUpperCase()] || {});
}

export { TEAM_DATA };
