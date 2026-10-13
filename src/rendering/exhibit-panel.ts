import { BoxGeometry, Color, Group, Mesh } from 'three';
import type { MeshStandardMaterial, Object3D, Texture } from 'three';
import { createPs1Material } from './ps1-material';
import { createMicroLabel } from '../scene/eighties-controls';
import type { PanelKit } from '../scene/eighties-controls';
import { createKnob, createToggle } from '../scene/panel-switchgear';
import { stepKnob, stepSelector } from '../scene/rotary-knob';
import { createSmokeEmitter } from '../scene/smoke-emitter';
import { createEmbers } from '../scene/embers';

/** A surface the TEXTURE selector can put on an exhibit. */
export interface ExhibitTexture {
  /** Short legend under the selector. */
  name: string;
  /** null keeps the exhibit's own texture. */
  map: Texture | null;
}

/** Detents across the GLOW and REFLECT knobs. */
const KNOB_STEPS = 10;

/**
 * A small panel for one exhibit in the effects room: GLOW, a TEXTURE
 * selector and REFLECT knobs, then SMOKE and EMBERS switches. The knobs
 * work the exhibit's own materials; the smoke and embers rise from
 * `plume`, a point at the exhibit's top. Built in metres, facing +z, 0.5 m
 * wide; scale it to the room's units.
 */
export function createExhibitPanel(
  kit: PanelKit,
  name: string,
  surfaces: MeshStandardMaterial[],
  plume: Object3D,
  {
    textures,
    reflections,
  }: { textures: ExhibitTexture[]; reflections: Texture },
) {
  const group = new Group();
  const plate = createPs1Material({ color: '#c3c7c0' });
  kit.materials.push(plate);
  const face = new Mesh(new BoxGeometry(0.5, 0.17, 0.01), plate);
  face.position.z = -0.005;
  group.add(face);
  const parts = new Group();
  parts.scale.setScalar(2.2);
  group.add(parts);
  const caption = (text: string, x: number, y: number, height = 0.0042) => {
    const label = createMicroLabel(kit, text, { height, ink: '#22231f' });
    label.position.set(x, y, 0.0005);
    parts.add(label);
  };
  caption(name, 0, 0.029, 0.0075);

  const uses = new Map<Object3D, (direction?: number) => void>();
  const updates: ((delta: number) => void)[] = [];
  const own = surfaces.map((surface) => ({
    map: surface.map,
    colour: surface.color.clone(),
  }));
  let glow = 0;
  let texture = 0;
  let reflect = 0;
  let smoking = false;
  let burning = false;
  const apply = () => {
    surfaces.forEach((surface, i) => {
      const map = textures[texture].map ?? own[i].map;
      const shiny = reflect > 0 ? reflections : null;
      if (surface.map !== map || surface.envMap !== shiny) {
        surface.map = map;
        surface.envMap = shiny;
        surface.needsUpdate = true;
      }
      // A textured surface shows its texture under its own colour; glowing,
      // it lights itself in the same colour.
      surface.color.copy(
        map && !own[i].map
          ? own[i].colour.clone().lerp(WHITE, 0.6)
          : own[i].colour,
      );
      surface.emissive.copy(own[i].colour).multiplyScalar(glow);
      surface.emissiveMap = glow > 0 ? map : null;
      surface.metalness = reflect;
      surface.roughness = 1 - reflect * 0.85;
      surface.envMapIntensity = reflect * 1.5;
    });
  };

  const x = (i: number) => -0.088 + i * 0.044;
  const knob = (
    i: number,
    label: string,
    read: () => number,
    write: (share: number) => void,
    steps?: number,
  ) => {
    const made = createKnob(kit, {
      radius: 0.01,
      style: steps ? 'pointer' : 'skirted',
      scale: true,
      ink: '#2b2a25',
      value: read(),
    });
    made.group.position.set(x(i), 0.005, 0);
    parts.add(made.group);
    uses.set(made.group, (direction = 1) => {
      write(direction);
      made.set(read());
      apply();
    });
    updates.push(made.update);
    caption(label, x(i), -0.016);
  };
  knob(
    0,
    'GLOW',
    () => glow,
    (direction) => (glow = stepKnob(glow, direction, KNOB_STEPS)),
  );
  const last = textures.length - 1;
  knob(
    1,
    'TEXTURE',
    () => texture / last,
    (direction) =>
      (texture = stepSelector(texture, direction, textures.length)),
    textures.length,
  );
  caption(textures.map((t) => t.name).join(' '), x(1), -0.0255, 0.003);
  knob(
    2,
    'REFLECT',
    () => reflect,
    (direction) => (reflect = stepKnob(reflect, direction, KNOB_STEPS)),
  );
  const toggle = (i: number, label: string, flip: () => boolean) => {
    const made = createToggle(kit, false);
    made.group.position.set(x(i), 0.005, 0);
    parts.add(made.group);
    uses.set(made.group, () => made.set(flip()));
    updates.push(made.update);
    caption(label, x(i), -0.016);
  };
  toggle(3, 'SMOKE', () => (smoking = !smoking));
  toggle(4, 'EMBERS', () => (burning = !burning));

  const smoke = createSmokeEmitter();
  const embers = createEmbers();
  plume.add(smoke.group, embers.group);

  return {
    group,
    uses,
    update(seconds: number, delta: number, reducedMotion: boolean) {
      smoke.update(seconds, smoking ? 1 : 0, reducedMotion);
      smoke.group.visible = smoking;
      embers.update(seconds, burning ? 1 : 0, reducedMotion);
      for (const step of updates) step(delta);
    },
    dispose() {
      smoke.dispose();
      embers.dispose();
    },
  };
}

const WHITE = new Color('#ffffff');
