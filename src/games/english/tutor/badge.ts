/** Is there a new lesson of Lolly for today? (the ❗ on her button in the lobby). Light: no screens, only the state and the list of lessons. */
import { gameStore } from '../../../storage';
import { LESSONS } from './lessons';
import { access, isDone, loadTutor } from './state';

export function hasNewLesson(today: number): boolean {
  const store = gameStore('english');
  const st = loadTutor(store.load<unknown>('tutor', null), Object.fromEntries(LESSONS.map((l) => [l.id, l.steps.length])));
  const open = store.load<boolean>('tutorOpenAll', false) || store.load<boolean>('openAll', false);
  return LESSONS.some((l) => !isDone(st, l.id) && access(LESSONS, st, l, today, () => true, open) === 'ok');
}
