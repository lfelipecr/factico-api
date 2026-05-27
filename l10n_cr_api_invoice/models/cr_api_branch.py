#-*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import random
import string


class CrApiBranch(models.Model):
    _name = 'cr.api.branch'
    _inherit = ['portal.mixin', 'mail.thread.main.attachment', 'mail.activity.mixin']
    _description = 'CR Api facturación - Sucursales'
    _order = 'branch_code asc, terminal_code asc'

    api_user_id = fields.Many2one('cr.api.users', string='Usuario API')
    api_user_mode = fields.Selection(related='api_user_id.mode', string='Ambiente')
    company_id = fields.Many2one('res.company', string='Compañia', related='api_user_id.company_id')
    name = fields.Char(string='Nombre', compute='_compute_name', readonly=False, store=True,
                       copy=False,tracking=True)
    branch_code = fields.Integer(string='Sucursal', required=True)
    terminal_code = fields.Integer(string='Terminal', required=True)

    api_sequence_ids = fields.One2many('cr.api.sequence', 'api_branch_id',
                                       string='Secuencias')

    @api.depends('branch_code', 'terminal_code')
    def _compute_name(self):
        for record in self:
            name = "Sucursal %s / Terminal %s" % (record.branch_code or '', record.terminal_code or '')
            record.name = name

    def action_create_sequences(self):
        try:
            if not self.api_user_id.vat:
                raise ValidationError("Antes de generar las secuencias debe ingresar el número de documento.")

            documents = self.env['cr.api.document.type'].sudo().search([('in_sale', '=', True),
                                                                        ('active', '=', True)])
            sequence_ids = []
            for document in documents:
                code = '%s.%s.%s..%s.%s' % (document.code, self.api_user_id.vat, self.api_user_mode, self.branch_code, self.terminal_code)
                name = '%s-%s_%s_%s(VAT: %s)' % (document.name, self.api_user_mode, self.branch_code, self.terminal_code, self.api_user_id.vat)
                data = {
                    'name': name,
                    'code': code,
                    'implementation': 'no_gap',
                    'prefix': '',
                    'suffix': '',
                    'padding': 10,
                    'company_id': self.company_id.id,
                }
                sequence_id = self.env['ir.sequence'].sudo().create(data)

                info = {
                    'document_type_id': document.id,
                    'sequence_id': sequence_id.id
                }

                sequence_ids.append((0, 0, info))

            self.sudo().write({'api_sequence_ids': sequence_ids})
        except Exception as e:
            self.env.cr.rollback()
            raise ValidationError(_(e))

    def validate_branch_terminal(self):
        if not self.branch_code:
            raise ValidationError("Ingrese un número de Sucursal")
        if not self.terminal_code:
            raise ValidationError("Ingrese un número de Terminal")

    def action_view_branch(self):
        self.ensure_one()
        return {
            'name': _('Sucursal, terminal, y secuencias'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'views': [[False, "form"]],
            'res_model': 'cr.api.branch',
            'target': 'current',
            'res_id': self.id
        }