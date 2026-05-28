import { PlanEditor } from "@/components/PlanEditor";
import { requireRole } from "@/lib/auth";

export default async function NewPlanPage() {
  await requireRole(["superadmin"]);
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-900">Nuevo plan</h1>
      <div className="mt-6">
        <PlanEditor />
      </div>
    </div>
  );
}
