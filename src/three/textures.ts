import * as T from './lib';

/** Draws an existing SVG string (our illustrations) onto a canvas and returns it as a texture. */
/** With `bg`, the picture is centred on that colour (a card face); without it, it fills the canvas. */
export function svgToTexture(svg: string, width: number, height: number, bg?: string): Promise<T.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const g = c.getContext('2d')!;
      if (bg) {
        g.fillStyle = bg;
        g.fillRect(0, 0, width, height);
        const side = Math.min(width, height) * 0.86;
        g.drawImage(img, (width - side) / 2, (height - side) / 2, side, side);
      } else g.drawImage(img, 0, 0, width, height);
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      resolve(tex);
    };
    img.onerror = () => reject(new Error('svg texture failed'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Text (Hebrew too) as a texture, in the bundled Rubik font. */
export async function textToTexture(text: string, size = 128, color = '#3a2f4b'): Promise<T.CanvasTexture> {
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.font = `800 ${size * 0.7}px Rubik, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, size / 2, size / 2);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
