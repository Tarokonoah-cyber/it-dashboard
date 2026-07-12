import { requireDashboardAuth } from "../../../lib/auth";
import {
  createKnowledgeArticle,
  knowledgeError,
  listKnowledgeArticles,
  ok
} from "../../../lib/knowledge-service";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDrafts = searchParams.get("includeDrafts") === "1";
    if (includeDrafts) {
      const authError = requireDashboardAuth(request);
      if (authError) return authError;
    }
    const rows = await listKnowledgeArticles({
      includeDrafts,
      query: searchParams.get("q") || "",
      category: searchParams.get("category") || "",
      system: searchParams.get("system") || "",
      status: searchParams.get("status") || ""
    });
    return ok(rows);
  } catch (error) {
    return knowledgeError(error);
  }
}

export async function POST(request) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    return ok(await createKnowledgeArticle(body));
  } catch (error) {
    return knowledgeError(error);
  }
}
