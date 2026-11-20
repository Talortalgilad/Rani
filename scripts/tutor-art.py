"""Cuts the art of the tutor (assets/english/raw/tutor-art.json lists it; the raw sheets are saved next to it):
  sheet-31-lolly.png (9 Lolly poses) and sheet-32-faces.png (9 faces) -> public/english/tutor/<id>.webp, 512 x 512 transparent WebP (rembg), in the order of the json
  (left to right, top to bottom). Same method as scripts/park-art.py.
Run: python3 scripts/tutor-art.py"""
import importlib.util, json, os
import numpy as np
from PIL import Image
from rembg import new_session

spec = importlib.util.spec_from_file_location('art', os.path.join(os.path.dirname(__file__), 'english-art.py'))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

RAW = 'assets/english/raw/'
DATA = json.load(open(RAW + 'tutor-art.json'))


def items():
    os.makedirs('public/english/tutor', exist_ok=True)
    session = new_session('u2net')
    for sh in DATA['sheets']:
        img = Image.open(RAW + sh['file']).convert('RGB')
        objs = art.find_objects(np.array(img), len(sh['order']), 3, None)
        assert len(objs) == len(sh['order']), (sh['file'], len(objs))
        for box, name in zip(objs, sh['order']):
            art.cut(img, box, session, None, True).save(f'public/english/tutor/{name}.webp', 'WEBP', quality=82, method=6)
        print(sh['file'], len(objs), 'items', flush=True)


if __name__ == '__main__':
    items()
