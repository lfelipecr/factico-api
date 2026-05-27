#-*- coding: utf-8 -*-
from odoo import models, fields, api


class CrApiPaymentType(models.Model):
    _name = 'cr.api.payment.type'
    _description = 'CR Api facturación - Tipo de pago(Condición venta)'
    _order = 'code asc'
    _rec_name = 'name'

    code = fields.Char(string='Código')
    name = fields.Char(string='Nombre')


