import { getState, update } from './storage';

export type SoundName =
  | 'pop' | 'crack' | 'correct' | 'oops' | 'win' | 'bonus' | 'life'
  // memory game: card flip, two-note bell (pitch in Hz), and one winning melody per world
  | 'flip' | 'bell' | 'melody1' | 'melody2' | 'melody3' | 'melody4'
  // 3D lobby: a tiny tick as an island passes the middle (pitch in Hz), and a soft thud when the ring comes to rest
  | 'tick' | 'settle'
  // Traffic Jam: engine starting, the "bonk" of a blocked vehicle, braking, the honk of a full one, a firework
  | 'engine' | 'bonk' | 'brake' | 'honk' | 'firework'
  // a vehicle that hops over another on the road
  | 'boing'
  // block puzzle: a block lands, a block bursts (pitch rises with every block), a combo arpeggio, a streak step (pitch), a new tray, a clean board, a soft happy tune for a full board
  | 'thock' | 'blast' | 'arpeggio' | 'streak' | 'trayin' | 'fanfare' | 'gentle'
  // roller coaster: the chain on the way up (a tick), the wind (pitch = how fast), the passengers' "wheee" on the way down, a star collected
  | 'chain' | 'wind' | 'wheee' | 'starpop';

export interface SoundApi {
  /** `pitch` (Hz) applies to 'pop', 'bell' and 'tick'. */
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

/** Short victory tune: six notes and a closing chord. */
function melody(freqs: number[]): void {
  notes(freqs, 0.13, 0.22, 'triangle', 0.28);
  const t = freqs.length * 0.13;
  [freqs[0], freqs[0] * 1.25, freqs[0] * 1.5, freqs[0] * 2].forEach((f) => tone(f, t, 0.6, 'triangle', 0.2));
}

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
        case 'flip':
          tone(900, 0, 0.07, 'triangle', 0.16, 500);
          tone(1800, 0, 0.03, 'sine', 0.05);
          break;
        case 'bell': {
          const f = pitch ?? 660;
          tone(f, 0, 0.4, 'sine', 0.28);
          tone(f * 2.01, 0, 0.25, 'sine', 0.07);
          tone(f * 1.5, 0.13, 0.5, 'sine', 0.28);
          tone(f * 3.02, 0.13, 0.3, 'sine', 0.07);
          break;
        }
        case 'melody1': melody([523.25, 659.25, 783.99, 659.25, 783.99, 1046.5]); break; // farm: bright and bouncy
        case 'melody2': melody([440, 523.25, 659.25, 587.33, 659.25, 880]); break; // sea: rolling
        case 'melody3': melody([392, 493.88, 587.33, 739.99, 987.77, 1174.66]); break; // space: rising, shimmering
        case 'melody4': melody([783.99, 880, 1046.5, 880, 1046.5, 1318.5]); break; // sweets: skipping
        case 'tick': {
          const f = pitch ?? 900;
          tone(f, 0, 0.045, 'sine', 0.13, f * 0.8);
          break;
        }
        case 'settle':
          tone(330, 0, 0.13, 'sine', 0.2, 190);
          tone(660, 0, 0.04, 'triangle', 0.05);
          break;
        case 'engine':
          tone(75, 0, 0.4, 'sawtooth', 0.07, 150);
          tone(110, 0.05, 0.3, 'triangle', 0.05, 200);
          break;
        case 'bonk':
          tone(170, 0, 0.14, 'square', 0.17, 70);
          tone(340, 0, 0.06, 'triangle', 0.09);
          break;
        case 'brake':
          tone(520, 0, 0.22, 'sawtooth', 0.035, 190);
          tone(160, 0.08, 0.16, 'sine', 0.12, 90);
          break;
        case 'honk':
          tone(392, 0, 0.13, 'square', 0.1);
          tone(494, 0, 0.13, 'square', 0.08);
          tone(392, 0.17, 0.2, 'square', 0.1);
          tone(494, 0.17, 0.2, 'square', 0.08);
          break;
        case 'boing':
          tone(180, 0, 0.28, 'sine', 0.26, 640);
          tone(360, 0.02, 0.22, 'triangle', 0.08, 900);
          break;
        case 'firework':
          tone(900, 0, 0.28, 'sawtooth', 0.06, 160);
          tone(1500, 0.06, 0.25, 'sine', 0.06, 700);
          break;
        case 'chain': tone(150, 0, 0.035, 'square', 0.07, 110); break;
        case 'wind': {
          // a soft rushing: two detuned saws, louder and higher the faster the car goes
          const f = Math.min(900, Math.max(120, pitch ?? 300));
          tone(f, 0, 0.18, 'sawtooth', 0.025, f * 1.08);
          tone(f * 1.5, 0, 0.18, 'triangle', 0.02, f * 1.4);
          break;
        }
        case 'wheee': tone(420, 0, 0.55, 'sine', 0.2, 1100); tone(630, 0.05, 0.5, 'triangle', 0.1, 1500); break;
        case 'starpop': tone(880, 0, 0.12, 'sine', 0.25, 1760); tone(1320, 0.07, 0.15, 'triangle', 0.15); break;
        case 'thock':
          tone(210, 0, 0.08, 'sine', 0.26, 120);
          tone(520, 0, 0.03, 'triangle', 0.07);
          break;
        case 'blast': {
          const f = pitch ?? 520;
          tone(f, 0, 0.13, 'sine', 0.22, f * 1.5);
          tone(f * 2, 0, 0.05, 'triangle', 0.06);
          break;
        }
        case 'arpeggio': {
          const f = pitch ?? 523.25;
          notes([f, f * 1.25, f * 1.5, f * 2], 0.07, 0.2, 'triangle', 0.22);
          break;
        }
        case 'streak': {
          const f = pitch ?? 660;
          tone(f, 0, 0.12, 'square', 0.07, f * 1.25);
          tone(f * 1.5, 0.08, 0.16, 'sine', 0.16);
          break;
        }
        case 'trayin':
          tone(300, 0, 0.09, 'sine', 0.14, 480);
          break;
        case 'fanfare':
          notes([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.08, 0.22, 'triangle', 0.26);
          [523.25, 783.99, 1046.5, 1318.5].forEach((f) => tone(f, 0.45, 0.7, 'triangle', 0.18));
          break;
        case 'gentle':
          notes([392, 494, 587, 523, 659, 784], 0.16, 0.3, 'sine', 0.2);
          break;
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
