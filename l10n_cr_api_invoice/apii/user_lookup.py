# -*- coding: utf-8 -*-
from . import assets

_EMPTY = [False, None, '']


def _lookup_user(self, mode='production', **kw):
    access = assets.provision_validate._validate_provision_access(self, kw)
    if not access['_next']:
        return assets.response.invalid_response(typ='Error', message=access['_msg'], status=403)

    _res_config = access['_res_config']
    params = ['codigo_identificacion', 'numero_identificacion']
    msg = ''
    error = 0
    for param in params:
        if kw.get(param) in _EMPTY:
            error += 1
            msg += 'El valor del campo - %s - no puede estar vacío\n' % param

    if error:
        return assets.response.invalid_response(typ='Error', message=msg, status=400)

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
        return assets.response.valid_response(data={
            'exists': False,
            'numero_identificacion': kw.get('numero_identificacion'),
            'mode': mode,
        })

    return assets.response.valid_response(
        data=assets.provision_validate._user_lookup_response(user),
    )
