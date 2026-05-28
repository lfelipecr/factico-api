# -*- coding: utf-8 -*-
from odoo import http, _
from lxml import etree
import base64
from . import assets
_EMPTY = [False, None, '']

def _create_xml(self, mode='production', **kw):
    _res_config = self.env['cr.api.config'].sudo()._validate_config_api_active()
    if not _res_config['_next']:
        return assets.response.invalid_response(typ='Error', message='El API se encuentra fuera de servicio', status=400)

    error = 0
    msg = ''
    params = ["secret_key"] #'password']
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
        return assets.response.invalid_response(typ='Error', message=_res_api_users['_msg'], status=400)

    _res_validation = assets.xml_template._validations(params=kw)
    if not _res_validation['_next']:
        return assets.response.invalid_response(typ='Error', message=_res_validation['_msg'], status=400)

    try:
        res_xml = assets.xml_template._xml(self, params=_res_validation['params'])
        render_xml = res_xml['render_xml']
        if not render_xml:
            return assets.response.invalid_response(typ='Error', message=res_xml['msg'],status=400)
        xml_bytes = render_xml.encode('utf-8')
        # Codificar en base64
        base64_bytes = base64.b64encode(xml_bytes)
        # Convertir bytes codificados a string
        base64_str = base64_bytes.decode('utf-8')

        #PASOS PARA DECODIFICAR EL STRING
        # 1. Convertir el string base64 a bytes
        #base64_bytes = base64_str.encode('utf-8')
        # 2. Decodificar desde base64
        #decoded_bytes = base64.b64decode(base64_bytes)
        # 3. Convertir bytes a string XML
        #decoded_xml = decoded_bytes.decode('utf-8')
        print(render_xml)
        xml = etree.fromstring(render_xml)
        return assets.response.valid_response(data={
            'consecutivo': kw.get('consecutivo', '-'),
            'clave': kw.get('clave', None),
            'xml': base64_str
        })
        #return xml
    except Exception as e:
        return assets.response.invalid_response(typ='Error', message=str(e.args[0]), status=500)