import { W } from './engine';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  rot: number; vr: number; gravity: number; shape: 'dot' | 'rect' | 'text'; text?: string;
}

const CONFETTI = ['#ff5d73', '#ffd23f', '#3fb56b', '#3aa0ff', '#b57bff', '#ff9a3c'];
const CAP = 500;

export class Fx {
  p: Particle[] = [];

  private add(q: Particle): void {
    if (this.p.length >= CAP) this.p.shift();
    this.p.push(q);
  }

  burst(x: number, y: number, color: string, n = 9): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 150 + Math.random() * 300;
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0, max: 0.5 + Math.random() * 0.3,
        size: 7 + Math.random() * 7, color, rot: 0, vr: 0, gravity: 900, shape: 'dot' });
    }
  }

  float(x: number, y: number, text: string): void {
    this.add({ x, y, vx: 0, vy: -180, life: 0, max: 0.9, size: 60, color: '#fff', rot: 0, vr: 0, gravity: 0, shape: 'text', text });
  }

  confetti(height: number, n = 150): void {
    for (let i = 0; i < n; i++) {
      this.add({
        x: Math.random() * W, y: -Math.random() * 100 + Math.random() * height * 0.35,
        vx: (Math.random() - 0.5) * 300, vy: 150 + Math.random() * 350,
        life: 0, max: 2.4 + Math.random() * 1.2, size: 14 + Math.random() * 14,
        color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, gravity: 420, shape: 'rect',
      });
    }
  }

  clear(): void {
    this.p.length = 0;
  }

  update(dt: number): void {
    let w = 0;
    for (const q of this.p) {
      q.life += dt;
      if (q.life >= q.max) continue;
      q.vy += q.gravity * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      this.p[w++] = q;
    }
    this.p.length = w;
  }

  draw(g: CanvasRenderingContext2D): void {
    for (const q of this.p) {
      const a = Math.min(1, (q.max - q.life) / (q.max * 0.35));
      g.globalAlpha = a;
      if (q.shape === 'text') {
        g.font = `${q.size}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(q.text ?? '', q.x, q.y);
      } else if (q.shape === 'dot') {
        g.fillStyle = q.color;
        g.beginPath();
        g.arc(q.x, q.y, q.size * (1 - q.life / q.max * 0.5), 0, Math.PI * 2);
        g.fill();
      } else {
        g.save();
        g.translate(q.x, q.y);
        g.rotate(q.rot);
        g.fillStyle = q.color;
        g.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
        g.restore();
      }
    }
    g.globalAlpha = 1;
  }
}
