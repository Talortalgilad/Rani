"""Finds, for every picture of a resident (public/park/squishies, public/english/squishies, the companion), where the accessories go: the top of the head, the eyes, the mouth,
the neck (just under the mouth), the width of the body, `prof` (the width of the body at 51 heights, to find where the head is as wide as a hat), in fractions of the 512 x 512 picture (0,0 = top left).  Writes src/lobby/carnival/anchors.json.
The face is found from the dark dots (the eyes are the two dark blobs that sit side by side in the upper part of the body, the mouth is the dark blob under them);
OVERRIDE has the values that were set by hand where the face is not like the others (a mask, a closed mouth that is too small to see).
Run: python3 scripts/accessory-anchors.py [--debug dir]"""
import glob, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

OVERRIDE = {
    'cookie': {'mouthY': 0.6},
    'cupcake': {'eyeY': 0.78, 'mouthY': 0.84, 'cx': 0.5},
    'pretzel': {'eyeY': 0.5, 'mouthY': 0.6, 'cx': 0.5},
    'dino': {'mouthY': 0.5},
    'rainbow': {'eyeY': 0.33, 'mouthY': 0.38},
    'bee': {'headTop': 0.46},  # the wings and the antennae are higher than the head: hats sit on the head
}  # id -> values that were set by hand where the face is not like the others

