const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PCS_ORIGIN = "https://www.procyclingstats.com";
const REQUEST_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 12000;

const KNOWN_RACES = {
  "tour-de-suisse:2026": {
    raceName: "Tour de Suisse",
    displayName: "Tour de Suisse",
    slug: "tour-de-suisse",
    url: `${PCS_ORIGIN}/race/tour-de-suisse/2026`,
    sourceMonth: "2026-06",
    limitations: [
      "ProCyclingStats CLI fetch may be blocked by browser challenge.",
      "Fallback seed includes only confirmed race dates and stage count; route fields remain null until PCS HTML is available."
    ],
    stages: [
      { stage_number: 1, date: "2026-06-17" },
      { stage_number: 2, date: "2026-06-18" },
      { stage_number: 3, date: "2026-06-19" },
      { stage_number: 4, date: "2026-06-20" },
      { stage_number: 5, date: "2026-06-21" }
    ]
  },
  "tour-de-france:2026": {
    raceName: "Tour de France",
    displayName: "Tour de France",
    slug: "tour-de-france",
    url: `${PCS_ORIGIN}/race/tour-de-france/2026`,
    sourceMonth: "2026-07",
    existingPath: path.join(ROOT, "sports-data", "parsed", "cycling", "tour-de-france", "2026-07.json")
  }
};

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    const match = item.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2] === undefined ? true : match[2].replace(/^["']|["']$/g, "");
    args[key] = value;
  }
  return args;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function raceKey(race, year) {
  return `${slugify(race)}:${year}`;
}

function requirePcsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid ProCyclingStats URL: ${url}`);
  }
  if (parsed.origin !== PCS_ORIGIN || !parsed.pathname.startsWith("/race/")) {
    throw new Error("Only specific ProCyclingStats race URLs are supported.");
  }
  return parsed.toString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  await sleep(REQUEST_DELAY_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SportsCalendarCyclingImporter/1.0",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    const text = await response.text();
    if (response.status === 403 || /cloudflare|Just a moment|Enable JavaScript and cookies/i.test(text)) {
      throw new Error("ProCyclingStats returned a browser challenge/403; provide saved HTML or retry manually later.");
    }
    if (!response.ok) throw new Error(`ProCyclingStats HTTP ${response.status}`);
    return text;
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
    .replace(/&quot;/g, "\"")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(html) {
  return decodeHtml(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractStageLinks(html, raceUrl) {
  const racePath = new URL(raceUrl).pathname.replace(/\/+$/, "");
  const links = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const href = decodeHtml(match[1]);
    const text = stripTags(match[2]);
    const absolute = resolveUrl(href, raceUrl);
    if (!absolute) continue;
    const pathname = new URL(absolute).pathname.replace(/\/+$/, "");
    if (!pathname.startsWith(`${racePath}/stage-`) && !pathname.startsWith(`${racePath}/prologue`)) continue;
    links.push({ url: absolute, text });
  }
  return unique(links.map((item) => item.url)).map((url) => links.find((item) => item.url === url));
}

function extractTitle(html) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return title ? stripTags(title[1]).replace(/\s*\|.*$/, "") : "";
}

function parseDate(text, year) {
  const normalized = stripTags(text);
  const iso = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const date = normalized.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
  if (!date) return null;
  const month = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12"
  }[date[2].toLowerCase()];
  return `${year}-${month}-${String(Number(date[1])).padStart(2, "0")}`;
}

function parseDistance(text) {
  const match = stripTags(text).match(/\b(\d+(?:\.\d+)?)\s*km\b/i);
  return match ? `${match[1]} km` : null;
}

function parseStageNumber(url, title, fallbackIndex) {
  const fromUrl = new URL(url).pathname.match(/stage-(\d+)/i);
  if (fromUrl) return Number(fromUrl[1]);
  const fromTitle = title.match(/stage\s+(\d+)/i);
  if (fromTitle) return Number(fromTitle[1]);
  return fallbackIndex;
}

function parseRoute(text) {
  const cleaned = stripTags(text)
    .replace(/\s+-\s+Profiles?.*$/i, "")
    .replace(/\s+\|.*$/i, "");
  const route = cleaned.match(/(?:Stage\s+\d+\s*:?\s*)?(.+?)\s+(?:-|–|—|>)\s+(.+?)(?:\s+\d+(?:\.\d+)?\s*km|\s*$)/i);
  if (!route) return { start_location: null, finish_location: null, stage_name: null };
  return {
    start_location: route[1].trim() || null,
    finish_location: route[2].trim() || null,
    stage_name: `${route[1].trim()} → ${route[2].trim()}`
  };
}

function parseStageType(text) {
  const lowered = stripTags(text).toLowerCase();
  if (lowered.includes("team time trial")) return "team time trial";
  if (lowered.includes("individual time trial") || lowered.includes("time trial")) return "individual time trial";
  if (lowered.includes("mountain")) return "mountain";
  if (lowered.includes("hilly")) return "hilly";
  if (lowered.includes("flat")) return "flat";
  return null;
}

async function parsePcsRace({ raceName, year, url }) {
  const raceHtml = await fetchText(url);
  const links = extractStageLinks(raceHtml, url);
  if (!links.length) throw new Error("No stage links found on ProCyclingStats race page.");

  const stages = [];
  for (const [index, link] of links.entries()) {
    const html = await fetchText(link.url);
    const title = extractTitle(html) || link.text;
    const pageText = stripTags(html);
    const route = parseRoute(`${title} ${pageText.slice(0, 2000)}`);
    const stageNumber = parseStageNumber(link.url, title, index + 1);
    stages.push({
      race_name: raceName,
      stage_number: stageNumber,
      stage_name: route.stage_name,
      stage_type: parseStageType(pageText),
      date: parseDate(pageText, year),
      start_location: route.start_location,
      finish_location: route.finish_location,
      distance: parseDistance(pageText),
      route_url: link.url,
      source_url: link.url,
      limitations: []
    });
  }
  return stages.sort((a, b) => a.stage_number - b.stage_number);
}

function defaultSourceMonth(stages, year) {
  const firstDate = stages.find((stage) => stage.date)?.date;
  return firstDate ? firstDate.slice(0, 7) : `${year}-01`;
}

function buildEvents({ raceName, displayName, slug, year, sourceUrl, sourceMonth, stages, limitations }) {
  return stages.map((stage) => {
    const stageNumber = String(stage.stage_number).padStart(2, "0");
    const route = [stage.start_location, stage.finish_location].filter(Boolean).join(" → ");
    const title = `${displayName} Stage ${stage.stage_number}${route ? `: ${route}` : ""}`;
    const stageLimitations = [...(limitations || []), ...(stage.limitations || [])].filter(Boolean);
    if (!stage.date) stageLimitations.push("Stage date was not available from the source.");
    if (!stage.start_location) stageLimitations.push("Start location was not available from the source.");
    if (!stage.finish_location) stageLimitations.push("Finish location was not available from the source.");
    if (!stage.distance) stageLimitations.push("Distance was not available from the source.");

    return {
      event_key: `${slug}-${year}-stage-${stageNumber}`,
      title,
      sport_type: "cycling",
      league: "Cycling",
      start_time: stage.date,
      venue: route || null,
      status: "scheduled",
      source_name: "ProCyclingStats",
      source_url: stage.source_url || sourceUrl,
      source_month: sourceMonth,
      details: {
        sport_type: "cycling",
        detail_status: "pre_game_synced",
        sync_phase: "manual",
        source_url: stage.source_url || sourceUrl,
        source_name: "ProCyclingStats",
        details: {
          race_name: raceName,
          stage_number: stage.stage_number ?? null,
          stage_name: stage.stage_name ?? null,
          stage_type: stage.stage_type ?? null,
          date: stage.date ?? null,
          start_location: stage.start_location ?? null,
          finish_location: stage.finish_location ?? null,
          distance: stage.distance ?? null,
          route_url: stage.route_url ?? null,
          source_url: stage.source_url || sourceUrl,
          limitations: stageLimitations
        }
      }
    };
  });
}

function buildPayload({ raceName, displayName, slug, year, sourceUrl, sourceMonth, stages, limitations }) {
  return {
    metadata: {
      sport_type: "cycling",
      league: "Cycling",
      source_type: "procyclingstats_race_url",
      source_name: "ProCyclingStats",
      source_url: sourceUrl,
      source_month: sourceMonth,
      limitations: (limitations || []).join(" ")
    },
    events: buildEvents({ raceName, displayName, slug, year, sourceUrl, sourceMonth, stages, limitations })
  };
}

function writeJson(outPath, payload) {
  const absolute = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`);
  return absolute;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const year = Number(args.year || new Date().getFullYear());
  const known = KNOWN_RACES[raceKey(args.race || "", year)];
  const sourceUrl = requirePcsUrl(args.url || known?.url || "");
  const raceName = args.race || known?.raceName || extractRaceNameFromUrl(sourceUrl);
  const displayName = known?.displayName || raceName;
  const slug = known?.slug || slugify(raceName);
  const limitations = [];
  let stages = [];
  let fallbackPayload = null;

  try {
    stages = await parsePcsRace({ raceName, year, url: sourceUrl });
  } catch (error) {
    if (known?.existingPath && fs.existsSync(known.existingPath)) {
      fallbackPayload = JSON.parse(fs.readFileSync(known.existingPath, "utf8"));
      fallbackPayload.metadata = {
        ...(fallbackPayload.metadata || {}),
        limitations: [
          fallbackPayload.metadata?.limitations,
          error.message,
          "Existing local cycling JSON was used because the PCS page was unavailable to the CLI."
        ].filter(Boolean).join(" ")
      };
    } else if (!known?.stages?.length) {
      throw error;
    }
    limitations.push(error.message);
    limitations.push(...(known.limitations || []));
    if (!fallbackPayload) {
      stages = known.stages.map((stage) => ({
        race_name: raceName,
        stage_number: stage.stage_number,
        stage_name: null,
        stage_type: null,
        date: stage.date,
        start_location: null,
        finish_location: null,
        distance: null,
        route_url: sourceUrl,
        source_url: sourceUrl,
        limitations: ["PCS stage page was unavailable during import; route fields are intentionally null."]
      }));
    }
  }

  if (fallbackPayload) {
    const events = fallbackPayload.events || [];
    if (args["dry-run"]) {
      console.log(JSON.stringify({
        race: raceName,
        year,
        source_url: sourceUrl,
        events: events.length,
        source_month: fallbackPayload.metadata?.source_month || known?.sourceMonth,
        fallback: "existing_local_json",
        limitations
      }, null, 2));
      return;
    }
    if (!args.out) throw new Error("--out is required unless --dry-run is used.");
    const written = writeJson(args.out, fallbackPayload);
    console.log(`${path.relative(ROOT, written).replace(/\\/g, "/")}: wrote ${events.length} cycling stages (${raceName}, existing local JSON fallback)`);
    return;
  }

  if (!stages.length) throw new Error("No stages parsed.");
  const missingDates = stages.filter((stage) => !stage.date);
  if (missingDates.length) {
    throw new Error(`Parsed ${stages.length} stages, but ${missingDates.length} stages are missing dates; cannot build calendar import JSON.`);
  }

  const sourceMonth = args["source-month"] || known?.sourceMonth || defaultSourceMonth(stages, year);
  const payload = buildPayload({
    raceName,
    displayName,
    slug,
    year,
    sourceUrl,
    sourceMonth,
    stages,
    limitations
  });

  if (args["dry-run"]) {
    console.log(JSON.stringify({
      race: raceName,
      year,
      source_url: sourceUrl,
      events: payload.events.length,
      source_month: sourceMonth,
      limitations
    }, null, 2));
    return;
  }

  if (!args.out) throw new Error("--out is required unless --dry-run is used.");
  const written = writeJson(args.out, payload);
  console.log(`${path.relative(ROOT, written).replace(/\\/g, "/")}: wrote ${payload.events.length} cycling stages (${raceName})`);
}

function extractRaceNameFromUrl(url) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const raceSlug = parts[1] || "cycling-race";
  return raceSlug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
