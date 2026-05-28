"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Plan = { id: string; name: string };

export function AssignPlanSelect({
  organizationId,
  currentPlanId,
  plans,
}: {
  organizationId: string;
  currentPlanId: string | null;
  plans: Plan[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(planId: string) {
    if (!planId || planId === currentPlanId) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("subscriptions").upsert(
      {
        organization_id: organizationId,
        plan_id: planId,
        status: "active",
      },
      { onConflict: "organization_id" },
    );
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <select
        className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
        value={currentPlanId ?? ""}
        disabled={loading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Sin plan
        </option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
