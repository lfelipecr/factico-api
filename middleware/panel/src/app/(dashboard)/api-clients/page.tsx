import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApiClientsManager } from "./ApiClientsManager";
import Link from "next/link";

export default async function ApiClientsPage() {
  const { profile } = await requireRole(["superadmin", "admin"]);
  const supabase = await createClient();

  let orgId = profile.organization_id;
  if (!orgId && profile.role === "superadmin") {
    // superadmin sin org: muestra mensaje; para ver/crear keys debe vincularse a un tenant
  }

  const { data: clients } = orgId
    ? await supabase
        .from("api_clients")
        .select("id, name, key_prefix, status, last_used_at, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-900">API Keys</h1>
      <p className="mt-1 text-sm text-slate-600">
        Claves para que sistemas externos llamen al middleware.
      </p>

      {orgId ? (
        <ApiClientsManager organizationId={orgId} initialClients={clients ?? []} />
      ) : (
        <p className="mt-4 text-sm text-amber-700">
          Vincule una organización a su usuario (superadmin:{" "}
          <Link href="/users/link" className="underline">
            Vincular usuario
          </Link>
          ).
        </p>
      )}
    </div>
  );
}
