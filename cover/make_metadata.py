#!/usr/bin/env python3
"""make_metadata.py — per-video, per-PLATFORM publish metadata for James Newshound.

STAGED — not yet wired into .github/workflows/main.yml or n8n WF4. See DISTRIBUTION.md
(repo root) for exactly where this plugs into the publish lane and how WF4 consumes it.

What it produces: one `metadata.json` next to the video, with a native title +
description + hashtag set for EACH target platform (TikTok, YouTube Shorts, Instagram
Reels) — because the platforms reward different copy (TikTok ≠ IG ≠ YouTube; see
BRANDING_STRATEGY.md §5 and personality.md §8). WF4 (or the runner's post step) reads
`metadata.json` and uses `metadata.<platform>.{title,caption,description,hashtags}` when
posting that channel, instead of the single shared blob it builds today.

It reuses the EXACT DeepInfra approach the cover already uses (cover/hook.py):
  - OpenAI-compatible endpoint https://api.deepinfra.com/v1/openai/chat/completions
  - model meta-llama/Llama-3.3-70B-Instruct-Turbo
  - key from DEEPINFRA_API_KEY or DEEPINFRA_KEY (or .secrets/deepinfra.key)
  - and it GRACEFULLY falls back to a deterministic, template-built metadata set if the
    key is unset or the call fails — the metadata file must NEVER fail the build.

Inputs (read from the repo-root manifest.json the Action's "Decode manifest" step wrote):
  takes[]    -> the day's hot takes (the hook material)
  teasers[]  -> the top-story rundown (description bullets)
  news[]     -> {title, url, source, section} (rundown + source links + entities)
  tags[]     -> per-story category tags (topical hashtags)
  edition    -> {country, edition, date} (edition label + dated title)

Usage (from the repo root, after manifest.json exists):
  python cover/make_metadata.py
…writes:
  metadata.json   (consumed by WF4 / the runner's per-channel post step)

Brand constants (mirrors News_Programs/James_Newshound/brand.yaml + BRANDING_STRATEGY.md):
the show is @JamesNewshound on every platform; tagline "He read it so you don't have to."
"""
import argparse
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)

HANDLE = "JamesNewshound"          # same @handle on every platform (BRANDING_STRATEGY §5)
TAGLINE = "He read it so you don't have to."
# ONE neutral AI-disclosure line on every upload (personality.md §8; never exceed one line).
AI_LINE = "Animated / AI-assisted production."

DEEPINFRA_URL = "https://api.deepinfra.com/v1/openai/chat/completions"
MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

# Per-platform base hashtag sets (the curated fallback when no live-trend source is wired;
# BRANDING_STRATEGY §5 "pull the right set per app"). Topical tags from the day's `tags[]`
# get merged on top of these. Kept lowercase, no '#', deduped at emit time.
BASE_HASHTAGS = {
    "tiktok":    ["news", "newstok", "jamesnewshound", "dailynews", "breakingnews", "fyp"],
    "youtube":   ["news", "shorts", "dailynews", "jamesnewshound"],
    "instagram": ["news", "reels", "dailynews", "jamesnewshound", "newsreels"],
}
# Platform copy limits we design to (chars). TikTok caption ~2200 incl. tags; YT title 100;
# YT description 5000; IG caption ~2200 / ~30 hashtags. We stay well under.
LIMITS = {
    "tiktok":    {"caption": 2000, "hashtags": 8},
    "youtube":   {"title": 95, "description": 4500, "hashtags": 6},
    "instagram": {"caption": 2000, "hashtags": 12},
}


def _key():
    """DeepInfra key, mirroring make_cover.py's env bridge + hook.py's file fallback."""
    if os.environ.get("DEEPINFRA_API_KEY") and not os.environ.get("DEEPINFRA_KEY"):
        os.environ["DEEPINFRA_KEY"] = os.environ["DEEPINFRA_API_KEY"]
    if os.environ.get("DEEPINFRA_KEY"):
        return os.environ["DEEPINFRA_KEY"].strip()
    f = os.path.join(HERE, ".secrets", "deepinfra.key")
    return open(f).read().strip() if os.path.exists(f) else None


