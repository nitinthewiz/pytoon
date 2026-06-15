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

    Each story segment is keyed by its [ITEM:N] number, so emotions[N-1] always
    lands on the segment the writer marked [ITEM:N] — even if the script reordered
    the stories. (Positional mapping silently mismatched emotions when the writer
    led with a later item.) Segment start seconds come from cumulative word counts
    into the Kokoro token stream. The intro gets a neutral 'explain'; the [CLOSE]
    sign-off gets a friendly 'happy' wave-off.
    """
    VALID = {'explain', 'happy', 'rhetorical', 'sad', 'angry', 'confused'}
    # Split but KEEP the [ITEM:N] / [CLOSE] markers so we know each segment's identity.
    parts = re.split(r'(\[ITEM(?::\d+)?\]|\[CLOSE\])', speech_text)
    # Walk parts into (marker, text) segments; leading text before any marker = intro.
    segs = []  # list of dicts: {kind:'intro'|'item'|'close', num:int|None, text:str}
    pending_marker = None
    for chunk in parts:
        mk = re.match(r'\[ITEM(?::(\d+))?\]', chunk)
        if mk:
            pending_marker = ('item', int(mk.group(1)) if mk.group(1) else None)
            continue
        if chunk.strip() == '[CLOSE]':
            pending_marker = ('close', None)
            continue
        text = chunk.strip()
        if not text:
            continue
        if pending_marker is None:
            segs.append({'kind': 'intro', 'num': None, 'text': text})
        else:
            segs.append({'kind': pending_marker[0], 'num': pending_marker[1], 'text': text})
            pending_marker = None
    if not segs:
        return []

    word_toks = [t for t in captions if re.search(r'\w', t['word'])]
    if not word_toks:
        return []
    total_duration = word_toks[-1]['end_time']

    # Start second of each segment via cumulative word count into the token stream.
    word_idx = 0
    for s in segs:
        idx = min(word_idx, len(word_toks) - 1)
        s['start'] = word_toks[idx]['start_time']
        word_idx += len(s['text'].split())
    for i, s in enumerate(segs):
        s['end'] = segs[i + 1]['start'] if i + 1 < len(segs) else total_duration

    # Assign each item its emotions[N-1] (1-based marker). Fall back to positional
    # order only for unnumbered [ITEM] markers (legacy 5-story scripts).
    schedule = []
    seq = 0
    for s in segs:
        if s['kind'] == 'intro':
            schedule.append((s['start'], s['end'], 'explain'))
        elif s['kind'] == 'close':
            schedule.append((s['start'], s['end'], 'happy'))
        else:  # item
            n = s['num'] if s['num'] is not None else seq + 1
            seq += 1
            emo = emotions[n - 1] if 1 <= n <= len(emotions) else 'explain'
            emo = emo.lower() if isinstance(emo, str) else 'explain'
            if emo not in VALID:
                emo = 'explain'
            schedule.append((s['start'], s['end'], emo))

    return schedule


transcript = None
speech_text_raw = None
if os.path.exists("speech.txt"):
    speech_text_raw = open("speech.txt", encoding="utf-8").read()
    clean = re.sub(r'\[ITEM(?::\d+)?\]|\[CLOSE\]', ' ', speech_text_raw).strip()
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
