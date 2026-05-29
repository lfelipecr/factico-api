import { generateApiKey } from "./auth.ts";
import { encryptField } from "./credentials.ts";
import { ensureSubscription } from "./documents.ts";
import { callOdooMultipart } from "./odoo.ts";
import { resolveOdooApiUser } from "./odoo-provision.ts";
import { createServiceClient } from "./supabase.ts";
import type { Environment } from "./types.ts";

export interface ProvisionInput {
  organization: { name: string; tax_id?: string };
  environment: Environment;
  odoo_user: {
    usuario_nombre: string;
    codigo_identificacion: string;
    numero_identificacion: string;
    correo: string;
  };
  hacienda?: {
    usuario_hacienda?: string;
    contrasena_hacienda?: string;
  };
  api_client_name?: string;
}

export interface ProvisionResult {
  organization_id: string;
  factico_secret_key: string;
  api_key: string;
  odoo_state: string;
  odoo_user_reused: boolean;
}

export async function provisionOrganization(
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const supabase = createServiceClient();

  const idNum = input.odoo_user.numero_identificacion.trim();
  const taxId = (input.organization.tax_id ?? "").trim();

  const { data: existingCred } = await supabase
    .from("provider_credentials")
    .select("organization_id")
    .eq("environment", input.environment)
    .eq("odoo_user_ref", idNum)
    .maybeSingle();

  if (existingCred) {
    throw new Error(
      `Ya existe un tenant (${existingCred.organization_id}) con la cédula ${idNum} en ${input.environment}`,
    );
  }

  if (taxId) {
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("tax_id", taxId)
      .maybeSingle();
    if (existingOrg) {
      throw new Error(
        `Ya existe una organización con tax_id ${taxId} (${existingOrg.id})`,
      );
    }
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: input.organization.name,
      tax_id: input.organization.tax_id ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(orgError?.message ?? "Failed to create organization");
  }

  await ensureSubscription(supabase, org.id);

  const odooUser = await resolveOdooApiUser(input.environment, input.odoo_user);
  const facticoSecret = odooUser.secret_key;

  const { error: credError } = await supabase.from("provider_credentials").insert({
    organization_id: org.id,
    environment: input.environment,
    factico_secret_key_encrypted: encryptField(facticoSecret),
    hacienda_user_encrypted: input.hacienda?.usuario_hacienda
      ? encryptField(input.hacienda.usuario_hacienda)
      : null,
    hacienda_password_encrypted: input.hacienda?.contrasena_hacienda
      ? encryptField(input.hacienda.contrasena_hacienda)
      : null,
    odoo_user_ref: input.odoo_user.numero_identificacion,
  });

  if (credError) {
    throw new Error(credError.message);
  }

  const { plainKey, prefix, hash } = await generateApiKey();
  const { error: clientError } = await supabase.from("api_clients").insert({
    organization_id: org.id,
    name: input.api_client_name ?? "Integración principal",
    key_prefix: prefix,
    key_hash: hash,
    status: "active",
  });

  if (clientError) {
    throw new Error(clientError.message);
  }

  await supabase.from("audit_logs").insert({
    organization_id: org.id,
    action: "organization.provisioned",
    entity: "organizations",
    entity_id: org.id,
    metadata: {
      environment: input.environment,
      odoo_user: input.odoo_user.usuario_nombre,
      odoo_user_reused: odooUser.reused_existing,
    },
  });

  return {
    organization_id: org.id,
    factico_secret_key: facticoSecret,
    api_key: plainKey,
    odoo_state: odooUser.state,
    odoo_user_reused: odooUser.reused_existing,
  };
}

export async function uploadCertificate(
  organizationId: string,
  environment: Environment,
  file: File,
  pin: string,
): Promise<{ codigo_certificado: string; nombre_certificado: string }> {
  const supabase = createServiceClient();

  const { data: creds } = await supabase
    .from("provider_credentials")
    .select("factico_secret_key_encrypted")
    .eq("organization_id", organizationId)
    .eq("environment", environment)
    .single();

  if (!creds?.factico_secret_key_encrypted) {
    throw new Error("Organization credentials not found");
  }

  const secretKey = creds.factico_secret_key_encrypted.startsWith("enc:")
    ? creds.factico_secret_key_encrypted.slice(4)
    : creds.factico_secret_key_encrypted;

  const form = new FormData();
  form.append("secret_key", secretKey);
  form.append("archivo_p12", file, file.name);
  form.append("reemplazar", "1");

  const odooRes = await callOdooMultipart<{
    codigo_certificado: string;
    nombre_certificado: string;
  }>(environment, "/certified_upload", form);

  await supabase
    .from("provider_credentials")
    .update({
      certificate_code: odooRes.response.codigo_certificado,
      certificate_pin_encrypted: encryptField(pin),
    })
    .eq("organization_id", organizationId)
    .eq("environment", environment);

  return odooRes.response;
}
