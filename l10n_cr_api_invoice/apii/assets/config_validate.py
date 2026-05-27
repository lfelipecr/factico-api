

def _validate_config_create_only_super_user(config):
    return config.cr_api_only_super_user

def _validate_secret_key(self, secret_key='', mode='production'):
    api_user = self.env['cr.api.users'].sudo().search([('secret_key', '=', secret_key),
                                                       ('mode', '=', mode)], limit=1)
    return {
        '_next': True if api_user else False,
        'api_user': api_user,
        'api_user_id': api_user.id,
    }



