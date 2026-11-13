import * as T from '../../lobby3d/lib';
import { Particles } from '../../lobby3d/particles';
import { Materials, roundedBox } from '../../lobby3d/shapes';
import type { LobbyIslandCtx, LobbyIslandHandle } from '../types';
import { PALETTE } from './render/blockSprites';

// a pyramid of jelly blocks, 4-3-2-1 (10 blocks, one InstancedMesh: one draw call), sparkles in another
const ROW_COUNTS = [4, 3, 2, 1];
const SIZE = 0.4;
const STEP = 0.43;
const JUMP_EVERY = 3.4;
const JUMP_TIME = 0.55;

interface Block { x: number; y: number; z: number; row: number; color: string }

/** Blocks of the pyramid in order (rows from the bottom, each centred). */
export function pyramid(): Block[] {
  const out: Block[] = [];
  ROW_COUNTS.forEach((n, row) => {
    for (let i = 0; i < n; i++) out.push({ x: (i - (n - 1) / 2) * STEP, y: SIZE / 2 + 0.02 + row * (SIZE + 0.01), z: 0, row, color: PALETTE[(i * 3 + row * 2) % PALETTE.length].mid });
  });
  return out;
}

/**
 * The miniature of the block game: a little tower of jelly blocks. Every few seconds a block jumps off the top, bursts into little stars and
 * grows back; a tap makes the whole tower hop, row after row. 
 */
export function createLobbyIsland(ctx: LobbyIslandCtx): LobbyIslandHandle {
  const { shadows, reduced } = ctx;
  const mats = new Materials();
  const group = new T.Group();
  const sparks = new Particles(shadows ? 36 : 18, new T.SphereGeometry(1, 6, 5), new T.MeshBasicMaterial({ color: '#ffffff' }));
  group.add(sparks.mesh);

  const blocks = pyramid();
  const mesh = new T.InstancedMesh(roundedBox(SIZE, SIZE, SIZE, 0.11), mats.get('#ffffff', { rough: 0.22 }), blocks.length);
  mesh.castShadow = shadows;
  mesh.frustumCulled = false;
  const color = new T.Color();
  blocks.forEach((b, i) => mesh.setColorAt(i, color.set(b.color)));
  group.add(mesh);
  // a soft shade under the tower
  const shade = new T.Mesh(new T.CircleGeometry(1.2, 20), new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.16 }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.01;
  group.add(shade);
  // one more block lying next to the tower
  const loose = new T.Mesh(roundedBox(0.26, 0.26, 0.26, 0.08), mats.get(PALETTE[4].mid, { rough: 0.22 }));
  loose.position.set(1.0, 0.14, 0.3);
  loose.rotation.set(0.1, 0.6, 0.05);
  loose.castShadow = shadows;
  group.add(loose);

  const dummy = new T.Object3D();
  const place = (i: number, dy = 0, scale = 1, spin = 0): void => {
    const b = blocks[i];
    dummy.position.set(b.x, b.y + dy, b.z);
    dummy.rotation.set(0, spin, spin * 0.5);
    dummy.scale.setScalar(Math.max(0.0001, scale));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  blocks.forEach((_, i) => place(i));
  mesh.instanceMatrix.needsUpdate = true;

  let nextJump = 1.6;
  let jumper = -1;
  let jumpT = 0;
  let popped = false;
  let tapT = -1;
  const top = blocks.map((b, i) => (b.row >= 2 ? i : -1)).filter((i) => i >= 0);
  const ease = (x: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  return {
    object: group,
    update(dt, time) {
      if (reduced) return;
      if (jumper < 0 && time >= nextJump) {
        jumper = top[Math.floor(Math.random() * top.length)];
        jumpT = 0;
        popped = false;
      }
      if (tapT >= 0) tapT += dt;
      let dirty = tapT >= 0 || jumper >= 0;
      for (let i = 0; i < blocks.length; i++) {
        let dy = 0;
        if (tapT >= 0) {
          const k = (tapT - blocks[i].row * 0.07) / 0.5;
          if (k > 0 && k < 1) dy = Math.sin(k * Math.PI) * 0.28;
        }
        if (i === jumper) {
          jumpT += dt / JUMP_TIME;
          if (jumpT < 1) place(i, Math.sin(jumpT * Math.PI * 0.5) * 0.85 + dy, 1, jumpT * 5);
          else {
            if (!popped) {
              popped = true;
              sparks.emit(new T.Vector3(blocks[i].x, blocks[i].y + 0.85, blocks[i].z), 12, { colors: [blocks[i].color, '#ffffff', '#ffd23f'], speed: 1.5, size: 0.05, life: 0.9 });
            }
            // hidden for a moment, then it grows back where it was
            const back = (jumpT - 1 - 0.9 / JUMP_TIME) * JUMP_TIME / 0.45;
            place(i, dy, back > 0 ? ease(back) * 1 : 0.0001);
            if (back >= 1) {
              jumper = -1;
              nextJump = time + JUMP_EVERY;
            }
          }
        } else if (tapT >= 0) place(i, dy);
      }
      if (tapT >= 0 && tapT > 0.5 + blocks.length * 0.02 + 0.4) tapT = -1;
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
      dirty = false;
      sparks.update(dt);
    },
    tap() {
      tapT = 0;
      sparks.emit(new T.Vector3(0, 1.3, 0), 10, { colors: ['#ffd23f', '#ffffff', '#ff8fd0'], speed: 1.4, size: 0.05 });
    },
    dispose() {
      sparks.dispose();
      mesh.geometry.dispose();
      mesh.dispose();
      loose.geometry.dispose();
      shade.geometry.dispose();
      (shade.material as T.MeshBasicMaterial).dispose();
      mats.dispose();
    },
  };
}
