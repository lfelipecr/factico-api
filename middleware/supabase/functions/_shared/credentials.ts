import type { ApiContext, Environment, FacticoCredentials } from "./types.ts";

/** MVP: secret en texto con prefijo enc_ hasta integrar AES-GCM con CREDENTIALS_ENCRYPTION_KEY */
function decryptField(value: string | null): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("enc:")) {
    return value.slice(4);
  }
  return value;
}

export function encryptField(plain: string): string {
  return `enc:${plain}`;
}

export async function loadCredentials(
  ctx: ApiContext,
  environment?: Environment,
): Promise<FacticoCredentials | null> {
  const env = environment ?? ctx.environment;
  const { data, error } = await ctx.supabase
    .from("provider_credentials")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .eq("environment", env)
    .maybeSingle();

  if (error || !data?.factico_secret_key_encrypted) {
    return null;
  }

  return {
    facticoSecretKey: decryptField(data.factico_secret_key_encrypted)!,
    haciendaUser: decryptField(data.hacienda_user_encrypted),
    haciendaPassword: decryptField(data.hacienda_password_encrypted),
    certificateCode: data.certificate_code ?? undefined,
    certificatePin: decryptField(data.certificate_pin_encrypted),
  };
}
