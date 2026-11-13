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
