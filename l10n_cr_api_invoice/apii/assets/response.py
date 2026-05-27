from odoo import http, _
import json

def invalid_response(typ='Error', message=None, status=401):
    return http.Response(
        json.dumps(
            {
                'type': typ,
                "status_code": status,
                "response": message,
            }
        ),
        status=200,
        content_type="application/json"
    )

def valid_response(data):
    """Valid Response
    This will be returned when the HTTP request was successfully processed."""
    return http.Response(
        json.dumps(
            {
                "status_code": 200,
                "response": data
            }
        ),
        status=200,
        content_type="application/json"
    )