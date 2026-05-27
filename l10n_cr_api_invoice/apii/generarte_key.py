# -*- coding: utf-8 -*-
import random
import pytz
from datetime import datetime
from . import assets

_EMPTY = [False, None, '']

TYPE_TO_CODE = {
    "normal": "1",
    "contingencia": "2",
    "sininternet": "3",
}


def _create_key(self, mode='production', **kw):
    error = 0
    msg = ''
    params = ["secret_key", "sucursal", 'terminal', 'secuencia', 'tipo_documento',
              'numero_identificacion', 'situacion', 'codigo_pais']  # 'password']
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
        _msg = 'No se encontró usuario para la secret key:  %s' % secret_key
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    api_user = _res_api_users['api_user']
    if api_user._get_state_user() == 'new':
        _msg = 'El usuario no se encuentra APROBADO para continuar con el proceso'
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    _res_sequence = compute_full_sequence(self, kw)
    if not _res_sequence['_next']:
        return assets.response.invalid_response(typ='Error', message=_res_sequence['_msg'], status=400)

    try:
        electronic_sequence = _res_sequence['full_sequence']
        number_electronic = get_number_electronic(full_sequence=electronic_sequence, kw=kw)

        return assets.response.valid_response(data={
            'consecutivo': electronic_sequence,
            'clave': number_electronic
        })

    except Exception as e:
        return assets.response.invalid_response(typ='Error', message=str(e.args[0]), status=500)


def compute_full_sequence(self, kw):
    branch = str(kw.get('sucursal', False)) #Sucursal
    terminal = str(kw.get('terminal', False)) #Terminal
    sequence = str(kw.get('secuencia', False)) #Sencuencia
    document_type_code = str(kw.get('tipo_documento', False)) #Sencuencia

    if len(sequence) != 10:
        return {
            '_next': False,
            '_msg': 'La secuencia debe tener 10 dígitos',
            'full_sequence': False
        }

    document_type = self.env['cr.api.document.type'].sudo().search([('code', '=', document_type_code)])
    if not document_type:
        return {
            '_next': False,
            '_msg': 'No existe el tipo de documento con código: %s' % document_type_code,
            'full_sequence': False
        }
    if branch not in _EMPTY and len(branch) != 3:
        return {
            '_next': False,
            '_msg': 'La sucursal debe tener 3 dígitos: %s' % branch,
            'full_sequence': False
        }

    if terminal not in _EMPTY and len(terminal) != 5:
        return {
            '_next': False,
            '_msg': 'La terminal debe tener 5 dígitos: %s' % terminal,
            'full_sequence': False
        }

    branch_filled = branch.zfill(3)
    terminal_filled = terminal.zfill(5)

    full_sequence = branch_filled + terminal_filled + document_type.code_hacienda + sequence
    return {
        '_next': True,
        '_msg': False,
        'full_sequence': full_sequence
    }

def get_consecutive(params):
    branch = str(params['branch'])
    terminal = str(params['terminal'])
    doc_type_code = str(params['doc_type_code'])
    sequence = str(params['sequence'])

    branch_filled = branch.zfill(3)
    terminal_filled = terminal.zfill(5)

    full_sequence = branch_filled + terminal_filled + doc_type_code + sequence
    return full_sequence

def get_number_electronic(full_sequence, kw):
    identification_number = kw.get('numero_identificacion', False)
    situation = kw.get('situacion', False)
    phone_code = kw.get('codigo_pais', False)
    cur_date = kw.get('fecha_emision', False)
    if not cur_date:
        cur_date = get_time_cr(as_obj=True).strftime("%d%m%y")

    situation_code = TYPE_TO_CODE[situation]
    random_digits = str(random.randint(1, 99999999)).zfill(8)
    number_electronic = (
        str(phone_code)
        + cur_date
        + str(identification_number).zfill(12)
        + full_sequence
        + situation_code
        + random_digits
    )
    return number_electronic

def get_time_cr(as_obj=False):
    now_cr = datetime.now(pytz.timezone("America/Costa_Rica"))
    if as_obj:
        return now_cr
    iso_str = now_cr.isoformat()
    return iso_str
