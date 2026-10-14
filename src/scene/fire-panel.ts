import {
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
} from 'three';
import type { BufferGeometry, Material, MeshStandardMaterial } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { wornPaint } from '../rendering/metal-finish';
import {
  createEightiesButton,
  createMicroLabel,
  createPanelKit,
  createPanelLed,
  disposeKit,
} from './eighties-controls';

/**
 * The corridor's fire alarm control panel (Brandmelderzentrale), after the
 * owner's photograph of a Notifier RP-2002: a red steel cabinet with a
 * hinged door and a key lock, knockouts in its side, a pale grey inset
 * plate with rounded corners carrying the model and the maker, and in it a
 * deep black moulded window whose walls slope in to the display: a green
 * LCD, three status lamps (BETRIEB, ALARM, STÖRUNG) and a row of mechanical
 * pushbuttons, one of which, RÜCKSTELLEN, resets the panel.
 *
 * Built in metres, about 0.42 wide, 0.48 high and 0.12 deep, its back on
 * the wall at z = 0 and facing +z, centred on the origin.
 */

const W = 0.42;
const H = 0.48;
const D = 0.12;

/** A rounded rectangle, `w` by `h`, corners of radius `r`. */
function rounded(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createFirePanel() {
  const group = new Group();
  group.name = 'Fire alarm control panel';
  const kit = createPanelKit();
  const materials: Material[] = [];
  const geometries: BufferGeometry[] = [];
  const paint = (color: string, metalness = 0, roughness?: number) => {
    const m = createPs1Material({ color, metalness, roughness });
    materials.push(m);
    return m;
  };
  const add = (
    geometry: BufferGeometry,
    material: Material | Material[],
    x: number,
    y: number,
    z: number,
    parent: Group = group,
  ) => {
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // ---- The cabinet: a red steel box and its door ----------------------------
  const red = wornPaint(
    createPs1Material({ color: '#b32a22' }) as MeshStandardMaterial,
    '#b32a22',
    { aspect: H / W },
  );
  const darkRed = paint('#6d1712');
  materials.push(red);
  // The back box, a little smaller than the door, so the door's edge shows.
  add(new BoxGeometry(W - 0.01, H - 0.01, D - 0.02), red, 0, 0, (D - 0.02) / 2);
  // The door: a shallow tray, its lip standing proud of the box.
  const door = new Group();
  door.position.z = D - 0.02;
  group.add(door);
  add(new BoxGeometry(W, H, 0.02), red, 0, 0, 0.01, door);
  // The seam between door and box, all round.
  for (const [w, h, x, y] of [
    [W + 0.002, 0.003, 0, H / 2 - 0.0015],
    [W + 0.002, 0.003, 0, -H / 2 + 0.0015],
    [0.003, H, W / 2 - 0.0015, 0],
    [0.003, H, -W / 2 + 0.0015, 0],
  ] as const)
    add(new BoxGeometry(w, h, 0.004), darkRed, x, y, -0.001, door);
  // Knockouts in the right side, for conduit.
  const knockoutPaint = paint('#8d211b');
  for (const [y, z] of [
    [0.12, 0.03],
    [-0.02, 0.05],
    [-0.15, 0.03],
  ] as const) {
    const ko = add(
      new CylinderGeometry(0.011, 0.011, 0.002, 16),
      knockoutPaint,
      W / 2 - 0.004,
      y,
      z,
    );
    ko.rotation.z = Math.PI / 2;
  }
  // The key lock on the door's right edge: a chrome bezel, a black barrel.
  const chrome = paint('#c4c6c4', 0.85, 0.3);
  const barrel = paint('#141414', 0.2, 0.5);
  const bezel = add(
    new CylinderGeometry(0.011, 0.012, 0.006, 20),
    chrome,
    W / 2 - 0.035,
    0.03,
    0.023,
    door,
  );
  bezel.rotation.x = Math.PI / 2;
  const plug = add(
    new CylinderGeometry(0.008, 0.008, 0.008, 18),
    barrel,
    W / 2 - 0.035,
    0.03,
    0.026,
    door,
  );
  plug.rotation.x = Math.PI / 2;
  add(
    new BoxGeometry(0.0018, 0.008, 0.002),
    chrome,
    W / 2 - 0.035,
    0.03,
    0.031,
    door,
  );

  // ---- The inset plate: pale grey, rounded corners ---------------------------
  const plateW = 0.33;
  const plateH = 0.22;
  const plateY = 0.07;
  const plate = add(
    new ExtrudeGeometry(rounded(plateW, plateH, 0.018), {
      depth: 0.003,
      bevelEnabled: true,
      bevelThickness: 0.0015,
      bevelSize: 0.0015,
      bevelSegments: 2,
    }),
    paint('#d7d8d2', 0, 0.55),
    0,
    plateY,
    0.02,
    door,
  );
  plate.name = 'Fire panel plate';
  // The model plate, top left, and the maker, bottom right.
  const model = createMicroLabel(kit, 'BZ-3', {
    height: 0.016,
    ink: '#1d1f1c',
  });
  model.position.set(-plateW / 2 + 0.026, plateY + plateH / 2 - 0.018, 0.0255);
  door.add(model);
  const maker = createMicroLabel(kit, 'SYNCLEX\nBRANDSCHUTZ', {
    height: 0.007,
    ink: '#1d1f1c',
  });
  maker.position.set(plateW / 2 - 0.03, plateY - plateH / 2 + 0.016, 0.0255);
  door.add(maker);
  const badge = add(
    new CylinderGeometry(0.0065, 0.0065, 0.001, 16),
    paint('#b32a22'),
    plateW / 2 - 0.03,
    plateY - plateH / 2 + 0.036,
    0.0255,
    door,
  );
  badge.rotation.x = Math.PI / 2;

  // ---- The window: a deep black moulding sloping in to the display ----------
  const winW = 0.17;
  const winH = 0.17;
  const winX = 0.005;
  const deep = 0.035;
  const black = paint('#161817', 0, 0.45);
  // The moulding's front frame, a rounded rectangle with a hole.
  const frame = rounded(winW + 0.03, winH + 0.03, 0.02);
  frame.holes.push(rounded(winW, winH, 0.012));
  add(
    new ExtrudeGeometry(frame, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
    }),
    black,
    winX,
    plateY,
    0.026 + deep - 0.008,
    door,
  );
  // The sloping walls: four tapered panels from the frame to the back.
  const backW = winW * 0.62;
  const backH = winH * 0.62;
  // The hood stands proud of the plate: its back sits on the plate's face.
  const backZ = 0.026;
  // Built as a frustum: a box whose back face is shrunk.
  const funnel = new BoxGeometry(winW, winH, deep, 1, 1, 1);
  const pos = funnel.attributes.position;
  for (let i = 0; i < pos.count; i++)
    if (pos.getZ(i) < 0) {
      pos.setX(i, (pos.getX(i) * backW) / winW);
      pos.setY(i, (pos.getY(i) * backH) / winH);
    }
  funnel.computeVertexNormals();
  const funnelMesh = add(
    funnel,
    createPs1Material({ color: '#1d201f', side: BackSide }),
    winX,
    plateY,
    backZ + deep / 2,
    door,
  );
  materials.push(funnelMesh.material as Material);
  // Its outside: the same frustum a little larger, seen from without, open
  // at the front (BoxGeometry's fifth group is the +z face).
  const shell = funnel.clone();
  shell.scale(1.04, 1.04, 0.98);
  const hidden = new MeshBasicMaterial({ visible: false });
  materials.push(hidden);
  add(
    shell,
    [black, black, black, black, hidden, black],
    winX,
    plateY,
    backZ + deep / 2,
    door,
  );
  // The back of the window: dark grey, carrying the display and keys.
  add(
    new BoxGeometry(backW, backH, 0.002),
    paint('#3a3e3b', 0, 0.6),
    winX,
    plateY,
    backZ + 0.001,
    door,
  );

  // The LCD: green, behind a thin bezel.
  const lcdW = backW * 0.82;
  const lcdH = backH * 0.26;
  add(
    new BoxGeometry(lcdW + 0.008, lcdH + 0.008, 0.003),
    black,
    winX,
    plateY + backH * 0.24,
    backZ + 0.003,
    door,
  );
  const screen = add(
    new PlaneGeometry(lcdW, lcdH),
    createPs1Material({ color: '#ffffff' }, true, true),
    winX,
    plateY + backH * 0.24,
    backZ + 0.0047,
    door,
  ) as Mesh<PlaneGeometry, ReturnType<typeof createPs1Material>>;
  materials.push(screen.material as Material);
  screen.name = 'Fire panel display';

  // Three status lamps under the display.
  const lamps = (['green', 'red', 'amber'] as const).map((colour, i) => {
    const lamp = createPanelLed(kit, colour);
    lamp.group.scale.setScalar(0.9);
    lamp.group.position.set(
      winX + (i - 1) * (lcdW / 3),
      plateY + backH * 0.02,
      backZ + 0.002,
    );
    door.add(lamp.group);
    const caption = createMicroLabel(kit, ['BETRIEB', 'ALARM', 'STÖRUNG'][i], {
      height: 0.003,
      ink: '#e6e4da',
    });
    caption.position.set(
      winX + (i - 1) * (lcdW / 3),
      plateY + backH * 0.02 - 0.01,
      backZ + 0.0025,
    );
    door.add(caption);
    return lamp;
  });

  // Standard compact pushbuttons: legends are baked into each cap texture,
  // so even the longer German words stay within their own button face.
  const keys = ['QUITT', 'SUMMER\nAB', 'RÜCK-\nSTELLEN'].map((legend, i) => {
    const key = createEightiesButton(kit, legend, i === 2 ? 'red' : 'grey', {
      size: 0.024,
      latching: false,
      illuminated: false,
    });
    key.group.position.set(
      winX + (i - 1) * (lcdW / 3),
      plateY - backH * 0.28,
      backZ + 0.002,
    );
    key.group.name = `Fire panel ${legend.replace('\n', ' ')} key`;
    door.add(key.group);
    return key;
  });
  const resetKey = keys[2].cap;
  resetKey.name = 'Fire panel RÜCKSTELLEN key';

  // The title above the plate.
  const title = createMicroLabel(kit, 'BRANDMELDERZENTRALE', {
    height: 0.016,
    ink: '#f2e2d2',
  });
  title.position.set(0, plateY + plateH / 2 + 0.035, 0.021);
  door.add(title);
  // RÜCKSTELLEN, beside its key, for anyone who cannot find it.
  const hint = createMicroLabel(kit, 'RÜCKSTELLEN ▸ TASTE IM FENSTER', {
    height: 0.008,
    ink: '#f2e2d2',
  });
  hint.position.set(0, plateY - plateH / 2 - 0.03, 0.021);
  door.add(hint);

  return {
    group,
    /** The LCD's material: put its canvas texture in `map`. */
    screen,
    /** The reset key, to bind to the fire circuit's RÜCKSTELLEN. */
    resetKey,
    pressReset() {
      keys[2].press();
    },
    update(delta: number) {
      for (const key of keys) key.update(delta);
    },
    /** The status lamps: supply on, alarm, trouble. */
    setLamps(power: boolean, alarm: boolean, trouble: boolean) {
      lamps[0].set(power);
      lamps[1].set(alarm);
      lamps[2].set(trouble);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      disposeKit(kit, group);
    },
  };
}
