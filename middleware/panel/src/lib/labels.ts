import type { UserRole } from "@/lib/types";

export function roleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    superadmin: "Superadmin",
    admin: "Administrador",
    implementer: "Implementador",
    client: "Cliente",
  };
  return map[role];
}
