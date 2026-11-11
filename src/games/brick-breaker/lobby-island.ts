import { Spring, clamp } from '../../lobby3d/motion';
import * as T from '../../lobby3d/lib';
import { Particles } from '../../lobby3d/particles';
import { Materials, PALETTE, roundedBox } from '../../lobby3d/shapes';
import type { LobbyIslandCtx, LobbyIslandHandle } from '../types';

const COLS = 6;
const ROWS = 3;
const ROW_COLORS = [PALETTE.red, PALETTE.yellow, PALETTE.green];

/**
 * Brick breaker's miniature: a little wall, a paddle, and a ball that bounces up to the wall, pops a brick
 * (which comes back a moment later) and returns.
 */
export function createLobbyIsland(ctx: LobbyIslandCtx): LobbyIslandHandle {
  const { shadows, reduced } = ctx;
  const mats = new Materials();
  const group = new T.Group();
  const sparks = new Particles(shadows ? 40 : 20, new T.SphereGeometry(1, 6, 5), new T.MeshBasicMaterial({ color: '#ffffff' }));
  group.add(sparks.mesh);

  const bricks = new T.InstancedMesh(roundedBox(0.46, 0.22, 0.24, 0.07), mats.get('#ffffff', { rough: 0.35 }), COLS * ROWS);
  bricks.castShadow = shadows;
  const pos: T.Vector3[] = [];
  const color = new T.Color();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      pos.push(new T.Vector3((c - (COLS - 1) / 2) * 0.5, 0.14 + r * 0.25, -0.5));
      bricks.setColorAt(r * COLS + c, color.set(ROW_COLORS[r]));
    }
  }
  group.add(bricks);

  const ball = new T.Mesh(new T.SphereGeometry(0.13, 16, 12), mats.get('#ffffff', { rough: 0.25 }));
  ball.castShadow = shadows;
  const shade = new T.Mesh(new T.CircleGeometry(0.16, 14), new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22 }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.012;
  const paddle = new T.Mesh(roundedBox(0.75, 0.14, 0.2, 0.06), mats.get(PALETTE.paddle, { rough: 0.4 }));
  paddle.castShadow = shadows;
  paddle.position.set(0, 0.07, 0.95);
  group.add(ball, shade, paddle);

  const dummy = new T.Object3D();
  const place = (i: number, s: number) => {
    dummy.position.copy(pos[i]);
    dummy.scale.setScalar(Math.max(0.0001, s));
    dummy.updateMatrix();
    bricks.setMatrixAt(i, dummy.matrix);
  };
  pos.forEach((_, i) => place(i, 1));

  const popped = pos.map(() => false);
  const respawnAt = pos.map(() => 0);
  const paddleX = new Spring(0, 60, 10);
  let from = new T.Vector3(0, 0.3, 0.95);
  let target = 4;
  let phase = 0; // 0..1 flying out to the wall, 1..2 coming back
  let didPop = false;

  if (reduced) {
    ball.position.set(0, 0.2, 0.95);
    shade.position.set(0, 0.012, 0.95);
  }

  return {
    object: group,
    update(dt, time) {
      if (reduced) return;
      phase += dt / 0.7;
      if (phase >= 2) {
        phase = 0;
        didPop = false;
        target = Math.floor(Math.random() * pos.length);
        for (let tries = 0; popped[target] && tries < 12; tries++) target = Math.floor(Math.random() * pos.length);
        from = new T.Vector3(paddleX.value, 0.3, 0.95);
      }
      const goal = pos[target];
      const out = phase < 1;
      const u = out ? phase : phase - 1;
      const a = out ? from : goal;
      const b = out ? goal : new T.Vector3(goal.x * 0.5, 0.3, 0.95);
      ball.position.lerpVectors(a, b, u);
      ball.position.y += Math.sin(u * Math.PI) * 0.35 * (out ? 1 : 0.6);
      if (!out) paddleX.target = goal.x * 0.5;
      paddleX.step(dt);
      paddle.position.x = paddleX.value;
      shade.position.set(ball.position.x, 0.012, ball.position.z);
      shade.scale.setScalar(clamp(1.2 - ball.position.y * 0.5, 0.4, 1.2));

      if (out && u > 0.97 && !didPop) {
        didPop = true;
        popped[target] = true;
        respawnAt[target] = time + 1.8;
        place(target, 0);
        sparks.emit(pos[target], 8, { colors: [ROW_COLORS[Math.floor(target / COLS)], '#ffffff'], speed: 1.2, size: 0.05, life: 0.7 });
      }
      for (let i = 0; i < pos.length; i++) {
        if (popped[i] && time >= respawnAt[i]) {
          popped[i] = false;
          place(i, 1);
        }
      }
      bricks.instanceMatrix.needsUpdate = true;
      sparks.update(dt);
    },
    tap() {
      sparks.emit(new T.Vector3(0, 1.0, 0), 10, { colors: ['#ffffff', PALETTE.yellow], speed: 1.4, size: 0.05 });
    },
    dispose() {
      sparks.dispose();
      bricks.dispose();
      mats.dispose();
    },
  };
}
