# Documentación API — Swagger UI

Documentación pública para integradores (**sin** endpoints `/v1/admin/*`).

La documentación de administración está en [`docs/internal/`](../internal/) (no publicar en Pages).

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
4. Guardar. En unos minutos abre:

   - **Swagger:** https://lfelipecr.github.io/factico-api/api/
   - **Raíz** (`/factico-api/`) redirige solo si existe `docs/index.html` en el repo.

### Repositorio privado (plan gratuito)

En GitHub **gratis**, Pages en repos **privados** no está disponible (hace falta plan de pago) o el sitio no se publica. Opciones:

1. Hacer el repo **público** (solo documentación + código; sin secrets en el repo).
2. Subir solo `docs/api/` a un repo **público** vacío, ej. `factico-api-doc`.
3. Ver la doc en local: `cd docs/api && python3 -m http.server 8080`

## Probar desde Swagger UI

En **Authorize**: `X-Api-Key` = `fc_live_...` (entregada al activar el tenant).

Header `X-Environment`: `staging` o `production`.

**URL base producción:** `https://apife.factico.net` (p. ej. `POST /v1/documents/key`).
