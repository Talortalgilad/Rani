"""Draws the app icons: the island of the 3D lobby, with a little parking lot on it, a stack of bricks and a memory card floating
beside it. Run: python3 scripts/make-icons.py
`safe` is the share of the canvas the artwork may use: 'any' icons 0.9; maskable icons 0.66 (Android cuts them to a circle or
rounded shape, so everything must stay inside the middle 80% circle). iPhone rounds the corners itself, so the picture is full-bleed."""
from PIL import Image, ImageDraw

SKY_TOP = (90, 178, 245)
SKY_BOTTOM = (214, 238, 252)
GRASS = (139, 212, 91)
GRASS_DARK = (96, 176, 70)
ROCK = (111, 82, 57)
ROCK_DARK = (86, 62, 42)
INK = (58, 47, 75)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vehicle(d, x, y, w, h, body, windows=2):
    """A toy vehicle seen from the front-above: rounded body, a lighter roof with windows, two wheels."""
    r = h * 0.28
    d.rounded_rectangle([x, y + h * 0.22, x + w, y + h], radius=r, fill=body, outline=INK, width=max(2, int(h * 0.06)))
    roof_w = w * 0.78
    rx = x + (w - roof_w) / 2
    d.rounded_rectangle([rx, y, rx + roof_w, y + h * 0.5], radius=r * 0.8, fill=body, outline=INK, width=max(2, int(h * 0.06)))
    gap = roof_w * 0.04
    ww = (roof_w * 0.86 - gap * (windows - 1)) / windows
    for i in range(windows):
        wx = rx + roof_w * 0.07 + i * (ww + gap)
        d.rounded_rectangle([wx, y + h * 0.08, wx + ww, y + h * 0.4], radius=h * 0.07, fill=(190, 233, 255))
    for wxr in (0.2, 0.8):
        cx = x + w * wxr
        d.ellipse([cx - h * 0.16, y + h * 0.78, cx + h * 0.16, y + h * 1.1], fill=INK)
        d.ellipse([cx - h * 0.07, y + h * 0.88, cx + h * 0.07, y + h * 1.0], fill=(220, 220, 230))


def cloud(d, cx, cy, r):
    for dx, dy, k in ((-1.1, 0.2, 0.8), (0, -0.2, 1.0), (1.1, 0.15, 0.85), (0.1, 0.35, 0.9)):
        d.ellipse([cx + dx * r - r * k, cy + dy * r - r * k * 0.8, cx + dx * r + r * k, cy + dy * r + r * k * 0.8], fill='white')


def draw(size: int, safe: float) -> Image.Image:
    s = size * 4  # supersample
    im = Image.new('RGB', (s, s))
    px = im.load()
    for y in range(s):
        c = lerp(SKY_TOP, SKY_BOTTOM, y / s)
        for x in range(s):
            px[x, y] = c
    d = ImageDraw.Draw(im)
    u = s * safe  # the working square
    ox = oy = s * (1 - safe) / 2

    def X(f): return ox + u * f
    def Y(f): return oy + u * f

    cloud(d, X(0.18), Y(0.2), u * 0.075)
    cloud(d, X(0.84), Y(0.12), u * 0.06)
    # the island: a rock cone under a grassy top
    cx, top_y, rx, ry = X(0.5), Y(0.56), u * 0.44, u * 0.14
    d.polygon([(cx - rx * 0.96, top_y + ry * 0.2), (cx + rx * 0.96, top_y + ry * 0.2), (cx + u * 0.02, Y(0.98)), (cx - u * 0.02, Y(0.98))], fill=ROCK)
    d.polygon([(cx + rx * 0.2, top_y + ry * 0.3), (cx + rx * 0.96, top_y + ry * 0.2), (cx + u * 0.02, Y(0.98))], fill=ROCK_DARK)
    d.ellipse([cx - rx, top_y - ry * 0.4, cx + rx, top_y + ry * 1.5], fill=GRASS_DARK)
    d.ellipse([cx - rx, top_y - ry, cx + rx, top_y + ry], fill=GRASS)
    # the parking lot: a pale pad, with a bus, a car and a small car
    d.rounded_rectangle([X(0.24), Y(0.45), X(0.76), Y(0.66)], radius=u * 0.025, fill=(249, 238, 221), outline=(201, 165, 116), width=max(2, int(u * 0.008)))
    vehicle(d, X(0.26), Y(0.43), u * 0.27, u * 0.14, (255, 210, 63), windows=3)  # bus
    vehicle(d, X(0.55), Y(0.45), u * 0.14, u * 0.12, (255, 93, 115), windows=1)  # car
    vehicle(d, X(0.40), Y(0.545), u * 0.13, u * 0.1, (58, 160, 255), windows=1)  # small car
    vehicle(d, X(0.58), Y(0.55), u * 0.13, u * 0.1, (63, 181, 107), windows=1)
    # floating beside it: three bricks (brick breaker) and a memory card
    for i, col in enumerate(((255, 93, 115), (255, 210, 63), (63, 181, 107))):
        bx, by = X(0.07), Y(0.33 - i * 0.075 + 0.0)
        d.rounded_rectangle([bx, by, bx + u * 0.17, by + u * 0.06], radius=u * 0.02, fill=col)
    d.rounded_rectangle([X(0.76), Y(0.2), X(0.9), Y(0.4)], radius=u * 0.02, fill='white', outline=INK, width=max(2, int(u * 0.008)))
    d.rounded_rectangle([X(0.78), Y(0.22), X(0.88), Y(0.38)], radius=u * 0.015, fill=GRASS)
    fx, fy, fr = X(0.83), Y(0.30), u * 0.022
    for k in range(5):
        import math
        a = k * 2 * math.pi / 5
        d.ellipse([fx + math.cos(a) * fr * 1.5 - fr, fy + math.sin(a) * fr * 1.5 - fr, fx + math.cos(a) * fr * 1.5 + fr, fy + math.sin(a) * fr * 1.5 + fr], fill='white')
    d.ellipse([fx - fr * 0.9, fy - fr * 0.9, fx + fr * 0.9, fy + fr * 0.9], fill=(255, 210, 63))
    return im.resize((size, size), Image.LANCZOS)


out = 'public/icons/'
draw(192, 0.9).save(out + 'icon-192.png')
draw(512, 0.9).save(out + 'icon-512.png')
draw(512, 0.66).save(out + 'icon-maskable-512.png')
draw(180, 0.9).save(out + 'apple-touch-icon.png')
