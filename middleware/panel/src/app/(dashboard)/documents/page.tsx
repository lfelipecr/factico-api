import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const statusColors: Record<string, string> = {
  received: "bg-slate-100 text-slate-700",
  xml_created: "bg-blue-100 text-blue-800",
  signed: "bg-indigo-100 text-indigo-800",
  sent: "bg-amber-100 text-amber-800",
  processing: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  error: "bg-red-100 text-red-800",
};

export default async function DocumentsPage() {
  await requireAuth();
  const supabase = await createClient();

  const { data: docs } = await supabase
    .from("documents")
    .select("id, document_type, clave, consecutivo, status, environment, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-900">Comprobantes</h1>
      <p className="mt-1 text-sm text-slate-600">
        Historial procesado por el middleware (backup local).
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Clave</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Ambiente</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(docs ?? []).map((d) => (
              <tr key={d.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium">{d.document_type}</td>
                <td className="max-w-xs truncate px-4 py-3 font-mono text-xs">
                  {d.clave ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${statusColors[d.status] ?? "bg-slate-100"}`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-3">{d.environment}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(d.created_at).toLocaleString("es-CR")}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/documents/${d.id}`} className="text-brand-600 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!docs?.length && (
          <p className="p-8 text-center text-slate-500">
            Aún no hay comprobantes. Use la API de integración.
          </p>
        )}
      </div>
    </div>
  );
}
