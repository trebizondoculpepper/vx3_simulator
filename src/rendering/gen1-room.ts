import {
  createRenderer,
  realistic,
  renderScale,
  useEnvironment,
} from './render-style';
import { devDoors, devWallPieces } from '../game/dev-room-links';
import { createDevDoorways } from '../scene/dev-doorways';
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Raycaster,
  Vector2,
  TubeGeometry,
} from 'three';
import type { Material, Texture } from 'three';
import { PANEL_WIDTH } from '../game/rack-layout';
import type { Footprint } from '../game/walk-collision';
import { createCanvasTexture } from '../scene/screens';
import { GEN1_RACK_Z, GEN1_TOTAL_HEIGHT } from '../scene/gen1-vx3';
import { createFirstPerson } from './first-person';
import { createPs1Material, ps1Uniforms } from './ps1-material';

const metre = PANEL_WIDTH / 0.4826;

/** Room dev3: the former archive bay, retaining its cordon and door to dev2. */
export function startGen1Room(canvas: HTMLCanvasElement) {
  const renderer = createRenderer(canvas);
  const scene = new Scene();
  // Realistic style: soft light and reflections from every side.
  const freeEnvironment = useEnvironment(renderer, scene, 0.45);
  const fog = new Fog('#1b1c1a', 120, 220);
  scene.fog = fog;
  scene.background = fog.color;
  const camera = new PerspectiveCamera(52, 1, 0.1, 220);
  scene.add(new AmbientLight('#fff0d7', 1.5));
  const lamp = new DirectionalLight('#ffe4ad', 2.1);
  lamp.position.set(-3, 5, 7);
  scene.add(lamp);
  const rim = new DirectionalLight('#829a98', 0.7);
  rim.position.set(3, -1, 2);
  scene.add(rim);

  const materials: Material[] = [];
  const textures: Texture[] = [];
  const paint = (color: string, unlit = false) => {
    const made = createPs1Material({ color }, unlit);
    materials.push(made);
    return made;
  };
  const block = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), paint(color));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  // The gallery: the machine's floor, its back wall where the lab's north
  // wall was (the mains socket is fixed to it), and room to stand back.
  const floorY = -GEN1_TOTAL_HEIGHT / 2 - 0.23;
  const height = 3.2 * metre;
  const bounds = {
    minX: -3 * metre,
    maxX: 3.6 * metre,
    minZ: -3.81,
    maxZ: GEN1_RACK_Z + 4.6 * metre,
  };
  // The rail a metre and a quarter in front of the rack, and the sign
  // just outside it.
  const railZ = GEN1_RACK_Z + 1.25 * metre;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midZ = (bounds.minZ + bounds.maxZ) / 2;
  block(width, 0.2, depth, '#4e4a42', midX, floorY - 0.1, midZ);
  block(width, 0.2, depth, '#3a3c38', midX, floorY + height + 0.1, midZ);
  const doors = devDoors('dev3', bounds, metre);
  const walls = devWallPieces(bounds, doors, metre, height);
  for (const wall of walls)
    block(
      wall.maxX - wall.minX,
      wall.top - wall.bottom,
      wall.maxZ - wall.minZ,
      '#5d6858',
      (wall.minX + wall.maxX) / 2,
      floorY + (wall.top + wall.bottom) / 2,
      (wall.minZ + wall.maxZ) / 2,
    );
  const passages = createDevDoorways('dev3', doors, floorY, metre);
  scene.add(passages.group);
  // A brass rail keeps visitors a step back from the machine.
  // It runs right across the room, with a gap at each end to walk round.
  for (const x of [-18, -9, 0, 9, 18, 27])
    block(
      0.12,
      0.95 * metre,
      0.12,
      '#8c7a4c',
      x,
      floorY + 0.475 * metre,
      railZ,
    );
  block(45.12, 0.1, 0.1, '#b89b58', 4.5, floorY + 0.95 * metre, railZ);

  // The sign in front of it, on a stand, leaning back to be read.
  const sign = createCanvasTexture(512, 256);
  textures.push(sign.texture);
  {
    const c = sign.context;
    c.fillStyle = '#1f2a26';
    c.fillRect(0, 0, 512, 256);
    c.strokeStyle = '#c9b27a';
    c.lineWidth = 4;
    c.strokeRect(10, 10, 492, 236);
    c.fillStyle = '#e8dfc4';
    c.textAlign = 'center';
    c.font = 'bold 34px monospace';
    c.fillText('VX3 · GENERATION 1', 256, 62);
    c.font = '19px monospace';
    const lines = [
      'Das Exponat befindet sich jetzt im',
      'VX-Museum, im südlichen Saal.',
      '',
      'Die Feldgeneratoren wurden entfernt.',
      'Die Vorführung darf bedient werden.',
    ];
    lines.forEach((line, i) => c.fillText(line, 256, 110 + i * 26));
    c.fillStyle = '#c9b27a';
    c.font = 'bold 15px monospace';
    c.fillText('UMGEZOGEN · VX-MUSEUM', 256, 236);
    sign.texture.needsUpdate = true;
  }
  // The stand is to the left of the rack, turned toward the way in, so it
  // can be read without hiding the machine.
  const stand = new Group();
  stand.position.set(-1.6 * metre, floorY, railZ + 0.5 * metre);
  stand.rotation.y = 0.35;
  scene.add(stand);
  const post = new Mesh(
    new BoxGeometry(0.12, 1.0 * metre, 0.12),
    paint('#2c2f2c'),
  );
  post.position.y = 0.5 * metre;
  const board = new Group();
  board.position.y = 1.15 * metre;
  board.rotation.x = -0.3;
  const backing = new Mesh(
    new BoxGeometry(0.84 * metre, 0.44 * metre, 0.08),
    paint('#2c2f2c'),
  );
  const plaque = new Mesh(
    new PlaneGeometry(0.8 * metre, 0.4 * metre),
    createPs1Material({ map: sign.texture }, true),
  );
  materials.push(plaque.material);
  plaque.position.z = 0.05;
  board.add(backing, plaque);
  stand.add(post, board);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Everything solid between knee and head height blocks the walker.
  scene.updateMatrixWorld(true);
  const solids: Footprint[] = [];
  const box = new Box3();
  scene.traverse((object) => {
    if (
      !(object instanceof Mesh) ||
      object.userData.noCollision ||
      object.geometry instanceof TubeGeometry
    )
      return;
    if (object.geometry instanceof PlaneGeometry) return;
    box.setFromObject(object);
    if (box.max.y < floorY + 0.3 * metre || box.min.y > floorY + 1.7 * metre)
      return;
    // The floor and ceiling slabs span the room; the walls are kept.
    if (box.max.x - box.min.x > width - 1 && box.max.z - box.min.z > depth - 1)
      return;
    solids.push({
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z,
    });
  });

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const useAt = (x: number, y: number) => {
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...passages.uses.keys()], false)[0];
    if (hit && hit.distance <= 2.8 * metre)
      passages.uses.get(hit.object as Mesh)?.();
  };
  const walk = createFirstPerson({
    canvas,
    camera,
    metre,
    floorY,
    start: passages.arrival(
      new URLSearchParams(location.search).get('from'),
    ) ?? { x: 2, z: GEN1_RACK_Z + 3.8 * metre, yaw: 0, pitch: 0.05 },
    solids: () => [...solids, ...passages.solids()],
    use: useAt,
    reducedMotion: () => reducedMotion.matches,
  });

  const notes = document.createElement('div');
  notes.innerHTML =
    '<strong>Room dev3</strong> · not part of the game · the first-generation VX3 has moved to the museum; the northern archive cordon remains<br>' +
    'Click: mouse look · WASD: walk · Shift: run · C: crouch · wheel: zoom · Esc: cursor · <kbd>P</kbd> toggles PS1 resolution<br>' +
    'Door to dev2: west, south of the archive cordon · <a href="/?room=dev0">developer room</a> · <a href="/?room=dev1">effects room</a> · <a href="/">lab</a>';
  Object.assign(notes.style, {
    position: 'absolute',
    left: '12px',
    top: '12px',
    padding: '8px 10px',
    background: 'rgba(14,12,9,0.78)',
    color: '#e9e1c8',
    font: '13px/1.45 "Courier New", monospace',
    maxWidth: 'calc(100% - 24px)',
  });
  for (const link of notes.querySelectorAll('a')) link.style.color = '#ffb43a';
  canvas.parentElement?.append(notes);

  // The PS1 resolution, on P; the realistic style starts without it.
  let ps1 = !realistic;
  const resize = () => {
    const { width: w, height: h } = canvas.getBoundingClientRect();
    if (!w || !h) return;
    const scale = ps1 ? renderScale(w, h, true) : 1;
    const rw = Math.max(1, Math.round(w * scale));
    const rh = Math.max(1, Math.round(h * scale));
    renderer.setSize(rw, rh, false);
    ps1Uniforms.resolution.value.set(rw, rh);
    ps1Uniforms.snapStrength.value = ps1 ? 0.35 : 0;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const onKey = (event: KeyboardEvent) => {
    if (canvas.parentElement?.hidden) return;
    if (event.key === 'p' || event.key === 'P') {
      ps1 = !ps1;
      resize();
    }
  };
  window.addEventListener('keydown', onKey);
  if (import.meta.env.DEV)
    Object.assign(window, {
      vx3Dev3: {
        /** Stand with the eye at (x, y, z) metres from the rack's foot, looking at (tx, ty, tz). */
        view(
          x: number,
          y: number,
          z: number,
          tx: number,
          ty: number,
          tz: number,
        ) {
          const dx = tx - x;
          const dz = tz - z;
          walk.place(
            x * metre,
            GEN1_RACK_Z + z * metre,
            Math.atan2(dx, -dz),
            Math.atan2(ty - y, Math.hypot(dx, dz)),
            floorY + y * metre,
          );
        },
      },
    });

  let last = 0;
  renderer.setAnimationLoop((time) => {
    if (canvas.parentElement?.hidden) {
      last = 0;
      return;
    }
    const seconds = time / 1000;
    const delta = Math.min(0.1, last ? seconds - last : 0);
    last = seconds;
    ps1Uniforms.time.value = seconds;
    walk.update(delta);
    passages.update(delta, walk.walker.x, walk.walker.z);
    renderer.render(scene, camera);
  });

  const dispose = () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    window.removeEventListener('keydown', onKey);
    walk.dispose();
    passages.dispose();
    notes.remove();
    scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const item of materials) item.dispose();
    for (const item of textures) item.dispose();
    freeEnvironment();
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
