import { describe, expect, it } from 'vitest';
import { mixed } from './text';

describe('English inside Hebrew', () => {
  it('wraps every English phrase in a bdi with dir=ltr', () => {
    expect(mixed('ball = כדור')).toBe('<bdi dir="ltr">ball</bdi> = כדור');
    expect(mixed('Circle, זה להקיף בעיגול!')).toBe('<bdi dir="ltr">Circle</bdi>, זה להקיף בעיגול!');
    expect(mixed('monkey bars הם מקבילים')).toBe('<bdi dir="ltr">monkey bars</bdi> הם מקבילים');
  });
  it('leaves Hebrew alone and escapes what could be a tag', () => {
    expect(mixed('שלום')).toBe('שלום');
    expect(mixed('<b>x</b>')).not.toContain('<b>');
  });
  it('a name typed in English is isolated too', () => {
    expect(mixed('אני Cheesy!')).toContain('<bdi dir="ltr">Cheesy!</bdi>');
  });
});
