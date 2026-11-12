"""Cuts the 12 sheets of 3x3 objects (assets/english/raw) into one transparent WebP per word (public/english/words/<word>.webp)
and writes assets/english/cuts-report.json. Run: python3 scripts/english-images.py [sheet numbers...]
Objects are found as connected areas that are not white (no fixed grid); small parts (the tail of the kite, the raindrops) are
joined to the big object nearest to them; they are sorted left to right, top to bottom."""
import json, sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from rembg import new_session, remove
from skimage.morphology import convex_hull_image

RAW = 'assets/english/raw/'
OUT = 'public/english/words/'
WORDS = {
    1: 'phone tv ball doll bed book box lamp chair',
    2: 'pizza cheese pasta meat apple banana milk cake egg',
    3: 'slide swing tree bike skates helmet flower bench kite',
    4: 'pencil brush crayons paper palette scissors glue picture easel',
    5: 'candy lollipop cupcake icecream cookie donut chocolate balloon gift',
    6: 'mom dad brother sister baby grandma grandpa family friends',
    7: 'shirt shorts dress skirt shoes socks hat jacket glasses',
    8: 'jump clap dance sing run sleep eat drink wave',
    9: 'sun cloud rain snowflake wind rainbow umbrella snowman storm',
    10: 'cat dog lion monkey fish bird elephant giraffe rabbit',
    11: 'rope wall beam bars tunnel crate bridge mat ladder',
    12: 'stage microphone guitar drum piano trumpet star crown flowers',
}
NAMES = {1: 'room', 2: 'kitchen', 3: 'garden', 4: 'art', 5: 'candy', 6: 'family', 7: 'clothes', 8: 'dance', 9: 'weather', 10: 'zoo', 11: 'ninja', 12: 'show'}
PAD = 0.06
SIZE = 512


def find_objects(rgb: np.ndarray):
    """The 9 objects of a sheet: (bbox, mask) found as non-white connected areas, small parts joined to the nearest big one."""
    h, w, _ = rgb.shape
    # distance from the white of the page: a bit forgiving, so pale objects (milk, egg, paper) are found too
    dist = 255 - rgb.min(axis=2).astype(int)
    for thr, grow in [(14, 14), (14, 8), (22, 14), (10, 10), (14, 22), (22, 8), (8, 6)]:
        mask = dist > thr
        mask = ndi.binary_opening(mask, iterations=1)
        near = ndi.binary_dilation(mask, iterations=grow)
        lab, n = ndi.label(near)
        if n < 9:
            continue
        # area of the real (not grown) pixels of each area
        areas = ndi.sum(mask, lab, index=np.arange(1, n + 1))
        order = np.argsort(-areas)
        big = list(order[:9] + 1)
        small = [i + 1 for i in order[9:] if areas[i] > 30]
        # the 9th area must clearly be an object, the 10th a part
        if len(order) > 9 and areas[order[8]] < 6 * areas[order[9]]:
            continue
        boxes = {i: ndi.find_objects((lab == i).astype(int))[0] for i in big + small}
        def centre(i):
            s = boxes[i]
            return ((s[0].start + s[0].stop) / 2, (s[1].start + s[1].stop) / 2)
        groups = {i: [i] for i in big}
        for i in small:
            cy, cx = centre(i)
            j = min(big, key=lambda b: np.hypot(centre(b)[0] - cy, centre(b)[1] - cx))
            groups[j].append(i)
        objs = []
        for i, members in groups.items():
            m = np.isin(lab, members) & ndi.binary_dilation(mask, iterations=2)
            ys, xs = np.where(m)
            objs.append(((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1), m))
        # rows first (three groups by vertical middle), then left to right
        objs.sort(key=lambda o: (o[0][0] + o[0][1]) / 2)
        rows = [sorted(objs[r * 3:(r + 1) * 3], key=lambda o: (o[0][2] + o[0][3]) / 2) for r in range(3)]
        return [o for r in rows for o in r], (thr, grow, n)
    raise RuntimeError('could not find 9 objects')


# words whose white parts or soft shadow need another threshold for what counts as the white page (default 248)
FLOOD = {'milk': 236, 'egg': 253}
FILL = (0, 200, 0)
# words where the background remover eats a white part that painting the page flat brings back (checked on the contact sheet); for the others
# the same trick would bring back the shadow under the object (between the legs of the swing)
ADD_BACK = {'bed', 'snowflake'}
# milk: the soft shadow is kept when the page is painted flat, so it is cut from the plain picture
PLAIN = {'milk'}
ADDED_SHARE = {}
# objects with a see-through gap that is enclosed by the object (between the slats of the bench): the white of the page there is made transparent
SEE_THROUGH = {'bench', 'snowflake', 'ladder'}


def flat_background(crop: Image.Image, thr=248, fill=FILL) -> Image.Image:
    """Paints the white page round the object a flat colour (flood fill from the border), so that white parts of the object
    (a pillow, an egg white, a snowman) stay clearly different from the background when the background is removed."""
    a = np.array(crop)
    white = a.min(axis=2) >= thr
    lab, n = ndi.label(white)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    a[bg] = fill
    return Image.fromarray(a)


