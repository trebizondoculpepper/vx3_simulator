import { BoxGeometry, CylinderGeometry, Group, Mesh } from 'three';
import type { BufferGeometry, Material } from 'three';
import { createPs1Material } from '../rendering/ps1-material';

export type ServiceKind =
  'duct' | 'round-duct' | 'pipe' | 'tray' | 'trunking' | 'conduit';

export interface ServiceLane {
  kind: ServiceKind;
  /** Position across the run, in world units. */
  across: number;
  /** Gap between the ceiling and the top of the service, in metres. */
  hang?: number;
  /** Paint colour for pipes and trunking. */
  color?: string;
  /** Pipe or conduit diameter in metres. */
  diameter?: number;
}

export interface ServiceRun {
  /** The direction the services run in. */
  axis: 'x' | 'z';
  from: number;
  to: number;
  ceilingY: number;
  worldUnitsPerMetre: number;
  lanes: ServiceLane[];
}

/**
 * Non-functional basement services under a ceiling: galvanised ducts with
 * flanged joints, painted pipes on clamps, cable trays heaped with cable,
 * steel trunking and thin conduit, each hung from drop rods. The group's
 * meshes share materials by colour; call the returned dispose to free them.
 */
export function createCeilingServices(run: ServiceRun) {
  const { axis, from, to, ceilingY, worldUnitsPerMetre: m } = run;
  const group = new Group();
  group.name = 'CeilingServices';
  const palette = new Map<string, Material>();
  const paint = (color: string) => {
    let material = palette.get(color);
    if (!material) {
      material = createPs1Material({ color });
      palette.set(color, material);
    }
    return material;
  };
  const length = to - from;
  const middle = (from + to) / 2;
  /** Place a mesh at (along, y, across) in run coordinates. */
  const place = (
    geometry: BufferGeometry,
    color: string,
    along: number,
    y: number,
    across: number,
    lengthwise = false,
  ) => {
    const result = new Mesh(geometry, paint(color));
    if (axis === 'x') result.position.set(along, y, across);
    else {
      result.position.set(across, y, along);
      result.rotation.y = Math.PI / 2;
    }
    if (lengthwise) {
      // Cylinders stand on y; lay them along the run.
      if (axis === 'x') result.rotation.set(0, 0, Math.PI / 2);
      else result.rotation.set(Math.PI / 2, 0, 0);
    }
    group.add(result);
    return result;
  };
  const rods = (
    across: number,
    bottom: number,
    spacing: number,
    spread: number,
  ) => {
    for (let at = from + spacing / 2; at < to; at += spacing)
      for (const side of spread ? [-spread, spread] : [0]) {
        const h = ceilingY - bottom;
        place(
          new CylinderGeometry(0.01, 0.01, h, 3),
          '#3b3b36',
          at,
          bottom + h / 2,
          across + side,
        );
      }
  };

  for (const lane of run.lanes) {
    const hang = (lane.hang ?? 0.05) * m;
    const top = ceilingY - hang;
    switch (lane.kind) {
      case 'duct': {
        const w = 0.5 * m;
        const h = 0.32 * m;
        const y = top - h / 2;
        place(new BoxGeometry(length, h, w), '#8d918a', middle, y, lane.across);
        for (let at = from + 0.6 * m; at < to; at += 1.2 * m)
          place(
            new BoxGeometry(0.05, h + 0.08, w + 0.08),
            '#6f736c',
            at,
            y,
            lane.across,
          );
        // Hanger straps and a bottom angle under each.
        for (let at = from + 1.2 * m; at < to; at += 2.4 * m)
          place(
            new BoxGeometry(0.06, 0.05, w + 0.3),
            '#3b3b36',
            at,
            top - h - 0.03,
            lane.across,
          );
        rods(lane.across, top - h - 0.03, 2.4 * m, w / 2 + 0.12);
        break;
      }
      case 'round-duct': {
        const r = ((lane.diameter ?? 0.35) * m) / 2;
        const y = top - r;
        place(
          new CylinderGeometry(r, r, length, 8),
          '#9a9d95',
          middle,
          y,
          lane.across,
          true,
        );
        for (let at = from + 0.8 * m; at < to; at += 1.6 * m)
          place(
            new CylinderGeometry(r + 0.03, r + 0.03, 0.08, 8),
            '#7c7f77',
            at,
            y,
            lane.across,
            true,
          );
        rods(lane.across, y, 2 * m, 0);
        break;
      }
      case 'pipe': {
        const r = ((lane.diameter ?? 0.08) * m) / 2;
        const y = top - r;
        const color = lane.color ?? '#4f6e8a';
        place(
          new CylinderGeometry(r, r, length, 6),
          color,
          middle,
          y,
          lane.across,
          true,
        );
        // Clamps, and a valve wheel now and then.
        for (let at = from + 0.9 * m; at < to; at += 1.8 * m)
          place(
            new BoxGeometry(0.05, r * 2 + 0.06, r * 2 + 0.06),
            '#2f2f2b',
            at,
            y,
            lane.across,
          );
        for (let at = from + 4.1 * m; at < to; at += 9.5 * m) {
          place(
            new CylinderGeometry(r * 1.3, r * 1.3, r * 4, 6),
            color,
            at,
            y,
            lane.across,
            true,
          );
          place(
            new CylinderGeometry(0.012, 0.012, r * 3, 3),
            '#2f2f2b',
            at,
            y - r * 2.2,
            lane.across,
          );
          place(
            new CylinderGeometry(r * 2.2, r * 2.2, 0.02, 8),
            '#a8261d',
            at,
            y - r * 3.6,
            lane.across,
          );
        }
        rods(lane.across, y, 1.8 * m, 0);
        break;
      }
      case 'tray': {
        const w = 0.4 * m;
        const y = top - 0.08 * m;
        place(
          new BoxGeometry(length, 0.02, w),
          '#77796f',
          middle,
          y,
          lane.across,
        );
        for (const side of [-1, 1])
          place(
            new BoxGeometry(length, 0.06 * m, 0.02),
            '#77796f',
            middle,
            y + 0.03 * m,
            lane.across + side * (w / 2),
          );
        // A heap of cable in mixed sheaths.
        const colors = ['#1c1c1a', '#3a3a35', '#7a3c22', '#26364a', '#4b4b3e'];
        for (const [i, color] of colors.entries()) {
          const r = 0.012 * m + (i % 2) * 0.006 * m;
          place(
            new CylinderGeometry(r, r, length, 4),
            color,
            middle,
            y + r + 0.01 + (i % 2) * r * 1.4,
            lane.across - w * 0.35 + i * w * 0.17,
            true,
          );
        }
        rods(lane.across, y, 1.5 * m, w / 2);
        break;
      }
      case 'trunking': {
        const w = 0.15 * m;
        const h = 0.1 * m;
        place(
          new BoxGeometry(length, h, w),
          lane.color ?? '#a2a493',
          middle,
          top - h / 2,
          lane.across,
        );
        for (let at = from + 1.5 * m; at < to; at += 3 * m)
          place(
            new BoxGeometry(0.04, h + 0.03, w + 0.03),
            '#55574c',
            at,
            top - h / 2,
            lane.across,
          );
        break;
      }
      case 'conduit': {
        const r = ((lane.diameter ?? 0.025) * m) / 2;
        place(
          new CylinderGeometry(r, r, length, 4),
          lane.color ?? '#5d5f55',
          middle,
          top - r,
          lane.across,
          true,
        );
        break;
      }
    }
  }

  return {
    group,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of palette.values()) material.dispose();
    },
  };
}
