import { devDoors, devWallPieces } from '../game/dev-room-links';
import { createDevDoorways } from '../scene/dev-doorways';
import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  TorusKnotGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type {
  BufferGeometry,
  Material,
  MeshStandardMaterial,
  Object3D,
  Texture,
} from 'three';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { RACK_METRE } from '../game/rack-layout';
import type { Footprint } from '../game/walk-collision';
import {
  effectFrame,
  settingsForActivity,
  withBypass,
} from '../game/effect-settings';
import type { EffectName, EffectSettings } from '../game/effect-settings';
import { createCanvasTexture } from '../scene/screens';
import { createFirstPerson } from './first-person';
import { createPs1Material, ps1Uniforms } from './ps1-material';
import { createChromaticDivergence } from './chromatic-divergence';
import { createEffectsConsole } from './effects-console';
import { createExhibitPanel } from './exhibit-panel';
import type { ExhibitTexture } from './exhibit-panel';
import type { ConsoleDial } from './effects-console';
import { createPanelKit, disposeKit } from '../scene/eighties-controls';
import { knobDirection } from '../scene/rotary-knob';

/**
 * The effects room, `/?room=dev1`: not part of the game. A bare 10 m square
 * room ruled in metres, furnished with the usual test objects, for trying
 * out the effects that show the rig's end states. The console at the south
 * end turns every dial on each effect by hand; its presets load what the lab
 * does at a given ferrocore activity. Built at the lab's own scale, so the
 * warp looks here exactly as it does there.
 */
