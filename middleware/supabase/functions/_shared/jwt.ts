import { createServiceClient } from "./supabase.ts";
import type { UserRole } from "./types.ts";

export interface PanelUser {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  fullName: string | null;
}

export async function authenticatePanel(
  req: Request,
  options?: { roles?: UserRole[] },
): Promise<PanelUser | Response> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return new Response(
      JSON.stringify({ error: { code: "unauthorized", message: "Missing JWT" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return new Response(
      JSON.stringify({ error: { code: "unauthorized", message: "Invalid JWT" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, organization_id, full_name")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({
        error: { code: "forbidden", message: "User profile not found" },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const panelUser: PanelUser = {
    userId: userData.user.id,
    role: profile.role as UserRole,
    organizationId: profile.organization_id,
    fullName: profile.full_name,
  };

  if (options?.roles && !options.roles.includes(panelUser.role)) {
    return new Response(
      JSON.stringify({ error: { code: "forbidden", message: "Insufficient role" } }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  return panelUser;
}

export function canAccessOrganization(
  panel: PanelUser,
  organizationId: string,
): boolean {
  if (panel.role === "superadmin") return true;
  return panel.organizationId === organizationId;
}
