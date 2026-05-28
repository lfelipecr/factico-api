"use client";

import { ApiError, linkProfile } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { useState } from "react";

export default function LinkUserPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);

    try {
      const token = await getAccessToken();
      await linkProfile(token, {
        user_id: String(fd.get("user_id")),
        organization_id: String(fd.get("organization_id")),
        role: String(fd.get("role") || "admin"),
      });
      setMessage("Usuario vinculado correctamente");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al vincular");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-brand-900">Vincular usuario</h1>
      <p className="mt-1 text-sm text-slate-600">
        Asigna un usuario de Supabase Auth a una organización (solo superadmin).
      </p>
      <p className="mt-2 text-xs text-slate-500">
        El UUID del usuario está en Authentication → Users en Supabase Studio.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input name="user_id" required className="field" placeholder="UUID usuario Auth" />
        <input
          name="organization_id"
          required
          className="field"
          placeholder="UUID organización"
        />
        <select name="role" className="field" defaultValue="admin">
          <option value="admin">Admin</option>
          <option value="implementer">Implementador</option>
          <option value="client">Cliente final</option>
        </select>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Vincular
        </button>
      </form>
    </div>
  );
}
