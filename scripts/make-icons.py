"""Draws the app icons (brick-breaker motif). Run: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw

PURPLE = (142, 92, 240)
BRICKS = [(255, 93, 115), (255, 210, 63), (63, 181, 107), (58, 160, 255)]


def draw(size: int, safe: float) -> Image.Image:
    """`safe` = fraction of the canvas the artwork may use (maskable icons need ~0.7)."""
    s = size * 4  # supersample
    im = Image.new('RGB', (s, s), PURPLE)
    d = ImageDraw.Draw(im)
    pad = s * (1 - safe) / 2
    w = s * safe
    cols, rows = 4, 3
    gap = w * 0.03
    bw = (w - gap * (cols - 1)) / cols
    bh = w * 0.13
    top = pad + w * 0.10
    for r in range(rows):
        for c in range(cols):
            x = pad + c * (bw + gap)
            y = top + r * (bh + gap)
            d.rounded_rectangle([x, y, x + bw, y + bh], radius=bh * 0.3, fill=BRICKS[(r + c) % 4])
    cx, cy, br = pad + w * 0.62, pad + w * 0.62, w * 0.07
    d.ellipse([cx - br, cy - br, cx + br, cy + br], fill='white', outline=(58, 47, 75), width=int(w * 0.012))
    pw, ph = w * 0.42, w * 0.06
    px, py = pad + w * 0.5 - pw / 2, pad + w * 0.82
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=ph / 2, fill='white')
    return im.resize((size, size), Image.LANCZOS)


out = 'public/icons/'
draw(192, 0.88).save(out + 'icon-192.png')
draw(512, 0.88).save(out + 'icon-512.png')
draw(512, 0.66).save(out + 'icon-maskable-512.png')
draw(180, 0.88).save(out + 'apple-touch-icon.png')
