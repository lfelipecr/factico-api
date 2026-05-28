import { callOdoo } from "./odoo.ts";
import type { Environment } from "./types.ts";

export function odooProvisionFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const key = Deno.env.get("PROVISION_SERVICE_KEY");
  if (!key) return fields;
  return { provision_key: key, ...fields };
}

export type OdooUserResolve = {
  secret_key: string;
  state: string;
  reused_existing: boolean;
};

/** Busca usuario API en Odoo por cédula; si no existe, lo registra. */
export async function resolveOdooApiUser(
  environment: Environment,
  odoo_user: {
    usuario_nombre: string;
    codigo_identificacion: string;
    numero_identificacion: string;
    correo: string;
  },
): Promise<OdooUserResolve> {
  const lookup = await callOdoo<{
    exists: boolean;
    secret_key?: string;
    state?: string;
  }>(environment, "/user_lookup", odooProvisionFields({
    codigo_identificacion: odoo_user.codigo_identificacion,
    numero_identificacion: odoo_user.numero_identificacion,
  }));

  if (lookup.response.exists && lookup.response.secret_key) {
    return {
      secret_key: lookup.response.secret_key,
      state: lookup.response.state ?? "approved",
      reused_existing: true,
    };
  }

  const registered = await callOdoo<{ secret_key: string; state: string }>(
    environment,
    "/user_register",
    odooProvisionFields({
      usuario_nombre: odoo_user.usuario_nombre,
      codigo_identificacion: odoo_user.codigo_identificacion,
      numero_identificacion: odoo_user.numero_identificacion,
      correo: odoo_user.correo,
    }),
  );

  return {
    secret_key: registered.response.secret_key,
    state: registered.response.state ?? "approved",
    reused_existing: false,
  };
}

export async function updateOdooApiUser(
  environment: Environment,
  fields: {
    secret_key: string;
    usuario_nombre?: string;
    correo?: string;
  },
): Promise<void> {
  await callOdoo(environment, "/user_update", odooProvisionFields({
    secret_key: fields.secret_key,
    usuario_nombre: fields.usuario_nombre,
    correo: fields.correo,
  }));
}
