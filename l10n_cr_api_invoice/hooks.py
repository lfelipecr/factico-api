# -*- coding: utf-8 -*-


def post_init_hook(env):
    """Usuarios pendientes de aprobación manual quedan activos para el middleware."""
    env['cr.api.users'].sudo().search([('state', '=', 'new')]).write({'state': 'approved'})
