import os
import re
from pytoon.animator import animate
from moviepy.editor import VideoFileClip

# Use the speech text as the transcript so forcealign doesn't run speech-to-text.
transcript = None
if os.path.exists("speech.txt"):
    raw = open("speech.txt", encoding="utf-8").read()
    transcript = re.sub(r'\[ITEM(?::\d+)?\]', ' ', raw).strip()

animation = animate(
    audio_file="speech.mp3",
    transcript=transcript,
)

# Overlay the animation on top of another video and save as an .mp4 file.
background_video = VideoFileClip("background_video.mp4")
animation.export(path='animation.mp4', background=background_video, scale=0.7)