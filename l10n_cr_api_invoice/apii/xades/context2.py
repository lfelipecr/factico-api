# Lib to sign Xades-EPES xml docx
# 2019 por Ricardo Vong <rvong@indelsacr.com>
# Based on Tobella's original Xades implementation

from base64 import b64decode, b64encode
from urllib import parse, request
import logging
import datetime
import pytz
import random

__all__ = ['XAdESContext2', 'PolicyId2', 'PolicyId2Exception', 'create_xades_epes_signature']

_logger = logging.getLogger(__name__)

from .xades import XAdESContext, PolicyId, template, constants
from .xades.constants import NS_MAP, EtsiNS, MAP_HASHLIB
from . import xmlsig
import re

import sys
# pip3 install uniqid
#import uniqid
import hashlib
    
from . import get_reversed_rdns_name



URL_ESCAPE_PATTERN = re.compile('[\r\n]')
URL_HACIENDA_PATTERN = re.compile('.+\.hacienda\.go\.cr$')

def create_signature_id():
    min = 1
    max = 9999
    #unique = uniqid.uniqid(str(random.randint(0, sys.maxsize)),True)
    unique = '{:04d}'.format(random.randint(min, max))
    uuid = hashlib.md5(unique.encode("utf-8")).hexdigest()
    guid = '%s-%s-%s-%s-%s'  %(uuid[0:8], uuid[8:4+8], uuid[12:4+12], uuid[16:4+16], uuid[20:12+20])
    return guid


def create_xades_epes_signature(sign_date=datetime.datetime.now(pytz.timezone('UTC'))):

    signature_id = "id-%s" %(create_signature_id())
    key_info_id = 'KeyInfoId-' + signature_id
    reference_id = "Reference-%s" %(create_signature_id())
    signed_properties_id = 'SignedProperties-' + signature_id
    signature = xmlsig.template.create(
        xmlsig.constants.TransformInclC14N,
        xmlsig.constants.TransformRsaSha256,
        signature_id
    )

    # Reference to Document Digest
    ref = xmlsig.template.add_reference(signature, xmlsig.constants.TransformSha256, reference_id, uri="")
    xmlsig.template.add_transform(ref, xmlsig.constants.TransformEnveloped)
    xmlsig.template.add_transform(ref, xmlsig.constants.TransformInclC14N)
    # Reference to KeyInfo Digest
    ref = xmlsig.template.add_reference(signature, xmlsig.constants.TransformSha256, 'ReferenceKeyInfo' ,
        uri='#%s' %key_info_id)
    xmlsig.template.add_transform(ref, xmlsig.constants.TransformInclC14N)
    # Reference to the SignedProperties Digest
    ref = xmlsig.template.add_reference(signature, xmlsig.constants.TransformSha256,
        uri='#%s' %signed_properties_id, uri_type='http://uri.etsi.org/01903#SignedProperties')
    xmlsig.template.add_transform(ref, xmlsig.constants.TransformInclC14N)

    ki = xmlsig.template.ensure_key_info(signature, name=key_info_id)
    x509_data = xmlsig.template.add_x509_data(ki)

    xmlsig.template.x509_data_add_certificate(x509_data)
    xmlsig.template.add_key_value(ki)
    qualifying = template.create_qualifying_properties(signature, 'XadesObjects', 'xades')
    props = template.create_signed_properties(qualifying, name=signed_properties_id, datetime=sign_date)
    # Manually add DataObjectFormat
    data_obj = xmlsig.utils.create_node('SignedDataObjectProperties', props, ns=constants.EtsiNS, tail='\n')
    obj_format = xmlsig.utils.create_node('DataObjectFormat', data_obj, ns=constants.EtsiNS, tail='\n')
    obj_format.set('ObjectReference', '#' + reference_id)
    xmlsig.utils.create_node('MimeType', obj_format, ns=constants.EtsiNS, text='text/xml', tail='\n')
    xmlsig.utils.create_node('Encoding', obj_format, ns=constants.EtsiNS, text='UTF-8', tail='\n')
    return signature


class XAdESContext2(XAdESContext):

    def fill_x509_issuer_name(self, x509_issuer_serial):
        """
        Fills the X509IssuerSerial node
        :param x509_issuer_serial: X509IssuerSerial node
        :type x509_issuer_serial: lxml.etree.Element
        :return: None
        """
        x509_issuer_name = x509_issuer_serial.find('ds:X509IssuerName', namespaces=NS_MAP)
        if x509_issuer_name is not None:
            x509_issuer_name.text = get_reversed_rdns_name(self.x509.issuer.rdns)
        x509_issuer_number = x509_issuer_serial.find('ds:X509SerialNumber', namespaces=NS_MAP)
        if x509_issuer_number is not None:
            x509_issuer_number.text = str(self.x509.serial_number)

    def is_signed(self, node):
        """
        Check if document is already signed
        :param node: etree node
        :return: true if already signed
        """
        signed_value = node.find('ds:SignatureValue', namespaces=NS_MAP)
        return signed_value is not None and len(signed_value.text) > 0


