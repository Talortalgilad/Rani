/**
 * One texture, one draw call, many billboards (SPEC-carnival.md 9: sprites in one atlas, at most 60 draw calls). The pictures of everything that stands in the carnival (the stalls, the
 * rides, the decorations) or walks in it (the residents) are drawn into one canvas, and an instanced mesh shows each instance with its own piece of it. The billboards are cut out
 * (alpha test, depth written), so no sorting is needed.
 */
import * as T from '../../lobby3d/lib';

export interface AtlasOpts {
  keys: string[];
  urlOf(key: string): string;
  /** the size of a cell in pixels (the pictures are 512, the cells smaller) */
  cell: number;
  capacity: number;
  /** a tint on the whole thing (the colour of the night) */
  tint?: string;
  /** called when a picture arrived (the texture is updated, the page may repaint) */
  onLoad?(): void;
}

export class Atlas {
  readonly mesh: T.InstancedMesh;
  readonly canvas: HTMLCanvasElement;
  private tex: T.CanvasTexture;
  private cols: number;
  private rows: number;
  private index = new Map<string, number>();
  private uv: T.InstancedBufferAttribute;
  private m = new T.Matrix4();
  private q = new T.Quaternion();
  private dead = false;
  private mat: T.MeshBasicMaterial;
  private geo: T.PlaneGeometry;
  /** how many instances are shown now */
  count = 0;

  constructor(private o: AtlasOpts, facing: T.Quaternion) {
    this.q.copy(facing);
    this.cols = Math.ceil(Math.sqrt(o.keys.length));
    this.rows = Math.ceil(o.keys.length / this.cols);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.cols * o.cell;
    this.canvas.height = this.rows * o.cell;
    this.tex = new T.CanvasTexture(this.canvas);
    this.tex.colorSpace = T.SRGBColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = T.LinearFilter;
    this.tex.magFilter = T.LinearFilter;
    this.mat = new T.MeshBasicMaterial({ map: this.tex, transparent: false, alphaTest: 0.42, side: T.DoubleSide, color: o.tint ?? '#ffffff' });
    this.mat.onBeforeCompile = (shader) => {
      shader.vertexShader = 'attribute vec4 uvRect;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * uvRect.zw + uvRect.xy;\n#endif');
    };
    this.geo = new T.PlaneGeometry(1, 1);
    this.uv = new T.InstancedBufferAttribute(new Float32Array(o.capacity * 4), 4);
    this.geo.setAttribute('uvRect', this.uv);
    this.mesh = new T.InstancedMesh(this.geo, this.mat, o.capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    o.keys.forEach((k, i) => this.index.set(k, i));
    const ctx = this.canvas.getContext('2d')!;
    o.keys.forEach((k, i) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (this.dead) return;
        const col = i % this.cols, row = Math.floor(i / this.cols);
        const pad = 3;
        // the picture is fitted into its cell (square pictures: as they are), with a little room round it
        ctx.drawImage(img, col * o.cell + pad, row * o.cell + pad, o.cell - pad * 2, o.cell - pad * 2);
        this.tex.needsUpdate = true;
        o.onLoad?.();
      };
      img.src = o.urlOf(k);
    });
  }

  has(key: string): boolean {
    return this.index.has(key);
  }
  /** puts instance `i` (0-based) at a place, with a size, a flip (-1 to turn it round) and a bit of colour (the tint of one thing, e.g. dim) */
  set(i: number, key: string, x: number, y: number, z: number, size: number, flip = 1, color?: T.Color): void {
    const k = this.index.get(key);
    if (k === undefined || i >= this.o.capacity) return;
    const col = k % this.cols, row = Math.floor(k / this.cols);
    const e = 0.5 / this.canvas.width;
    this.uv.setXYZW(i, col / this.cols + e, 1 - (row + 1) / this.rows + e, 1 / this.cols - 2 * e, 1 / this.rows - 2 * e);
    this.m.compose(new T.Vector3(x, y, z), this.q, new T.Vector3(size * flip, size, 1));
    this.mesh.setMatrixAt(i, this.m);
    if (color) this.mesh.setColorAt(i, color);
  }
  /** call after setting instances: how many are shown */
  commit(count: number): void {
    this.count = count;
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.uv.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose(): void {
    this.dead = true;
    this.tex.dispose();
    this.mat.dispose();
    this.geo.dispose();
    this.mesh.dispose();
  }
}
