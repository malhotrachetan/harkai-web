import os
from celery import Celery
from encrypted_secrets import load_secrets

load_secrets()

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'harkaibackend.settings')

app = Celery('harkaibackend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()