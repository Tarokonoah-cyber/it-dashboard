export const ARTICLE_TYPES = new Set(["troubleshooting", "guide"]);
export const ARTICLE_STATUSES = new Set(["draft", "published", "archived"]);
export const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
export const MAX_KNOWLEDGE_IMAGE_BYTES = 500 * 1024;

function text(value, maxLength = 4000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function intValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

export function validateArticlePayload(body = {}) {
  const title = text(body.title, 180);
  if (!title) throw Object.assign(new Error("Title is required"), { name: "ValidationError" });

  const article_type = text(body.article_type || "troubleshooting", 40);
  const status = text(body.status || "draft", 40);
  if (!ARTICLE_TYPES.has(article_type)) throw Object.assign(new Error("Invalid article type"), { name: "ValidationError" });
  if (!ARTICLE_STATUSES.has(status)) throw Object.assign(new Error("Invalid status"), { name: "ValidationError" });

  const article = {
    title,
    article_type,
    category: text(body.category, 120) || null,
    system_name: text(body.system_name, 120) || null,
    symptom: text(body.symptom, 2000) || null,
    possible_cause: text(body.possible_cause, 2000) || null,
    summary: text(body.summary, 2500) || null,
    keywords: text(body.keywords, 1000) || null,
    status,
    sort_order: intValue(body.sort_order, 0)
  };

  const steps = Array.isArray(body.steps) ? body.steps : [];
  if (article.status === "published" && !steps.length) {
    throw Object.assign(new Error("Published articles need at least one step"), { name: "ValidationError" });
  }

  const normalizedSteps = steps.slice(0, 80).map((step, index) => ({
    id: text(step.id, 80) || null,
    step_order: index + 1,
    title: text(step.title, 180) || null,
    body: text(step.body, 8000) || null
  }));

  normalizedSteps.forEach((step) => {
    if (!step.title && !step.body) {
      throw Object.assign(new Error("Every step needs a title or body"), { name: "ValidationError" });
    }
  });

  const assets = Array.isArray(body.assets) ? body.assets : [];
  const normalizedAssets = assets.slice(0, 200).map((asset, index) => ({
    id: text(asset.id, 80),
    step_id: text(asset.step_id, 80) || null,
    alt_text: text(asset.alt_text, 300) || null,
    sort_order: intValue(asset.sort_order, index)
  })).filter((asset) => asset.id);

  return { article, steps: normalizedSteps, assets: normalizedAssets };
}

export function validateImageNameAndType(fileName, mimeType, size) {
  const extension = String(fileName || "").split(".").pop()?.toLowerCase() || "";
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw Object.assign(new Error("Only JPEG, PNG, and WebP images are allowed"), { name: "ValidationError" });
  }
  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    throw Object.assign(new Error("Invalid image MIME type"), { name: "ValidationError" });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_KNOWLEDGE_IMAGE_BYTES) {
    throw Object.assign(new Error("Image must be 500KB or less"), { name: "ValidationError" });
  }
}

export function detectImageMetadata(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(buffer);
    return { mimeType: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58 && bytes.length >= 30) {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { mimeType: "image/webp", width, height };
    }
    return { mimeType: "image/webp", width: null, height: null };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (marker >= 0xc0 && marker <= 0xc3 && bytes.length >= offset + 9) {
        const height = (bytes[offset + 5] << 8) + bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) + bytes[offset + 8];
        return { mimeType: "image/jpeg", width, height };
      }
      offset += 2 + length;
    }
    return { mimeType: "image/jpeg", width: null, height: null };
  }

  throw Object.assign(new Error("Image content does not match an allowed format"), { name: "ValidationError" });
}
