from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
from pytoon.animator import animate
from moviepy.editor import VideoFileClip


app = FastAPI()

# Upload audio file as speech.mp3
@app.post("/upload_audio", status_code=status.HTTP_200_OK)
async def upload_audio(file: UploadFile = File(...)):
    with open("speech.mp3", "wb") as f:
        f.write(await file.read())
    return {"filename": file.filename, "filesize":len(file.file.read())} 

# Upload background video as background_video.mp4
@app.post("/upload_background_video", status_code=status.HTTP_200_OK)
async def upload_background_video(file: UploadFile = File(...)):
    with open("background_video.mp4", "wb") as f:
        f.write(await file.read())
    return {"filename": file.filename, "filesize":len(file.file.read())}

# Upload transcript as speech.txt
@app.post("/upload_transcript", status_code=status.HTTP_200_OK)
async def upload_transcript(file: UploadFile = File(...)):
    with open("speech.txt", "wb") as f:
        f.write(await file.read())
    return {"filename": file.filename, "filesize": len(file.file.read())}

# Create animation using all the above files. Transcript is optional.
@app.post("/animate")
def create_animation(audio_file: str = "speech.mp3", 
    transcript: str = "speech.txt", 
    background_video: str = "background_video.mp4"
):
    """
    Create a PyToon animation from an audio file and an optional transcript.

    :param audio_file: Path to the audio file (e.g., 'speech.mp3').
    :param transcript: Optional path to the transcript file (e.g., 'speech.txt').
    :param background_video: Path to the background video file (e.g., 'background_video.mp4').
    :return: Path to the exported video file.
    """
    # If a transcript is provided, read it from the file.
    if transcript:
        with open(transcript, "r") as file:
            transcript_content = file.read()
    else:
        transcript_content = None
    # Create a PyToon animation with or without a transcript
    animation = animate(
        audio_file=audio_file,
        transcript=transcript_content
    )

    background_video = VideoFileClip(background_video)
    # Save the animation to a file
    animation.export(path='animation.mp4', background=background_video, scale=0.7)

    return {"message": "Animation created successfully."}

# Endpoint to download the created animation
@app.get("/download_animation")
def download_animation():
    """
    Endpoint to download the created animation.
    """
    return FileResponse("animation.mp4", media_type="video/mp4", filename="animation.mp4")

