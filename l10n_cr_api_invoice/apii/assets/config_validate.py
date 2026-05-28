

def _validate_config_create_only_super_user(config):
    return config.cr_api_only_super_user

def _validate_secret_key(self, secret_key='', mode='production'):
    api_user = self.env['cr.api.users'].sudo().search([('secret_key', '=', secret_key),
                                                       ('mode', '=', mode)], limit=1)
    if not api_user:
        return {
            '_next': False,
            'api_user': api_user,
            'api_user_id': False,
            '_msg': 'No se encontró usuario para la secret key: %s' % secret_key,
        }
    if not api_user.active:
        return {
            '_next': False,
            'api_user': api_user,
            'api_user_id': api_user.id,
            '_msg': 'El usuario API se encuentra inactivo',
        }
    return {
        '_next': True,
        'api_user': api_user,
        'api_user_id': api_user.id,
        '_msg': False,
    }



