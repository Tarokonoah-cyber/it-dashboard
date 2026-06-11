import { fail, ok, supabaseRequest } from "../../../../lib/supabase-rest";

export async function POST(request) {
  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    if (!ids.length) return ok({ updated: 0 });

    await Promise.all(
      ids.map((id, index) =>
        supabaseRequest("quick_notes", `id=eq.${encodeURIComponent(id)}&select=id`, {
          method: "PATCH",
          body: { sort_order: index + 1, updated_at: new Date().toISOString() }
        })
      )
    );
    return ok({ updated: ids.length });
  } catch (error) {
    return fail(error);
  }
}
