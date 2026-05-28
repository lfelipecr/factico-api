"use client";

import { ApiError, uploadCertificate } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { getAccessToken } from "@/lib/session";
import { OrgSelector } from "@/components/OrgSelector";
import { useEffect, useState } from "react";

export default function CertificatePage() {
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
    if (!orgId) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const fd = new FormData(e.currentTarget);
    const file = fd.get("archivo_p12");
    if (!(file instanceof File) || !file.size) {
      setError("Seleccione un archivo .p12");
      setLoading(false);
      return;
    }

    const upload = new FormData();
    upload.append("archivo_p12", file);
    upload.append("pin", String(fd.get("pin")));
    upload.append("environment", String(fd.get("environment")));

    try {
      const token = await getAccessToken();
      const res = await uploadCertificate(token, orgId, upload) as {
        codigo_certificado?: string;
        nombre_certificado?: string;
      };
      setMessage(
        `Certificado cargado: ${res.codigo_certificado ?? "OK"} (${res.nombre_certificado ?? ""})`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al subir");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-brand-900">Certificado digital</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sube el archivo .p12 a Odoo y guarda el código de certificado en el middleware.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        {role === "superadmin" && (
          <OrgSelector value={orgId} onChange={setOrgId} disabled={loading} />
        )}
        <select name="environment" className="field" defaultValue="staging">
          <option value="staging">Staging</option>
          <option value="production">Producción</option>
        </select>
        <input name="archivo_p12" type="file" accept=".p12" required className="field" />
        <input name="pin" type="password" required className="field" placeholder="PIN del certificado" />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={loading || !orgId}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Subiendo…" : "Subir certificado"}
        </button>
      </form>
    </div>
  );
}
