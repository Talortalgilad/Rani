import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meetSequence } from './letters/tasks/meet';
import { guardMs, playClip, SOUND_GUARD } from './voice';

/** A sound that never ends: the `ended` event does not come (a phone that loses it, a clip that does not load, an empty file). */
class FakeAudio {
  static last: FakeAudio;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  currentTime = 0;
  duration = NaN;
  paused = false;
  private ls: Record<string, (() => void)[]> = {};
  constructor(public src: string) {
    FakeAudio.last = this;
  }
  addEventListener(n: string, f: () => void): void {
    (this.ls[n] ??= []).push(f);
  }
  fire(n: string): void {
    this.ls[n]?.forEach((f) => f());
  }
  pause(): void {
    this.paused = true;
  }
  play(): Promise<void> {
    return Promise.resolve();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a sound never holds the game', () => {
  it('a clip that never loads: the wait ends after 6 s, as not heard (the text is read instead)', async () => {
    let r: boolean | null = null;
    void playClip('x.mp3').then((v) => (r = v));
    await vi.advanceTimersByTimeAsync(SOUND_GUARD.unknownMs - 100);
    expect(r).toBeNull();
    await vi.advanceTimersByTimeAsync(200);
    expect(r).toBe(false);
  });
  it('an empty clip (length 0) ends after one second', async () => {
    let r: boolean | null = null;
    void playClip('x.mp3').then((v) => (r = v));
    const a = FakeAudio.last;
    a.duration = 0;
    a.fire('loadedmetadata');
    await vi.advanceTimersByTimeAsync(1100);
    expect(r).toBe(false);
  });
  it('a clip whose `ended` never comes ends at its length plus a second, and counts as heard if it played', async () => {
    let r: boolean | null = null;
    void playClip('x.mp3').then((v) => (r = v));
    const a = FakeAudio.last;
    a.duration = 0.8;
    a.fire('loadedmetadata');
    a.currentTime = 0.8;
    await vi.advanceTimersByTimeAsync(1700);
    expect(r).toBeNull();
    await vi.advanceTimersByTimeAsync(200);
    expect(r).toBe(true);
    expect(a.paused).toBe(true);
  });
  it('a clip that ends normally resolves at once, and the guard does not fire later', async () => {
    let r: boolean | null = null;
    void playClip('x.mp3').then((v) => (r = v));
    FakeAudio.last.onended?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(r).toBe(true);
    await vi.advanceTimersByTimeAsync(20000);
    expect(r).toBe(true);
  });
  it('the wait is the length plus a second, at most 15 s (a song of 9 s is not cut)', () => {
    expect(guardMs(0.8)).toBe(1800);
    expect(guardMs(9.4)).toBe(10400);
    expect(guardMs(60)).toBe(15000);
    expect(guardMs(NaN)).toBe(1000);
  });
});

describe('the meet card of a letter always ends (the SUN bug)', () => {
  const make = (): { calls: string[]; seq: ReturnType<typeof meetSequence> } => {
    const calls: string[] = [];
    const seq = meetSequence({ name: () => calls.push('name'), sound: () => calls.push('sound'), word: () => calls.push('word'), intro: () => calls.push('intro'), done: () => calls.push('done'), bounce: () => calls.push('bounce') });
    return { calls, seq };
  };
  it('on its own: name, sound, word, the Hebrew line, and done at 7.6 s', async () => {
    const { calls } = make();
    await vi.advanceTimersByTimeAsync(7500);
    expect(calls).not.toContain('done');
    expect(calls).toEqual(expect.arrayContaining(['name', 'sound', 'word', 'intro']));
    await vi.advanceTimersByTimeAsync(200);
    expect(calls.filter((c) => c === 'done')).toHaveLength(1);
  });
  it('a tap on the card (a replay) at any moment does not stop it from ending, and it ends once', async () => {
    for (const at of [300, 1500, 4000, 6000, 7000, 7500]) {
      const { calls, seq } = make();
      await vi.advanceTimersByTimeAsync(at);
      seq.play();
      await vi.advanceTimersByTimeAsync(9000);
      expect(calls.filter((c) => c === 'done'), `a replay at ${at} ms`).toHaveLength(1);
    }
  });
  it('a card that is destroyed does not end by itself afterwards', async () => {
    const { calls, seq } = make();
    await vi.advanceTimersByTimeAsync(2000);
    seq.stop();
    await vi.advanceTimersByTimeAsync(20000);
    expect(calls).not.toContain('done');
  });
});
