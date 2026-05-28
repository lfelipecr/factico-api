#-*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError
import random
import string

_MODE = [('staging', 'Prueba'), ('production', 'Producción')]
_STATE = [('new', 'Nuevo'), ('approved', 'Aprobado')]
_SEND_MAIL_DOCUMENT_TYPE = [('all', 'Todos los documentos'), ('select', 'Seleccionar documentos')]


class CrApiUsers(models.Model):
    _name = 'cr.api.users'
    _inherit = ['portal.mixin', 'mail.thread.main.attachment', 'mail.activity.mixin']
    _description = 'CR Api facturación - Usuarios'
    _order = 'id desc'
    _rec_name = 'complete_name'

    company_id = fields.Many2one('res.company', string='Compañia', required=True, default=lambda self: self.env.company)
    complete_name = fields.Char(compute='_compute_complete_name', string='Nombre completo')
    user_name = fields.Char(string='Nombre')
    identification_id = fields.Many2one('cr.api.identification.type', string='Tipo Identificación', required=True, index=True)
    vat = fields.Char(string='N° Documento')
    email = fields.Char(string='Email')

    # ENVIAR CORREO
    mail_billing_invoice_send = fields.Boolean(string='Enviar correo de comprobantes')
    mail_billing_invoice_send_copy = fields.Boolean(string="Copia correo a este usuario")
    mail_billing_invoice_email = fields.Char(string="Correo electrónico")
    mail_billing_invoice_send_document = fields.Selection(_SEND_MAIL_DOCUMENT_TYPE, string='Enviar correo a ', default='all')
    mail_billing_invoice_send_document_ids = fields.Many2many('cr.api.document.type', string='Tipos de Documento')

    #password = fields.Char(string='Contraseña')
    tag_ids = fields.Many2many('cr.api.tags', string='Tags')
    secret_key = fields.Char(string='Secret Key', tracking=True, copy=False)
    from_api = fields.Boolean(default=False, string='Creado desde API', tracking=True)
    mode = fields.Selection(_MODE, string='Ambiente', required=True, default='staging')
    state = fields.Selection(_STATE, string='Estado', required=True, default='approved')

    #Actividad económica
    economic_activity_ids = fields.Many2many('cr.api.economic.activity',
                                    'rel_user_activitie', 'user_id', 'activity_id',
                                    string="Actividades económicas")
    economic_activity_id = fields.Many2one('cr.api.economic.activity', string="Actividad económica principal", store=True)

    certifies_ids = fields.One2many('cr.api.certifies', 'api_user_id', string='Certificados', copy=False)

    country_id = fields.Many2one('res.country', string='País',
                                 default=lambda self: self.env.ref("base.cr") if self.env.user.company_id.country_id == self.env.ref("base.cr") else False)
    province_id = fields.Many2one('res.country.state', string='Provincia', copy=False)
    canton_id = fields.Many2one("res.country.county", string="Cantón", copy=False)
    district_id = fields.Many2one("res.country.district", string="Distrito", copy=False)
    neighborhood_id = fields.Many2one("res.country.neighborhood", string="Barrios", copy=False)
    mobile = fields.Char(string="Teléfono", copy=False)

    sent_ids = fields.One2many('cr.api.hacienda.send', 'api_user_id', string='Envíos')
    count_total_sent = fields.Integer(compute='_compute_count_total_sent', string='Total de envios', store=True)

    active = fields.Boolean(string='Activo', default=True)

    _sql_constraints = [
        ('key_user_unique', 'unique (company_id, identification_id, vat, mode, active)', 'El usuario ya se encuentra registrado para este ambiente y está activo.')
    ]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('from_api'):
                vals['state'] = 'approved'
        return super().create(vals_list)

    @api.constrains('certifies_ids')
    def _constrain_certifies_ids(self):
        for record in self:
            if record.certifies_ids and len(record.certifies_ids.ids) > 1:
                raise ValidationError("Solo puede tener un certificado por usuario")

    @api.model
    def generate_secret_key(self):
        """Generate a random secret key"""
        self.ensure_one()
        base = '%s|%s|%s' % (self.identification_id.code, self.vat, self.mode)
        random.seed(base)  # usar el número como semilla
        characters = string.ascii_letters + string.digits
        secret_key = ''.join(random.choice(characters) for _ in range(32))
        return secret_key

    @api.depends('user_name', 'state')
    def _compute_complete_name(self):
        for record in self:
            if record.state and record.state == 'staging':
                record.complete_name = '%s (Prueba)' % (record.user_name)
            else:
                record.complete_name = record.user_name

    def save_secret_key(self):
        for record in self:
            secret_key = record.sudo().generate_secret_key()
            record.secret_key = secret_key

    def action_update_secret_key(self):
        self.action_create_secret_key()

    def action_create_secret_key(self):
        for record in self:
            record.save_secret_key()

    def action_view_certifies(self):
        if not self.certifies_ids:
            raise ValidationError("El usuario no tiene certificados asignados")
        return {
            "type": "ir.actions.act_window",
            "res_model": "cr.api.certifies",
            "domain": [('id', 'in', self.certifies_ids.ids)],
            "name": "Certificados",
            'view_mode': 'list,form',
        }

    def action_approved(self):
        self.ensure_one()
        self.state = 'approved'

    def action_new(self):
        self.ensure_one()
        self.state = 'new'

    def _get_state_user(self):
        return self.state

    def action_new_certified(self):
        return {
            'name': "Nuevo certificado",
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'cr.api.certifies',
            'target': 'current',
            'context': {
                'active_model': 'cr.api.users',
                'active_ids': self.ids,
                'default_api_user_id': self.ids[0]
            },
        }

    def _get_report_base_filename(self):
        self.ensure_one()
        return 'Documentos_electronicos(%s)' % (self.user_name)

    @api.depends('sent_ids', 'sent_ids.send_count')
    def _compute_count_total_sent(self):
        for record in self:
            count_total_sent = 0
            for sent in record.sent_ids:
                count_total_sent += sent.send_count
            record.count_total_sent = count_total_sent

    def _update_sent_ids(self, code_document_type):
        document_type = self.env['cr.api.document.type'].sudo().search([('code', '=', code_document_type)], limit=1)
        hacienda_sent = self.env['cr.api.hacienda.send'].sudo()
        if self.sent_ids and document_type:
            line_sent = self.sent_ids.filtered(lambda s: s.document_type_id.id == document_type.id)
            if line_sent:
                line_sent.sudo().write({'send_count': line_sent.send_count + 1})
            else:
                hacienda_sent._create_sent(api_user_id=self, document_type_id=document_type)
        elif document_type:
            hacienda_sent._create_sent(api_user_id=self, document_type_id=document_type)