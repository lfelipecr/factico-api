import type { UsageRow } from "@/lib/usage";

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function barColor(used: number, limit: number): string {
  if (limit <= 0) return "bg-slate-400";
  const p = used / limit;
  if (p >= 1) return "bg-red-500";
  if (p >= 0.8) return "bg-amber-500";
  return "bg-brand-600";
}

export function UsageMeters({
  rows,
  periodStart,
  periodEnd,
  planName,
}: {
  rows: UsageRow[];
  periodStart: string;
  periodEnd: string;
  planName?: string | null;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-slate-500">
        Sin límites de plan configurados para este tenant.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Periodo{" "}
        <span className="font-medium text-slate-800">
          {periodStart} — {periodEnd}
        </span>
        {planName ? (
          <>
            {" "}
            · Plan <span className="font-medium text-brand-700">{planName}</span>
          </>
        ) : null}
      </p>
      <ul className="space-y-3">
        {rows.map((row) => {
          const unlimited = row.limit < 0;
          const displayLimit = unlimited ? "∞" : String(row.limit);
          const width = unlimited ? (row.used > 0 ? 8 : 0) : pct(row.used, row.limit);

          return (
            <li key={row.resource}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">{row.label}</span>
                <span className="tabular-nums text-slate-600">
                  {row.used} / {displayLimit}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${barColor(row.used, row.limit)}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
