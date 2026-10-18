import type { GameModule } from './types';
import brickBreaker from './brick-breaker';
import memory from './memory';

export const games: GameModule[] = [brickBreaker, memory];

export const comingSoon = [
  { title: 'בקרוב', color: '#c9c4cf' },
  { title: 'בקרוב', color: '#c9c4cf' },
];
