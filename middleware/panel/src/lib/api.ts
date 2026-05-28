import type { Environment } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? data?.message ?? res.statusText;
    throw new ApiError(msg, res.status, data?.error?.code);
  }
  return data as T;
}

export async function adminFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  return parseResponse<T>(res);
}

export interface ProvisionPayload {
  environment: Environment;
  organization: { name: string; tax_id?: string };
  odoo_user: {
    usuario_nombre: string;
    codigo_identificacion: string;
    numero_identificacion: string;
    correo: string;
  };
  hacienda?: { usuario_hacienda?: string; contrasena_hacienda?: string };
  api_client_name?: string;
}

export interface ProvisionResult {
  organization_id: string;
  factico_secret_key: string;
  api_key: string;
  odoo_state: string;
  odoo_user_reused?: boolean;
  warning?: string;
}

export function provisionOrganization(token: string, body: ProvisionPayload) {
  return adminFetch<ProvisionResult>("/v1/admin/organizations/provision", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function upsertCredentials(
  token: string,
  orgId: string,
  body: Record<string, unknown>,
) {
  return adminFetch(`/v1/admin/organizations/${orgId}/credentials`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function createApiClient(
  token: string,
  orgId: string,
  name: string,
) {
  return adminFetch<{ id: string; api_key: string; warning?: string }>(
    `/v1/admin/organizations/${orgId}/api-clients`,
    token,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export function uploadCertificate(
  token: string,
  orgId: string,
  form: FormData,
) {
  return adminFetch(`/v1/admin/organizations/${orgId}/certificate`, token, {
    method: "POST",
    body: form,
  });
}

export function getOrganizationMe(token: string) {
  return adminFetch<{
    user: { id: string; role: string; full_name: string | null };
    organization: { id: string; name: string; tax_id: string | null; status: string };
    subscription: { status: string; plan_id: string } | null;
  }>("/v1/admin/organizations/me", token);
}

export function linkProfile(
  token: string,
  body: { user_id: string; organization_id: string; role?: string },
) {
  return adminFetch("/v1/admin/profiles/link-organization", token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
