from pytoon.animator import animate
from moviepy.editor import VideoFileClip

# Create a PyToon animation without providing a transcript
animation = animate(
    audio_file="speech.mp3"  # Input audio (transcript will be auto-generated)
)

# Overlay the animation on top of another video and save as an .mp4 file.
background_video = VideoFileClip("background_video.mp4")
animation.export(path='animation.mp4', background=background_video, scale=0.7)