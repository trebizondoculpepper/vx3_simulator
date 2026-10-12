import { designate } from '../game/machine-parts';
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  PointLight,
} from 'three';
import type { Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { addPlantRoomWiring } from './plant-room-wiring';
import { createCanvasTexture, createLabelTexture } from './screens';

/** A small plant room west of the lab, entered directly from the corridor. */
export function createPlantRoom(options: {
  floorY: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  worldUnitsPerMetre: number;
}) {
  const { floorY, minX, maxX, minZ, maxZ, worldUnitsPerMetre: m } = options;
  const group = new Group();
  group.name = 'PlantRoom';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const paints = new Map<string, Material>();
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    parent = group,
  ) => {
    let material = paints.get(color);
    if (!material) {
      material = createPs1Material({ color });
      paints.set(color, material);
      materials.push(material);
    }
    const mesh = new Mesh(new BoxGeometry(w, h, d), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const label = (
    text: string,
    w: number,
    x: number,
    y: number,
    z: number,
    parent = group,
  ) => {
    const image = createLabelTexture(text, {
      ink: '#f0e4bb',
      plate: '#34453b',
      size: 14,
    });
    textures.push(image.texture);
    const material = createPs1Material({ map: image.texture }, true, true);
    materials.push(material);
    const mesh = new Mesh(
      new PlaneGeometry(w, (w * image.height) / image.width),
      material,
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const height = 2.7 * m;
  const wallThickness = 0.3 * m;
  const entryZ = maxZ + wallThickness;
  box(
    width,
    0.15,
    depth + wallThickness,
    '#626558',
    midX,
    floorY - 0.1,
    midZ + wallThickness / 2,
  );
  box(
    width,
    height,
    wallThickness,
    '#626f68',
    midX,
    floorY + height / 2,
    minZ - wallThickness / 2,
  );
  for (const x of [minX - wallThickness / 2, maxX + wallThickness / 2])
    box(wallThickness, height, depth, '#626f68', x, floorY + height / 2, midZ);
  // Match the laboratory's high exposed ceiling: a slab, deep joists and
  // suspended twin-tube fittings, with overhead cables below the roof.
  const ceilingY = floorY + height;
  const roof = new Group();
  group.add(roof);
  box(
    width + 0.4,
    0.25,
    depth + 0.4,
    '#3d433f',
    midX,
    ceilingY + 0.12,
    midZ,
    roof,
  );
  for (const x of [minX + 0.75 * m, midX, maxX - 0.75 * m])
    box(
      0.045 * m,
      0.09 * m,
      depth,
      '#4b514c',
      x,
      ceilingY - 0.045 * m,
      midZ,
      roof,
    );
  const doorWidth = 0.95 * m;
  const doorHeight = 2.1 * m;
  const side = (width - doorWidth) / 2;
  for (const x of [minX + side / 2, maxX - side / 2])
    box(
      side,
      height,
      wallThickness - 0.02,
      '#626f68',
      x,
      floorY + height / 2,
      maxZ + wallThickness / 2 - 0.01,
    );
  box(
    doorWidth,
    height - doorHeight,
    wallThickness - 0.02,
    '#626f68',
    midX,
    floorY + (height + doorHeight) / 2,
    maxZ + wallThickness / 2 - 0.01,
  );
  for (const x of [midX - doorWidth / 2, midX + doorWidth / 2])
    box(
      0.06 * m,
      doorHeight,
      wallThickness,
      '#384b40',
      x,
      floorY + doorHeight / 2,
      maxZ + wallThickness / 2,
    );
  label('TECHNIKRAUM', 1.25 * m, midX, floorY + 2.3 * m, entryZ + 0.05);
  const door = new Group();
  // Hinge at the room face of the wall so the open leaf clears the jamb.
  door.position.set(midX - doorWidth / 2, floorY, maxZ + 0.02 * m);
  group.add(door);
  box(
    doorWidth - 0.05 * m,
    doorHeight,
    0.045 * m,
    '#53665c',
    doorWidth / 2,
    doorHeight / 2,
    0,
    door,
  );
  for (const face of [-1, 1]) {
    box(
      0.29 * m,
      0.56 * m,
      0.005 * m,
      '#21322f',
      doorWidth / 2,
      1.45 * m,
      face * 0.025 * m,
      door,
    );
    for (let i = 0; i < 4; i++) {
      box(
        0.29 * m,
        0.0015 * m,
        0.003 * m,
        '#84958a',
        doorWidth / 2,
        1.25 * m + i * 0.13 * m,
        face * 0.029 * m,
        door,
      );
      box(
        0.0015 * m,
        0.56 * m,
        0.003 * m,
        '#84958a',
        doorWidth / 2 - 0.11 * m + i * 0.073 * m,
        1.45 * m,
        face * 0.029 * m,
        door,
      );
    }
    const chrome = createPs1Material({ color: '#c3c9bd', metalness: 0.55 });
    materials.push(chrome);
    const handlePart = (
      radius: number,
      length: number,
      x: number,
      z: number,
      alongX = false,
    ) => {
      const item = new Mesh(
        new CylinderGeometry(radius, radius, length, 10),
        chrome,
      );
      item.position.set(x, 1.03 * m, z);
      item.rotation.set(alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0);
      door.add(item);
    };
    const handleX = doorWidth - 0.13 * m;
    handlePart(0.035 * m, 0.012 * m, handleX, face * 0.032 * m);
    handlePart(0.012 * m, 0.055 * m, handleX, face * 0.065 * m);
    handlePart(
      0.011 * m,
      0.13 * m,
      handleX - 0.055 * m,
      face * 0.091 * m,
      true,
    );
    box(
      0.012 * m,
      0.025 * m,
      0.005 * m,
      '#303c32',
      handleX,
      0.95 * m,
      face * 0.034 * m,
      door,
    );
    box(
      doorWidth - 0.1 * m,
      0.2 * m,
      0.005 * m,
      '#919b8f',
      doorWidth / 2,
      0.15 * m,
      face * 0.026 * m,
      door,
    );
  }
  // Paired painted hazard pictograms on both sides of the door: electric
  // shock and compressed xenon. They sit above the wired-glass window.
  const hazard = createCanvasTexture(384, 144);
  textures.push(hazard.texture);
  const hazardCtx = hazard.context;
  hazardCtx.fillStyle = '#242820';
  hazardCtx.fillRect(0, 0, 384, 144);
  hazardCtx.strokeStyle = '#e4b939';
  hazardCtx.lineWidth = 8;
  hazardCtx.strokeRect(4, 4, 376, 136);
  hazardCtx.fillStyle = '#e9be3d';
  hazardCtx.beginPath();
  hazardCtx.moveTo(82, 15);
  hazardCtx.lineTo(147, 105);
  hazardCtx.lineTo(17, 105);
  hazardCtx.closePath();
  hazardCtx.fill();
  hazardCtx.fillStyle = '#20251e';
  hazardCtx.beginPath();
  hazardCtx.moveTo(91, 32);
  hazardCtx.lineTo(63, 68);
  hazardCtx.lineTo(81, 68);
  hazardCtx.lineTo(69, 94);
  hazardCtx.lineTo(109, 56);
  hazardCtx.lineTo(90, 56);
  hazardCtx.closePath();
  hazardCtx.fill();
  hazardCtx.fillStyle = '#f0eee5';
  hazardCtx.beginPath();
  hazardCtx.moveTo(272, 13);
  hazardCtx.lineTo(341, 61);
  hazardCtx.lineTo(272, 109);
  hazardCtx.lineTo(203, 61);
  hazardCtx.closePath();
  hazardCtx.fill();
  hazardCtx.strokeStyle = '#b44332';
  hazardCtx.lineWidth = 9;
  hazardCtx.stroke();
  hazardCtx.fillStyle = '#252a25';
  hazardCtx.fillRect(239, 54, 66, 20);
  hazardCtx.fillRect(236, 57, 5, 14);
  hazardCtx.fillRect(305, 59, 8, 10);
  hazardCtx.fillStyle = '#e6d8a3';
  hazardCtx.font = 'bold 17px monospace';
  hazardCtx.textAlign = 'center';
  hazardCtx.fillText('HOCHSPANNUNG', 85, 128);
  hazardCtx.fillText('Xe · GAS', 272, 128);
  hazard.texture.needsUpdate = true;
  const hazardMaterial = createPs1Material({ map: hazard.texture }, true, true);
  materials.push(hazardMaterial);
  for (const face of [-1, 1]) {
    const print = new Mesh(
      new PlaneGeometry(0.63 * m, 0.24 * m),
      hazardMaterial,
    );
    print.position.set(doorWidth / 2, 1.88 * m, face * 0.029 * m);
    if (face < 0) print.rotation.y = Math.PI;
    door.add(print);
  }
  const entryParts: Mesh[] = [];
  door.traverse((o) => {
    if (o instanceof Mesh) entryParts.push(o);
  });
  let entryOpened = false;
  let entryAmount = 0;
  const powerPanel = new Group();
  powerPanel.position.set(maxX - 0.045 * m, floorY + 1.35 * m, minZ + 2.2 * m);
  powerPanel.rotation.y = -Math.PI / 2;
  group.add(powerPanel);
  box(0.42 * m, 0.62 * m, 0.07 * m, '#8d9690', 0, 0, 0, powerPanel);
  box(0.25 * m, 0.35 * m, 0.012 * m, '#282d25', 0, 0, 0.042 * m, powerPanel);
  for (const x of [-0.065 * m, 0.065 * m])
    box(
      0.023 * m,
      0.21 * m,
      0.035 * m,
      '#a89966',
      x,
      0.025 * m,
      0.075 * m,
      powerPanel,
    );
  const lever = new Group();
  lever.position.set(0, -0.12 * m, 0.075 * m);
  powerPanel.add(lever);
  for (const x of [-0.065 * m, 0.065 * m])
    box(0.018 * m, 0.27 * m, 0.022 * m, '#b49e62', x, 0.135 * m, 0, lever);
  box(0.21 * m, 0.045 * m, 0.055 * m, '#302820', 0, 0.29 * m, 0, lever);
  label('HAUPTSCHALTER', 0.36 * m, 0, 0.245 * m, 0.042 * m, powerPanel);
  label(
    'MASCHINEN · LICHT SEPARAT',
    0.36 * m,
    0,
    -0.245 * m,
    0.042 * m,
    powerPanel,
  );
  let powered = false;
  const powerParts: Mesh[] = [];
  powerPanel.traverse((o) => {
    if (o instanceof Mesh) {
      powerParts.push(o);
      designate(o, {
        machine: 'Plant-room supply',
        name: 'HAUPTSCHALTER',
        role: 'input',
      });
    }
  });
  // A static consumer-unit enclosure beside the rectifier and master switch.
  // The cover is held open for inspection; the miniature breakers deliberately
  // have no click targets until their circuits have been modelled.
  const breakerPanel = new Group();
  breakerPanel.position.set(
    maxX - 0.055 * m,
    floorY + 1.55 * m,
    minZ + 3.23 * m,
  );
  breakerPanel.rotation.y = -Math.PI / 2;
  group.add(breakerPanel);
  box(0.76 * m, 0.51 * m, 0.12 * m, '#b8bbb3', 0, 0, 0, breakerPanel);
  box(
    0.7 * m,
    0.28 * m,
    0.015 * m,
    '#e4e3da',
    0,
    -0.025 * m,
    0.068 * m,
    breakerPanel,
  );
  box(
    0.68 * m,
    0.11 * m,
    0.02 * m,
    '#d0d3cc',
    0,
    0.1 * m,
    0.078 * m,
    breakerPanel,
  );
  for (let index = 0; index < 12; index++) {
    const x = (index - 5.5) * 0.055 * m;
    const colour = index < 2 ? '#ae3029' : index === 2 ? '#363c3a' : '#ededdf';
    box(
      0.048 * m,
      0.18 * m,
      0.022 * m,
      colour,
      x,
      -0.035 * m,
      0.085 * m,
      breakerPanel,
    );
    box(
      0.031 * m,
      0.055 * m,
      0.025 * m,
      index < 2 ? '#a4302b' : '#313633',
      x,
      -0.067 * m,
      0.108 * m,
      breakerPanel,
    );
    box(
      0.026 * m,
      0.012 * m,
      0.009 * m,
      '#727e77',
      x,
      0.035 * m,
      0.101 * m,
      breakerPanel,
    );
  }
  for (const x of [-0.34 * m, 0.34 * m])
    for (const y of [-0.2 * m, 0.2 * m])
      box(
        0.018 * m,
        0.018 * m,
        0.012 * m,
        '#78837f',
        x,
        y,
        0.071 * m,
        breakerPanel,
      );
  const cover = new Group();
  cover.position.set(0, 0.255 * m, 0.045 * m);
  cover.rotation.x = -0.42;
  breakerPanel.add(cover);
  box(0.79 * m, 0.34 * m, 0.025 * m, '#e0e1da', 0, 0.17 * m, 0.06 * m, cover);
  box(0.75 * m, 0.31 * m, 0.008 * m, '#c7ccc5', 0, 0.17 * m, 0.078 * m, cover);
  label(
    'SICHERUNGSKASTEN · 240 V',
    0.6 * m,
    0,
    0.18 * m,
    0.082 * m,
    breakerPanel,
  );
  const warning = createCanvasTexture(384, 512);
  textures.push(warning.texture);
  const ctx = warning.context;
  ctx.fillStyle = '#ded4b4';
  ctx.fillRect(0, 0, 384, 512);
  ctx.strokeStyle = '#705732';
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, 368, 496);
  ctx.fillStyle = '#e9bb39';
  ctx.fillRect(18, 18, 348, 98);
  ctx.fillStyle = '#24251e';
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('ACHTUNG', 192, 58);
  ctx.fillText('XENON', 192, 96);
  ctx.beginPath();
  ctx.moveTo(192, 140);
  ctx.lineTo(137, 234);
  ctx.lineTo(247, 234);
  ctx.closePath();
  ctx.fillStyle = '#e9bb39';
  ctx.fill();
  ctx.strokeStyle = '#25271e';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#25271e';
  ctx.font = 'bold 62px monospace';
  ctx.fillText('!', 192, 222);
  ctx.font = 'bold 23px monospace';
  ctx.fillText('ERSTICKUNGSGEFAHR', 192, 278);
  ctx.font = '17px monospace';
  for (const [i, line] of [
    'Xenon verdrängt Sauerstoff.',
    'Nur bei ausreichender',
    'Lüftung betreten.',
    'Bei Gasaustritt:',
    'Raum verlassen und melden.',
    'Keine ungeschützte Rettung.',
  ].entries())
    ctx.fillText(line, 192, 322 + i * 26);
  warning.texture.needsUpdate = true;
  const posterMaterial = createPs1Material({ map: warning.texture }, true);
  materials.push(posterMaterial);
  const poster = new Mesh(new PlaneGeometry(0.6 * m, 0.8 * m), posterMaterial);
  poster.position.set(midX + 1.2 * m, floorY + 1.55 * m, minZ + 0.03 * m);
  group.add(poster);
  for (const x of [minX + 0.25 * m, maxX - 0.25 * m])
    box(
      0.04 * m,
      2.4 * m,
      0.04 * m,
      '#888878',
      x,
      floorY + 1.2 * m,
      minZ + 0.1 * m,
    );
  for (const x of [minX + 1.25 * m, maxX - 1.25 * m]) {
    const fitting = new Group();
    fitting.position.set(x, ceilingY, minZ + 3.65 * m);
    group.add(fitting);
    for (const dx of [-0.48 * m, 0.48 * m])
      box(0.016 * m, 0.24 * m, 0.016 * m, '#343833', dx, -0.12 * m, 0, fitting);
    box(1.28 * m, 0.08 * m, 0.13 * m, '#b9bcae', 0, -0.27 * m, 0, fitting);
    for (const dz of [-0.035 * m, 0.035 * m])
      box(1.2 * m, 0.012 * m, 0.024 * m, '#eef2df', 0, -0.33 * m, dz, fitting);
  }
  const light = new PointLight('#dbe5c3', 24, 6 * m, 1.3);
  light.position.set(midX, floorY + 2.35 * m, minZ + 3.65 * m);
  group.add(light);

  addPlantRoomWiring(group, materials, options);

  // Wire cage: access gate swings into the aisle, with no solid transparent wall.
  const cageX = midX - 0.4 * m;
  const cageBack = minZ + 0.08 * m;
  const cageFront = minZ + 0.9 * m;
  const cageLeft = cageX - 0.68 * m;
  const cageRight = cageX + 0.68 * m;
  const cageH = 1.8 * m;
  for (const x of [cageLeft, cageRight]) {
    for (const z of [cageBack, cageFront])
      box(0.035 * m, cageH, 0.035 * m, '#6c755d', x, floorY + cageH / 2, z);
    for (let z = cageBack; z < cageFront; z += 0.12 * m)
      box(0.009 * m, cageH, 0.009 * m, '#65735b', x, floorY + cageH / 2, z);
    for (let y = 0.15 * m; y < cageH; y += 0.18 * m)
      box(
        0.009 * m,
        0.009 * m,
        cageFront - cageBack,
        '#65735b',
        x,
        floorY + y,
        (cageBack + cageFront) / 2,
      );
  }
  for (let x = cageLeft; x <= cageRight; x += 0.12 * m)
    box(
      0.009 * m,
      cageH,
      0.009 * m,
      '#65735b',
      x,
      floorY + cageH / 2,
      cageBack,
    );
  box(
    cageRight - cageLeft,
    0.035 * m,
    cageFront - cageBack,
    '#6c755d',
    cageX,
    floorY + cageH,
    (cageBack + cageFront) / 2,
  );
  const gate = new Group();
  gate.position.set(cageLeft, floorY, cageFront);
  group.add(gate);
  const gateW = cageRight - cageLeft - 0.04 * m;
  const gateHitMaterial = createPs1Material({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  materials.push(gateHitMaterial);
  const gateHit = new Mesh(
    new BoxGeometry(gateW, cageH, 0.01 * m),
    gateHitMaterial,
  );
  gateHit.position.set(gateW / 2, cageH / 2, 0);
  gate.add(gateHit);
  for (let x = 0.04 * m; x <= gateW; x += 0.12 * m)
    box(
      0.009 * m,
      cageH - 0.07 * m,
      0.009 * m,
      '#718065',
      x,
      cageH / 2,
      0,
      gate,
    );
  for (let y = 0.06 * m; y < cageH; y += 0.18 * m)
    box(gateW, 0.009 * m, 0.009 * m, '#718065', gateW / 2, y, 0, gate);
  for (const y of [0.04 * m, cageH - 0.025 * m])
    box(gateW, 0.035 * m, 0.025 * m, '#8b9278', gateW / 2, y, 0, gate);
  const latch = box(
    0.06 * m,
    0.18 * m,
    0.07 * m,
    '#bba668',
    gateW - 0.08 * m,
    0.95 * m,
    0.045 * m,
    gate,
  );
  label('XENON · 2 SLPM MIN', 0.75 * m, gateW / 2, 1.5 * m, 0.025 * m, gate);
  label(
    '1 CAGE  2 VALVE  3 FLOW  4 MAINS',
    1.4 * m,
    midX,
    floorY + 1.95 * m,
    minZ + 0.025,
  );
  const gateParts: Mesh[] = [];
  gate.traverse((o) => {
    if (o instanceof Mesh) gateParts.push(o);
  });
  let opened = false;
  let amount = 0;
  return {
    group,
    roof,
    doorway: { x: midX, width: doorWidth, height: doorHeight },
    entryParts,
    entryFootprint: {
      minX: midX - doorWidth / 2,
      maxX: midX + doorWidth / 2,
      minZ: maxZ - 0.04 * m,
      maxZ: maxZ + 0.08 * m,
    },
    get entryBlocking() {
      return entryAmount < 0.85;
    },
    /** How far the entry door is open, 0 (shut) to 1. */
    get entryAmount() {
      return entryAmount;
    },
    /** The plant room's floor, for working out who can hear what. */
    bounds: { minX, maxX, minZ, maxZ },
    toggleEntry() {
      entryOpened = !entryOpened;
      return entryOpened;
    },
    powerParts,
    get powered() {
      return powered;
    },
    togglePower() {
      powered = !powered;
      return powered;
    },
    rectifierPosition: { x: maxX - 0.25 * m, z: minZ + 1.45 * m },
    port: { x: cageRight + 0.2 * m, y: floorY + 0.6 * m, z: minZ + 0.4 },
    bank: { x: cageX, z: minZ + 0.23 * m },
    latch,
    gateParts,
    gateFootprint: {
      minX: cageLeft,
      maxX: cageRight,
      minZ: cageFront - 0.025 * m,
      maxZ: cageFront + 0.025 * m,
    },
    get open() {
      return amount > 0.85;
    },
    get blocking() {
      return amount < 0.85;
    },
    toggle() {
      opened = !opened;
      return opened;
    },
    update(delta: number, reducedMotion: boolean) {
      entryAmount +=
        Math.sign((entryOpened ? 1 : 0) - entryAmount) *
        Math.min(
          Math.abs((entryOpened ? 1 : 0) - entryAmount),
          delta * (reducedMotion ? 12 : 1.5),
        );
      door.rotation.y = entryAmount * 1.45;
      lever.rotation.x = powered ? 0 : 1.05;
      const target = opened ? 1 : 0;
      amount +=
        Math.sign(target - amount) *
        Math.min(Math.abs(target - amount), delta * (reducedMotion ? 12 : 1.5));
      gate.rotation.y = -amount * 1.45;
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
