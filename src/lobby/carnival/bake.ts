/**
 * Fewer draw calls: the meshes of a group that never move are merged, by material, into a few meshes (the colour of each goes into the vertices).
 * Whatever moves, has a texture, is transparent or is instanced stays as it is. A group that brings its own animation (a game's miniature) is
 * first run for a moment, and the meshes whose place did not change are the static ones.
 */
import * as T from '../../lobby3d/lib';

const mergeable = (m: T.Mesh): boolean => {
  const mat = m.material as T.MeshStandardMaterial;
  if (Array.isArray(m.material) || !(mat as unknown as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial) return false;
  if ((m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh || (m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return false;
  return !mat.map && !mat.transparent && m.visible !== false && !mat.vertexColors && mat.emissiveIntensity === 0 || (!mat.map && !mat.transparent && mat.emissive.getHex() === 0);
};

/** The meshes under `root` whose world matrix is the same at every one of the sampled moments. */
export function staticMeshes(root: T.Object3D, sample: (step: number) => void): T.Mesh[] {
  const all: T.Mesh[] = [];
  root.traverse((o) => {
    if ((o as T.Mesh).isMesh && mergeable(o as T.Mesh)) all.push(o as T.Mesh);
  });
  const snap = (): number[][] => {
    root.updateMatrixWorld(true);
    return all.map((m) => m.matrixWorld.toArray());
  };
  sample(0);
  const a = snap();
  sample(1);
  sample(2);
  const b = snap();
  sample(3);
  const c = snap();
  return all.filter((_, i) => a[i].every((v, k) => Math.abs(v - b[i][k]) < 1e-5 && Math.abs(v - c[i][k]) < 1e-5));
}

/** Merges the given meshes into one mesh per (roughness, metalness, side). Returns the new meshes (already added to `into`). */
export function bake(meshes: T.Mesh[], into: T.Object3D): T.Mesh[] {
  const groups = new Map<string, { geos: T.BufferGeometry[]; side: number }>();
  const col = new T.Color();
  for (const m of meshes) {
    const mat = m.material as T.MeshStandardMaterial;
    m.updateWorldMatrix(true, false);
    let g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    col.copy(mat.color);
    for (let i = 0; i < n; i++) colors.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    const key = `${mat.side}`;
    const e = groups.get(key) ?? { geos: [], side: mat.side };
    e.geos.push(g);
    groups.set(key, e);
  }
  const out: T.Mesh[] = [];
  for (const e of groups.values()) {
    const geo = T.mergeGeometries(e.geos, false);
    e.geos.forEach((g) => g.dispose());
    if (!geo) continue;
    const mesh = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, side: e.side as T.MeshLambertMaterial['side'] }));
    into.add(mesh);
    out.push(mesh);
  }
  for (const m of meshes) {
    m.parent?.remove(m);
    m.geometry.dispose();
  }
  return out;
}
