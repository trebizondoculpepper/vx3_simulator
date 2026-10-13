import { coreProjection } from '../game/core-projection';
import { createPrintedImageTexture } from './printed-image';
import type { CoreProjection } from '../game/core-projection';
import { designate } from '../game/machine-parts';
import { BoxGeometry, CircleGeometry, Group, Mesh, PlaneGeometry } from 'three';
import type { Material, Texture } from 'three';
import { annunciators, boardHandles } from '../game/control-board';
import { FERROCORE_MAX_ANGULAR_VELOCITY } from '../game/ferrocore-anomaly';
import { redlineFraction } from '../game/redlines';
import type { BoardView, gridChannels } from '../game/control-board';
import { createPs1Material } from '../rendering/ps1-material';
import {
  createCanvasTexture,
  createDialTexture,
  createLabelTexture,
} from './screens';

/** What the board shows each frame, worked out in src/game/control-board.ts. */
export interface BoardDisplay {
  view: BoardView;
  readings: Record<(typeof gridChannels)[number], number>;
  trimSet: number;
  trimIdeal: number;
  powerKw: number;
  energyKwh: number;
  delta: number;
  ferrocoreRadiansPerSecond: number;
  ferrocoreActivity: number;
  coreTemperature: number;
  coreFailed: boolean;
  seconds: number;
}

/** A 1974 process board with a mismatched 1986 instrumentation retrofit.
 * Dimensions are metres; the front faces local +z, with its origin at floor level.
 * In 1986 it was rewired as a remote station for the VX3: its handles work
 * the rack, and its lamps, meters and readouts repeat the rack's state.
 */
