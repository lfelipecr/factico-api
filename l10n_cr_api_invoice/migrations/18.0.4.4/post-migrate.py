# -*- coding: utf-8 -*-


def migrate(cr, version):
    cr.execute(
        "UPDATE cr_api_users SET state = 'approved' WHERE state = 'new' AND from_api = TRUE"
    )
