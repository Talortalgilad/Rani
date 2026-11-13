"""Cuts the pictures of the block game with the pipeline of scripts/memory-art.py (rembg, 512 x 512 WebP):
  sheet-24-blocks.jpg -> public/blocks/items/<name>.webp
and shrinks the world backgrounds (bg-blocks-*.jpg) to 1080 x 1920 WebP (quality 78) -> public/blocks/bg/<world>.webp
Run: python3 scripts/blocks-art.py"""
import importlib.util, os
import numpy as np
from PIL import Image
from rembg import new_session

spec = importlib.util.spec_from_file_location('art', os.path.join(os.path.dirname(__file__), 'english-art.py'))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

RAW = 'assets/english/raw/'
NAMES = ['ladybug', 'paintdrop', 'crate', 'ice', 'padlock', 'hammer', 'gem', 'butterfly', 'wand']
BGS = ['candy', 'garden', 'art', 'space']


def items():
    img = Image.open(RAW + 'sheet-24-blocks.jpg').convert('RGB')
    objs = art.find_objects(np.array(img), 9, 3, None)
    assert len(objs) == 9, len(objs)
    os.makedirs('public/blocks/items', exist_ok=True)
    session = new_session('u2net')
    for box, name in zip(objs, NAMES):
        art.cut(img, box, session, None, True).save(f'public/blocks/items/{name}.webp', 'WEBP', quality=82, method=6)
    print('9 items')


def backgrounds():
    os.makedirs('public/blocks/bg', exist_ok=True)
    for w in BGS:
        im = Image.open(f'{RAW}bg-blocks-{w}.jpg').convert('RGB')
        # cover 1080 x 1920: scale to fill, crop the centre
        k = max(1080 / im.width, 1920 / im.height)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        l, t = (im.width - 1080) // 2, (im.height - 1920) // 2
        im.crop((l, t, l + 1080, t + 1920)).save(f'public/blocks/bg/{w}.webp', 'WEBP', quality=78, method=6)
    print('4 backgrounds')


if __name__ == '__main__':
    items()
    backgrounds()
