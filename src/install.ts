/**
 * "Install to the home screen". Android and desktop Chrome offer an install prompt (`beforeinstallprompt`) that is kept until
 * the parent presses the button; iPhone and iPad have no such thing, so there the button shows short instructions with a picture.
 * Nothing is shown when the app is already installed (it runs in standalone mode).
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

/** iPhone, iPad (also an iPad that says it is a Mac) and iPod: Safari there has no install prompt. */
export function isIos(ua: string, maxTouchPoints = 0): boolean {
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1);
}

/** Already on the home screen: opened as an app, not as a page of the browser. */
export function isStandalone(matches: boolean, navStandalone?: boolean): boolean {
  return matches || navStandalone === true;
}

export type InstallMode = 'hidden' | 'prompt' | 'ios';
/** What the button should do: nothing (hidden), ask the browser, or show the iPhone instructions. */
export function installMode(o: { standalone: boolean; hasPrompt: boolean; ios: boolean }): InstallMode {
  if (o.standalone) return 'hidden';
  if (o.hasPrompt) return 'prompt';
  if (o.ios) return 'ios';
  return 'hidden';
}

export function currentInstallMode(): InstallMode {
  if (typeof window === 'undefined') return 'hidden';
  const standalone = installed || isStandalone(window.matchMedia?.('(display-mode: standalone)').matches ?? false, (navigator as Navigator & { standalone?: boolean }).standalone);
  return installMode({ standalone, hasPrompt: deferred !== null, ios: isIos(navigator.userAgent, navigator.maxTouchPoints) });
}

/** Starts listening; call once at start-up (the browser sends the event early, so it must not be missed). */
export function initInstall(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    listeners.forEach((f) => f());
  });
}

/** Called when the state of the button may have changed (the install event arrived late, or the app was installed). */
export function onInstallChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Shows the browser's own install dialog. Resolves with what the person chose. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const d = deferred;
  if (!d) return 'unavailable';
  deferred = null; // an install event can be used only once
  await d.prompt();
  const r = await d.userChoice;
  if (r.outcome === 'accepted') installed = true;
  listeners.forEach((f) => f());
  return r.outcome;
}

/** The picture for iPhone: the share button in Safari's bottom bar (step 1) and the "Add to Home Screen" row of the menu (step 2). */
export const IOS_PICTURE = `<svg viewBox="0 0 320 300" width="100%" direction="ltr" style="direction:ltr" role="img" aria-label="שיתוף ואז הוספה למסך הבית" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif">
  <rect x="4" y="4" width="312" height="104" rx="20" fill="#f4f1f8" stroke="#d8d0e6" stroke-width="3"/>
  <text x="160" y="30" text-anchor="middle" font-size="15" font-weight="700" fill="#3a2f4b">1 · לוחצים על כפתור השיתוף</text>
  <rect x="26" y="44" width="268" height="52" rx="16" fill="#ffffff" stroke="#d8d0e6" stroke-width="2"/>
  <g fill="none" stroke="#9a93a8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M62 62 L52 70 L62 78"/><path d="M104 62 L114 70 L104 78"/>
    <path d="M206 60 H236 V82 H206 Z M214 60 V54 H244 V76 H236"/>
  </g>
  <circle cx="160" cy="70" r="22" fill="#8e5cf0"/>
  <g fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M151 70 V82 H169 V70"/><path d="M160 79 V58 M153 65 L160 58 L167 65"/>
  </g>
  <rect x="4" y="118" width="312" height="178" rx="20" fill="#f4f1f8" stroke="#d8d0e6" stroke-width="3"/>
  <text x="160" y="144" text-anchor="middle" font-size="15" font-weight="700" fill="#3a2f4b">2 · בוחרים "הוספה למסך הבית"</text>
  <rect x="36" y="158" width="248" height="126" rx="16" fill="#ffffff" stroke="#d8d0e6" stroke-width="2"/>
  <text x="268" y="184" text-anchor="end" font-size="15" fill="#3a2f4b">העתקה</text>
  <line x1="46" y1="194" x2="274" y2="194" stroke="#ece8f3" stroke-width="2"/>
  <rect x="42" y="198" width="236" height="40" rx="10" fill="#efe7ff" stroke="#8e5cf0" stroke-width="3"/>
  <text x="240" y="224" text-anchor="end" font-size="15" font-weight="700" fill="#3a2f4b">הוספה למסך הבית</text>
  <rect x="250" y="206" width="24" height="24" rx="6" fill="none" stroke="#3a2f4b" stroke-width="3"/>
  <path d="M262 212 V224 M256 218 H268" stroke="#3a2f4b" stroke-width="3" stroke-linecap="round"/>
  <line x1="46" y1="244" x2="274" y2="244" stroke="#ece8f3" stroke-width="2"/>
  <text x="268" y="270" text-anchor="end" font-size="15" fill="#3a2f4b">סימנייה</text>
</svg>`;
