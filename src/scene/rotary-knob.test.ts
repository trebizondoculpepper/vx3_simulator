import { describe, expect, it } from 'vitest';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import {
  knobDirection,
  mountRotaryKnob,
  stepKnob,
  stepSelector,
} from './rotary-knob';

describe('rotary knobs', () => {
  it('moves the offset marker around the shaft while keeping the body centred', () => {
    const panel = new Group();
    panel.position.set(4, 2, -3);
    panel.rotation.y = Math.PI / 2;
    const body = new Group();
    body.position.set(0.7, 0.4, 0.3);
    const marker = new Group();
    marker.position.set(0.7, 0.5, 0.38);
    panel.add(body, marker);
    const pivot = mountRotaryKnob(body, marker);
    const centre = body.getWorldPosition(new Vector3());
    pivot.rotation.z = Math.PI / 2;
    expect(body.getWorldPosition(new Vector3()).distanceTo(centre)).toBeCloseTo(
      0,
    );
    expect(marker.position.y).toBeCloseTo(0.1);
    expect(
      pivot.worldToLocal(marker.getWorldPosition(new Vector3())).y,
    ).toBeCloseTo(0.1);
    const orbit = panel.worldToLocal(marker.getWorldPosition(new Vector3()));
    expect(orbit.x).toBeCloseTo(0.6);
    expect(orbit.y).toBeCloseTo(0.4);
    expect(orbit.z).toBeCloseTo(0.38);
  });

  it('uses the visible left/right halves even after the knob rotates', () => {
    const shaft = new Group();
    shaft.position.set(0.7, 0.4, 0);
    shaft.rotation.z = Math.PI;
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld();
    expect(knobDirection(shaft, new Vector3(0.6, 0.4, 0), camera)).toBe(-1);
    expect(knobDirection(shaft, new Vector3(0.8, 0.4, 0), camera)).toBe(1);
    // The same panel viewed from behind reverses its visible halves.
    camera.position.z = -5;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    expect(knobDirection(shaft, new Vector3(0.6, 0.4, 0), camera)).toBe(1);
  });

  it('takes reversible steps and stops at the end stops', () => {
    expect(stepKnob(0.5, -1)).toBe(0.4);
    expect(stepKnob(0.5, 1)).toBe(0.6);
    expect(stepKnob(0, -1)).toBe(0);
    expect(stepKnob(1, 1)).toBe(1);
    expect(stepKnob(stepKnob(0.5, 1), -1)).toBe(0.5);
  });

  it('steps knobs with other detent counts and stops at the ends', () => {
    expect(stepKnob(0.4, 1, 5)).toBeCloseTo(0.6);
    expect(stepKnob(0.4, -1, 5)).toBeCloseTo(0.2);
    expect(stepKnob(1, 1, 5)).toBe(1);
    expect(stepKnob(0, -1, 5)).toBe(0);
  });

  it('moves selectors one position at a time without wrapping', () => {
    expect(stepSelector(1, 1, 3)).toBe(2);
    expect(stepSelector(2, 1, 3)).toBe(2);
    expect(stepSelector(1, -1, 3)).toBe(0);
    expect(stepSelector(0, -1, 3)).toBe(0);
  });
});
