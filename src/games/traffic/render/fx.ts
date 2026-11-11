import * as T from '../../../lobby3d/lib';
import { Particles } from '../../../lobby3d/particles';

/** Dust behind wheels, sparkles, and fireworks. Each is one InstancedMesh. */
export class Fx {
  readonly dust: Particles;
  readonly sparks: Particles;
  readonly group = new T.Group();

  constructor(tier: 'high' | 'medium') {
    const n = tier === 'high' ? 1 : 0.5;
    this.dust = new Particles(Math.round(48 * n), new T.SphereGeometry(1, 5, 4), new T.MeshBasicMaterial({ color: '#ffffff' }));
    this.sparks = new Particles(Math.round(150 * n), new T.SphereGeometry(1, 4, 3), new T.MeshBasicMaterial({ color: '#ffffff' }));
    this.group.add(this.dust.mesh, this.sparks.mesh);
  }

  puff(x: number, z: number, count = 2): void {
    this.dust.emit(new T.Vector3(x, 0.12, z), count, { colors: ['#f4dfb0', '#ffffff'], speed: 0.6, size: 0.17, life: 0.55, gravity: -0.6, up: 0.4 });
  }

  /** Little stars where something lands or is found. */
  sparkle(x: number, y: number, z: number, count = 10, colors = ['#ffe36a', '#ffffff']): void {
    this.sparks.emit(new T.Vector3(x, y, z), count, { colors, speed: 2.2, size: 0.09, life: 0.7, gravity: 3 });
  }

  firework(x: number, y: number, z: number): void {
    const palettes = [['#ff4f4f', '#ffd02b'], ['#2ec4f0', '#ffffff'], ['#ff4fb8', '#ffe36a'], ['#47c94a', '#ffffff'], ['#8a4dff', '#ffd02b']];
    this.sparks.emit(new T.Vector3(x, y, z), 46, { colors: palettes[Math.floor(Math.random() * palettes.length)], speed: 4.6, size: 0.13, life: 1.4, gravity: 3.2, up: 0 });
  }

  update(dt: number): void {
    this.dust.update(dt);
    this.sparks.update(dt);
  }

  dispose(): void {
    this.dust.dispose();
    this.sparks.dispose();
  }
}
