import { describe, expect, it } from 'vitest';
import { cleanRecording, levelDb, normalize, toInt16, trimSilence } from './audioFx';
import { crc32, readZip, writeZip } from './zip';

const R = 24000;
const tone = (sec: number, amp: number): Float32Array => Float32Array.from({ length: Math.round(sec * R) }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / R));
const cat = (...a: Float32Array[]): Float32Array => {
  const o = new Float32Array(a.reduce((x, y) => x + y.length, 0));
  let p = 0;
  for (const y of a) (o.set(y, p), (p += y.length));
  return o;
};

describe('cleaning a recording', () => {
  it('cuts the silence at both ends and leaves a short breath', () => {
    const s = cat(new Float32Array(R), tone(0.5, 0.3), new Float32Array(2 * R));
    const t = trimSilence(s, R)!;
    expect(t.length / R).toBeGreaterThan(0.5);
    expect(t.length / R).toBeLessThan(0.5 + 0.04 + 0.12 + 0.03);
  });
  it('silence (or a recording of room noise) is nothing', () => {
    expect(trimSilence(new Float32Array(R), R)).toBeNull();
    expect(cleanRecording(Float32Array.from({ length: R }, () => 0.0005), R)).toBeNull();
  });
  it('quiet and loud recordings come out at about the same level, and never clip', () => {
    const quiet = cleanRecording(tone(0.6, 0.02), R)!;
    const loud = cleanRecording(tone(0.6, 0.9), R)!;
    expect(levelDb(quiet)).toBeLessThanOrEqual(-1.4);
    expect(levelDb(loud)).toBeLessThanOrEqual(-1.4);
    expect(Math.abs(levelDb(quiet) - levelDb(loud))).toBeLessThan(3);
  });
  it('fades at the ends and converts to 16 bit', () => {
    const n = normalize(tone(0.2, 0.5), R);
    expect(n[0]).toBe(0);
    expect(toInt16(Float32Array.of(1, -1, 0, 2))).toEqual(Int16Array.of(32767, -32767, 0, 32767));
  });
});

describe('the zip of recordings', () => {
  it('writes and reads back files by name', async () => {
    const files = [{ name: 'ask_name.mp3', data: Uint8Array.of(1, 2, 3, 4) }, { name: 'w_ball.mp3', data: new Uint8Array(1000).fill(7) }];
    const back = await readZip(writeZip(files));
    expect(back.map((f) => f.name)).toEqual(['ask_name.mp3', 'w_ball.mp3']);
    expect(Array.from(back[0].data)).toEqual([1, 2, 3, 4]);
    expect(back[1].data.length).toBe(1000);
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('rejects a file that is not a zip', async () => {
    await expect(readZip(new Uint8Array(40))).rejects.toThrow();
  });
});
