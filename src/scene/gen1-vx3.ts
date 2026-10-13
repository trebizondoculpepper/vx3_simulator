import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  PointLight,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type {
  Camera,
  Intersection,
  Material,
  MeshStandardMaterial,
  Object3D,
  Texture,
} from 'three';
import type { SoundCue, SoundSource } from '../audio/sound-engine';
import { assembleRack } from '../game/rack-catalogue';
import {
  PANEL_WIDTH,
  PART_LABEL_SIZE,
  RACK_GRID,
  RACK_UNIT,
  faceLayerOffset,
  layoutModule,
} from '../game/rack-layout';
import { componentCatalogue } from '../game/rig-model';
import { applyRack, knobLine } from '../game/rack-controls';
import type { RackControls, ToggleId } from '../game/rack-controls';
import type { RigState } from '../game/rig';
import { redlineFraction } from '../game/redlines';
import { ferrocoreAngularVelocity } from '../game/ferrocore-anomaly';
import { createPs1Material } from '../rendering/ps1-material';
import {
  createDialTexture,
  createLabelTexture,
  createNixieScreen,
  createScopeScreen,
} from './screens';
import { createThermionicValve } from './thermionic-valve';
import {
  knobDirection,
  mountRotaryKnob,
  stepKnob,
  stepSelector,
} from './rotary-knob';
import {
  createModuleBranding,
  createPanelHeader,
  createPanelLivery,
} from './panel-livery';

const panelWidth = PANEL_WIDTH;
const worldUnitsPerMetre = panelWidth / 0.4826;
// A panel is 19 inches across; one rack unit is 1.75 inches high.
const U = RACK_UNIT;
// Ten named instruments and one open 4U inspection bay fill a 42U cabinet.
const inspectionBayUnits = 4;
const modules = assembleRack();
const rackUnits =
  modules.reduce((sum, module) => sum + module.units, 0) + inspectionBayUnits;

/**
 * The first VX3's rack, in scene units: its height sets the floor of the
 * room built round it (the floor is half of it, and 0.23, below the
 * origin), which the lab still uses as its datum.
 */
export const GEN1_TOTAL_HEIGHT =
  rackUnits * U + (modules.length + 1) * 0.045 + 0.35;
/** Where the first VX3 stood: the main rack's front, and the side cabinet. */
export const GEN1_RACK_Z = 3.8;
export const GEN1_SIDE_CABINET = { x: 5.35, z: 2 };

/** What the first VX3 needs from the room it stands in. */
export interface Gen1Hookup {
  /** The floor's height, scene units. */
  floorY: number;
  rig: RigState;
  settings: RackControls;
  camera: Camera;
  /** A control worked by the operator. */
  input(
    object: Object3D,
    machine: string,
    name: string,
    action: (hit: Intersection) => void,
  ): void;
  /** A part driven by the machine, never clickable. */
  indicator<T extends Object3D>(object: T, machine: string, name: string): T;
  play(cue: SoundCue): void;
  write(line: string): void;
  flipToggle(id: ToggleId): void;
  flipMains(): void;
  resetRig(): void;
  purge(): void;
  reducedMotion(): boolean;
  /** The room's π, which the gauges read with. */
  pi(): number;
  /** How dark the room is, 0 (lit) to 1, for the machine's own glow. */
  darkness(): number;
}

/**
 * The first-generation VX3, retired from the lab after dangerous faults in
 * its turbo-encabulator: the 42U main rack with its ten instruments and
 * open inspection bay, the side cabinet with the Betaform amplifier, flux
 * emitter and B-E radiator, the six-station ferrocore drum, their
 * conduits, and the wall socket and mains lead. Every control works the
 * rig it is given. Built in the lab's coordinates, where it used to stand.
 */
