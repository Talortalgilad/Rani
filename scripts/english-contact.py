"""A contact sheet of every cut-out word, on a coloured background so that missing white parts show.
python3 scripts/english-contact.py out.png [bg=#9fd8b0] [size=170] [cols=11] [words...]"""
import sys
from PIL import Image, ImageDraw, ImageFont
import os
src = open('scripts/english-images.py').read()
ns = {}
exec(src[src.index('WORDS = {'):src.index('NAMES =')], ns)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/contact.png'
bg = sys.argv[2] if len(sys.argv) > 2 else '#9fd8b0'
S = int(sys.argv[3]) if len(sys.argv) > 3 else 170
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 11
words = sys.argv[5:] or [w for n in sorted(ns['WORDS']) for w in ns['WORDS'][n].split()]
words = [w for w in words]
if not sys.argv[5:] and os.path.exists('public/english/body.webp'):
    words.append('body')
rows = (len(words) + cols - 1) // cols
sheet = Image.new('RGB', (cols * S, rows * (S + 26)), bg)
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    font = ImageFont.load_default()
for i, w in enumerate(words):
    p = f'public/english/body.webp' if w == 'body' else f'public/english/words/{w}.webp'
    im = Image.open(p).convert('RGBA').resize((S - 8, S - 8), Image.LANCZOS)
    x, y = (i % cols) * S, (i // cols) * (S + 26)
    sheet.paste(im, (x + 4, y + 2), im)
    tw = d.textlength(w, font=font)
    d.text((x + (S - tw) / 2, y + S - 4), w, fill=(30, 30, 50), font=font)
sheet.save(out)
print(len(words), 'tiles', sheet.size)
