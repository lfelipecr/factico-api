import type { SupabaseClient } from "@supabase/supabase-js";

export const QUOTA_RESOURCES = [
  "generate_key",
  "xml_invoice",
  "xml_sign",
  "send_hacienda",
  "consult_hacienda",
] as const;

export type QuotaResource = (typeof QUOTA_RESOURCES)[number];

export function resourceLabel(resource: string): string {
  const map: Record<string, string> = {
    generate_key: "Claves generadas",
    xml_invoice: "XML creados",
    xml_sign: "Firmas",
    send_hacienda: "Envíos a Hacienda",
    consult_hacienda: "Consultas Hacienda",
  };
  return map[resource] ?? resource;
}

export function currentMonthPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export type UsageRow = {
  resource: string;
  label: string;
  used: number;
  limit: number;
};

export type UsageSummary = {
  planName: string | null;
  planId: string | null;
  subscriptionStatus: string | null;
  periodStart: string;
  periodEnd: string;
  rows: UsageRow[];
};

export async function fetchUsageSummary(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<UsageSummary> {
  const { start, end } = currentMonthPeriod();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, status, plans(name)")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const planRel = sub?.plans as { name: string } | { name: string }[] | null;
  const planName = Array.isArray(planRel)
    ? planRel[0]?.name ?? null
    : planRel?.name ?? null;

  if (!sub?.plan_id) {
    return {
      planName,
      planId: null,
      subscriptionStatus: sub?.status ?? null,
      periodStart: start,
      periodEnd: end,
      rows: [],
    };
  }

  const { data: limits } = await supabase
    .from("plan_limits")
    .select("resource, limit_count")
    .eq("plan_id", sub.plan_id)
    .eq("period", "monthly");

  const { data: counters } = await supabase
    .from("usage_counters")
    .select("resource, used_count")
    .eq("organization_id", organizationId)
    .eq("period_start", start);

  const counterMap = Object.fromEntries(
    (counters ?? []).map((c) => [c.resource, c.used_count as number]),
  );
  const limitMap = Object.fromEntries(
    (limits ?? []).map((l) => [l.resource, l.limit_count as number]),
  );

  const resources = new Set([
    ...QUOTA_RESOURCES,
    ...Object.keys(limitMap),
    ...Object.keys(counterMap),
  ]);

  const rows: UsageRow[] = [...resources].sort().map((resource) => ({
    resource,
    label: resourceLabel(resource),
    used: counterMap[resource] ?? 0,
    limit: limitMap[resource] ?? -1,
  }));

  return {
    planName,
    planId: sub.plan_id,
    subscriptionStatus: sub.status,
    periodStart: start,
    periodEnd: end,
    rows,
  };
}
