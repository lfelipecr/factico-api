import { requireRole } from "@/lib/auth";
import { resourceLabel } from "@/lib/usage";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PlansPage() {
  await requireRole(["superadmin"]);
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("plans")
    .select(
      `
      id,
      name,
      description,
      monthly_price,
      is_active,
      created_at,
      plan_limits ( resource, limit_count, period )
    `,
    )
    .order("name");

  const { count: tenantCount } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-900">Planes</h1>
        <Link
          href="/plans/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Nuevo plan
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {tenantCount ?? 0} tenant(s) con suscripción asignada. Asigne planes en{" "}
        <Link href="/organizations" className="text-brand-600 hover:underline">
          Organizaciones
        </Link>
        .
      </p>

      <div className="mt-6 space-y-4">
        {(plans ?? []).map((p) => {
          const limits = Array.isArray(p.plan_limits) ? p.plan_limits : [];
          const send = limits.find((l) => l.resource === "send_hacienda");

          return (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-slate-900">
                    <Link
                      href={`/plans/${p.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {p.name}
                    </Link>
                    {!p.is_active ? (
                      <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                        inactivo
                      </span>
                    ) : null}
                  </h2>
                  {p.description ? (
                    <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-500">
                    Precio ref.: ₡{Number(p.monthly_price).toLocaleString("es-CR")}
                  </p>
                </div>
                <Link
                  href={`/plans/${p.id}`}
                  className="text-sm text-brand-600 hover:underline"
                >
                  Editar límites →
                </Link>
              </div>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs">
                {limits.map((l) => (
                  <li
                    key={l.resource}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700"
                  >
                    {resourceLabel(l.resource)}: {l.limit_count}/{l.period}
                  </li>
                ))}
              </ul>
              {send ? (
                <p className="mt-2 text-xs text-slate-500">
                  Referencia rápida: hasta {send.limit_count} envíos a Hacienda/mes
                </p>
              ) : null}
            </div>
          );
        })}
        {!plans?.length && (
          <p className="text-center text-slate-500">No hay planes. Cree uno nuevo.</p>
        )}
      </div>
    </div>
  );
}
