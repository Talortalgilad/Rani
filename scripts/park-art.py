"""Cuts the art of the park game (assets/english/raw/park-art.json lists it; the raw files are saved next to it):
  the 4 sheets (sheet-25 .. sheet-28) -> public/park/items/<id>.webp (36 objects, 512 x 512 transparent WebP, rembg), in the order of the json
  (left to right, top to bottom); the panoramas -> public/park/bg/<zone>.webp (2520 wide, quality 80), the island -> public/park/bg/island.webp (1080 x 1920).
Run: python3 scripts/park-art.py"""
import importlib.util, json, os
import numpy as np
from PIL import Image
from rembg import new_session

spec = importlib.util.spec_from_file_location('art', os.path.join(os.path.dirname(__file__), 'english-art.py'))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

RAW = 'assets/english/raw/'
DATA = json.load(open(RAW + 'park-art.json'))
ZONE = {'bg-park-candy.png': 'candy', 'bg-park-beach.png': 'beach', 'bg-park-snow.png': 'snow', 'bg-park-space.png': 'space', 'bg-park-island.png': 'island'}


def items():
    os.makedirs('public/park/items', exist_ok=True)
    session = new_session('u2net')
    for sh in DATA['sheets']:
        img = Image.open(RAW + sh['file']).convert('RGB')
        objs = art.find_objects(np.array(img), len(sh['order']), 3, None)
        assert len(objs) == len(sh['order']), (sh['file'], len(objs))
        for box, name in zip(objs, sh['order']):
            art.cut(img, box, session, None, True).save(f'public/park/items/{name}.webp', 'WEBP', quality=82, method=6)
        print(sh['file'], len(objs), 'items', flush=True)


def backgrounds():
    os.makedirs('public/park/bg', exist_ok=True)
    for b in DATA['backgrounds']:
        im = Image.open(RAW + b['file']).convert('RGB')
        zone = ZONE[b['file']]
        if zone == 'island':
            # cover 1080 x 1920: scale to the width, crop the middle of the height
            k = max(1080 / im.width, 1920 / im.height)
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            l, t = (im.width - 1080) // 2, (im.height - 1920) // 2
            im.crop((l, t, l + 1080, t + 1920)).save('public/park/bg/island.webp', 'WEBP', quality=80, method=6)
        else:
            h = round(im.height * 2520 / im.width)
            im.resize((2520, h), Image.LANCZOS).save(f'public/park/bg/{zone}.webp', 'WEBP', quality=80, method=6)
        print(zone, flush=True)


if __name__ == '__main__':
    items()
    backgrounds()
