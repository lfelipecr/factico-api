# Arquitectura — Fáctico Middleware

## Decisiones confirmadas

| Tema | Decisión |
|------|----------|
| Base de datos + Auth | Supabase (PostgreSQL + Auth) |
| API pública | JSON REST |
| Hacia Odoo | `multipart/form-data` (adaptador en `_shared/odoo.ts`) |
| Tenancy | Multi-tenant único |
| Aprobación Odoo | Automática (`approved` al crear vía API) |
| Runtime | Deno / Supabase Edge Functions (TypeScript) |

## Flujo FE (MVP por pasos)

```mermaid
sequenceDiagram
  participant ERP
  participant MW as Middleware
  participant SB as Supabase
  participant OD as Odoo FECR

  ERP->>MW: POST /v1/documents/key (API key)
  MW->>SB: check quota
  MW->>OD: generate_key
  MW->>SB: documents + payloads
  MW-->>ERP: clave, consecutivo, document_id

  ERP->>MW: POST /v1/documents/xml
  MW->>OD: xml_invoice
  MW->>SB: xml_base64
  MW-->>ERP: xml (base64)

  ERP->>MW: POST /v1/documents/sign
  MW->>OD: xml_sign (pin/cert internos)
  MW-->>ERP: comprobante_xml_firmado

  ERP->>MW: POST /v1/documents/send
  MW->>OD: send_hacienda
  MW-->>ERP: estado MH

  ERP->>MW: GET /v1/documents/:id/status
  MW->>OD: consult_hacienda
  MW-->>ERP: respuesta_xml + estado
```

## Seguridad

- Terceros: `fc_live_*` API key (hash SHA-256 en BD).
- Panel: JWT Supabase + `profiles.role`.
- Credenciales Odoo/Hacienda: tabla `provider_credentials` (cifrado app-level; MVP prefijo `enc:`).
- RLS: aislamiento por `organization_id`.

## Bootstrap manual (hasta tener panel)

```sql
-- 1. Organización
INSERT INTO organizations (name, tax_id, status)
VALUES ('Cliente demo', '3102802163', 'active')
RETURNING id;

-- 2. Suscripción al plan starter
INSERT INTO subscriptions (organization_id, plan_id, status)
SELECT '<org_id>', id, 'active' FROM plans WHERE name = 'starter';

-- 3. Credenciales (staging) — usar encryptField en producción
INSERT INTO provider_credentials (
  organization_id, environment,
  factico_secret_key_encrypted,
  hacienda_user_encrypted,
  hacienda_password_encrypted,
  certificate_code,
  certificate_pin_encrypted
) VALUES (
  '<org_id>', 'staging',
  'enc:<secret_key_odoo>',
  'enc:<usuario_atv>',
  'enc:<password_atv>',
  '<codigo_certificado>',
  'enc:<pin_p12>'
);

-- 4. API key: generar con generateApiKey() en función admin o script
```

## Fase 2

- `POST /v1/documents/process` (orquestación completa)
- Panel Next.js
- Cifrado AES-256-GCM real
- Storage bucket para XML > 1MB
- Webhooks
