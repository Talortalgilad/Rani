import type { GameContext, GameModule } from '../types';
import { createWorkshop, type Workshop } from './game';

let ws: Workshop | null = null;

/** The home-screen icon: the cat of the workshop, on the colour of the card. */
const icon = `<img src="${import.meta.env.BASE_URL}squishy/shapes/cat.webp" alt="" draggable="false" style="width:64px;height:64px;max-width:100%;max-height:100%;object-fit:contain">`;

const squishy: GameModule = {
  id: 'squishy',
  title: 'סדנת הסקווישים',
  icon,
  color: '#ef7f8e',
  mount(c: GameContext) {
    ws = createWorkshop(c);
  },
  canInterrupt: () => true,
  pause() {
    ws?.pause();
  },
  resume() {},
  unmount() {
    ws?.unmount();
    ws = null;
  },
};
export default squishy;
