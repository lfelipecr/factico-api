#-*- coding: utf-8 -*-
from odoo import models, fields, api
import random
import string

_MODE = [('staging', 'Prueba'), ('production', 'Producción')]

class CrApiCertifies(models.Model):
    _name = 'cr.api.certifies'
    _inherit = ['portal.mixin', 'mail.thread.main.attachment', 'mail.activity.mixin']
    _description = 'CR Api facturación - Certificados'
    _order = 'id desc'
    _rec_name = 'file_name'

    api_user_id = fields.Many2one('cr.api.users', string='Usuario API')
    api_user_mode = fields.Selection(related='api_user_id.mode', string='Ambiente')
    company_id = fields.Many2one('res.company', string='Compañia', related='api_user_id.company_id')

    file_p12 = fields.Binary(string='Llave p12', readonly=False, required=True)
    file_name = fields.Char('Archivo nombre', required=True)
    file_code = fields.Char(string='Código de certificado', readonly=True, tracking=True)

    user_certified = fields.Char(string='Usuario de certificado', readonly=False, tracking=True)
    pass_certified = fields.Char(string='Constraseña de certificado', readonly=False, tracking=True)
    pin = fields.Char(string='PIN', readonly=False, tracking=True)

    active =fields.Boolean(string='Activo', default=True)

    @api.model
    def generate_file_code(self):
        """Generate a random secret key"""
        self.ensure_one()
        base = '%s|%s|%s' % (self.api_user_id.id, self.ids[0], self.api_user_mode)
        random.seed(base)  # usar el número como semilla
        characters = string.ascii_letters + string.digits
        file_code = ''.join(random.choice(characters) for _ in range(32))
        return file_code

    def save_file_code(self):
        for record in self:
            file_code = record.sudo().generate_file_code()
            record.file_code = file_code

    def action_update_file_code(self):
        self.action_generate_file_code()

    def action_generate_file_code(self):
        for record in self:
            self.save_file_code()
