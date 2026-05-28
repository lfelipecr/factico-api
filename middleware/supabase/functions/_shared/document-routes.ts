import { loadCredentials } from "./credentials.ts";
import { createDocument, persistOdooStep } from "./documents.ts";
import { errorResponse, jsonResponse, parseJsonBody } from "./http.ts";
import { callOdoo } from "./odoo.ts";
import { processInvoice } from "./process.ts";
import { enforceQuota } from "./quota.ts";
import type { ApiContext } from "./types.ts";

export async function routeDocuments(
  req: Request,
  path: string,
  ctx: ApiContext,
): Promise<Response | null> {
  const creds = await loadCredentials(ctx);
  if (!creds) {
    return errorResponse(
      "Provider credentials not configured",
      412,
      "credentials_missing",
    );
  }

  if (path === "/v1/documents/process" && req.method === "POST") {
    try {
      const body = await parseJsonBody<Record<string, unknown>>(req);
      const result = await processInvoice(ctx, body);
      return jsonResponse(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Process failed";
      const status = msg.includes("Quota") ? 429 : 500;
      return errorResponse(msg, status, "process_error");
    }
  }

  if (path === "/v1/documents/key" && req.method === "POST") {
    const quota = await enforceQuota(ctx, "generate_key");
    if (quota) return quota;
    const body = await parseJsonBody<Record<string, string>>(req);
    const odooRes = await callOdoo<{ consecutivo: string; clave: string }>(
      ctx.environment,
      "/generate_key",
      { secret_key: creds.facticoSecretKey, ...body },
    );
    const doc = await createDocument(ctx, {
      documentType: body.tipo_documento ?? "FE",
      clave: odooRes.response.clave,
      consecutivo: odooRes.response.consecutivo,
      idempotencyKey: req.headers.get("Idempotency-Key"),
      originalRequest: body,
    });
    const documentId = "id" in doc ? doc.id : doc.existingId;
    await persistOdooStep(ctx, documentId, {
      status: "received",
      facticoResponse: odooRes,
    });
    return jsonResponse({ document_id: documentId, ...odooRes.response });
  }

  if (path === "/v1/documents/xml" && req.method === "POST") {
    const quota = await enforceQuota(ctx, "xml_invoice");
    if (quota) return quota;
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const tipo = String(body.tipo_documento ?? "FE");
    const doc = await createDocument(ctx, {
      documentType: tipo,
      clave: body.clave as string | undefined,
      consecutivo: body.consecutivo as string | undefined,
      idempotencyKey: req.headers.get("Idempotency-Key"),
      originalRequest: body,
    });
    const documentId = "id" in doc ? doc.id : doc.existingId;
    // No reenviar campos solo de send_hacienda/process al XML de Odoo
    const {
      fecha: _fecha,
      emisor_numero_identificacion: _emiNum,
      idempotency_key: _idem,
      ...xmlBody
    } = body;
    const odooFields = { secret_key: creds.facticoSecretKey, ...xmlBody };
    const odooRes = await callOdoo<{ consecutivo: string; clave: string; xml: string }>(
      ctx.environment,
      "/xml_invoice",
      odooFields,
    );
    await persistOdooStep(ctx, documentId, {
      status: "xml_created",
      clave: odooRes.response.clave,
      consecutivo: odooRes.response.consecutivo,
      xmlBase64: odooRes.response.xml,
      facticoResponse: odooRes,
    });
    return jsonResponse({ document_id: documentId, ...odooRes.response });
  }

  if (path === "/v1/documents/sign" && req.method === "POST") {
    const quota = await enforceQuota(ctx, "xml_sign");
    if (quota) return quota;
    const body = await parseJsonBody<{ document_id?: string; comprobante_xml: string }>(req);
    const odooRes = await callOdoo<{ comprobante_xml_firmado: string }>(
      ctx.environment,
      "/xml_sign",
      {
        secret_key: creds.facticoSecretKey,
        codigo_certificado: creds.certificateCode,
        comprobante_xml: body.comprobante_xml,
        pin: creds.certificatePin,
      },
    );
    if (body.document_id) {
      await persistOdooStep(ctx, body.document_id, {
        status: "signed",
        signedXmlBase64: odooRes.response.comprobante_xml_firmado,
      });
    }
    return jsonResponse({
      document_id: body.document_id,
      comprobante_xml_firmado: odooRes.response.comprobante_xml_firmado,
    });
  }

  if (path === "/v1/documents/send" && req.method === "POST") {
    const quota = await enforceQuota(ctx, "send_hacienda");
    if (quota) return quota;
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const odooRes = await callOdoo<{ codigo_estado: number; estado: string; mensaje: string }>(
      ctx.environment,
      "/send_hacienda",
      {
        secret_key: creds.facticoSecretKey,
        usuario_hacienda: body.usuario_hacienda ?? creds.haciendaUser,
        contrasena_hacienda: body.contrasena_hacienda ?? creds.haciendaPassword,
        ...body,
      },
    );
    const documentId = body.document_id as string | undefined;
    if (documentId) {
      await persistOdooStep(ctx, documentId, {
        status: "sent",
        haciendaStatus: odooRes.response.estado,
        facticoResponse: odooRes,
      });
    }
    return jsonResponse({ document_id: documentId, ...odooRes.response });
  }

  const downloadMatch = path.match(
    /^\/v1\/documents\/([^/]+)\/download\/(xml|signed|response)$/,
  );
  if (downloadMatch && req.method === "GET") {
    const [, documentId, kind] = downloadMatch;
    const { data: files } = await ctx.supabase
      .from("document_files")
      .select("xml_base64, signed_xml_base64, hacienda_response_xml_base64")
      .eq("document_id", documentId)
      .single();

    const { data: doc } = await ctx.supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .eq("organization_id", ctx.organizationId)
      .single();

    if (!doc || !files) {
      return errorResponse("Document not found", 404, "not_found");
    }

    const fieldMap = {
      xml: files.xml_base64,
      signed: files.signed_xml_base64,
      response: files.hacienda_response_xml_base64,
    } as const;
    const content = fieldMap[kind as keyof typeof fieldMap];
    if (!content) {
      return errorResponse(`No ${kind} file stored`, 404, "not_found");
    }

    return jsonResponse({ document_id: documentId, kind, content_base64: content });
  }

  const statusMatch = path.match(/^\/v1\/documents\/([^/]+)\/status$/);
  if (statusMatch && req.method === "GET") {
    const documentId = statusMatch[1];
    const quota = await enforceQuota(ctx, "consult_hacienda");
    if (quota) return quota;

    const { data: doc } = await ctx.supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("organization_id", ctx.organizationId)
      .single();

    if (!doc?.clave) {
      return errorResponse("Document not found", 404, "not_found");
    }

    const odooRes = await callOdoo<{
      codigo_estado: number;
      estado: string;
      mensaje: string;
      clave: string;
      respuesta_xml: string;
    }>(ctx.environment, "/consult_hacienda", {
      secret_key: creds.facticoSecretKey,
      usuario_hacienda: creds.haciendaUser,
      contrasena_hacienda: creds.haciendaPassword,
      clave: doc.clave,
    }, "GET");

    let status = doc.status;
    const est = odooRes.response.estado?.toLowerCase();
    if (est === "aceptado") status = "accepted";
    else if (est === "rechazado") status = "rejected";
    else if (odooRes.response.estado === "Procesando") status = "processing";

    await persistOdooStep(ctx, documentId, {
      status,
      haciendaStatus: odooRes.response.estado,
      haciendaResponseXmlBase64: odooRes.response.respuesta_xml,
    });

    return jsonResponse({
      document_id: documentId,
      local_status: status,
      ...odooRes.response,
    });
  }

  return null;
}
