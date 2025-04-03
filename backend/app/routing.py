from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/tasks/<task_id>/', consumers.TaskConsumer.as_asgi()),
]