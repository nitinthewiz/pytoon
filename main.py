import os
import re
from pytoon.animator import animate
from moviepy.editor import VideoFileClip


def expand_numbers(text):
    """
    Expand numbers and symbols to their spoken word form so forcealign's
    alphabetical() filter doesn't silently drop them, causing mis-alignment.
    Kokoro speaks numbers the same way, so the transcript will match the audio.
    """
    from num2words import num2words

    # Percentages before plain numbers so "237%" isn't caught as "237" first
    text = re.sub(
        r'(\d+(?:\.\d+)?)\s*%',
        lambda m: num2words(float(m.group(1))) + ' percent',
        text,
    )
    # Dollar amounts: strip $ and convert the number
    text = re.sub(
        r'\$(\d+(?:\.\d+)?)',
        lambda m: num2words(float(m.group(1))),
        text,
    )
    # Ordinals: 11th → eleventh
    text = re.sub(
        r'\b(\d+)(st|nd|rd|th)\b',
        lambda m: num2words(int(m.group(1)), to='ordinal'),
        text,
    )
    # 4-digit years (1000–2099): 2026 → twenty twenty-six
    text = re.sub(
        r'\b(1\d{3}|20\d{2})\b',
        lambda m: num2words(int(m.group(1)), to='year'),
        text,
    )
    # Remaining integers and decimals
    text = re.sub(
        r'\b(\d+(?:\.\d+)?)\b',
        lambda m: num2words(float(m.group(1)) if '.' in m.group(1) else int(m.group(1))),
        text,
    )
    return text


transcript = None
if os.path.exists("speech.txt"):
    raw = open("speech.txt", encoding="utf-8").read()
    clean = re.sub(r'\[ITEM(?::\d+)?\]', ' ', raw).strip()
    transcript = expand_numbers(clean)

animation = animate(
    audio_file="speech.mp3",
    transcript=transcript,
)

background_video = VideoFileClip("background_video.mp4")
animation.export(path='animation.mp4', background=background_video, scale=0.7)
