/**
 * The engine (SPEC-tutor.md section 10): runs the steps of a lesson one after the other. It has no content: the steps come from tutor-lessons.json, each `type` is a component of steps/.
 * Leaving in the middle and coming back continues from the same step; an exercise that took three tries comes back once at the end of the practice.
 */
import type { Lesson, Step } from './lessons';
import { Aborted, createShell, type Deps, type Shell } from './shell';
import { PRACTICE, STAGE_OF, STEPS } from './steps';
import { addWeak, isDone, saveProgress } from './state';

/** Can this stage run every step of the lesson? */
export const canRun = (l: Lesson): boolean => l.steps.every((s) => s.type in STEPS);

export interface Run { stop(): void; done: Promise<'finished' | 'left'> }

export function runLesson(root: HTMLElement, deps: Deps, lesson: Lesson, from = 0): Run {
  const { shell, setStage, destroy } = createShell(root, deps, lesson, () => deps.onClose());
  const done = (async (): Promise<'finished' | 'left'> => {
    const retry: { step: Step; i: number }[] = [];
    let retried = false;
    const runOne = async (sh: Shell, step: Step, i: number): Promise<void> => {
      const fn = STEPS[step.type];
      if (!fn) return;
      const res = await fn(sh, step, i);
      if (res && res.tries === 3 && PRACTICE.has(step.type)) {
        deps.setState(addWeak(deps.state(), `${lesson.id}#${i}`));
        if (!retried && step.type !== 'review') retry.push({ step, i });
      }
    };
    try {
      let stage = 0;
      for (let i = from; i < lesson.steps.length; i++) {
        const step = lesson.steps[i];
        const st = STAGE_OF[step.type] ?? 0;
        // the exercises that took three tries come back once, when the practice is over
        if (!retried && st >= 5 && retry.length) {
          retried = true;
          for (const r of retry) await runOne(shell, r.step, r.i);
        }
        if (st) stage = Math.max(stage, st);
        setStage(stage);
        await runOne(shell, step, i);
        // the place is kept for coming back (a lesson that is done is never "in the middle")
        if (!isDone(deps.state(), lesson.id) && i + 1 < lesson.steps.length) deps.setState(saveProgress(deps.state(), lesson.id, i + 1));
      }
      setStage(6);
      return 'finished';
    } catch (e) {
      if (e instanceof Aborted) return 'left';
      throw e;
    } finally {
      destroy();
    }
  })();
  return { stop: destroy, done };
}
