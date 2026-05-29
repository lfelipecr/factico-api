# Documentación interna (no publicar en GitHub Pages)

Solo para el equipo Fáctico / operaciones.

| Archivo | Uso |
|---------|-----|
| `openapi-admin-specification.json` | Endpoints `/v1/admin/*` |

Ver en local:

```bash
cd docs/internal
python3 -m http.server 8081
```

Abrir Swagger UI apuntando al JSON (Postman import OpenAPI, o copiar `index.html` de `docs/api/` cambiando la URL del spec).

No incluir esta carpeta en el sitio público de Pages.
