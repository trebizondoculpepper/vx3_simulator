import { CatmullRomCurve3, Vector3 } from 'three';

/** Keep the whole rubber tube clear of the slab, including spline sag. */
export function floorSafeHose(
  points: Vector3[],
  floorY: number,
  radius: number,
) {
  const curve = new CatmullRomCurve3(points);
  const sample = curve.getPoint.bind(curve);
  curve.getPoint = (t: number, target = new Vector3()) => {
    sample(t, target);
    target.y = Math.max(floorY + radius + 0.02, target.y);
    return target;
  };
  return curve;
}
