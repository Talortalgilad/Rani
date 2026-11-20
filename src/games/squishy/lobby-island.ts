import * as T from '../../lobby3d/lib';
import type { LobbyIslandCtx, LobbyIslandHandle } from '../types';

/**
 * The miniature of the workshop for the lobby: a round table with a pastel mat, and on it the cat (a picture of the workshop, one sprite) that is pressed every few seconds and comes slowly
 * back to its shape, like a real squishy; next to it a cupcake. A tap on it presses it too. A picture and a few discs: 5 draw calls.
 */
export async function createLobbyIsland(ctx: LobbyIslandCtx): Promise<LobbyIslandHandle> {
  const { reduced } = ctx;
  const group = new T.Group();
  const base = import.meta.env.BASE_URL;
  const loader = new T.TextureLoader();
  // both pictures are loaded before the island is shown (no empty island that fills in later)
  const [catTex, cupTex] = await Promise.all(['cat', 'cupcake'].map((id) => loader.loadAsync(`${base}squishy/shapes/${id}.webp`)));
  for (const t of [catTex, cupTex]) t.colorSpace = T.SRGBColorSpace;
  const tex = (id: string): T.Texture => (id === 'cat' ? catTex : cupTex);
  // the table and the mat
  const table = new T.Mesh(new T.CylinderGeometry(1.25, 1.35, 0.16, 32), new T.MeshLambertMaterial({ color: '#d9a066' }));
  table.position.y = 0.08;
  group.add(table);
  const mat = new T.Mesh(new T.CircleGeometry(1.0, 32), new T.MeshBasicMaterial({ color: '#f6e9cf' }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = 0.165;
  group.add(mat);
  const shade = new T.Mesh(new T.CircleGeometry(0.55, 24), new T.MeshBasicMaterial({ color: '#4a2a3c', transparent: true, opacity: 0.28 }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(-0.15, 0.17, 0.05);
  shade.scale.set(1, 0.55, 1);
  group.add(shade);
  const mk = (id: string, x: number, size: number): T.Sprite => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex(id), transparent: true, alphaTest: 0.05 }));
    s.scale.set(size, size, 1);
    s.position.set(x, 0.17 + size * 0.46, 0.1);
    s.center.set(0.5, 0.5);
    group.add(s);
    return s;
  };
  const cat = mk('cat', -0.25, 1.5);
  const cup = mk('cupcake', -0.55, 0.75);
cup.position.z = -0.55;
  const catY = cat.position.y, catS = 1.5, cupY = cup.position.y, cupS = 0.8;
  let press = 0;
  let next = 1.2;
  /** the squeeze: down fast, back slowly (critically damped) */
  const apply = (p: number): void => {
    cat.scale.set(catS * (1 + p * 0.14), catS * (1 - p * 0.2), 1);
    cat.position.y = catY - (p * 0.2 * catS) / 2 * 0.92;
    cup.scale.set(cupS * (1 + p * 0.05), cupS * (1 - p * 0.07), 1);
    cup.position.y = cupY - p * 0.03;
  };
  let v = 0, p = 0, target = 0;
  return {
    object: group,
    update(dt, time) {
      if (reduced) return;
      if (time >= next) {
        target = 1;
        next = time + 3.4;
        press = time + 0.22;
      }
      if (target === 1 && time >= press) target = 0;
      // the spring: stiff when pressed, slow (1.5 s) when released
      const w = target ? 24 : 3.9;
      // small steps: a spring this stiff blows up with one big step (a slow frame)
      const n = Math.max(1, Math.ceil(dt / 0.008));
      for (let i = 0; i < n; i++) {
        v += (w * w * (target - p) - 2 * w * v) * (dt / n);
        p += v * (dt / n);
      }
      apply(Math.max(0, p));
      cup.position.y = cupY + Math.sin(time * 1.6) * 0.012;
    },
    tap() {
      target = 1;
      press = performance.now() / 1000 + 0.2;
      next = performance.now() / 1000 + 4;
    },
    dispose() {
      group.traverse((o) => {
        const m = o as T.Mesh;
        m.geometry?.dispose();
        const mt = m.material as T.Material & { map?: T.Texture };
        mt?.map?.dispose();
        mt?.dispose?.();
      });
    },
  };
}
