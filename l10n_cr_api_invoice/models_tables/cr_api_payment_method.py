# -*- coding: utf-8 -*-

from odoo import models, fields, api, _

_CODES = [
            ("01", "01 - Efectivo"),
            ("02", "02 - Tarjeta"),
            ("03", "03 - Cheque"),
            ("04", "04 - Transferencia – depósito bancario"),
            ("05", "05 - Recaudado por terceros"),
            ("06", "06 - SINPE MOVIL"),
            ("07", "07 - Plataforma Digital"),
            ("99", "99 - Otros (se debe indicar el medio de pago)"),
        ]

class CrApiPaymentMethod(models.Model):
    _name = 'cr.api.payment.method'
    _description = 'CR Api facturación - Medio de pago'

    code = fields.Selection(_CODES, string="Código Medio de Pago CR")
    name = fields.Char()

    @api.depends('code', 'name')
    def _compute_display_name(self):
        for record in self:
            record.display_name = f"({record.code}) {record.name}"
