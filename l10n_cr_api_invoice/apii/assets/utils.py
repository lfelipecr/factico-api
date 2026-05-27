import os

import jinja2
import pkgutil
import base64

def get_template(path: str) -> jinja2.Template:
    template = jinja2.Template(pkgutil.get_data(__name__, "templates/" + path).decode(),trim_blocks=True,lstrip_blocks=True)
    return template

HACIENDA_RESOLUTION_URL = 'https://tribunet.hacienda.go.cr/docs/esquemas/2016/v4.1/Resolucion_Comprobantes_Electronicos_DGT-R-48-2016.pdf'


def _get_xml_string(base64_str):
    # PASOS PARA DECODIFICAR EL STRING
    # 1. Convertir el string base64 a bytes
    base64_bytes = base64_str.encode('utf-8')
    # 2. Decodificar desde base64
    decoded_bytes = base64.b64decode(base64_bytes)
    # 3. Convertir bytes a string XML
    decoded_xml = decoded_bytes.decode('utf-8')

    return decoded_xml


