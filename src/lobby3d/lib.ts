/**
 * The only place that names what we use from Three.js. Importing from here (instead of `import * as THREE`)
 * keeps the lazy 3D chunk small, because unused parts of the library are tree-shaken away.
 * Nothing eager (home, gate, parent area, games' 2D code) may import this file.
 */
export {
  AmbientLight, BufferGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, CylinderGeometry,
  DirectionalLight, ExtrudeGeometry, Fog, Group, HemisphereLight, InstancedMesh, MathUtils, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  Raycaster, SRGBColorSpace, Scene, Shape, SphereGeometry, TorusGeometry, Vector2, Vector3, WebGLRenderer,
} from 'three';
export type { Material, Texture } from 'three';
