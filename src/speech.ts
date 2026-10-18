import { getState } from './storage';

export function speak(text: string): void {
  try {
    if (!getState().settings.tts || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    u.rate = 0.85;
    speechSynthesis.speak(u);
  } catch {
    /* read-aloud is optional */
  }
}

export function stopSpeaking(): void {
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
