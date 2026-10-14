import type { CoreProjection } from './core-projection';
type Point3 = [number, number, number];
export type ProjectionWireframe = {
  points: [number, number][];
  edges: [number, number][];
};

/** Rotate the solid itself; the CRT's grid and printed legends stay still. */
export function projectionWireframe(
  kind: CoreProjection,
  seconds: number,
): ProjectionWireframe {
  const edges: [number, number][] = [];
  let vertices: Point3[];
  if (kind === 'tesseract') {
    const angle = seconds * 0.23;
    vertices = Array.from({ length: 16 }, (_, i) => {
      const p = [0, 1, 2, 3].map((axis) => (i & (1 << axis) ? 1 : -1));
      const x = p[0] * Math.cos(angle) - p[3] * Math.sin(angle);
      const w = p[0] * Math.sin(angle) + p[3] * Math.cos(angle);
      const scale = 1 / (3.8 - w);
      return [x * scale * 2.2, p[1] * scale * 2.2, p[2] * scale * 2.2];
    });
    for (let i = 0; i < 16; i++)
      for (let axis = 0; axis < 4; axis++) {
        const other = i ^ (1 << axis);
        if (other > i) edges.push([i, other]);
      }
  } else {
    const phi = (1 + Math.sqrt(5)) / 2;
    vertices = [];
    for (const a of [-1, 1])
      for (const b of [-phi, phi])
        vertices.push([0, a, b], [a, b, 0], [b, 0, a]);
    for (let i = 0; i < vertices.length; i++)
      for (let j = i + 1; j < vertices.length; j++) {
        const distance = Math.hypot(
          ...vertices[i].map((v, axis) => v - vertices[j][axis]),
        );
        if (distance < 2.01) edges.push([i, j]);
      }
    vertices = vertices.map(
      (point, i) =>
        point.map(
          (v) =>
            v * (kind === 'irregular' ? 0.55 + 0.16 * Math.sin(i * 2.3) : 0.65),
        ) as Point3,
    );
  }
  const a = seconds * 0.28;
  const b = seconds * 0.17 + 0.3;
  const points: [number, number][] = vertices.map(([x, y, z]) => {
    const rx = x * Math.cos(a) + z * Math.sin(a);
    const rz = -x * Math.sin(a) + z * Math.cos(a);
    const ry = y * Math.cos(b) - rz * Math.sin(b);
    const depth = y * Math.sin(b) + rz * Math.cos(b);
    const scale = 42 / (1 - depth * 0.16);
    return [128 + rx * scale, 96 + ry * scale];
  });
  return { points, edges };
}
