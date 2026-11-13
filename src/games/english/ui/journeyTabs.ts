import { he } from '../content/lines';

export type Journey = 'words' | 'letters';
/** The switch at the top of both maps: "מילים | אותיות" (each journey has its own progress). */
export const journeyTabs = (active: Journey): string => `
  <div class="journey-tabs" role="tablist">
    <button class="jt ${active === 'words' ? 'on' : ''}" data-j="words" data-say="j_words" type="button" role="tab">🔤 ${he.tabWords}</button>
    <button class="jt ${active === 'letters' ? 'on' : ''}" data-j="letters" data-say="j_letters" type="button" role="tab">🅰️ ${he.tabLetters}</button>
  </div>`;

export function bindJourneyTabs(root: HTMLElement, active: Journey, onPick: (j: Journey) => void): void {
  root.querySelectorAll<HTMLButtonElement>('.jt').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.j !== active) onPick(b.dataset.j as Journey);
    }),
  );
}
