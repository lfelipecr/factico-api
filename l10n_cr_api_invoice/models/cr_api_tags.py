# -*- coding: utf-8 -*-
from random import randint
from odoo import fields, models


class CrApiTags(models.Model):
    _name = 'cr.api.tags'
    _description = 'CR Api facturación - Tags'
    _order = 'id desc'
    _rec_name = 'name'

    def _get_default_color(self):
        return randint(1, 11)

    name = fields.Char('Nombre', required=True, translate=True)
    color = fields.Integer('Color', default=_get_default_color)

    _sql_constraints = [
        ('name_uniq', 'unique (name)', "Tag name already exists!"),
    ]
