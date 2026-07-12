import { requireDashboardAuth } from "../../../../../lib/auth";
import { supabaseRequest } from "../../../../../lib/supabase-rest";
import { KNOWLEDGE_IMAGE_BUCKET, deleteStorageObjects, uploadStorageObject } from "../../../../../lib/supabase-storage";
import { deleteKnowledgeAsset, getKnowledgeArticle, knowledgeError, ok } from "../../../../../lib/knowledge-service";
import {
  detectImageMetadata,
  validateImageNameAndType
} from "../../../../../lib/knowledge-validation";

function encodeEq(value) {
  return encodeURIComponent(String(value || ""));
}

async function articleId(context) {
  const params = await context.params;
  return String(params.id || "").trim();
}

function storageExtension(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  let storagePath = "";
  try {
    const id = await articleId(context);
    const article = await getKnowledgeArticle(id, { includeDrafts: true });
    if (!article) return Response.json({ success: false, message: "Article not found" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      throw Object.assign(new Error("Image file is required"), { name: "ValidationError" });
    }

    validateImageNameAndType(file.name, file.type, file.size);
    const buffer = await file.arrayBuffer();
    const detected = detectImageMetadata(buffer);
    if (detected.mimeType !== file.type) {
      throw Object.assign(new Error("Image MIME type does not match file content"), { name: "ValidationError" });
    }

    const stepId = String(formData.get("step_id") || "").trim() || null;
    if (stepId) {
      const stepRows = await supabaseRequest(
        "knowledge_steps",
        `id=eq.${encodeEq(stepId)}&article_id=eq.${encodeEq(id)}&select=id&limit=1`
      );
      if (!stepRows.length) throw Object.assign(new Error("Step not found"), { name: "ValidationError" });
    }

    const fileId = crypto.randomUUID();
    storagePath = `${id}/${fileId}.${storageExtension(file.type)}`;
    await uploadStorageObject(KNOWLEDGE_IMAGE_BUCKET, storagePath, buffer, file.type);

    const rows = await supabaseRequest("knowledge_assets", "select=*", {
      method: "POST",
      body: {
        article_id: id,
        step_id: stepId,
        storage_path: storagePath,
        original_filename: String(file.name || "").slice(0, 240),
        mime_type: file.type,
        size_bytes: file.size,
        width: detected.width,
        height: detected.height,
        alt_text: String(formData.get("alt_text") || "").trim().slice(0, 300) || null,
        sort_order: Number(formData.get("sort_order") || 0) || 0
      }
    });

    return ok(rows[0]);
  } catch (error) {
    if (storagePath) {
      try {
        await deleteStorageObjects(KNOWLEDGE_IMAGE_BUCKET, [storagePath]);
      } catch {
        // Keep the original validation/upload error visible.
      }
    }
    return knowledgeError(error);
  }
}

export async function DELETE(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const assetId = String(searchParams.get("assetId") || "").trim();
    if (!assetId) throw Object.assign(new Error("Asset id is required"), { name: "ValidationError" });
    return ok(await deleteKnowledgeAsset(await articleId(context), assetId));
  } catch (error) {
    return knowledgeError(error);
  }
}
