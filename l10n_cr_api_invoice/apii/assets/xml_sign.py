# -*- coding: utf-8 -*-
from lxml import etree
import base64
#from .. xades.context2 import  XAdESContext2, PolicyId2, create_xades_epes_signature
from ..xades import context2
#from ..xades import context2 import XAdESContext2, PolicyId2, create_xades_epes_signature
from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates
from cryptography.hazmat.backends import default_backend

policy_id = 'https://tribunet.hacienda.go.cr/docs/esquemas/2016/v4.1/Resolucion_Comprobantes_Electronicos_DGT-R-48-2016.pdf'


def generate_signature(xml, file_p12, pin):
    root = etree.fromstring(xml)
    signature = context2.create_xades_epes_signature()
    policy = context2.PolicyId2()
    policy.id = policy_id
    root.append(signature)
    ctx = context2.XAdESContext2(policy)
    private_key, cert, additional_certs = load_key_and_certificates(base64.b64decode(file_p12), pin.encode())
    ctx.load_pkcs12(cert, private_key)
    ctx.sign(signature)
    return etree.tostring(root,
                          encoding="UTF-8",
                          method="xml",
                          pretty_print=True,
                          doctype='<?xml version="1.0" encoding="UTF-8"?>')

def generate_signature2(xml, file_p12, pin):
    xml = xml.replace('&', '&amp;')
    root = etree.fromstring(xml)
    signature = context2.create_xades_epes_signature()
    policy = context2.PolicyId2()
    policy.id = policy_id
    root.append(signature)
    ctx = context2.XAdESContext2(policy)
    certificate = load_key_and_certificates(base64.b64decode(file_p12),
                                            pin.encode(),
                                            backend=default_backend()
                                            )
    ctx.load_pkcs12(certificate)
    ctx.sign(signature)
    signed = etree.tostring(root,
                          encoding="UTF-8",
                          method="xml",
                          xml_declaration=True,
                          pretty_print=True,
                          with_tail=False)

    return signed