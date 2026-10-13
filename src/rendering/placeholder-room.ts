import {
  AmbientLight,
  BoxGeometry,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import { devDoors, devWallPieces } from '../game/dev-room-links';
import { RACK_METRE } from '../game/rack-layout';
import { createDevDoorways } from '../scene/dev-doorways';
import { createFirstPerson } from './first-person';
import { createPs1Material, ps1Uniforms } from './ps1-material';

/** Dev2 remains an unfurnished room reserved for later development. */
export function startPlaceholderRoom(canvas: HTMLCanvasElement) {
  const m = RACK_METRE;
  const bounds = { minX: -5 * m, maxX: 5 * m, minZ: -5 * m, maxZ: 5 * m };
  const scene = new Scene();
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setClearColor('#2b2d2c');
  const camera = new PerspectiveCamera(52, 1, 0.05, 40 * m);
  scene.add(new AmbientLight('#fff4e2', 2));
  const floorMaterial = createPs1Material({ color: '#62635c' });
  const wallMaterial = createPs1Material({ color: '#899085' });
  const slab = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    wall = false,
  ) => {
    const mesh = new Mesh(
      new BoxGeometry(w, h, d),
      wall ? wallMaterial : floorMaterial,
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
  };
  slab(10 * m, 0.1 * m, 10 * m, 0, -0.05 * m, 0);
  slab(10 * m, 0.1 * m, 10 * m, 0, 3.25 * m, 0, true);
  const doors = devDoors('dev2', bounds, m);
  const walls = devWallPieces(bounds, doors, m, 3.2 * m);
  for (const wall of walls)
    slab(
      wall.maxX - wall.minX,
      wall.top - wall.bottom,
      wall.maxZ - wall.minZ,
      (wall.minX + wall.maxX) / 2,
      (wall.bottom + wall.top) / 2,
      (wall.minZ + wall.maxZ) / 2,
      true,
    );
  const passages = createDevDoorways('dev2', doors, 0, m);
  scene.add(passages.group);
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const use = (x: number, y: number) => {
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...passages.uses.keys()], false)[0];
    if (hit && hit.distance < 2.8 * m)
      passages.uses.get(hit.object as Mesh)?.();
  };
  const walk = createFirstPerson({
    canvas,
    camera,
    metre: m,
    floorY: 0,
    start: passages.arrival(
      new URLSearchParams(location.search).get('from'),
    ) ?? { x: 0, z: 3 * m },
    solids: () => [
      ...walls.filter((wall) => wall.bottom === 0),
      ...passages.solids(),
    ],
    use,
  });
  const notes = document.createElement('div');
  notes.textContent =
    'DEV2 · Empty placeholder · Doors: dev1 west / dev3 east · WASD: walk · E: door · Esc: cursor';
  Object.assign(notes.style, {
    position: 'absolute',
    top: '12px',
    left: '12px',
    padding: '10px',
    background: '#20302bdd',
    color: '#e8e2cc',
    font: '13px monospace',
  });
  canvas.parentElement?.append(notes);
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const scale = Math.min(640 / width, 480 / height, 1);
    const w = Math.round(width * scale),
      h = Math.round(height * scale);
    renderer.setSize(w, h, false);
    ps1Uniforms.resolution.value.set(w, h);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  let last = 0;
  renderer.setAnimationLoop((time) => {
    if (canvas.parentElement?.hidden) {
      last = 0;
      return;
    }
    const delta = last ? Math.min(0.1, (time - last) / 1000) : 0;
    last = time;
    walk.update(delta);
    passages.update(delta, walk.walker.x, walk.walker.z);
    renderer.render(scene, camera);
  });
  const dispose = () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    walk.dispose();
    passages.dispose();
    notes.remove();
    scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    wallMaterial.dispose();
    floorMaterial.dispose();
    renderer.dispose();
  };
  return Object.assign(dispose, {
    enter(previous: string | null) {
      const pose = passages.arrival(previous);
      if (pose) {
        walk.place(pose.x, pose.z, pose.yaw, pose.pitch);
        walk.walker.crouched = false;
        walk.walker.lowCrouched = false;
      }
    },
  });
}
