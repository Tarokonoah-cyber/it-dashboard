import "server-only";
import { fail, ok, supabaseRequest } from "./supabase-rest";
import { KNOWLEDGE_IMAGE_BUCKET, createSignedStorageUrl, deleteStorageObjects } from "./supabase-storage";
import { validateArticlePayload } from "./knowledge-validation";

function encodeEq(value) {
  return encodeURIComponent(String(value || ""));
}

function inFilter(values) {
  return values.map((value) => encodeURIComponent(String(value))).join(",");
}

export function knowledgeError(error) {
  return fail(error, error.name === "ValidationError" ? 400 : 500);
}

export function authOrNull(requireDashboardAuth, request) {
  const authError = requireDashboardAuth(request);
  return authError || null;
}

function searchableText(article) {
  return [
    article.title,
    article.article_type,
    article.category,
    article.system_name,
    article.symptom,
    article.possible_cause,
    article.summary,
    article.keywords
  ].filter(Boolean).join(" ").toLowerCase();
}

function normalizeAsset(asset, signedUrl = "") {
  return {
    id: asset.id,
    article_id: asset.article_id,
    step_id: asset.step_id,
    storage_path: asset.storage_path,
    original_filename: asset.original_filename,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    width: asset.width,
    height: asset.height,
    alt_text: asset.alt_text,
    sort_order: asset.sort_order,
    created_at: asset.created_at,
    signed_url: signedUrl
  };
}

async function withSignedAssets(assets) {
  const signed = await Promise.all(
    (assets || []).map(async (asset) => normalizeAsset(asset, await createSignedStorageUrl(KNOWLEDGE_IMAGE_BUCKET, asset.storage_path)))
  );
  return signed;
}

export async function listKnowledgeArticles({ includeDrafts = false, query = "", category = "", system = "", status = "" } = {}) {
  const filters = ["select=*", "order=sort_order.asc,updated_at.desc", "limit=500"];
  if (!includeDrafts) filters.push("status=eq.published");
  else if (status) filters.push(`status=eq.${encodeEq(status)}`);
  if (category) filters.push(`category=eq.${encodeEq(category)}`);
  if (system) filters.push(`system_name=eq.${encodeEq(system)}`);

  let rows = await supabaseRequest("knowledge_articles", filters.join("&"));
  const keyword = String(query || "").trim().toLowerCase();
  if (keyword) rows = rows.filter((article) => searchableText(article).includes(keyword));
  return rows;
}

export async function getKnowledgeArticle(id, { includeDrafts = false } = {}) {
  const articleRows = await supabaseRequest("knowledge_articles", `id=eq.${encodeEq(id)}&select=*&limit=1`);
  const article = articleRows[0] || null;
  if (!article) return null;
  if (!includeDrafts && article.status !== "published") return null;

  const [steps, rawAssets] = await Promise.all([
    supabaseRequest("knowledge_steps", `article_id=eq.${encodeEq(id)}&select=*&order=step_order.asc`),
    supabaseRequest("knowledge_assets", `article_id=eq.${encodeEq(id)}&select=*&order=sort_order.asc,created_at.asc`)
  ]);
  const assets = await withSignedAssets(rawAssets);
  const byStep = new Map();
  const articleAssets = [];
  assets.forEach((asset) => {
    if (asset.step_id) {
      if (!byStep.has(asset.step_id)) byStep.set(asset.step_id, []);
      byStep.get(asset.step_id).push(asset);
    } else {
      articleAssets.push(asset);
    }
  });

  return {
    ...article,
    steps: steps.map((step) => ({ ...step, assets: byStep.get(step.id) || [] })),
    assets: articleAssets
  };
}

export async function createKnowledgeArticle(body) {
  const { article, steps } = validateArticlePayload(body);
  const articleRows = await supabaseRequest("knowledge_articles", "select=*", {
    method: "POST",
    body: article
  });
  const created = articleRows[0];

  for (const step of steps) {
    await supabaseRequest("knowledge_steps", "select=*", {
      method: "POST",
      body: {
        article_id: created.id,
        step_order: step.step_order,
        title: step.title,
        body: step.body
      }
    });
  }

  return getKnowledgeArticle(created.id, { includeDrafts: true });
}

