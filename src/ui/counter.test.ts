import { describe, expect, it } from 'vitest';
import { bdiNumbers, counter } from './counter';

describe('counters with numbers', () => {
  it('each number is isolated, and the counter is one unbreakable piece', () => {
    expect(counter('10 מתוך 26 אותיות')).toBe('<span class="cnt"><bdi>10</bdi> מתוך <bdi>26</bdi> אותיות</span>');
    expect(counter('0 מתוך 108 מילים')).toContain('<bdi>108</bdi>');
  });
  it('the text is escaped, the numbers stay in the order they were given', () => {
    expect(counter('<b>3 מתוך 12')).toBe('<span class="cnt">&lt;b&gt;<bdi>3</bdi> מתוך <bdi>12</bdi></span>');
    expect(bdiNumbers('1 2 3').match(/\d+/g)).toEqual(['1', '2', '3']);
  });
});

import { fraction } from './counter';
describe('fraction (goal counters: progress/target)', () => {
  it('writes the progress first and the target second, in a left-to-right box', () => {
    const html = fraction(0, 1);
    expect(html).toContain('dir="ltr"');
    expect(html.replace(/<[^>]+>/g, '')).toBe('0/1');
    expect(fraction(3, 5).replace(/<[^>]+>/g, '')).toBe('3/5');
    expect(html.indexOf('>0<')).toBeLessThan(html.indexOf('>1<'));
  });
});
