import { PlanEditor, type PlanFormData } from "@/components/PlanEditor";
import { requireRole } from "@/lib/auth";
import { QUOTA_RESOURCES } from "@/lib/usage";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["superadmin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, description, monthly_price, is_active")
    .eq("id", id)
    .single();

  if (!plan) notFound();

  const { data: limits } = await supabase
    .from("plan_limits")
    .select("id, resource, limit_count, period, hard_limit")
    .eq("plan_id", id)
    .eq("period", "monthly");

  const limitByResource = Object.fromEntries(
    (limits ?? []).map((l) => [l.resource, l]),
  );

  const initial: PlanFormData = {
    id: plan.id,
    name: plan.name,
    description: plan.description ?? "",
    monthly_price: Number(plan.monthly_price) || 0,
    is_active: plan.is_active,
    limits: QUOTA_RESOURCES.map((resource) => {
      const row = limitByResource[resource];
      return {
        id: row?.id,
        resource,
        limit_count: row?.limit_count ?? 0,
        period: "monthly",
        hard_limit: row?.hard_limit ?? true,
      };
    }),
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-900">Plan: {plan.name}</h1>
      <div className="mt-6">
        <PlanEditor initial={initial} />
      </div>
    </div>
  );
}