async function deleteAssets(rawAssets) {
  const paths = (rawAssets || []).map((asset) => asset.storage_path).filter(Boolean);
  await deleteStorageObjects(KNOWLEDGE_IMAGE_BUCKET, paths);
  if (rawAssets?.length) {
    await supabaseRequest("knowledge_assets", `id=in.(${inFilter(rawAssets.map((asset) => asset.id))})&select=id`, {
      method: "DELETE"
    });
  }
}

export async function updateKnowledgeArticle(id, body) {
  const { article, steps, assets } = validateArticlePayload(body);
  const existing = await getKnowledgeArticle(id, { includeDrafts: true });
  if (!existing) throw Object.assign(new Error("Article not found"), { name: "ValidationError" });

  const articleRows = await supabaseRequest("knowledge_articles", `id=eq.${encodeEq(id)}&select=*`, {
    method: "PATCH",
    body: article
  });
  if (!articleRows.length) throw Object.assign(new Error("Article not found"), { name: "ValidationError" });

  const existingSteps = await supabaseRequest("knowledge_steps", `article_id=eq.${encodeEq(id)}&select=id`);
  const existingStepIds = new Set(existingSteps.map((step) => step.id));
  const incomingExistingStepIds = new Set(steps.map((step) => step.id).filter((stepId) => existingStepIds.has(stepId)));
  const deletedStepIds = existingSteps.map((step) => step.id).filter((stepId) => !incomingExistingStepIds.has(stepId));

  if (deletedStepIds.length) {
    const deletedAssets = await supabaseRequest("knowledge_assets", `step_id=in.(${inFilter(deletedStepIds)})&select=*`);
    await deleteAssets(deletedAssets);
    await supabaseRequest("knowledge_steps", `id=in.(${inFilter(deletedStepIds)})&select=id`, { method: "DELETE" });
  }

  for (const step of steps) {
    if (step.id && existingStepIds.has(step.id)) {
      await supabaseRequest("knowledge_steps", `id=eq.${encodeEq(step.id)}&select=id`, {
        method: "PATCH",
        body: { step_order: 10000 + step.step_order }
      });
    }
  }

  for (const step of steps) {
    if (step.id && existingStepIds.has(step.id)) {
      await supabaseRequest("knowledge_steps", `id=eq.${encodeEq(step.id)}&select=*`, {
        method: "PATCH",
        body: {
          step_order: step.step_order,
          title: step.title,
          body: step.body
        }
      });
    } else {
      await supabaseRequest("knowledge_steps", "select=*", {
        method: "POST",
        body: {
          article_id: id,
          step_order: step.step_order,
          title: step.title,
          body: step.body
        }
      });
    }
  }

  for (const asset of assets) {
    await supabaseRequest("knowledge_assets", `id=eq.${encodeEq(asset.id)}&article_id=eq.${encodeEq(id)}&select=*`, {
      method: "PATCH",
      body: {
        step_id: asset.step_id,
        alt_text: asset.alt_text,
        sort_order: asset.sort_order
      }
    });
  }

  return getKnowledgeArticle(id, { includeDrafts: true });
}

export async function deleteKnowledgeArticle(id) {
  const assets = await supabaseRequest("knowledge_assets", `article_id=eq.${encodeEq(id)}&select=*`);
  await deleteAssets(assets);
  await supabaseRequest("knowledge_articles", `id=eq.${encodeEq(id)}&select=id`, { method: "DELETE" });
  return { id };
}

export async function deleteKnowledgeAsset(articleId, assetId) {
  const rows = await supabaseRequest(
    "knowledge_assets",
    `id=eq.${encodeEq(assetId)}&article_id=eq.${encodeEq(articleId)}&select=*&limit=1`
  );
  const asset = rows[0];
  if (!asset) throw Object.assign(new Error("Asset not found"), { name: "ValidationError" });
  await deleteAssets([asset]);
  return { id: assetId };
}

export { ok };
