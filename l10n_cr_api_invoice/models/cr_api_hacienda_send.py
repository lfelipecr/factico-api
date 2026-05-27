#-*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError
import random
import string

_MODE = [('staging', 'Prueba'), ('production', 'Producción')]
_STATE = [('new', 'Nuevo'), ('approved', 'Aprobado')]

class CrApiHaciendaSnd(models.Model):
    _name = 'cr.api.hacienda.send'
    _inherit = ['portal.mixin', 'mail.thread.main.attachment', 'mail.activity.mixin']
    _description = 'CR Api facturación - Envíos a hacienda'
    _order = 'id desc'
    _rec_name = 'document_type_id'

    api_user_id = fields.Many2one('cr.api.users', string='Usuario')
    document_type_id = fields.Many2one('cr.api.document.type', string='Tipo de documento')
    send_count = fields.Integer(string='N° Envíos')

    def _create_sent(self, api_user_id, document_type_id):
        if api_user_id and document_type_id:
            data = {
                'api_user_id': api_user_id.id,
                'document_type_id': document_type_id.id,
                'send_count': 1
            }
            self.sudo().create(data)
