/** The train (SPEC-park.md 2): three cars with a rounded nose, wheels, a safety bar and lamps; the riders are small pictures that face the camera. */
import * as T from '../../../lobby3d/lib';

export const CAR_GAP = 1.85;
export const CAR_SCALE = 1.35;
const COLORS = ['#ff7aa8', '#ffb84d', '#5ad1ff'];

export interface Train { cars: T.Group[]; riders: T.Sprite[]; dispose(): void }

export function buildTrain(riderUrls: string[]): Train {
  const own: { dispose(): void }[] = [];
  const keep = <X extends { dispose(): void }>(x: X): X => (own.push(x), x);
  const body = keep(new T.RoundedBoxGeometry(1.15, 0.42, 0.92, 3, 0.15));
  const seat = keep(new T.RoundedBoxGeometry(0.22, 0.55, 0.8, 2, 0.07));
  const bar = keep(new T.CylinderGeometry(0.035, 0.035, 0.8, 6));
  const wheel = keep(new T.CylinderGeometry(0.15, 0.15, 0.07, 10));
  const lamp = keep(new T.SphereGeometry(0.08, 8, 6));
  const dark = keep(new T.MeshStandardMaterial({ color: '#4a3a5a', roughness: 0.6 }));
  const steel = keep(new T.MeshStandardMaterial({ color: '#d9dde6', roughness: 0.3, metalness: 0.5 }));
  const lampMat = keep(new T.MeshBasicMaterial({ color: '#fff4b0' }));
  const stripe = keep(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
  const cars = COLORS.map((c, k) => {
    const g = new T.Group();
    const m = keep(new T.MeshStandardMaterial({ color: c, roughness: 0.3 }));
    const b = new T.Mesh(body, m);
    b.position.y = 0.05;
    const s = new T.Mesh(seat, m);
    s.position.set(-0.5, 0.35, 0);
    const br = new T.Mesh(bar, steel);
    br.rotation.x = Math.PI / 2;
    br.position.set(0.18, 0.46, 0);
    const st = new T.Mesh(keep(new T.BoxGeometry(1.0, 0.05, 0.95)), stripe);
    st.position.set(0, 0.1, 0);
    g.add(b, s, br, st);
    for (const sx of [-0.35, 0.35]) for (const sz of [-0.47, 0.47]) {
      const w = new T.Mesh(wheel, dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(sx, -0.14, sz);
      g.add(w);
    }
    if (k === 0) for (const sz of [-0.3, 0.3]) {
      const l = new T.Mesh(lamp, lampMat);
      l.position.set(0.6, 0.12, sz);
      g.add(l);
    }
    g.scale.setScalar(CAR_SCALE);
    return g;
  });
  const loader = new T.TextureLoader();
  let alive = true;
  const riders = riderUrls.map((u) => {
    const mat = keep(new T.SpriteMaterial({ transparent: true, depthWrite: false }));
    loader.load(u, (tex: T.Texture) => {
      if (!alive) return tex.dispose();
      tex.colorSpace = T.SRGBColorSpace;
      own.push(tex);
      mat.map = tex;
      mat.needsUpdate = true;
    });
    const sp = new T.Sprite(mat);
    sp.scale.set(1.15, 1.15, 1);
    return sp;
  });
  return { cars, riders, dispose: () => { alive = false; own.forEach((d) => d.dispose()); } };
}
