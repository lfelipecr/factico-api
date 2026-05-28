import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { XmlDownload } from "@/components/XmlDownload";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (!doc) notFound();

  const { data: files } = await supabase
    .from("document_files")
    .select("xml_base64, signed_xml_base64, hacienda_response_xml_base64")
    .eq("document_id", id)
    .maybeSingle();

  const { data: payload } = await supabase
    .from("document_payloads")
    .select("original_request_json, factico_response_json, hacienda_response_json")
    .eq("document_id", id)
    .maybeSingle();

  return (
    <div className="max-w-4xl">
      <Link href="/documents" className="text-sm text-brand-600 hover:underline">
        ← Comprobantes
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-brand-900">
        {doc.document_type} — {doc.status}
      </h1>

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <div>
          <dt className="text-slate-500">Clave</dt>
          <dd className="break-all font-mono text-xs">{doc.clave ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Consecutivo</dt>
          <dd>{doc.consecutivo ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Hacienda</dt>
          <dd>{doc.hacienda_status ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Ambiente</dt>
          <dd>{doc.environment}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <XmlDownload
          label="XML generado"
          base64={files?.xml_base64}
          filename={`${doc.document_type}-${doc.clave ?? id}.xml`}
        />
        <XmlDownload
          label="XML firmado"
          base64={files?.signed_xml_base64}
          filename={`${doc.document_type}-${doc.clave ?? id}-firmado.xml`}
        />
        <XmlDownload
          label="Respuesta Hacienda"
          base64={files?.hacienda_response_xml_base64}
          filename={`respuesta-${doc.clave ?? id}.xml`}
        />
        {!files && (
          <p className="text-sm text-slate-500">Sin archivos XML almacenados aún.</p>
        )}
      </div>

      {payload?.original_request_json && (
        <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Request original (JSON)
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto text-xs">
            {JSON.stringify(payload.original_request_json, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
