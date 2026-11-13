import { Spring } from '../../lobby3d/motion';
import * as T from '../../lobby3d/lib';
import { Particles } from '../../lobby3d/particles';
import { Materials, roundedBox } from '../../lobby3d/shapes';
import { svgToTexture } from '../../lobby3d/textures';
import type { LobbyIslandCtx, LobbyIslandHandle } from '../types';
import { DECKS, artSvg } from './decks';
import { pictureUrl } from './decks/pictures';

// the 4 cards: cow, pig, sheep, pig (the 3D pictures of the game). The two pigs are the pair that gets found.
const ARTS = ['farm:cow', 'en:pig', 'farm:sheep', 'en:pig'];

/** A 3D picture on a white card face as a texture (the drawn SVG is the fallback when a picture was not cut). */
function pictureTexture(key: string, w: number, h: number): Promise<T.Texture> {
  const url = pictureUrl(key);
  if (!url) return svgToTexture(artSvg(key), w, h, '#ffffff');
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d')!;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      const side = Math.min(w, h) * 0.86;
      g.drawImage(im, (w - side) / 2, (h - side) / 2, side, side);
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      resolve(tex);
    };
    im.onerror = () => reject(new Error('picture failed'));
    im.src = url;
  });
}
const LOOP = 7; // seconds
// [card, turns face up at, turns back at]
const FLIPS: [number, number, number][] = [[0, 0.6, 2.6], [2, 1.4, 2.6], [1, 3.4, 6.2], [3, 4.0, 6.2]];

/**
 * Memory's miniature: four cards in a row that turn over one at a time. First two different ones (a miss: they
 * turn back), then the two pigs: a pair! Both hop, sparkle, and everything resets.
 */
export function createLobbyIsland(ctx: LobbyIslandCtx): LobbyIslandHandle {
  const { shadows, reduced } = ctx;
  const mats = new Materials();
  const group = new T.Group();
  const sparks = new Particles(shadows ? 40 : 20, new T.SphereGeometry(1, 6, 5), new T.MeshBasicMaterial({ color: '#ffffff' }));
  group.add(sparks.mesh);

  const cards = ARTS.map((_, i) => {
    const g = new T.Group();
    const body = new T.Mesh(roundedBox(0.5, 0.68, 0.05, 0.06), mats.get('#fffaf2', { rough: 0.5 }));
    body.castShadow = shadows;
    const face = (c: string) => new T.MeshBasicMaterial({ color: c });
    const back = new T.Mesh(new T.PlaneGeometry(0.44, 0.62), face('#8bd45b'));
    back.position.z = 0.03;
    const front = new T.Mesh(new T.PlaneGeometry(0.44, 0.62), face('#ffffff'));
    front.position.z = -0.03;
    front.rotation.y = Math.PI;
    g.add(body, back, front);
    g.position.set((i - 1.5) * 0.6, 0.38, 0.1);
    group.add(g);
    return { g, back, front, turn: new Spring(0, 110, 11), hop: new Spring(0, 140, 12) };
  });

  // real pictures from the game's own SVG art; plain colours show until they are drawn
  const textures: T.Texture[] = [];
  let disposed = false;
  const apply = (mesh: T.Mesh, tex: T.Texture) => {
    if (disposed) return tex.dispose();
    textures.push(tex);
    const m = mesh.material as T.MeshBasicMaterial;
    m.map = tex;
    m.color.set('#ffffff');
    m.needsUpdate = true;
  };
  svgToTexture(DECKS.farm.back, 128, 160).then((tex) => cards.forEach((c) => apply(c.back, tex))).catch(() => {});
  ARTS.forEach((a, i) => pictureTexture(a, 128, 160).then((tex) => apply(cards[i].front, tex)).catch(() => {}));

  let lastTl = 0;
  return {
    object: group,
    update(dt, time) {
      if (reduced) return;
      const tl = time % LOOP;
      cards.forEach((c, i) => {
        const [, up, down] = FLIPS.find(([k]) => k === i)!;
        c.turn.target = tl >= up && tl < down ? Math.PI : 0;
        c.hop.target = (i === 1 || i === 3) && tl >= 4.8 && tl < 5.7 ? 0.22 : 0;
        c.turn.step(dt);
        c.hop.step(dt);
        c.g.rotation.y = c.turn.value;
        c.g.position.y = 0.38 + Math.max(0, c.hop.value);
      });
      if (lastTl < 4.8 && tl >= 4.8) {
        for (const x of [-0.3, 0.9]) sparks.emit(new T.Vector3(x, 0.9, 0.2), 10, { colors: ['#ffd23f', '#ffffff'], speed: 1.3, size: 0.045, life: 0.9 });
      }
      lastTl = tl;
      sparks.update(dt);
    },
    tap() {
      sparks.emit(new T.Vector3(0, 0.9, 0.2), 10, { colors: ['#ffd23f', '#ffffff'], speed: 1.4, size: 0.05 });
    },
    dispose() {
      disposed = true;
      textures.forEach((t) => t.dispose());
      sparks.dispose();
      mats.dispose();
    },
  };
}
