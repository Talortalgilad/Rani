import type { StepRun } from '../shell';
import { bye, feel, greet, note, repeat, say, sentenceOfDay, sticker, teach, unitDone } from './basic';
import { answerPick, dialogue, listenPick, review, whoSaid } from './pick';
import { build } from './build';
import { chant } from './chant';
import { trueFalse } from './trueFalse';
import { meet } from './meet';
import { sayFirst } from './sayFirst';
import { challenge } from './challenge';

/** The step types that this stage can run (SPEC-tutor.md section 11, stage 0). The types of stage 1 (likes, likeOrNot, ask, recall, paint) are not here yet. */
export const STEPS: Record<string, StepRun> = { greet, feel, review, say, teach, repeat, whoSaid, answerPick, dialogue, listenPick, build, trueFalse, chant, sentenceOfDay, sticker, unitDone, bye, note, meet, sayFirst, challenge };

/**
 * Where a type of step sits in the six points of the progress bar (SPEC-tutor.md section 3): 1 hello, 2 review, 3 the new thing, 4 practice, 5 the sentence of the day, 6 the sticker.
 * (How the engine draws the bar; it says nothing about any lesson.)
 */
export const STAGE_OF: Record<string, number> = { greet: 1, feel: 1, review: 2, say: 3, teach: 3, repeat: 3, listenPick: 4, whoSaid: 4, answerPick: 4, dialogue: 4, build: 4, trueFalse: 4, likes: 4, likeOrNot: 4, ask: 4, recall: 4, paint: 4, chant: 4, sentenceOfDay: 5, sticker: 6, unitDone: 6, bye: 6, note: 0, meet: 3, sayFirst: 4, challenge: 4 };
export const PRACTICE = new Set(['listenPick', 'whoSaid', 'answerPick', 'dialogue', 'build', 'trueFalse', 'likes', 'likeOrNot', 'ask', 'recall', 'paint', 'review']);
