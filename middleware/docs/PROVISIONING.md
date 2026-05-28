# Provisioning de un tenant

## Configuración Odoo (obligatorio para lookup/update)

En Odoo → **API → Configuración → Ajustes**, campo **Clave provisionamiento middleware**: debe ser el mismo valor que `PROVISION_SERVICE_KEY` en el middleware.

Sin esa clave, `user_lookup` y `user_update` responden 403.

## Endpoints Odoo nuevos (v18.0.4.5+)

| Ruta | Uso |
|------|-----|
| `POST /cr_api-staging/user_lookup` | Consultar si existe usuario API por cédula + tipo ID |
| `POST /cr_api-staging/user_update` | Actualizar nombre/correo/estado por `secret_key` |
| `POST .../user_register` | Idempotente: si ya existe, devuelve el mismo `secret_key` |
| `POST .../certified_upload` + `reemplazar=1` | Sustituir certificado P12 existente |

Body común de provisionamiento: `provision_key`, `codigo_identificacion` (ej. `cedula_fisica`), `numero_identificacion`.

## Opción A — Service key (bootstrap)

```bash
export PROVISION_SERVICE_KEY="tu-clave-secreta-larga"
# supabase secrets set PROVISION_SERVICE_KEY=...

curl -X POST "$SUPABASE_URL/functions/v1/api/v1/admin/organizations/provision" \
  -H "Content-Type: application/json" \
  -H "X-Provision-Key: $PROVISION_SERVICE_KEY" \
  -d '{
    "environment": "staging",
    "organization": {
      "name": "Cliente Demo S.A.",
      "tax_id": "3102802163"
    },
    "odoo_user": {
      "usuario_nombre": "Cliente Demo",
      "codigo_identificacion": "cedula_juridica",
      "numero_identificacion": "3102802163",
      "correo": "facturacion@cliente.com"
    },
    "hacienda": {
      "usuario_hacienda": "usuario@atv.hacienda.go.cr",
      "contrasena_hacienda": "..."
    },
    "api_client_name": "ERP Principal"
  }'
```

Respuesta (guardar de inmediato):

```json
{
  "organization_id": "uuid",
  "factico_secret_key": "...",
  "api_key": "fc_live_...",
  "odoo_state": "approved",
  "odoo_user_reused": true,
  "warning": "..."
}
```

`odoo_user_reused: true` indica que la cédula ya existía en Odoo y se enlazó el `secret_key` existente.

## Opción B — JWT superadmin

1. Crear usuario en Supabase Auth (Studio → Authentication).
2. En SQL: `UPDATE profiles SET role = 'superadmin' WHERE id = '<auth_user_uuid>';`
3. Obtener JWT (login desde app o `supabase auth`).
4. Mismo `POST /v1/admin/organizations/provision` con `Authorization: Bearer <jwt>`.

## Certificado P12

```bash
curl -X POST "$URL/v1/admin/organizations/<org_id>/certificate" \
  -H "Authorization: Bearer $JWT" \
  -F "archivo_p12=@certificado.p12" \
  -F "pin=1234" \
  -F "environment=staging"
```

## Vincular admin del panel al tenant

Tras crear el usuario Auth del cliente:

```bash
curl -X PATCH "$URL/v1/admin/profiles/link-organization" \
  -H "Authorization: Bearer $SUPERADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<auth_uuid>","organization_id":"<org_uuid>","role":"admin"}'
```

## Factura completa (un solo paso)

```bash
curl -X POST "$URL/v1/documents/process" \
  -H "Authorization: Bearer fc_live_..." \
  -H "Content-Type: application/json" \
  -H "X-Environment: staging" \
  -d @factura-fe.json
```

`factura-fe.json` = mismos campos que `xml_invoice` + opcional `sucursal`, `terminal`, `secuencia`, `fecha` para envío.
