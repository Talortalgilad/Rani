import * as T from './lib';

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; g: number }

/** Sparkles, puffs and confetti in one InstancedMesh: one draw call however many pieces fly. */
export class Particles {
  readonly mesh: T.InstancedMesh;
  private pool: P[];
  private live = 0;
  private dummy = new T.Object3D();
  private color = new T.Color();

  constructor(private max: number, geometry: T.SphereGeometry | T.ExtrudeGeometry, material: T.MeshStandardMaterial | T.MeshBasicMaterial) {
    this.mesh = new T.InstancedMesh(geometry, material, max);
    this.mesh.frustumCulled = false;
    this.pool = Array.from({ length: max }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0, size: 0, g: 0 }));
    for (let i = 0; i < max; i++) this.hide(i);
  }

  get active(): number {
    return this.live;
  }

  private hide(i: number): void {
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  emit(origin: T.Vector3, count: number, o: { speed?: number; life?: number; size?: number; gravity?: number; colors?: string[]; up?: number } = {}): void {
    const colors = o.colors ?? ['#ffd23f'];
    for (let n = 0; n < count; n++) {
      const i = this.pool.findIndex((p) => p.life >= p.max);
      if (i < 0) return;
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI;
      const s = (o.speed ?? 1.5) * (0.5 + Math.random());
      Object.assign(this.pool[i], {
        x: origin.x, y: origin.y, z: origin.z,
        vx: Math.cos(a) * Math.sin(e) * s, vy: Math.cos(e) * s + (o.up ?? 0.6), vz: Math.sin(a) * Math.sin(e) * s,
        life: 0, max: (o.life ?? 0.8) * (0.6 + Math.random() * 0.6), size: (o.size ?? 0.08) * (0.6 + Math.random() * 0.8), g: o.gravity ?? 3,
      });
      this.mesh.setColorAt(i, this.color.set(colors[n % colors.length]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (p.life >= p.max) continue;
      p.life += dt;
      if (p.life >= p.max) {
        this.hide(i);
        continue;
      }
      live++;
      p.vy -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = 1 - p.life / p.max;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.life * 5, p.life * 4, 0);
      this.dummy.scale.setScalar(p.size * Math.min(1, k * 3));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.live = live;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
