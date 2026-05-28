# -*- coding: utf-8 -*-
from odoo import http, _
import base64
from . import assets

_EMPTY = [False, None, '']
def _create_certified(self, mode='production', **kw):
    error = 0
    msg = ''
    params = ["secret_key", "archivo_p12"]  # 'password']
    values = []
    for param in params:
        value = kw.get(param, None)
        values.append({'param': param, 'value': value})

    if not values:
        return assets.response.invalid_response(typ='Error', message='No se capturó ningún dato', status=400)

    for val in values:
        if val['value'] in _EMPTY:
            error += 1
            msg += 'El valor del campo - %s - no puede estar vacío\n' % val['param']

    if error:
        return assets.response.invalid_response(typ='Error', message=msg, status=400)

    secret_key = kw.get('secret_key', None)
    _res_api_users = assets.config_validate._validate_secret_key(self=self, secret_key=secret_key, mode=mode)
    if not _res_api_users['_next']:
        return assets.response.invalid_response(typ='Error', message=_res_api_users['_msg'], status=400)

    api_user = _res_api_users['api_user']

    file = kw.get('archivo_p12')

    if not file:
        _msg = "No se recibió archivo"
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    if _exist_one_certified(self, _res_api_users):
        _msg = "Ya existe un archivo cargado para el usuario : %s" % _res_api_users['api_user'].user_name
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    # 2. Obtener contenido y nombre
    try:
        file_content = file.read()
        file_name = file.filename

        # 3. Convertir a base64
        file_base64 = base64.b64encode(file_content)

        data = {
            'api_user_id': _res_api_users['api_user_id'],
            'file_p12': file_base64,
            'file_name': file_name
        }
        certified = self.env['cr.api.certifies'].sudo().create(data)
        certified.save_file_code()
        return assets.response.valid_response(data={'codigo_certificado': certified.file_code,
                                                    'nombre_certificado': certified.file_name})

    except Exception as e:
        return assets.response.invalid_response(typ='Error', message=str(e.args[0]), status=500)


def _exist_one_certified(self,  _res_api_users):
    api_user = _res_api_users['api_user']
    if len(api_user.certifies_ids.ids) == 1:
        return True
    return False