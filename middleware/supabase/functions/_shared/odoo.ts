import type { Environment, OdooErrorBody, OdooResponse } from "./types.ts";

const ODOO_PATHS = {
  staging: "/cr_api-staging",
  production: "/cr_api",
} as const;

export function odooBaseUrl(): string {
  const base = Deno.env.get("ODOO_BASE_URL") ?? "https://api.kibuinc.com";
  return base.replace(/\/$/, "");
}

export function odooPath(environment: Environment, endpoint: string): string {
  const prefix = ODOO_PATHS[environment];
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${odooBaseUrl()}${prefix}${path}`;
}

/** Quita null/undefined antes de serializar listas/dicts para Odoo (ast.literal_eval no acepta null). */
function sanitizeForOdoo(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForOdoo(item)).filter((item) => item !== undefined);
  }
  if (typeof value === "object" && !(value instanceof Blob)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const clean = sanitizeForOdoo(v);
      if (clean !== undefined) out[k] = clean;
    }
    return out;
  }
  return value;
}

/** Convierte un objeto plano (y valores anidados serializados) a FormData para Odoo. */
export function toFormData(
  data: Record<string, unknown>,
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && !(value instanceof Blob)) {
      form.append(key, JSON.stringify(sanitizeForOdoo(value)));
    } else {
      form.append(key, String(value));
    }
  }
  return form;
}

export async function callOdoo<T>(
  environment: Environment,
  endpoint: string,
  fields: Record<string, unknown>,
  method: "GET" | "POST" = "POST",
): Promise<OdooResponse<T>> {
  const url = odooPath(environment, endpoint);

  let response: Response;
  if (method === "GET") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) {
      if (v != null) params.set(k, String(v));
    }
    const qs = params.toString();
    response = await fetch(qs ? `${url}?${qs}` : url, { method: "GET" });
  } else {
    response = await fetch(url, {
      method: "POST",
      body: toFormData(fields),
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    const snippet = text.slice(0, 300).replace(/\s+/g, " ").trim();
    throw new Error(
      `Odoo non-JSON response (${response.status}) from ${endpoint}: ${snippet}`,
    );
  }

  const raw = await response.json() as OdooResponse<T> | OdooErrorBody;

  if ("type" in raw && raw.type === "Error") {
    const err = new Error(
      typeof raw.response === "string" ? raw.response : "Odoo API error",
    );
    (err as Error & { odoo: OdooErrorBody }).odoo = raw;
    throw err;
  }

  if (raw.status_code && raw.status_code >= 400) {
    throw new Error(
      typeof raw.response === "string"
        ? raw.response
        : `Odoo returned status ${raw.status_code}`,
    );
  }

  return raw as OdooResponse<T>;
}

export async function callOdooMultipart<T>(
  environment: Environment,
  endpoint: string,
  form: FormData,
): Promise<OdooResponse<T>> {
  const url = odooPath(environment, endpoint);
  const response = await fetch(url, { method: "POST", body: form });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    const snippet = text.slice(0, 300).replace(/\s+/g, " ").trim();
    throw new Error(
      `Odoo non-JSON response (${response.status}) from ${endpoint}: ${snippet}`,
    );
  }

  const raw = await response.json() as OdooResponse<T> | OdooErrorBody;

  if ("type" in raw && raw.type === "Error") {
    throw new Error(
      typeof raw.response === "string" ? raw.response : "Odoo API error",
    );
  }

  return raw as OdooResponse<T>;
}
