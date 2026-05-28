import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";
import { redirect } from "next/navigation";

export async function getSessionProfile(): Promise<{
  profile: Profile;
  email: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    email: user.email ?? "",
    profile: profile as Profile,
  };
}

export async function requireAuth(): Promise<{
  profile: Profile;
  email: string;
}> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(roles: UserRole[]): Promise<{
  profile: Profile;
  email: string;
}> {
  const session = await requireAuth();
  if (!roles.includes(session.profile.role)) {
    redirect("/dashboard");
  }
  return session;
}

export { roleLabel } from "@/lib/labels";