def _slug_tag(s):
    """'Top Story' -> 'topstory'; strips non-alphanumerics, lowercases."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _edition_label(ed):
    country = (ed.get("country") or "us").upper()
    code = (ed.get("edition") or "").strip()
    return (country + " " + code + " Edition").replace("  ", " ").strip()


def _llm_titles(takes, teasers, edition_label, date):
    """Ask DeepInfra for a punchy per-platform TITLE/HOOK line. Returns dict or None.

    One cheap call returns all three platform hooks as JSON. Any failure -> None ->
    caller uses the deterministic fallback. Same client shape as cover/hook.py.
    """
    key = _key()
    if not key:
        return None
    top_take = (takes[0] if takes else "") or ""
    rundown = "; ".join(t for t in (teasers or [])[:5] if t)
    sys_prompt = (
        "You write social-video copy for 'James Newshound', a spunky, anti-establishment "
        "skeptic news host. Voice: opinionated, punchy, a little cheeky — never a bare "
        "summary. You are given his top hot-take and the day's rundown. Return STRICT JSON "
        "with exactly these keys and nothing else: "
        '{"tiktok_hook": "<=80 chars, punchy, lowercase-ok, 0-1 emoji>", '
        '"youtube_title": "<=80 chars, curiosity-driven, Title Case, no emoji>", '
        '"instagram_hook": "<=90 chars, hooky first line for a Reel caption>", '
        '"one_liner": "<=120 chars neutral one-sentence summary of the edition">}'
    )
    user = (
        f"Edition: {edition_label} {date}\n"
        f"Top take: {top_take}\n"
        f"Rundown: {rundown}\n"
        "Return the JSON now."
    )
    body = json.dumps({
        "model": MODEL, "max_tokens": 300, "stream": False,
        "messages": [{"role": "system", "content": sys_prompt},
                     {"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request(
        DEEPINFRA_URL, data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=30).read())
        content = r["choices"][0]["message"]["content"].strip()
        m = re.search(r"\{.*\}", content, re.DOTALL)
        obj = json.loads(m.group(0) if m else content)
        # Require the 4 keys; otherwise treat as a failure.
        if all(k in obj for k in ("tiktok_hook", "youtube_title", "instagram_hook", "one_liner")):
            return {k: str(v).strip() for k, v in obj.items()}
        return None
    except Exception as e:
        print(f"[metadata] DeepInfra title call failed ({e!r}); using local fallback")
        return None


def _fallback_hooks(takes, teasers, edition_label):
    """Deterministic, no-network hooks built from the day's take/teasers."""
    top_take = (takes[0] if takes else "") or (teasers[0] if teasers else "Today's news")
    top_take = top_take.strip().rstrip(".")
    one_liner = (teasers[0] if teasers else top_take).strip()
    return {
        "tiktok_hook": top_take,
        "youtube_title": top_take,
        "instagram_hook": top_take,
        "one_liner": one_liner,
    }


def _hashtags(platform, tags):
    """Merge base + topical tags, dedupe, cap to the platform limit. Returns ['#x', ...]."""
    topical = [_slug_tag(t) for t in (tags or [])]
    merged = []
    for t in BASE_HASHTAGS.get(platform, []) + topical:
        if t and t not in merged:
            merged.append(t)
    cap = LIMITS[platform]["hashtags"]
    return ["#" + t for t in merged[:cap]]


def _rundown_lines(teasers):
    return [f"{i + 1}. {t}" for i, t in enumerate(teasers or []) if t]


def _source_links(news):
    out = []
    for n in (news or []):
        url = (n.get("url") or "").strip()
        if url:
            src = (n.get("source") or "").strip()
            out.append(f"- {src + ': ' if src else ''}{url}")
    return out


