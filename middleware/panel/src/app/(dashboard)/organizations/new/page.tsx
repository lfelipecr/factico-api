"use client";

import { ApiError, provisionOrganization, type ProvisionResult } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewOrganizationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      environment: fd.get("environment") as "staging" | "production",
      organization: {
        name: String(fd.get("org_name")),
        tax_id: String(fd.get("tax_id") || ""),
      },
      odoo_user: {
        usuario_nombre: String(fd.get("usuario_nombre")),
        codigo_identificacion: String(fd.get("codigo_identificacion")),
        numero_identificacion: String(fd.get("numero_identificacion")),
        correo: String(fd.get("correo")),
      },
      hacienda: {
        usuario_hacienda: String(fd.get("usuario_hacienda") || ""),
        contrasena_hacienda: String(fd.get("contrasena_hacienda") || ""),
      },
      api_client_name: String(fd.get("api_client_name") || "Integración principal"),
    };

    try {
      const token = await getAccessToken();
      const res = await provisionOrganization(token, body);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al provisionar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-brand-900">Nuevo tenant</h1>
      <p className="mt-1 text-sm text-slate-600">
        Crea organización, credenciales y API key. Si la cédula ya existe en Odoo
        (mismo ambiente), se reutiliza el <code className="rounded bg-slate-100 px-1">secret_key</code>{" "}
        sin duplicar el usuario.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">Organización</legend>
          <input name="org_name" required placeholder="Nombre" className="field" />
          <input name="tax_id" placeholder="Cédula jurídica" className="field" />
          <select name="environment" className="field" defaultValue="staging">
            <option value="staging">Staging (pruebas)</option>
            <option value="production">Producción</option>
          </select>
        </fieldset>

        <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">Usuario Odoo</legend>
          <input name="usuario_nombre" required className="field" placeholder="Nombre" />
          <select name="codigo_identificacion" className="field" defaultValue="cedula_juridica">
            <option value="cedula_fisica">Cédula física</option>
            <option value="cedula_juridica">Cédula jurídica</option>
            <option value="dimex">DIMEX</option>
            <option value="nite">NITE</option>
            <option value="extranjero">Extranjero</option>
          </select>
          <input name="numero_identificacion" required className="field" placeholder="Número ID" />
          <input name="correo" type="email" required className="field" placeholder="Correo" />
        </fieldset>

        <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">Hacienda (opcional)</legend>
          <input name="usuario_hacienda" className="field" placeholder="Usuario ATV" />
          <input name="contrasena_hacienda" type="password" className="field" placeholder="Contraseña ATV" />
        </fieldset>

        <input name="api_client_name" className="field" placeholder="Nombre integración API" />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Provisionando…" : "Crear tenant"}
        </button>
      </form>

      {result && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-900">Tenant creado</p>
          {result.odoo_user_reused ? (
            <p className="mt-2 text-green-800">
              Usuario Odoo existente reutilizado (misma cédula en este ambiente).
            </p>
          ) : (
            <p className="mt-2 text-green-800">Usuario Odoo nuevo registrado.</p>
          )}
          <p className="mt-2 break-all">
            <span className="font-medium">organization_id:</span> {result.organization_id}
          </p>
          <p className="mt-2 break-all">
            <span className="font-medium">api_key:</span> {result.api_key}
          </p>
          <p className="mt-2 break-all">
            <span className="font-medium">factico_secret_key:</span>{" "}
            {result.factico_secret_key}
          </p>
          <p className="mt-4 text-amber-800">{result.warning}</p>
          <button
            type="button"
            onClick={() => router.push("/organizations")}
            className="mt-4 text-brand-700 underline"
          >
            Ver organizaciones
          </button>
        </div>
      )}

    </div>
  );
}
