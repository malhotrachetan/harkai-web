
import logging
import moviepy.editor as mpe
import tempfile
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .tasks import process_video_task
from .helpers import update_zendesk_article_body



class ProcessVideo(APIView):
    permission_classes = (AllowAny,)
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        try:
            if "video" not in request.FILES:
                return Response(
                    {"success": False, "error": "No video file provided"}, status=400
                )

            video_file = request.FILES["video"]
            model = request.POST.get("model")
            global_context = request.POST.get("global_context")
            video_context = request.POST.get("video_context")
            voice = request.POST.get("voice")
            video_mode = request.POST.get("video_mode")
           

            # Save the uploaded video to a temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
                for chunk in video_file.chunks():
                    temp_video.write(chunk)
                input_video_path = temp_video.name

            # Start the Celery task
            task = process_video_task.delay(
          input_video_path,
    model,
    global_context,
    video_context,
    voice,
    video_mode
            )

            return Response({"success": True, "task_id": task.id}, status=202)
        except Exception as exception:
            logging.exception("An error occurred in ProcessVideo.post")
            return Response({"success": False, "error": str(exception)}, status=500)


class PushToCenter(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            zendesk_article_url = request.POST.get("help_center_article_url")
            body = request.POST.get("text")
            video_url = request.POST.get("video_url")
        
            body = (
            body
            + """<video width="90%" controls>
            <source src={} type="video/mp4">
            Your browser does not support the video tag.
            </video>""".format(
                            video_url
                        )
            )
            update_zendesk_article_body(zendesk_article_url, body)
            return Response({"success": True}, status=200)
        except Exception as exception:
            logging.exception("An error occurred in PushToCenter")
            return Response({"success": False, "error": str(exception)}, status=500)
            