export function createGen1Vx3(hookup: Gen1Hookup) {
  const {
    floorY,
    rig,
    settings,
    camera,
    input,
    indicator,
    play,
    write,
    flipToggle,
    flipMains,
    resetRig,
    purge,
    reducedMotion,
    pi,
  } = hookup;
  const group = new Group();
  group.name = 'Gen1 VX3';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const dynamic: Array<() => void> = [];
  const valves: Array<ReturnType<typeof createThermionicValve>> = [];
  const totalHeight = GEN1_TOTAL_HEIGHT;
  const rack = new Group();
  rack.position.z = GEN1_RACK_Z;
  group.add(rack);
  const material = (color: string, unlit = false, glow = false) => {
    const result = createPs1Material({ color }, unlit, glow);
    materials.push(result);
    return result;
  };
  // Indicator lamps glow in their own colour: bright when lit, all but
  // black when not, so they read in the dark.
  const lamps: MeshStandardMaterial[] = [];
  const glows = <T extends Mesh>(mesh: T) => {
    lamps.push(mesh.material as MeshStandardMaterial);
    return mesh;
  };
  const cube = (
    parent: Group,
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const disc = (
    parent: Group,
    radius: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(new CircleGeometry(radius, 12), material(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const label = (
    parent: Group,
    value: string,
    x: number,
    y: number,
    z: number,
    size = 11,
    ink = '#e3dcc4',
    plate = '#272a26',
  ) => {
    const image = createLabelTexture(value, { size, ink, plate });
    textures.push(image.texture);
    const mesh = new Mesh(
      new PlaneGeometry(image.width / 85, image.height / 85),
      createPs1Material({ map: image.texture }, true),
    );
    materials.push(mesh.material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // In the dark the machine lights the room by itself, faintly, when it is
  // running.
  const machineGlow = new PointLight('#7fd6b8', 0, 0, 2);
  machineGlow.position.set(0, floorY + 1.6 * worldUnitsPerMetre, 7.5);
  group.add(machineGlow);
  dynamic.push(() => {
    machineGlow.intensity = rig.controls.mains
      ? (5 + rig.field * 8) * (0.3 + 0.7 * hookup.darkness())
      : 0;
  });

  // A six-station ferrocore carousel occupies the companion rack's open bay.
  const drum = new Group();
  drum.position.set(5.35, floorY + 3.1, 2);
  drum.scale.setScalar(2);
  group.add(drum);
  for (const x of [-0.68, 0.68]) {
    cube(drum, 0.16, 1.58, 0.22, '#69736c', x, -0.72, -0.23);
    cube(drum, 0.35, 0.08, 0.53, '#3a403a', x, -1.49, -0.18);
  }
  cube(drum, 1.6, 0.13, 0.55, '#353c38', 0, -0.67, -0.22);
  const barrel = new Mesh(
    new CylinderGeometry(0.7, 0.7, 0.52, 12),
    material('#444943'),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.07;
  drum.add(barrel);
  const carousel = indicator(
    new Group(),
    'Ferrocore drum',
    'Carousel (turns with the spindle)',
  );
  drum.add(carousel);
  disc(carousel, 0.59, '#826953', 0, 0, 0.36);
  disc(carousel, 0.49, '#283733', 0, 0, 0.371);
  for (let station = 0; station < 6; station++) {
    const angle = (station / 6) * Math.PI * 2;
    const x = Math.sin(angle) * 0.4;
    const y = Math.cos(angle) * 0.4;
    disc(carousel, 0.145, '#b08a57', x, y, 0.385);
    disc(carousel, 0.11, '#2e3835', x, y, 0.392);
    const core = new Mesh(
      new TorusGeometry(0.072, 0.035, 4, 8),
      material(station < 4 ? '#d6c6a0' : '#918d72'),
    );
    core.position.set(x, y, 0.413);
    carousel.add(core);
  }
  disc(carousel, 0.115, '#e0a752', 0, 0, 0.4);
  disc(carousel, 0.055, '#413b2c', 0, 0, 0.409);
  cube(drum, 0.16, 0.34, 0.13, '#c49b5c', 0.82, 0.07, 0.28);
  disc(drum, 0.065, '#c6d7ba', 0.82, 0.31, 0.37);
  label(drum, 'FERROCORE DRUM / 1-6', 0, 0.89, 0.33, 10);
  const coreConduit = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(2.1, floorY + 3.0, 0.06),
        new Vector3(2.75, floorY + 2.75, 0.4),
        new Vector3(3.45, floorY + 2.9, 1.3),
        new Vector3(3.9, floorY + 3.1, 1.8),
      ]),
      14,
      0.12,
      6,
      false,
    ),
    material('#262b28'),
  );
  group.add(coreConduit);
  // The side cabinet carries the downstream amplifier, emitter and cooler.
  const sideCabinet = new Group();
  sideCabinet.position.set(5.35, floorY + 8.85, 2);
  group.add(sideCabinet);
  // A shorter 19-inch companion rack: the three bolted instrument blocks
  // occupy its top rails, with the lower frame left deliberately empty.
  cube(sideCabinet, 4.8, 10.6, 0.08, '#1b2522', 0, -3.53, -5.17);
  cube(sideCabinet, 5.1, 0.15, 5.45, '#727a69', 0, 1.82, -2.5);
  cube(sideCabinet, 5.1, 0.15, 5.45, '#727a69', 0, -8.85, -2.5);
  for (const x of [-2.42, 2.42]) {
    for (const z of [-5.1, 0.2])
      cube(sideCabinet, 0.15, 10.6, 0.22, '#7d806f', x, -3.53, z);
    for (const y of [-1.62, -0.55, 0.55, 1.62])
      disc(sideCabinet, 0.045, '#d5bd87', x, y, 0.37);
  }
  const sideUnits = [
    { maker: 'NEUMANN DYNAMIK', title: '7-STAGE BETAFORM AMP', y: 1.1 },
    { maker: 'VOLT XOCCULA', title: 'ISOLATED-FRAME FLUX EMITTER', y: 0 },
    { maker: 'SYNCLEX', title: 'NANOCORE B-E RADIATOR', y: -1.1 },
  ];
  for (const unit of sideUnits) {
    cube(sideCabinet, panelWidth, 1.03, 3.0, '#424b45', 0, unit.y, -1.25);
    const skin = createPanelLivery(unit.maker, '#424b45', 3);
    textures.push(skin);
    const skinMesh = new Mesh(
      new PlaneGeometry(panelWidth - 0.08, 1),
      createPs1Material({ map: skin }, true),
    );
    materials.push(skinMesh.material);
    skinMesh.position.set(0, unit.y, 0.31);
    sideCabinet.add(skinMesh);
    const header = createPanelHeader(unit.maker, unit.title);
    textures.push(header);
    const headerMesh = new Mesh(
      new PlaneGeometry(panelWidth - 0.18, 0.24),
      createPs1Material({ map: header }, true),
    );
    materials.push(headerMesh.material);
    headerMesh.position.set(0, unit.y + 0.36, 0.36);
    sideCabinet.add(headerMesh);
    for (const x of [-2.05, 2.05])
      for (const y of [unit.y - 0.4, unit.y + 0.4])
        disc(sideCabinet, 0.06, '#d5bd87', x, y, 0.39);
  }
  for (let stage = 0; stage < 7; stage++) {
    const x = -0.77 + stage * 0.25;
    const lamp = indicator(
      glows(disc(sideCabinet, 0.075, '#413b30', x, 0.96, 0.39)),
      'Side cabinet',
      `Betaform stage ${stage + 1} lamp`,
    );
    dynamic.push(() => {
      (lamp.material as ReturnType<typeof material>).color.set(
        // A stage lights once the heaters reach it and the gain switches it in.
        rig.heater > (stage + 1) / 8 &&
          Math.round(settings.knobs.ampGain * 7) > stage
          ? '#f3b157'
          : '#413b30',
      );
    });
  }
  const ampKnob = new Mesh(
    new CylinderGeometry(0.13, 0.13, 0.12, 10),
    material('#293330'),
  );
  ampKnob.rotation.x = Math.PI / 2;
  ampKnob.position.set(0.73, 0.7, 0.43);
  sideCabinet.add(ampKnob);
  const ampMarker = cube(
    sideCabinet,
    0.02,
    0.075,
    0.01,
    '#e7d6ad',
    0.73,
    0.77,
    0.5,
  );
  const ampPivot = mountRotaryKnob(ampKnob, ampMarker);
  dynamic.push(() => {
    ampPivot.rotation.z = -(settings.knobs.ampGain - 0.5) * 4.4;
  });
  const turnAmp = (hit: Intersection) => {
    settings.knobs.ampGain = stepKnob(
      settings.knobs.ampGain,
      knobDirection(ampPivot, hit.point, camera),
    );
    applyRack(settings, rig.controls);
    play('knob');
    write(
      `Betaform stage gain to ${(settings.knobs.ampGain * 10).toFixed(1)}.`,
    );
  };
  for (const part of [ampKnob, ampMarker])
    input(part, 'Side cabinet', 'Betaform stage gain knob', turnAmp);
  disc(sideCabinet, 0.25, '#d7ad6b', 0, -0.11, 0.39);
  disc(sideCabinet, 0.16, '#273d3e', 0, -0.11, 0.4);
  const emitterLamp = indicator(
    glows(disc(sideCabinet, 0.09, '#33433e', 0, -0.11, 0.41)),
    'Side cabinet',
    'Flux emitter lamp',
  );
  dynamic.push(() => {
    (emitterLamp.material as ReturnType<typeof material>).color.set(
      rig.field > 0.2 ? '#7ce5c5' : '#33433e',
    );
  });
  for (let fin = 0; fin < 9; fin++)
    cube(
      sideCabinet,
      0.09,
      0.28,
      0.12,
      '#a2ad9d',
      -0.72 + fin * 0.18,
      -1.2,
      0.4,
    );
  const sideConduit = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(3.84, floorY + 1.55, 0),
        new Vector3(4.28, floorY + 1.95, 0.03),
        new Vector3(4.2, floorY + 2.72, 0),
      ]),
      12,
      0.07,
      6,
      false,
    ),
    material('#272d2a'),
  );
  group.add(sideConduit);

  // The wall outlet and the trailing rubber mains lead are visible at rack base.
  const socketX = -5.6;
  cube(group, 0.52, 0.7, 0.08, '#c9bf9f', socketX, floorY + 2.5, -3.62);
  cube(group, 0.35, 0.45, 0.018, '#eee2bd', socketX, floorY + 2.5, -3.56);
  for (const x of [socketX - 0.08, socketX + 0.08]) {
    disc(group, 0.037, '#3c3b31', x, floorY + 2.56, -3.54);
  }
  disc(group, 0.045, '#3c3b31', socketX, floorY + 2.4, -3.54);
  cube(group, 0.18, 0.15, 0.13, '#403f36', socketX, floorY + 2.24, -3.46);
  label(
    group,
    '240 V / ISOLATED',
    socketX,
    floorY + 3.03,
    -3.58,
    8,
    '#e3d8b7',
    '#343d38',
  );
  const cable = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(socketX, floorY + 2.24, -3.4),
        new Vector3(socketX, floorY + 1.45, -3.05),
        new Vector3(-4.35, floorY + 0.04, -1.75),
        new Vector3(-4.15, floorY + 0.04, -0.2),
        new Vector3(-3.2, floorY + 0.04, 0.55),
        new Vector3(-2.55, floorY + 0.08, 0.28),
        new Vector3(-2.4, floorY + 0.28, -0.3),
      ]),
      48,
      0.055,
      5,
      false,
    ),
    material('#302e2a'),
  );
  group.add(cable);

  // 825 mm deep enclosure, using the published 42U AV rack footprint.
  const cabinetDepth = 0.825 * worldUnitsPerMetre;
  const cabinetCentreZ = -0.15 - cabinetDepth / 2;
  cube(
    rack,
    5.05,
    totalHeight + 0.25,
    cabinetDepth,
    '#242724',
    0,
    0,
    cabinetCentreZ,
  );
  for (const x of [-2.5, 2.5]) {
    cube(
      rack,
      0.08,
      totalHeight + 0.25,
      cabinetDepth,
      '#313a35',
      x,
      0,
      cabinetCentreZ,
    );
  }
  cube(
    rack,
    4.65,
    totalHeight + 0.12,
    0.05,
    '#111b1a',
    0,
    0,
    -0.15 - cabinetDepth,
  );
  for (const x of [-2.38, 2.38]) {
    cube(rack, 0.16, totalHeight + 0.3, 0.54, '#353a37', x, 0, 0.03);
    cube(
      rack,
      0.035,
      totalHeight + 0.3,
      0.58,
      '#a3a18a',
      x + (x < 0 ? 0.11 : -0.11),
      0,
      0.13,
    );
  }
  cube(
    rack,
    5.2,
    0.18,
    cabinetDepth,
    '#3e423b',
    0,
    totalHeight / 2 + 0.08,
    cabinetCentreZ,
  );
  cube(
    rack,
    5.2,
    0.18,
    cabinetDepth,
    '#30332f',
    0,
    -totalHeight / 2 - 0.08,
    cabinetCentreZ,
  );
  const antennaX = -1.55;
  const antennaBaseY = totalHeight / 2 + 0.17;
  cube(rack, 0.35, 0.12, 0.32, '#d0c49c', antennaX, antennaBaseY, 0);
  const mast = new Mesh(
    new CylinderGeometry(0.045, 0.07, 0.85, 7),
    material('#b6bbb0'),
  );
  mast.position.set(antennaX, antennaBaseY + 0.47, 0);
  rack.add(mast);
  cube(rack, 0.72, 0.045, 0.045, '#c0c4b8', antennaX, antennaBaseY + 0.65, 0);
  for (const x of [antennaX - 0.38, antennaX + 0.38]) {
    cube(rack, 0.04, 0.18, 0.04, '#c0c4b8', x, antennaBaseY + 0.65, 0);
  }
  disc(rack, 0.085, '#e4b775', antennaX, antennaBaseY + 0.92, 0.035);

  // Inside a part's slot the mounting face is at z 0.25, on the controls
  // layer; labels sit on the labels layer, 1 mm in front of it.
  const SLOT_LABEL_Z =
    0.25 + faceLayerOffset('labels') - faceLayerOffset('controls');
  // Each maker's home town, from the lore catalogue, for its nameplate.
  const makerOrigins = new Map(
    componentCatalogue.map((component) => [
      component.manufacturer.name.toUpperCase(),
      component.manufacturer.origin,
    ]),
  );
  const addGauge = (
    panel: Group,
    x: number,
    y: number,
    reading: () => number,
    caption: string,
    machine: string,
    redline: number | null,
  ) => {
    const dial = createDialTexture(redline);
    textures.push(dial);
    const face = new Mesh(
      new PlaneGeometry(0.69, 0.69),
      createPs1Material({ map: dial }, true),
    );
    materials.push(face.material);
    // The dial face sits on the controls layer; the slot puts z 0.25 there.
    face.position.set(x, y, 0.25);
    panel.add(face);
    const needle = cube(panel, 0.018, 0.28, 0.012, '#a63425', x, y, 0.262);
    needle.geometry.translate(0, 0.13, 0);
    indicator(face, machine, `${caption} gauge`);
    indicator(needle, machine, `${caption} gauge`);
    dynamic.push(() => {
      needle.rotation.z =
        pi() * (0.75 - Math.max(0, Math.min(1, reading())) * 1.5);
    });
    label(panel, caption, x, y - 0.47, SLOT_LABEL_Z, 9);
  };

  let top = totalHeight / 2 - 0.2;
  const bands = ['A', 'B', 'C', 'D', 'E', 'Ω'];
  const soundPanels: Array<[SoundSource, Group]> = [];
  for (const [moduleIndex, module] of modules.entries()) {
    const h = module.units * U;
    const y = top - h / 2;
    const panel = new Group();
    panel.position.y = y;
    rack.add(panel);
    soundPanels.push([module.id.split('-')[0] as SoundSource, panel]);
    // The faceplate is built in layers, 1 mm apart (FACE_LAYERS in
    // rack-layout.ts): bare metal, the maker's branding, the controls and
    // dials, then the labels.
    cube(panel, panelWidth, h - 0.055, 0.27, '#8a8f87', 0, 0, 0.04);
    const metalZ = 0.04 + 0.27 / 2;
    const layout = layoutModule(module, U);
    const faceSize = { width: panelWidth - 0.22, height: h - 0.055 };
    const branding = createModuleBranding(
      module.maker,
      module.title,
      module.finish,
      module.units,
      makerOrigins.get(module.maker),
      { face: faceSize, title: layout.title, halfWidth: RACK_GRID.halfWidth },
    );
    textures.push(branding);
    const brandingPlate = new Mesh(
      new PlaneGeometry(faceSize.width, faceSize.height),
      createPs1Material({ map: branding }, true),
    );
    materials.push(brandingPlate.material);
    brandingPlate.position.z = metalZ + faceLayerOffset('branding');
    panel.add(brandingPlate);
    // A trim rule along the top edge, standing on the branding.
    cube(
      panel,
      4.1,
      0.025,
      0.015,
      '#adb0a0',
      0,
      h / 2 - 0.1,
      metalZ + faceLayerOffset('branding') + 0.0075,
    );
    for (const x of [-2.1, 2.1]) {
      cube(panel, 0.2, h - 0.04, 0.32, '#6c7169', x, 0, 0.1);
      for (const screwY of [-h / 2 + 0.16, h / 2 - 0.16]) {
        disc(panel, 0.055, '#bcaa81', x, screwY, 0.27);
        cube(panel, 0.068, 0.01, 0.008, '#514936', x, screwY, 0.279);
      }
      if (module.units >= 4) {
        cube(
          panel,
          0.065,
          0.65,
          0.16,
          '#252825',
          x + (x < 0 ? 0.16 : -0.16),
          0,
          0.29,
        );
      }
    }
    // Everything on the faceplate sits on its grid (src/game/rack-layout.ts),
    // so nothing can overprint the nameplate, the footer or a neighbour.
    // The footer carries the module stamp on the right and vents on the left.
    label(
      panel,
      module.id.toUpperCase(),
      1.55,
      layout.footer.y,
      metalZ + faceLayerOffset('labels'),
      6,
      '#342d20',
      '#c6b68e',
    );
    for (let vent = 0; vent < 5; vent++)
      cube(
        panel,
        0.29,
        0.025,
        0.015,
        '#1d2423',
        -1.62 + vent * 0.1,
        layout.footer.y,
        metalZ + faceLayerOffset('controls') + 0.0075,
      );

    for (const part of layout.parts) {
      // Each part is drawn at its natural size around its cell's centre,
      // then scaled to fit; depth is left alone.
      const slot = new Group();
      // Parts are drawn with their mounting face at z 0.25; this puts it on
      // the controls layer.
      slot.position.set(
        part.rect.x,
        part.rect.y,
        metalZ + faceLayerOffset('controls') - 0.25,
      );
      slot.scale.set(part.scale, part.scale, 1);
      panel.add(slot);
      const machine = `VX3 rack · ${module.id.toUpperCase()}`;
      if (part.source.list === 'controls') {
        const control = module.controls[part.source.index];
        if (part.kind === 'valve') {
          const toggleId = control.kind === 'toggle' ? control.id : 'ht';
          const valve = createThermionicValve();
          indicator(valve.group, machine, `${control.label} valve`);
          slot.add(valve.group);
          valves.push(valve);
          dynamic.push(() =>
            valve.update(
              rig.heater *
                (settings.toggles.ht ? 1 : 0.03) *
                (settings.toggles[toggleId] ? 1 : 0.08),
              performance.now() / 1000,
              reducedMotion(),
            ),
          );
          continue;
        }
        if (control.kind === 'knob' || control.kind === 'selector') {
          const cy = 0.1;
          disc(slot, 0.26, '#1e2422', 0, cy, 0.25);
          const knobPivot = new Group();
          knobPivot.position.set(0, cy, 0.35);
          slot.add(knobPivot);
          const knob = new Mesh(
            new CylinderGeometry(0.18, 0.2, 0.13, 12),
            material(control.kind === 'selector' ? '#8b7853' : '#252928'),
          );
          knob.rotation.x = Math.PI / 2;
          knobPivot.add(knob);
          const mark = cube(
            knobPivot,
            0.025,
            0.12,
            0.012,
            '#e7d6ad',
            0,
            0.11,
            0.08,
          );
          const id = control.id;
          dynamic.push(() => {
            knobPivot.rotation.z = -(settings.knobs[id] - 0.5) * 4.4;
          });
          const turn = (hit: Intersection) => {
            const direction = knobDirection(knobPivot, hit.point, camera);
            if (control.kind === 'knob') {
              settings.knobs[id] = stepKnob(settings.knobs[id], direction);
              applyRack(settings, rig.controls);
              play('knob');
              write(knobLine(id, settings.knobs[id]));
            } else {
              // The band switch stops at A and at Ω, like any selector.
              const band = stepSelector(
                Math.round(settings.knobs[id] * (bands.length - 1)),
                direction,
                bands.length,
              );
              settings.knobs[id] = band / (bands.length - 1);
              play('selector');
              write(`Band ${bands[band]} selected.`);
            }
          };
          for (const part of [knob, mark])
            input(part, machine, `${control.label} ${control.kind}`, turn);
          label(slot, control.label, 0, -0.28, SLOT_LABEL_Z, PART_LABEL_SIZE);
        } else if (control.kind === 'button') {
          const cy = 0.11;
          disc(slot, 0.24, '#202521', 0, cy, 0.25);
          const color =
            control.id === 'reset'
              ? '#638960'
              : control.id === 'purge'
                ? '#b29952'
                : '#ad5946';
          const button = cube(slot, 0.26, 0.2, 0.12, color, 0, cy, 0.35);
          input(button, machine, `${control.label} button`, () => {
            play('button');
            if (control.id === 'reset') resetRig();
            else if (control.id === 'purge') purge();
            else {
              if (rig.controls.mains)
                rig.strain = Math.min(1, rig.strain + 0.15);
              play('spark');
              write('Pressed DO NOT. The annotation was unspecific.');
            }
          });
          label(slot, control.label, 0, -0.27, SLOT_LABEL_Z, PART_LABEL_SIZE);
        } else {
          const cy = 0.05;
          const id = control.kind === 'toggle' ? control.id : null;
          const isOn = () => (id ? settings.toggles[id] : settings.mains);
          disc(slot, 0.2, '#1e2220', 0, cy, 0.25);
          const switchBody = cube(
            slot,
            0.18,
            0.26,
            0.15,
            control.kind === 'mains' ? '#ab4933' : '#c5bda5',
            0,
            cy,
            0.36,
          );
          const lamp = indicator(
            glows(disc(slot, 0.05, '#473829', 0, 0.34, 0.28)),
            machine,
            `${control.label} lamp`,
          );
          dynamic.push(() => {
            switchBody.rotation.x = isOn() ? -0.45 : 0.45;
            (lamp.material as ReturnType<typeof material>).color.set(
              isOn() && rig.heater > 0 ? '#f7a344' : '#473829',
            );
          });
          input(switchBody, machine, `${control.label} switch`, () => {
            if (id) flipToggle(id);
            else flipMains();
          });
          label(slot, control.label, 0, -0.3, SLOT_LABEL_Z, PART_LABEL_SIZE);
        }
        continue;
      }
      const instrument = module.instruments[part.source.index].kind;
      if (instrument === 'scope') {
        const scope = createScopeScreen(96, 64);
        textures.push(scope.texture);
        const screen = new Mesh(
          new PlaneGeometry(1.15, 0.77),
          createPs1Material({ map: scope.texture }, true, true),
        );
        materials.push(screen.material);
        screen.position.set(0, 0, 0.29);
        slot.add(indicator(screen, machine, 'Oscilloscope'));
        dynamic.push(() => {
          const points: [number, number][] = Array.from(
            { length: 40 },
            (_, i) => [
              i / 39,
              0.5 +
                Math.sin(
                  i * (0.45 + settings.knobs.ratio) + performance.now() * 0.003,
                ) *
                  rig.field *
                  // The betaform amplifier feeds both monitors.
                  (0.4 + settings.knobs.ampGain) *
                  (0.08 +
                    settings.knobs[
                      module.id === 'monitor-b' ? 'detectorGain' : 'gain'
                    ] *
                      0.2 +
                    rig.instability * 0.15),
            ],
          );
          // Each monitor's BLATZ switch puts the field on its own trace.
          scope.draw(
            points,
            rig.controls.mains &&
              settings.toggles[
                module.id === 'monitor-b' ? 'detectorBlatz' : 'blatz'
              ],
          );
        });
      } else if (instrument === 'nixie') {
        const nixie = createNixieScreen();
        textures.push(nixie.texture);
        const screen = new Mesh(
          new PlaneGeometry(1.15, 0.3),
          createPs1Material({ map: nixie.texture }, true, true),
        );
        materials.push(screen.material);
        screen.position.set(0, 0, 0.29);
        slot.add(indicator(screen, machine, 'Nixie counter'));
        dynamic.push(() =>
          nixie.draw(
            String(
              Math.round(
                module.id.startsWith('monitor')
                  ? 38 + rig.instability * 400
                  : rig.spindle * 3600,
              ),
            ).padStart(6, '0'),
            rig.controls.mains,
          ),
        );
      } else {
        const reading =
          instrument === 'heater'
            ? () => rig.heater
            : instrument === 'spindle'
              ? () => rig.spindle
              : instrument === 'field'
                ? () => rig.field
                : () => rig.instability;
        addGauge(
          slot,
          0,
          0.115,
          reading,
          instrument.toUpperCase(),
          machine,
          instrument === 'spindle'
            ? redlineFraction('spindle')
            : instrument === 'field'
              ? redlineFraction('field')
              : null,
        );
      }
    }
    top -= h + 0.045;
    if (moduleIndex !== 4) continue;
    const bayHeight = inspectionBayUnits * U;
    const bayY = top - bayHeight / 2;
    const bay = new Group();
    bay.position.y = bayY;
    rack.add(bay);
    cube(bay, panelWidth, bayHeight - 0.055, 0.08, '#202924', 0, 0, -0.03);
    for (const x of [-2.12, 2.12]) {
      cube(bay, 0.17, bayHeight - 0.04, 0.27, '#6c7169', x, 0, 0.08);
      for (const y of [-bayHeight / 2 + 0.16, bayHeight / 2 - 0.16])
        disc(bay, 0.055, '#bcaa81', x, y, 0.27);
    }
    // A removed inspection panel reveals a dense loom and live field taps.
    cube(bay, 3.8, bayHeight - 0.22, 0.03, '#0b1517', 0, 0, -0.01);
    for (let i = 0; i < 13; i++) {
      const x = -1.7 + i * 0.28;
      const wire = new Mesh(
        new TubeGeometry(
          new CatmullRomCurve3([
            new Vector3(x, bayHeight / 2 - 0.15, 0.08),
            new Vector3(x + Math.sin(i * 2.7) * 0.45, 0.25, 0.18),
            new Vector3(x + Math.cos(i * 1.9) * 0.5, -0.25, 0.12),
            new Vector3(
              x + Math.sin(i * 3.1) * 0.3,
              -bayHeight / 2 + 0.15,
              0.07,
            ),
          ]),
          18,
          0.025 + (i % 3) * 0.007,
          5,
          false,
        ),
        material(['#bc604a', '#d1aa54', '#5c8584', '#aca68c'][i % 4]),
      );
      bay.add(wire);
    }
    for (const x of [-1.38, 0.18, 1.42]) {
      const glow = material('#354846', true, true);
      const node = new Mesh(new CircleGeometry(0.13, 8), glow);
      node.position.set(x, -0.25 + x * 0.17, 0.23);
      bay.add(indicator(node, 'VX3 rack · FIELD BUS', 'Field tap'));
      dynamic.push(() => {
        const pulse = (Math.sin(performance.now() / 580 + x * 3) + 1) / 2;
        glow.color.set(rig.controls.mains ? '#3fe8c3' : '#354846');
        glow.color.multiplyScalar(
          rig.controls.mains ? 0.45 + pulse * 0.55 : 0.6 + pulse * 0.18,
        );
      });
    }
    label(bay, 'FIELD BUS / PANEL REMOVED', 0, bayHeight / 2 - 0.17, 0.23, 8);
    top -= bayHeight + 0.045;
  }

  // Each continuous sound comes from the middle of the panels that make it.
  const soundSources = () => {
    group.updateMatrixWorld(true);
    const centres = new Map<SoundSource, Vector3[]>();
    for (const [source, panel] of soundPanels) {
      const list = centres.get(source) ?? [];
      list.push(panel.localToWorld(new Vector3(0, 0, 0.2)));
      centres.set(source, list);
    }
    return [...centres].map(([id, points]) => {
      const centre = points
        .reduce((sum, point) => sum.add(point), new Vector3())
        .divideScalar(points.length);
      return { id, x: centre.x, y: centre.y, z: centre.z };
    });
  };

  return {
    group,
    /** Where each of the machine's sounds comes from, in world units. */
    soundSources,
    /** Follow the rig: lamps, needles, screens, valves, drum and glow. */
    update(delta: number) {
      for (const step of dynamic) step();
      if (!reducedMotion())
        carousel.rotation.z -= ferrocoreAngularVelocity(rig) * delta;
      for (const item of lamps)
        item.emissive.copy(item.color).multiply(item.color);
    },
    dispose() {
      for (const valve of valves) valve.dispose();
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
