/** paint: a white thing and the palette of six colours. Lolly says a clip ("It's pink." / "A yellow balloon."), Rani taps the colour that she heard and the thing is painted with it. */
import { COLORS } from '../../content/colors';
import { clipText } from '../audio';
import { DATA } from '../lessons';
import { thingHtml, paintThing } from '../things';
import { pickRound, type StepRun, HIDDEN } from '../shell';

/** the colour that a clip of the lessons names: t_its_pink -> pink, t_yellow_balloon -> yellow */
export function colorOfClip(id: string): string | null {
  const m = /^t_its_([a-z]+)$/.exec(id) ?? /^t_([a-z]+)_[a-z]+$/.exec(id);
  return m && DATA.colors.includes(m[1]) ? m[1] : null;
}

export const paint: StepRun = async (sh, step) => {
  const clips = (Array.isArray(step.clips) ? step.clips : []) as string[];
  const thing = String(step.thing ?? 'balloon');
  const intro = typeof step.intro === 'string' ? step.intro : '';
  const order = DATA.colors;
  let worst = 1;
  for (const [k, clip] of clips.entries()) {
    const color = colorOfClip(clip);
    if (!color) continue;
    const c = sh.clear();
    c.innerHTML = `<div class="tutor-pic big thingbox">${thingHtml(thing, null)}</div>`;
    const box = c.querySelector<HTMLElement>('.thing')!;
    if (k === 0 && intro && sh.once(`intro:${intro}`)) await sh.say(intro, { look: 'listen' });
    // the sentence is hidden in the bubble until she is right (she paints by what she hears)
    const hear = (): Promise<void> => sh.say(clip, { look: 'listen', text: HIDDEN });
    await hear();
    const options = order.map((id) => ({ html: `<span class="tutor-swatch" style="background:${COLORS.find((x) => x.id === id)!.hex}"></span>` }));
    const done = pickRound(sh, { options, correct: order.indexOf(color), replay: hear, cls: 'colors', onRight: () => sh.bubble(clipText(clip), 'en'), restore: () => paintThing(box, null) });
    // the colour that she taps paints the thing at once; a wrong one fades back to white
    sh.stage.querySelectorAll<HTMLButtonElement>('.tutor-choices.colors .tutor-opt').forEach((b, i) =>
      b.addEventListener('click', () => {
        paintThing(box, order[i]);
        if (order[i] !== color) window.setTimeout(() => paintThing(box, null), 900);
      }),
    );
    worst = Math.max(worst, await done);
  }
  return { tries: worst >= 3 ? 3 : 1 };
};
