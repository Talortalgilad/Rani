"""Cuts the sheets of the letters journey (SPEC-letters.md) with the same pipeline as scripts/english-art.py (rembg, 512 x 512 WebP):
  assets/english/raw/sheet-13-letters-a.jpg  -> public/english/letter-words/{igloo,jam,nest,octopus,queen,van,web,fox,yoyo}.webp
  assets/english/raw/sheet-14-letters-b.jpg  -> .../{zebra,pig,hen,bus,cup,map,net,mug,bat}.webp
  assets/english/raw/sheet-16-letter-words.jpg -> .../{tap,sat,pat,pan,pin,mat,man,tin,nap}.webp
  assets/english/raw/letter-squishy-{s,m,g,r,f,z}.jpg (one letter each; or a sheet-15-letter-squishies.jpg, 3 x 2) -> public/english/letter-squishies/{s,m,g,r,f,z}.webp
and writes src/games/english/letters/pictures.ts, the list of the pictures that exist (the game offers only words that have a picture).
Run: python3 scripts/english-letters-art.py [13|14|16|15 ...]   (no argument: every sheet that is in the folder)"""
import importlib.util, os, sys
from PIL import Image
from rembg import new_session

spec = importlib.util.spec_from_file_location('art', os.path.join(os.path.dirname(__file__), 'english-art.py'))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)
import numpy as np

RAW = 'assets/english/raw/'
SHEETS = {
    '13': ('sheet-13-letters-a.jpg', 'letter-words', ['igloo', 'jam', 'nest', 'octopus', 'queen', 'van', 'web', 'fox', 'yoyo'], 9, 3),
    '14': ('sheet-14-letters-b.jpg', 'letter-words', ['zebra', 'pig', 'hen', 'bus', 'cup', 'map', 'net', 'mug', 'bat'], 9, 3),
    '16': ('sheet-16-letter-words.jpg', 'letter-words', ['tap', 'sat', 'pat', 'pan', 'pin', 'mat', 'man', 'tin', 'nap'], 9, 3),
    '15': ('sheet-15-letter-squishies.jpg', 'letter-squishies', ['s', 'm', 'g', 'r', 'f', 'z'], 6, 3),
}


def cut_single_squishies(session):
    """One picture for each squishy letter (the letter-squishy-<l>.jpg files)."""
    done = 0
    for l in ['s', 'm', 'g', 'r', 'f', 'z']:
        path = f'{RAW}letter-squishy-{l}.jpg'
        if not os.path.exists(path):
            continue
        img = Image.open(path).convert('RGB')
        objs = art.find_objects(np.array(img), 1, 1, None)
        os.makedirs('public/english/letter-squishies', exist_ok=True)
        art.cut(img, objs[0], session, None, True).save(f'public/english/letter-squishies/{l}.webp', 'WEBP', quality=82, method=6)
        done += 1
    print(f'letter squishies: {done} pictures', flush=True)


def cut_sheet(key, session):
    fname, folder, names, n, cols = SHEETS[key]
    path = RAW + fname
    if not os.path.exists(path):
        print(f'sheet {key}: {path} is not there, skipped')
        return False
    img = Image.open(path).convert('RGB')
    objs = art.find_objects(np.array(img), n, cols, None)
    assert len(objs) == n == len(names), (key, len(objs))
    os.makedirs(f'public/english/{folder}', exist_ok=True)
    for box, name in zip(objs, names):
        art.cut(img, box, session, None, True).save(f'public/english/{folder}/{name}.webp', 'WEBP', quality=82, method=6)
    print(f'sheet {key}: {len(names)} pictures -> public/english/{folder}/', flush=True)
    return True


def write_list():
    words = sorted(f[:-5] for f in os.listdir('public/english/letter-words')) if os.path.isdir('public/english/letter-words') else []
    sq = sorted(f[:-5] for f in os.listdir('public/english/letter-squishies')) if os.path.isdir('public/english/letter-squishies') else []
    with open('src/games/english/letters/pictures.ts', 'w') as f:
        f.write('/** The pictures made for the letters journey (written by scripts/english-letters-art.py): public/english/letter-words/<word>.webp and letter-squishies/<letter>.webp. */\n')
        f.write('export const LETTER_WORD_PICS: string[] = ' + repr(words).replace("'", "'") + ';\n')
        f.write('export const LETTER_SQUISHY_PICS: string[] = ' + repr(sq) + ';\n')
        f.write('\nexport const letterWordUrl = (word: string): string => `${import.meta.env.BASE_URL}english/letter-words/${word}.webp`;\n')
    print('pictures.ts:', len(words), 'words,', len(sq), 'squishies')


if __name__ == '__main__':
    keys = sys.argv[1:] or list(SHEETS)
    session = new_session('u2net')
    for k in keys:
        cut_sheet(k, session)
    if len(sys.argv) == 1 or '15' in keys:
        cut_single_squishies(session)
    write_list()
