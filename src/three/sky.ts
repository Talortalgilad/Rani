/** Sky colours by time of day: bright morning, blue noon, orange-pink evening, calm indigo night. */

export interface Sky { top: string; bottom: string; light: string; intensity: number }

const KEYS: { h: number; top: string; bottom: string; light: string; intensity: number }[] = [
  { h: 0, top: '#2b2f6b', bottom: '#5b5aa8', light: '#b9c4ff', intensity: 0.7 },
  { h: 5, top: '#3d4a8f', bottom: '#f2a6b8', light: '#ffd9c2', intensity: 0.9 },
  { h: 8, top: '#7ec8ff', bottom: '#fff3c9', light: '#fff1d0', intensity: 1.5 },
  { h: 12, top: '#4aa8f0', bottom: '#d9f1ff', light: '#ffffff', intensity: 1.8 },
  { h: 16, top: '#5bb0f0', bottom: '#ffe9b5', light: '#fff0cc', intensity: 1.6 },
  { h: 18.5, top: '#ff9a6b', bottom: '#ffd0e0', light: '#ffc28a', intensity: 1.3 },
  { h: 20.5, top: '#4a3f8f', bottom: '#d98fb8', light: '#e0b3ff', intensity: 0.9 },
  { h: 24, top: '#2b2f6b', bottom: '#5b5aa8', light: '#b9c4ff', intensity: 0.7 },
];

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) =>
  '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

export function skyFor(date: Date): Sky {
  const h = date.getHours() + date.getMinutes() / 60;
  let i = 0;
  while (i < KEYS.length - 2 && h >= KEYS[i + 1].h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  return {
    top: mix(a.top, b.top, t),
    bottom: mix(a.bottom, b.bottom, t),
    light: mix(a.light, b.light, t),
    intensity: a.intensity + (b.intensity - a.intensity) * t,
  };
}
