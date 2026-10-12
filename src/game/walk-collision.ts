/** A solid footprint on the floor plan, in world units. */
export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** True when a walker of this radius standing at (x, z) overlaps the footprint. */
export function overlaps(
  footprint: Footprint,
  x: number,
  z: number,
  radius: number,
) {
  return (
    x > footprint.minX - radius &&
    x < footprint.maxX + radius &&
    z > footprint.minZ - radius &&
    z < footprint.maxZ + radius
  );
}

/**
 * Move a walker by (dx, dz), sliding along anything solid: each axis is tried
 * separately, so walking diagonally into a wall keeps the motion along it.
 * A walker that somehow starts inside a footprint may still move out of it.
 */
export function slide(
  footprints: readonly Footprint[],
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
) {
  const blocked = (nextX: number, nextZ: number) =>
    footprints.some(
      (item) =>
        overlaps(item, nextX, nextZ, radius) && !overlaps(item, x, z, radius),
    );
  // Long steps are split so a fast walker cannot pass through a thin wall.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.5)));
  for (let i = 0; i < steps; i++) {
    if (!blocked(x + dx / steps, z)) x += dx / steps;
    if (!blocked(x, z + dz / steps)) z += dz / steps;
  }
  return { x, z };
}
