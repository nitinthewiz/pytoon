#!/usr/bin/env python3
"""make_cover.py — render James Newshound's cover + YouTube thumb ON the runner.

Why this exists: n8n's host cannot reach the standalone VPS thumbnail-service
(port 8790 is egress-restricted), so we generate the cover here on the GitHub
Actions runner — which already checked out this repo and built the video — and
upload the PNGs to MinIO next to the video. n8n then S3-downloads + posts them.

Reads the already-decoded `manifest.json` from the repo root (the Action's
"Decode manifest" step wrote it), pulls the day's TOP story (story 1):
  - news[0].image  -> background photo  (URL; falls back to brand-ink canvas)
  - takes[0]       -> source text for the hook
  - emotions[0]    -> James's pose      (EMOTION_POSE map)
  - edition.date   -> date tag on the cover
…and writes two PNGs to the repo root:
  - cover.png  (1080x1920) — TikTok/Reels cover + Telegram review post
  - thumb.png  (1280x720)  — YouTube non-Shorts thumbnail

Hook text:
  - If DEEPINFRA_API_KEY (or DEEPINFRA_KEY) is set, distill a punchy 2-4 word hook
    from the take via DeepInfra (api on :443 — a proven egress path).
  - If unset OR the call fails, GRACEFULLY derive a hook from the take (first ~3
    words, upper-cased). The cover must NEVER fail the build.

Everything is wrapped so a missing image URL / font / asset degrades instead of
raising: a broken cover should not fail an otherwise-good render. Paths use
os.path.join (no hardcoded '/') so this runs on the Windows runner unchanged.

Usage (run from the repo root, after manifest.json exists):
  python cover/make_cover.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)

# generate.py / hook.py sit next to this file; import them as a package-local module.
sys.path.insert(0, HERE)
from PIL import Image  # noqa: E402
from generate import load_image, make_cover, make_thumb, EMOTION_POSE  # noqa: E402

# Brand ink (#241710) — the fallback canvas when there is no usable story photo.
INK = (36, 23, 16)

# Default names generate.py writes into the --out dir.
GEN_COVER = "cover_1080x1920.png"
GEN_THUMB = "thumb_1280x720.png"
# Final names the Action uploads to MinIO (key convention: covers/NAME.png, thumbs/NAME.png).
OUT_COVER = "cover.png"
OUT_THUMB = "thumb.png"


def _hook_from_take(take):
    """2-4 word ALL-CAPS hook. DeepInfra if a key is present; else trim the take.

    The task standardized on DEEPINFRA_API_KEY; hook.py reads DEEPINFRA_KEY. Bridge
    the two here so either secret name works, then let hook.py do the rest (it already
    falls back to the trimmed take on any API error). With no key set, hook.py returns
    the first 4 words of the take — we tighten that to ~3 for a punchier card.
    """
    take = (take or "").strip()
    # Normalize env: if only DEEPINFRA_API_KEY is set, expose it as DEEPINFRA_KEY for hook.py.
    if os.environ.get("DEEPINFRA_API_KEY") and not os.environ.get("DEEPINFRA_KEY"):
        os.environ["DEEPINFRA_KEY"] = os.environ["DEEPINFRA_API_KEY"]

    have_key = bool(os.environ.get("DEEPINFRA_KEY"))
    fallback = " ".join(take.upper().split()[:3]) or "TODAY'S NEWS"
    if not take:
        return fallback
    if not have_key:
        # No API key -> deterministic local hook, never touch the network.
        return fallback
    try:
        from hook import hook_from_take
        h = (hook_from_take(take) or "").strip()
        return h or fallback
    except Exception as e:  # any import/network/parse failure -> graceful local hook
        print(f"[make_cover] hook via DeepInfra failed ({e!r}); using trimmed take")
        return fallback


def _load_manifest():
    path = os.path.join(REPO_ROOT, "manifest.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    # 1) Load manifest (the Action already decoded it to the repo root).
    try:
        manifest = _load_manifest()
    except Exception as e:
        print(f"[make_cover] could not read manifest.json ({e!r}); skipping cover")
        return 0  # never fail the build

    news = manifest.get("news") or []
    story = news[0] if news else {}
    image = (story.get("image") or "").strip()
    take = (manifest.get("takes") or [""])
    take = take[0] if take else ""
    emotion = (manifest.get("emotions") or ["explain"])
    emotion = emotion[0] if emotion else "explain"
    date = (manifest.get("edition") or {}).get("date", "") or ""

    hook = _hook_from_take(take)
    pose = EMOTION_POSE.get(emotion, "confident.png")
    print(f"[make_cover] story-1 emotion={emotion!r} pose={pose} date={date!r} hook={hook!r}")
    print(f"[make_cover] image={'<none>' if not image else image[:80]}")

    # 2) Background: load_image already falls back to a brand-ink canvas on any
    #    fetch/decode error; for an empty URL we build that canvas directly so we
    #    never hand load_image a non-http path it would try to open from disk.
    if image:
        try:
            bg = load_image(image)
        except Exception as e:
            print(f"[make_cover] image load failed ({e!r}); using brand-ink canvas")
            bg = Image.new("RGB", (1080, 1920), INK)
    else:
        bg = Image.new("RGB", (1080, 1920), INK)

    # 3) Compose. Each side is independent so a failure in one still ships the other.
    ok = False
    try:
        make_cover(bg, hook, pose, date, REPO_ROOT)
        os.replace(os.path.join(REPO_ROOT, GEN_COVER), os.path.join(REPO_ROOT, OUT_COVER))
        print(f"[make_cover] wrote {OUT_COVER} (1080x1920)")
        ok = True
    except Exception as e:
        print(f"[make_cover] cover render failed ({e!r})")
    try:
        make_thumb(bg, hook, pose, REPO_ROOT)
        os.replace(os.path.join(REPO_ROOT, GEN_THUMB), os.path.join(REPO_ROOT, OUT_THUMB))
        print(f"[make_cover] wrote {OUT_THUMB} (1280x720)")
        ok = True
    except Exception as e:
        print(f"[make_cover] thumb render failed ({e!r})")

    if not ok:
        print("[make_cover] no images produced — pipeline continues without a cover")
    return 0


if __name__ == "__main__":
    sys.exit(main())
