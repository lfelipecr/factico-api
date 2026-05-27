# -*- coding: utf-8 -*-

from odoo import models, fields, api



class ResCountryDistrict(models.Model):
    _name = "res.country.district"
    _description = "Country District"

    code = fields.Char(string="Código")
    county_id = fields.Many2one(comodel_name="res.country.county", string="Cantón")
    name = fields.Char(string="Nombre")