export function startEffectsRoom(canvas: HTMLCanvasElement) {
  const m = RACK_METRE;
  const ROOM = 10;
  const HEIGHT = 3;
  const half = (ROOM / 2) * m;

  const renderer = new WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setClearColor('#16181a');
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, 1, 0.05, 40 * m);
  scene.add(new AmbientLight('#fff4e2', 1.5));
  const key = new DirectionalLight('#fff0d0', 2);
  key.position.set(-2, 5, 3);
  scene.add(key);
  const fill = new DirectionalLight('#a8bccc', 0.7);
  fill.position.set(3, 2, -4);
  scene.add(fill);

  const materials: Material[] = [];
  const textures: Texture[] = [];
  const room = new Group();
  scene.add(room);
  const material = (
    ...args: Parameters<typeof createPs1Material>
  ): ReturnType<typeof createPs1Material> => {
    const made = createPs1Material(...args);
    materials.push(made);
    return made;
  };
  const add = (
    geometry: BufferGeometry,
    surface: Material,
    x: number,
    y: number,
    z: number,
    parent: Object3D = room,
  ) => {
    const mesh = new Mesh(geometry, surface);
    mesh.position.set(x * m, y * m, z * m);
    parent.add(mesh);
    return mesh;
  };
  const solids: Footprint[] = [];
  const solid = (x: number, z: number, w: number, d: number) =>
    solids.push({
      minX: (x - w / 2) * m,
      maxX: (x + w / 2) * m,
      minZ: (z - d / 2) * m,
      maxZ: (z + d / 2) * m,
    });

  // ---- The room: grid walls, floor and ceiling ---------------------------
  // One canvas cell is a metre: a dark border, quarter-metre rules and a
  // brighter half-metre cross, so any bend in space shows at once.
  const grid = (
    paper: string,
    minor: string,
    major: string,
    repeat: number[],
  ) => {
    const { context, texture } = createCanvasTexture(128, 128);
    context.fillStyle = paper;
    context.fillRect(0, 0, 128, 128);
    context.fillStyle = minor;
    for (const at of [32, 96]) {
      context.fillRect(at, 0, 1, 128);
      context.fillRect(0, at, 128, 1);
    }
    context.fillRect(64, 0, 2, 128);
    context.fillRect(0, 64, 128, 2);
    context.fillStyle = major;
    context.fillRect(0, 0, 128, 3);
    context.fillRect(0, 0, 3, 128);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.needsUpdate = true;
    textures.push(texture);
    return texture;
  };
  const wallGrid = grid('#c9c8c0', '#9a9990', '#3c3d3a', [ROOM, HEIGHT]);
  const floorGrid = grid('#5b5e5a', '#4b4e4a', '#2a2c2a', [ROOM, ROOM]);
  const ceilingGrid = grid('#8c8d88', '#777872', '#4a4b47', [ROOM, ROOM]);
  const wallSurface = material({ map: wallGrid });
  const floor = add(
    new PlaneGeometry(ROOM * m, ROOM * m, 10, 10),
    material({ map: floorGrid }),
    0,
    0,
    0,
  );
  floor.rotation.x = -Math.PI / 2;
  const ceiling = add(
    new PlaneGeometry(ROOM * m, ROOM * m, 10, 10),
    material({ map: ceilingGrid }),
    0,
    HEIGHT,
    0,
  );
  ceiling.rotation.x = Math.PI / 2;
  // Subdivided masonry with genuine openings in the east and west walls.
  const bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };
  const doors = devDoors('dev1', bounds, m);
  const wallPieces = devWallPieces(bounds, doors, m, HEIGHT * m);
  const walls: Mesh[] = [];
  for (const piece of wallPieces) {
    const wall = new Mesh(
      new BoxGeometry(
        piece.maxX - piece.minX,
        piece.top - piece.bottom,
        piece.maxZ - piece.minZ,
        20,
        6,
        1,
      ),
      wallSurface,
    );
    wall.position.set(
      (piece.minX + piece.maxX) / 2,
      (piece.bottom + piece.top) / 2,
      (piece.minZ + piece.maxZ) / 2,
    );
    room.add(wall);
    walls.push(wall);
    if (piece.bottom === 0) solids.push(piece);
  }
  const passages = createDevDoorways('dev1', doors, 0, m);
  scene.add(passages.group);

  // A printed card on a wall: canvas art, unlit, facing into the room.
  const card = (
    width: number,
    height: number,
    draw: (c: CanvasRenderingContext2D, w: number, h: number) => void,
    pixels = 256,
  ) => {
    const w = pixels;
    const h = Math.round((pixels * height) / width);
    const made = createCanvasTexture(w, h);
    draw(made.context, w, h);
    made.texture.needsUpdate = true;
    textures.push(made.texture);
    const mesh = new Mesh(
      new PlaneGeometry(width * m, height * m, 4, 2),
      material({ map: made.texture }, true),
    );
    room.add(mesh);
    return { mesh, ...made };
  };
  const sign = card(
    3.2,
    0.32,
    (c, w, h) => {
      c.fillStyle = '#20302b';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#e8e2cc';
      c.font = 'bold 13px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('EFFECTS ROOM · DEV1 · NOT PART OF THE GAME', w / 2, h / 2);
    },
    512,
  );
  sign.mesh.position.set(0, 2.6 * m, -half + 0.01 * m);

  // ---- Colour targets for the channel phaser ------------------------------
  // SMPTE-style bars over a grey ramp, and a colour checker beside them.
  const bars = card(2.4, 1.4, (c, w, h) => {
    const top = [
      '#c0c0c0',
      '#c0c000',
      '#00c0c0',
      '#00c000',
      '#c000c0',
      '#c00000',
      '#0000c0',
    ];
    const bw = w / top.length;
    top.forEach((colour, i) => {
      c.fillStyle = colour;
      c.fillRect(i * bw, 0, bw + 1, h * 0.68);
    });
    for (let i = 0; i < 16; i++) {
      const v = Math.round((i / 15) * 255);
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.fillRect((i * w) / 16, h * 0.68, w / 16 + 1, h * 0.32);
    }
  });
  bars.mesh.position.set(-1.6 * m, 1.4 * m, -half + 0.01 * m);
  const checker = card(1.5, 1, (c, w, h) => {
    const patches = [
      '#735244',
      '#c29682',
      '#627a9d',
      '#576c43',
      '#8580b1',
      '#67bdaa',
      '#d67e2c',
      '#505ba6',
      '#c15a63',
      '#5e3c6c',
      '#9dbc40',
      '#e0a32e',
      '#383d96',
      '#469449',
      '#af363c',
      '#e7c71f',
      '#bb5695',
      '#0885a1',
      '#f3f3f2',
      '#c8c8c8',
      '#a0a0a0',
      '#7a7a79',
      '#555555',
      '#343434',
    ];
    c.fillStyle = '#111';
    c.fillRect(0, 0, w, h);
    const pw = w / 6;
    const ph = h / 4;
    patches.forEach((colour, i) => {
      c.fillStyle = colour;
      c.fillRect((i % 6) * pw + 3, Math.floor(i / 6) * ph + 3, pw - 6, ph - 6);
    });
  });
  checker.mesh.position.set(1.4 * m, 1.4 * m, -half + 0.01 * m);

  // ---- π instruments ------------------------------------------------------
  // Each one draws its angles from the room's π, as the lab's clock and
  // dials do, so a wrong π shows as a clock that misreads, a needle that
  // overshoots and a ring that will not close.
  const piCard = card(1.4, 0.36, () => {}, 256);
  piCard.mesh.position.set(half - 0.01 * m, 2.35 * m, -1.2 * m);
  piCard.mesh.rotation.y = -Math.PI / 2;
  let piShown = '';
  const showPi = (pi: number) => {
    const text = pi.toFixed(5);
    if (text === piShown) return;
    piShown = text;
    const { context: c, canvas: art, texture } = piCard;
    c.fillStyle = '#1b1d1c';
    c.fillRect(0, 0, art.width, art.height);
    c.fillStyle = Math.abs(pi - Math.PI) > 5e-6 ? '#ffb43a' : '#9fe0a0';
    c.font = 'bold 30px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`π = ${text}`, art.width / 2, art.height / 2);
    texture.needsUpdate = true;
  };

  // The wall clock, on the east wall.
  const clock = new Group();
  clock.position.set(half - 0.03 * m, 1.7 * m, -1.2 * m);
  clock.rotation.y = -Math.PI / 2;
  room.add(clock);
  const clockFace = createCanvasTexture(128, 128);
  {
    const c = clockFace.context;
    c.fillStyle = '#f1ede0';
    c.beginPath();
    c.arc(64, 64, 63, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a1a18';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const long = i % 5 === 0;
      c.save();
      c.translate(64, 64);
      c.rotate(a);
      c.fillRect(long ? -2 : -1, -60, long ? 4 : 2, long ? 10 : 5);
      c.restore();
    }
    clockFace.texture.needsUpdate = true;
    textures.push(clockFace.texture);
  }
  add(
    new CylinderGeometry(0.33 * m, 0.33 * m, 0.05 * m, 24),
    material({ color: '#2b2b2b' }),
    0,
    0,
    -0.02,
    clock,
  ).rotation.x = Math.PI / 2;
  add(
    new CircleGeometry(0.3 * m, 24),
    material({ map: clockFace.texture }, true),
    0,
    0,
    0.006,
    clock,
  );
  const hand = (length: number, width: number, colour: string, z: number) => {
    const pivot = new Group();
    pivot.position.z = z * m;
    clock.add(pivot);
    add(
      new BoxGeometry(width * m, length * m, 0.006 * m),
      material({ color: colour }),
      0,
      length / 2 - 0.03,
      0,
      pivot,
    );
    return pivot;
  };
  const hourHand = hand(0.17, 0.022, '#1a1a18', 0.012);
  const minuteHand = hand(0.25, 0.014, '#1a1a18', 0.02);
  const secondHand = hand(0.27, 0.005, '#b8241c', 0.028);

  // A needle gauge below it, swinging slowly through its range.
  const gauge = new Group();
  gauge.position.set(half - 0.03 * m, 1.0 * m, -1.2 * m);
  gauge.rotation.y = -Math.PI / 2;
  room.add(gauge);
  const gaugeFace = createCanvasTexture(128, 128);
  {
    const c = gaugeFace.context;
    c.fillStyle = '#ece7d6';
    c.beginPath();
    c.arc(64, 64, 63, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#1a1a18';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(64, 64, 52, Math.PI * 0.75, Math.PI * 2.25);
    c.stroke();
    c.strokeStyle = '#b8241c';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(64, 64, 50, Math.PI * 1.95, Math.PI * 2.25);
    c.stroke();
    c.fillStyle = '#1a1a18';
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5 + Math.PI / 2;
      c.save();
      c.translate(64, 64);
      c.rotate(a);
      c.fillRect(-1.5, -56, 3, 10);
      c.restore();
    }
    gaugeFace.texture.needsUpdate = true;
    textures.push(gaugeFace.texture);
  }
  add(
    new CylinderGeometry(0.22 * m, 0.22 * m, 0.06 * m, 20),
    material({ color: '#3a3d3a' }),
    0,
    0,
    -0.02,
    gauge,
  ).rotation.x = Math.PI / 2;
  add(
    new CircleGeometry(0.2 * m, 20),
    material({ map: gaugeFace.texture }, true),
    0,
    0,
    0.012,
    gauge,
  );
  const needle = hand(0.17, 0.008, '#b8241c', 0.02);
  gauge.add(needle);

  // The π ring: twenty-four blocks set round a circle in steps of 2π/24
  // with the room's π. With the true π the ring closes exactly; with any
  // other it leaves a gap or the last block rides over the first.
  const RING_BLOCKS = 24;
  const ringRadius = 0.7;
  const ring = new Group();
  ring.position.set(2.6 * m, 0.8 * m, -1.2 * m);
  room.add(ring);
  add(
    new CylinderGeometry(0.95 * m, 1.0 * m, 0.8 * m, 16),
    material({ color: '#4a4c49' }),
    2.6,
    0.4,
    -1.2,
  );
  solid(2.6, -1.2, 2, 2);
  const blockLength = (2 * Math.PI * ringRadius) / RING_BLOCKS;
  const ringBlocks = Array.from({ length: RING_BLOCKS }, (_, i) =>
    add(
      new BoxGeometry(blockLength * 0.96 * m, 0.08 * m, 0.1 * m),
      material({
        color:
          i === 0 ? '#e5a640' : i === RING_BLOCKS - 1 ? '#3d7dff' : '#d8d6cc',
      }),
      0,
      0.04,
      0,
      ring,
    ),
  );
  const placeRing = (pi: number) => {
    ringBlocks.forEach((block, i) => {
      const a = ((i + 0.5) * 2 * pi) / RING_BLOCKS;
      block.position.set(
        Math.sin(a) * ringRadius * m,
        0.04 * m,
        Math.cos(a) * ringRadius * m,
      );
      block.rotation.y = a + Math.PI / 2;
    });
  };

  const trueToPi: Object3D[] = [];
  /** Hold these effects off everything under `root`. */
  const exempt = (root: Object3D, effects: string[]) =>
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const item of [object.material].flat() as Material[])
        for (const effect of effects) {
          const share = item.userData[effect] as { value: number } | undefined;
          if (share) share.value = 0;
        }
    });

  // ---- Test objects, each on a plinth -------------------------------------
  // Plinths keep the true π, so the panels on them stay put.
  const plinth = (x: number, z: number, h = 0.8, w = 0.6) => {
    trueToPi.push(
      add(
        new BoxGeometry(w * m, h * m, w * m),
        material({ color: '#4a4c49' }),
        x,
        h / 2,
        z,
      ),
    );
    solid(x, z, w, w);
    return h;
  };
  const spinners: Object3D[] = [];
  // Each exhibit gets its own panel of looks; see createExhibitPanel.
  const NAMES = ['TEAPOT', 'POLYGON', 'TORUS KNOT', 'SPHERE', 'CUBE'];
  const exhibits: {
    name: string;
    surfaces: MeshStandardMaterial[];
    x: number;
    z: number;
    /** Where smoke and embers rise from, metres. */
    top: number;
    /** The panel's centre on the plinth's south face. */
    panelY: number;
    panelZ: number;
  }[] = [];
  const exhibit = (
    geometry: BufferGeometry,
    colour: string | Material,
    x: number,
    z: number,
    lift: number,
  ) => {
    const top = plinth(x, z);
    const mesh = add(
      geometry,
      typeof colour === 'string' ? material({ color: colour }) : colour,
      x,
      top + lift,
      z,
    );
    spinners.push(mesh);
    exhibits.push({
      name: NAMES[exhibits.length],
      surfaces: [mesh.material as MeshStandardMaterial],
      x,
      z,
      top: top + lift * 2,
      panelY: top - 0.3,
      panelZ: z + 0.3,
    });
    return mesh;
  };
  // The teapot, of course.
  const teapot = exhibit(
    new TeapotGeometry(0.18 * m, 6),
    '#d9d4c6',
    -3,
    -1.5,
    0.14,
  );
  const teapotPrecision = (teapot.material as Material).userData
    .ps1Precision as { value: number };
  // A low polygon: a plain icosahedron, every face flat.
  exhibit(new IcosahedronGeometry(0.25 * m, 0), '#c0392b', -1.5, 1, 0.27);
  exhibit(
    new TorusKnotGeometry(0.17 * m, 0.05 * m, 64, 8),
    '#2e86c1',
    0,
    1,
    0.27,
  );
  exhibit(new SphereGeometry(0.25 * m, 16, 10), '#5fa052', 1.5, 1, 0.27);
  // Surfaces to try on the exhibits, and the cube's own checker.
  const pattern = (draw: (c: CanvasRenderingContext2D) => void) => {
    const { context, texture } = createCanvasTexture(64, 64);
    draw(context);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
    textures.push(texture);
    return texture;
  };
  const checkerboard = pattern((c) => {
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        c.fillStyle = (i + j) % 2 ? '#111' : '#eee';
        c.fillRect(i * 8, j * 8, 8, 8);
      }
  });
  const brick = pattern((c) => {
    c.fillStyle = '#c9c3b6';
    c.fillRect(0, 0, 64, 64);
    for (let row = 0; row < 8; row++)
      for (let col = -1; col < 4; col++) {
        const shade = 120 + ((row * 7 + col * 13) % 5) * 12;
        c.fillStyle = `rgb(${shade + 40},${shade * 0.55},${shade * 0.4})`;
        c.fillRect(col * 16 + (row % 2) * 8 + 1, row * 8 + 1, 14, 6);
      }
  });
  const rust = pattern((c) => {
    for (let i = 0; i < 64; i++)
      for (let j = 0; j < 64; j++) {
        const n =
          Math.sin(i * 0.37 + Math.sin(j * 0.21) * 3) * 0.5 +
          Math.sin(j * 0.53 + i * 0.11) * 0.5;
        const v = 0.55 + n * 0.35;
        c.fillStyle = `rgb(${Math.round(170 * v + 40)},${Math.round(90 * v)},${Math.round(40 * v)})`;
        c.fillRect(i, j, 1, 1);
      }
  });
  const noise = pattern((c) => {
    for (let i = 0; i < 64; i++)
      for (let j = 0; j < 64; j++) {
        const v = Math.floor(
          (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1 > 0
            ? ((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1) * 200 + 40
            : 120,
        );
        c.fillStyle = `rgb(${v},${v},${v})`;
        c.fillRect(i, j, 1, 1);
      }
  });
  const looks: ExhibitTexture[] = [
    { name: 'OWN', map: null },
    { name: 'CHK', map: checkerboard },
    { name: 'BRK', map: brick },
    { name: 'RST', map: rust },
    { name: 'NSE', map: noise },
  ];
  // A cube in a black-and-white checker, for straight edges.
  exhibit(
    new BoxGeometry(0.4 * m, 0.4 * m, 0.4 * m, 4, 4, 4),
    material({ map: checkerboard }),
    -3,
    1,
    0.22,
  );
  // A plain chair, on the floor.
  const chairPlume = new Vector3();
  {
    const chair = new Group();
    chair.position.set(-1.5 * m, 0, -2.6 * m);
    chair.rotation.y = 0.5;
    room.add(chair);
    const wood = material({ color: '#8a5a32' });
    add(new BoxGeometry(0.45 * m, 0.04 * m, 0.45 * m), wood, 0, 0.45, 0, chair);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        add(
          new BoxGeometry(0.04 * m, 0.45 * m, 0.04 * m),
          wood,
          sx * 0.2,
          0.225,
          sz * 0.2,
          chair,
        );
        if (sz < 0)
          add(
            new BoxGeometry(0.04 * m, 0.5 * m, 0.04 * m),
            wood,
            sx * 0.2,
            0.72,
            -0.2,
            chair,
          );
      }
    add(
      new BoxGeometry(0.44 * m, 0.16 * m, 0.03 * m),
      wood,
      0,
      0.86,
      -0.2,
      chair,
    );
    solid(-1.5, -2.6, 0.6, 0.6);
    // The chair stands on the floor, so its panel has a pedestal beside it.
    trueToPi.push(
      add(
        new BoxGeometry(0.55 * m, 0.7 * m, 0.2 * m),
        material({ color: '#4a4c49' }),
        -0.75,
        0.35,
        -2.6,
      ),
    );
    solid(-0.75, -2.6, 0.55, 0.2);
    exhibits.push({
      name: 'CHAIR',
      surfaces: [wood as MeshStandardMaterial],
      // The panel is on the pedestal; the smoke rises from the seat.
      x: -0.75,
      z: -2.6,
      top: 0.95,
      panelY: 0.5,
      panelZ: -2.6 + 0.1,
    });
    chairPlume.set(-1.5, 0.47, -2.6);
  }
  // A row of posts down the room's west side: a straight line to bend.
  for (let i = 0; i < 7; i++) {
    const z = -3 + i;
    add(
      new BoxGeometry(0.08 * m, 2.2 * m, 0.08 * m, 1, 8, 1),
      material({ color: i % 2 ? '#e0e0d8' : '#b8241c' }),
      -4.2,
      1.1,
      z,
    );
    solid(-4.2, z, 0.08, 0.08);
  }

  // ---- The effects console ------------------------------------------------
  // A sloping desk at the south end of the room, facing north, so the
  // operator works it and looks up over it at the effects.
  let settings: EffectSettings = settingsForActivity(0);
  let frozen = false;
  let effectSeconds = 0;
  let speed = 1;
  let activity = 0;
  let teapotHolds = false;
  let latest = effectFrame(settings, 0);
  const preset = (level: number) => {
    activity = level;
    settings = settingsForActivity(level);
  };
  const dial = (
    name: string,
    min: number,
    max: number,
    get: () => number,
    set: (value: number) => void,
    digits = 2,
  ): ConsoleDial => ({ name, min, max, get, set, digits });
  const w = () => settings.warp;
  const ph = () => settings.phaser;
  const dv = () => settings.divergence;
  const pr = () => settings.precision;
  // Bypassed effects are off whatever their knobs say.
  const bypassed = new Set<EffectName>();
  const bypass = (name: EffectName) => ({
    on: () => bypassed.has(name),
    toggle: () => {
      if (!bypassed.delete(name)) bypassed.add(name);
    },
  });
  const kit = createPanelKit();
  const desk = createEffectsConsole(
    kit,
    [
      {
        title: 'MASTER',
        dials: [
          dial('LAB ACT', 0, 1, () => activity, preset),
          dial(
            'TIME ×',
            0,
            4,
            () => speed,
            (v) => (speed = v),
          ),
        ],
        buttons: [
          { legend: 'OFF', colour: 'grey', press: () => preset(0) },
          { legend: 'ACTIVE', colour: 'amber', press: () => preset(0.4) },
          { legend: 'STRONG', colour: 'red', press: () => preset(1) },
          {
            legend: 'FREEZE',
            colour: 'blue',
            lit: () => frozen,
            press: () => (frozen = !frozen),
          },
        ],
      },
      {
        title: 'WARP',
        bypass: bypass('warp'),
        dials: [
          dial(
            'AMOUNT',
            0,
            3,
            () => w().amount,
            (v) => (w().amount = v),
          ),
          dial(
            'TWIST',
            0,
            1,
            () => w().twist,
            (v) => (w().twist = v),
            3,
          ),
          dial(
            'TW FREQ',
            0,
            1.5,
            () => w().twistFrequency,
            (v) => (w().twistFrequency = v),
          ),
          dial(
            'TW SPEED',
            -3,
            3,
            () => w().twistSpeed,
            (v) => (w().twistSpeed = v),
          ),
          dial(
            'SWELL',
            0,
            0.4,
            () => w().swell,
            (v) => (w().swell = v),
            3,
          ),
          dial(
            'SW FREQ',
            0,
            1.5,
            () => w().swellFrequency,
            (v) => (w().swellFrequency = v),
          ),
          dial(
            'SW SPEED',
            -3,
            3,
            () => w().swellSpeed,
            (v) => (w().swellSpeed = v),
          ),
        ],
      },
      {
        title: 'FIELD',
        bypass: bypass('field'),
        dials: [
          dial(
            'CENTRE X',
            -5,
            5,
            () => w().centreX,
            (v) => (w().centreX = v),
          ),
          dial(
            'CENTRE Z',
            -5,
            5,
            () => w().centreZ,
            (v) => (w().centreZ = v),
          ),
          dial(
            'REACH M',
            0,
            8,
            () => w().radius,
            (v) => (w().radius = v),
          ),
        ],
      },
      {
        title: 'PRECISION',
        bypass: bypass('precision'),
        dials: [
          dial(
            'GRID M',
            // A fine scale: even a few millimetres is plenty of jitter.
            0,
            0.05,
            () => pr().grid,
            (v) => (pr().grid = v),
            4,
          ),
          dial(
            'TREMBLE',
            0,
            1,
            () => pr().tremble,
            (v) => (pr().tremble = v),
          ),
          dial(
            'FLICKER',
            0,
            30,
            () => pr().flickerHz,
            (v) => (pr().flickerHz = v),
            1,
          ),
        ],
        buttons: [
          {
            legend: 'POT OK',
            colour: 'green',
            lit: () => teapotHolds,
            press: () => (teapotHolds = !teapotHolds),
          },
        ],
      },
      {
        title: 'PI',
        bypass: bypass('pi'),
        dials: [
          dial(
            'OFFSET',
            -0.5,
            0.5,
            () => settings.pi.offset,
            (v) => (settings.pi.offset = v),
            3,
          ),
          dial(
            'WANDER',
            0,
            4,
            () => settings.pi.wander,
            (v) => (settings.pi.wander = v),
          ),
        ],
      },
      {
        title: 'PHASER',
        bypass: bypass('phaser'),
        dials: [
          dial(
            'DEPTH',
            0,
            1,
            () => ph().depth,
            (v) => (ph().depth = v),
          ),
          dial(
            'RED HZ',
            0,
            3,
            () => ph().hz[0],
            (v) => (ph().hz[0] = v),
          ),
          dial(
            'GRN HZ',
            0,
            3,
            () => ph().hz[1],
            (v) => (ph().hz[1] = v),
          ),
          dial(
            'BLU HZ',
            0,
            3,
            () => ph().hz[2],
            (v) => (ph().hz[2] = v),
          ),
          dial(
            'SPREAD',
            0,
            Math.PI * 2,
            () => ph().spread,
            (v) => (ph().spread = v),
          ),
        ],
      },
      {
        title: 'DIVERGE',
        bypass: bypass('divergence'),
        dials: [
          dial(
            'HORIZ PX',
            0,
            12,
            () => dv().horizontalPx,
            (v) => (dv().horizontalPx = v),
            1,
          ),
          dial(
            'HORIZ HZ',
            0,
            2,
            () => dv().horizontalHz,
            (v) => (dv().horizontalHz = v),
          ),
          dial(
            'VERT PX',
            0,
            12,
            () => dv().verticalPx,
            (v) => (dv().verticalPx = v),
            1,
          ),
          dial(
            'VERT HZ',
            0,
            2,
            () => dv().verticalHz,
            (v) => (dv().verticalHz = v),
          ),
          dial(
            'PARALLAX',
            0,
            12,
            () => dv().parallax,
            (v) => (dv().parallax = v),
            1,
          ),
        ],
      },
    ],
    () => [
      `R${latest.channels[0].toFixed(2)} G${latest.channels[1].toFixed(2)} B${latest.channels[2].toFixed(2)} PI${latest.pi.toFixed(3)}`,
    ],
  );
  // The desk: a sloping top on a plain stand, scaled up for easy reading.
  const DESK_SCALE = 1.9;
  const deskTilt = 1.15;
  const station = new Group();
  station.position.set(0, 0, 3.0 * m);
  room.add(station);
  const deskW = desk.width * DESK_SCALE;
  const deskH = desk.height * DESK_SCALE;
  const deskTop = 0.95;
  const top = new Group();
  top.position.set(0, deskTop * m, 0);
  top.rotation.x = -deskTilt;
  station.add(top);
  desk.group.scale.setScalar(DESK_SCALE * m);
  top.add(desk.group);
  // Under the sloping top: a cabinet up to its front edge, and a back
  // panel up to its rear edge, so it reads as one desk from any side.
  const body = material({ color: '#3d4a45' });
  const depth = deskH * Math.sin(deskTilt);
  const front = deskTop - (deskH / 2) * Math.cos(deskTilt);
  const back = deskTop + (deskH / 2) * Math.cos(deskTilt);
  add(
    new BoxGeometry(deskW * m, front * m, depth * m),
    body,
    0,
    front / 2 - 0.01,
    0,
    station,
  );
  add(
    new BoxGeometry(deskW * m, back * m, 0.03 * m),
    body,
    0,
    back / 2 - 0.01,
    -depth / 2 - 0.016,
    station,
  );
  // The console is a tool, not an exhibit: the geometry effects leave it
  // whole, so it can still be worked with space falling apart round it.
  exempt(station, ['ps1Precision', 'ps1Warp', 'ps1Pi']);
  solid(0, 3.0, deskW, depth + 0.06);

  // The warp's centre, when it has one: a small glowing beacon on the floor.
  const beacon = add(
    new CylinderGeometry(0.05 * m, 0.12 * m, 0.04 * m, 12),
    material({ color: '#7fc0ff' }, true, true),
    0,
    0.02,
    0,
  );

  // Flat things (cards, dial faces) are round about their own normal, so
  // a wrong π twists them in their plane instead of folding them. The
  // room's own shell keeps the true π, so there is still a room.
  room.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const flat = ['PlaneGeometry', 'CircleGeometry'].includes(
      object.geometry.type,
    );
    for (const item of [object.material].flat() as Material[]) {
      const axis = item.userData.ps1PiAxis as { value: Vector3 } | undefined;
      if (flat) axis?.value.set(0, 0, 1);
    }
  });
  // The π readout stays legible, so it can say what π is.
  for (const part of [floor, ceiling, ...walls, ...trueToPi, piCard.mesh])
    exempt(part, ['ps1Pi']);

  // Every exhibit's own panel: glow, texture, reflection, smoke and embers.
  // Reflections show the room itself, caught once from its middle.
  const pmrem = new PMREMGenerator(renderer);
  const reflections = pmrem.fromScene(scene, 0, 0.05, 40 * m, {
    position: new Vector3(0, 1.4 * m, 0),
  }).texture;
  pmrem.dispose();
  const panels = exhibits.map((exhibit) => {
    const plume = new Group();
    if (exhibit.name === 'CHAIR')
      plume.position.copy(chairPlume).multiplyScalar(m);
    else plume.position.set(exhibit.x * m, exhibit.top * m, exhibit.z * m);
    plume.scale.setScalar(6);
    room.add(plume);
    const made = createExhibitPanel(
      kit,
      exhibit.name,
      exhibit.surfaces,
      plume,
      {
        textures: looks,
        reflections,
      },
    );
    made.group.position.set(
      exhibit.x * m,
      exhibit.panelY * m,
      (exhibit.panelZ + 0.002) * m,
    );
    made.group.scale.setScalar(m);
    room.add(made.group);
    exempt(made.group, ['ps1Precision', 'ps1Warp', 'ps1Pi']);
    return made;
  });
  const controls = new Map([
    ...desk.uses,
    ...passages.uses,
    ...panels.flatMap((panel) => [...panel.uses]),
  ]);

  const notes = document.createElement('div');
  notes.innerHTML =
    '<strong>Effects room</strong> · not part of the game · the console is in front of you<br>' +
    'Click: mouse look · WASD: walk · Shift: run · C: crouch · wheel: zoom · Esc: cursor<br>' +
    'Click a knob’s left or right half to turn it down or up<br>' +
    'Doors: dev west · dev2 east · <kbd>P</kbd> toggles PS1 resolution · <a href="/?room=dev">developer room</a> · <a href="/">lab</a>';
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
  canvas.parentElement?.appendChild(notes);

  // Working the console under the crosshair.
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const usableAt = (x: number, y: number) => {
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...controls.keys()], true)[0];
    for (let o: Object3D | null = hit?.object ?? null; o; o = o.parent) {
      const use = controls.get(o);
      if (passages.uses.has(o as Mesh) && hit && hit.distance > 2.8 * m)
        return undefined;
      if (use && hit) return { object: o, use, point: hit.point };
    }
    return undefined;
  };
  const useAt = (x: number, y: number) => {
    const found = usableAt(x, y);
    found?.use(knobDirection(found.object, found.point, camera));
  };

  // ---- Running ------------------------------------------------------------
  let ps1 = true;
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const scale = ps1 ? Math.min(640 / width, 480 / height, 1) : 1;
    const rw = Math.max(1, Math.round(width * scale));
    const rh = Math.max(1, Math.round(height * scale));
    renderer.setSize(rw, rh, false);
    ps1Uniforms.resolution.value.set(rw, rh);
    ps1Uniforms.snapStrength.value = ps1 ? 0.35 : 0;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const divergence = createChromaticDivergence(renderer, m);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const onKey = (event: KeyboardEvent) => {
    if (canvas.parentElement?.hidden) return;
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'p' || event.key === 'P') {
      ps1 = !ps1;
      resize();
    }
  };
  window.addEventListener('keydown', onKey);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const walk = createFirstPerson({
    canvas,
    camera,
    metre: m,
    floorY: 0,
    start: passages.arrival(
      new URLSearchParams(location.search).get('from'),
    ) ?? { x: 0, z: 4.3 * m, yaw: 0, pitch: -0.25 },
    solids: () => [...solids, ...passages.solids()],
    use: useAt,
    aimed: () => Boolean(usableAt(0, 0)),
    reducedMotion: () => reducedMotion.matches,
  });

  (window as unknown as { vx3Dev1: unknown }).vx3Dev1 = {
    /** Stand with the eye at (x, y, z) metres, looking at (tx, ty, tz). */
    view(x: number, y: number, z: number, tx: number, ty: number, tz: number) {
      const dx = tx - x;
      const dz = tz - z;
      walk.place(
        x * m,
        z * m,
        Math.atan2(dx, -dz),
        Math.atan2(ty - y, Math.hypot(dx, dz)),
        y * m,
      );
    },
    settings: () => settings,
    /** Each exhibit's panel controls, in order: GLOW, TEXTURE, REFLECT, SMOKE, EMBERS. */
    exhibitControls: (i: number) => [...panels[i].uses.values()],
    /** The effects whose BYPASS button is lit. */
    bypassed: () => bypassed,
    load(next: EffectSettings) {
      settings = next;
    },
    preset,
    /** Where each console control is, metres, for scripted clicks. */
    controls: () =>
      [...desk.uses.keys()].map((part) => {
        const at = part.getWorldPosition(new Vector3());
        return [at.x / m, at.y / m, at.z / m];
      }),
    /** Work the console as a click at a normalised screen point would. */
    use: useAt,
    teapotHolds(value: boolean) {
      teapotHolds = value;
    },
    setTime(seconds: number) {
      effectSeconds = seconds;
    },
    freeze(value: boolean) {
      frozen = value;
    },
    setPs1(value: boolean) {
      ps1 = value;
      resize();
    },
  };

  let last = 0;
  renderer.setAnimationLoop((time) => {
    if (canvas.parentElement?.hidden) {
      last = 0;
      return;
    }
    const seconds = time / 1000;
    const delta = Math.min(0.1, last ? seconds - last : 0);
    last = seconds;
    if (!frozen) effectSeconds += delta * speed;
    const frame = effectFrame(withBypass(settings, bypassed), effectSeconds);
    latest = frame;
    ps1Uniforms.time.value = effectSeconds;
    ps1Uniforms.channels.value.set(...frame.channels);
    ps1Uniforms.warp.value = frame.warp;
    ps1Uniforms.warpTwist.value.set(...frame.twist);
    ps1Uniforms.warpSwell.value.set(...frame.swell);
    // Settings are in metres; the shader works in scene units.
    const [cx, cz, reach] = frame.field;
    ps1Uniforms.warpField.value.set(cx * m, 0, cz * m, reach * m);
    beacon.visible = reach > 0;
    beacon.position.set(cx * m, 0.02 * m, cz * m);
    const [grid, tremble, flicker] = frame.precision;
    ps1Uniforms.precision.value.set(grid * m, tremble, flicker);
    teapotPrecision.value = teapotHolds ? 0 : 1;
    // The π instruments, read the way the lab reads its own.
    const pi = frame.pi;
    ps1Uniforms.pi.value = pi;
    showPi(pi);
    placeRing(pi);
    const now = new Date();
    hourHand.rotation.z =
      (-((now.getHours() % 12) + now.getMinutes() / 60) * pi) / 6;
    minuteHand.rotation.z =
      (-(now.getMinutes() + now.getSeconds() / 60) * pi) / 30;
    secondHand.rotation.z =
      (-(now.getSeconds() + now.getMilliseconds() / 1000) * pi) / 30;
    const reading = 0.5 + 0.5 * Math.sin(seconds * 0.4);
    needle.rotation.z = pi * (0.75 - reading * 1.5);
    for (const [i, spinner] of spinners.entries())
      spinner.rotation.y = reducedMotion.matches
        ? 0
        : seconds * (0.25 + i * 0.05);
    desk.update(delta);
    for (const panel of panels)
      panel.update(seconds, delta, reducedMotion.matches);
    walk.update(delta);
    passages.update(delta, walk.walker.x, walk.walker.z);
    if (divergence.active(frame.divergence))
      divergence.render(scene, camera, frame.divergence, effectSeconds);
    else renderer.render(scene, camera);
  });

  const dispose = () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    window.removeEventListener('keydown', onKey);
    walk.dispose();
    passages.dispose();
    notes.remove();
    divergence.dispose();
    ps1Uniforms.pi.value = Math.PI;
    for (const panel of panels) panel.dispose();
    reflections.dispose();
    disposeKit(kit, desk.group);
    scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const item of materials) item.dispose();
    for (const item of textures) item.dispose();
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
