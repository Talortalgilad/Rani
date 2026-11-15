"""The art of the squishy workshop (SPEC-squishy.md 4). assets/english/raw/squishy-art.json lists it; the raw sheets are saved next to it.

  python3 scripts/squishy-art.py cut     the 18 shapes -> public/squishy/shapes/<id>.webp, the 9 props -> public/squishy/props/<id>.webp
                                         (512 x 512 transparent WebP, rembg, same method as scripts/park-art.py), the background -> public/squishy/bg/workshop.webp
  python3 scripts/squishy-art.py parts   for every shape: the PART MAP and the SHADING MAP in one lossless picture, public/squishy/maps/<id>.png,
                                         the numbers of the parts in src/games/squishy/parts.json, and the contact sheet (assets/squishy-parts-contact.png)
                                         that shows every part in its own colour, with the number of the parts and a warning for a shape whose division is not clean.

The picture of a map (RGB, 512 x 512, no alpha, because a browser turns a colour under a transparent pixel into nothing):  R = the part (0: outside, 1..n),
  G = shading (100 = the colour as it is, 200 = twice as bright),  B = highlight (0..255: the shine that is added on top, white). The alpha is that of shapes/<id>.webp.
At run time: colour of the part x shading, then a little white by the highlight. So the squishy is 3D and shiny in any colour, with no picture for each colour.

How the parts are found (Lab space, hue AND lightness, because in the dog and the monkey the difference between two parts is dark brown against light brown):
  1. k-means in (LW L, a, b) over the pixels of the inside of the shape, k = 8, then the two nearest centres are merged while they are closer than MERGE.
  2. the small islands (< ISLAND of the shape: the shine, the noise) join the part around them. A pattern that repeats (the spots of the giraffe, the chips of the cookie,
     the stripe of the lollipop) stays ONE part: its pieces are big enough, and they have the same colour, so they share a number.
  3. the borders are smoothed (a blur of the labels), and the edge of the shape takes the nearest part.
"""
import importlib.util, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
from skimage.color import rgb2lab

