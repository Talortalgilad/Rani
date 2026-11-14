/**
 * The pictures of the park (public/park/): loaded once, with the empty margin cut off (the items are 512 px squares with the thing in the middle).
 * Drawing only (and a cache): nothing here is needed to play, a picture that has not come yet is simply not drawn.
 */
export interface Art { img: HTMLImageElement; sx: number; sy: number; sw: number; sh: number; ready: boolean }
const cache = new Map<string, Art>();
const listeners = new Set<() => void>();
/** Called when a picture has come (the builder draws again). Returns the way to stop. */
export function onArtLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
const loaded = (): void => listeners.forEach((f) => f());
const base = (): string => import.meta.env.BASE_URL;

/** The picture of an item (public/park/items/<name>.webp), trimmed to what is drawn in it. */
export function art(name: string): Art {
  let a = cache.get(name);
  if (a) return a;
  const img = new Image();
  const entry: Art = { img, sx: 0, sy: 0, sw: 1, sh: 1, ready: false };
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
      for (let y = 0; y < c.height; y += 2) for (let xx = 0; xx < c.width; xx += 2) if (d[(y * c.width + xx) * 4 + 3] > 24) {
        if (xx < x0) x0 = xx;
        if (xx > x1) x1 = xx;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (x1 > x0 && y1 > y0) Object.assign(entry, { sx: x0, sy: y0, sw: x1 - x0 + 2, sh: y1 - y0 + 2 });
      else Object.assign(entry, { sw: img.naturalWidth, sh: img.naturalHeight });
    } catch {
      Object.assign(entry, { sw: img.naturalWidth, sh: img.naturalHeight });
    }
    entry.ready = true;
    loaded();
  };
  img.src = `${base()}park/items/${name}.webp`;
  cache.set(name, (a = entry));
  return a;
}

/** Draws the picture with its bottom middle at (cx, by) and the given width (the height follows). Returns the height drawn, 0 when it is not loaded. */
export function drawArt(g: CanvasRenderingContext2D, a: Art, cx: number, by: number, w: number, flip = false): number {
  if (!a.ready) return 0;
  const h = (w * a.sh) / a.sw;
  if (flip) {
    g.save();
    g.translate(cx, by);
    g.scale(-1, 1);
    g.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, -w / 2, -h, w, h);
    g.restore();
  } else g.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, cx - w / 2, by - h, w, h);
  return h;
}

const panos = new Map<string, HTMLImageElement>();
/** The panorama of a zone (public/park/bg/<name>.webp, 2520 wide). */
export function panorama(name: string): HTMLImageElement | null {
  let i = panos.get(name);
  if (!i) {
    i = new Image();
    i.onload = loaded;
    i.src = `${base()}park/bg/${name}.webp`;
    panos.set(name, i);
  }
  return i.complete && i.naturalWidth ? i : null;
}
