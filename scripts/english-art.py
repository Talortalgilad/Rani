"""Cuts the second round of art (assets/english/raw/Gemini_*.jpg) into public/english:
  cheesy/<expression>.webp (9), squishies/<id>.webp (12), paint/<name>.webp (9 white objects to be coloured), bg/<world>.webp (12).
Run: python3 scripts/english-art.py [cheesy|squishies|paint|bg ...]"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from rembg import new_session, remove

RAW = 'assets/english/raw/Gemini_Generated_Image_'
FILES = {
    'cheesy': 'nxdsrwnxdsrwnxds.jpg', 'squishies': 'ohjyswohjyswohjy.jpg', 'paint': 'lyfye8lyfye8lyfy.jpg',
}
# the twelve backgrounds, by the world they belong to (looked at one by one)
BG = {
    1: '69razy69razy69ra.jpg',   # the room with the bed and the shelf
    2: 'o9ptbwo9ptbwo9pt.jpg',   # the kitchen
    3: 'hm3tfhm3tfhm3tfh.jpg',   # the garden
    4: 'ptxvweptxvweptxv.jpg',   # the drawing studio
    5: '10a6uz10a6uz10a6.jpg',   # the candy shop
    6: '91q9fl91q9fl91q9.jpg',   # the living room with the family pictures
    7: 'ou5jwqou5jwqou5j (1).jpg',  # the wardrobe
    8: 's2ry7ps2ry7ps2ry.jpg',   # the dance party
    9: '38dp2m38dp2m38dp.jpg',   # the weather
    10: 'nga3awnga3awnga3.jpg',  # the zoo
    11: 'pseieupseieupsei.jpg',  # the ninja park
    12: 'pseieupseieupsei (1).jpg',  # the stage
}
EXPR = ['happy', 'thinking', 'surprised', 'cheer', 'dance', 'wave', 'sad', 'sleep', 'squished']
SQUISHIES = ['bunny', 'pizza', 'leafy', 'rainbow', 'cookie', 'cloud', 'panda', 'discoball', 'sunny', 'kitty', 'ninjacat', 'unicorn']
PAINT = ['ball', 'balloon', 'star', 'car', 'flower', 'house', 'shirt', 'butterfly', 'heart']
PAD = 0.06
SIZE = 512


def find_objects(rgb, n, cols, bg=None):
    """The n objects of a sheet (rows x cols), found as connected areas that differ from the page; small parts join the nearest big one."""
    a = rgb.astype(int)
    if bg is None:
        dist = 255 - a.min(axis=2)
    else:
        dist = np.abs(a - np.array(bg)).max(axis=2)
    for thr, grow in [(14, 14), (14, 8), (22, 14), (30, 14), (10, 10), (14, 22), (30, 20), (40, 24), (8, 6)]:
        mask = ndi.binary_opening(dist > thr, iterations=1)
        lab, k = ndi.label(ndi.binary_dilation(mask, iterations=grow))
        if k < n:
            continue
        areas = ndi.sum(mask, lab, index=np.arange(1, k + 1))
        order = np.argsort(-areas)
        if len(order) > n and areas[order[n - 1]] < 6 * areas[order[n]]:
            continue
        big = list(order[:n] + 1)
        small = [i + 1 for i in order[n:] if areas[i] > 30]
        boxes = {i: ndi.find_objects((lab == i).astype(int))[0] for i in big + small}
        ctr = lambda i: ((boxes[i][0].start + boxes[i][0].stop) / 2, (boxes[i][1].start + boxes[i][1].stop) / 2)
        groups = {i: [i] for i in big}
        for i in small:
            j = min(big, key=lambda b: np.hypot(ctr(b)[0] - ctr(i)[0], ctr(b)[1] - ctr(i)[1]))
            groups[j].append(i)
        objs = []
        for i, mem in groups.items():
            m = np.isin(lab, mem) & ndi.binary_dilation(mask, iterations=2)
            ys, xs = np.where(m)
            objs.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1))
        rows = n // cols
        objs.sort(key=lambda o: (o[0] + o[1]) / 2)
        out = []
        for r in range(rows):
            out += sorted(objs[r * cols:(r + 1) * cols], key=lambda o: (o[2] + o[3]) / 2)
        return out
    raise RuntimeError('objects not found')


def flat(crop, bg, thr):
    a = np.array(crop).astype(int)
    near = np.abs(a - np.array(bg)).max(axis=2) <= thr
    lab, _ = ndi.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    m = np.isin(lab, edge[edge > 0])
    a[m] = (0, 200, 0)
    return Image.fromarray(a.astype(np.uint8)), m


def cut(img, box, session, bg=None, white=False):
    y0, y1, x0, x1 = box
    m = int(0.04 * max(y1 - y0, x1 - x0)) + 8
    crop = img.crop((max(0, x0 - m), max(0, y0 - m), min(img.width, x1 + m), min(img.height, y1 + m)))
    plain = remove(crop, session=session, post_process_mask=True)
    pa = np.array(plain)[:, :, 3]
    alpha = pa
    if white:
        # a white object on the page: the plain result can eat white parts; the flat one keeps them (inside the outline of the plain one)
        page = bg if bg is not None else (255, 255, 255)
        fl, floodm = flat(crop, page, 6 if bg is not None else 7)
        f = np.array(remove(fl, session=session, post_process_mask=True))[:, :, 3]
        f[ndi.binary_dilation(floodm, iterations=1)] = 0
        near = ndi.binary_dilation(pa > 40, iterations=2)
        alpha = np.maximum(pa, np.where(near, f, 0))
    out = Image.fromarray(np.dstack([np.array(crop), alpha]), 'RGBA')
    ys, xs = np.where(alpha > 12)
    tight = out.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    w, h = tight.size
    side = int(round(max(w, h) / (1 - 2 * PAD)))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(tight, ((side - w) // 2, (side - h) // 2), tight)
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def run_sheet(kind, names, n, cols, session, bg=None, white=False):
    img = Image.open(RAW + FILES[kind]).convert('RGB')
    arr = np.array(img)
    if bg is None and kind == 'paint':
        bg = tuple(int(v) for v in np.median(arr[:20, :20].reshape(-1, 3), axis=0))
    objs = find_objects(arr, n, cols, bg)
    assert len(objs) == n == len(names), (kind, len(objs))
    os.makedirs(f'public/english/{kind}', exist_ok=True)
    for box, name in zip(objs, names):
        res = cut(img, box, session, bg, white)
        res.save(f'public/english/{kind}/{name}.webp', 'WEBP', quality=82, method=6)
    print(kind, 'ok', bg, flush=True)


if __name__ == '__main__':
    only = sys.argv[1:] or ['cheesy', 'squishies', 'paint', 'bg']
    session = new_session('u2net')
    if 'cheesy' in only:
        run_sheet('cheesy', EXPR, 9, 3, session, white=True)
    if 'squishies' in only:
        run_sheet('squishies', SQUISHIES, 12, 4, session, white=True)
    if 'paint' in only:
        run_sheet('paint', PAINT, 9, 3, session, white=True)
    if 'bg' in only:
        os.makedirs('public/english/bg', exist_ok=True)
        for world, f in BG.items():
            im = Image.open(RAW + f).convert('RGB')
            im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
            im.save(f'public/english/bg/{world}.webp', 'WEBP', quality=78, method=6)
        print('bg ok')