def egg_white(crop: Image.Image, out: Image.Image) -> Image.Image:
    """The background remover keeps only the yolk of the fried egg (the white is white on white). The white is the pale area round the
    yolk, brighter than the shadow under it: take it back, together with the yolk."""
    a = np.array(crop).astype(int)
    page = ~np.isin(ndi.label(a.min(axis=2) >= 253)[0], np.unique(np.concatenate([ndi.label(a.min(axis=2) >= 253)[0][0], ndi.label(a.min(axis=2) >= 253)[0][-1], ndi.label(a.min(axis=2) >= 253)[0][:, 0], ndi.label(a.min(axis=2) >= 253)[0][:, -1]])))
    sat = a.max(axis=2) - a.min(axis=2)
    pale = page & ((a.min(axis=2) >= 237) | (sat > 25))
    yolk = np.array(out)[:, :, 3] > 128
    lab, n = ndi.label(pale | yolk)
    keep = np.unique(lab[yolk])
    keep = keep[keep > 0]
    mask = np.isin(lab, keep)
    mask = ndi.binary_fill_holes(ndi.binary_closing(mask, iterations=3))
    mask = ndi.binary_opening(mask, iterations=2)
    alpha = (ndi.gaussian_filter(mask.astype(float), 1.2) * 255).clip(0, 255).astype(np.uint8)
    res = np.dstack([np.array(crop), alpha])
    return Image.fromarray(res, 'RGBA')


def cut(img: Image.Image, box, session, word=''):
    y0, y1, x0, x1 = box
    m = int(0.04 * max(y1 - y0, x1 - x0)) + 8
    crop = img.crop((max(0, x0 - m), max(0, y0 - m), min(img.width, x1 + m), min(img.height, y1 + m)))
    plain = remove(crop, session=session, post_process_mask=True)
    if word in PLAIN:
        out = plain
    else:
        flat = remove(flat_background(crop, FLOOD.get(word, 248)), session=session, post_process_mask=True)
        # Removing the background of the plain picture keeps the object clean (no shadow) but eats white parts (a pillow, the white of
        # an egg). Painting the page flat keeps them but also keeps the soft shadow. So: the painted-flat result counts only inside the
        # outline (hull) of the plain result, where there is no room for the shadow on the floor.
        pa_full = np.array(plain)[:, :, 3]
        pa = pa_full > 40
        hull = ndi.binary_dilation(convex_hull_image(pa), iterations=10) if pa.any() else pa
        fa = np.array(flat)
        # background seen between parts of the object (the arms of the snowflake) is still painted: not part of the object
        painted = (np.abs(fa[:, :, 0].astype(int) - FILL[0]) < 40) & (np.abs(fa[:, :, 1].astype(int) - FILL[1]) < 40) & (np.abs(fa[:, :, 2].astype(int) - FILL[2]) < 40)
        fa[:, :, 3][ndi.binary_dilation(painted, iterations=1)] = 0
        near = ndi.binary_dilation(pa, iterations=2)
        # what the flat picture adds beyond the plain one: kept only when it is a real part (a pillow is wide), not a thin strip of
        # shadow along the edge
        added = hull & (fa[:, :, 3] > 40) & ~near
        # (shadow lies on the floor, at the bottom: what is added must be in the upper part of the object)
        ys_o = np.where(pa.any(axis=1))[0]
        cut_y = int(ys_o.min() + 0.72 * (ys_o.max() - ys_o.min())) if len(ys_o) else added.shape[0]
        added[cut_y:, :] = False
        share = float(added.sum()) / max(1, int(pa.sum()))
        ADDED_SHARE[word] = round(share, 4)
        if word not in ADD_BACK:
            added[:, :] = False
        added = ndi.binary_opening(added, structure=np.ones((3, 3)), iterations=6)
        keep = near | added
        # the plain result stays whole (painting the page flat can also carve holes in bright parts of the object); the colours are
        # always those of the picture itself
        alpha = np.maximum(pa_full, np.where(keep, fa[:, :, 3], 0))
        out = Image.fromarray(np.dstack([np.array(crop), alpha]), 'RGBA')
    if word == 'egg':
        out = egg_white(crop, out)
    a = np.array(out)
    if word in SEE_THROUGH:
        rgb = a[:, :, :3].astype(int)
        white = (rgb.min(axis=2) >= 246) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 8) & (a[:, :, 3] > 0)
        lab, n = ndi.label(white)
        for i in range(1, n + 1):
            if (lab == i).sum() >= 150:
                a[:, :, 3][ndi.binary_dilation(lab == i, iterations=2)] = 0
        out = Image.fromarray(a)
    alpha = a[:, :, 3]
    ys, xs = np.where(alpha > 12)
    if len(ys) == 0:
        raise RuntimeError('nothing left after removing the background')
    tight = out.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    return tight, crop, out


def square(tight: Image.Image) -> Image.Image:
    w, h = tight.size
    inner = max(w, h)
    side = int(round(inner / (1 - 2 * PAD)))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(tight, ((side - w) // 2, (side - h) // 2), tight)
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


if __name__ == '__main__':
    only = [int(x) for x in sys.argv[1:]] or list(WORDS)
    os.makedirs(OUT, exist_ok=True)
    session = new_session('isnet-general-use') if os.environ.get('ISNET') else new_session('u2net')
    report = {}
    for n in only:
        path = f"{RAW}sheet-{n:02d}-{NAMES[n]}.jpg"
        img = Image.open(path).convert('RGB')
        objs, how = find_objects(np.array(img))
        words = WORDS[n].split()
        assert len(objs) == 9 == len(words), (n, len(objs), len(words))
        for (box, _), word in zip(objs, words):
            tight, crop, raw_out = cut(img, box, session, word)
            res = square(tight)
            res.save(f'{OUT}{word}.webp', 'WEBP', quality=82, method=6)
            a = np.array(res)[:, :, 3]
            report[word] = {'sheet': n, 'box': [int(v) for v in box], 'opaque_share': round(float((a > 12).mean()), 3), 'white_part_candidate_share': ADDED_SHARE.get(word), 'cut': how[:2]}
        print('sheet', n, 'ok', how, flush=True)
    path = 'assets/english/cuts-report.json'
    if os.path.exists(path):
        report = {**json.load(open(path)), **report}
    json.dump(report, open(path, 'w'), indent=1)
