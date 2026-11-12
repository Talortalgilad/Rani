/** Paints a picture in one colour: the picture's own light and shade are kept, the colour is the one asked for (a grey ball becomes red). */
export function tintedCanvas(img: HTMLImageElement, hex: string | null, size = 360): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, size, size);
  const d = g.getImageData(0, 0, size, size);
  const r = parseInt((hex ?? '#888888').slice(1, 3), 16);
  const gr = parseInt((hex ?? '#888888').slice(3, 5), 16);
  const b = parseInt((hex ?? '#888888').slice(5, 7), 16);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) / 255; // light of the pixel
    if (!hex) {
      const v = 120 + 120 * l; // not painted yet: grey
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      continue;
    }
    const k = 0.5 + 0.7 * l;
    d.data[i] = Math.min(255, r * k);
    d.data[i + 1] = Math.min(255, gr * k);
    d.data[i + 2] = Math.min(255, b * k);
  }
  g.putImageData(d, 0, 0);
  return c;
}
