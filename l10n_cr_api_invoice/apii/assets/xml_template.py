import ast
from . import utils

_EMPTY = [False, None, '', []]


class Templates:
    FacturaElectronicaCompra = utils.get_template("FacturaElectronicaCompra.jinja")
    FacturaElectronica = utils.get_template("FacturaElectronica.jinja")
    FacturaElectronicaExportacion = utils.get_template("FacturaElectronicaExportacion.jinja")
    TiqueteElectronico = utils.get_template("TiqueteElectronico.jinja")
    NotaCreditoElectronica = utils.get_template("NotaCreditoElectronica.jinja")
    NotaDebitoElectronica = utils.get_template("NotaDebitoElectronica.jinja")
    ReciboPagoElectronico = utils.get_template("ReciboPagoElectronico.jinja")
    MensajeReceptor = utils.get_template("MensajeReceptor.jinja")


DOCUMENT_TYPE_TO_TEMPLATE = {
    "TE": Templates.TiqueteElectronico,
    "FE": Templates.FacturaElectronica,
    "FEE": Templates.FacturaElectronicaExportacion,
    "NC": Templates.NotaCreditoElectronica,
    "ND": Templates.NotaDebitoElectronica,
    "REP": Templates.ReciboPagoElectronico,
    "MR": Templates.MensajeReceptor,
    "FEC": Templates.FacturaElectronicaCompra,
}


def _xml(self, params):
    document_type = params['tipo_documento']
    sw = False
    for key, value in DOCUMENT_TYPE_TO_TEMPLATE.items():
        if key == document_type:
            sw = True
            break
    if not sw:
        return {'render_xml': False, 'msg': 'No se encontró el tipo de documento : %s' % document_type}

    template = DOCUMENT_TYPE_TO_TEMPLATE[document_type]
    render = template.render(data=params)
    return {'render_xml': render, 'msg': False}


def _validations(params):
    if params['tipo_documento'] in ['REP']:
        return _validationsREP(params)
    elif params['tipo_documento'] in ['MR']:
        return _validationsMR(params)
    if params['tipo_documento'] in ['FEC']:
        return _validationsFEC(params)
    else:
        _requires = [
            'secret_key', 'tipo_documento', 'clave', 'proveedor_sistemas', 'consecutivo', 'fecha_emision',
            'emisor_nombre', 'emisor_tipo_identificacion', 'emisor_numero_identififcacion',
            'emisor_provincia', 'emisor_canton', 'emisor_distrito',
            'receptor_nombre',
            'codigo_actividad_emisor',
            'condicion_venta', 'plazo_credito', 'codigo_moneda', 'codigo_moneda',
            'total_serv_gravados', 'total_serv_exentos', 'total_serv_exonerado', 'total_serv_no_sujeto',
            'total_merc_gravadas', 'total_merc_exentas', 'total_merc_exonerada', 'total_merc_no_sujeta',
            'total_gravado', 'total_exento', 'total_exonerado', 'total_no_sujeto',
            'total_venta', 'total_descuentos', 'total_venta_neta', 'total_impuesto',
            'total_impuestos_asumidos_fabrica', 'total_iva_devuelto', 'total_otros_cargos',
            'total_comprobante',

        ]
        if params['tipo_documento'] in ['FE' ,'REP']:
            _requires.append('receptor_tipo_identificacion')
            _requires.append('receptor_numero_identificacion')

        _fields_special = [{'field': 'medios_pago', 'type': 'list', 'required': True},
                           {'field': 'detalle_servicio', 'type': 'list', 'required': True},
                           {'field': 'total_desglose_impuesto', 'type': 'list', 'required': False},
                           ]
        error = 0
        msg = ''
        for require in _requires:
            val = params.get(require, '')
            if val in _EMPTY:
                msg += 'El campo %s no puede estar vacío\n' % require
                error += 1

        for _field_special in _fields_special:
            val = params.get(_field_special['field'], '')
            if val in _EMPTY and _field_special['required']:
                msg += 'El campo %s no puede estar vacío\n' % _field_special['field']
                error += 1
            elif _field_special['type'] == 'list':
                if type(val) == list:
                    new_val = val
                else:
                    new_val = ast.literal_eval(val)
                if type(new_val) != list:
                    msg += 'El campo %s debe ser una lista\n' % _field_special['field']
                    error += 1
                else:
                    params[_field_special['field']] = new_val

        if error == 0:
            if params.get('tipo_documento') in ['NC', 'ND']:

                if 'informacion_referencia' not in params:
                    msg += 'El campo informacion_referencia debe estar definido en la data\n'
                    error += 1
                elif params['informacion_referencia'] in _EMPTY:
                    msg += 'El campo informacion_referencia no puede estar vacío\n'
                    error += 1
                else:
                    informacion_referencia = params.get('informacion_referencia')
                    if type(informacion_referencia) == dict:
                        new_val = informacion_referencia
                    else:
                        new_val = ast.literal_eval(informacion_referencia)
                    if type(new_val) != dict:
                        msg += 'El campo informacion_referencia debe ser un diccionario\n'
                        error += 1
                    elif new_val in _EMPTY:
                        msg += 'El campo informacion_referencia no debe estar vacío\n'
                        error += 1
                    else:
                        informacion_referencia_fields = ['tipo_doc_ir', 'tipo_doc_ref_otro',
                                                         'numero', 'fecha_emision_ir',
                                                         'codigo', 'codigo_referencia_otro',
                                                         'razon']

                        for _field in informacion_referencia_fields:
                            if _field not in informacion_referencia:
                                msg += 'El campo %s debe estar contenido en - informacion_referencia - \n' % _field
                                error += 1
                        params['informacion_referencia'] = new_val

        return {
            '_next': True if error == 0 else False,
            '_msg': msg,
            'params': params
        }