export function createEastControlPanel(worldUnitsPerMetre: number) {
  const group = new Group();
  group.name = 'EastControlPanel';
  group.scale.setScalar(worldUnitsPerMetre);
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const paints = new Map<string, Material>();
  const paint = (color: string, glow = false) => {
    const key = `${color}:${glow}`;
    let material = paints.get(key);
    if (!material) {
      material = createPs1Material({ color }, glow, glow);
      materials.push(material);
      paints.set(key, material);
    }
    return material;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    glow = false,
  ) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), paint(color, glow));
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const face = (
    texture: Texture,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    glow = false,
  ) => {
    const material = createPs1Material(
      {
        map: texture,
        polygonOffset: glow,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      },
      true,
      glow,
    );
    materials.push(material);
    const mesh = new Mesh(new PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const label = (
    text: string,
    w: number,
    x: number,
    y: number,
    z: number,
    ink = '#26352f',
    plate = '#d1cbb1',
    glow = false,
  ) => {
    const image = createLabelTexture(text, { ink, plate, size: 14 });
    textures.push(image.texture);
    return face(
      image.texture,
      w,
      (w * image.height) / image.width,
      x,
      y,
      z,
      glow,
    );
  };
  const gauge = (
    x: number,
    y: number,
    radius: number,
    angle: number,
    square = false,
    redline: number | null = null,
  ) => {
    const dial = createDialTexture(redline);
    textures.push(dial);
    const dialMaterial = createPs1Material({ map: dial }, true);
    materials.push(dialMaterial);
    const front = square ? 0.274 : 0.247;
    box(radius * 2.25, radius * 2.25, 0.025, '#242e2a', x, y, front - 0.016);
    const mesh = new Mesh(
      square
        ? new PlaneGeometry(radius * 1.95, radius * 1.95)
        : new CircleGeometry(radius, 16),
      dialMaterial,
    );
    mesh.position.set(x, y, front);
    group.add(mesh);
    const needle = box(
      0.006,
      radius * 0.82,
      0.003,
      '#35372d',
      x,
      y,
      front + 0.004,
    );
    needle.geometry.translate(0, radius * 0.36, 0);
    needle.rotation.z = angle;
    return needle;
  };
  // Lamps and tiles swap between a dark and a lit material.
  interface Lamp {
    mesh: Mesh;
    on: Material;
    off: Material;
  }
  const MACHINE = 'East board';
  const indicator = (mesh: Mesh, name: string) => {
    designate(mesh, { machine: MACHINE, name, role: 'indicator' });
    return mesh;
  };
  const light = (lamp: Lamp, lit: boolean) => {
    lamp.mesh.material = lit ? lamp.on : lamp.off;
  };
  const lamp = (x: number, y: number, color: string, z = 0.248): Lamp => {
    box(0.031, 0.031, 0.013, '#27312c', x, y, z);
    return {
      mesh: box(0.021, 0.021, 0.006, '#535847', x, y, z + 0.009),
      on: paint(color, true),
      off: paint('#535847'),
    };
  };
  const tiles: Lamp[] = [];
  const handles: Array<{ parts: Mesh[]; handle: Mesh }> = [];

  // Three 750 mm bays: a shallow cabinet and ledge, 400 mm total depth.
  box(2.25, 0.09, 0.33, '#28332d', 0, 0.045, 0.165);
  for (const [bay, x] of [-0.75, 0, 0.75].entries()) {
    const enamel = bay === 2 ? '#9b9e89' : '#8aab9c';
    box(0.742, 1.99, 0.22, '#43574d', x, 1.085, 0.11);
    box(0.722, 1.11, 0.012, enamel, x, 1.445, 0.226);
    box(0.72, 0.62, 0.015, '#465e52', x, 0.415, 0.23);
    box(0.014, 0.105, 0.021, '#b7b3a0', x + 0.27, 0.52, 0.25);
    for (let row = 0; row < 5; row++)
      box(0.18, 0.008, 0.004, '#273d32', x - 0.17, 0.22 + row * 0.022, 0.242);
    const ledge = box(0.735, 0.23, 0.028, '#81988a', x, 0.827, 0.296);
    ledge.rotation.x = -Math.PI / 3;
    box(0.735, 0.05, 0.025, '#3b4c42', x, 0.76, 0.388);
    label(
      ['KREISLAUF · 1974', 'KANALÜBERSICHT', 'MESSWERTE · 1986'][bay],
      0.55,
      x,
      1.92,
      0.239,
    );
    box(0.72, 0.14, 0.02, '#304139', x, 2.055, 0.227);
    for (let i = 0; i < 6; i++) {
      const ax = x - 0.293 + i * 0.117;
      const window = annunciators[bay * 6 + i];
      tiles.push({
        mesh: box(0.105, 0.09, 0.006, '#b5b09a', ax, 2.055, 0.24),
        on: paint(window.colour === 'red' ? '#d9765a' : '#e0c47a', true),
        off: paint('#b5b09a'),
      });
      label(window.label, 0.093, ax, 2.055, 0.245);
    }
    for (const sx of [-0.342, 0.342])
      for (const sy of [0.95, 1.84])
        box(0.011, 0.011, 0.005, '#bbc1aa', x + sx, sy, 0.24);
    for (let i = 0; i < 6; i++) {
      const cx = x - 0.28 + (i % 3) * 0.28;
      const cz = i < 3 ? 0.263 : 0.345;
      const cy = i < 3 ? 0.873 : 0.825;
      const base = box(0.06, 0.016, 0.044, '#27362d', cx, cy, cz);
      const handle = box(
        0.018,
        0.035,
        0.035,
        i === 4 ? '#904333' : '#1d2823',
        cx,
        cy + 0.022,
        cz,
      );
      for (const part of [base, handle])
        designate(part, {
          machine: MACHINE,
          name: `${boardHandles[bay * 6 + i].label} handle`,
          role: 'input',
        });
      handles.push({ parts: [base, handle], handle });
      // An engraved name plate on the sloping ledge, just in front.
      const lz = cz + 0.034;
      const text = boardHandles[bay * 6 + i].label;
      // Plates are as wide as their text, so every name has the same letter height.
      const name = label(
        text,
        0.00085 * Math.max(32, Math.ceil(text.length * 14 * 0.62) + 12),
        cx,
        0.841 - 0.577 * (lz - 0.303),
        lz,
        '#e4dfca',
        '#26302a',
      );
      name.rotation.x = -Math.PI / 3;
    }
    // Deterministic enamel chips and grime rather than random per-load wear.
    for (let i = 0; i < 12; i++)
      box(
        0.006 + (i % 3) * 0.005,
        0.004,
        0.002,
        '#5e6756',
        x - 0.32 + ((i * 37) % 64) / 100,
        0.965 + ((i * 19) % 80) / 100,
        0.234,
      );
  }

  // Printed process mimic on the original left-hand panel.
  const process = createCanvasTexture(256, 256);
  textures.push(process.texture);
  const ctx = process.context;
  ctx.fillStyle = '#8aab9c';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#345d76';
  ctx.lineWidth = 3;
  ctx.strokeRect(45, 36, 152, 160);
  for (const y of [65, 125, 180]) {
    ctx.beginPath();
    ctx.moveTo(45, y);
    ctx.lineTo(197, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(95, y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(144, y - 9);
    ctx.lineTo(164, y + 9);
    ctx.lineTo(164, y - 9);
    ctx.lineTo(144, y + 9);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.font = '12px monospace';
  ctx.fillStyle = '#293d36';
  ctx.fillText('VORLAUF', 48, 24);
  ctx.fillText('RÜCKLAUF', 52, 224);
  process.texture.needsUpdate = true;
  face(process.texture, 0.43, 0.46, -0.85, 1.59, 0.24);
  const meters: Array<[Mesh, keyof BoardDisplay['readings']]> = [
    [gauge(-0.49, 1.72, 0.066, -0.55), 'heater'],
    [
      gauge(-0.49, 1.51, 0.066, 0.7, false, redlineFraction('spindle')),
      'spindle',
    ],
  ];
  label('HEIZUNG', 0.17, -0.49, 1.81, 0.263);
  label('SPINDEL', 0.17, -0.49, 1.6, 0.263);
  const chart = createCanvasTexture(96, 160);
  textures.push(chart.texture);
  // Paper feeds downward: the newest quarter-second reading is at the top.
  const chartSamples: number[] = Array(160).fill(0);
  const drawChart = () => {
    const { context } = chart;
    context.fillStyle = '#cfc5a2';
    context.fillRect(0, 0, 96, 160);
    context.strokeStyle = '#a69b7e';
    context.lineWidth = 1;
    for (let y = 0; y < 160; y += 10) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(96, y);
      context.stroke();
    }
    for (let x = 12; x < 96; x += 18) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, 160);
      context.stroke();
    }
    context.strokeStyle = '#8f573e';
    context.lineWidth = 2;
    context.beginPath();
    chartSamples.forEach((speed, y) => {
      const x =
        9 +
        (Math.max(0, Math.min(FERROCORE_MAX_ANGULAR_VELOCITY, speed)) /
          FERROCORE_MAX_ANGULAR_VELOCITY) *
          78;
      if (y === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    chart.texture.needsUpdate = true;
  };
  drawChart();
  box(0.21, 0.32, 0.035, '#303e34', -0.93, 1.15, 0.24);
  indicator(
    face(chart.texture, 0.165, 0.275, -0.93, 1.15, 0.261),
    'Ferrocore angular velocity strip chart',
  );
  label('FERROCORE ω · rad/s', 0.32, -0.93, 1.34, 0.244);
  label('0—4 rad/s', 0.19, -0.93, 0.963, 0.244);
  // Blatz trim, as set on the rack (IST) and as the field wants it (SOLL).
  const trimPointers = (['IST', 'SOLL'] as const).map((name, i) => {
    const x = [-0.67, -0.52][i];
    box(0.035, 0.24, 0.022, '#2d3b30', x, 1.15, 0.246);
    box(0.012, 0.17, 0.005, '#cbbd93', x, 1.17, 0.262);
    label(name, 0.06, x, 1.295, 0.244);
    return box(0.025, 0.012, 0.006, '#935e39', x, 1.16, 0.266);
  });

  // A reduced 8 × 8 channel grid remains readable in the low-resolution renderer.
  // Each row is a bargraph of one channel, green rising to amber and red.
  box(0.48, 0.48, 0.014, '#50695b', 0, 1.55, 0.24);
  const grid: Lamp[] = [];
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++)
      grid.push(
        lamp(
          -0.203 + col * 0.058,
          1.753 - row * 0.058,
          col < 5 ? '#78a977' : col < 7 ? '#c2a65d' : '#c4553f',
        ),
      );
  const sideMeters = [
    ['field', 'trim match', 'instability'],
    ['strain', 'delta', 'load'],
  ] as const;
  for (const [side, x] of [-0.294, 0.294].entries())
    for (let i = 0; i < 3; i++) {
      const channel = sideMeters[side][i];
      meters.push([
        gauge(
          x,
          1.75 - i * 0.205,
          0.052,
          x * 2 + i * 0.2,
          false,
          channel === 'field' ? redlineFraction('field') : null,
        ),
        channel,
      ]);
      label(
        [
          ['FELD', 'TRIMM', 'INSTAB'],
          ['DEHNUNG', 'DELTA', 'LAST'],
        ][side][i],
        0.145,
        x,
        1.823 - i * 0.205,
        0.264,
      );
    }
  label('FERNANZEIGE · VX3', 0.38, 0, 1.24, 0.242);
  box(0.22, 0.13, 0.007, '#748478', 0.03, 1.055, 0.24);
  label('AUSSER BETRIEB', 0.2, 0.03, 1.055, 0.245);

  // Beige adapter plate and digital instruments added in 1986.
  box(0.66, 0.75, 0.025, '#afa990', 0.75, 1.48, 0.242);
  box(0.34, 0.28, 0.06, '#343a31', 0.64, 1.64, 0.265);
  // Pre-rendered green phosphor projections on the southernmost bay's CRT.
  const projections = new Map<CoreProjection, Texture>(
    (
      [
        'basis',
        'cube',
        'polyhedron',
        'irregular',
        'tesseract',
        'fault',
      ] as CoreProjection[]
    ).map((name) => {
      const texture = createPrintedImageTexture(
        `/screens/criticality/${name}.svg`,
        { width: 256, aspect: 0.75, paper: '#021008' },
      );
      textures.push(texture);
      return [name, texture] as const;
    }),
  );
  const projectionScreen = face(
    projections.get('basis')!,
    0.282,
    0.213,
    0.64,
    1.64,
    0.298,
    true,
  );
  indicator(projectionScreen, 'Ferrocore geometry screen');
  label('FC · RAUMPROJEKTION', 0.28, 0.64, 1.475, 0.299);
  let shownProjection: CoreProjection = 'basis';
  // Red LED readouts: load, consumption and Delta.
  const readouts = (['kW', 'kWh', 'δ'] as const).map((unit, i) => {
    const y = 1.74 - i * 0.12;
    box(0.15, 0.062, 0.025, '#30342c', 0.96, y, 0.27);
    label(
      ['LEISTUNG kW', 'ENERGIE kWh', 'DELTA δ'][i],
      0.15,
      0.96,
      y + 0.055,
      0.302,
    );
    const screen = createCanvasTexture(48, 22);
    textures.push(screen.texture);
    indicator(
      face(
        screen.texture,
        0.126,
        0.058,
        0.96,
        y,
        0.27 + 0.025 / 2 + 0.001,
        true,
      ),
      `${unit} readout`,
    );
    let shown = '';
    return (text: string) => {
      if (text === shown) return;
      shown = text;
      const { context } = screen;
      context.fillStyle = '#171e18';
      context.fillRect(0, 0, 48, 22);
      context.fillStyle = '#bb5738';
      context.font = 'bold 14px monospace';
      context.textAlign = 'right';
      context.fillText(text, 45, 16);
      screen.texture.needsUpdate = true;
    };
  });
  meters.push(
    [gauge(0.57, 1.28, 0.058, -0.2, true, redlineFraction('load')), 'load'],
    [gauge(0.76, 1.28, 0.058, 0.9, true), 'delta'],
  );
  label('LAST', 0.13, 0.57, 1.19, 0.298);
  label('DELTA', 0.13, 0.76, 1.19, 0.298);
  label('NACHRÜSTUNG 1986', 0.36, 0.73, 1.05, 0.262);
  box(0.036, 1.05, 0.045, '#818d81', 1.18, 1.24, 0.08);
  // Under each bay: BEREIT (mains), EIN (a bay switch on), STÖRUNG.
  const status: Lamp[] = [];
  for (const x of [-0.76, 0, 0.76])
    for (let i = 0; i < 3; i++)
      status.push(
        lamp(x - 0.19 + i * 0.19, 1.01, i === 2 ? '#c4553f' : '#c2a260'),
      );

  tiles.forEach((tile, i) =>
    indicator(tile.mesh, `${annunciators[i].label} alarm window`),
  );
  grid.forEach((lamp, i) =>
    indicator(
      lamp.mesh,
      `Channel grid lamp ${Math.floor(i / 8) + 1}.${(i % 8) + 1}`,
    ),
  );
  status.forEach((lamp, i) =>
    indicator(lamp.mesh, `${['BEREIT', 'EIN', 'STÖRUNG'][i % 3]} lamp`),
  );
  for (const [needle, channel] of meters) indicator(needle, `${channel} meter`);
  trimPointers.forEach((pointer, i) =>
    indicator(pointer, `Trim ${i ? 'SOLL' : 'IST'} pointer`),
  );

  let sampleClock = 0;
  return {
    group,
    /** Handles in board order, each with every mesh that should take a click. */
    handles: handles.map(({ parts }) => parts),
    update(display: BoardDisplay) {
      const { view, readings } = display;
      view.tiles.forEach((lit, i) => light(tiles[i], lit));
      view.grid.forEach((lit, i) => light(grid[i], lit));
      view.status.forEach((lit, i) => light(status[i], lit));
      view.handles.forEach((turned, i) => {
        handles[i].handle.rotation.y = turned ? 0.7 : -0.7;
      });
      for (const [needle, channel] of meters)
        needle.rotation.z =
          Math.PI * (0.75 - Math.max(0, Math.min(1, readings[channel])) * 1.5);
      [display.trimSet, display.trimIdeal].forEach((value, i) => {
        trimPointers[i].position.y =
          1.085 + Math.max(0, Math.min(1, value)) * 0.17;
      });
      readouts[0](display.powerKw.toFixed(1));
      readouts[1](display.energyKwh.toFixed(1));
      readouts[2](display.delta.toFixed(2));
      sampleClock += display.seconds;
      const nextProjection = coreProjection(
        display.coreTemperature,
        display.coreFailed,
      );
      if (nextProjection !== shownProjection) {
        shownProjection = nextProjection;
        const material =
          projectionScreen.material as import('three').MeshBasicMaterial;
        material.map = projections.get(nextProjection)!;
      }
      if (sampleClock >= 0.25) {
        sampleClock %= 0.25;
        chartSamples.unshift(display.ferrocoreRadiansPerSecond);
        if (chartSamples.length > 160) chartSamples.pop();
        drawChart();
      }
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
