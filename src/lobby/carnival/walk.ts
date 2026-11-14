/**
 * The walking of the residents (SPEC-carnival.md 4): on a graph of the paths (the ring, the spokes of the cross and the edge of the plaza).
 * A resident goes from node to node in a straight line, rests a little at some of them, and never leaves the path. Pure and deterministic.
 */
import { PLAZA_R, RING_NODES, RING_R } from './layout';

export interface Node { x: number; z: number; next: number[] }
export interface Graph { nodes: Node[] }

/** The paths: RING_NODES nodes on the ring, a middle node and a plaza node on each of the four spokes, the plaza nodes joined round the pedestal. */
export function makeGraph(): Graph {
  const nodes: Node[] = [];
  const at = (r: number, a: number): number => {
    nodes.push({ x: Math.sin(a) * r, z: -Math.cos(a) * r, next: [] });
    return nodes.length - 1;
  };
  const link = (a: number, b: number): void => {
    nodes[a].next.push(b);
    nodes[b].next.push(a);
  };
  const ring = Array.from({ length: RING_NODES }, (_, i) => at(RING_R, (i / RING_NODES) * Math.PI * 2));
  ring.forEach((n, i) => link(n, ring[(i + 1) % RING_NODES]));
  const plaza: number[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const mid = at((RING_R + PLAZA_R) / 2, a);
    const p = at(PLAZA_R, a);
    link(ring[k * (RING_NODES / 4)], mid);
    link(mid, p);
    plaza.push(p);
  }
  plaza.forEach((p, i) => link(p, plaza[(i + 1) % 4]));
  return { nodes };
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Walker {
  x: number;
  z: number;
  /** the direction of the last step: -1 left, 1 right on the screen */
  face = 1;
  private from: number;
  private to: number;
  private t = 0;
  private rest = 0;
  private prev = -1;
  /** the walker is standing still (it was tapped, or it is resting) */
  held = false;
  constructor(private g: Graph, start: number, private rand: () => number, public speed = 1.3) {
    this.from = this.to = start;
    this.x = g.nodes[start].x;
    this.z = g.nodes[start].z;
    this.rest = this.rand() * 1.5;
  }
  get node(): number {
    return this.t >= 1 || this.from === this.to ? this.to : this.from;
  }
  get walking(): boolean {
    return !this.held && this.rest <= 0 && this.from !== this.to;
  }
  update(dt: number): void {
    if (this.held) return;
    if (this.rest > 0) {
      this.rest -= dt;
      return;
    }
    if (this.from === this.to || this.t >= 1) {
      // choose the next node: not the one that it came from, when there is another way
      const here = this.to;
      const opts = this.g.nodes[here].next.filter((n) => n !== this.prev);
      const pick = (opts.length ? opts : this.g.nodes[here].next)[Math.floor(this.rand() * (opts.length || this.g.nodes[here].next.length))];
      this.prev = here;
      this.from = here;
      this.to = pick;
      this.t = 0;
      // a rest now and then, at a crossing more often
      if (this.rand() < (this.g.nodes[here].next.length > 2 ? 0.5 : 0.12)) this.rest = 0.4 + this.rand() * 1.6;
    }
    const a = this.g.nodes[this.from], b = this.g.nodes[this.to];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    this.t = Math.min(1, this.t + (this.speed * dt) / len);
    this.x = a.x + (b.x - a.x) * this.t;
    this.z = a.z + (b.z - a.z) * this.t;
    if (Math.abs(b.x - a.x) > 0.01) this.face = b.x > a.x ? 1 : -1;
  }
}
