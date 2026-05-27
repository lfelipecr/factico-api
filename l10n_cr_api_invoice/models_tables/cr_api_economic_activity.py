#-*- coding: utf-8 -*-
from odoo import models, fields, api


class CrApiEconomicActivity(models.Model):
    _name = 'cr.api.economic.activity'
    _description = 'CR Api facturación - Actividad económica'
    _order = 'code asc'
    _rec_name = 'name'

    sequence = fields.Integer(string='Secuencia')
    code = fields.Char(string='Código', required=True, tracking=True)
    name = fields.Char(string='Nombre',required=True,tracking=True)

    code_old = fields.Char(help='Economic Activity Code', string='Código obsoleto')
    name_old = fields.Text(help='Economic Activity Name', string='Nombre obsoleto')

    description = fields.Char(string='Descripcion')
    active = fields.Boolean(default=True)





