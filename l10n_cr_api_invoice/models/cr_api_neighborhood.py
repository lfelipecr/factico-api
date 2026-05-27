# -*- coding: utf-8 -*-

from odoo import models, fields, api


class ResCountryNeighborhood(models.Model):
    _name = "res.country.neighborhood"
    _description = "Country Neighborhood"

    code = fields.Char(string="Código")
    district_id = fields.Many2one(comodel_name="res.country.district", string="Distrito")
    name = fields.Char(string="Nombre")
