# -*- coding: utf-8 -*-
from odoo import http, _
from lxml import etree
import base64
from . import assets
_EMPTY = [False, None, '']

def _sign_xml(self, mode='production', **kw):
    _res_config = self.env['cr.api.config'].sudo()._validate_config_api_active()
    if not _res_config['_next']:
        return assets.response.invalid_response(typ='Error', message='El API se encuentra fuera de servicio', status=400)

    error = 0
    msg = ''
    params = ["secret_key", "codigo_certificado", "comprobante_xml", 'pin'] #'password']
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

    secret_key = kw.get('secret_key', None)
    _res_api_users = assets.config_validate._validate_secret_key(self=self, secret_key=secret_key, mode=mode)
    if not _res_api_users['_next']:
        _msg = 'No se encontró usuario para la secret key:  %s' % secret_key
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    api_user = _res_api_users['api_user']
    if api_user._get_state_user() == 'new':
        _msg = 'El usuario no se encuentra APROBADO para continuar con el proceso'
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)

    certified = self.env['cr.api.certifies'].sudo().search([('file_code', '=', kw.get('codigo_certificado'))], limit=1)
    if not certified:
        _msg = 'No se encontró ningún certificado para el código: %s\n ' % kw.get('codigo_certificado')
        return assets.response.invalid_response(typ='Error', message=_msg, status=400)
    try:
        base64_str = sign(certified, comprobante_xml=kw.get('comprobante_xml'), pin=kw.get('pin'))
        return assets.response.valid_response(data={
            'comprobante_xml_firmado': base64_str
        })


    except Exception as e:
        return assets.response.invalid_response(typ='Error', message=str(e.args[0]), status=500)


def sign(certified, comprobante_xml, pin):
    # 1. Obtener el XML plano
    decoded_xml = assets.utils._get_xml_string(comprobante_xml)

    # 2. Firmar (Esto devuelve el XML con la firma digital en bytes)
    xml_sign_result = assets.xml_sign.generate_signature2(
        xml=decoded_xml,
        file_p12=certified.file_p12,
        pin=pin
    )
    # 3. Convertir a Base64 y devolver como string limpio
    # IMPORTANTE: No decodificar de vuelta a XML aquí.
    return base64.b64encode(xml_sign_result).decode('utf-8')


#
# def sign(certified, comprobante_xml, pin):
#     decoded_xml = assets.utils._get_xml_string(comprobante_xml)
#
#     xml_sign = assets.xml_sign.generate_signature2(xml=decoded_xml, file_p12=certified.file_p12, pin=pin)
#     # xml_sign = assets.xml_signature.firmar_xml(xml=decoded_xml, file_p12=certified.file_p12, pin=kw.get('pin'))
#
#     # Codificar en base64
#     base64_bytes = base64.b64encode(xml_sign)
#     # Convertir bytes codificados a string
#     base64_str = base64_bytes.decode('utf-8')
#
#     # 1. Convertir el string base64 a bytes
#     base64_bytes = base64_str.encode('utf-8')
#     # 2. Decodificar desde base64
#     decoded_bytes = base64.b64decode(base64_bytes)
#     # 3. Convertir bytes a string XML
#     decoded_xml = decoded_bytes.decode('utf-8')
#
#     return base64_str