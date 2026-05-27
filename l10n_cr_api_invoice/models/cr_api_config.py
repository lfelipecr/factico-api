#-*- coding: utf-8 -*-
from odoo import models, fields, api
import random
import string

_MODE = [('staging', 'Prueba'), ('production', 'Producción')]

class CrApiConfig(models.Model):
    _name = 'cr.api.config'
    _inherit = ['portal.mixin', 'mail.thread.main.attachment', 'mail.activity.mixin']
    _description = 'CR Api facturación - Configuración'
    _order = 'id desc'
    _rec_name = 'name'

    company_id = fields.Many2one('res.company', string='Compañia', required=True, default=lambda self: self.env.company)
    name = fields.Char(string='Nombre', default='Configuración de Api')
    image_1920 = fields.Image("Imagen", max_width=1920, max_height=1920)
    api_active = fields.Boolean(string='Activar uso de API', tracking=True)
    api_only_super_user = fields.Boolean(string='Solo super Usuario puede crear', tracking=True)
    api_store_invoices = fields.Boolean(string='Almacenar comprobantes de Hacienda', tracking=True)

    active = fields.Boolean(string='Activo', default=True)

    _sql_constraints = [
        ('key_config_unique', 'unique (company_id, active)', 'Ya existe una configuración de API activa para esta compañía.')
    ]

    def _validate_config_api_active(self):
        companies = self.env['res.company'].sudo().search([('active', '=', True)])
        config = False
        for company in companies:
            # config = self.env['res.config.settings'].sudo().search([('company_id', '=', company.id),
            #                                                         ('cr_api_active', '=', True)], limit=1)
            config = self.env['cr.api.config'].sudo().search([('company_id', '=', company.id),
                                                              ('api_active', '=', True)], limit=1)
            if config:
                break

        return {
            '_next': True if config else False,
            'config': config,
            'api_active': config.api_active,
            'api_only_super_user': config.api_only_super_user,
            'company_id': config.company_id.id,
            'company': config.company_id,
        }
