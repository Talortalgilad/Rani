import { he } from '../content/lines';
import { mixed } from './text';
import { speakEn, speakHe } from '../voice';
import type { SoundApi } from '../../../sound';

/** "Great Job!": a shiny banner with three stars that light up one by one, and confetti. */
export function showBanner(root: HTMLElement, stars: 1 | 2 | 3, name: string, sound: SoundApi, onNext: () => void): () => void {
  const wrap = document.createElement('div');
  wrap.className = 'banner-wrap';
  wrap.innerHTML = `
    <div class="banner">
      <div class="rays"></div>
      <div class="banner-title"><span>G</span><span>r</span><span>e</span><span>a</span><span>t</span> <span>J</span><span>o</span><span>b</span><span>!</span></div>
      <div class="banner-stars">${[1, 2, 3].map((i) => `<i class="bs ${i <= stars ? 'on' : 'off'}" style="animation-delay:${0.9 + i * 0.35}s">★</i>`).join('')}</div>
      <div class="banner-sub">${mixed(he.proud(name))}</div>
      <button class="en-btn go" type="button" id="bn">${he.next} ➜</button>
    </div>
    <div class="confetti" id="bc"></div>`;
  root.appendChild(wrap);
  const colors = ['#ff5d73', '#ffd23f', '#3fb56b', '#3fa0ff', '#8e5cf0', '#ff8fd0'];
  const box = wrap.querySelector<HTMLElement>('#bc')!;
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.8}s`;
    p.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
    box.appendChild(p);
  }
  sound.play('win');
  void speakEn('Great job!', 0.85).then(() => speakHe(he.proud(name)));
  wrap.querySelector('#bn')!.addEventListener('click', () => {
    wrap.remove();
    onNext();
  });
  return () => wrap.remove();
}
