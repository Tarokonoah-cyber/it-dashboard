import { requireDashboardAuth } from "../../../../lib/auth";
import {
  deleteKnowledgeArticle,
  getKnowledgeArticle,
  knowledgeError,
  ok,
  updateKnowledgeArticle
} from "../../../../lib/knowledge-service";

async function articleId(context) {
  const params = await context.params;
  return String(params.id || "").trim();
}

export async function GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDrafts = searchParams.get("includeDrafts") === "1";
    if (includeDrafts) {
      const authError = requireDashboardAuth(request);
      if (authError) return authError;
    }
    const article = await getKnowledgeArticle(await articleId(context), { includeDrafts });
    if (!article) return Response.json({ success: false, message: "Not found" }, { status: 404 });
    return ok(article);
  } catch (error) {
    return knowledgeError(error);
  }
}

export async function PATCH(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    return ok(await updateKnowledgeArticle(await articleId(context), body));
  } catch (error) {
    return knowledgeError(error);
  }
}

export async function DELETE(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    return ok(await deleteKnowledgeArticle(await articleId(context)));
  } catch (error) {
    return knowledgeError(error);
  }
}
