import { Sidebar } from "@/components/Sidebar";
import { requireAuth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireAuth();

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} email={email} />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