RAW = 'assets/english/raw/'
SIZE = 512
DATA = json.load(open(RAW + 'squishy-art.json'))
MERGE = 13.0          # centres closer than this (in the units of the features) are one part
LW = 0.3             # the weight of the lightness (the light of a 3D picture is on every part, so the hue counts more)
THIN = 3              # a strip thinner than 2 x THIN pixels (the shine of an edge) joins the part next to it
ISLAND = 0.0018       # an island smaller than this share of the shape joins its neighbours
MIN_PART = 0.012      # a part smaller than this share is a warning (a speck is not a part)
# shapes whose default division is not right get their own numbers here (after looking at the contact sheet)
# k: how many parts the shape is made of (after looking at the picture), lw: the weight of the lightness, seeds: a pixel (x, y of the 512 picture) in each part, when the colours alone do not find them.
# With a k the centres are found by k-means (or started from the seeds) and are not merged.
OVERRIDE: dict[str, dict] = {
    # the animals and the cupcake: a 3D picture is lit, so one colour is spread over many lightnesses and k-means cuts by the light. Seeds (x, y of the 512 picture,
    # several for each part, in the light and in the shade) teach every pixel its part by the nearest seed colour.
    'cat': {'lw': 0.3, 'island': 0.004, 'seeds': [[(200, 100), (160, 300), (120, 420), (280, 330), (290, 410), (80, 330), (250, 190), (205, 115), (190, 118), (215, 112), (200, 455), (120, 455), (250, 440), (70, 405), (330, 400)], [(325, 70), (310, 90)], [(415, 235), (395, 300), (380, 370)], [(190, 350), (190, 400), (150, 330)]]},
    'dog': {'lw': 0.5, 'island': 0.004, 'seeds': [[(188, 130), (248, 300), (138, 420), (328, 420), (288, 130), (188, 195), (180, 250)], [(108, 110), (368, 100), (375, 150), (95, 160)], [(188, 360), (188, 320)], [(413, 320), (405, 345)]]},
    'rabbit': {'lw': 0.2, 'seeds': [[(250, 180), (230, 260), (130, 410), (300, 440), (340, 330), (240, 110)], [(200, 95), (300, 110), (210, 120)], [(225, 385), (215, 350), (235, 410)], [(375, 385), (370, 370)]]},
    'fish': {'lw': 0.25, 'seeds': [[(130, 250), (250, 190), (300, 300), (180, 330), (330, 170), (200, 130)], [(170, 385), (230, 410), (390, 200)], [(238, 80), (358, 290), (308, 430), (98, 430)], [(428, 180), (438, 330)]]},
    'bird': {'lw': 0.25, 'seeds': [[(200, 100), (150, 250), (300, 300), (90, 330), (250, 420), (170, 60)], [(160, 340), (170, 400)], [(155, 195), (90, 410), (230, 430)], [(420, 260), (380, 300)]]},
    'lion': {'lw': 0.7, 'island': 0.004, 'seeds': [[(108, 160), (188, 50), (338, 150), (128, 230), (338, 240), (188, 300), (120, 100), (240, 40), (330, 100), (300, 300), (100, 260), (250, 310), (150, 290)], [(208, 180), (208, 250), (288, 380), (138, 420), (248, 450), (338, 360), (178, 330), (208, 150), (250, 140), (170, 150), (250, 200), (200, 120), (108, 430), (268, 440), (318, 400), (188, 445), (128, 400), (88, 410), (330, 430)], [(198, 380), (203, 340)], [(403, 290), (168, 222), (415, 300)]]},
    'monkey': {'lw': 0.4, 'seeds': [[(250, 60), (300, 160), (110, 300), (260, 300), (90, 400), (300, 420)], [(150, 150), (150, 220), (200, 350), (180, 400), (260, 150)], [(100, 125), (360, 150)], [(425, 270), (390, 380)]]},
    'elephant': {'lw': 0.25, 'seeds': [[(248, 120), (268, 330), (128, 420), (168, 270), (78, 60), (418, 80), (388, 230), (98, 200)], [(108, 110), (368, 140)], [(128, 230), (243, 235), (358, 345), (283, 410), (113, 385)], [(428, 310)]]},
    'giraffe': {'lw': 0.3, 'seeds': [[(180, 130), (230, 260), (140, 350), (300, 400), (250, 160)], [(200, 190), (210, 380), (130, 420), (270, 440), (330, 375)], [(240, 60), (310, 240), (385, 325)], [(170, 85), (315, 95)]]},
    'cupcake': {'lw': 0.3, 'seeds': [[(238, 230), (380, 230), (188, 200), (348, 240), (288, 160)], [(253, 95)], [(188, 320), (368, 320), (263, 50)], [(248, 400), (148, 420), (368, 420)]]},
    # the other shapes: k-means, with the number of parts that the picture has
    'donut': {'k': 2}, 'icecream': {'k': 2}, 'cookie': {'k': 2, 'lw': 0.5}, 'lollipop': {'k': 2}, 'apple': {'lw': 0.25, 'island': 0.004, 'seeds': [[(250, 300), (130, 300), (380, 300), (250, 420), (165, 205), (400, 230), (330, 180), (120, 400), (380, 400)], [(320, 70), (360, 60), (290, 100)], [(225, 70), (250, 120)]]}, 'star': {'k': 2}, 'flower': {'k': 2}, 'crown': {'k': 2},
}


