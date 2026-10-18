import { getState, update } from './storage';

export type SoundName = 'pop' | 'crack' | 'correct' | 'oops' | 'win' | 'bonus' | 'life';

export interface SoundApi {
  /** `pitch` (Hz) only applies to 'pop'. */
  play(name: SoundName, pitch?: number): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
}

let ac: AudioContext | null = null;
let master: GainNode | null = null;

/** Create/resume the AudioContext. Must run inside a user gesture (iOS). */
export function unlockAudio(): void {
  try {
    if (!ac) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return;
      ac = new C();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    }
    if (ac.state !== 'running') void ac.resume();
  } catch {
    /* sound is optional */
  }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType, gain: number, slideTo?: number): void {
  if (!ac || !master) return;
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const notes = (freqs: number[], gap: number, dur: number, type: OscillatorType, gain: number) =>
  freqs.forEach((f, i) => tone(f, i * gap, dur, type, gain));

export const sound: SoundApi = {
  play(name, pitch) {
    if (!getState().settings.sound) return;
    try {
      if (!ac || ac.state !== 'running') unlockAudio();
      if (!ac) return;
      switch (name) {
        case 'pop': {
          const f = pitch ?? 660;
          tone(f, 0, 0.14, 'sine', 0.35, f * 0.7);
          tone(f * 2, 0, 0.05, 'triangle', 0.08);
          break;
        }
        case 'crack': tone(240, 0, 0.09, 'square', 0.1, 140); break;
        case 'correct': notes([523.25, 659.25, 783.99], 0.09, 0.2, 'triangle', 0.3); break;
        case 'oops': notes([330, 262], 0.14, 0.24, 'sine', 0.14); break;
        case 'bonus': tone(600, 0, 0.2, 'sine', 0.3, 1200); break;
        case 'life': notes([783.99, 987.77, 1318.5], 0.08, 0.18, 'sine', 0.25); break;
        case 'win':
          notes([523.25, 659.25, 783.99, 1046.5], 0.12, 0.2, 'triangle', 0.3);
          tone(783.99, 0.5, 0.5, 'triangle', 0.25);
          tone(1046.5, 0.5, 0.5, 'triangle', 0.25);
          tone(1318.5, 0.5, 0.5, 'triangle', 0.2);
          break;
      }
    } catch {
      /* sound is optional */
    }
  },
  isMuted: () => !getState().settings.sound,
  setMuted(muted) {
    update((s) => {
      s.settings.sound = !muted;
    });
  },
};
