import { loadCredentials } from "./credentials.ts";
import { createDocument, persistOdooStep } from "./documents.ts";
import { callOdoo } from "./odoo.ts";
import { enforceQuota } from "./quota.ts";
import type { ApiContext } from "./types.ts";

/**
 * Flujo FE completo: xml → sign → send (generate_key opcional si no hay clave).
 */
export async function processInvoice(
  ctx: ApiContext,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const creds = await loadCredentials(ctx);
  if (!creds?.certificateCode || !creds.certificatePin) {
    throw new Error("Certificate not configured for this organization");
  }
  if (!creds.haciendaUser || !creds.haciendaPassword) {
    throw new Error("Hacienda credentials not configured");
  }

  let clave = body.clave as string | undefined;
  let consecutivo = body.consecutivo as string | undefined;
  const tipo = String(body.tipo_documento ?? "FE");

  if (!clave || !consecutivo) {
    const quota = await enforceQuota(ctx, "generate_key");
    if (quota) throw new Error("Quota exceeded: generate_key");

    const keyRes = await callOdoo<{ clave: string; consecutivo: string }>(
      ctx.environment,
      "/generate_key",
      {
        secret_key: creds.facticoSecretKey,
        sucursal: body.sucursal,
        terminal: body.terminal,
        secuencia: body.secuencia,
        tipo_documento: tipo,
        numero_identificacion: body.numero_identificacion,
        situacion: body.situacion ?? "normal",
        codigo_pais: body.codigo_pais ?? "506",
        fecha_emision: body.fecha_emision,
      },
    );
    clave = keyRes.response.clave;
    consecutivo = keyRes.response.consecutivo;
    body.clave = clave;
    body.consecutivo = consecutivo;
  }

  const doc = await createDocument(ctx, {
    documentType: tipo,
    clave,
    consecutivo,
    idempotencyKey: (body.idempotency_key as string) ?? null,
    originalRequest: body,
  });
  const documentId = "id" in doc ? doc.id : doc.existingId;

  const xmlQuota = await enforceQuota(ctx, "xml_invoice");
  if (xmlQuota) throw new Error("Quota exceeded: xml_invoice");

  const xmlFields = { secret_key: creds.facticoSecretKey, ...body };
  const xmlRes = await callOdoo<{ xml: string; clave: string; consecutivo: string }>(
    ctx.environment,
    "/xml_invoice",
    xmlFields,
  );

  await persistOdooStep(ctx, documentId, {
    status: "xml_created",
    clave: xmlRes.response.clave,
    consecutivo: xmlRes.response.consecutivo,
    xmlBase64: xmlRes.response.xml,
    facticoResponse: xmlRes,
  });

  const signQuota = await enforceQuota(ctx, "xml_sign");
  if (signQuota) throw new Error("Quota exceeded: xml_sign");

  const signRes = await callOdoo<{ comprobante_xml_firmado: string }>(
    ctx.environment,
    "/xml_sign",
    {
      secret_key: creds.facticoSecretKey,
      codigo_certificado: creds.certificateCode,
      comprobante_xml: xmlRes.response.xml,
      pin: creds.certificatePin,
    },
  );

  await persistOdooStep(ctx, documentId, {
    status: "signed",
    signedXmlBase64: signRes.response.comprobante_xml_firmado,
  });

  const sendQuota = await enforceQuota(ctx, "send_hacienda");
  if (sendQuota) throw new Error("Quota exceeded: send_hacienda");

  const sendRes = await callOdoo<{
    codigo_estado: number;
    estado: string;
    mensaje: string;
  }>(ctx.environment, "/send_hacienda", {
    secret_key: creds.facticoSecretKey,
    usuario_hacienda: creds.haciendaUser,
    contrasena_hacienda: creds.haciendaPassword,
    clave: xmlRes.response.clave,
    fecha: body.fecha,
    emisor_tipo_identificacion: body.emisor_tipo_identificacion,
    emisor_numero_identificacion: body.emisor_numero_identificacion,
    receptor_tipo_identificacion: body.receptor_tipo_identificacion,
    receptor_numero_identificacion: body.receptor_numero_identificacion,
    comprobante_xml_firmado: signRes.response.comprobante_xml_firmado,
  });

  await persistOdooStep(ctx, documentId, {
    status: "sent",
    haciendaStatus: sendRes.response.estado,
    facticoResponse: sendRes,
  });

  return {
    document_id: documentId,
    clave: xmlRes.response.clave,
    consecutivo: xmlRes.response.consecutivo,
    xml: xmlRes.response.xml,
    comprobante_xml_firmado: signRes.response.comprobante_xml_firmado,
    hacienda: sendRes.response,
  };
}
