# -*- coding: utf-8 -*-
from . import assets

_EMPTY = [False, None, '']


def _update_user(self, mode='production', **kw):
    access = assets.provision_validate._validate_provision_access(self, kw)
    if not access['_next']:
        return assets.response.invalid_response(typ='Error', message=access['_msg'], status=403)

    _res_config = access['_res_config']
    secret_key = kw.get('secret_key')
    user = None

    if secret_key not in _EMPTY:
        _res = assets.config_validate._validate_secret_key(
            self=self, secret_key=secret_key, mode=mode,
        )
        if not _res['_next']:
            return assets.response.invalid_response(typ='Error', message=_res['_msg'], status=400)
        user = _res['api_user']
    else:
        if kw.get('codigo_identificacion') in _EMPTY or kw.get('numero_identificacion') in _EMPTY:
            return assets.response.invalid_response(
                typ='Error',
                message='Indique secret_key o codigo_identificacion + numero_identificacion',
                status=400,
            )
        user, find_msg = assets.provision_validate._find_api_user_by_identification(
            self,
            mode,
            _res_config['company_id'],
            kw.get('codigo_identificacion'),
            kw.get('numero_identificacion'),
        )
        if find_msg:
            return assets.response.invalid_response(typ='Error', message=find_msg, status=400)
        if not user:
            return assets.response.invalid_response(
                typ='Error', message='Usuario API no encontrado', status=404,
            )

    patch = {}
    if kw.get('usuario_nombre') not in _EMPTY:
        patch['user_name'] = kw.get('usuario_nombre')
    if kw.get('correo') not in _EMPTY:
        patch['email'] = kw.get('correo')
    if kw.get('state') in ('approved', 'new'):
        patch['state'] = kw.get('state')

    if not patch:
        return assets.response.invalid_response(
            typ='Error',
            message='No hay campos para actualizar (usuario_nombre, correo, state)',
            status=400,
        )

    try:
        user.sudo().write(patch)
        if not user.secret_key:
            user.sudo().save_secret_key()
        data = assets.provision_validate._user_lookup_response(user)
        data['updated'] = True
        return assets.response.valid_response(data=data)
    except Exception as e:
        return assets.response.invalid_response(typ='Error', message=str(e.args[0]), status=500)
