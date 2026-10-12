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

export function stepKnob(value: number, direction: number) {
  return Math.max(
    0,
    Math.min(1, Math.round((value + direction * 0.1) * 10) / 10),
  );
}
