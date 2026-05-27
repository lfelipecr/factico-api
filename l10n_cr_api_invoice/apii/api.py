import requests
import logging
_logger = logging.getLogger(__name__)
HACIENDA_API_PROD_URL = 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/'
HACIENDA_API_STAG_URL = 'https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/'
a = 'https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion'
HACIENDA_TOKEN_STAG_URL = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token'
HACIENDA_TOKEN_PROD_URL = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token'

class ApiHacienda:
    def __init__(self, _environment='api-stag', username='', password=''):
        self._api_prod_url = HACIENDA_API_PROD_URL
        self._api_stag_url = HACIENDA_API_STAG_URL
        self._token_stag_url = HACIENDA_TOKEN_STAG_URL
        self._token_prod_url = HACIENDA_TOKEN_PROD_URL
        self._environment = _environment
        self.username = username
        self.password = password


    def get_token(self):
        headers = {}
        data = {'client_id': self._environment,
                'client_secret': '',
                'grant_type': 'password',
                'username': self.username,
                'password': self.password,
                }

        if self._environment == 'api-stag':
            endpoint = self._token_stag_url
        else:
            endpoint = self._token_prod_url

        msg_error = False
        token = False

        try:
            # enviando solicitud post y guardando la respuesta como un objeto json
            response = requests.request("POST", endpoint, data=data, headers=headers)
            response_json = response.json()
            if 200 <= response.status_code <= 299:
                token = response_json.get('access_token')
            else:
                msg_error =  'Error en token de hacienda: ' + str(response.content)

        except requests.exceptions.RequestException as e:
            msg_error = 'Error Obteniendo el Token desde haciedna. Excepcion %s' % e

        return {
            'token': token,
            'msg_error': msg_error,
        }

    def send_hacienda(self, params={}):
        headers = {'Authorization': 'Bearer %s' % params['token'],
                   'Content-type': 'application/json'}

        if self._environment == 'api-stag':
            endpoint = self._api_stag_url + 'recepcion'
        else:
            endpoint = self._api_prod_url + 'recepcion'

        data = {'clave': params['clave'],
                'fecha': params['fecha'],
                'emisor': {
                    'tipoIdentificacion': params['emisor_tipo_identificacion'],
                    'numeroIdentificacion': params['emisor_numero_identificacion'],
                },
                'comprobanteXml': params['comprobante_xml']
                }

        if params['receptor_tipo_identificacion'] and params['receptor_numero_identificacion'] :
            data['receptor'] = {
                'tipoIdentificacion': params['receptor_tipo_identificacion'],
                'numeroIdentificacion': params['receptor_numero_identificacion'],
            }

        try:
            response = requests.post(endpoint, json=data, headers=headers)
            _logger.info('\n postMH\n %r\n\n',
                         [response.status_code, response.headers or '', response.reason or '', response])
            if response.status_code != 202:
                error_caused_by = response.headers.get('X-Error-Cause') if 'X-Error-Cause' in response.headers else ''
                error_caused_by += response.headers.get('validation-exception', '')
                if not error_caused_by:
                    error_caused_by += response.reason
                return {'status': response.status_code, 'text': error_caused_by}
            else:
                return {'status': response.status_code, 'text': response.reason}

        except ImportError:
            return {'status': 500, 'text': 'Error enviando el XML al Ministerior de Hacienda'}

    def consult_hacienda(self, params={}):
        _key = params['clave']
        if self._environment == 'api-stag':
            url = "%s%s/%s" % (self._api_stag_url, 'recepcion', _key)
        else:
            url = "%s%s/%s" % (self._api_prod_url, 'recepcion', _key)

        headers = {
            'Authorization': 'Bearer %s' % params['token'],
            'Cache-Control': 'no-cache',
        }

        try:
            response = requests.get(url, headers=headers)
        except requests.exceptions.RequestException as e:
            return {'status': -1, 'text': 'Excepcion %s' % e}

        xml_response = False
        code_status = response.status_code
        msg_error = False
        msg_hacienda = False
        status = False
        if response.status_code == 200:
            data = response.json()
            if "respuesta-xml" in data and data["respuesta-xml"]:
                xml_response = data["respuesta-xml"]

            if 'ind-estado' in data and data['ind-estado']:
                status = data['ind-estado']

        elif response.status_code == 202:
            msg_error = 'Hacienda recibió la solicitud pero aún la está procesando. Intenta más tarde.'
            msg_hacienda = response.text

        elif response.status_code == 400:
            msg_error = 'Error 400 - Solicitud inválida. Verifica la estructura de la petición.'
            msg_hacienda = response.text

        elif response.status_code == 401:
            msg_error = 'Error 401 - Token inválido o expirado. Debes renovar el token.'
            msg_hacienda = response.text

        elif response.status_code == 403:
            msg_error = 'Error 403 - El usuario no tiene permiso para consultar esta clave.'
            msg_hacienda = response.text

        elif response.status_code == 404:
            msg_error = 'Error 404 - La clave consultada no existe o no ha sido procesada aún.'
            msg_hacienda = response.text
        elif 500 <= response.status_code < 600:
            msg_error = 'Error del servidor de Hacienda. Intenta nuevamente más tard.'
            msg_hacienda = response.text
        else:
            status = response.status_code
            msg_error = 'Error inesperado.'
            msg_hacienda = response.text

        return {
            'xml_response': xml_response,
            'code_status': code_status,
            'status': status,
            'msg_error': msg_error,
            'msg_hacienda': msg_hacienda,
            'key': _key
        }

    # def consult_hacienda(self, params={}):
    #     _key = params['clave']
    #     if self._environment == 'api-stag':
    #         url = "%s%s/%s" % (self._api_stag_url, 'recepcion', _key)
    #     else:
    #         url = "%s%s/%s" % (self._api_prod_url, 'recepcion', _key)
    #
    #     headers = {
    #         'Authorization': 'Bearer %s' % params['token'],
    #         'Cache-Control': 'no-cache',
    #         'Content-Type': 'application/x-www-form-urlencoded',
    #     }
    #
    #     try:
    #         response = requests.get(url, headers=headers)
    #     except requests.exceptions.RequestException as e:
    #         return {'status': -1, 'text': 'Excepcion %s' % e}
    #
    #     if 200 <= response.status_code <= 299:
    #         # _logger.info('\n getMH response.json() \n%r\n\n', response.json())
    #         response_json = response.json()
    #         response_json['status'] = response.status_code
    #     elif 400 <= response.status_code <= 499:
    #         # _logger.info('\n\n%r\n\n', response.status_code)
    #         response_json = {
    #             'status': 400,
    #             'text': 'error',
    #         }
    #     elif response.status_code == 504:
    #         # _logger.info('\n\n%r\n\n', response.status_code)
    #         response_json = {
    #             'status': 504,
    #             'text': 'Timeout'
    #         }
    #     else:
    #         response_json = response.json()
    #         response_json['status'] = response.status_code
    #         response_json['text'] = 'token_hacienda failed: %s' % response.reason
    #
    #     return response_json