def analyse(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    alpha = a[:, :, 3] > 40
    ys, xs = np.where(alpha)
    top, bottom, left, right = ys.min() / 512, ys.max() / 512, xs.min() / 512, xs.max() / 512
    cx = float(xs.mean()) / 512
    lum = a[:, :, :3].astype(float) @ np.array([0.3, 0.59, 0.11])
    dark = alpha & (lum < 75)
    lab, n = ndi.label(dark)
    blobs = []
    for i in range(1, n + 1):
        yy, xx = np.where(lab == i)
        if 25 <= len(yy) <= 2500:
            blobs.append((yy.mean() / 512, xx.mean() / 512, len(yy)))
    h = bottom - top
    eyes = None
    best = 1e9
    for i in range(len(blobs)):
        for j in range(i + 1, len(blobs)):
            (y1, x1, s1), (y2, x2, s2) = blobs[i], blobs[j]
            if abs(y1 - y2) > 0.03 or not (0.06 < abs(x1 - x2) < 0.4) or not (top + 0.12 * h < (y1 + y2) / 2 < top + 0.75 * h):
                continue
            score = abs(s1 - s2) / max(s1, s2) + abs((x1 + x2) / 2 - cx) * 4 + abs((y1 + y2) / 2 - (top + 0.45 * h)) * 2
            if score < best:
                best, eyes = score, ((y1 + y2) / 2, (x1 + x2) / 2, abs(x1 - x2))
    eyeY = eyes[0] if eyes else top + 0.45 * h
    ex = eyes[1] if eyes else cx
    gap = eyes[2] if eyes else 0.15
    below = [b for b in blobs if b[0] > eyeY + 0.02 and b[0] < eyeY + 0.25 and abs(b[1] - ex) < gap]
    mouthY = max(below, key=lambda b: b[2])[0] if below else eyeY + 0.08
    # the width of the body at the level of the neck
    ny = int((mouthY + 0.06) * 512)
    row = np.where(alpha[min(511, ny)])[0]
    nw = (row.max() - row.min()) / 512 if len(row) else right - left
    ey = int(eyeY * 512)
    erow = np.where(alpha[min(511, ey)])[0]
    eyeW = (erow.max() - erow.min()) / 512 if len(erow) else right - left
    prof = [round(float((lambda r: (r.max() - r.min() + 1) / 512 if len(r) else 0)(np.where(alpha[min(511, int(k / 50 * 512))])[0])), 3) for k in range(51)]
    return {'prof': prof, 'eyeW': round(eyeW, 3), 'eyeGap': round(gap, 3), 'top': round(top, 3), 'bottom': round(bottom, 3), 'left': round(left, 3), 'right': round(right, 3), 'cx': round(ex if eyes else cx, 3), 'eyeY': round(eyeY, 3), 'mouthY': round(mouthY, 3), 'neckY': round(mouthY + 0.06, 3), 'neckW': round(nw, 3), 'found': bool(eyes)}

ANIMALS = ['cat', 'dog', 'rabbit', 'fish', 'bird', 'lion', 'monkey', 'elephant', 'giraffe']
SHAPES = ANIMALS + ['cupcake', 'donut', 'icecream', 'cookie', 'lollipop', 'apple', 'star', 'flower', 'crown']

def face_of(shape, alpha):
    """where the workshop draws the face (the same as faceAnchor in src/games/squishy/shapes.ts): x, y, size in pixels of the 512 picture"""
    ys, xs = np.where(alpha)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if shape in ANIMALS:
        y = int(round(y0 + h * 0.3))
        row = np.where(alpha[y])[0]
        return ((row.min() + row.max()) / 2, y, (row.max() - row.min()) / 2) if len(row) > 1 else (cx, y, w * 0.3)
    at = {'cupcake': (cx, y0 + h * 0.5, w * 0.34), 'donut': (cx, y0 + h * 0.86, w * 0.17), 'icecream': (cx, y0 + h * 0.3, w * 0.34), 'cookie': (cx, cy, w * 0.34),
          'lollipop': (cx, y0 + h * 0.33, w * 0.3), 'apple': (cx, cy + h * 0.08, w * 0.3), 'star': (cx, cy + h * 0.05, w * 0.26), 'flower': (cx, cy, w * 0.13), 'crown': (cx, y0 + h * 0.7, w * 0.26)}
    return at[shape]

def analyse_shape(shape):
    """the anchors of a squishy that Rani made: from the picture of its mold and from where the workshop puts the face (the face is drawn there whatever colours she chose)"""
    a = np.array(Image.open(f'public/squishy/shapes/{shape}.webp').convert('RGBA'))[:, :, 3] > 40
    ys, xs = np.where(a)
    top, bottom, left, right = ys.min() / 512, ys.max() / 512, xs.min() / 512, xs.max() / 512
    fx, fy, fs = face_of(shape, a)
    eyeY, mouthY, gap = fy / 512, (fy + 0.13 * fs) / 512, 0.68 * fs / 512
    def width(v):
        r = np.where(a[min(511, int(v * 512))])[0]
        return (r.max() - r.min() + 1) / 512 if len(r) else 0
    prof = [round(float(width(k / 50)), 3) for k in range(51)]
    return {'prof': prof, 'eyeW': round(width(eyeY), 3), 'eyeGap': round(gap, 3), 'top': round(top, 3), 'bottom': round(bottom, 3), 'left': round(left, 3), 'right': round(right, 3), 'cx': round(fx / 512, 3),
            'eyeY': round(eyeY, 3), 'mouthY': round(mouthY, 3), 'neckY': round(mouthY + 0.06, 3), 'neckW': round(width(mouthY + 0.06), 3), 'found': True,
            # the picture is drawn as big as the residents (a little bigger or smaller by how much of its frame the mold fills): everything that sits on it is scaled by this
            'fill': round(max(0.8, min(1.5, 0.88 / max(right - left, bottom - top))), 3)}

def main():
    files = glob.glob('public/park/squishies/*.webp') + glob.glob('public/english/squishies/*.webp') + ['public/english/cheesy/happy.webp']
    out = {}
    dbg = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None
    tiles = []
    for f in sorted(files):
        key = os.path.basename(f)[:-5]
        if f.endswith('cheesy/happy.webp'):
            key = 'cheesy'
        r = analyse(f)
        r.update(OVERRIDE.get(key, {}))
        r['neckY'] = round(r['mouthY'] + 0.06, 3)
        out[key] = r
        if dbg:
            im = Image.open(f).convert('RGBA')
            bg = Image.new('RGBA', im.size, (60, 56, 80, 255)); bg.alpha_composite(im)
            d = ImageDraw.Draw(bg)
            for name, col in (('top', (255, 255, 0)), ('eyeY', (0, 255, 255)), ('mouthY', (255, 0, 255)), ('neckY', (0, 255, 0))):
                y = r[name] * 512; d.line([(r['cx'] * 512 - 120, y), (r['cx'] * 512 + 120, y)], fill=col, width=2)
            d.text((6, 6), key + ('' if r['found'] else ' (no face found)'), fill=(255, 255, 255))
            tiles.append(bg.convert('RGB').resize((256, 256)))
    if dbg:
        os.makedirs(dbg, exist_ok=True)
        cols = 6
        sheet = Image.new('RGB', (cols * 256, ((len(tiles) + cols - 1) // cols) * 256))
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % cols) * 256, (i // cols) * 256))
        sheet.save(os.path.join(dbg, 'anchors.png'))
    for sh in SHAPES:
        out[f'shape:{sh}'] = analyse_shape(sh)
    json.dump(out, open('src/lobby/carnival/anchors.json', 'w'), indent=1, sort_keys=True)
    print(len(out), 'pictures (incl. the 18 molds of the workshop);', sum(1 for v in out.values() if not v['found']), 'without a face found')

if __name__ == '__main__':
    main()
