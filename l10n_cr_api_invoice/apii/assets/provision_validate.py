# -*- coding: utf-8 -*-
"""Validación de clave de provisionamiento (middleware SaaS)."""

def _validate_provision_access(self, kw):
    """Retorna dict con _next, _msg, _res_config."""
    _res_config = self.env['cr.api.config'].sudo()._validate_config_api_active()
    if not _res_config['_next']:
        return {
            '_next': False,
            '_msg': 'El API se encuentra fuera de servicio',
            '_res_config': _res_config,
        }

    expected = (_res_config['config'].api_provision_key or '').strip()
    if expected:
        provided = (kw.get('provision_key') or '').strip()
        if provided != expected:
            return {
                '_next': False,
                '_msg': 'Clave de provisionamiento inválida',
                '_res_config': _res_config,
            }

    return {'_next': True, '_msg': False, '_res_config': _res_config}


def _find_api_user_by_identification(self, mode, company_id, codigo_identificacion, numero_identificacion):
    document_code = (codigo_identificacion or '').strip()
    vat = (numero_identificacion or '').strip()
    identification_type = self.env['cr.api.identification.type'].sudo().search(
        [('code_api', '=', document_code)], limit=1,
    )
    if not identification_type:
        return None, 'El código de tipo de identificación no se encuentra en la base de datos'

    user = self.env['cr.api.users'].sudo().search([
        ('company_id', '=', company_id),
        ('identification_id', '=', identification_type.id),
        ('vat', '=', vat),
        ('mode', '=', mode),
        ('active', '=', True),
    ], limit=1)
    return user, None


def _user_lookup_response(user):
    if not user.secret_key:
        user.sudo().save_secret_key()
    return {
        'exists': True,
        'secret_key': user.secret_key,
        'state': user.state,
        'usuario_nombre': user.user_name,
        'correo': user.email,
        'numero_identificacion': user.vat,
    }
