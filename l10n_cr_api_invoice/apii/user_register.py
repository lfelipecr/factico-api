# -*- coding: utf-8 -*-
from odoo import http, _
from . import assets
_EMPTY = [False, None, '']

def _create_user_api(self, mode='production', **kw):
    _res_config = self.env['cr.api.config'].sudo()._validate_config_api_active()
    if not _res_config['_next']:
        return assets.response.invalid_response(typ='Error', message='El API se encuentra fuera de servicio', status=400)

    error = 0
    msg = ''
    params = ["usuario_nombre", "codigo_identificacion", "numero_identificacion", 'correo'] #'password']


    if _res_config['api_only_super_user']: #Solo super usuario puede registrar
        #Evaluamos si el parámetro está siendo enviado
        super_user = params.get('super_user', False)
        if not super_user:
            return assets.response.invalid_response(typ='Error', message='No tiene permiso para crear usuarios', status=400)

    values = []
    for param in params:
        value = kw.get(param, None)
        values.append({'param': param, 'value': value})

    if not values:
        return assets.response.invalid_response(typ='Error', message='No se capturó ningún dato', status=400)

    for val in values:
        if val['value'] in _EMPTY:
            error += 1
            msg += 'El valor del campo - %s - no puede estar vacío \n' % val['param']

    if error:
        return assets.response.invalid_response(typ='Error', message=msg, status=400)


    document_code = kw.get('codigo_identificacion').strip()
    identification_type = self.env['cr.api.identification.type'].sudo().search([('code_api', '=', document_code)], limit=1)
    if not identification_type:
        msg = 'El código de tipo de identificación no se encuentra en la base de datos'
        return assets.response.invalid_response(typ='Error', message=msg, status=400)

    data = {
        'user_name': kw.get('usuario_nombre'),
        'identification_id': identification_type.id,
        'vat': kw.get('numero_identificacion'),
        'email': kw.get('correo'),
        'mode': mode,
        'company_id': _res_config['company_id'],
        'from_api': True,
        'active': True,
        'state': 'approved',
    }
    try:
        user = self.env['cr.api.users'].sudo().create(data)
        user.sudo().save_secret_key()
        return assets.response.valid_response(data={'secret_key': user.secret_key})
    except Exception as e:
        return assets.response.invalid_response(typ='Error', message=str(e.args[0]), status=500)
