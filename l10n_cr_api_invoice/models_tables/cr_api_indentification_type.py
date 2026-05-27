#-*- coding: utf-8 -*-
from odoo import models, fields, api


class CrApiIdentificationType(models.Model):
    _name = 'cr.api.identification.type'
    _description = 'CR Api facturación - Tipo identificación'
    _order = 'code asc'
    _rec_name = 'name'

    code = fields.Char(string='Código')
    code_api = fields.Char(string='Código API')
    name = fields.Char(string='Nombre')
    notes = fields.Text(string='Notas')


