#-*- coding: utf-8 -*-
from odoo import models, fields, api
import random
import string

_MODE = [('staging', 'Prueba'), ('production', 'Producción')]

class CrApiSequence(models.Model):
    _name = 'cr.api.sequence'
    _inherit = ['portal.mixin', 'mail.thread.main.attachment', 'mail.activity.mixin']
    _description = 'CR Api facturación - Secuencias'
    _order = 'id desc'
    _rec_name = 'sequence_id'


    api_branch_id = fields.Many2one('cr.api.branch', string='Surcusal/Rama')
    api_user_id = fields.Many2one('cr.api.users', related='api_branch_id.api_user_id',
                                  string='Usuario API')
    api_user_mode = fields.Selection(related='api_user_id.mode', string='Ambiente')
    company_id = fields.Many2one('res.company', string='Compañia', related='api_user_id.company_id')

    document_type_id = fields.Many2one('cr.api.document.type', string='Documento')
    sequence_id = fields.Many2one('ir.sequence', string='Secuencia')
    sequence_number_next_actual = fields.Integer(related='sequence_id.number_next_actual', readonly=False,
                                                 string='Siguiente número')