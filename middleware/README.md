# Fáctico Middleware (SaaS)

Capa multi-tenant entre sistemas de terceros y **Fáctico API** (Odoo). Los integradores consumen **JSON**; el middleware traduce a `multipart/form-data` hacia Odoo y guarda trazabilidad en Supabase.

## Stack

- **Supabase**: PostgreSQL, Auth (panel), Storage (XML), Edge Functions (Deno + TypeScript)
- **Odoo**: `https://api.kibuinc.com/cr_api` (prod) / `cr_api-staging` (sandbox)

## Estructura

```
middleware/
├── supabase/
│   ├── config.toml
│   ├── migrations/          # Esquema + RLS
│   └── functions/
│       ├── api/               # Router principal /v1/*
│       └── _shared/           # Cliente Odoo, cuotas, respuestas
├── docs/
│   └── ARCHITECTURE.md
└── .env.example
```

## Requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Deno](https://deno.land/) (incluido con Supabase CLI para functions)

## Desarrollo local (sin despliegue cloud)

Terminal 1 — Supabase + API:

```bash
cd middleware
cp .env.example .env
supabase start
supabase db reset
supabase functions serve api --env-file .env
```

Terminal 2 — Panel Next.js:

```bash
cd middleware/panel
cp .env.local.example .env.local
# Pegar SUPABASE_URL y ANON_KEY de: supabase status
npm install
npm run dev
```

- API: `http://127.0.0.1:54321/functions/v1/api`
- Panel: `http://localhost:3000`
- Studio: `http://127.0.0.1:54323`

### Panel — planes y cuotas (Fase 1)

- **Inicio**: barras de uso del mes por recurso (claves, XML, firma, envío, consulta).
- **Organizaciones** (superadmin): plan actual, envíos del mes, selector para cambiar plan.
- **Planes** (superadmin): listar, crear y editar límites mensuales por recurso.

Tras cambios en migraciones: `supabase db reset` (local) o aplicar la migración nueva.

### Primer superadmin (local)

1. Studio → Authentication → Add user.
2. SQL: `UPDATE profiles SET role = 'superadmin' WHERE id = '<uuid-del-usuario>';`
3. Login en el panel → **Nuevo tenant** o **Vincular usuario**.

## Autenticación

### Integradores (ERP / POS)

Header obligatorio:

```
Authorization: Bearer fc_live_<api_key>
```

o:

```
X-Api-Key: fc_live_<api_key>
```

La clave se crea en el panel (tabla `api_clients`); solo se muestra una vez al crearla.

### Panel (usuarios humanos)

Supabase Auth (email/password). Perfil en `profiles` con `role`: `superadmin` | `admin` | `implementer` | `client`.

## Endpoints

### Admin (JWT Supabase o `X-Provision-Key`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/v1/admin/organizations/provision` | Org + Odoo `user_register` + credenciales + API key |
| PUT | `/v1/admin/organizations/:id/credentials` | Actualizar secret ATV, cert, etc. |
| POST | `/v1/admin/organizations/:id/certificate` | Subir `.p12` + PIN |
| POST | `/v1/admin/organizations/:id/api-clients` | Nueva API key |
| GET | `/v1/admin/organizations/me` | Org del usuario panel |
| PATCH | `/v1/admin/profiles/link-organization` | Asignar org a usuario (superadmin) |

Ver [docs/PROVISIONING.md](docs/PROVISIONING.md).

### Integradores (API key `fc_live_...`)

| Método | Ruta | Odoo |
|--------|------|------|
| POST | `/v1/documents/process` | `generate_key`? + xml + sign + send |
| POST | `/v1/documents/key` | `generate_key` |
| POST | `/v1/documents/xml` | `xml_invoice` |
| POST | `/v1/documents/sign` | `xml_sign` |
| POST | `/v1/documents/send` | `send_hacienda` |
| GET | `/v1/documents/:id/status` | `consult_hacienda` |
| GET | `/v1/documents/:id/download/{xml\|signed\|response}` | Backup base64 |
| GET | `/v1/health` | ping |

## Despliegue (al final del proyecto)

Ver sección cuando panel y métodos estén completos. No desplegar antes.

## Panel (`middleware/panel`)

Pantallas incluidas: login, dashboard, organizaciones, nuevo tenant, credenciales, certificado, API keys, comprobantes (+ detalle/descarga XML), vincular usuario.

## Próximos pasos (desarrollo)

- Pantalla prueba de factura (`/documents/test-fe`) contra API key
- Cifrado AES-256-GCM en credenciales
- Webhooks al ERP cuando Hacienda responda
- Despliegue Supabase + Vercel (último paso)
