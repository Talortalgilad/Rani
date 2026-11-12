import { describe, expect, it } from 'vitest';
import { allBubbleTexts } from '../content/bubbles';
import { mixed, runsOf } from './text';

describe('English inside Hebrew', () => {
  it('"On, זה על!" is the English "On," first, then the Hebrew with its "!" at the end', () => {
    expect(runsOf('On, זה על!')).toEqual([{ dir: 'ltr', text: 'On,' }, { dir: 'rtl', text: 'זה על!' }]);
    expect(runsOf('Circle, זה להקיף בעיגול!')).toEqual([{ dir: 'ltr', text: 'Circle,' }, { dir: 'rtl', text: 'זה להקיף בעיגול!' }]);
  });
  it('an equals sign and a name keep their place', () => {
    expect(runsOf('ball = כדור')).toEqual([{ dir: 'ltr', text: 'ball' }, { dir: 'rtl', text: '= כדור' }]);
    expect(runsOf('אני Cheesy!')).toEqual([{ dir: 'rtl', text: 'אני' }, { dir: 'ltr', text: 'Cheesy' }, { dir: 'rtl', text: '!' }]);
    expect(runsOf('monkey bars הם מקבילים')).toEqual([{ dir: 'ltr', text: 'monkey bars' }, { dir: 'rtl', text: 'הם מקבילים' }]);
  });
  it('a sentence that is all English ends with its own "!" (it is a run of its own)', () => {
    expect(runsOf("I'm Bunny!")).toEqual([{ dir: 'ltr', text: "I'm Bunny" }, { dir: 'rtl', text: '!' }]);
  });
  it('plain Hebrew stays plain, and what could be a tag is escaped', () => {
    expect(mixed('שלום!')).toBe('שלום!');
    expect(mixed('<b>x</b> hello')).not.toContain('<b>');
  });
  it('in every bubble of the game the closing punctuation is never inside an English run and never first', () => {
    for (const text of allBubbleTexts()) {
      const runs = runsOf(text);
      for (const r of runs) {
        if (r.dir === 'ltr') expect(r.text, text).not.toMatch(/[!?]/); // a "!" or "?" is not part of an English run
      }
      expect(runs[0].text, text).not.toMatch(/^[!?.]/); // never the first thing that is written
    }
  });
});
