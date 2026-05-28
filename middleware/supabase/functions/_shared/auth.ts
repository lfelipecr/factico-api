import { createServiceClient } from "./supabase.ts";
import { ensureSubscription } from "./documents.ts";
import type { ApiContext, Environment } from "./types.ts";

const API_KEY_PREFIX = "fc_live_";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function extractApiKey(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return req.headers.get("X-Api-Key")?.trim() ?? null;
}

export function resolveEnvironment(req: Request): Environment {
  const header = req.headers.get("X-Environment")?.toLowerCase();
  if (header === "production" || header === "prod") return "production";
  const url = new URL(req.url);
  const q = url.searchParams.get("environment")?.toLowerCase();
  if (q === "production" || q === "prod") return "production";
  return "staging";
}

export async function authenticateApiKey(
  req: Request,
): Promise<ApiContext | Response> {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: { code: "unauthorized", message: "Missing API key" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return new Response(
      JSON.stringify({
        error: { code: "unauthorized", message: "Invalid API key format" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createServiceClient();
  const keyHash = await sha256Hex(apiKey);

  const { data: client, error } = await supabase
    .from("api_clients")
    .select("id, organization_id, status")
    .eq("key_hash", keyHash)
    .eq("status", "active")
    .maybeSingle();

  if (error || !client) {
    return new Response(
      JSON.stringify({
        error: { code: "unauthorized", message: "Invalid API key" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("id", client.organization_id)
    .single();

  if (!org || org.status === "suspended") {
    return new Response(
      JSON.stringify({
        error: { code: "forbidden", message: "Organization suspended" },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  await supabase
    .from("api_clients")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", client.id);

  await ensureSubscription(supabase, client.organization_id);

  return {
    organizationId: client.organization_id,
    apiClientId: client.id,
    environment: resolveEnvironment(req),
    supabase,
  };
}

/** Genera API key para almacenar (mostrar una sola vez al usuario). */
export async function generateApiKey(): Promise<{
  plainKey: string;
  prefix: string;
  hash: string;
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const secret = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plainKey = `${API_KEY_PREFIX}${secret}`;
  const hash = await sha256Hex(plainKey);
  return { plainKey, prefix: API_KEY_PREFIX, hash };
}
