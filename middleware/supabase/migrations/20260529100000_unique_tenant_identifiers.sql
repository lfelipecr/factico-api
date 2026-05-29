-- Evitar dos tenants con la misma cédula en el mismo ambiente

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_tax_id_unique
  ON public.organizations (tax_id)
  WHERE tax_id IS NOT NULL AND btrim(tax_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_credentials_env_odoo_ref
  ON public.provider_credentials (environment, odoo_user_ref)
  WHERE odoo_user_ref IS NOT NULL AND btrim(odoo_user_ref) <> '';
