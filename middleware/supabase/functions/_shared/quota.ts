import type { ApiContext } from "./types.ts";
import { errorResponse } from "./http.ts";

function currentMonthPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function enforceQuota(
  ctx: ApiContext,
  resource: string,
): Promise<Response | null> {
  const { start, end } = currentMonthPeriod();

  const { data, error } = await ctx.supabase.rpc("check_and_increment_usage", {
    p_organization_id: ctx.organizationId,
    p_resource: resource,
    p_period_start: start,
    p_period_end: end,
  });

  if (error) {
    console.error("quota rpc error", error);
    return errorResponse("Quota check failed", 500, "quota_error");
  }

  const result = data as { allowed: boolean; used: number; limit: number };
  if (!result.allowed) {
    return errorResponse(
      `Quota exceeded for ${resource} (${result.used}/${result.limit})`,
      429,
      "quota_exceeded",
      result,
    );
  }

  return null;
}
