export type Environment = "staging" | "production";
export type UserRole = "superadmin" | "admin" | "implementer" | "client";

export interface ApiContext {
  organizationId: string;
  apiClientId?: string;
  environment: Environment;
  supabase: ReturnType<typeof import("./supabase.ts").createServiceClient>;
}

export interface OdooResponse<T = unknown> {
  status_code: number;
  response: T;
}

export interface OdooErrorBody {
  type?: string;
  status_code: number;
  response: string;
}

export interface FacticoCredentials {
  facticoSecretKey: string;
  haciendaUser?: string;
  haciendaPassword?: string;
  certificateCode?: string;
  certificatePin?: string;
}
