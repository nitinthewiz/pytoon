#!/usr/bin/env python3
"""Distill the day's take into a 3-4 word thumbnail HOOK via DeepInfra.

Key is read from env DEEPINFRA_KEY or .secrets/deepinfra.key (never hard-code it).
Falls back to a trimmed version of the take if the API is unavailable.
"""
import json, os, urllib.request

SYS = (
    "You write YouTube/TikTok thumbnail hooks for 'James Newshound', a spunky skeptic "
    "news host. Given his take on a story, output ONLY a punchy 2-4 WORD hook in ALL CAPS "
    "— shareable, opinionated, no period. Examples: 'DROP THE ACT', 'NICE TRY', "
    "'CALLED IT', 'NOT BUYING IT'. Output the hook text and nothing else."
)

def _key():
    if os.environ.get("DEEPINFRA_KEY"):
        return os.environ["DEEPINFRA_KEY"].strip()
    f = os.path.join(os.path.dirname(__file__), ".secrets", "deepinfra.key")
    return open(f).read().strip() if os.path.exists(f) else None

def hook_from_take(take, model="meta-llama/Llama-3.3-70B-Instruct-Turbo"):
    key = _key()
    if not key:
        return " ".join(take.upper().split()[:4])
    body = json.dumps({
        "model": model, "max_tokens": 20, "stream": False,
        "messages": [{"role": "system", "content": SYS}, {"role": "user", "content": take}],
    }).encode()
    req = urllib.request.Request(
        "https://api.deepinfra.com/v1/openai/chat/completions", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=30).read())
        return r["choices"][0]["message"]["content"].strip().strip('"').upper()
    except Exception:
        return " ".join(take.upper().split()[:4])

if __name__ == "__main__":
    import sys
    print(hook_from_take(sys.argv[1] if len(sys.argv) > 1 else "British PM hits back at Vance over a teen's death"))