def build_metadata(manifest):
    takes = manifest.get("takes") or []
    teasers = manifest.get("teasers") or []
    news = manifest.get("news") or []
    tags = manifest.get("tags") or []
    ed = manifest.get("edition") or {}
    date = (ed.get("date") or "").strip()
    edition_label = _edition_label(ed)

    hooks = _llm_titles(takes, teasers, edition_label, date) or \
        _fallback_hooks(takes, teasers, edition_label)

    rundown = _rundown_lines(teasers)
    sources = _source_links(news)
    used_llm = bool(_key())

    out = {"edition": {"label": edition_label, "date": date},
           "generated_with_llm": used_llm and hooks is not None,
           "handle": "@" + HANDLE}

    # ---- TikTok: caption = hook + 1-line context + hashtags (no separate title). -------
    tt_tags = _hashtags("tiktok", tags)
    tt_caption = " ".join([
        hooks["tiktok_hook"].strip(),
        "—", TAGLINE,
    ]).strip()
    tt_caption = (tt_caption + "\n\n" + " ".join(tt_tags)).strip()
    out["tiktok"] = {
        "caption": tt_caption[:LIMITS["tiktok"]["caption"]],
        "hashtags": tt_tags,
        "disclose_ai": True,          # set the AI-content toggle in the post payload
    }

    # ---- YouTube Shorts: title (<=95) + full description with rundown + sources. -------
    yt_tags = _hashtags("youtube", tags)
    yt_title = hooks["youtube_title"].strip()
    # Shorts are surfaced by #Shorts; ensure the title or description carries it.
    if "#shorts" not in yt_title.lower():
        yt_title = (yt_title[:LIMITS["youtube"]["title"] - 8].rstrip() + " #Shorts")
    yt_title = yt_title[:LIMITS["youtube"]["title"]]
    yt_desc_parts = [
        hooks["one_liner"].strip(),
        f"{edition_label}{(' · ' + date) if date else ''}.",
        "",
        "In this edition:",
        *rundown,
        "",
        "Sources:",
        *sources,
        "",
        AI_LINE,                       # the ONE neutral AI line (personality.md §8)
        "",
        " ".join(yt_tags),
    ]
    out["youtube"] = {
        "title": yt_title,
        "description": "\n".join(yt_desc_parts)[:LIMITS["youtube"]["description"]],
        # YouTube Data API `tags` field is comma-joined keywords (not the # hashtags).
        "tags": [t.lstrip("#") for t in yt_tags] + ["james newshound", "daily news"],
        "category_id": "25",          # News & Politics
        "privacy_status": "unlisted",  # flip to 'public' when happy (see DISTRIBUTION.md)
        # Mark the upload as altered/synthetic content. The Data API may not expose this
        # flag on every node version; if not, set it once in Studio (DISTRIBUTION.md).
        "synthetic_media": True,
    }

    # ---- Instagram Reels: caption (hook + rundown teaser + hashtags). ------------------
    ig_tags = _hashtags("instagram", tags)
    ig_caption_parts = [
        hooks["instagram_hook"].strip(),
        "",
        TAGLINE + " " + edition_label + (f" · {date}" if date else "") + ".",
    ]
    if rundown:
        ig_caption_parts += ["", "Today: " + " · ".join(t.split(". ", 1)[-1] for t in rundown[:3])]
    ig_caption_parts += ["", AI_LINE, "", " ".join(ig_tags)]
    out["instagram"] = {
        "caption": "\n".join(ig_caption_parts)[:LIMITS["instagram"]["caption"]],
        "hashtags": ig_tags,
        "disclose_ai": True,          # set IG "AI info" label / branded-content AI toggle
    }

    # ---- Shared fields any channel can fall back to. ----------------------------------
    out["shared"] = {
        "tagline": TAGLINE,
        "ai_disclosure_line": AI_LINE,
        "source_links": sources,
        "rundown": rundown,
    }
    return out


def _load_manifest(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default=os.path.join(REPO_ROOT, "manifest.json"))
    ap.add_argument("--out", default=os.path.join(REPO_ROOT, "metadata.json"))
    a = ap.parse_args()
    try:
        manifest = _load_manifest(a.manifest)
    except Exception as e:
        print(f"[metadata] could not read manifest.json ({e!r}); skipping metadata")
        return 0  # never fail the build
    try:
        meta = build_metadata(manifest)
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"[metadata] wrote {os.path.basename(a.out)} "
              f"(llm={meta.get('generated_with_llm')}) for {meta['edition']['label']}")
    except Exception as e:
        print(f"[metadata] build failed ({e!r}); pipeline continues without metadata")
    return 0


if __name__ == "__main__":
    sys.exit(main())
