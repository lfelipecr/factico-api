import { AssignPlanSelect } from "@/components/AssignPlanSelect";
import { requireRole } from "@/lib/auth";
import { currentMonthPeriod, fetchUsageSummary, resourceLabel } from "@/lib/usage";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function OrganizationsPage() {
  await requireRole(["superadmin"]);
  const supabase = await createClient();
  const { start } = currentMonthPeriod();

  const { data: orgs } = await supabase
    .from("organizations")
    .select(
      `
      id,
      name,
      tax_id,
      status,
      created_at,
      subscriptions (
        plan_id,
        status,
        plans ( id, name )
      )
    `,
    )
    .order("created_at", { ascending: false });

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const usageByOrg = new Map<
    string,
    { sendUsed: number; sendLimit: number; planName: string | null }
  >();

  for (const o of orgs ?? []) {
    const summary = await fetchUsageSummary(supabase, o.id);
    const send = summary.rows.find((r) => r.resource === "send_hacienda");
    usageByOrg.set(o.id, {
      sendUsed: send?.used ?? 0,
      sendLimit: send && send.limit >= 0 ? send.limit : -1,
      planName: summary.planName,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-900">Organizaciones</h1>
        <div className="flex gap-2">
          <Link
            href="/plans"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Planes
          </Link>
          <Link
            href="/organizations/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Nuevo tenant
          </Link>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Uso del mes desde {start}. Métrica principal:{" "}
        {resourceLabel("send_hacienda")}.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Envíos (mes)</th>
              <th className="px-4 py-3 font-medium">Asignar plan</th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o) => {
              const sub = Array.isArray(o.subscriptions)
                ? o.subscriptions[0]
                : o.subscriptions;
              const planRel = sub?.plans as
                | { id: string; name: string }
                | { id: string; name: string }[]
                | null
                | undefined;
              const plan = Array.isArray(planRel) ? planRel[0] : planRel;
              const usage = usageByOrg.get(o.id);

              return (
                <tr key={o.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{o.name}</p>
                    <p className="text-xs text-slate-500">{o.tax_id ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">{o.status}</td>
                  <td className="px-4 py-3">
                    {plan?.name ?? usage?.planName ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {usage
                      ? usage.sendLimit >= 0
                        ? `${usage.sendUsed} / ${usage.sendLimit}`
                        : String(usage.sendUsed)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <AssignPlanSelect
                      organizationId={o.id}
                      currentPlanId={plan?.id ?? sub?.plan_id ?? null}
                      plans={plans ?? []}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!orgs?.length && (
          <p className="p-6 text-center text-slate-500">Sin organizaciones</p>
        )}
      </div>
    </div>
  );
}
