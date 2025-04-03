"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.1/howto/deployment/wsgi/
"""

import os
from encrypted_secrets import load_secrets
from django.core.wsgi import get_wsgi_application

load_secrets()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "harkaibackend.settings")

application = get_wsgi_application()
