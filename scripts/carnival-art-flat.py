"""Cuts carnival-art-4.json (sheet-39: 9 accessories on a white page with black grid lines) -> public/park/items/<id>.webp (512 x 512 transparent WebP).
Same output as scripts/carnival-art.py (square, 4 % margin, 512), but the background is removed by a flood from the page colour (no rembg: it was not available in this
environment): thin parts (the frames of the glasses, the fringe of the scarf) are kept because nothing is "guessed" - only the pixels connected to the page and almost white go.
The glasses have empty lenses, the scarf and the flower crown have the space of the neck or the head: the white inside (enclosed by the object) is made transparent too.
Run: python3 scripts/carnival-art-flat.py"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAW = 'assets/english/raw/'
DATA = json.load(open(RAW + 'carnival-art-4.json'))
HOLES = {'glasses', 'scarf', 'flowercrown'}  # enclosed page-coloured areas become transparent (lenses)
INSET = 14  # the black grid lines
TOL = 14


def cell(arr, r, c, n=3):
    h, w = arr.shape[:2]
    y0, y1 = round(h * r / n) + INSET, round(h * (r + 1) / n) - INSET
    x0, x1 = round(w * c / n) + INSET, round(w * (c + 1) / n) - INSET
    return arr[y0:y1, x0:x1]


def cut(crop, hole):
    near = (255 - crop.astype(int)).max(axis=2) <= TOL  # almost white
    lab, n = ndi.label(near)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    page = np.isin(lab, list(border))
    if hole:
        # enclosed white areas that are big (lenses), not the small highlights
        for i in range(1, n + 1):
            if i in border:
                continue
            m = lab == i
            if m.sum() > 400:
                page |= m
    obj = ~page
    obj = ndi.binary_opening(obj, iterations=1) | ndi.binary_erosion(obj, iterations=2)  # drops specks, keeps thin frames
    lab2, n2 = ndi.label(ndi.binary_dilation(obj, iterations=2))
    if n2 > 1:  # keep the biggest piece (and any piece bigger than 3 % of it)
        sizes = ndi.sum(obj, lab2, range(1, n2 + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= 0.03 * max(sizes)]
        obj &= np.isin(lab2, keep)
    soft = ndi.gaussian_filter(ndi.binary_erosion(obj, iterations=1).astype(float), 0.8)
    alpha = (np.clip(soft * 1.15, 0, 1) * 255).astype(np.uint8)
    # decontaminate the edge: pixels with partial alpha get the colour of the nearest solid pixel (no white halo)
    solid = ndi.binary_erosion(obj, iterations=2)
    idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    rgb = crop.copy()
    edge = (alpha > 0) & ~solid
    rgb[edge] = crop[idx[0][edge], idx[1][edge]]
    ys, xs = np.where(alpha > 12)
    out = Image.fromarray(np.dstack([rgb, alpha]), 'RGBA').crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    w, h = out.size
    side = int(round(max(w, h) / (1 - 2 * 0.04)))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(out, ((side - w) // 2, (side - h) // 2), out)
    return canvas.resize((512, 512), Image.LANCZOS)


if __name__ == '__main__':
    os.makedirs('public/park/items', exist_ok=True)
    for sh in DATA['sheets']:
        arr = np.array(Image.open(RAW + sh['file']).convert('RGB'))
        for i, name in enumerate(sh['order']):
            cut(cell(arr, i // 3, i % 3), name in HOLES).save(f'public/park/items/{name}.webp', 'WEBP', quality=82, method=6)
            print(name, flush=True)
