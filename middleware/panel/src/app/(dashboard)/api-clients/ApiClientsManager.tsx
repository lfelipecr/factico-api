"use client";

import { ApiError, createApiClient } from "@/lib/api";
import type { ApiClientRow } from "@/lib/types";
import { getAccessToken } from "@/lib/session";
import { useState } from "react";

export function ApiClientsManager({
  organizationId,
  initialClients,
}: {
  organizationId: string;
  initialClients: ApiClientRow[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNewKey(null);
    const name = new FormData(e.currentTarget).get("name") as string;

    try {
      const token = await getAccessToken();
      const res = await createApiClient(token, organizationId, name);
      setNewKey(res.api_key);
      setClients((prev) => [
        {
          id: res.id,
          name,
          key_prefix: "fc_live_",
          status: "active",
          last_used_at: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input name="name" required placeholder="Nombre integración" className="field flex-1" />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Crear key
        </button>
      </form>

      {newKey && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm break-all">
          <p className="font-medium text-green-900">Nueva API key (cópiela ahora):</p>
          <code className="mt-2 block">{newKey}</code>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-6 space-y-2">
        {clients.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <span className="font-medium">{c.name}</span>
            <span className="ml-2 text-slate-500">{c.status}</span>
            <span className="ml-2 text-xs text-slate-400">
              {c.last_used_at
                ? `Último uso: ${new Date(c.last_used_at).toLocaleString("es-CR")}`
                : "Sin uso"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
