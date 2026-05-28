"use client";

import { QUOTA_RESOURCES, resourceLabel } from "@/lib/usage";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type PlanLimitRow = {
  id?: string;
  resource: string;
  limit_count: number;
  period: string;
  hard_limit: boolean;
};

export type PlanFormData = {
  id?: string;
  name: string;
  description: string;
  monthly_price: number;
  is_active: boolean;
  limits: PlanLimitRow[];
};

const DEFAULT_LIMITS: PlanLimitRow[] = QUOTA_RESOURCES.map((resource) => ({
  resource,
  limit_count: 1000,
  period: "monthly",
  hard_limit: true,
}));

export function PlanEditor({ initial }: { initial?: PlanFormData }) {
  const router = useRouter();
  const isNew = !initial?.id;

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [monthlyPrice, setMonthlyPrice] = useState(
    String(initial?.monthly_price ?? 0),
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [limits, setLimits] = useState<PlanLimitRow[]>(
    initial?.limits?.length ? initial.limits : DEFAULT_LIMITS,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateLimit(resource: string, limit_count: number) {
    setLimits((prev) =>
      prev.map((l) =>
        l.resource === resource ? { ...l, limit_count } : l,
      ),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    if (isNew) {
      const { data: plan, error: planErr } = await supabase
        .from("plans")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          monthly_price: Number(monthlyPrice) || 0,
          is_active: isActive,
        })
        .select("id")
        .single();

      if (planErr || !plan) {
        setError(planErr?.message ?? "No se pudo crear el plan");
        setLoading(false);
        return;
      }

      const { error: limitsErr } = await supabase.from("plan_limits").insert(
        limits.map((l) => ({
          plan_id: plan.id,
          resource: l.resource,
          limit_count: l.limit_count,
          period: l.period,
          hard_limit: l.hard_limit,
        })),
      );

      if (limitsErr) {
        setError(limitsErr.message);
        setLoading(false);
        return;
      }

      router.push(`/plans/${plan.id}`);
      router.refresh();
      return;
    }

    const planId = initial!.id!;
    const { error: planErr } = await supabase
      .from("plans")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        monthly_price: Number(monthlyPrice) || 0,
        is_active: isActive,
      })
      .eq("id", planId);

    if (planErr) {
      setError(planErr.message);
      setLoading(false);
      return;
    }

    for (const l of limits) {
      if (l.id) {
        const { error: upErr } = await supabase
          .from("plan_limits")
          .update({ limit_count: l.limit_count, hard_limit: l.hard_limit })
          .eq("id", l.id);
        if (upErr) {
          setError(upErr.message);
          setLoading(false);
          return;
        }
      } else {
        const { error: insErr } = await supabase.from("plan_limits").insert({
          plan_id: planId,
          resource: l.resource,
          limit_count: l.limit_count,
          period: l.period,
          hard_limit: l.hard_limit,
        });
        if (insErr) {
          setError(insErr.message);
          setLoading(false);
          return;
        }
      }
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <div>
        <Link href="/plans" className="text-sm text-brand-600 hover:underline">
          ← Volver a planes
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-medium text-brand-900">
          {isNew ? "Nuevo plan" : "Editar plan"}
        </h2>
        <label className="block text-sm font-medium text-slate-700">
          Nombre
          <input
            className="field"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Descripción
          <textarea
            className="field"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Precio mensual (referencia)
          <input
            className="field"
            type="number"
            min={0}
            step="0.01"
            value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Plan activo (disponible para asignar)
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium text-brand-900">Límites mensuales</h3>
        <p className="mt-1 text-sm text-slate-500">
          La API bloquea el recurso cuando se supera el límite (hard limit).
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-600">
              <th className="pb-2 font-medium">Recurso</th>
              <th className="pb-2 font-medium">Límite / mes</th>
            </tr>
          </thead>
          <tbody>
            {limits.map((l) => (
              <tr key={l.resource} className="border-b border-slate-100">
                <td className="py-2 pr-4">{resourceLabel(l.resource)}</td>
                <td className="py-2">
                  <input
                    type="number"
                    min={0}
                    className="field w-32"
                    value={l.limit_count}
                    onChange={(e) =>
                      updateLimit(l.resource, Number(e.target.value) || 0)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Guardando…" : isNew ? "Crear plan" : "Guardar cambios"}
      </button>
    </form>
  );
}
