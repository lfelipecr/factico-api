import Link from "next/link";
import type { Profile, UserRole } from "@/lib/types";
import { roleLabel } from "@/lib/labels";

const links: { href: string; label: string; roles?: UserRole[] }[] = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/documents", label: "Comprobantes" },
  { href: "/credentials", label: "Credenciales", roles: ["superadmin", "admin", "implementer"] },
  { href: "/certificate", label: "Certificado", roles: ["superadmin", "admin", "implementer"] },
  { href: "/api-clients", label: "API Keys", roles: ["superadmin", "admin"] },
  { href: "/organizations", label: "Organizaciones", roles: ["superadmin"] },
  { href: "/plans", label: "Planes", roles: ["superadmin"] },
  { href: "/organizations/new", label: "Nuevo tenant", roles: ["superadmin"] },
  { href: "/users/link", label: "Vincular usuario", roles: ["superadmin"] },
];

export function Sidebar({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const visible = links.filter(
    (l) => !l.roles || l.roles.includes(profile.role),
  );

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-lg font-semibold text-brand-900">Fáctico</p>
        <p className="text-xs text-slate-500">Middleware SaaS</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {visible.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4 text-xs text-slate-600">
        <p className="font-medium text-slate-800">{profile.full_name ?? email}</p>
        <p>{roleLabel(profile.role)}</p>
        <form action="/auth/signout" method="post" className="mt-3">
          <button
            type="submit"
            className="text-brand-600 hover:underline"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
