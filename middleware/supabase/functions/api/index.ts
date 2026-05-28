import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  handleCreateApiClient,
  handleLinkProfile,
  handleOrganizationMe,
  handleProvision,
  handleUploadCertificate,
  handleUpsertCredentials,
} from "../_shared/admin-routes.ts";
import { authenticateApiKey } from "../_shared/auth.ts";
import { handleOptions } from "../_shared/cors.ts";
import { routeDocuments } from "../_shared/document-routes.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { odooBaseUrl } from "../_shared/odoo.ts";

function normalizePath(req: Request): string {
  const url = new URL(req.url);
  let path = url.pathname
    .replace(/^\/functions\/v1\/api/, "")
    .replace(/^\/api/, "")
    .replace(/\/$/, "");
  return path || "/v1/health";
}

serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const path = normalizePath(req);

    if (path === "/v1/health" && req.method === "GET") {
      return jsonResponse({
        status: "ok",
        odoo_base_url: odooBaseUrl(),
        timestamp: new Date().toISOString(),
      });
    }

    // --- Rutas admin (JWT Supabase o X-Provision-Key) ---
    if (path === "/v1/admin/organizations/provision" && req.method === "POST") {
      return await handleProvision(req);
    }

    if (path === "/v1/admin/organizations/me" && req.method === "GET") {
      return await handleOrganizationMe(req);
    }

    if (path === "/v1/admin/profiles/link-organization" && req.method === "PATCH") {
      return await handleLinkProfile(req);
    }

    const orgCredMatch = path.match(
      /^\/v1\/admin\/organizations\/([^/]+)\/credentials$/,
    );
    if (orgCredMatch && req.method === "PUT") {
      return await handleUpsertCredentials(req, orgCredMatch[1]);
    }

    const orgClientMatch = path.match(
      /^\/v1\/admin\/organizations\/([^/]+)\/api-clients$/,
    );
    if (orgClientMatch && req.method === "POST") {
      return await handleCreateApiClient(req, orgClientMatch[1]);
    }

    const orgCertMatch = path.match(
      /^\/v1\/admin\/organizations\/([^/]+)\/certificate$/,
    );
    if (orgCertMatch && req.method === "POST") {
      return await handleUploadCertificate(req, orgCertMatch[1]);
    }

    // --- Rutas integradores (API key) ---
    const auth = await authenticateApiKey(req);
    if (auth instanceof Response) return auth;

    const docResponse = await routeDocuments(req, path, auth);
    if (docResponse) return docResponse;

    return errorResponse(`Route not found: ${req.method} ${path}`, 404, "not_found");
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, 500, "internal_error");
  }
});
