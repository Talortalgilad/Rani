"""Cuts the art of carnival stages 2-4 (assets/english/raw/carnival-art-2.json lists it; the raw sheets are saved next to it):
  sheet-33 / sheet-34 (18 squishies) -> public/park/squishies/<id>.webp (ids as in src/lobby/carnival/residents.json), sheet-35 (9 props) -> public/park/items/<id>.webp,
  512 x 512 transparent WebP (rembg), in the order of the json. Same method as scripts/park-art.py.
Run: python3 scripts/carnival-art.py [carnival-art-4.json]   (carnival-art-4.json: sheet-39, 9 accessories -> public/park/items; only the sheets of that file are cut)"""
import importlib.util, json, os, sys
import numpy as np
from PIL import Image
from rembg import new_session

spec = importlib.util.spec_from_file_location('art', os.path.join(os.path.dirname(__file__), 'english-art.py'))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

RAW = 'assets/english/raw/'
FILE = sys.argv[1] if len(sys.argv) > 1 else 'carnival-art-2.json'
DATA = json.load(open(RAW + FILE))
OUT = {'sheet-33-squishies-food.png': 'public/park/squishies', 'sheet-34-squishies-animals.png': 'public/park/squishies', 'sheet-35-carnival-props.png': 'public/park/items', 'sheet-39-carnival-accessories.png': 'public/park/items'}

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
    if FILE != 'carnival-art-2.json':
        sys.exit(0)
    # carnival-art-3.json: single objects (a replacement for one prop): rembg on the whole picture, crop to the object, square, 512
    from rembg import remove
    single = json.load(open(RAW + 'carnival-art-3.json'))
    for sg in single.get('singles', []):
        out = remove(Image.open(RAW + sg['file']).convert('RGB'), session=session)
        c = out.crop(out.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
        n = max(c.size)
        pad = int(n * 0.04)
        big = Image.new('RGBA', (n + 2 * pad, n + 2 * pad), (0, 0, 0, 0))
        big.paste(c, (pad + (n - c.width) // 2, pad + (n - c.height) // 2))
        big.resize((512, 512), Image.LANCZOS).save(f"public/park/items/{sg['id']}.webp", 'WEBP', quality=82, method=6)
        print(sg['file'], 'single', flush=True)