def cut_shape(art, name, img, box, session):
    """The cut of scripts/english-art.py, with one more step: rembg takes a white or pale part INSIDE the shape for the page (the belly of the cat, the inside of the
    ears of the rabbit, the elephant and the monkey), so every enclosed hole of the alpha is filled back, with the colours of the picture. The hole of the donut is a real
    one (its white middle is the page): it stays transparent."""
    from rembg import remove
    y0, y1, x0, x1 = box
    m = int(0.04 * max(y1 - y0, x1 - x0)) + 8
    crop = img.crop((max(0, x0 - m), max(0, y0 - m), min(img.width, x1 + m), min(img.height, y1 + m)))
    pa = np.array(remove(crop, session=session, post_process_mask=True))[:, :, 3]
    fl, floodm = art.flat(crop, (255, 255, 255), 7)
    f = np.array(remove(fl, session=session, post_process_mask=True))[:, :, 3]
    f[ndi.binary_dilation(floodm, iterations=1)] = 0
    alpha = np.maximum(pa, np.where(ndi.binary_dilation(pa > 40, iterations=2), f, 0))
    solid = alpha > 128
    filled = ndi.binary_fill_holes(solid)
    rgb = np.array(crop)
    if name == 'donut':
        pale = (rgb.min(axis=2) > 225) & filled
        lab, k = ndi.label(pale)
        cy, cx = rgb.shape[0] / 2, rgb.shape[1] / 2
        for i in range(1, k + 1):
            comp = lab == i
            ys, xs = np.where(comp)
            if comp.sum() > 0.01 * filled.sum() and abs(ys.mean() - cy) < 0.2 * rgb.shape[0] and abs(xs.mean() - cx) < 0.2 * rgb.shape[1]:
                alpha[ndi.binary_dilation(comp, iterations=2)] = 0
    else:
        alpha[ndi.binary_dilation(filled & ~solid, iterations=2) & filled] = 255
    out = Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')
    ys, xs = np.where(alpha > 12)
    tight = out.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    w, h = tight.size
    side = int(round(max(w, h) / (1 - 2 * art.PAD)))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(tight, ((side - w) // 2, (side - h) // 2))   # the colours under a transparent pixel are kept too
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def cut():
    spec = importlib.util.spec_from_file_location('art', os.path.join(os.path.dirname(__file__), 'english-art.py'))
    art = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(art)
    from rembg import new_session
    session = new_session('u2net')
    for sh in DATA['sheets']:
        out = f"public/squishy/{'shapes' if sh['kind'] == 'shapes' else 'props'}"
        os.makedirs(out, exist_ok=True)
        img = Image.open(RAW + sh['file']).convert('RGB')
        objs = art.find_objects(np.array(img), len(sh['order']), 3, None)
        assert len(objs) == len(sh['order']), (sh['file'], len(objs))
        for box, name in zip(objs, sh['order']):
            res = cut_shape(art, name, img, box, session) if sh['kind'] == 'shapes' else art.cut(img, box, session, None, True)
            res.save(f'{out}/{name}.webp', 'WEBP', quality=90, method=6, exact=True)
        print(sh['file'], len(objs), flush=True)
    os.makedirs('public/squishy/bg', exist_ok=True)
    for b in DATA['backgrounds']:
        im = Image.open(RAW + b['file']).convert('RGB')
        im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
        im.save('public/squishy/bg/workshop.webp', 'WEBP', quality=80, method=6)
        print('bg', im.size)


def kmeans(x, k, seed, iters=25):
    rng = np.random.default_rng(seed)
    c = x[rng.choice(len(x), 1)]
    for _ in range(k - 1):  # k-means++
        d = np.min(((x[:, None, :] - c[None]) ** 2).sum(-1), axis=1)
        c = np.vstack([c, x[rng.choice(len(x), 1, p=d / d.sum())]])
    for _ in range(iters):
        lab = np.argmin(((x[:, None, :] - c[None]) ** 2).sum(-1), axis=1)
        nc = np.array([x[lab == i].mean(0) if (lab == i).any() else c[i] for i in range(k)])
        if np.allclose(nc, c, atol=1e-3):
            break
        c = nc
    lab = np.argmin(((x[:, None, :] - c[None]) ** 2).sum(-1), axis=1)
    return c, lab, ((x - c[lab]) ** 2).sum()


def divide(rgba, merge=MERGE, island=ISLAND, k0=8, k=None, lw=LW, seeds=None):
    """-> labels (0 outside, 1..n), L (the lightness 0..100), n"""
    a = rgba[:, :, 3]
    rgb = rgba[:, :, :3].astype(float) / 255
    lab = rgb2lab(rgb)
    inner = ndi.binary_erosion(a > 200, iterations=3)
    f = np.dstack([lab[:, :, 0] * lw, lab[:, :, 1], lab[:, :, 2]])
    px = f[inner]
    rng = np.random.default_rng(1)
    sample = px[rng.choice(len(px), min(len(px), 12000), replace=False)]
    if seeds:
        # one colour per seed (the median of a small patch of the picture), every pixel of the inside to the part of the nearest seed
        sc, sl = [], []
        for pi, pts in enumerate(seeds):
            for (x, y) in pts:
                patch = f[max(0, y - 2):y + 3, max(0, x - 2):x + 3].reshape(-1, 3)
                sc.append(np.median(patch, axis=0))
                sl.append(pi + 1)
        sc, sl = np.array(sc), np.array(sl)
        d = ((f.reshape(-1, 1, 3) - sc[None]) ** 2).sum(-1)
        full = sl[np.argmin(d, axis=1)].reshape(a.shape)
        full[~inner] = 0
        return refine(full, lab, a, inner, len(seeds), island)
    best = None
    if k:
        k0, merge = k, 0.0
    for seed in range(6):
        c, _, inertia = kmeans(sample, k0, seed)
        if best is None or inertia < best[1]:
            best = (c, inertia)
    c = best[0]
    # merge the nearest centres while they are closer than `merge`
    groups = [[i] for i in range(len(c))]
    cent = [c[i].copy() for i in range(len(c))]
    cnt = [1.0] * len(c)
    lab0 = np.argmin(((px[:, None, :] - c[None]) ** 2).sum(-1), axis=1)
    cnt = [float((lab0 == i).sum()) for i in range(len(c))]
    while len(groups) > 1:
        best_d, bi, bj = 1e9, 0, 1
        for i in range(len(cent)):
            for j in range(i + 1, len(cent)):
                d = np.linalg.norm(cent[i] - cent[j])
                if d < best_d:
                    best_d, bi, bj = d, i, j
        if best_d >= merge:
            break
        tot = cnt[bi] + cnt[bj]
        cent[bi] = (cent[bi] * cnt[bi] + cent[bj] * cnt[bj]) / max(tot, 1)
        cnt[bi] = tot
        groups[bi] += groups[bj]
        del groups[bj], cent[bj], cnt[bj]
    cent = np.array(cent)
    # every pixel of the inside to the nearest centre
    full = np.argmin(((f.reshape(-1, 3)[:, None, :] - cent[None]) ** 2).sum(-1), axis=1).reshape(a.shape) + 1
    full[~inner] = 0
    return refine(full, lab, a, inner, len(cent), island)


def refine(full, lab, a, inner, n, island):
    """the same clean-up for every way of finding the parts: islands, thin strips, borders, the edge of the shape"""
    total = float(inner.sum())
    # the small islands join what is around them (never the pattern: its pieces are big enough)
    for _ in range(3):
        for p in range(1, n + 1):
            comp, m = ndi.label(full == p)
            if not m:
                continue
            sizes = ndi.sum(np.ones_like(comp), comp, index=np.arange(1, m + 1))
            for ci, s in enumerate(sizes, start=1):
                if s < island * total:
                    mask = comp == ci
                    ring = ndi.binary_dilation(mask, iterations=2) & ~mask & (full > 0)
                    if ring.any():
                        vals, cn = np.unique(full[ring], return_counts=True)
                        full[mask] = vals[np.argmax(cn)]
    # a lonely piece of a part (the shine on the forehead of the cat, white like the belly): when the part has only two or three pieces and this one is a small fraction of the
    # biggest, and one other part is all around it, it is not a part of its own (a pattern, with many pieces, is left alone)
    for p in range(1, n + 1):
        comp, m = ndi.label(full == p)
        if 2 <= m <= 3:
            sizes = ndi.sum(np.ones_like(comp), comp, index=np.arange(1, m + 1))
            big = sizes.max()
            for ci, sz in enumerate(sizes, start=1):
                if sz < 0.12 * big:
                    mask = comp == ci
                    ring = ndi.binary_dilation(mask, iterations=3) & ~mask & (full > 0)
                    vals, cn = np.unique(full[ring], return_counts=True)
                    if len(vals) and cn.max() >= 0.9 * cn.sum() and vals[np.argmax(cn)] != p:
                        full[mask] = vals[np.argmax(cn)]
    # a thin strip (a reflection on the rim, the dark line between two parts) is not a part: an opening takes it away, the nearest part takes its place
    if THIN:
        disk = ndi.generate_binary_structure(2, 1)
        keep = np.zeros_like(full)
        for p in range(1, n + 1):
            opened = ndi.binary_opening(full == p, structure=disk, iterations=THIN)
            keep[opened] = p
        gone = (full > 0) & (keep == 0)
        if gone.any():
            idx = ndi.distance_transform_edt(keep == 0, return_distances=False, return_indices=True)
            full = np.where(full > 0, keep[idx[0], idx[1]], 0)
    # parts that vanished are renumbered
    used = [p for p in range(1, n + 1) if (full == p).any()]
    remap = np.zeros(n + 2, dtype=int)
    for i, p in enumerate(used, start=1):
        remap[p] = i
    full = remap[full]
    n = len(used)
    # smooth the borders: a blur of every label, the biggest wins
    prob = np.stack([ndi.gaussian_filter((full == p).astype(float), 1.6) for p in range(1, n + 1)], axis=-1)
    sm = np.argmax(prob, axis=-1) + 1
    sm[~inner] = 0
    full = sm
    # the edge of the shape (the part of the picture that was eroded) takes the nearest part
    outer = a > 12
    idx = ndi.distance_transform_edt(full == 0, return_distances=False, return_indices=True)
    full = np.where(outer, full[idx[0], idx[1]], 0)
    return full, lab[:, :, 0], n




def metrics(full, n):
    total = float((full > 0).sum())
    out = {'parts': n, 'areas': [round(float((full == p).sum()) / total, 3) for p in range(1, n + 1)], 'pieces': []}
    tiny = 0.0
    for p in range(1, n + 1):
        comp, m = ndi.label(full == p)
        sizes = ndi.sum(np.ones_like(comp), comp, index=np.arange(1, m + 1)) if m else []
        out['pieces'].append(int(m))
        tiny += float(sum(s for s in sizes if s < 0.003 * total))
    out['tiny'] = round(tiny / total, 3)
    return out


def warnings(m):
    w = []
    if m['parts'] < 2:
        w.append('only one part')
    if m['parts'] > 5:
        w.append(f"{m['parts']} parts (more than 5)")
    if min(m['areas']) < MIN_PART:
        w.append('a part that is a speck')
    if m['tiny'] > 0.03:
        w.append('crumbs (small pieces)')
    return w


PALETTE = [(230, 57, 70), (42, 157, 143), (69, 123, 255), (255, 183, 3), (155, 93, 229), (0, 187, 249), (255, 119, 168), (120, 200, 60)]


def parts():
    shapes = [n for sh in DATA['sheets'] if sh['kind'] == 'shapes' for n in sh['order']]
    os.makedirs('public/squishy/maps', exist_ok=True)
    info = {}
    cells = []
    for name in shapes:
        rgba = np.array(Image.open(f'public/squishy/shapes/{name}.webp').convert('RGBA'))
        ov = OVERRIDE.get(name, {})
        full, L, n = divide(rgba, ov.get('merge', MERGE), ov.get('island', ISLAND), ov.get('k0', 8), ov.get('k'), ov.get('lw', LW), ov.get('seeds'))
        # the shading: the lightness of every pixel against the median of its own part (so a part keeps its shine and its shade in any colour)
        shade = np.zeros(L.shape)
        spec = np.zeros(L.shape)
        colors = []
        for p in range(1, n + 1):
            m = full == p
            ref = max(float(np.median(L[m])), 8.0)
            shade[m] = np.clip(L[m] / ref, 0.25, 2.0)
            hi = ref + 0.45 * (100 - ref)
            spec[m] = np.clip((L[m] - hi) / max(100 - hi, 1), 0, 1)
            colors.append([int(v) for v in np.median(rgba[:, :, :3][m], axis=0)])
        # the edge of the shape is lit by the white of the page (the antialiasing): it takes the shading of the nearest pixel of the inside, so there is no pale outline in a dark colour
        core = ndi.binary_erosion(rgba[:, :, 3] > 200, iterations=4)
        near = ndi.distance_transform_edt(~core, return_distances=False, return_indices=True)
        edge = (rgba[:, :, 3] > 0) & ~core
        shade[edge] = shade[near[0][edge], near[1][edge]]
        spec[edge] = spec[near[0][edge], near[1][edge]]
        mp = np.dstack([full.astype(np.uint8), np.clip(shade * 100, 0, 255).astype(np.uint8), (spec * 255).astype(np.uint8), rgba[:, :, 3]])
        Image.fromarray(mp[:, :, :3], 'RGB').save(f'public/squishy/maps/{name}.png', optimize=True)
        m = metrics(full, n)
        m['colors'] = colors
        m['warnings'] = warnings(m)
        info[name] = m
        print(f"{name:10s} {n} parts {m['areas']} pieces {m['pieces']} tiny {m['tiny']} {m['warnings'] or ''}", flush=True)
        cells.append((name, rgba, full, m))
    os.makedirs('src/games/squishy', exist_ok=True)
    json.dump(info, open('src/games/squishy/parts.json', 'w'), ensure_ascii=False, indent=1)
    contact(cells)


def contact(cells):
    W, H = 660, 340
    cols = 2
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * W, rows * H), (246, 244, 240))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
        small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    except OSError:
        font = small = ImageFont.load_default()
    for i, (name, rgba, full, m) in enumerate(cells):
        x, y = (i % cols) * W, (i // cols) * H
        bg = Image.new('RGBA', (512, 512), (255, 255, 255, 255))
        bg.alpha_composite(Image.fromarray(rgba, 'RGBA'))
        cl = np.zeros((512, 512, 4), dtype=np.uint8)
        for p in range(1, m['parts'] + 1):
            cl[full == p] = (*PALETTE[(p - 1) % len(PALETTE)], 255)
        c2 = Image.new('RGBA', (512, 512), (255, 255, 255, 255))
        c2.alpha_composite(Image.fromarray(cl, 'RGBA'))
        sheet.paste(bg.convert('RGB').resize((290, 290), Image.LANCZOS), (x + 8, y + 40))
        sheet.paste(c2.convert('RGB').resize((290, 290), Image.LANCZOS), (x + 306, y + 40))
        bad = bool(m['warnings'])
        d.text((x + 8, y + 8), f"{name}: {m['parts']} parts" + ('   !! NOT CLEAN' if bad else ''), fill=(200, 20, 20) if bad else (20, 90, 40), font=font)
        for p in range(m['parts']):
            d.rectangle((x + 640, y + 44 + p * 22, x + 652, y + 56 + p * 22), fill=PALETTE[p % len(PALETTE)])
            d.text((x + 598, y + 43 + p * 22), f"{int(m['areas'][p] * 100)}%", fill=(60, 60, 60), font=small)
        if bad:
            d.rectangle((x + 2, y + 2, x + W - 3, y + H - 3), outline=(220, 30, 30), width=3)
            d.text((x + 8, y + H - 22), '; '.join(m['warnings'])[:60], fill=(200, 20, 20), font=small)
    sheet.save('assets/squishy-parts-contact.png')
    print('contact sheet: assets/squishy-parts-contact.png')


if __name__ == '__main__':
    for step in sys.argv[1:] or ['cut', 'parts']:
        {'cut': cut, 'parts': parts}[step]()
