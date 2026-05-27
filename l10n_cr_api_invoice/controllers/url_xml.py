# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request
from odoo.http import request, Response
import base64

from odoo.tools.misc import limited_field_access_token


class ViewURl(http.Controller):

    @http.route('/invoice_xml/<int:api_user_id>/<int:invoice_id>/<string:name>', type='http', auth='public')
    def invoice_xml_customer(self, api_user_id, invoice_id, name):
        _domain = [('api_user_id', '=', api_user_id),
                   ('id', '=', invoice_id)]
        invoice = request.env['cr.api.invoice'].sudo().search(_domain, limit=1)
        if invoice:
            xml_content = base64.b64decode(invoice.xml_customer)
            if xml_content:
                filename = name
                return Response(
                    xml_content,
                    content_type='application/xml',
                    headers=[
                        ('Content-Disposition', f'inline; filename={filename}')
                    ]
                )
            else:
                return Response("Archivo XML no encontrado", status=404)
        else:
            return Response("Factura no encontrada", status=404)

    @http.route('/invoice_response_xml/<int:api_user_id>/<int:invoice_id>/<string:name>', type='http', auth='public')
    def invoice_xml_response(self, api_user_id, invoice_id, name):
        _domain = [('api_user_id', '=', api_user_id),
                   ('id', '=', invoice_id)]
        invoice = request.env['cr.api.invoice'].sudo().search(_domain, limit=1)
        if invoice:
            xml_content = base64.b64decode(invoice.xml_response)
            if xml_content:
                filename = name
                return Response(
                    xml_content,
                    content_type='application/xml',
                    headers=[
                        ('Content-Disposition', f'inline; filename={filename}')
                    ]
                )
            else:
                return Response("Archivo XML no encontrado", status=404)
        else:
            return Response("Factura no encontrada", status=404)
