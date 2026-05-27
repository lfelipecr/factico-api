# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class CrApiReferenceCode(models.Model):
    _name = "cr.api.reference.code"
    _description = "Codigos de referencia"
    _order = "code asc"

    active = fields.Boolean(default=True)
    code = fields.Char()
    name = fields.Char()

    @api.depends('code', 'name')
    def _compute_display_name(self):
        for record in self:
            record.display_name = f"({record.code}) {record.name}"

    @api.model
    def name_search(self, name='', args=None, operator='ilike', limit=100):
        """ search in name, code and category"""
        args = args or []
        # search in name and code
        domain = args + ['|', ('name', operator, name), ('code', operator, name)]
        reference_codes = self.search_fetch(
            domain, ['display_name'], limit=limit,
        )
        return [(reference.id, reference.display_name) for reference in reference_codes]
