import json
from channels.generic.websocket import AsyncWebsocketConsumer

class TaskConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.task_id = self.scope['url_route']['kwargs']['task_id']
        self.group_name = f'task_{self.task_id}'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']

        # Log the received message
        print(f"Received message: {message}")

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'task_update',  # Ensure this matches the method name
                'message': message
            }
        )

    async def task_update(self, event):
        message = event['message']

        # Log the event to ensure the method is called
        print(f"task_update called with message: {message}")

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message
        }))