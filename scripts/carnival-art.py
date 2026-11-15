"""Cuts the art of carnival stages 2-4 (assets/english/raw/carnival-art-2.json lists it; the raw sheets are saved next to it):
  sheet-33 / sheet-34 (18 squishies) -> public/park/squishies/<id>.webp (ids as in src/lobby/carnival/residents.json), sheet-35 (9 props) -> public/park/items/<id>.webp,
  512 x 512 transparent WebP (rembg), in the order of the json. Same method as scripts/park-art.py.
Run: python3 scripts/carnival-art.py"""
import importlib.util, json, os
import numpy as np
from PIL import Image
from rembg import new_session

spec = importlib.util.spec_from_file_location('art', os.path.join(os.path.dirname(__file__), 'english-art.py'))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

RAW = 'assets/english/raw/'
DATA = json.load(open(RAW + 'carnival-art-2.json'))
OUT = {'sheet-33-squishies-food.png': 'public/park/squishies', 'sheet-34-squishies-animals.png': 'public/park/squishies', 'sheet-35-carnival-props.png': 'public/park/items'}

if __name__ == '__main__':
    session = new_session('u2net')
    for sh in DATA['sheets']:
        out = OUT[sh['file']]
        os.makedirs(out, exist_ok=True)
        img = Image.open(RAW + sh['file']).convert('RGB')
        objs = art.find_objects(np.array(img), len(sh['order']), 3, None)
        assert len(objs) == len(sh['order']), (sh['file'], len(objs))
        for box, name in zip(objs, sh['order']):
            art.cut(img, box, session, None, True).save(f'{out}/{name}.webp', 'WEBP', quality=82, method=6)
        print(sh['file'], len(objs), 'items', flush=True)
