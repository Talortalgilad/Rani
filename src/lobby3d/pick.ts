import * as T from './lib';

const ray = new T.Raycaster();
const ndc = new T.Vector2();

/** Which of `targets` is under this screen point? Walks up to the ancestor that carries `userData.index`. */
export function pickIndex(camera: T.PerspectiveCamera, canvas: HTMLCanvasElement, clientX: number, clientY: number, targets: T.Object3D[]): number | null {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(targets, true)[0];
  if (!hit) return null;
  let o: T.Object3D | null = hit.object;
  while (o) {
    if (typeof o.userData.index === 'number') return o.userData.index;
    o = o.parent;
  }
  return null;
}
