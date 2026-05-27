#-*- coding: utf-8 -*-
from odoo import models, fields, api


class CrApiDocumentType(models.Model):
    _name = 'cr.api.document.type'
    _description = 'CR Api facturación - Tipo documento'
    _order = 'code asc'
    _rec_name = 'name'

    sequence = fields.Integer()
    name = fields.Char('Nombre')
    description = fields.Char(u'Descripción')
    code = fields.Char('Código')
    code_hacienda = fields.Char('Código hacienda')
    in_sale = fields.Boolean('En ventas')
    in_purchase = fields.Boolean('En compras')
    active = fields.Boolean(default=True, string='Activo')



