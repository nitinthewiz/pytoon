#!/usr/bin/env python3
"""make_captions_export.py — export SRT + VTT subtitles from the caption word-timestamps.

STAGED — not yet wired into .github/workflows/main.yml. See DISTRIBUTION.md (repo root)
for where this plugs into the publish lane.

Why this exists: TikTok / YouTube / Instagram all accept an uploaded subtitle file, and
an *uploaded* subtitle track is far better for reach + accessibility than burned-in
captions alone (it's indexable, translatable, and toggleable). We already have the single
source of truth the renderer pins everything to — Kokoro's word-level timestamps in
`captions.json` (a flat list of `{word, start_time, end_time}` in seconds) — so generating
SRT/VTT is a pure, deterministic transform with no model and no network.

The renderer burns captions one WORD at a time (karaoke pop-on). For an uploaded sidecar
file you want readable LINES, not one cue per word — so this groups words into short
phrase cues (≤ MAX_CHARS chars / ≤ MAX_WORDS words / break on sentence punctuation), each
cue spanning its first word's start to its last word's end.

Runs from the repo root, after the Action's "Decode manifest" step wrote captions.json:
  python cover/make_captions_export.py
…and writes two sidecars to the repo root:
  captions.srt   (TikTok, YouTube captions.insert, IG burn-in tooling)
  captions.vtt   (WebVTT — YouTube also accepts; web players)

Standalone usage (point at any captions.json):
  python cover/make_captions_export.py --captions captions.json --out .

Everything is wrapped so a missing/garbage captions.json degrades to "no sidecar written"
and returns 0 — a subtitle hiccup must never fail an otherwise-good render (same contract
as make_cover.py).
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)

# Cue-grouping knobs. Two short lines of ~21 chars is the readable mobile-caption norm;
# we keep a single cue ≤ 42 chars / ≤ 7 words and always break on sentence-final punct.
MAX_CHARS = 42
MAX_WORDS = 7
# Don't let one cue linger; if a gap to the next word is huge (a pause), end the cue.
MAX_CUE_SECONDS = 5.0
SENTENCE_ENDERS = {".", "!", "?", "…"}


def _fmt_ts(seconds, comma):
    """Seconds (float) -> 'HH:MM:SS,mmm' (SRT) or 'HH:MM:SS.mmm' (VTT)."""
    s = max(0.0, float(seconds))
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int(round((s - int(s)) * 1000))
    if ms == 1000:  # rounding can push to the next second
        ms = 0
        sec += 1
    sep = "," if comma else "."
    return f"{h:02d}:{m:02d}:{sec:02d}{sep}{ms:03d}"


def _word_of(entry):
    """Pull the spoken token from a caption entry, tolerating key variants."""
    return str(entry.get("word", entry.get("text", ""))).strip()


def _start_of(entry):
    return float(entry.get("start_time", entry.get("start", 0)) or 0)


def _end_of(entry):
    return float(entry.get("end_time", entry.get("end", 0)) or 0)


def group_into_cues(caps):
    """Flat word list -> [{start, end, text}] readable phrase cues.

    Skips pure-punctuation tokens (the renderer's zero-width aside markers) when they'd
    start a cue, but lets sentence-enders attach to the running line so the break lands
    AFTER the period. Each cue's [start, end) spans its first→last real word.
    """
    cues = []
    cur_words = []
    cur_start = None
    cur_end = None

    def flush():
        nonlocal cur_words, cur_start, cur_end
        if cur_words and cur_start is not None:
            text = " ".join(cur_words).strip()
            # Tidy spacing before punctuation (" ," -> ",").
            for p in (",", ".", "!", "?", ";", ":", "…"):
                text = text.replace(" " + p, p)
            if text:
                cues.append({"start": cur_start, "end": cur_end, "text": text})
        cur_words = []
        cur_start = None
        cur_end = None

    for entry in caps:
        w = _word_of(entry)
        if not w:
            continue
        st, en = _start_of(entry), _end_of(entry)
        is_punct_only = all(not ch.isalnum() for ch in w)

        # A lone punctuation token: attach to the current line (so "." ends the sentence
        # cleanly) but never START a new cue with it.
        if is_punct_only:
            if cur_words:
                cur_words[-1] = cur_words[-1] + w
                cur_end = max(cur_end or en, en)
                if any(ch in SENTENCE_ENDERS for ch in w):
                    flush()
            continue

        # Would adding this word overflow the cue? If so, close the current cue first.
        prospective = (" ".join(cur_words + [w])).strip()
        gap_too_long = cur_end is not None and (st - cur_end) > MAX_CUE_SECONDS
        span_too_long = cur_start is not None and (en - cur_start) > MAX_CUE_SECONDS
        if cur_words and (
            len(prospective) > MAX_CHARS
            or len(cur_words) >= MAX_WORDS
            or gap_too_long
            or span_too_long
        ):
            flush()

        if not cur_words:
            cur_start = st
        cur_words.append(w)
        cur_end = en

        # Break the line right after a word that already ends a sentence.
        if any(w.endswith(p) for p in SENTENCE_ENDERS):
            flush()

    flush()

    # Guarantee strictly-increasing, non-overlapping, non-zero cues (some players reject
    # zero-length or overlapping cues). Clamp each end to at least +40ms past its start
    # and never past the next cue's start.
    for i, c in enumerate(cues):
        if c["end"] <= c["start"]:
            c["end"] = c["start"] + 0.04
        if i + 1 < len(cues) and c["end"] > cues[i + 1]["start"]:
            c["end"] = max(c["start"] + 0.04, cues[i + 1]["start"] - 0.001)
    return cues


def to_srt(cues):
    out = []
    for i, c in enumerate(cues, 1):
        out.append(str(i))
        out.append(f"{_fmt_ts(c['start'], True)} --> {_fmt_ts(c['end'], True)}")
        out.append(c["text"])
        out.append("")  # blank line between cues
    return "\n".join(out).strip() + "\n"


def to_vtt(cues):
    out = ["WEBVTT", ""]
    for c in cues:
        out.append(f"{_fmt_ts(c['start'], False)} --> {_fmt_ts(c['end'], False)}")
        out.append(c["text"])
        out.append("")
    return "\n".join(out).strip() + "\n"


def _load_captions(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Accept either a bare list or {"captions": [...]} / {"timestamps": [...]}.
    if isinstance(data, dict):
        data = data.get("captions") or data.get("timestamps") or []
    if not isinstance(data, list):
        raise ValueError("captions.json is not a list of word entries")
    return data


def export(captions_path, out_dir):
    caps = _load_captions(captions_path)
    cues = group_into_cues(caps)
    if not cues:
        print("[captions_export] no usable cues — skipping sidecar")
        return False
    srt_path = os.path.join(out_dir, "captions.srt")
    vtt_path = os.path.join(out_dir, "captions.vtt")
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(to_srt(cues))
    with open(vtt_path, "w", encoding="utf-8") as f:
        f.write(to_vtt(cues))
    print(f"[captions_export] wrote {os.path.basename(srt_path)} + "
          f"{os.path.basename(vtt_path)} ({len(cues)} cues)")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--captions", default=os.path.join(REPO_ROOT, "captions.json"),
                    help="path to captions.json (default: repo-root captions.json)")
    ap.add_argument("--out", default=REPO_ROOT, help="output dir (default: repo root)")
    a = ap.parse_args()
    try:
        os.makedirs(a.out, exist_ok=True)
        export(a.captions, a.out)
    except Exception as e:  # never fail the build over a subtitle sidecar
        print(f"[captions_export] skipped ({e!r})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
