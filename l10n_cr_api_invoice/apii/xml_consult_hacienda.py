# -*- coding: utf-8 -*-
from odoo import http, _
from . import assets
from . import api
_EMPTY = [False, None, '']

def _consult_xml(self, mode='production', **kw):
    _res_config = self.env['cr.api.config'].sudo()._validate_config_api_active()
    if not _res_config['_next']:
        return assets.response.invalid_response(typ='Error', message='El API se encuentra fuera de servicio', status=400)

    error = 0
    msg = ''
    params = ['secret_key',
              'usuario_hacienda', 'contrasena_hacienda',
              'clave',
              ] #'password']

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

    secret_key = kw.get('secret_key', None)
    _res_api_users = assets.config_validate._validate_secret_key(self=self, secret_key=secret_key, mode=mode)
    if not _res_api_users['_next']:
        _msg = 'No se encontró usuario para la secret key:  %s' % secret_key
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    api_user = _res_api_users['api_user']
    if api_user._get_state_user() == 'new':
        _msg = 'El usuario no se encuentra APROBADO para continuar con el proceso'
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    #OBTENCIÓN DE TOKEN
    ApiHacienda = api.ApiHacienda
    if mode == 'production':
        _environment = 'api-prod'
    else:
        _environment = 'api-stag'

    try:

        hacienda_api = ApiHacienda(_environment=_environment,
                                   username=kw.get('usuario_hacienda'),
                                   password=kw.get('contrasena_hacienda')
                                   )
        _res_token = hacienda_api.get_token()
        token = _res_token['token']
        if not token:
            return assets.response.invalid_response(typ='Error', message=_res_token['msg_error'], status=400)

        params = {
            'token': token,
            'clave': kw.get('clave'),
        }
        _get_json = hacienda_api.consult_hacienda(params)
        _res = _process_consult(_get_json)
        return assets.response.valid_response(data=_res)
    except Exception as e:
        return assets.response.invalid_response(typ='Error', message=str(e.args[0]), status=500)


def _process_consult(_get_json):

    if _get_json['xml_response']:
        decoded_xml = assets.utils._get_xml_string(_get_json['xml_response'])
        #print(decoded_xml)

    return {
        'codigo_estado': _get_json['code_status'],
        'estado': _get_json['status'],
        'mensaje': _get_json['msg_error'],
        'clave': _get_json['key'],
        'respuesta_xml': _get_json['xml_response']
    }
