export type UserRole = "superadmin" | "admin" | "implementer" | "client";

export type Environment = "staging" | "production";

export interface Profile {
  id: string;
  organization_id: string | null;
  role: UserRole;
  full_name: string | null;
}

export interface Organization {
  id: string;
  name: string;
  tax_id: string | null;
  status: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  organization_id: string;
  environment: Environment;
  document_type: string;
  clave: string | null;
  consecutivo: string | null;
  status: string;
  hacienda_status: string | null;
  created_at: string;
}

export interface ApiClientRow {
  id: string;
  name: string;
  key_prefix: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
}
