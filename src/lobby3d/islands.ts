import * as T from './lib';
import { Materials, PALETTE, makeCloud, makeLock, roundedBox } from './shapes';
import { Spring } from './motion';
import type { GameModule, LobbyIslandHandle } from '../games/types';

export interface IslandSpec {
  kind: 'game' | 'locked';
  title: string;
  /** Emoji or an <svg> string, as in GameModule.icon. */
  icon?: string;
  color: string;
  /** The game's own miniature, if it brings one. */
  lobbyIsland?: GameModule['lobbyIsland'];
}

export interface Island {
  group: T.Group;
  kind: IslandSpec['kind'];
  /** 0..1 progress of the hop (squash & stretch is applied by the lobby). */
  jump: { t: number };
  update(dt: number, time: number, reduced: boolean): void;
  /** Little reaction to a tap that does not open the game (sparks, or the locked island's clouds and padlock). */
  tap(reduced: boolean): void;
  dispose(): void;
}

/** The icon of a game as a texture: an <svg> string is drawn, anything else is treated as an emoji. */
export function iconTexture(icon: string): Promise<T.CanvasTexture | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  const draw = (img?: HTMLImageElement): T.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    if (img) g.drawImage(img, 16, 16, 224, 224);
    else {
      g.font = '170px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(icon, 128, 140);
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  };
  if (!icon.trim().startsWith('<svg')) return Promise.resolve(draw());
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(draw(img));
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon)}`;
  });
}

function base(mats: Materials, hill: string, shadows: boolean): T.Group {
  const g = new T.Group();
  const rock = new T.Mesh(new T.ConeGeometry(1.5, 1.9, 7), mats.get(PALETTE.rock, { rough: 0.9, flat: true }));
  rock.rotation.x = Math.PI;
  rock.position.y = -1.12;
  const top = new T.Mesh(new T.CylinderGeometry(1.65, 1.5, 0.34, 28), mats.get(hill, { rough: 0.8 }));
  top.position.y = -0.17;
  top.receiveShadow = shadows;
  const hit = new T.Mesh(new T.CylinderGeometry(1.9, 1.9, 3.4, 10), new T.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.4;
  g.add(rock, top, hit);
  return g;
}

/**
 * The island every game gets for free: a hill in the game's own colour, with its icon on a board floating above.
 * A game that has nothing better can never break the lobby; stage 2 lets a game bring its own miniature.
 */
export function buildGameIsland(spec: IslandSpec, mats: Materials, shadows: boolean, mini?: LobbyIslandHandle | null): Island {
  if (mini) return buildLiveIsland(mini, mats, shadows);
  const group = base(mats, spec.color, shadows);
  const board = new T.Group();
  const back = new T.Mesh(roundedBox(1.5, 1.5, 0.14, 0.22), mats.get('#fffaf2', { rough: 0.5 }));
  back.castShadow = shadows;
  const faceMat = new T.MeshBasicMaterial({ color: spec.color, transparent: true });
  const face = new T.Mesh(new T.PlaneGeometry(1.3, 1.3), faceMat);
  face.position.z = 0.075;
  board.add(back, face);
  board.position.y = 1.25;
  group.add(board);
  let disposed = false;
  const owned: T.Texture[] = [];
  void iconTexture(spec.icon ?? '🎮').then((tex) => {
    if (!tex) return;
    if (disposed) return tex.dispose();
    owned.push(tex);
    faceMat.map = tex;
    faceMat.color.set('#ffffff');
    faceMat.needsUpdate = true;
  });
  const jump = { t: 1 };
  return {
    group, kind: 'game', jump,
    update(_dt, t, reduced) {
      board.position.y = 1.25 + (reduced ? 0 : Math.sin(t * 1.6) * 0.08);
      board.rotation.y = reduced ? 0 : Math.sin(t * 0.9) * 0.18;
    },
    tap() {},
    dispose() {
      disposed = true;
      owned.forEach((x) => x.dispose());
    },
  };
}

/** An island carrying the game's own living miniature. */
function buildLiveIsland(mini: LobbyIslandHandle, mats: Materials, shadows: boolean): Island {
  const group = base(mats, PALETTE.grass, shadows);
  group.add(mini.object);
  return {
    group, kind: 'game', jump: { t: 1 },
    update: (dt, t) => mini.update(dt, t),
    tap: () => mini.tap?.(),
    dispose: () => mini.dispose(),
  };
}

/** "Coming soon": a pale island wrapped in cloud, with a golden padlock that sways. */
export function buildLockedIsland(mats: Materials, index: number): Island {
  const group = base(mats, '#b9c7b5', false);
  const clouds = [0, 1, 2, 3].map((i) => {
    const c = makeCloud(mats, 0.85);
    const a = (i / 4) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.7, 0.55 + (i % 2) * 0.12, Math.sin(a) * 0.7);
    group.add(c);
    return c;
  });
  const { group: lock } = makeLock(mats);
  lock.position.set(0, 1.2, 0.2);
  lock.scale.setScalar(1.15);
  group.add(lock);
  const puff = new Spring(1, 110, 8);
  const rattle = new Spring(0, 200, 6);
  return {
    group, kind: 'locked', jump: { t: 1 },
    update(dt, t, reduced) {
      puff.step(dt);
      rattle.step(dt);
      clouds.forEach((c, i) => c.scale.setScalar(0.85 * puff.value * (1 + (reduced ? 0 : Math.sin(t * 1.4 + i) * 0.03))));
      lock.rotation.z = (reduced ? 0 : Math.sin(t * 2.4 + index) * 0.1) + rattle.value;
      lock.position.y = 1.2 + (reduced ? 0 : Math.sin(t * 1.6) * 0.04);
    },
    tap(reduced) {
      if (reduced) return;
      puff.value = 1.28;
      puff.velocity = 0;
      rattle.value = 0.5;
      rattle.velocity = 0;
    },
    dispose() {},
  };
}
