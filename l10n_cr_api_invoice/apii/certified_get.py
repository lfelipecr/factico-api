# -*- coding: utf-8 -*-
from odoo import http, _
import base64
from . import assets

_EMPTY = [False, None, '']
def _get_certified(self, mode='production', **kw):
    error = 0
    msg = ''
    params = ["secret_key"]  # 'password']
    values = []
    for param in params:
        value = kw.get(param, None)
        values.append({'param': param, 'value': value})

    if not values:
        return assets.response.invalid_response(typ='Error', message='No se capturó ningún dato', status=400)

    for val in values:
        if val['value'] in _EMPTY:
            error += 1
            msg += 'El valor del campo - %s - no puede estar vacío. Valor : %s \n' % (val['param'], val['value'])

    if error:
        return assets.response.invalid_response(typ='Error', message=msg, status=400)

    secret_key = kw.get('secret_key', None)
    _res_api_users = assets.config_validate._validate_secret_key(self=self,secret_key=secret_key, mode=mode)
    if not _res_api_users['_next']:
        _msg = 'No se encontró usuario para la secret key:  %s' % secret_key
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    api_user = _res_api_users['api_user']
    if api_user._get_state_user() == 'new':
        _msg = 'El usuario no se encuentra APROBADO para continuar con el proceso'
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    try:
        certified = self.env['cr.api.certifies'].sudo().search([('api_user_id.secret_key','=', kw.get('secret_key')),
                                                                ('api_user_id.mode','=',mode)], limit=1)
        if certified:
            return assets.response.valid_response(data={'codigo_certificado': certified.file_code,
                                                        'nombre_certificado': certified.file_name})
        else:
            return assets.response.invalid_response(typ='Error', message='Certificado no encontrado', status=203)

    except Exception as e:
        return assets.response.invalid_response(typ='Error', message=str(e.args[0]), status=500)


