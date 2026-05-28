import { generateApiKey } from "./auth.ts";
import { encryptField } from "./credentials.ts";
import { ensureSubscription } from "./documents.ts";
import { errorResponse, jsonResponse, parseJsonBody } from "./http.ts";
import { authenticatePanel, canAccessOrganization } from "./jwt.ts";
import { provisionOrganization, uploadCertificate } from "./provision.ts";
import { createServiceClient } from "./supabase.ts";
import type { Environment } from "./types.ts";

function provisionServiceKeyValid(req: Request): boolean {
  const expected = Deno.env.get("PROVISION_SERVICE_KEY");
  if (!expected) return false;
  return req.headers.get("X-Provision-Key") === expected;
}

/** POST /v1/admin/organizations/provision */
export async function handleProvision(req: Request): Promise<Response> {
  if (!provisionServiceKeyValid(req)) {
    const panel = await authenticatePanel(req, { roles: ["superadmin"] });
    if (panel instanceof Response) return panel;
  }

  const body = await parseJsonBody<{
    organization: { name: string; tax_id?: string };
    environment?: Environment;
    odoo_user: {
      usuario_nombre: string;
      codigo_identificacion: string;
      numero_identificacion: string;
      correo: string;
    };
    hacienda?: { usuario_hacienda?: string; contrasena_hacienda?: string };
    api_client_name?: string;
  }>(req);

  const result = await provisionOrganization({
    organization: body.organization,
    environment: body.environment ?? "staging",
    odoo_user: body.odoo_user,
    hacienda: body.hacienda,
    api_client_name: body.api_client_name,
  });

  return jsonResponse({
    ...result,
    warning:
      "Guarde api_key y factico_secret_key ahora; no se volverán a mostrar.",
  }, 201);
}

/** PUT /v1/admin/organizations/:id/credentials */
export async function handleUpsertCredentials(
  req: Request,
  organizationId: string,
): Promise<Response> {
  const panel = await authenticatePanel(req, {
    roles: ["superadmin", "admin", "implementer"],
  });
  if (panel instanceof Response) return panel;
  if (!canAccessOrganization(panel, organizationId)) {
    return errorResponse("Forbidden", 403, "forbidden");
  }

  const body = await parseJsonBody<{
    environment?: Environment;
    factico_secret_key?: string;
    hacienda_user?: string;
    hacienda_password?: string;
    certificate_code?: string;
    certificate_pin?: string;
  }>(req);

  const environment = body.environment ?? "staging";
  const supabase = createServiceClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.factico_secret_key) {
    patch.factico_secret_key_encrypted = encryptField(body.factico_secret_key);
  }
  if (body.hacienda_user) {
    patch.hacienda_user_encrypted = encryptField(body.hacienda_user);
  }
  if (body.hacienda_password) {
    patch.hacienda_password_encrypted = encryptField(body.hacienda_password);
  }
  if (body.certificate_code) patch.certificate_code = body.certificate_code;
  if (body.certificate_pin) {
    patch.certificate_pin_encrypted = encryptField(body.certificate_pin);
  }

  const { error } = await supabase.from("provider_credentials").upsert(
    { organization_id: organizationId, environment, ...patch },
    { onConflict: "organization_id,environment" },
  );

  if (error) {
    return errorResponse(error.message, 500, "db_error");
  }

  return jsonResponse({ organization_id: organizationId, environment, updated: true });
}

/** POST /v1/admin/organizations/:id/api-clients */
export async function handleCreateApiClient(
  req: Request,
  organizationId: string,
): Promise<Response> {
  const panel = await authenticatePanel(req, {
    roles: ["superadmin", "admin"],
  });
  if (panel instanceof Response) return panel;
  if (!canAccessOrganization(panel, organizationId)) {
    return errorResponse("Forbidden", 403, "forbidden");
  }

  const body = await parseJsonBody<{ name?: string }>(req);
  const { plainKey, prefix, hash } = await generateApiKey();
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("api_clients").insert({
    organization_id: organizationId,
    name: body.name ?? "Nueva integración",
    key_prefix: prefix,
    key_hash: hash,
    status: "active",
  }).select("id, name, created_at").single();

  if (error) {
    return errorResponse(error.message, 500, "db_error");
  }

  return jsonResponse({
    id: data!.id,
    name: data!.name,
    api_key: plainKey,
    warning: "Guarde la API key; no se volverá a mostrar.",
  }, 201);
}

/** POST /v1/admin/organizations/:id/certificate (multipart) */
export async function handleUploadCertificate(
  req: Request,
  organizationId: string,
): Promise<Response> {
  const panel = await authenticatePanel(req, {
    roles: ["superadmin", "admin", "implementer"],
  });
  if (panel instanceof Response) return panel;
  if (!canAccessOrganization(panel, organizationId)) {
    return errorResponse("Forbidden", 403, "forbidden");
  }

  const form = await req.formData();
  const file = form.get("archivo_p12");
  const pin = form.get("pin");
  const environment = (form.get("environment")?.toString() ?? "staging") as Environment;

  if (!(file instanceof File)) {
    return errorResponse("archivo_p12 file is required", 400, "validation_error");
  }
  if (!pin || typeof pin !== "string") {
    return errorResponse("pin is required", 400, "validation_error");
  }

  const result = await uploadCertificate(
    organizationId,
    environment,
    file,
    pin,
  );

  return jsonResponse({ organization_id: organizationId, ...result });
}

/** GET /v1/admin/organizations/me */
export async function handleOrganizationMe(req: Request): Promise<Response> {
  const panel = await authenticatePanel(req);
  if (panel instanceof Response) return panel;

  if (!panel.organizationId) {
    return errorResponse("User has no organization assigned", 404, "not_found");
  }

  const supabase = createServiceClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, tax_id, status, created_at")
    .eq("id", panel.organizationId)
    .single();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, plan_id")
    .eq("organization_id", panel.organizationId)
    .maybeSingle();

  return jsonResponse({
    user: {
      id: panel.userId,
      role: panel.role,
      full_name: panel.fullName,
    },
    organization: org,
    subscription,
  });
}

/** PATCH /v1/admin/profiles/link-organization — superadmin asigna org a usuario panel */
export async function handleLinkProfile(req: Request): Promise<Response> {
  const panel = await authenticatePanel(req, { roles: ["superadmin"] });
  if (panel instanceof Response) return panel;

  const body = await parseJsonBody<{
    user_id: string;
    organization_id: string;
    role?: string;
  }>(req);

  const supabase = createServiceClient();
  const { error } = await supabase.from("profiles").update({
    organization_id: body.organization_id,
    role: body.role ?? "admin",
  }).eq("id", body.user_id);

  if (error) {
    return errorResponse(error.message, 500, "db_error");
  }

  await ensureSubscription(supabase, body.organization_id);

  return jsonResponse({ linked: true });
}
