/**
 * The little effects of the chase: sparks behind her, dust at a landing, confetti and stars at a right gate, a star that flies to the counter.
 * One pool of numbers (no objects are made in a frame). `q` is the share of particles that are made: a slow phone lowers it before it lowers anything else (0 is none).
 */
export const K = { spark: 0, dust: 1, confetti: 2, burst: 3, fly: 4 } as const;
const N = 160;
const CONFETTI = ['#ff4d6d', '#ffd23f', '#4cc9f0', '#80ed99', '#c77dff'];

export class Fx {
  /** the share of particles that are made: 1, 0.5 or 0 */
  q = 1;
  /** stars that have arrived at the counter since the last `takeArrivals` */
  private arrived = 0;
  private n = 0;
  private x = new Float32Array(N);
  private y = new Float32Array(N);
  private vx = new Float32Array(N);
  private vy = new Float32Array(N);
  private life = new Float32Array(N);
  private max = new Float32Array(N);
  private size = new Float32Array(N);
  private tx = new Float32Array(N);
  private ty = new Float32Array(N);
  private x0 = new Float32Array(N);
  private y0 = new Float32Array(N);
  private kind = new Uint8Array(N);
  private col = new Uint8Array(N);

  get count(): number {
    return this.n;
  }
  takeArrivals(): number {
    const a = this.arrived;
    this.arrived = 0;
    return a;
  }
  clear(): void {
    this.n = 0;
    this.arrived = 0;
  }

  /** how many of `count` particles are made, at the quality now (the ones that fly to the counter are always made: they are the stars that she got) */
  amount(count: number): number {
    return Math.round(count * this.q);
  }

  spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, col = 0, tx = 0, ty = 0): void {
    if (this.n >= N) return;
    const i = this.n++;
    this.kind[i] = kind;
    this.x[i] = this.x0[i] = x;
    this.y[i] = this.y0[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = this.max[i] = life;
    this.size[i] = size;
    this.col[i] = col;
    this.tx[i] = tx;
    this.ty[i] = ty;
  }

  /** a burst of stars and confetti from a point */
  celebrate(x: number, y: number, rnd: () => number): void {
    for (let i = this.amount(14); i > 0; i--) this.spawn(K.confetti, x, y, (rnd() - 0.5) * 360, -120 - rnd() * 260, 1.1 + rnd() * 0.5, 7 + rnd() * 5, (rnd() * 5) | 0);
    for (let i = this.amount(8); i > 0; i--) this.spawn(K.burst, x, y, (rnd() - 0.5) * 300, -(rnd() * 220), 0.8 + rnd() * 0.3, 20 + rnd() * 14);
  }

  update(dt: number): void {
    for (let i = this.n - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        if (this.kind[i] === K.fly) this.arrived++;
        const l = --this.n;
        if (i !== l) {
          this.x[i] = this.x[l]; this.y[i] = this.y[l]; this.vx[i] = this.vx[l]; this.vy[i] = this.vy[l]; this.life[i] = this.life[l]; this.max[i] = this.max[l];
          this.size[i] = this.size[l]; this.tx[i] = this.tx[l]; this.ty[i] = this.ty[l]; this.x0[i] = this.x0[l]; this.y0[i] = this.y0[l]; this.kind[i] = this.kind[l]; this.col[i] = this.col[l];
        }
        continue;
      }
      if (this.kind[i] === K.fly) {
        // an arc to the counter: along the line, with a bulge up that is biggest in the middle
        const u = 1 - this.life[i] / this.max[i];
        const e = u * u * (3 - 2 * u);
        this.x[i] = this.x0[i] + (this.tx[i] - this.x0[i]) * e;
        this.y[i] = this.y0[i] + (this.ty[i] - this.y0[i]) * e - Math.sin(u * Math.PI) * 60;
        continue;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      if (this.kind[i] === K.confetti || this.kind[i] === K.burst) this.vy[i] += 520 * dt;
      else this.vx[i] *= 0.96;
    }
  }

  draw(g: CanvasRenderingContext2D, star: HTMLCanvasElement): void {
    for (let i = 0; i < this.n; i++) {
      const u = this.life[i] / this.max[i];
      const s = this.size[i];
      switch (this.kind[i]) {
        case K.spark:
          g.globalAlpha = u * 0.9;
          g.fillStyle = this.col[i] ? '#ffffff' : '#fff0a0';
          g.beginPath();
          g.arc(this.x[i], this.y[i], s * (0.4 + 0.6 * u), 0, 7);
          g.fill();
          break;
        case K.dust:
          g.globalAlpha = u * 0.5;
          g.fillStyle = '#e8dcc0';
          g.beginPath();
          g.arc(this.x[i], this.y[i], s * (1.6 - u), 0, 7);
          g.fill();
          break;
        case K.confetti:
          g.globalAlpha = Math.min(1, u * 2);
          g.fillStyle = CONFETTI[this.col[i] % 5];
          g.fillRect(this.x[i], this.y[i], s, s * (0.35 + 0.65 * Math.abs(Math.sin(u * 14 + i))));
          break;
        case K.burst:
          g.globalAlpha = Math.min(1, u * 2);
          g.drawImage(star, this.x[i] - s / 2, this.y[i] - s / 2, s, s);
          break;
        case K.fly:
          g.globalAlpha = 1;
          g.drawImage(star, this.x[i] - s / 2, this.y[i] - s / 2, s * (0.6 + 0.4 * u), s * (0.6 + 0.4 * u));
          break;
      }
    }
    g.globalAlpha = 1;
  }
}
