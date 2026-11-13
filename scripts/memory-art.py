"""Cuts the 3D pictures of the memory game (sheets 17-22 in assets/english/raw) with the pipeline of scripts/english-art.py (rembg, 512 x 512 WebP):
  17 farm, 18 + 19 sea, 20 + 21 space, 22 sweets  ->  public/memory/cards/<name>.webp
and writes src/games/memory/decks/cards.ts, the list of the pictures that exist (a picture that is missing keeps its drawn SVG).
Run: python3 scripts/memory-art.py [17 18 ...]   (no argument: every sheet that is there)"""
import importlib.util, os, sys
import numpy as np
from PIL import Image
from rembg import new_session

spec = importlib.util.spec_from_file_location('art', os.path.join(os.path.dirname(__file__), 'english-art.py'))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

RAW = 'assets/english/raw/'
SHEETS = {
    '17': ('sheet-17-memory-farm.jpg', ['cow', 'sheep', 'horse', 'duck', 'goat', 'donkey', 'barn', 'tractor', 'chick']),
    '18': ('sheet-18-memory-sea-a.jpg', ['whale', 'dolphin', 'crab', 'starfish', 'seahorse', 'turtle', 'shark', 'jellyfish', 'shell']),
    '19': ('sheet-19-memory-sea-b.jpg', ['sailboat', 'submarine', 'lighthouse', 'anchor', 'treasure', 'pufferfish', 'clownfish', 'lobster', 'seal']),
    '20': ('sheet-20-memory-space-a.jpg', ['rocket', 'moon', 'earth', 'saturn', 'astronaut', 'alien', 'ufo', 'comet', 'telescope']),
    '21': ('sheet-21-memory-space-b.jpg', ['satellite', 'helmet', 'mars', 'asteroid', 'rover', 'shootingstar', 'robot', 'station', 'nightsky']),
    '22': ('sheet-22-memory-sweets.jpg', ['macaron', 'gummybear', 'cottoncandy', 'popsicle', 'candycane', 'muffin', 'waffle', 'cakeslice', 'candyjar']),
}
OUT = 'public/memory/cards'


def cut_sheet(key, session):
    fname, names = SHEETS[key]
    path = RAW + fname
    if not os.path.exists(path):
        print(f'sheet {key}: {path} is not there, skipped')
        return
    img = Image.open(path).convert('RGB')
    objs = art.find_objects(np.array(img), 9, 3, None)
    assert len(objs) == 9, (key, len(objs))
    os.makedirs(OUT, exist_ok=True)
    for box, name in zip(objs, names):
        art.cut(img, box, session, None, True).save(f'{OUT}/{name}.webp', 'WEBP', quality=82, method=6)
    print(f'sheet {key}: 9 pictures', flush=True)


def write_list():
    names = sorted(f[:-5] for f in os.listdir(OUT)) if os.path.isdir(OUT) else []
    with open('src/games/memory/decks/cards.ts', 'w') as f:
        f.write('/** The 3D pictures of the memory game that were cut (written by scripts/memory-art.py): public/memory/cards/<name>.webp. A picture that is not here keeps its drawn SVG. */\n')
        f.write('export const CARD_IMAGES: string[] = ' + repr(names) + ';\n')
    print('cards.ts:', len(names), 'pictures')


if __name__ == '__main__':
    session = new_session('u2net')
    for k in (sys.argv[1:] or list(SHEETS)):
        cut_sheet(k, session)
    write_list()
