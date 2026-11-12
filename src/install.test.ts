import { describe, expect, it } from 'vitest';
import { installMode, isIos, isStandalone } from './install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

describe('install to the home screen', () => {
  it('knows an iPhone and an iPad (even one that says it is a Mac), not Android or a real Mac', () => {
    expect(isIos(IPHONE)).toBe(true);
    expect(isIos(IPAD_AS_MAC, 5)).toBe(true);
    expect(isIos(IPAD_AS_MAC, 0)).toBe(false);
    expect(isIos(ANDROID, 5)).toBe(false);
  });
  it('is standalone by the display mode (Android) or by navigator.standalone (iPhone)', () => {
    expect(isStandalone(true)).toBe(true);
    expect(isStandalone(false, true)).toBe(true);
    expect(isStandalone(false, false)).toBe(false);
    expect(isStandalone(false)).toBe(false);
  });
  it('Android: the button asks the browser; iPhone: it shows the instructions; installed or no way to install: hidden', () => {
    expect(installMode({ standalone: false, hasPrompt: true, ios: false })).toBe('prompt');
    expect(installMode({ standalone: false, hasPrompt: false, ios: true })).toBe('ios');
    expect(installMode({ standalone: true, hasPrompt: true, ios: false })).toBe('hidden');
    expect(installMode({ standalone: true, hasPrompt: false, ios: true })).toBe('hidden');
    expect(installMode({ standalone: false, hasPrompt: false, ios: false })).toBe('hidden');
  });
});
