import { DashboardUsage } from "@/components/DashboardUsage";
import { requireAuth, roleLabel } from "@/lib/auth";
import { fetchUsageSummary } from "@/lib/usage";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { profile, email } = await requireAuth();
  const supabase = await createClient();

  let orgName = "—";
  const orgId = profile.organization_id;

  if (orgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name, status, tax_id")
      .eq("id", orgId)
      .single();
    if (org) orgName = org.name;
  }

  const { count: docCount } = orgId
    ? await supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
    : await supabase.from("documents").select("*", { count: "exact", head: true });

  let sendUsed = 0;
  let sendLimit: number | null = null;
  if (orgId) {
    const usage = await fetchUsageSummary(supabase, orgId);
    const send = usage.rows.find((r) => r.resource === "send_hacienda");
    if (send) {
      sendUsed = send.used;
      sendLimit = send.limit >= 0 ? send.limit : null;
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-900">Inicio</h1>
      <p className="mt-1 text-slate-600">
        Bienvenido, {profile.full_name ?? email}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Rol</p>
          <p className="mt-1 text-lg font-medium">{roleLabel(profile.role)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Organización</p>
          <p className="mt-1 text-lg font-medium">{orgName}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Comprobantes (total)</p>
          <p className="mt-1 text-lg font-medium">{docCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Envíos Hacienda (mes)</p>
          <p className="mt-1 text-lg font-medium">
            {sendLimit != null ? `${sendUsed} / ${sendLimit}` : sendUsed}
          </p>
        </div>
      </div>

      <DashboardUsage
        initialOrgId={orgId}
        isSuperadmin={profile.role === "superadmin"}
      />
    </div>
  );
}
