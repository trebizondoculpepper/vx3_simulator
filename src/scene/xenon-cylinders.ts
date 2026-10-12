import { floorSafeHose } from './hose-route';
import { mountRotaryKnob, stepKnob } from './rotary-knob';
import { designate } from '../game/machine-parts';
import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { componentCatalogue, createRigModel } from '../game/rig-model';
import { xenonSourcePressure } from '../game/xenon-supply';
import {
  createCanvasTexture,
  createDialTexture,
  createLabelTexture,
} from './screens';
import { createCylinderLabelTexture } from './gas-signs';

export interface XenonBankOptions {
  /** Floor height in lab coordinates. */
  floorY: number;
  /** Centre of the bank on the floor. */
  x: number;
  z: number;
  /** Point on the back of the main cabinet where the hose plugs in. */
  hoseEnd: Vector3;
  /** Path the hose follows along the floor between the bank and the cabinet. */
  hoseVia: Vector3[];
}

// About 1.3 m tall and 20 cm across at the 19-inch rack's scene scale.
const CYLINDER_HEIGHT = 11.7;
const CYLINDER_RADIUS = 0.9;
/** Full scale of the inline flow meter, in standard litres per minute. */
export const XENON_FULL_SCALE_SLPM = 10;
const ROTAMETER_LENGTH = 3.4;

/**
 * Three tall xenon cylinders chained to the wall. Each has its own valve on
 * the crown, piped by a copper pigtail to an isolating valve on a brass
 * manifold mounted on the wall above, which feeds a single two-gauge
 * regulator past the right-hand cylinder. The regulator's front knob sets the
 * delivery pressure; the gas passes through a wall-mounted glass rotameter
 * reading in standard litres per minute, then a thick black hose runs along
 * the floor to the back of the main cabinet.
 */
