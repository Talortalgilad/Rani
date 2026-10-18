import { getState, update } from './storage';

export interface SoundApi {
  play(name: 'pop' | 'correct' | 'oops' | 'win'): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
}

const cache = new Map<string, HTMLAudioElement>();

export const sound: SoundApi = {
  play(name) {
    if (!getState().settings.sound) return;
    try {
      let a = cache.get(name);
      if (!a) {
        a = new Audio(`sounds/${name}.mp3`);
        cache.set(name, a);
      }
      a.currentTime = 0;
      void a.play().catch(() => {});
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
