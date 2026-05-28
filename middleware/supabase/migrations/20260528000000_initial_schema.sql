-- Fáctico Middleware — esquema multi-tenant inicial

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM (
  'superadmin',
  'admin',
  'implementer',
  'client'
);

CREATE TYPE public.org_status AS ENUM ('active', 'suspended', 'trial');

CREATE TYPE public.environment AS ENUM ('staging', 'production');

CREATE TYPE public.document_status AS ENUM (
  'received',
  'xml_created',
  'signed',
  'sent',
  'processing',
  'accepted',
  'rejected',
  'error',
  'cancelled'
);

CREATE TYPE public.quota_period AS ENUM ('monthly', 'daily', 'lifetime');

-- ---------------------------------------------------------------------------
-- Organizations (tenants)
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT,
  status public.org_status NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Perfil ligado a auth.users (panel)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations (id) ON DELETE SET NULL,
  role public.user_role NOT NULL DEFAULT 'client',
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Planes y suscripciones
-- ---------------------------------------------------------------------------
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  monthly_price NUMERIC(12, 2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  limit_count INTEGER NOT NULL DEFAULT 0,
  period public.quota_period NOT NULL DEFAULT 'monthly',
  hard_limit BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (plan_id, resource, period)
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans (id),
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- ---------------------------------------------------------------------------
-- API keys (integradores)
-- ---------------------------------------------------------------------------
CREATE TABLE public.api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  allowed_ips TEXT[],
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_clients_key_hash ON public.api_clients (key_hash);

-- ---------------------------------------------------------------------------
-- Credenciales hacia Odoo / Hacienda (cifradas en app layer)
-- ---------------------------------------------------------------------------
CREATE TABLE public.provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  environment public.environment NOT NULL DEFAULT 'staging',
  factico_secret_key_encrypted TEXT,
  hacienda_user_encrypted TEXT,
  hacienda_password_encrypted TEXT,
  certificate_code TEXT,
  certificate_pin_encrypted TEXT,
  odoo_user_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, environment)
);

-- ---------------------------------------------------------------------------
-- Documentos y respaldos
-- ---------------------------------------------------------------------------
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  environment public.environment NOT NULL DEFAULT 'staging',
  document_type TEXT NOT NULL,
  clave TEXT,
  consecutivo TEXT,
  status public.document_status NOT NULL DEFAULT 'received',
  hacienda_status TEXT,
  total_amount NUMERIC(18, 5),
  currency_code TEXT DEFAULT 'CRC',
  issued_at TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX idx_documents_org_clave ON public.documents (organization_id, clave);

CREATE TABLE public.document_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL UNIQUE REFERENCES public.documents (id) ON DELETE CASCADE,
  original_request_json JSONB,
  factico_request_json JSONB,
  factico_response_json JSONB,
  hacienda_response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL UNIQUE REFERENCES public.documents (id) ON DELETE CASCADE,
  xml_base64 TEXT,
  signed_xml_base64 TEXT,
  hacienda_response_xml_base64 TEXT,
  storage_path TEXT,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Cuotas y auditoría
-- ---------------------------------------------------------------------------
CREATE TABLE public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (organization_id, resource, period_start)
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations (id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  api_client_id UUID REFERENCES public.api_clients (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  ip INET,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Plan por defecto + límites de ejemplo
-- ---------------------------------------------------------------------------
INSERT INTO public.plans (name, description, monthly_price) VALUES
  ('starter', 'Plan inicial middleware', 0);

INSERT INTO public.plan_limits (plan_id, resource, limit_count, period, hard_limit)
SELECT p.id, r.resource, r.limit_count, 'monthly', true
FROM public.plans p
CROSS JOIN (VALUES
  ('generate_key', 1000),
  ('xml_invoice', 1000),
  ('xml_sign', 1000),
  ('send_hacienda', 1000),
  ('consult_hacienda', 5000)
) AS r(resource, limit_count)
WHERE p.name = 'starter';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_provider_credentials_updated BEFORE UPDATE ON public.provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Cuota: incremento atómico
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
  p_organization_id UUID,
  p_resource TEXT,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
  v_hard BOOLEAN;
BEGIN
  SELECT pl.limit_count, pl.hard_limit INTO v_limit, v_hard
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan_id = s.plan_id
  WHERE s.organization_id = p_organization_id
    AND s.status = 'active'
    AND pl.resource = p_resource
    AND pl.period = 'monthly'
  LIMIT 1;

  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'used', COALESCE(v_used, 0), 'limit', -1);
  END IF;

  INSERT INTO public.usage_counters (organization_id, resource, period_start, period_end, used_count)
  VALUES (p_organization_id, p_resource, p_period_start, p_period_end, 1)
  ON CONFLICT (organization_id, resource, period_start)
  DO UPDATE SET used_count = usage_counters.used_count + 1
  RETURNING used_count INTO v_used;

  IF v_hard AND v_limit > 0 AND v_used > v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_used, 'limit', v_limit);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_limit);
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: org del usuario autenticado
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Superadmin ve todo
CREATE POLICY org_superadmin_all ON public.organizations
  FOR ALL USING (public.current_user_role() = 'superadmin');

CREATE POLICY org_member_select ON public.organizations
  FOR SELECT USING (id = public.current_user_organization_id());

-- Profiles
CREATE POLICY profiles_self ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_superadmin ON public.profiles
  FOR ALL USING (public.current_user_role() = 'superadmin');

-- Documents por tenant
CREATE POLICY documents_tenant ON public.documents
  FOR ALL USING (
    organization_id = public.current_user_organization_id()
    OR public.current_user_role() = 'superadmin'
  );

CREATE POLICY document_payloads_tenant ON public.document_payloads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND (d.organization_id = public.current_user_organization_id()
             OR public.current_user_role() = 'superadmin')
    )
  );

CREATE POLICY document_files_tenant ON public.document_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND (d.organization_id = public.current_user_organization_id()
             OR public.current_user_role() = 'superadmin')
    )
  );

CREATE POLICY api_clients_tenant ON public.api_clients
  FOR ALL USING (
    organization_id = public.current_user_organization_id()
    OR public.current_user_role() IN ('superadmin', 'admin')
  );

CREATE POLICY provider_credentials_tenant ON public.provider_credentials
  FOR ALL USING (
    organization_id = public.current_user_organization_id()
    OR public.current_user_role() = 'superadmin'
  );

CREATE POLICY subscriptions_tenant ON public.subscriptions
  FOR SELECT USING (
    organization_id = public.current_user_organization_id()
    OR public.current_user_role() = 'superadmin'
  );

CREATE POLICY usage_counters_tenant ON public.usage_counters
  FOR SELECT USING (
    organization_id = public.current_user_organization_id()
    OR public.current_user_role() = 'superadmin'
  );

CREATE POLICY audit_logs_tenant ON public.audit_logs
  FOR SELECT USING (
    organization_id = public.current_user_organization_id()
    OR public.current_user_role() = 'superadmin'
  );

-- Plans: lectura pública autenticada
CREATE POLICY plans_read ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_limits_read ON public.plan_limits FOR SELECT TO authenticated USING (true);

-- Auto-crear profile al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'client')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
