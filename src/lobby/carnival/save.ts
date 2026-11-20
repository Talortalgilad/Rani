/** What the carnival remembers (SPEC-carnival.md 9): the save of the talks and of stage 2, one object, one key, with a version. It does not depend on the clock. */
export { emptySave, emptyWorld, loadSave, writeSave, type CarnivalSave, type WorldSave } from './talk/state';
