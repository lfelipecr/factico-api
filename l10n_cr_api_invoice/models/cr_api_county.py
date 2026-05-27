# -*- coding: utf-8 -*-

from odoo import models, fields, api


class ResCountryCounty(models.Model):
    _name = "res.country.county"
    _description = "Country County"

    code = fields.Char(string="Código")
    state_id = fields.Many2one(comodel_name="res.country.state", string="Province")
    name = fields.Char(string="Nombre")

