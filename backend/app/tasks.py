from tabnanny import verbose
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from celery import shared_task, current_task
from google.cloud import texttospeech
import moviepy.editor as mpe
import tempfile
import os
from .helpers import upload_to_s3, update_zendesk_article_body, generate_script_for_voiceover_and_text
from azure.cognitiveservices.speech import (
    AudioDataStream,
    SpeechConfig,
    SpeechSynthesizer,
    ResultReason,
    CancellationReason,
    SpeechSynthesisOutputFormat,
)

from azure.cognitiveservices.speech.audio import AudioOutputConfig
from encrypted_secrets import get_secret




@shared_task(bind=True)
def process_video_task(self, input_video_path, model, global_context, video_context, voice, video_mode):
    channel_layer = get_channel_layer()
    task_id = self.request.id
    task_group_name = f"task_{task_id}"

    try:
        # Set up Azure Speech Configuration
        script, text = generate_script_for_voiceover_and_text(input_video_path, model, global_context, video_context,video_mode)
        speech_config = SpeechConfig(subscription=get_secret("AZURE_SPEECH_KEY"), region="eastus")
        print("voice is "+voice)
        speech_config.speech_synthesis_voice_name = voice
        

        # Generate voiceover segments
        voiceover_segments = []
        for segment in script:
            print("segment is {}".format(segment))
            # Configure the audio output
            audio_output = AudioOutputConfig(filename=f"temp_{len(voiceover_segments)}.wav")
            
            # Create the synthesizer
            synthesizer = SpeechSynthesizer(speech_config=speech_config, audio_config=audio_output)
            
            # Synthesize speech
            result = synthesizer.speak_text_async(segment["text"]).get()
            print("segment result is {}".format(result))
            
            if result.reason == ResultReason.SynthesizingAudioCompleted:
                voiceover_segments.append(mpe.AudioFileClip(f"temp_{len(voiceover_segments)}.wav"))
            else:
                print(f"Error synthesizing segment: {result.reason}")
                if result.reason == ResultReason.Canceled:
                    cancellation_details = result.cancellation_details
                    print(f"CANCELED: Reason={cancellation_details.reason}")
                    if cancellation_details.reason == CancellationReason.Error:
                        print(f"CANCELED: ErrorDetails={cancellation_details.error_details}")
        print("dada")
        # Combine segments into a single voiceover track
        voiceover = mpe.concatenate_audioclips(voiceover_segments)
        print(voiceover.duration)

        # Clean up temporary files
        for i in range(len(voiceover_segments)):
            os.remove(f"temp_{i}.wav")

        # Load the video
        video = mpe.VideoFileClip(input_video_path)

        # Combine voiceover with video
        final_video = video.set_audio(voiceover)

        # Save the final video
        output_video_path = f"output/new_{os.path.basename(input_video_path)}"
        final_video.write_videofile(output_video_path, verbose=False, logger=None)

        # Upload to S3
        s3_filename = f"processed_videos/{os.path.basename(output_video_path)}"
        s3_url = upload_to_s3(output_video_path, s3_filename)
        print(s3_url)
        if s3_url:
            os.remove(output_video_path)
            os.remove(input_video_path)

            result = {"success": True, "video_url": s3_url, "text": text}
        else:

            result = {"success": False, "error": "Error uploading to S3"}
        print("result is {}".format(result))

        #update_zendesk_article_body(body=body)

        async_to_sync(channel_layer.group_send)(
            task_group_name, {"type": "task_update", "message": result}
        )
    except Exception as e:
        result = {"success": False, "error": str(e)}
        print("exception is {}".format(e))
        async_to_sync(channel_layer.group_send)(
            task_group_name, {"type": "task_update", "message": result}
        )
