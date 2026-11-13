import { drawStar } from './blockSprites';

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; star: boolean; rot: number; vr: number }

/** Bits of jelly and small stars (SPEC-blocks.md 2.5: 6-8 for every block that bursts). A pool: nothing is allocated while it plays. */
export class Particles {
  private list: P[] = [];
  private pool: P[] = [];
  get count(): number {
    return this.list.length;
  }

  burst(x: number, y: number, color: string, cell: number, n = 7, scale = 1): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = cell * (2.2 + Math.random() * 3.4) * scale;
      const p = this.pool.pop() ?? ({} as P);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - cell * 2.4;
      p.max = p.life = 0.55 + Math.random() * 0.4;
      p.size = cell * (0.1 + Math.random() * 0.12);
      p.color = color;
      p.star = i % 3 === 0;
      p.rot = Math.random() * 6;
      p.vr = (Math.random() - 0.5) * 12;
      this.list.push(p);
    }
  }

  /** Confetti falling from the top of the screen (the clean board, a full board that is celebrated). */
  confetti(w: number, colors: string[], n = 70): void {
    for (let i = 0; i < n; i++) {
      const p = this.pool.pop() ?? ({} as P);
      p.x = Math.random() * w;
      p.y = -10 - Math.random() * 80;
      p.vx = (Math.random() - 0.5) * 120;
      p.vy = 120 + Math.random() * 260;
      p.max = p.life = 1.8 + Math.random() * 1.2;
      p.size = 5 + Math.random() * 6;
      p.color = colors[i % colors.length];
      p.star = i % 4 === 0;
      p.rot = Math.random() * 6;
      p.vr = (Math.random() - 0.5) * 10;
      this.list.push(p);
    }
  }

  update(dt: number, gravity: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(this.list.splice(i, 1)[0]);
        continue;
      }
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      g.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
      g.fillStyle = p.color;
      if (p.star) drawStar(g, p.x, p.y, p.size * 1.5, p.rot);
      else {
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  clear(): void {
    this.pool.push(...this.list);
    this.list.length = 0;
  }
}
