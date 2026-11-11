import * as T from './lib';

/** The app's colours as 3D materials: matte and soft, slightly glossy where it is fun. */
export const PALETTE = {
  grass: '#7ddc5a', rock: '#a07a57', cloud: '#ffffff', gold: '#ffc83d', glass: '#cfeaff',
  red: '#ff5d73', yellow: '#ffd23f', green: '#3fb56b', blue: '#3aa0ff', purple: '#b57bff', orange: '#ff9a3c',
  ink: '#3a2f4b', paper: '#fffaf2', paddle: '#8e5cf0',
} as const;

export class Materials {
  private cache = new Map<string, T.MeshStandardMaterial>();

  get(color: string, o: { rough?: number; metal?: number; emissive?: string; opacity?: number; flat?: boolean } = {}): T.MeshStandardMaterial {
    const key = `${color}|${o.rough ?? ''}|${o.metal ?? ''}|${o.emissive ?? ''}|${o.opacity ?? ''}|${o.flat ?? ''}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new T.MeshStandardMaterial({
        color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0, flatShading: o.flat ?? false,
        emissive: o.emissive ?? '#000000', emissiveIntensity: o.emissive ? 0.6 : 0,
        transparent: o.opacity !== undefined, opacity: o.opacity ?? 1,
      });
      this.cache.set(key, m);
    }
    return m;
  }

  dispose(): void {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
  }
}