def validate_hacienda_url(url):
    """
    Checks for malicious url to avoid surprises
    :param url: text url
    :return: the valid url if valid or None is invalid
    """
    url_unescaped = parse.unquote(url)
    if URL_ESCAPE_PATTERN.search(url_unescaped):
        return None
    p = parse.urlparse(url_unescaped, allow_fragments=False)
    if URL_HACIENDA_PATTERN.match(p.netloc) is None:
        return None
    return url


class PolicyId2Exception(Exception):
    pass


class PolicyId2(PolicyId):
    check_strict = False
    hash_method2 = xmlsig.constants.TransformSha256
    hash_method = xmlsig.constants.TransformSha1

    def calculate_policy_node(self, node, sign=False):
        if not (sign or self.check_strict):
            return None
        if sign:
            remote = self.id
            hash_method2 = self.hash_method2
            policy_id = xmlsig.utils.create_node('SignaturePolicyId', node, EtsiNS, tail='\n')
            identifier = xmlsig.utils.create_node('SigPolicyId', policy_id, EtsiNS, tail='\n')
            xmlsig.utils.create_node('Identifier', identifier, EtsiNS, text=self.id,tail='\n')
            xmlsig.utils.create_node('Description', identifier, EtsiNS, text=self.name,tail='\n')
            digest = xmlsig.utils.create_node('SigPolicyHash', policy_id, EtsiNS, tail='\n')
            digest_method = xmlsig.utils.create_node('DigestMethod', digest, xmlsig.constants.DSigNs,  tail='\n')
            digest_method.set('Algorithm', self.hash_method2)
            digest_value = xmlsig.utils.create_node('DigestValue', digest, xmlsig.constants.DSigNs, tail='\n')
        else:
            policy_id = node.find('etsi:SignaturePolicyId', namespaces=NS_MAP)
            identifier = policy_id.find('etsi:SigPolicyId', namespaces=NS_MAP)
            remote = identifier.find('etsi:Identifier', namespaces=NS_MAP).text
            hash_method2 = policy_id.find('etsi:SigPolicyHash/ds:DigestMethod', namespaces=NS_MAP).get('Algorithm')
            doc_digest_data = policy_id.find('etsi:SigPolicyHash/ds:DigestValue', namespaces=NS_MAP).text
        # Break the transform function

        # if remote in self.cache and hash_method2 in self.cache[remote]:
        if remote:
            # # Esta comentado porque no se como leer de forma mas rapida
            # digest_data = request.urlopen(remote).read()
            # hash_calc = hashlib.new(xmlsig.constants.TransformUsageDigestMethod[hash_method2])
            # hash_calc.update(digest_data)
            # digest_data = b64encode(hash_calc.digest()).decode()
            digest_data = 'vPjYEG5pdxOi+6DB29+KqF3I4VOcMEaixzE3d2iUiJk='
            if sign:
                digest_value.text = digest_data
            else:
                assert doc_digest_data == digest_data
        else:
            url = validate_hacienda_url(remote)
            if url is None:
                raise PolicyId2Exception('Invalid url')
            digest_data = request.urlopen(url).read()  # remote.encode()
            hash_calc = hashlib.new(xmlsig.constants.TransformUsageDigestMethod[hash_method2])
            hash_calc.update(digest_data)
            digest_data = b64encode(hash_calc.digest()).decode()
            if sign:
                digest_value.text = digest_data
            else:
                assert doc_digest_data == digest_data
        return policy_id

    def calculate_certificate(self, node, key_x509):
        cert = xmlsig.utils.create_node('Cert', node, EtsiNS, tail='\n')
        cert_digest = xmlsig.utils.create_node('CertDigest', cert, EtsiNS, tail='\n')
        digest_algorithm = xmlsig.utils.create_node('DigestMethod', cert_digest, xmlsig.constants.DSigNs, tail='\n')
        digest_algorithm.set('Algorithm', self.hash_method)
        digest_value = xmlsig.utils.create_node('DigestValue', cert_digest, xmlsig.constants.DSigNs,tail='\n')
        digest_value.text = b64encode(key_x509.fingerprint(MAP_HASHLIB[self.hash_method]()))
        issuer_serial = xmlsig.utils.create_node('IssuerSerial', cert, EtsiNS, tail='\n')
        xmlsig.utils.create_node('X509IssuerName', issuer_serial,
                    xmlsig.constants.DSigNs, text=get_reversed_rdns_name(key_x509.issuer.rdns),tail='\n')

        xmlsig.utils.create_node('X509SerialNumber', issuer_serial, xmlsig.constants.DSigNs, text=str(key_x509.serial_number),tail='\n')
        return
