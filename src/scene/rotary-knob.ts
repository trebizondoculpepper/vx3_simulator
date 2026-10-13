import { Group, Vector3 } from 'three';
import type { Camera, Object3D } from 'three';

/** Put body and marker on the same shaft, preserving their initial positions. */
export function mountRotaryKnob(body: Object3D, marker: Object3D) {
  const parent = body.parent!;
  const pivot = new Group();
  pivot.position.copy(body.position);
  marker.position.sub(pivot.position);
  body.position.set(0, 0, 0);
  parent.add(pivot);
  pivot.add(body, marker);
  return pivot;
}

/** Screen left/right stays correct even when the panel or knob is rotated. */
export function knobDirection(shaft: Object3D, point: Vector3, camera: Camera) {
  const centre = shaft.getWorldPosition(new Vector3()).project(camera);
  return point.clone().project(camera).x < centre.x ? -1 : 1;
}

/**
 * Every knob in the game turns the same way: a click on its left half turns
 * it anticlockwise (down), a click on its right half clockwise (up), one
 * detent at a time, and it stops at its end stops instead of wrapping.
 * `steps` is how many detents span the full travel.
 *
 * The one exception is the emergency telephone's rotary dial, which is not
 * a rotary control at all: it dials numbers and must not use this rule.
 */
export function stepKnob(value: number, direction: number, steps = 10) {
  return Math.max(
    0,
    Math.min(1, Math.round((value + direction / steps) * steps) / steps),
  );
}

/** A rotary selector moves one position per click and stops at its ends. */
export function stepSelector(
  position: number,
  direction: number,
  positions: number,
) {
  return Math.max(0, Math.min(positions - 1, position + Math.sign(direction)));
}