export function createXenonCylinders(options: XenonBankOptions) {
  const supply = createRigModel(
    componentCatalogue.filter(
      (c) => c.model.topology === 'supply-chain' && c.id.startsWith('xenon-'),
    ),
  );
  const group = new Group();
  group.name = 'XenonCylinders';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const mesh = (
    geometry: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: Group = group,
  ) => {
    const material = createPs1Material({ color });
    materials.push(material);
    const result = new Mesh(geometry, material);
    result.position.set(x, y, z);
    parent.add(result);
    return result;
  };
  const textured = (
    texture: Texture,
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
    parent: Group = group,
  ) => {
    textures.push(texture);
    const material = createPs1Material({ map: texture }, true);
    materials.push(material);
    const result = new Mesh<BufferGeometry, Material>(
      new PlaneGeometry(width, height),
      material,
    );
    result.position.set(x, y, z);
    parent.add(result);
    return result;
  };

  const base = options.floorY - 0.03;
  const top = base + CYLINDER_HEIGHT;
  const shoulderBase = top - CYLINDER_RADIUS * 0.9;
  const spacing = CYLINDER_RADIUS * 2 + 0.06;
  const xs = [-spacing, 0, spacing].map((dx) => options.x + dx);
  // The shoulder reaches the specified cylinder top after its squash.
  const domeTop = top;
  const wallZ = options.z - CYLINDER_RADIUS - 0.08;
  // The cylinders stand hard against the lab's wall, which is about this
  // far behind their axes; the manifold hangs just in front of it.
  const wallFace = options.z - 0.5;
  const headerY = domeTop + 1.35;
  const headerZ = options.z - 0.18;

  const hazardLabel = createCylinderLabelTexture();
  const hazardLabelMaterial = createPs1Material(
    { map: hazardLabel.texture },
    true,
  );
  materials.push(hazardLabelMaterial);
  textures.push(hazardLabel.texture);
  for (const [i, x] of xs.entries()) {
    const z = options.z + (i === 1 ? 0.05 : 0);
    // Steel body, domed shoulder, a cream band stencilled XENON.
    mesh(
      new CylinderGeometry(
        CYLINDER_RADIUS,
        CYLINDER_RADIUS,
        shoulderBase - base,
        10,
      ),
      '#3f5664',
      x,
      (base + shoulderBase) / 2,
      z,
    );
    const shoulder = mesh(
      new SphereGeometry(
        CYLINDER_RADIUS,
        10,
        4,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ),
      // EN 1089-3: inert gases wear a bright green (RAL 6018) shoulder.
      '#57a639',
      x,
      shoulderBase,
      z,
    );
    shoulder.scale.y = 0.9;
    mesh(
      new CylinderGeometry(
        CYLINDER_RADIUS + 0.004,
        CYLINDER_RADIUS + 0.004,
        0.36,
        10,
      ),
      '#d8d2b8',
      x,
      shoulderBase - 0.22,
      z,
    );
    const band = createLabelTexture('XENON', {
      ink: '#2b3a44',
      plate: '#d8d2b8',
      size: 14,
    });
    textured(
      band.texture,
      band.width / 150,
      band.height / 150,
      x,
      shoulderBase - 0.22,
      z + CYLINDER_RADIUS + 0.008,
    );
    // The supplier's hazard label, wrapped round two facets of the body
    // facing the room.
    const facet = (Math.PI * 2) / 10;
    const labelMesh = new Mesh(
      new CylinderGeometry(
        CYLINDER_RADIUS + 0.006,
        CYLINDER_RADIUS + 0.006,
        (facet * 2 * CYLINDER_RADIUS * hazardLabel.height) / hazardLabel.width,
        2,
        1,
        true,
        -facet,
        facet * 2,
      ),
      hazardLabelMaterial,
    );
    labelMesh.position.set(x, shoulderBase - 0.92, z);
    group.add(labelMesh);
    // Brass cylinder valve on the crown of the dome: a collar, the valve
    // body with its outlet facing the wall, and a black handwheel on top.
    mesh(new CylinderGeometry(0.17, 0.2, 0.12, 8), '#6d6a5e', x, domeTop, z);
    mesh(
      new CylinderGeometry(0.16, 0.18, 0.5, 6),
      '#b8913f',
      x,
      domeTop + 0.3,
      z,
    );
    mesh(
      new CylinderGeometry(0.04, 0.04, 0.14, 5),
      '#8d8a7c',
      x,
      domeTop + 0.6,
      z,
    );
    const wheel = mesh(
      new TorusGeometry(0.2, 0.035, 4, 8),
      '#2c2c28',
      x,
      domeTop + 0.68,
      z,
    );
    wheel.rotation.x = Math.PI / 2;
    // Side outlet, and a copper pigtail looping up to its inlet on the
    // manifold above.
    const outlet = mesh(
      new CylinderGeometry(0.055, 0.055, 0.22, 6),
      '#b8913f',
      x + 0.24,
      domeTop + 0.32,
      z,
    );
    outlet.rotation.z = Math.PI / 2;
    const pigtail = new CatmullRomCurve3([
      new Vector3(x + 0.34, domeTop + 0.32, z),
      new Vector3(x + 0.58, domeTop + 0.45, z - 0.04),
      new Vector3(x + 0.55, domeTop + 0.95, headerZ),
      new Vector3(x + 0.18, headerY - 0.42, headerZ),
      new Vector3(x, headerY - 0.2, headerZ),
    ]);
    mesh(new TubeGeometry(pigtail, 24, 0.045, 5, false), '#c07a45', 0, 0, 0);
    // Isolating valve where the pigtail meets the manifold.
    mesh(new BoxGeometry(0.2, 0.2, 0.2), '#b8913f', x, headerY - 0.12, headerZ);
    mesh(
      new BoxGeometry(0.06, 0.04, 0.34),
      '#b8241c',
      x,
      headerY - 0.12,
      headerZ + 0.24,
    );
  }

  // Wall bracket and safety chain across the cylinders.
  mesh(
    new BoxGeometry(spacing * 2 + 0.6, 0.12, 0.06),
    '#55554c',
    options.x,
    base + 7.4,
    wallZ,
  );
  for (let link = 0; link < 14; link++) {
    const t = link / 13;
    const chain = mesh(
      new TorusGeometry(0.03, 0.008, 3, 6),
      '#8a8a80',
      options.x - spacing - 0.22 + t * (spacing * 2 + 0.44),
      base + 7.4 - Math.sin(t * Math.PI) * 0.06,
      options.z + CYLINDER_RADIUS + 0.03,
    );
    chain.rotation.y = link % 2 ? Math.PI / 2 : 0;
  }

  // Brass manifold on stand-off brackets against the wall, above and behind
  // the cylinders, running to a single regulator past the right-hand one.
  const regulatorX = options.x + spacing + CYLINDER_RADIUS + 0.35;
  const headerFrom = xs[0] - 0.25;
  const headerTo = regulatorX - 0.2;
  const header = mesh(
    new CylinderGeometry(0.08, 0.08, headerTo - headerFrom, 6),
    '#c9a24e',
    (headerFrom + headerTo) / 2,
    headerY,
    headerZ,
  );
  header.rotation.z = Math.PI / 2;
  mesh(
    new CylinderGeometry(0.1, 0.1, 0.06, 6),
    '#9c7a34',
    headerFrom,
    headerY,
    headerZ,
  ).rotation.z = Math.PI / 2;
  for (const bx of [xs[0] - 0.05, xs[2] + 0.4]) {
    mesh(
      new BoxGeometry(0.1, 0.3, headerZ - wallFace),
      '#55554c',
      bx,
      headerY,
      (headerZ + wallFace) / 2,
    );
  }

  // Regulator: a brass body with high- and low-pressure gauges and a T-handle.
  const regulator = new Group();
  regulator.position.set(regulatorX, headerY, headerZ + 0.12);
  regulator.scale.setScalar(4);
  group.add(regulator);
  mesh(new BoxGeometry(0.2, 0.2, 0.16), '#b8913f', 0, 0, 0, regulator);
  const bonnet = mesh(
    new CylinderGeometry(0.075, 0.09, 0.14, 8),
    '#9c7a34',
    0,
    0.17,
    0,
    regulator,
  );
  bonnet.rotation.x = 0;
  // Adjusting knob on the front of the body: knurled black Bakelite with a
  // white pointer. Clicking it is wired up by the scene.
  const regulatorKnob = mesh(
    new CylinderGeometry(0.075, 0.08, 0.07, 12),
    '#1d1d1a',
    0,
    -0.03,
    0.12,
    regulator,
  );
  regulatorKnob.rotation.x = Math.PI / 2;
  const pointer = mesh(
    new BoxGeometry(0.014, 0.06, 0.01),
    '#e7d6ad',
    0,
    -0.03,
    0.16,
    regulator,
  );
  pointer.geometry.translate(0, 0.03, 0);
  const regulatorPivot = mountRotaryKnob(regulatorKnob, pointer);
  // A generous invisible face makes the small Bakelite control usable from
  // the aisle without making its rendered knob implausibly large.
  const hitMaterial = createPs1Material({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  materials.push(hitMaterial);
  const regulatorHit = new Mesh(
    new BoxGeometry(0.42, 0.34, 0.015),
    hitMaterial,
  );
  regulatorHit.position.z = 0.18;
  regulatorPivot.add(regulatorHit);
  regulatorHit.userData.noCollision = true;
  for (const part of [regulatorKnob, pointer, regulatorHit])
    designate(part, {
      machine: 'Xenon supply',
      name: 'Flow regulator',
      role: 'input',
    });
  let deliveryNeedle: Mesh | undefined;
  let contentsNeedle: Mesh | undefined;
  for (const side of [-1, 1]) {
    const gaugeX = side * 0.17;
    const stem = mesh(
      new CylinderGeometry(0.014, 0.014, 0.08, 5),
      '#b8913f',
      side * 0.12,
      0.02,
      0,
      regulator,
    );
    stem.rotation.z = Math.PI / 2;
    const bezel = mesh(
      new CylinderGeometry(0.085, 0.085, 0.05, 10),
      '#2a2a22',
      gaugeX,
      0.04,
      0.02,
      regulator,
    );
    bezel.rotation.x = Math.PI / 2;
    const face = textured(
      createDialTexture(side > 0),
      0.15,
      0.15,
      gaugeX,
      0.04,
      0.047,
      regulator,
    );
    face.geometry.dispose();
    face.geometry = new CircleGeometry(0.072, 12);
    // High-pressure needle near full; low-pressure needle at working pressure.
    const needle = mesh(
      new BoxGeometry(0.008, 0.06, 0.004),
      '#a63425',
      gaugeX,
      0.04,
      0.052,
      regulator,
    );
    needle.geometry.translate(0, 0.026, 0);
    // Left: source pressure, nearly full but dipping under flow. Right: delivery.
    needle.rotation.z = -1.6;
    designate(needle, {
      machine: 'Xenon supply',
      name:
        side > 0
          ? 'Delivery pressure needle'
          : 'Cylinder source pressure needle',
      role: 'indicator',
    });
    if (side > 0) deliveryNeedle = needle;
    else contentsNeedle = needle;
  }
  // Outlet nipple where the hose clamps on.
  const outlet = mesh(
    new CylinderGeometry(0.025, 0.025, 0.12, 6),
    '#b8913f',
    0,
    -0.15,
    0.06,
    regulator,
  );
  outlet.rotation.x = 0.5;

  // Inline rotameter on the wall between the cylinders and the bench: a glass
  // tube over a printed SLPM scale, with a red float riding on the flow.
  const rotX = options.x + spacing + CYLINDER_RADIUS + 2.0;
  const rotZ = options.z - 0.28;
  const rotBottom = base + 5.3;
  const rotTop = rotBottom + ROTAMETER_LENGTH;
  const rotY = (rotBottom + rotTop) / 2;
  mesh(
    new BoxGeometry(0.34, ROTAMETER_LENGTH + 0.3, 0.04),
    '#2d2b26',
    rotX,
    rotY,
    rotZ - 0.05,
  );
  const scale = createRotameterScale();
  textured(scale, 0.28, ROTAMETER_LENGTH, rotX, rotY, rotZ - 0.025);
  const glassMaterial = createPs1Material(
    { color: '#cfe8ee', transparent: true, opacity: 0.28, depthWrite: false },
    true,
  );
  materials.push(glassMaterial);
  const glass = new Mesh(
    new CylinderGeometry(0.045, 0.045, ROTAMETER_LENGTH - 0.04, 8),
    glassMaterial,
  );
  glass.position.set(rotX, rotY, rotZ + 0.03);
  group.add(glass);
  for (const y of [rotBottom - 0.03, rotTop + 0.03])
    mesh(
      new CylinderGeometry(0.065, 0.065, 0.08, 8),
      '#b8913f',
      rotX,
      y,
      rotZ + 0.03,
    );
  const float = mesh(
    new CylinderGeometry(0.044, 0.016, 0.09, 6),
    '#e0301e',
    rotX,
    rotBottom + 0.05,
    rotZ + 0.03,
  );
  designate(float, {
    machine: 'Xenon supply',
    name: 'Rotameter float',
    role: 'indicator',
  });
  const meterLabel = createLabelTexture('Xe FLOW', {
    ink: '#e3d8b7',
    plate: '#2d2b26',
    size: 9,
  });
  textured(
    meterLabel.texture,
    meterLabel.width / 200,
    meterLabel.height / 200,
    rotX,
    rotTop + 0.11,
    rotZ - 0.02,
  );

  // The thick black hose, in two runs: regulator down into the meter's
  // bottom inlet, then from its top outlet down to the floor, behind the
  // bench, and up to a fitting on the back of the main cabinet.
  regulator.updateMatrix();
  const outletWorld = new Vector3(0, -0.2, 0.09).applyMatrix4(regulator.matrix);
  const hoseFloor = options.floorY + 0.22;
  const feed = new CatmullRomCurve3([
    outletWorld,
    new Vector3(outletWorld.x + 0.1, outletWorld.y - 0.5, outletWorld.z + 0.3),
    new Vector3(rotX - 0.1, rotBottom - 0.45, options.z + 0.25),
    new Vector3(rotX, rotBottom - 0.22, rotZ + 0.1),
    new Vector3(rotX, rotBottom - 0.07, rotZ + 0.03),
  ]);
  mesh(new TubeGeometry(feed, 40, 0.09, 8, false), '#1c1c1a', 0, 0, 0);
  const hose = floorSafeHose(
    [
      new Vector3(rotX, rotTop + 0.07, rotZ + 0.03),
      new Vector3(rotX + 0.05, rotTop + 0.28, rotZ + 0.12),
      new Vector3(rotX + 0.3, rotTop + 0.05, rotZ + 0.3),
      new Vector3(rotX + 0.42, hoseFloor + 0.35, options.z + 0.5),
      new Vector3(rotX + 0.5, hoseFloor, options.z + 0.7),
      ...options.hoseVia,
      new Vector3(
        options.hoseEnd.x - 0.15,
        hoseFloor + 0.05,
        options.hoseEnd.z - 0.25,
      ),
      new Vector3(
        options.hoseEnd.x,
        options.hoseEnd.y - 0.3,
        options.hoseEnd.z - 0.12,
      ),
      options.hoseEnd,
    ],
    options.floorY,
    0.09,
  );
  mesh(new TubeGeometry(hose, 80, 0.09, 8, false), '#1c1c1a', 0, 0, 0);
  // Labelled wall bulkhead: fixed pipework continues behind the masonry.
  const port = new Group();
  port.position.copy(options.hoseEnd);
  // The north-wall port faces into the room along +Z.
  group.add(port);
  mesh(new BoxGeometry(1.1, 1.1, 0.12), '#b8913f', 0, 0, -0.4, port);
  const nipple = mesh(
    new CylinderGeometry(0.13, 0.13, 0.4, 8),
    '#b8913f',
    0,
    0,
    -0.18,
    port,
  );
  nipple.rotation.x = Math.PI / 2;
  const fittingLabel = createLabelTexture('XENON · VX3', {
    ink: '#e3d8b7',
    plate: '#343d38',
    size: 8,
  });
  textured(fittingLabel.texture, 1.25, 0.2, 0, 0.8, -0.33, port);

  let setting = 0;
  // The bank's remaining contents, 0 to 1, drawn down by the flow. A full
  // bank holds 3,000 standard litres: ten hours at 5 SLPM.
  let contents = 0.92;
  let last: number | undefined;
  return {
    group,
    /** The clickable adjusting knob on the regulator. */
    regulatorKnob,
    /** Every mesh of the regulator knob, its pointer included. */
    regulatorParts: [regulatorKnob, pointer, regulatorHit] as readonly Mesh[],
    /** Delivery setting, 0..1. */
    get setting() {
      return setting;
    },
    /** Current flow in standard litres per minute. */
    get flowSlpm() {
      return supply.display('xenon-flow-gauge.flow');
    },
    /** Share of the bank's xenon left, 0 to 1. */
    get contents() {
      return contents;
    },
    get pressureBar() {
      return supply.display('xenon-pressure-indicator.pressure');
    },
    /** Turn the knob one step clockwise, stopping at fully open or closed. */
    regulatorPivot,
    /** Set the knob straight to a delivery setting, 0..1. */
    setRegulator(value: number) {
      setting = stepKnob(value, 0);
      supply.setControl('xenon-supply.flow-valve', setting);
      return setting;
    },
    stepRegulator(direction = 1) {
      setting = stepKnob(setting, direction);
      supply.setControl('xenon-supply.flow-valve', setting);
      return setting;
    },
    /** Ease the flow toward the setting and move the needle and float. */
    update(seconds: number, reducedMotion: boolean) {
      const delta = last === undefined ? 0 : Math.min(0.1, seconds - last);
      last = seconds;
      supply.step(delta);
      contents = Math.max(
        0,
        contents -
          (supply.display('xenon-flow-gauge.flow') * delta) / 60 / 3000,
      );
      const flow = supply.get('xenon-flow-gauge.flow');
      if (contentsNeedle)
        contentsNeedle.rotation.z =
          Math.PI * (0.75 - xenonSourcePressure(contents, flow) * 1.5);
      const bob = reducedMotion ? 0 : Math.sin(seconds * 9) * 0.006 * flow;
      float.position.y =
        rotBottom + 0.05 + flow * (ROTAMETER_LENGTH - 0.1) + bob;
      regulatorPivot.rotation.z = Math.PI * (0.75 - setting * 1.5);
      if (deliveryNeedle)
        deliveryNeedle.rotation.z =
          Math.PI *
          (0.75 - supply.get('xenon-pressure-indicator.pressure') * 1.5);
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}

/** Printed rotameter scale: 0 to 10 SLPM, read at the top of the float. */
function createRotameterScale() {
  const width = 40;
  const height = 144;
  const { context, texture } = createCanvasTexture(width, height);
  context.fillStyle = '#e8e0c6';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#2a2a22';
  context.strokeStyle = '#2a2a22';
  context.font = 'bold 9px monospace';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  const top = 6;
  const bottom = height - 6;
  for (let i = 0; i <= 20; i++) {
    const y = bottom - (i / 20) * (bottom - top);
    const major = i % 4 === 0;
    context.beginPath();
    context.moveTo(major ? 16 : 20, Math.round(y) + 0.5);
    context.lineTo(width - 4, Math.round(y) + 0.5);
    context.lineWidth = major ? 1.5 : 1;
    context.stroke();
    if (major) context.fillText(String(i / 2), 14, y);
  }
  context.save();
  context.translate(width - 2, height / 2);
  context.rotate(-Math.PI / 2);
  context.textAlign = 'center';
  context.font = 'bold 7px monospace';
  context.fillStyle = '#7a2a1a';
  context.fillText('SLPM Xe', 0, -4);
  context.restore();
  texture.needsUpdate = true;
  return texture;
}
