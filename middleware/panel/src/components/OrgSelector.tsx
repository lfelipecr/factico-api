"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

type Org = { id: string; name: string };

export function OrgSelector({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (orgId: string) => void;
  disabled?: boolean;
}) {
  const [orgs, setOrgs] = useState<Org[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("organizations")
      .select("id, name")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrgs((data as Org[]) ?? []));
  }, []);

  const options = useMemo(() => orgs, [orgs]);

  return (
    <label className="block text-sm font-medium text-slate-700">
      Tenant
      <select
        className="field"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="" disabled>
          Selecciona un tenant…
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

