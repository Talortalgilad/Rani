/**
 * Reading tutor-lessons.json as it is (SPEC-tutor.md section 4): the types of the data, and nothing else. The engine has no content: a new lesson is only data.
 */
import raw from '../content/tutor-lessons.json';

export type Step = { type: string; [field: string]: unknown };
export interface Lesson { id: string; unit: number; kind: 'regular' | 'teacher'; titleHe: string; steps: Step[] }
export interface LessonFile { version: number; feelings: string[]; foods: string[]; colors: string[]; things: string[]; pairs: [string, string][]; lessons: Lesson[] }

export const DATA = raw as unknown as LessonFile;
export const LESSONS: Lesson[] = DATA.lessons;
export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
export const units = (): number[] => [...new Set(LESSONS.map((l) => l.unit))].sort((a, b) => a - b);
