export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_TOTAL_LIMIT = 30;
export const SEARCH_CATEGORY_LIMIT = 5;

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("zh-TW");
}

export function searchScore(result, query) {
  const keyword = normalizeSearchText(query);
  const title = normalizeSearchText(result?.title);
  const subtitle = normalizeSearchText(result?.subtitle);
  const searchText = normalizeSearchText(result?.searchText || `${title} ${subtitle}`);
  if (!keyword || !searchText.includes(keyword)) return 0;
  if (title === keyword) return 100;
  if (title.startsWith(keyword)) return 80;
  if (title.includes(keyword)) return 60;
  if (subtitle.startsWith(keyword)) return 45;
  return 30;
}

export function rankSearchResults(results, query, totalLimit = SEARCH_TOTAL_LIMIT, categoryLimit = SEARCH_CATEGORY_LIMIT) {
  const perCategory = new Map();
  return (Array.isArray(results) ? results : [])
    .map((result) => ({ ...result, score: searchScore(result, query) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || String(left.title || "").localeCompare(String(right.title || ""), "zh-Hant"))
    .filter((result) => {
      const count = perCategory.get(result.category) || 0;
      if (count >= categoryLimit) return false;
      perCategory.set(result.category, count + 1);
      return true;
    })
    .slice(0, totalLimit)
    .map(({ searchText, ...result }) => result);
}

export function safePasswordSearchResult(row) {
  const systemName = String(row?.system_name || "").trim();
  const itemName = String(row?.bitwarden_item_name || row?.password_item || "").trim();
  const category = String(row?.category || "").trim();
  return {
    id: String(row?.id || `${category}-${systemName}-${itemName}`),
    source: "passwords",
    category: "密碼項目",
    title: systemName || itemName || "未命名密碼項目",
    subtitle: [category, itemName && itemName !== systemName ? itemName : ""].filter(Boolean).join(" · "),
    href: "/passwords",
    searchText: [category, systemName, itemName].filter(Boolean).join(" ")
  };
}
