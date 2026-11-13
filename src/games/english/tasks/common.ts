import type { Expression } from '../art/cheesy';

/** What a task gets from the station that runs it. */
export interface TaskEnv {
  /** the play area: position: relative, the task draws inside it */
  stage: HTMLElement;
  /** Cheesy's face and a short note in the bubble (Hebrew, optional) */
  face(e: Expression, note?: string): void;
  /** a wrong answer; returns how many wrong answers there have been in this task */
  mistake(): number;
  /** the task was done (also called after the solution was shown) */
  done(): void;
  sparkle(x: number, y: number): void;
  sound(n: 'correct' | 'oops' | 'pop' | 'bonus' | 'tick', pitch?: number): void;
  /** read a word or an instruction in English */
  say(text: string, word?: boolean): void;
  /** a Hebrew line of the registry (content/heLines.ts), recorded or read by the phone */
  sayHe(id: string): void;
}

export interface TaskHandle {
  /** the 🔊 button: say the instruction again */
  repeat(): void;
  destroy(): void;
}

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.appendChild(e);
  return e;
};

/** A picture as a button. */
export function pictureButton(parent: HTMLElement, html: string, label: string, cls = 'pic'): HTMLButtonElement {
  const b = el('button', cls, parent);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.innerHTML = html;
  return b;
}

/** Where things sit in the play area, as shares of its size: three spread-out places, so pictures never overlap. */
export const SPOTS3: [number, number][] = [[0.24, 0.3], [0.74, 0.24], [0.5, 0.72]];

export function place(e: HTMLElement, spot: [number, number]): void {
  e.style.left = `${spot[0] * 100}%`;
  e.style.top = `${spot[1] * 100}%`;
}

/** The share of times the pictures are shuffled, so that the answer is not always in the same place. */
export function shuffled<T>(a: T[], seed: number): T[] {
  const r = [...a];
  let s = seed || 1;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Shows the solution after three mistakes: the right picture pulses and a hand points at it. */
export function showSolution(stage: HTMLElement, target: HTMLElement): Promise<void> {
  const hand = el('div', 'hand-hint', stage);
  hand.textContent = '👆';
  const sr = stage.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  hand.style.left = `${tr.left - sr.left + tr.width * 0.5}px`;
  hand.style.top = `${tr.top - sr.top + tr.height * 0.45}px`;
  target.classList.add('pulse');
  return new Promise((res) => window.setTimeout(() => (hand.remove(), target.classList.remove('pulse'), res()), 1700));
}
