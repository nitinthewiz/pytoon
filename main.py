import json
import os
import re
from pytoon.animator import animate
from moviepy.editor import ColorClip, AudioFileClip


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


def build_emotion_schedule(speech_text, captions, emotions):
    """
    Map story emotions to (start_sec, end_sec, emotion) frame schedule tuples.

    Uses cumulative word counts into the Kokoro token stream (same approach as
    computeSegmentDurations in build_background.js) to find the precise second
    each [ITEM:N] segment starts, then assigns the LLM-chosen emotion to that
    time range. The intro always gets 'explain'.
    """
    segments = re.split(r'\[ITEM(?::\d+)?\]', speech_text)
    segments = [s.strip() for s in segments if s.strip()]
    if not segments:
        return []

    has_intro = not speech_text.strip().startswith('[ITEM')

    # Filter to word tokens only (Kokoro emits punctuation as separate tokens)
    word_toks = [t for t in captions if re.search(r'\w', t['word'])]
    if not word_toks:
        return []

    total_duration = word_toks[-1]['end_time']

    # Find the start time of each segment using cumulative word count
    word_idx = 0
    seg_start_times = []
    for seg in segments:
        idx = min(word_idx, len(word_toks) - 1)
        seg_start_times.append(word_toks[idx]['start_time'])
        word_idx += len(seg.split())

    schedule = []
    story_offset = 1 if has_intro else 0

    # Intro segment → always 'explain'
    if has_intro:
        intro_end = seg_start_times[1] if len(seg_start_times) > 1 else total_duration
        schedule.append((seg_start_times[0], intro_end, 'explain'))

    # Story segments → LLM-assigned emotions
    for i, emotion in enumerate(emotions):
        seg_idx = story_offset + i
        if seg_idx >= len(segments):
            break
        start_sec = seg_start_times[seg_idx]
        end_sec = seg_start_times[seg_idx + 1] if seg_idx + 1 < len(seg_start_times) else total_duration
        schedule.append((start_sec, end_sec, emotion))

    return schedule


transcript = None
speech_text_raw = None
if os.path.exists("speech.txt"):
    speech_text_raw = open("speech.txt", encoding="utf-8").read()
    clean = re.sub(r'\[ITEM(?::\d+)?\]', ' ', speech_text_raw).strip()
    transcript = expand_numbers(clean)

emotion_schedule = []
if (speech_text_raw and
        os.path.exists("captions.json") and
        os.path.exists("emotions.json")):
    captions = json.load(open("captions.json", encoding="utf-8"))
    emotions = json.load(open("emotions.json", encoding="utf-8"))
    emotion_schedule = build_emotion_schedule(speech_text_raw, captions, emotions)
    print(f"Emotion schedule: {emotion_schedule}")

animation = animate(
    audio_file="speech.mp3",
    transcript=transcript,
    emotion_schedule=emotion_schedule or None,
)

# Canvas + avatar settings come from the shared production config (single source
# of truth — also read by the Remotion side).
with open("productions/daily-news/production.json", encoding="utf-8") as f:
    PROD = json.load(f)
CANVAS_W = PROD["canvas"]["width"]
CANVAS_H = PROD["canvas"]["height"]
AVATAR_WIDTH = int(CANVAS_W * PROD["avatar"]["widthPct"])  # 810px — 135px clear each side
AVATAR_CROP_H = PROD["avatar"]["cropHeight"]               # 704px avatar zone

# Avatar is rendered as a KEYABLE OVERLAY LAYER (magenta screen), not baked over
# the news background. compose.js keys out the magenta and stacks the avatar onto
# the Remotion Production background at the right time offset. Magenta (255,0,255)
# avoids the captions' green key and is absent from the character art. Sizing the
# key background to the audio length also trims pytoon's trailing silent frames.
KEY_COLOR = (255, 0, 255)
audio_duration = AudioFileClip("speech.mp3").duration
key_bg = ColorClip(size=(CANVAS_W, CANVAS_H), color=KEY_COLOR).set_duration(audio_duration)

animation.export(
    path='avatar.mp4',
    background=key_bg,
    avatar_width=AVATAR_WIDTH,
    avatar_crop_height=AVATAR_CROP_H,
    position=("center", "top"),
)
