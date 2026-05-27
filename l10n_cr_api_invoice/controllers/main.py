# -*- coding: utf-8 -*-
from odoo import http, _
from odoo.http import request
from .. import apii



class ApiInvoiceVersion44Controller(http.Controller):

    #USUARIOS
    @http.route('/cr_api/user_register', auth='none', methods=['POST'], csrf=False)
    def cr_api_user_register(self, **kw):
        return apii.user_register._create_user_api(self=http.request, **kw)

    @http.route('/cr_api-staging/user_register', auth='none', methods=['POST'], csrf=False)
    def cr_api_staging_user_register(self, **kw):
        return apii.user_register._create_user_api(self=http.request, mode='staging', **kw)

    #CERTIFICADOS
    @http.route('/cr_api/certified_upload', auth='none', methods=['POST'], csrf=False)
    def cr_api_upload_certified(self, **kw):
        return apii.certified_upload._create_certified(self=http.request, **kw)

    @http.route('/cr_api-staging/certified_upload', auth='none', methods=['POST'], csrf=False)
    def cr_api_staging_upload_certified(self, **kw):
        return apii.certified_upload._create_certified(self=http.request, mode='staging', **kw)

    @http.route('/cr_api/certified_get', auth='none', methods=['GET'], csrf=False)
    def cr_api_certified_get(self, **kw):
        return apii.certified_get._get_certified(self=http.request, **kw)

    @http.route('/cr_api-staging/certified_get',  auth='none', methods=['GET'], csrf=False)
    def cr_api_staging_certified_get(self, **kw):
        return apii.certified_get._get_certified(self=http.request, mode='staging', **kw)

    #CLAVE
    @http.route('/cr_api/generate_key', auth='none', methods=['POST'], csrf=False)
    def cr_api_generate_key(self, **kw):
        return apii.generarte_key._create_key(self=http.request, **kw)

    @http.route('/cr_api-staging/generate_key', auth='none', methods=['POST'], csrf=False)
    def cr_api_staging_generate_key(self, **kw):
        return apii.generarte_key._create_key(self=http.request, mode='staging', **kw)

    #GENERA XML DE DOCUMENTO
    @http.route('/cr_api/xml_invoice', auth='none', methods=['POST'], csrf=False)
    def cr_api_xml_invoice(self, **kw):
        return apii.xml_invoice._create_xml(self=http.request, **kw)

    @http.route('/cr_api-staging/xml_invoice', auth='none', methods=['POST'], csrf=False)
    def cr_api_staging_xml_invoice(self, **kw):
        return apii.xml_invoice._create_xml(self=http.request, mode='staging', **kw)

    #FIRMAR XML
    @http.route('/cr_api/xml_sign', auth='none', methods=['POST'], csrf=False)
    def cr_api_xml_sign(self, **kw):
        return apii.xml_sign._sign_xml(self=http.request, **kw)

    @http.route('/cr_api-staging/xml_sign', auth='none', methods=['POST'], csrf=False)
    def cr_api_staging_xml_sign(self, **kw):
        return apii.xml_sign._sign_xml(self=http.request, mode='staging', **kw)

    # ENVIAR HACIENDA
    @http.route('/cr_api/send_hacienda', auth='none', methods=['POST'], csrf=False)
    def cr_api_send_hacienda(self, **kw):
        return apii.xml_send_hacienda._send_xml(self=http.request, **kw)

    @http.route('/cr_api-staging/send_hacienda', auth='none', methods=['POST'], csrf=False)
    def cr_api_staging_send_hacienda(self, **kw):
        return apii.xml_send_hacienda._send_xml(self=http.request, mode='staging', **kw)

    # ENVIAR HACIENDA
    @http.route('/cr_api/consult_hacienda', auth='none', methods=['GET'], csrf=False)
    def cr_api_consult_hacienda(self, **kw):
        return apii.xml_consult_hacienda._consult_xml(self=http.request, **kw)

    @http.route('/cr_api-staging/consult_hacienda', auth='none', methods=['GET'], csrf=False)
    def cr_api_staging_consult_hacienda(self, **kw):
        return apii.xml_consult_hacienda._consult_xml(self=http.request, mode='staging', **kw)
