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

def paste_james(canvas, pose_name, height, anchor, margin=20):
    """anchor: ('right','bottom') etc. Places James drop-shadowed.

    Returns the (x, y, w, h) box James was pasted at so callers can lay the
    hook text *clear of his face* — the whole point is that James stands out.
    """
    j = Image.open(os.path.join(ASSETS, "poses", pose_name)).convert("RGBA")
    scale = height / j.height
    j = j.resize((int(j.width * scale), height), Image.LANCZOS)
    # drop shadow
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", j.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 160), (0, 0), j.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    ax, ay = anchor
    x = {"left": margin, "center": (canvas.width - j.width) // 2,
         "right": canvas.width - j.width - margin}[ax]
    y = {"top": margin, "bottom": canvas.height - j.height}[ay]
    sh.paste(shadow, (x + 8, y + 16), shadow)
    canvas.alpha_composite(sh)
    canvas.alpha_composite(j, (x, y))
    return (x, y, j.width, j.height)

def brand_bug(canvas, x, y, size=96):
    """Large 'NEWSHOUND NEWS' wordmark — must read at a glance / in a feed grid.

    size = Anton cap height in px. A yellow tick precedes the word; NEWSHOUND is
    white, NEWS is cyan. Returns the y just below the wordmark so a meta bar can
    stack under it.
    """
    draw = ImageDraw.Draw(canvas)
    f = font("Anton-Regular.ttf", size)
    tick_w = max(12, size // 5)
    # Anton has internal top padding; nudge text up so it visually aligns with the tick.
    ty = y - int(size * 0.18)
    draw.rectangle([x, y, x + tick_w, y + size + 6], fill=YELLOW)
    tx = x + tick_w + int(size * 0.28)
    draw.text((tx, ty), "NEWSHOUND", font=f, fill=WHITE)
    w = draw.textlength("NEWSHOUND", font=f)
    draw.text((tx + w + int(size * 0.22), ty), "NEWS", font=f, fill=CYAN)
    return y + size + 6

def meta_bar(canvas, x, y, edition, date, size=58):
    """Big, legible edition + date line on a brand pill.

    e.g. 'US AM EDITION  •  JUN 18, 2026'. Edition is the hero (yellow, bold),
    date follows in white — so at a glance you know it's today's news and which
    edition. Drawn as a charcoal pill with a yellow left rule for contrast over
    any photo.
    """
    draw = ImageDraw.Draw(canvas)
    fe = font("Anton-Regular.ttf", size)
    fd = font("Inter.ttf", int(size * 0.74))
    edition = (edition or "").strip().upper()
    date = (date or "").strip().upper()
    pad = int(size * 0.42)
    gap = int(size * 0.45)
    # Measure
    we = draw.textlength(edition, font=fe) if edition else 0
    sep = "  •  "
    ws = draw.textlength(sep, font=fd) if (edition and date) else 0
    wd = draw.textlength(date, font=fd) if date else 0
    inner_w = we + ws + wd
    pill_w = int(inner_w + pad * 2 + 10)
    pill_h = int(size * 1.42)
    # Pill background (semi-opaque charcoal) + yellow left rule.
    draw.rounded_rectangle([x, y, x + pill_w, y + pill_h], radius=pill_h // 2,
                           fill=(20, 24, 31, 235))
    rule_w = max(8, size // 7)
    draw.rounded_rectangle([x, y, x + rule_w + 6, y + pill_h], radius=pill_h // 2,
                           fill=YELLOW)
    cx = x + pad + rule_w
    # Vertically center each font run.
    ey = y + (pill_h - size) // 2 - int(size * 0.16)
    dy = y + (pill_h - int(size * 0.74)) // 2 - int(size * 0.06)
    if edition:
        draw.text((cx, ey), edition, font=fe, fill=YELLOW)
        cx += we
    if edition and date:
        draw.text((cx, dy), sep, font=fd, fill=CYAN)
        cx += ws
    if date:
        draw.text((cx, dy), date, font=fd, fill=WHITE)
    return y + pill_h

def make_cover(bg, hook, pose, date, out, edition=""):
    W, H = 1080, 1920
    canvas = Image.new("RGBA", (W, H), CHARCOAL + (255,))
    photo = cover_fill(bg, W, H)
    photo = ImageEnhance.Brightness(photo).enhance(0.72)
    canvas.paste(photo, (0, 0))
    canvas.alpha_composite(vgrad(W, H, (20, 24, 31, 60), (20, 24, 31, 240)))

    # --- James FIRST: bottom-right, big, face high in the clear upper-middle --
    # His face sits in the upper third of his figure; rendered tall + bled off
    # the right edge so the head lands in open space and the hook can run across
    # the bottom (where only his thin legs are) without ever crossing his face.
    j_h = 1180
    paste_james(canvas, pose, j_h, ("right", "bottom"), margin=-90)

    # --- Hook: big yellow caps across the bottom band ------------------------
    # The band sits below James's face, so it reads as the hero line and James
    # still stands out above it. Wide column (only his thin legs are down here),
    # large min size so it never shrinks to a caption.
    hook_left = 56
    hook_max_w = W - hook_left - 56
    lines = wrap_hook(hook, 2)
    d0 = ImageDraw.Draw(canvas)
    hf = fit_font(d0, lines, "Anton-Regular.ttf", hook_max_w, 240, 130)
    lh = int(hf.size * 1.0)
    block_h = lh * len(lines)
    hook_top = H - 150 - block_h           # sit the block near the bottom, clear of platform UI
    # Scrim behind the hook so it pops over the photo and James's legs.
    scrim_top = hook_top - 28
    scrim = vgrad(W, H - scrim_top, (20, 24, 31, 0), (20, 24, 31, 200))
    canvas.alpha_composite(scrim, (0, scrim_top))
    y = hook_top
    for line in lines:
        d0.text((hook_left, y), line, font=hf, fill=YELLOW, stroke_width=12, stroke_fill=INK)
        y += lh

    # --- Brand wordmark + edition/date, large, top-left ----------------------
    next_y = brand_bug(canvas, 56, 70, size=104)
    meta_bar(canvas, 56, next_y + 26, edition, date, size=60)

    canvas.convert("RGB").save(os.path.join(out, "cover_1080x1920.png"))

def make_thumb(bg, hook, pose, out, edition="", date=""):
    W, H = 1280, 720
    canvas = Image.new("RGBA", (W, H), CHARCOAL + (255,))
    photo = cover_fill(bg, W, H)
    photo = ImageEnhance.Brightness(photo).enhance(0.65)
    canvas.paste(photo, (0, 0))
    canvas.alpha_composite(vgrad(W, H, (20, 24, 31, 120), (20, 24, 31, 210)))

    # James anchored bottom-LEFT; keep the hook in the right column, clear of his
    # face. Height kept moderate so the head clears the top-left meta pill.
    j_box = paste_james(canvas, pose, 690, ("left", "bottom"), margin=-20)
    jx, jy, jw, jh = j_box
    james_right = jx + jw

    # Hook fills the right column, vertically centered, never over James.
    hook_left = james_right + 30
    hook_max_w = W - hook_left - 50
    lines = wrap_hook(hook, 2)
    d0 = ImageDraw.Draw(canvas)
    hf = fit_font(d0, lines, "Anton-Regular.ttf", hook_max_w, 170, 80)
    lh = int(hf.size * 1.04)
    block_h = lh * len(lines)
    y = (H - block_h) // 2 + 20
    cx = hook_left + hook_max_w // 2
    for line in lines:
        tw = d0.textlength(line, font=hf)
        d0.text((cx - tw / 2, y), line, font=hf, fill=YELLOW, stroke_width=9, stroke_fill=INK)
        y += lh

    # Large brand wordmark + edition/date, top-left.
    next_y = brand_bug(canvas, 40, 40, size=66)
    if edition or date:
        meta_bar(canvas, 40, next_y + 16, edition, date, size=40)

    canvas.convert("RGB").save(os.path.join(out, "thumb_1280x720.png"))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--hook", required=True)
    ap.add_argument("--emotion", default="explain")
    ap.add_argument("--date", default="")
    ap.add_argument("--edition", default="", help="e.g. 'US AM Edition'")
    ap.add_argument("--out", default=".")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    bg = load_image(a.image)
    pose = EMOTION_POSE.get(a.emotion, "confident.png")
    make_cover(bg, a.hook, pose, a.date, a.out, edition=a.edition)
    make_thumb(bg, a.hook, pose, a.out, edition=a.edition, date=a.date)
    print(f"Wrote cover_1080x1920.png + thumb_1280x720.png to {a.out}")

if __name__ == "__main__":
    main()
