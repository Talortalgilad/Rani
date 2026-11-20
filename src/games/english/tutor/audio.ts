/** Playing the clips of the tutor: the recording (he/ or en/ folder, by the language of the clip), then the voice of the phone. */
import { TUTOR_CLIPS } from '../content/tutorClips';
import { onClipStart, playWord, speakEn, speakHeLine, stopSpeech } from '../voice';

export const clipText = (id: string): string => TUTOR_CLIPS[id]?.text ?? id;
export const clipLang = (id: string): 'he' | 'en' => TUTOR_CLIPS[id]?.lang ?? 'en';

let token = 0;
let ctxAudio: AudioContext | null = null;
let level: ((v: number) => void) | null = null;

/** The mouth: who wants the volume of what is being said (null: nobody). */
export const watchVolume = (f: ((v: number) => void) | null): void => void (level = f);

let lastEl: HTMLAudioElement | null = null;
/** The recording that is playing (or played last): the chant lights its lines by its time. */
export const currentClip = (): HTMLAudioElement | null => lastEl;

onClipStart((a) => {
  lastEl = a;
  if (!level) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctxAudio ??= new AC();
    const src = ctxAudio.createMediaElementSource(a);
    const an = ctxAudio.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    an.connect(ctxAudio.destination);
    const buf = new Uint8Array(an.fftSize);
    const tick = (): void => {
      if (a.ended || a.paused && a.currentTime > 0 || !level) return level?.(0);
      an.getByteTimeDomainData(buf);
      let m = 0;
      for (const v of buf) m = Math.max(m, Math.abs(v - 128));
      level(Math.min(1, m / 60));
      requestAnimationFrame(tick);
    };
    tick();
  } catch {
    /* the timer mouth stays */
  }
});

/** Says one clip to its end. Resolves when it is over, or when something newer was said. False: nothing could be heard (the text stays in the bubble). */
export async function playTutor(id: string): Promise<boolean> {
  const mine = ++token;
  stopSpeech();
  const c = TUTOR_CLIPS[id];
  if (!c) return false;
  const ok = c.lang === 'he' ? await speakHeLine([{ clip: id, text: c.text, lang: 'he' }]) : (await playWord(id)) || (await speakEn(c.text));
  void mine;
  return ok;
}
export const stopTutor = (): void => {
  token++;
  stopSpeech();
};
