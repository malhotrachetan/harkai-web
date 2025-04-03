import boto3
from botocore.exceptions import NoCredentialsError
import os
import json
import requests
from requests.auth import HTTPBasicAuth
import time
import google.generativeai as genai
from encrypted_secrets import get_secret



# AWS S3 configuration
AWS_ACCESS_KEY = get_secret("HARKAI_AWS_ACCESS_KEY")
AWS_SECRET_KEY = get_secret("HARKAI_AWS_ACCESS_SECRET")
S3_BUCKET = "harkai-personal"
S3_REGION = "us-east-1"  # e.g., 'us-east-1'
ZENDESK_SUBDOMAIN = get_secret("ZENDESK_SUBDOMAIN")
ZENDESK_EMAIL = get_secret("ZENDESK_EMAIL")
ZENDESK_API_TOKEN = get_secret("ZENDESK_API_TOKEN")
GOOGLE_API_KEY = get_secret("HARKAI_GOOGLE_STUDIO_KEY")



genai.configure(api_key=GOOGLE_API_KEY)


#'''get_secret("HARKAI_GOOGLE_AI_STUDIO_API_KEY")'''
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 1,
    "max_output_tokens": 8192,
    "response_mime_type": "application/json"
}

# Initialize S3 client
s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=S3_REGION,
)


def upload_to_s3(local_file, s3_file):
    try:
        s3_client.upload_file(
            local_file, S3_BUCKET, s3_file, ExtraArgs={"ContentType": "video/mp4"}
        )
        return f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_file}"
    except NoCredentialsError:
        print("Credentials not available")
        return None


def upload_to_gemini(path, mime_type=None):
    file = genai.upload_file(path, mime_type=mime_type)
    print(f"Uploaded file '{file.display_name}' as: {file.uri}")
    return file


def wait_for_files_active(files):
    """Waits for the given files to be active.

    Some files uploaded to the Gemini API need to be processed before they can be
    used as prompt inputs. The status can be seen by querying the file's "state"
    field.

    This implementation uses a simple blocking polling loop. Production code
    should probably employ a more sophisticated approach.
    """
    for name in (file.name for file in files):
        file = genai.get_file(name)
        while file.state.name == "PROCESSING":
            print(".", end="", flush=True)
            time.sleep(10)
            file = genai.get_file(name)
        if file.state.name != "ACTIVE":
            raise Exception(f"File {file.name} failed to process")


def generate_script_for_voiceover_and_text(path, model, global_context, video_context, video_mode):
    # TODO Make these files available on the local file system
    # You may need to update the file paths
    files = [
        upload_to_gemini(path, mime_type="video/mp4"),
    ]
    model = genai.GenerativeModel(
        model_name=model,
        generation_config=generation_config,
    )

    # Some files have a processing delay. Wait for them to be ready.
    wait_for_files_active(files)

    if video_context is not None or video_context != "":
        video_context_prompt = (
            "Here's some context about the video and the things in it. Please use it to your advantange. "
            + video_context
        )
    else:
        video_context_prompt = ""

    if global_context is not None or global_context != "":
        global_context_prompt = (
            "Here's some global context about the video and the things in it. Please use it to your advantange. "
            + global_context
        )
    else:
        global_context_prompt = ""

    if video_mode == "showcase":
         script_prompt = """
        {}. You are a charismatic product marketer and voiceover expert, specializing in creating engaging and polished narrations for product launch and feature showcase videos.

        Given this screen recording and the context of the new feature being introduced, your job is to generate a voiceover script that:
        - Starts with a short, punchy 1–2 second intro announcing or teasing the feature being showcased.
        - Then, naturally walks the viewer through what’s happening on screen in a smooth, exciting, benefit-driven tone.
        
        This is not a tutorial — it’s a launch moment. Use clear, confident, and energetic language that makes the feature feel powerful, easy to use, and exciting to try. Avoid sounding robotic or dry.

        Estimate the duration of the video and adjust the word count accordingly (around 2.5 words per second for natural pacing). 
        Your output should follow this timecoded format, which will be used to generate the final voiceover:

        [{{"time": "00:01", "text": "text"}}].

        Only respond with the timecode annotations — no extra explanations or commentary.

        Feature context: {}
        """.format(
            global_context_prompt, video_context_prompt
        )
    else:
        script_prompt = """
        {}. You are an expert in web UI screens, a product support specialist and you are narrating voiceovers for product demos and explainers. 
        Given this video, please understand what is happening in the video and then describe it straight to the point as concisely as you can because the voiceover of the audio has to match the length of the video. 
        You are describing what is happening in the video like you are navigating someone and explaining them how to do stuff.
        If you can calculate the duration of the video and calculate how many words per second/minute an average AI voice speaks in order to describe it in suitable words, that would be great. 
        Once you have understood what’s happening in the video, output the script for the voiceover in this timecode annotation format as this will be converted from text to speech. 
        Make sure you understand you are writing a script for a how-to video. The format is: 
        [{{"time": "00:01", "text": "text"}}]. 

        Only reply with the timecode annotations, nothing else.
        {}"""


    chat_session = model.start_chat(
        history=[
            {
                "role": "user",
                "parts": [
                    files[0],
                ],
            },
            {
                "role": "user",
                "parts": [script_prompt],
            },
        ]
    )

    script_response = chat_session.send_message("INSERT_INPUT_HERE")

    text_generation_prompt = "{}. Here is the voiceover script you just generated for the video {}. Now, I also want to add the text, description, and step-by-step guide of this in my help center, so also give me text for it. The text should start with a small paragraph about what we are going to do, followed by a step-by-step guide. You will return text as html formatted. Return in the mentioned format only and nothing else. The json key for the html text is `html_text`. Do not use anything else, please.{}".format(
        global_context_prompt, script_response.text, video_context_prompt
    )

    steps_generation = model.start_chat(
        history=[
            {
                "role": "user",
                "parts": [
                    files[0],
                ],
            },
            {
                "role": "user",
                "parts": [text_generation_prompt],
            },
        ]
    )

    steps_response = steps_generation.send_message("INSERT_INPUT_HERE")
    print(steps_response.text)
    script_json = json.loads(script_response.text)
    steps_json = json.loads(steps_response.text)

    # Now you can access the data from the dictionary

    return script_json, str(steps_json["html_text"])


