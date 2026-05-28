# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError
from datetime import datetime, timedelta
import json
import logging
import base64
import re
import xml.etree.ElementTree as ET

_logger = logging.getLogger(__name__)
from ..apii import xml_send_hacienda, xml_consult_hacienda

_STATE = [
    ('not_sent', "No Enviado"),
    ('received', "Recibido"),
    ('accepted', "Aceptado"),
    ('rejected', "Rechazado"),
    ('error', "Error"),
    ('processing', "Procesando")]

_RESPONSE_STATE = {
    'not_sent': 'not_sent',
    'recibido': 'received',
    'aceptado': 'accepted',
    'rechazado': 'rejected',
    'error': 'error',
    'procesando': 'processing',
}


class CrApiInvoice(models.Model):
    _name = 'cr.api.invoice'
    _inherit = ['portal.mixin', 'mail.thread.main.attachment', 'mail.activity.mixin']
    _description = 'CR Api facturación - Comprobantes'
    _order = 'id desc'
    _rec_name = 'consecutive'

    api_user_id = fields.Many2one('cr.api.users', string='Usuario API')
    api_user_mode = fields.Selection(related='api_user_id.mode', string='Ambiente')
    company_id = fields.Many2one('res.company', string='Compañia', related='api_user_id.company_id')

    state = fields.Selection(_STATE, string="Estado", default='not_sent', copy=False, tracking=True)
    state_manual = fields.Selection(_STATE, string="Estado manual")

    document_type_id = fields.Many2one('cr.api.document.type', string='Tipo de documento')
    reference_code_id = fields.Many2one('cr.api.reference.code', string='Referencia de doc.')
    date_emission = fields.Date(string='Fecha emisión')
    date_emission_str = fields.Char(string='Fecha emisión con formato')
    consecutive = fields.Char(string='Consecutivo', copy=False, tracking=True)
    key = fields.Char(string='Clave', copy=False, tracking=True)

    condition_sale_id = fields.Many2one('cr.api.payment.type', string='Condición venta')
    method_ids = fields.Many2many('cr.api.payment.method', string='Medio pago')

    customer_identification_id = fields.Many2one('cr.api.identification.type', string='Identificación')
    customer_vat = fields.Char(string='N°Identificación', copy=False, tracking=True)
    customer_name = fields.Char(string='Cliente', copy=False, tracking=True)
    customer_email = fields.Char(string='Correo', copy=False, tracking=True)

    invoice_rate = fields.Float(string='Tipo cambio')
    invoice_currency_id = fields.Many2one('res.currency', string='Moneda')
    invoice_tax = fields.Monetary(string='Impuesto', currency_field='invoice_currency_id', store=True)
    invoice_total = fields.Monetary(string='Total', currency_field='invoice_currency_id', store=True)

    xml_customer = fields.Binary(string='XML Envío', readonly=False)
    xml_customer_name = fields.Char('Mombre XML Envío')
    xml_content = fields.Text(string='XML')
    xml_customer_url = fields.Char('URL XML')
    #xml_customer_att_id = fields.Many2one('ir.attachment', compute='_compute_attachment')
    xml_customer_att_id = fields.Many2one('ir.attachment')

    # xml_supplier = fields.Binary(string='XML Proveedor', readonly=False, required=True)
    # xml_supplier_name = fields.Char('Mombre XML Proveedor', required=True)

    xml_response = fields.Binary(string='XML Respuesta', readonly=False, )
    xml_response_name = fields.Char('Nombre XML Respuesta')
    xml_response_msg = fields.Text('Mensaje de Hacienda')
    xml_response_url = fields.Char('URL XML Respuesta')
    #xml_response_att_id = fields.Many2one('ir.attachment', compute='_compute_attachment')
    xml_response_att_id = fields.Many2one('ir.attachment')

    # pdf_attachment_id = fields.Many2one('ir.attachment', compute='_compute_attachment')

    active = fields.Boolean(string='Activo', default=True)

    def action_create_xml(self):
        pass

    def action_server_sent_invoice(self):
        for record in self:
            record.action_sent_hacienda()

    def action_server_consult_invoice(self):
        for record in self:
            record.action_consult_hacienda()

    def action_sent_hacienda(self):
        try:
            if not self.xml_customer:
                _logger.warning("Consecutivo - %s - no se enviara porque no tiene xml.")
                pass
            if self.xml_content:
                fields_to_search = ['false', 'False', 'FALSE']
                for field in fields_to_search:
                    if self.xml_content.find(field) != -1:
                        message = "{} - Hay algún elemento con contenido {} en el xml. Descargue el xml y revise que elemento " \
                                  "contiene error antes de enviar a Hacienda. ".format(self.consecutive, field)
                        raise ValidationError(message)

                mode = self.api_user_id.mode
                if not self.api_user_id.certifies_ids:
                    raise ValidationError("No hay certificados disponibles para el usuario")
                certified = self.api_user_id.certifies_ids[0]
                params = {
                    'secret_key': self.api_user_id.secret_key,
                    'comprobante_xml_firmado': self.xml_customer.decode('utf-8'),
                    'usuario_hacienda': certified.user_certified,
                    'contrasena_hacienda': certified.pass_certified,
                    'clave': self.key,
                    'fecha': self.date_emission_str,
                    'emisor_tipo_identificacion': self.api_user_id.identification_id.code,
                    'emisor_numero_identificacion': self.api_user_id.vat,
                }

                for k, v in params.items():
                    if v in [None, False]:
                        raise ValidationError("El valor de %s no puede estar vacío" % k)

                if self.customer_identification_id and self.customer_vat:
                    params['receptor_tipo_identificacion'] = self.customer_identification_id.code
                    params['receptor_numero_identificacion'] = self.customer_vat

                _api_res = xml_send_hacienda._send_xml(self=self, mode=mode, **params)
                data_str = _api_res.data.decode('utf-8')
                data_json = json.loads(data_str)
                response = data_json['response'] if 'response' in data_json else None
                if data_json['status_code'] == 200 and response:
                    state = '%s_%s' % (response['codigo_estado'], response['estado'])
                    self.sudo().message_post(body=state, message_type="comment", subtype_xmlid="mail.mt_comment")
                    self.state = 'processing'
                    #self.date_emission = datetime.now().date()
                else:
                    if response.find('invalid_grant'):
                        self.state = 'error'
                    self.sudo().message_post(body=response,
                                             message_type="comment",
                                             subtype_xmlid="mail.mt_comment")

                    _logger.warning(data_json['response'])
        except Exception as e:
            _logger.error(e)

    def action_consult_hacienda(self):
        try:
            mode = self.api_user_id.mode
            if not self.api_user_id.certifies_ids:
                raise ValidationError("No hay certificados disponibles para el usuario")
            certified = self.api_user_id.certifies_ids[0]
            params = {
                'secret_key': self.api_user_id.secret_key,
                'usuario_hacienda': certified.user_certified,
                'contrasena_hacienda': certified.pass_certified,
                'clave': self.key
            }

            for k, v in params.items():
                if v in [None, False]:
                    raise ValidationError("El valor de %s no puede estar vacío" % k)

            _api_res = xml_consult_hacienda._consult_xml(self=self, mode=mode, **params)
            data_str = _api_res.data.decode('utf-8')
            data_json = json.loads(data_str)
            _response = data_json['response']
            _logger.info(_response)
            if data_json['status_code'] == 200:
                response_xml = _response['respuesta_xml']
                base64_bytes = response_xml.encode('utf-8')
                self.xml_response = base64_bytes
                # self.xml_response_name = "MH_{}.xml".format(self.key)
                self.xml_response_name = "MH_{}.xml".format(self.consecutive)
                self.xml_response_url = self._get_response_url()
                self.xml_response_msg = self._get_error_message(self.xml_response)
                self.xml_response_att_id = self._create_attachment(xml=base64_bytes, xml_name=self.xml_response_name)

                status = _response['estado']
                try:
                    self.state = _RESPONSE_STATE[status]
                except Exception as e:
                    _logger.error(e)
                    self.sudo().message_post(body=e.args[0], message_type="comment", subtype_xmlid="mail.mt_comment")
            else:
                # code_state = data_json['codigo_estado']
                # status = data_json['estado']
                # message = data_json['message']
                # _msg = '%s-%s : %s' % (code_state, status, message)
                self.xml_response_msg = _response
                self.sudo().message_post(body=_response, message_type="comment", subtype_xmlid="mail.mt_comment")

            # Envío de email al emisor
            self._send_mail_provider()

        except Exception as e:
            _logger.error(e)

    def _get_url_base(self):
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        db = self.env.cr.dbname
        return base_url

    def _get_customer_url(self):
        file_name = self.xml_customer_name
        url = '%s/invoice_xml/%s/%s/%s' % (self._get_url_base(),
                                           self.api_user_id.id,
                                           self.ids[0],
                                           file_name)
        return url

    def _get_response_url(self):
        file_name = self.xml_customer_name
        url = '%s/invoice_response_xml/%s/%s/%s' % (self._get_url_base(),
                                                    self.api_user_id.id,
                                                    self.ids[0],
                                                    file_name)
        return url

    def _cron_invoice_send_hacienda(self):
        users = self._users_approved_and_actives()
        for user in users:
            _domain = [
                ('state', 'in', ['not_sent', 'error']),
                ('api_user_id', '=', user.id),
                # ('id', '=', 46)
            ]
            invoices = self.env['cr.api.invoice'].sudo().search(_domain)
            for invoice in invoices:
                invoice.action_sent_hacienda()

    def _cron_invoice_consult_hacienda(self):
        users = self._users_approved_and_actives()
        for user in users:
            _domain = [
                ('state', 'in', ['processing', 'error']),
                ('api_user_id', '=', user.id),
                # ('id', '=', 46)
            ]
            invoices = self.env['cr.api.invoice'].sudo().search(_domain)
            for invoice in invoices:
                invoice.action_consult_hacienda()

    def _users_approved_and_actives(self):
        return self.env['cr.api.users'].sudo().search([('active', '=', True)])

    def _send_mail_provider(self):
        # CORREO A EMISOR
        pass
        # invoice = self
        # if invoice.state in ['accepted', 'rejected'] and invoice.api_user_id.mail_billing_invoice_send:
        #     if invoice.api_user_id.mail_billing_invoice_send_document == 'all':
        #         invoice._send_mail()
        #     elif invoice.api_user_id.mail_billing_invoice_send_document == 'select' \
        #             and invoice.api_user_id.mail_billing_invoice_send_document_ids:
        #         if invoice.document_type_id.id in invoice.api_user_id.mail_billing_invoice_send_document_ids.ids:
        #             invoice._send_mail()

    def _send_mail(self):
        pass

    # @api.depends('xml_customer', 'xml_response')
    # def _compute_attachment(self):
    #     for record in self:
    #         xml_customer_att_id = False
    #         xml_response_att_id = False
    #         if record.xml_customer:
    #             xml_customer_att_id = record._create_attachment(xml=record.xml_customer, xml_name=record.xml_customer_name)
    #         if record.xml_response:
    #             xml_response_att_id = record._create_attachment(xml=record.xml_response, xml_name=record.xml_response_name)
    #         record.xml_customer_att_id = xml_customer_att_id
    #         record.xml_response_att_id = xml_response_att_id
    #         #record.pdf_attachment_id = False

    def _create_attachment(self, xml, xml_name):
        attachment_id = False
        if xml and xml_name:
            att_env = self.env['ir.attachment'].sudo()
            attachment_id = att_env.search([
                ('res_model', '=', self._name),
                ('res_id', '=', self.id),
                ('name', '=', xml_name)
            ], limit=1)

            data = {
                'name': xml_name,
                'datas': xml,
                'res_model': self._name,
                'res_id': self.id,
                'mimetype': 'application/xml',
                'type': 'binary',
            }

            if not attachment_id:
                try:
                    # 3. Guardar el contenido reparado
                    attachment_id = att_env.create(data)

                except Exception as e:
                    _logger.error(e)
            elif attachment_id:
                attachment_id.sudo().write(data)
        return attachment_id

    @api.onchange('state_manual')
    def _onchange_state_manual(self):
        for record in self:
            record.state = record.state_manual

    def _get_error_message(self, xml_mh_file):
        message = ''
        try:
            # DetalleMensaje
            xml = str(base64.b64decode(xml_mh_file).decode())
            string_xml_repl = re.sub(' xmlns="[^"]+"', '', xml, count=1)  # Remplaza xmlns por un vacio
            root = ET.fromstring(string_xml_repl)
            message = root.findall('DetalleMensaje')[0].text
        except Exception as e:
            _logger.error('Error al obtener el detalle del mensaje: %s', e)
        return message
