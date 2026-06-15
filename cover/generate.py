#!/usr/bin/env python3
"""
James Newshound — thumbnail / cover generator.

Standalone (no pytoons dependency) so it can run as its own n8n step on the VPS.
Composes, from the day's top story:
  - a 1080x1920 vertical COVER (TikTok/Reels cover, channel grid)
  - a 1280x720 YouTube THUMBNAIL (non-Shorts, link previews)

Inputs: a news image (path or URL), a 3-4 word HOOK, an emotion (picks James's pose),
and the date. The HOOK can be distilled from the day's take via DeepInfra (hook.py),
or passed directly.

Usage:
  python generate.py --image <path|url> --hook "DROP THE ACT" --emotion angry \
      --date "Jun 7" --out ./out
"""
import argparse, io, os, textwrap, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")

# Brand (mirrors News_Programs/James_Newshound/brand.yaml)
YELLOW = (255, 192, 30)
ORANGE = (226, 106, 15)
INK = (36, 23, 16)
CHARCOAL = (20, 24, 31)
CYAN = (25, 195, 230)
WHITE = (255, 255, 255)

EMOTION_POSE = {
    "angry": "angry.png", "sad": "shocked.png", "happy": "confident.png",
    "explain": "confident.png", "rhetorical": "smug.png",
}

def font(name, size):
    return ImageFont.truetype(os.path.join(ASSETS, name), size)

def load_image(src):
    # News CDNs (and Wikimedia) 403 urllib's default UA — send a browser-ish one.
    # Any fetch/decode failure falls back to a brand-ink canvas: a thumbnail must
    # never hard-fail the pipeline just because one outlet blocks hotlinking.
    if src.startswith("http"):
        try:
            req = urllib.request.Request(src, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
                "Accept": "image/*,*/*;q=0.8",
            })
            data = urllib.request.urlopen(req, timeout=20).read()
            return Image.open(io.BytesIO(data)).convert("RGB")
        except Exception:
            return Image.new("RGB", (1080, 1920), (36, 23, 16))  # Ink #241710
    return Image.open(src).convert("RGB")

def cover_fill(img, w, h):
    """Resize+crop to fill w x h (object-fit: cover)."""
    iw, ih = img.size
    scale = max(w / iw, h / ih)
    img = img.resize((int(iw * scale), int(ih * scale)), Image.LANCZOS)
    x = (img.width - w) // 2
    y = (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))

def vgrad(w, h, top_rgba, bot_rgba):
    """Vertical gradient as an RGBA image."""
    grad = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        grad.putpixel((0, y), tuple(int(top_rgba[i] + (bot_rgba[i] - top_rgba[i]) * t) for i in range(4)))
    return grad.resize((w, h))

def fit_font(draw, text_lines, fontfile, max_w, start_size, min_size=40):
    size = start_size
    while size > min_size:
        f = font(fontfile, size)
        if all(draw.textlength(line, font=f) <= max_w for line in text_lines):
            return f
        size -= 4
    return font(fontfile, min_size)

def wrap_hook(hook, max_words_per_line=2):
    words = hook.upper().split()
    lines, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= max_words_per_line:
            lines.append(" ".join(cur)); cur = []
    if cur:
        lines.append(" ".join(cur))
    return lines[:3]

def draw_hook(canvas, lines, fontfile, max_w, cx, top_y, start_size, fill=YELLOW, stroke=INK, sw=10):
    draw = ImageDraw.Draw(canvas)
    f = fit_font(draw, lines, fontfile, max_w, start_size)
    lh = int(f.size * 1.02)
    y = top_y
    for line in lines:
        tw = draw.textlength(line, font=f)
        draw.text((cx - tw / 2, y), line, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)
        y += lh
    return y

def paste_james(canvas, pose_name, height, anchor):
    """anchor: ('right','bottom') etc. Places James drop-shadowed."""
    j = Image.open(os.path.join(ASSETS, "poses", pose_name)).convert("RGBA")
    scale = height / j.height
    j = j.resize((int(j.width * scale), height), Image.LANCZOS)
    # drop shadow
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", j.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 160), (0, 0), j.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    ax, ay = anchor
    x = {"left": 20, "center": (canvas.width - j.width) // 2, "right": canvas.width - j.width - 20}[ax]
    y = {"top": 20, "bottom": canvas.height - j.height}[ay]
    sh.paste(shadow, (x + 8, y + 16), shadow)
    canvas.alpha_composite(sh)
    canvas.alpha_composite(j, (x, y))

def brand_bug(canvas, x, y):
    draw = ImageDraw.Draw(canvas)
    f = font("Anton-Regular.ttf", 40)
    draw.rectangle([x, y, x + 18, y + 48], fill=YELLOW)
    draw.text((x + 30, y - 4), "NEWSHOUND", font=f, fill=WHITE)
    w = draw.textlength("NEWSHOUND", font=f)
    draw.text((x + 30 + w + 12, y - 4), "NEWS", font=f, fill=CYAN)

def make_cover(bg, hook, pose, date, out):
    W, H = 1080, 1920
    canvas = Image.new("RGBA", (W, H), CHARCOAL + (255,))
    photo = cover_fill(bg, W, H)
    photo = ImageEnhance.Brightness(photo).enhance(0.72)
    canvas.paste(photo, (0, 0))
    canvas.alpha_composite(vgrad(W, H, (20, 24, 31, 60), (20, 24, 31, 240)))
    paste_james(canvas, pose, 1080, ("right", "bottom"))
    brand_bug(canvas, 48, 60)
    # date tag
    d = ImageDraw.Draw(canvas)
    df = font("Inter.ttf", 34)
    d.text((48, 130), date.upper(), font=df, fill=CYAN)
    draw_hook(canvas, wrap_hook(hook, 2), "Anton-Regular.ttf", W - 120, W // 2, 1180, 200)
    canvas.convert("RGB").save(os.path.join(out, "cover_1080x1920.png"))

def make_thumb(bg, hook, pose, out):
    W, H = 1280, 720
    canvas = Image.new("RGBA", (W, H), CHARCOAL + (255,))
    photo = cover_fill(bg, W, H)
    photo = ImageEnhance.Brightness(photo).enhance(0.65)
    canvas.paste(photo, (0, 0))
    canvas.alpha_composite(vgrad(W, H, (20, 24, 31, 120), (20, 24, 31, 210)))
    paste_james(canvas, pose, 700, ("left", "bottom"))
    brand_bug(canvas, 40, 36)
    draw_hook(canvas, wrap_hook(hook, 2), "Anton-Regular.ttf", 760, 820, 200, 150)
    canvas.convert("RGB").save(os.path.join(out, "thumb_1280x720.png"))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--hook", required=True)
    ap.add_argument("--emotion", default="explain")
    ap.add_argument("--date", default="")
    ap.add_argument("--out", default=".")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    bg = load_image(a.image)
    pose = EMOTION_POSE.get(a.emotion, "confident.png")
    make_cover(bg, a.hook, pose, a.date, a.out)
    make_thumb(bg, a.hook, pose, a.out)
    print(f"Wrote cover_1080x1920.png + thumb_1280x720.png to {a.out}")

if __name__ == "__main__":
    main()
