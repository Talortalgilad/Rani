/**
 * Lolly (Miss Lolly, SPEC-tutor.md section 1): the 3D pictures of public/english/tutor (the runtime cache keeps them for offline).
 * Poses: idle (rest), listen (waiting for an answer), happy (after a right answer), confused ("Rani the teacher"), clap (the end of a lesson),
 * wave (hello and goodbye), think (building a sentence). While she speaks the mouth changes between idle, talk1 and talk2 with the volume of the clip.
 * A change of picture is a soft 80 ms cross-fade, and a light breathing is made in code (CSS).
 */
import { watchVolume } from './audio';

export type Look = 'idle' | 'listen' | 'happy' | 'confused' | 'clap' | 'wave' | 'think';
export const LOOKS: Look[] = ['idle', 'listen', 'happy', 'confused', 'clap', 'wave', 'think'];
type Frame = Look | 'talk1' | 'talk2';
const FRAMES: Frame[] = ['idle', 'talk1', 'talk2', 'listen', 'happy', 'confused', 'clap', 'wave', 'think'];
/** the poses in which the mouth moves with the voice (the others keep their own face) */
const TALKS = new Set<Look>(['idle', 'listen', 'happy']);

export const lollyUrl = (f: string): string => `${import.meta.env.BASE_URL}english/tutor/lolly_${f}.webp`;
export const faceUrl = (f: string): string => `${import.meta.env.BASE_URL}english/tutor/face_${f}.webp`;
export function preloadTutor(): void {
  for (const f of FRAMES) new Image().src = lollyUrl(f);
  for (const f of ['happy', 'sad', 'sleepy', 'hungry', 'great']) new Image().src = faceUrl(f);
}
/** a plain picture of Lolly in a pose (the album, the pictures with her in them) */
export const lollyImg = (f: Frame, cls = 'lolly-img'): string => `<img class="${cls}" src="${lollyUrl(f)}" alt="" draggable="false">`;

export interface Lolly { set(l: Look): void; get(): Look; speaking(on: boolean): void; el: HTMLElement }

/** A living Lolly in `el`. */
export function mountLolly(el: HTMLElement, first: Look = 'idle'): Lolly {
  el.classList.add('lolly');
  el.innerHTML = '<div class="lolly-breath"><img class="lf a on" alt="" draggable="false"><img class="lf b" alt="" draggable="false"></div>';
  const imgs = [...el.querySelectorAll<HTMLImageElement>('.lf')];
  let front = 0;
  let shown: Frame | '' = '';
  let look: Look = first;
  let talking = false;
  let open = 0;
  let timer = 0;
  let seen = 0;
  const show = (f: Frame): void => {
    if (f === shown) return;
    shown = f;
    const next = imgs[1 - front];
    next.src = lollyUrl(f);
    next.classList.add('on');
    imgs[front].classList.remove('on');
    front = 1 - front;
    el.dataset.look = look;
    el.dataset.frame = f;
  };
  const frame = (): Frame => (talking && TALKS.has(look) ? (open > 0.5 ? 'talk2' : open > 0.12 ? 'talk1' : 'idle') : look);
  const paint = (): void => show(frame());
  imgs[0].src = lollyUrl(first);
  shown = first;
  el.dataset.look = first;
  el.dataset.frame = first;
  const set = (l: Look): void => {
    look = l;
    paint();
  };
  const mouth = (v: number): void => {
    open = v;
    paint();
  };
  const speaking = (on: boolean): void => {
    window.clearInterval(timer);
    seen = 0;
    talking = on;
    if (!on) {
      watchVolume(null);
      open = 0;
      paint();
      return;
    }
    watchVolume((v) => {
      seen = Date.now();
      mouth(v);
    });
    // no volume (the voice of the phone, or no sound): the mouth changes by itself
    timer = window.setInterval(() => {
      if (Date.now() - seen > 250) mouth(Math.random() < 0.25 ? 0 : 0.2 + Math.random() * 0.8);
    }, 130);
  };
  return { set, get: () => look, speaking, el };
}
