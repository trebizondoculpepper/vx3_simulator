import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three';
import type { BufferGeometry, Material, Object3D, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createLabelTexture } from './screens';

export interface ToolRackTool {
  name: string;
  /** Every mesh of the tool, for clicking. */
  parts: Object3D[];
  /** What the logbook says when somebody handles it. */
  note: string;
}

/**
 * A pegboard shadow board for everyday VX3 work: an adjustable wrench, a
 * graded set of screwdrivers, a pair of pliers, and a large machete hung
 * apart from the rest for severing the mains feed in a real emergency.
 * Each tool has its outline painted behind it, so a missing one shows.
 * The group's origin is the centre of the board on the wall surface, and
 * the board faces +z.
 */
export function createToolRack(worldUnitsPerMetre: number) {
  const m = worldUnitsPerMetre;
  const group = new Group();
  group.name = 'ToolRack';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const paint = (color: string) => {
    const material = createPs1Material({ color });
    materials.push(material);
    return material;
  };
  const mesh = (
    geometry: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: Object3D = group,
  ) => {
    const result = new Mesh(geometry, paint(color));
    result.position.set(x * m, y * m, z * m);
    parent.add(result);
    return result;
  };
  /** A box sized in metres. */
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: Object3D = group,
  ) => mesh(new BoxGeometry(w * m, h * m, d * m), color, x, y, z, parent);
  const outline = (w: number, h: number, x: number, y: number, tilt = 0) => {
    box(w + 0.014, h + 0.014, 0.001, '#2e2a22', x, y, 0.0065).rotation.z = tilt;
  };
  const hook = (x: number, y: number) =>
    box(0.008, 0.008, 0.05, '#9a9a90', x, y, 0.03);

  // Hardboard on battens, with a grid of peg holes.
  const width = 1.2;
  const height = 0.9;
  box(width + 0.05, height + 0.05, 0.02, '#4a3a26', 0, 0, 0.01);
  box(width, height, 0.006, '#9b7b52', 0, 0, 0.023);
  for (let x = -width / 2 + 0.05; x < width / 2; x += 0.05)
    for (let y = -height / 2 + 0.05; y < height / 2; y += 0.05)
      box(0.008, 0.008, 0.001, '#5b4630', x, y, 0.0265);

  const tools: ToolRackTool[] = [];
  const tool = (name: string, note: string) => {
    const holder = new Group();
    group.add(holder);
    const parts: Object3D[] = [];
    tools.push({ name, parts, note });
    return {
      holder,
      add(item: Mesh) {
        parts.push(item);
        return item;
      },
    };
  };

  // Adjustable wrench, hung by the hole in its handle.
  {
    const { holder, add } = tool(
      'wrench',
      'Adjustable wrench, 250 mm. Jaw set to 17 mm, which fits the ferrocore bearing caps and nothing else.',
    );
    const x = -0.46;
    outline(0.04, 0.3, x, 0.18);
    hook(x, 0.31);
    add(box(0.035, 0.24, 0.012, '#8d918c', x, 0.15, 0.04, holder));
    // Open-ended head: a jaw slot cut up into it and the worm screw.
    add(box(0.085, 0.06, 0.016, '#9da19b', x, 0.0, 0.04, holder));
    add(box(0.024, 0.04, 0.004, '#4a3a26', x, -0.012, 0.049, holder));
    add(
      mesh(
        new CylinderGeometry(0.009 * m, 0.009 * m, 0.03 * m, 6),
        '#5f625c',
        x + 0.022,
        0.045,
        0.04,
        holder,
      ),
    );
  }

  // Screwdrivers in a row of clips, largest on the left.
  {
    const { holder, add } = tool(
      'screwdrivers',
      'Screwdriver set, five sizes. The smallest is the only one anybody uses; the largest is mostly for prising off panel fascias.',
    );
    const colors = ['#b8241c', '#d8b23a', '#2f5f8a', '#b8241c', '#c9a46a'];
    box(0.42, 0.025, 0.04, '#55554c', -0.16, 0.3, 0.035);
    for (const [i, color] of colors.entries()) {
      const x = -0.32 + i * 0.08;
      const shaft = 0.2 - i * 0.025;
      const grip = 0.11 - i * 0.008;
      const top = 0.29;
      outline(0.035, grip + shaft, x, top - (grip + shaft) / 2);
      add(
        mesh(
          new CylinderGeometry(0.016 * m, 0.014 * m, grip * m, 6),
          color,
          x,
          top - grip / 2,
          0.05,
          holder,
        ),
      );
      add(
        mesh(
          new CylinderGeometry(0.0035 * m, 0.0035 * m, shaft * m, 4),
          '#c4c6c0',
          x,
          top - grip - shaft / 2,
          0.05,
          holder,
        ),
      );
    }
  }

  // Combination pliers with red dipped grips, hung jaws up.
  {
    const { holder, add } = tool(
      'pliers',
      'Combination pliers, insulated to 1000 V. The insulation has been tested by experience.',
    );
    const x = 0.24;
    outline(0.1, 0.22, x, 0.18);
    hook(x, 0.31);
    for (const side of [-1, 1]) {
      const handle = add(
        box(
          0.02,
          0.13,
          0.014,
          '#b8241c',
          x + side * 0.025,
          0.11,
          0.042,
          holder,
        ),
      );
      handle.rotation.z = side * 0.18;
    }
    add(box(0.03, 0.03, 0.02, '#7d807a', x, 0.2, 0.042, holder));
    add(box(0.022, 0.07, 0.014, '#8d918c', x, 0.25, 0.042, holder));
  }

  // Small hand trowel, hung handle up, for scooping cadmium chips.
  {
    const { holder, add } = tool(
      'trowel',
      'Hand trowel, stainless, 75 mm blade. For moving cadmium chips from the bin to the chute. Never by hand, never with the tea spoon.',
    );
    const x = 0.47;
    outline(0.075, 0.3, x, 0.16);
    hook(x, 0.31);
    add(
      mesh(
        new CylinderGeometry(0.014 * m, 0.016 * m, 0.11 * m, 6),
        '#8a5a2e',
        x,
        0.245,
        0.045,
        holder,
      ),
    );
    add(
      mesh(
        new CylinderGeometry(0.011 * m, 0.011 * m, 0.03 * m, 6),
        '#b9a46a',
        x,
        0.175,
        0.045,
        holder,
      ),
    );
    add(box(0.008, 0.035, 0.008, '#8d918c', x, 0.145, 0.045, holder));
    add(box(0.07, 0.1, 0.004, '#c4c6c0', x, 0.075, 0.04, holder));
    const point = add(
      box(0.05, 0.05, 0.004, '#c4c6c0', x, 0.025, 0.04, holder),
    );
    point.rotation.z = Math.PI / 4;
  }

  // The machete, slung across the bottom of the board on two hooks with
  // its own warning sign.
  {
    const { holder, add } = tool(
      'machete',
      'Machete, 600 mm, kept sharp. In a runaway decoherence, sever the mains feed. Do not use it on anything else. Do not use it on the hotline.',
    );
    const y = -0.2;
    outline(0.72, 0.075, 0.05, y);
    hook(-0.2, y + 0.045);
    hook(0.25, y + 0.045);
    add(box(0.52, 0.06, 0.006, '#b7bab4', 0.12, y, 0.04, holder));
    add(box(0.52, 0.012, 0.007, '#e3e6e0', 0.12, y - 0.028, 0.04, holder));
    const tip = add(
      box(0.06, 0.06, 0.006, '#b7bab4', 0.39, y + 0.005, 0.04, holder),
    );
    tip.rotation.z = Math.PI / 4;
    tip.scale.set(0.7, 0.7, 1);
    add(box(0.16, 0.04, 0.026, '#1f1a16', -0.22, y, 0.04, holder));
    add(box(0.012, 0.05, 0.03, '#55554c', -0.135, y, 0.04, holder));
    for (const dx of [-0.26, -0.18])
      add(
        mesh(
          new CylinderGeometry(0.005 * m, 0.005 * m, 0.03 * m, 5),
          '#b9a46a',
          dx,
          y,
          0.04,
          holder,
        ),
      ).rotation.x = Math.PI / 2;
  }

  // Signs: the board's own label and the machete's terms of use.
  const label = (
    text: string,
    style: { ink: string; plate: string; size: number },
    scale: number,
    x: number,
    y: number,
  ) => {
    const image = createLabelTexture(text, style);
    textures.push(image.texture);
    const material = createPs1Material({ map: image.texture }, true);
    materials.push(material);
    const result = new Mesh(
      new PlaneGeometry(image.width / scale, image.height / scale),
      material,
    );
    result.position.set(x * m, y * m, 0.028 * m);
    group.add(result);
  };
  label(
    'VX3 BENCH TOOLS · RETURN AFTER USE',
    { ink: '#efe6c8', plate: '#2c3532', size: 10 },
    150,
    0,
    0.405,
  );
  label(
    'EMERGENCY ONLY · SEVER MAINS FEED',
    { ink: '#151511', plate: '#f2c230', size: 10 },
    150,
    0.05,
    -0.33,
  );

  return {
    group,
    tools,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
