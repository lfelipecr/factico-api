# Documentación API — Swagger UI

Sitio estático estilo [apifecrdoc](https://lfelipecr.github.io/apifecrdoc/) para la **Fáctico Middleware API** (JSON REST).

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Swagger UI |
| `openapi-specification.json` | Especificación OpenAPI 3.0 |

## Ver en local

```bash
cd docs/api
python3 -m http.server 8080
```

Abrir: http://localhost:8080

## Publicar en GitHub Pages

1. Subir `docs/api/` al repo `factico-api` en GitHub.
2. **Settings → Pages** → Source: **Deploy from branch**
3. Branch: `main` — Folder: **`/docs`**
4. Guardar. En unos minutos:

   `https://lfelipecr.github.io/factico-api/api/`

   (Si prefieres URL corta `factico-middleware-doc`, crea repo `factico-middleware-doc` solo con esta carpeta.)

## Probar desde Swagger UI

En **Authorize**:

1. `apikey` → anon key de Supabase.
2. `X-Api-Key` → `fc_live_...` del tenant.

Header global `X-Environment`: `staging` o `production`.

## Relación con apifecrdoc

| Documentación | Audiencia | Formato |
|---------------|-----------|---------|
| [apifecrdoc](https://lfelipecr.github.io/apifecrdoc/) | Integración directa Odoo | form-data |
| Esta API | Integración vía middleware SaaS | JSON |