def _validationsFEC(params):
    _requires = [
        'secret_key', 'tipo_documento', 'clave', 'proveedor_sistemas', 'consecutivo', 'fecha_emision',
        'receptor_nombre', 'receptor_tipo_identificacion', 'receptor_numero_identificacion',
        'receptor_provincia', 'receptor_canton', 'receptor_distrito',
        'receptor_nombre',
        'codigo_actividad_receptor',
        'condicion_venta', 'plazo_credito', 'codigo_moneda', 'codigo_moneda',
        'total_serv_gravados', 'total_serv_exentos', 'total_serv_exonerado', 'total_serv_no_sujeto',
        'total_merc_gravadas', 'total_merc_exentas', 'total_merc_exonerada', 'total_merc_no_sujeta',
        'total_gravado', 'total_exento', 'total_exonerado', 'total_no_sujeto',
        'total_venta', 'total_descuentos', 'total_venta_neta', 'total_impuesto',
        'total_impuestos_asumidos_fabrica', 'total_iva_devuelto', 'total_otros_cargos',
        'total_comprobante',

    ]

    _fields_special = [{'field': 'medios_pago', 'type': 'list', 'required': True},
                       {'field': 'detalle_servicio', 'type': 'list', 'required': True},
                       {'field': 'total_desglose_impuesto', 'type': 'list', 'required': False},
                       {'field': 'informacion_referencia', 'type': 'list', 'required': True},
                       ]
    error = 0
    msg = ''
    for require in _requires:
        val = params.get(require, '')
        if val in _EMPTY:
            msg += 'El campo %s no puede estar vacío\n' % require
            error += 1

    for _field_special in _fields_special:
        val = params.get(_field_special['field'], '')
        if val in _EMPTY and _field_special['required']:
            msg += 'El campo %s no puede estar vacío\n' % _field_special['field']
            error += 1
        elif _field_special['type'] == 'list':
            if type(val) == list:
                new_val = val
            else:
                new_val = ast.literal_eval(val)
            if type(new_val) != list:
                msg += 'El campo %s debe ser una lista\n' % _field_special['field']
                error += 1
            else:
                params[_field_special['field']] = new_val

    return {
        '_next': True if error == 0 else False,
        '_msg': msg,
        'params': params
    }


def _validationsREP(params):
    _requires = [
        'secret_key', 'tipo_documento', 'clave', 'proveedor_sistemas', 'consecutivo', 'fecha_emision',
        'emisor_nombre', 'emisor_tipo_identificacion', 'emisor_numero_identififcacion',
        'emisor_provincia', 'emisor_canton', 'emisor_distrito',
        'receptor_nombre',
        #'receptor_tipo_identificacion', 'receptor_numero_identificacion',
        'condicion_venta', 'codigo_moneda',
        'total_venta', 'total_venta_neta', 'total_impuesto',
        'total_comprobante',

    ]

    _fields_special = [{'field': 'medios_pago', 'type': 'list'},
                       {'field': 'detalle_servicio', 'type': 'list'},
                       {'field': 'total_desglose_impuesto', 'type': 'list'},
                       ]
    error = 0
    msg = ''
    for require in _requires:
        val = params.get(require, '')
        if val in _EMPTY:
            msg += 'El campo %s no puede estar vacío\n' % require
            error += 1

    for _field_special in _fields_special:
        val = params.get(_field_special['field'], '')
        if val in _EMPTY:
            msg += 'El campo %s no puede estar vacío\n' % _field_special['field']
            error += 1
        elif _field_special['type'] == 'list':
            if type(val) == list:
                new_val = val
            else:
                new_val = ast.literal_eval(val)
            if type(new_val) != list:
                msg += 'El campo %s debe ser una lista\n' % _field_special['field']
                error += 1
            else:
                params[_field_special['field']] = new_val

    if error == 0:
        if 'informacion_referencia' not in params:
            msg += 'El campo informacion_referencia debe estar definido en la data\n'
            error += 1
        elif params['informacion_referencia'] == _EMPTY:
            msg += 'El campo informacion_referencia no puede estar vacío\n'
            error += 1
        else:
            informacion_referencia = params.get('informacion_referencia')
            if type(informacion_referencia) == dict:
                new_val = informacion_referencia
            else:
                new_val = ast.literal_eval(informacion_referencia)
            if type(new_val) != dict:
                msg += 'El campo informacion_referencia debe ser un diccionario\n'
                error += 1
            elif new_val in _EMPTY:
                msg += 'El campo informacion_referencia no debe estar vacío\n'
                error += 1
            else:
                informacion_referencia_fields = ['tipo_doc_ir', 'tipo_doc_ref_otro',
                                                 'numero', 'fecha_emision_ir',
                                                 'codigo', 'codigo_referencia_otro',
                                                 'razon']

                for _field in informacion_referencia_fields:
                    if _field not in informacion_referencia:
                        msg += 'El campo %s debe estar contenido en - informacion_referencia - \n' % _field
                        error += 1
                params['informacion_referencia'] = new_val

    return {
        '_next': True if error == 0 else False,
        '_msg': msg,
        'params': params
    }

def _validationsMR(params):
    _requires = [
        'secret_key',
        'tipo_documento',
        'clave',
        'numero_cedula_emisor',
        'fecha_emision_documento',
        'mensaje',
        'total_factura',
        'numero_cedula_receptor', 'numero_consecutivo_receptor'
    ]

    error = 0
    msg = ''
    for require in _requires:
        val = params.get(require, '')
        if val in _EMPTY:
            msg += 'El campo %s no puede estar vacío\n' % require
            error += 1

    return {
        '_next': True if error == 0 else False,
        '_msg': msg,
        'params': params
    }
