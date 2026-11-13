import type { GameModule } from './types';
import brickBreaker from './brick-breaker';
import memory from './memory';
import traffic from './traffic';
import english from './english';
import blocks from './blocks';
import park from './park';

export const games: GameModule[] = [brickBreaker, memory, traffic, english, blocks, park];

// Miniatures for the 3D lobby. Loaded only when the lobby needs them, because they bring Three.js with them;
// a game without one gets a basic island automatically.
brickBreaker.lobbyIsland = (ctx) => import('./brick-breaker/lobby-island').then((m) => m.createLobbyIsland(ctx));
memory.lobbyIsland = (ctx) => import('./memory/lobby-island').then((m) => m.createLobbyIsland(ctx));
traffic.lobbyIsland = (ctx) => import('./traffic/lobby-island').then((m) => m.createLobbyIsland(ctx));
english.lobbyIsland = (ctx) => import('./english/lobby-island').then((m) => m.createLobbyIsland(ctx));
blocks.lobbyIsland = (ctx) => import('./blocks/lobby-island').then((m) => m.createLobbyIsland(ctx));

export const comingSoon = [
  { title: 'בקרוב', color: '#c9c4cf' },
  { title: 'בקרוב', color: '#c9c4cf' },
];
