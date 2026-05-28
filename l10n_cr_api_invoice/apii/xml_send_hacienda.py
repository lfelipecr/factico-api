# -*- coding: utf-8 -*-
from odoo import http, _
from . import assets
from . import api
import base64
import xml.etree.ElementTree as ET
import logging
_logger = logging.getLogger(__name__)
_EMPTY = [False, None, '']

_DOCUMENT_TYPE_CODE = {
    'TiqueteElectronico': 'TE',
    'FacturaElectronica': 'FE',
    'FacturaElectronicaCompra': 'FEC',
    'FacturaElectronicaExportacion': 'FEE',
    'NotaCreditoElectronica': 'NC',
    'NotaDebitoElectronica': 'ND',
    'ReciboPagoElectronico': 'REP',
}

def _send_xml(self, mode='production', **kw):
    _res_config = self.env['cr.api.config'].sudo()._validate_config_api_active()
    if not _res_config['_next']:
        return assets.response.invalid_response(typ='Error', message='El API se encuentra fuera de servicio', status=400)

    error = 0
    msg = ''
    params = ['secret_key',
              'usuario_hacienda', 'contrasena_hacienda',
              'clave', 'fecha',
              'emisor_tipo_identificacion', 'emisor_numero_identificacion',
              #'receptor_tipo_identificacion', 'receptor_numero_identificacion', #No se usa para TIQUETE
              'comprobante_xml_firmado'
              ] #'password']

    values = []
    for param in params:
        value = kw.get(param, None)
        values.append({'param': param, 'value': value})

    key = kw.get('clave', None)
    _logger.info("Comprobante con clave: %s" % key)

    if not values:
        return assets.response.invalid_response(typ='Error', message='No se capturó ningún dato', status=400)

    for val in values:
        if val['value'] in _EMPTY:
            error += 1
            msg += 'El valor del campo - %s - no puede estar vacío \n' % val['param']

    _logger.info("Valiando errores")
    if error:
        _logger.info("Hubo error: %s" % msg)
        return assets.response.invalid_response(typ='Error', message=msg, status=400)

    _logger.info("Valiando secret_key")
    secret_key = kw.get('secret_key', None)
    _res_api_users = assets.config_validate._validate_secret_key(self=self, secret_key=secret_key, mode=mode)
    if not _res_api_users['_next']:
        _logger.info(_res_api_users['_msg'])
        return assets.response.invalid_response(typ='Error', message=_res_api_users['_msg'], status=400)

    _logger.info("Valiando api_user")
    api_user = _res_api_users['api_user']

    #OBTENCIÓN DE TOKEN
    ApiHacienda = api.ApiHacienda
    if mode == 'production':
        _environment = 'api-prod'
    else:
        _environment = 'api-stag'

    try:

        _logger.info("Valiando consulta hacienda, entorno: %s " % _environment)
        hacienda_api = ApiHacienda(_environment=_environment,
                                   username=kw.get('usuario_hacienda'),
                                   password=kw.get('contrasena_hacienda')
                                   )
        _res_token = hacienda_api.get_token()
        _logger.info("Valiando token ")
        token = _res_token['token']
        if not token:
            _logger.info("Error token: %s" % _res_token['msg_error'])
            return assets.response.invalid_response(typ='Error', message=_res_token['msg_error'], status=400)

        #comprobante_xml = assets.utils._get_xml_string(kw.get('comprobante_xml_firmado'))
        comprobante_xml = kw.get('comprobante_xml_firmado')
        _logger.info("Leyendo xml firmado ")

        params = {
            'token': token,
            'clave': kw.get('clave'),
            'fecha': kw.get('fecha'),
            'emisor_tipo_identificacion': kw.get('emisor_tipo_identificacion'),
            'emisor_numero_identificacion': kw.get('emisor_numero_identificacion'),
            'receptor_tipo_identificacion': kw.get('receptor_tipo_identificacion'),
            'receptor_numero_identificacion': kw.get('receptor_numero_identificacion'),
            'comprobante_xml': comprobante_xml
        }
        _logger.info("Enviando a hacienda... ")
        _post_json = hacienda_api.send_hacienda(params)
        _res = _process_send(_post_json)

        _logger.info("Actualiizando contadores... ")
        # Actualización para contadores de envío
        code_document_type = _get_code_document_type(comprobante_xml, api_user, kw.get('clave'))
        api_user._update_sent_ids(code_document_type)
        _logger.info("Todo OK! ")

        return assets.response.valid_response(data=_res)
    except Exception as e:
        _logger.info("Error de servidor ")
        _logger.info(e)
        return assets.response.invalid_response(typ='Error', message=str(e.args[0]), status=500)


def _process_send(post_json):
    _logger.info("Hacienda respondio ")
    response_status = post_json.get('status')
    response_text = post_json.get('text')
    _logger.info("Response status: %s" % response_status)
    _logger.info("Response text: %s" % response_text)
    status = ''
    message = ''
    if 200 <= response_status <= 299:
        status = 'Procesando'
        message = 'OK'
    elif response_status == 429:
        status = response_status
        message = response_text
    else:
        if response_text.find('ya fue recibido anteriormente') != -1:
            status = 'Procesando'
            message = 'Ya recibido anteriormente, se pasa a consultar'
        else:
            status = 'Error'
            message = response_text

    return {
        'codigo_estado': response_status,
        'estado': status,
        'mensaje': message,
    }


def _get_code_document_type(comprobante_xml, api_user, key):
    code = False
    try:
        # 1. Limpieza de la cadena: quitar espacios y saltos de línea
        comprobante_xml = comprobante_xml.strip().replace('\n', '').replace('\r', '')

        # 2. Corregir el padding (relleno con '=')
        missing_padding = len(comprobante_xml) % 4
        if missing_padding:
            comprobante_xml += '=' * (4 - missing_padding)

        # 3. Decodificación segura
        base64_bytes = comprobante_xml.encode('utf-8')
        decoded_bytes = base64.b64decode(base64_bytes)
        decoded_xml = decoded_bytes.decode('utf-8')

        # 4. Parseo del XML
        parser = ET.XMLParser(encoding="utf-8")
        root = ET.fromstring(decoded_xml, parser=parser)

        # Obtener el tag (quitando el namespace si existe)
        xml_name_tag = root.tag.split('}')[-1]

        code = _DOCUMENT_TYPE_CODE.get(xml_name_tag, False)

        if not code:
            _logger.warning("Tag XML '%s' no reconocido en _DOCUMENT_TYPE_CODE" % xml_name_tag)

    except Exception as e:
        _error_msg = 'Error decodificando XML o encontrando tipo de documento para clave %s: %s' % (key, str(e))
        api_user.message_post(body=_error_msg)
        _logger.error(_error_msg)

    return code

# def _get_code_document_type(comprobante_xml, api_user, key):
#     code = False
#     base64_bytes = comprobante_xml.encode('utf-8')
#     decoded_bytes = base64.b64decode(base64_bytes)
#     decoded_xml = decoded_bytes.decode('utf-8')
#     parser = ET.XMLParser(encoding="utf-8")
#     root = ET.fromstring(decoded_xml, parser=parser)
#     xml_name_tag = root.tag.split('}')[-1]
#     try:
#         code = _DOCUMENT_TYPE_CODE[xml_name_tag]
#     except Exception as e:
#         _error_msg = 'Error para encontrar código de tipo de documento - %s - para clave - %s - ' % (xml_name_tag, key)
#         api_user.message_post(_error_msg)
#         _logger.error(_error_msg)
#     return code
