import type { GameModule } from './types';
import brickBreaker from './brick-breaker';
import memory from './memory';

export const games: GameModule[] = [brickBreaker, memory];

// Miniatures for the 3D lobby. Loaded only when the lobby needs them, because they bring Three.js with them;
// a game without one gets a basic island automatically.
brickBreaker.lobbyIsland = (ctx) => import('./brick-breaker/lobby-island').then((m) => m.createLobbyIsland(ctx));
memory.lobbyIsland = (ctx) => import('./memory/lobby-island').then((m) => m.createLobbyIsland(ctx));

export const comingSoon = [
  { title: 'בקרוב', color: '#c9c4cf' },
  { title: 'בקרוב', color: '#c9c4cf' },
];
