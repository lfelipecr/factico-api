# Despliegue en la nube — Fáctico Middleware

Stack recomendado:

| Componente | Servicio |
|------------|----------|
| Base de datos, Auth, API | [Supabase](https://supabase.com) |
| Panel administrativo | [Vercel](https://vercel.com) (o similar) |
| Facturación Odoo | `api.kibuinc.com` (módulo `l10n_cr_api_invoice` ≥ 18.0.4.5) |

Tiempo estimado: ~45–60 min la primera vez.

---

## Ejemplo — proyecto Factico (producción)

| Recurso | Valor |
|---------|--------|
| Supabase URL | `https://rabcundgpzfzwnntjuxu.supabase.co` |
| Project ref | `rabcundgpzfzwnntjuxu` |
| API integradores + proxy `/v1` | `https://apife.factico.net` (este repo, `middleware/panel`) |
| `api.factico.net` | **Otro** proyecto Vercel — no confundir con el panel ni con la API JSON |

> Solo `apife.factico.net` (en el deploy del panel) reenvía `/v1/*` a la Edge Function e inyecta el gateway. Los integradores usan `X-Api-Key` y `X-Environment`.

---

## 0. Prerrequisitos

- Cuenta Supabase y Vercel (GitHub conectado al repo).
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado: `brew install supabase/tap/supabase`
- Node 20+ para el panel.
- Módulo Odoo actualizado en producción con `user_lookup`, `user_update` y campo **Clave provisionamiento middleware**.

### Colima / Docker — ¿hace falta?

| Qué quieres hacer | ¿Docker / Colima? |
|-------------------|-------------------|
| Desarrollo **local** (`supabase start`) | Sí (Colima) |
| Desplegar a **Supabase Cloud** (`db push`, `functions deploy`) | **No** |

Los comandos de esta guía hablan con **tu proyecto en la nube** (`rabcundgpzfzwnntjuxu`). No ejecutes `supabase start` para el deploy.

Para subir funciones sin Docker: `supabase functions deploy api --no-verify-jwt --use-api`

---

## 1. Proyecto Supabase

### 1.1 Crear proyecto

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Región cercana a Costa Rica si es posible.
3. Guarda la **database password**.

### 1.2 Enlazar CLI

```bash
cd middleware
supabase login
supabase link --project-ref TU_PROJECT_REF
```

`TU_PROJECT_REF` está en **Project Settings → General → Reference ID**.

### 1.3 Migraciones

```bash
supabase db push
```

Aplica `20260528000000_initial_schema.sql` y `20260528100000_plans_subscriptions_admin_rls.sql`.

### 1.4 Secrets de Edge Functions

Dashboard → **Project Settings → Edge Functions → Secrets**, o CLI:

```bash
# Genera una clave larga: openssl rand -hex 32
supabase secrets set PROVISION_SERVICE_KEY="tu-clave-secreta-larga"
supabase secrets set ODOO_BASE_URL="https://api.kibuinc.com"
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase automáticamente al desplegar funciones; no hace falta definirlas manualmente salvo pruebas locales.

### 1.5 Desplegar la función `api`

```bash
supabase functions deploy api --no-verify-jwt
```

En `config.toml` ya está `verify_jwt = false` para que la API use API keys propias (`fc_live_...`) y JWT del panel, no el JWT de Supabase en cada ruta.

Comprueba:

```bash
curl -s "https://apife.factico.net/v1/health"
```

Debe devolver JSON con `"status":"ok"`.

### 1.6 Auth (panel)

**Authentication → URL configuration**

| Campo | Valor (ejemplo) |
|-------|------------------|
| Site URL | `https://panel.tudominio.com` (URL final del panel en Vercel) |
| Redirect URLs | `https://panel.tudominio.com/**`, `http://localhost:3000/**` |

**Authentication → Providers → Email**: activo. Para MVP puedes dejar **Confirm email** desactivado (como en local).

### 1.7 Primer superadmin

1. **Authentication → Users → Add user** (email + contraseña).
2. **SQL Editor**:

```sql
UPDATE public.profiles
SET role = 'superadmin'
WHERE id = 'UUID-DEL-USUARIO-AUTH';
```

---

## 2. Panel Next.js (Vercel)

### 2.1 Variables de entorno

En Vercel → proyecto → **Settings → Environment Variables**:

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://TU_PROJECT_REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (Settings → API) |
| `NEXT_PUBLIC_API_URL` | `https://apife.factico.net` |
| `SUPABASE_FUNCTIONS_URL` | `https://TU_PROJECT_REF.supabase.co/functions/v1/api` |
| `SUPABASE_ANON_KEY` | anon key (Settings → API) |

Copia desde `panel/.env.local.example`.

### 2.2 Deploy

**Opción A — Dashboard Vercel**

- Import repo `factico-api`
- **Root Directory**: `middleware/panel`
- Framework: Next.js
- Deploy

**Opción B — CLI**

```bash
cd middleware/panel
npm install
npx vercel --prod
```

Tras el deploy, vuelve a Supabase Auth y actualiza **Site URL** y **Redirect URLs** con la URL real de Vercel (`https://xxx.vercel.app` o dominio custom).

### 2.3 Probar panel

1. Login con el usuario superadmin.
2. **Nuevo tenant** → staging → cédula de prueba.
3. Credenciales + certificado P12.

---

## 3. Odoo (`api.kibuinc.com`)

1. Actualizar módulo **l10n_cr_api_invoice** a **18.0.4.5+**.
2. **API → Configuración → Ajustes**:
   - **Clave provisionamiento middleware** = mismo valor que `PROVISION_SERVICE_KEY` en Supabase.
3. Verificar rutas staging:
   - `POST /cr_api-staging/user_lookup`
   - `POST /cr_api-staging/user_register` (idempotente)

El middleware en cloud llamará `https://api.kibuinc.com/cr_api-staging/...` o `/cr_api/...` según `X-Environment` del integrador.

---

## 4. Integradores (Postman / ERP)

Variables:

| Variable | Valor |
|----------|--------|
| `baseUrl` | `https://apife.factico.net` |
| `apiKey` | `fc_live_...` (del panel al crear tenant) |

Headers en cada request (producción vía `apife.factico.net`):

```
X-Api-Key: fc_live_XXXX
X-Environment: staging
```

El proxy en Vercel añade el gateway internamente; **no** hace falta `apikey` en Postman si usas `apife.factico.net`.

Validar: `GET https://apife.factico.net/v1/health`

---

## 5. Checklist post-deploy

- [ ] `GET /v1/health` responde OK
- [ ] Login panel + rol superadmin
- [ ] Provisionar tenant staging (mensaje `odoo_user_reused` si cédula ya existía)
- [ ] Flujo Postman: key → xml → sign → send
- [ ] Barras de uso en **Inicio** del panel
- [ ] Odoo: clave provisionamiento configurada

---

## 6. Actualizaciones futuras

```bash
cd middleware
supabase db push                    # nuevas migraciones
supabase functions deploy api --no-verify-jwt
# Panel: push a main → Vercel redeploy automático
```

---

## 7. Dominio propio (opcional)

| Servicio | Acción |
|----------|--------|
| Vercel | Domains → `panel.factico.com` |
| Supabase Auth | Añadir URL en Redirect URLs |
| API integradores | `https://apife.factico.net` (proxy Vercel → Edge Function) |
| Panel | Dominio del deploy Vercel del panel (ej. `*.vercel.app` o custom distinto de `api.factico.net`) |

---

## 8. Seguridad producción

- Rotar `PROVISION_SERVICE_KEY` si se filtró.
- No commitear `.env` ni service role key.
- Restringir signup en Auth si solo creas usuarios desde Studio.
- Revisar RLS en Studio → **Database → Policies**.
- Planificar cifrado real de credenciales (hoy prefijo `enc:`).

---

## Troubleshooting

| Síntoma | Causa habitual |
|---------|----------------|
| `Invalid JWT` en Edge Function | Llamada sin anon key; o `verify_jwt` en true |
| `Missing SUPABASE_SERVICE_ROLE_KEY` | Función no desplegada en cloud / secrets |
| `Clave de provisionamiento inválida` | Odoo `api_provision_key` ≠ `PROVISION_SERVICE_KEY` |
| Panel no inicia sesión | Site URL / Redirect URLs incorrectas en Auth |
| `Quota check failed` | Migraciones no aplicadas o sin suscripción `starter` |
