"use client";

import { UsageMeters } from "@/components/UsageMeters";
import { OrgSelector } from "@/components/OrgSelector";
import { fetchUsageSummary } from "@/lib/usage";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import type { UsageSummary } from "@/lib/usage";

export function DashboardUsage({
  initialOrgId,
  isSuperadmin,
}: {
  initialOrgId: string | null;
  isSuperadmin: boolean;
}) {
  const [orgId, setOrgId] = useState<string | null>(initialOrgId);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const supabase = createClient();
    const data = await fetchUsageSummary(supabase, id);
    setSummary(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (orgId) load(orgId);
    else setSummary(null);
  }, [orgId, load]);

  if (!orgId && isSuperadmin) {
    return (
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-brand-900">Uso del mes</h2>
        <p className="mt-1 text-sm text-slate-600">
          Seleccione un tenant para ver cuotas y consumo.
        </p>
        <div className="mt-4 max-w-md">
          <OrgSelector value={orgId} onChange={setOrgId} />
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Su usuario no está vinculado a una organización. Contacte al administrador.
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-brand-900">Uso del mes</h2>
          {summary?.subscriptionStatus ? (
            <p className="mt-1 text-sm text-slate-500">
              Suscripción: {summary.subscriptionStatus}
            </p>
          ) : null}
        </div>
        {isSuperadmin ? (
          <div className="w-full max-w-xs">
            <OrgSelector value={orgId} onChange={setOrgId} />
          </div>
        ) : null}
      </div>
      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando uso…</p>
        ) : summary ? (
          <UsageMeters
            rows={summary.rows}
            periodStart={summary.periodStart}
            periodEnd={summary.periodEnd}
            planName={summary.planName}
          />
        ) : null}
      </div>
    </div>
  );
}
