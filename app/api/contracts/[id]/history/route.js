import { requireDashboardAuth } from "../../../../../lib/auth";
import { getContractLifecycleStatus } from "../../../../../lib/contractStatus";
import { fail, ok, supabaseRequest, todayTaipei } from "../../../../../lib/supabase-rest";

async function contractId(context) {
  const params = await context.params;
  return String(params.id || "").trim();
}

export async function GET(request, context) {
  const authError = requireDashboardAuth(request);
  if (authError) return authError;

  try {
    const id = await contractId(context);
    if (!id) return fail(new Error("缺少合約 ID"), 400);

    const [contracts, history] = await Promise.all([
      supabaseRequest(
        "contracts",
        `id=eq.${encodeURIComponent(id)}&select=id,contract_name,vendor,start_date,end_date,amount,owner,status,note,created_at,updated_at&limit=1`
      ),
      supabaseRequest(
        "contract_price_history",
        `contract_id=eq.${encodeURIComponent(id)}&select=id,contract_id,amount,effective_date,note,created_at&order=effective_date.desc,created_at.desc&limit=200`
      )
    ]);

    if (!contracts.length) return fail(new Error("找不到合約"), 404);
    const contract = contracts[0];
    return ok({
      contract: {
        ...contract,
        status: getContractLifecycleStatus(contract, todayTaipei(), 30)
      },
      history
    });
  } catch (error) {
    return fail(error);
  }
}
