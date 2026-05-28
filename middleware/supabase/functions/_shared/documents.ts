import type { ApiContext, Environment } from "./types.ts";

export async function createDocument(
  ctx: ApiContext,
  input: {
    documentType: string;
    clave?: string;
    consecutivo?: string;
    idempotencyKey?: string | null;
    originalRequest?: unknown;
  },
): Promise<{ id: string } | { existingId: string }> {
  if (input.idempotencyKey) {
    const { data: existing } = await ctx.supabase
      .from("documents")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (existing) {
      return { existingId: existing.id };
    }
  }

  const { data, error } = await ctx.supabase
    .from("documents")
    .insert({
      organization_id: ctx.organizationId,
      environment: ctx.environment,
      document_type: input.documentType,
      clave: input.clave,
      consecutivo: input.consecutivo,
      idempotency_key: input.idempotencyKey,
      status: "received",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create document");
  }

  if (input.originalRequest) {
    await ctx.supabase.from("document_payloads").insert({
      document_id: data.id,
      original_request_json: input.originalRequest,
    });
  }

  return { id: data.id };
}

export async function persistOdooStep(
  ctx: ApiContext,
  documentId: string,
  patch: {
    status?: string;
    clave?: string;
    consecutivo?: string;
    haciendaStatus?: string;
    facticoRequest?: unknown;
    facticoResponse?: unknown;
    xmlBase64?: string;
    signedXmlBase64?: string;
    haciendaResponseXmlBase64?: string;
  },
): Promise<void> {
  const docUpdate: Record<string, unknown> = {};
  if (patch.status) docUpdate.status = patch.status;
  if (patch.clave) docUpdate.clave = patch.clave;
  if (patch.consecutivo) docUpdate.consecutivo = patch.consecutivo;
  if (patch.haciendaStatus) docUpdate.hacienda_status = patch.haciendaStatus;

  if (Object.keys(docUpdate).length) {
    await ctx.supabase.from("documents").update(docUpdate).eq("id", documentId);
  }

  if (patch.facticoRequest || patch.facticoResponse) {
    await ctx.supabase.from("document_payloads").upsert(
      {
        document_id: documentId,
        factico_request_json: patch.facticoRequest,
        factico_response_json: patch.facticoResponse,
      },
      { onConflict: "document_id" },
    );
  }

  if (
    patch.xmlBase64 || patch.signedXmlBase64 || patch.haciendaResponseXmlBase64
  ) {
    await ctx.supabase.from("document_files").upsert(
      {
        document_id: documentId,
        xml_base64: patch.xmlBase64,
        signed_xml_base64: patch.signedXmlBase64,
        hacienda_response_xml_base64: patch.haciendaResponseXmlBase64,
      },
      { onConflict: "document_id" },
    );
  }
}

export async function ensureSubscription(
  supabase: ApiContext["supabase"],
  organizationId: string,
): Promise<void> {
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (data) return;

  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("name", "starter")
    .single();

  if (plan) {
    await supabase.from("subscriptions").insert({
      organization_id: organizationId,
      plan_id: plan.id,
      status: "active",
    });
  }
}