def update_zendesk_article_body(article_url, body):

    article_id = article_url.split("/")[-1]

    # API endpoint
 
    api_url = f"https://{ZENDESK_SUBDOMAIN}/api/v2/help_center/en-us/articles/{article_id}.json"
    translation_url = f"https://{ZENDESK_SUBDOMAIN}/api/v2/help_center/articles/{article_id}/translations/en-us.json"


    # Get the current article content
    response = requests.get(api_url, auth=(f"{ZENDESK_EMAIL}/token", ZENDESK_API_TOKEN))


    if response.status_code != 200:
        print(f"Error fetching article: {response.status_code}")
        print("Response content:", response.text)
        return
    


    article_data = json.loads(response.text)
    


    article_id = article_data["article"]["id"]


    translation_url = f"https://narrationbox9297.zendesk.com/api/v2/help_center/articles/{article_id}/translations/en-us"

    data = {
        "translation": {
            "body": body,
        }
    }

    # Make the PUT request
    response = requests.put(
        translation_url,
        headers={
            "Content-Type": "application/json",
        },
        json=data,
        auth=HTTPBasicAuth(f"{ZENDESK_EMAIL}/token", ZENDESK_API_TOKEN),
    )



    if response.status_code == 200:
        print("Article updated successfully!")
    else:
        print(f"Failed to update article: {response.status_code} - {response.text}")


body = """<p>This article guides you on how to create a new reminder list using the Reminders app, a built-in application on Mac devices.</p>
        <p>To create a new reminder list in the Reminders app on your Mac, follow these steps:</p>
        <ol>
            <li>Open the Reminders app on your Mac.</li>
            <li>At the bottom of the sidebar, click on the <strong>"Add List"</strong> button.</li>
            <li>A pop-up window will appear. In the <strong>"Name"</strong> field, enter the name of your new list.</li>
            <li>(Optional) You can customize the look of your list by selecting a color and icon.</li>
            <li>Once you are done, click the <strong>"OK"</strong> button. Your new list will appear in the Reminders app sidebar.</li>
        </ol>
        <p>You can now start adding reminders to your list.</p>
        <video width="320" height="240" controls>
  <source src="https://harkai-personal.s3.us-east-1.amazonaws.com/processed_videos/new_tmplbaw_47o.mp4" type="video/mp4">
Your browser does not support the video tag.
</video>
        """

# update_zendesk_article_body("https://help.narrationbox.com/hc/en-us/articles/20275457504285-Blocks",body)
