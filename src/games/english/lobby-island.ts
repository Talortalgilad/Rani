import * as T from '../../lobby3d/lib';
import { Spring } from '../../lobby3d/motion';
import { Particles } from '../../lobby3d/particles';
import { getState } from '../../storage';
import type { LobbyIslandCtx, LobbyIslandHandle } from '../types';
import { SQUISHIES } from './art/squishies';

/**
 * English's miniature for the lobby: Cheesy (the wedge Rani named) on the island, breathing, with the squishies she has rescued
 * around him (the last six); before the first rescue, the gift that someone is calling from. Every few seconds Cheesy hops and
 * squashes, and the friends hop after him. Tapping the island makes them all squash and hop with sparkles. The pictures are the
 * game's own WebPs, drawn as billboards (they always face the camera).
 */
const LOOP = 5; // seconds
const base = import.meta.env.BASE_URL;
const MAX_FRIENDS = 6;

function loadTexture(url: string): Promise<T.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d')!.drawImage(img, 0, 0, 256, 256);
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      resolve(tex);
    };
    img.onerror = () => reject(new Error('picture failed'));
    img.src = url;
  });
}

interface Actor {
  sprite: T.Sprite;
  size: number;
  x: number;
  z: number;
  phase: number;
  hop: Spring;
  squash: Spring;
}

/** The squishies rescued so far, as ids, in the order they were rescued (pure: tested). */
export function friendsOnIsland(rescued: string[]): string[] {
  return SQUISHIES.filter((s) => rescued.includes(s.name)).map((s) => s.id).slice(-MAX_FRIENDS);
}

export function createLobbyIsland(ctx: LobbyIslandCtx): LobbyIslandHandle {
  const { shadows, reduced } = ctx;
  const group = new T.Group();
  const sparks = new Particles(shadows ? 40 : 20, new T.SphereGeometry(1, 6, 5), new T.MeshBasicMaterial({ color: '#ffffff' }));
  group.add(sparks.mesh);
  const textures: T.Texture[] = [];
  const materials: T.SpriteMaterial[] = [];
  let disposed = false;

  const rescued = ((getState().games.english as { rescued?: string[] } | undefined)?.rescued) ?? [];
  const friends = friendsOnIsland(rescued);

  const actor = (url: string, size: number, x: number, z: number, phase: number): Actor => {
    const mat = new T.SpriteMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
    materials.push(mat);
    const sprite = new T.Sprite(mat);
    sprite.scale.set(size, size, 1);
    sprite.position.set(x, size * 0.5 + 0.02, z);
    sprite.visible = false; // until its picture is there
    group.add(sprite);
    loadTexture(url)
      .then((tex) => {
        if (disposed) return tex.dispose();
        textures.push(tex);
        mat.map = tex;
        mat.needsUpdate = true;
        sprite.visible = true;
      })
      .catch(() => {});
    return { sprite, size, x, z, phase, hop: new Spring(0, 140, 11), squash: new Spring(0, 160, 9) };
  };

  const cheesy = actor(`${base}english/cheesy/happy.webp`, 1.25, 0, 0.25, 0);
  const others: Actor[] = friends.length
    ? friends.map((id, i) => {
        const a = friends.length === 1 ? 0 : -1 + (2 * i) / (friends.length - 1); // -1..1 across an arc behind
        return actor(`${base}english/squishies/${id}.webp`, 0.62, a * 1.35, -0.55 - (1 - Math.abs(a)) * 0.35, i * 0.9);
      })
    : [actor(`${base}english/words/gift.webp`, 0.7, 1.05, 0.1, 0)];
  const all = [cheesy, ...others];

  let lastTl = 0;
  const burst = (): void => sparks.emit(new T.Vector3(0, 1.1, 0.4), 12, { colors: ['#ffd23f', '#ff8fd0', '#ffffff'], speed: 1.4, size: 0.05, life: 0.9 });

  return {
    object: group,
    update(dt, time) {
      for (const a of all) {
        a.hop.step(dt);
        a.squash.step(dt);
        // breathing (still when less motion was asked for), plus the hop and the squash of a spring
        const breathe = reduced ? 0 : Math.sin(time * 2.2 + a.phase) * 0.025;
        const sy = 1 + breathe - Math.max(0, a.squash.value) * 0.28;
        const sx = 1 - breathe * 0.7 + Math.max(0, a.squash.value) * 0.2;
        a.sprite.scale.set(a.size * sx, a.size * sy, 1);
        a.sprite.position.y = (a.size * sy) / 2 + 0.02 + Math.max(0, a.hop.value);
      }
      if (!reduced) {
        const tl = time % LOOP;
        if (lastTl < 3.5 && tl >= 3.5) {
          all.forEach((a, i) => {
            a.hop.value = 0;
            a.hop.velocity = 3.2 - Math.min(i, 3) * 0.2; // Cheesy first, then the friends after him
            a.squash.value = 0.9;
          });
          burst();
        }
        lastTl = tl;
      }
      sparks.update(dt);
    },
    tap() {
      all.forEach((a) => {
        a.hop.velocity = 3.4;
        a.squash.value = 1;
      });
      burst();
    },
    dispose() {
      disposed = true;
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
      sparks.dispose();
    },
  };
}
