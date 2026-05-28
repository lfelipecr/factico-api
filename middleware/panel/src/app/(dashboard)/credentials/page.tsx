"use client";

import { ApiError, upsertCredentials } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { getAccessToken } from "@/lib/session";
import { OrgSelector } from "@/components/OrgSelector";
import { useEffect, useState } from "react";

export default function CredentialsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();
      if (profile?.role) setRole(profile.role);
      if (profile?.organization_id) setOrgId(profile.organization_id);
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) {
      setError("No tiene organización asignada");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);

    try {
      const token = await getAccessToken();
      await upsertCredentials(token, orgId, {
        environment: fd.get("environment"),
        factico_secret_key: fd.get("factico_secret_key") || undefined,
        hacienda_user: fd.get("hacienda_user") || undefined,
        hacienda_password: fd.get("hacienda_password") || undefined,
        certificate_code: fd.get("certificate_code") || undefined,
        certificate_pin: fd.get("certificate_pin") || undefined,
      });
      setMessage("Credenciales guardadas");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-brand-900">Credenciales</h1>
      <p className="mt-1 text-sm text-slate-600">
        Secret Odoo, ATV y referencia de certificado (el P12 se sube en Certificado).
      </p>

      {role === "superadmin" && (
        <div className="mt-4">
          <OrgSelector value={orgId} onChange={setOrgId} disabled={loading} />
        </div>
      )}

      {!orgId && (
        <p className="mt-4 text-sm text-amber-700">
          Sin organización vinculada. Un superadmin debe usar Vincular usuario.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <select name="environment" className="field" defaultValue="staging">
          <option value="staging">Staging</option>
          <option value="production">Producción</option>
        </select>
        <input name="factico_secret_key" className="field" placeholder="Secret key Odoo (si aplica)" />
        <input name="hacienda_user" className="field" placeholder="Usuario Hacienda" />
        <input name="hacienda_password" type="password" className="field" placeholder="Contraseña Hacienda" />
        <input name="certificate_code" className="field" placeholder="Código certificado Odoo" />
        <input name="certificate_pin" type="password" className="field" placeholder="PIN certificado" />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={loading || !orgId}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </div>
  );
}
