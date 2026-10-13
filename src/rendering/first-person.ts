import type { PerspectiveCamera } from 'three';
import { slide } from '../game/walk-collision';
import type { Footprint } from '../game/walk-collision';

/**
 * First-person walking, as in any PC shooter, with the same feel as the
 * lab: click to capture the mouse and look around, WASD or the arrow keys
 * to walk, Shift to run, C to crouch, V to crouch lower, click or E to use
 * whatever is under the crosshair, the wheel to step, Alt+wheel to change
 * eye height and Escape to get the cursor back. Where the browser refuses
 * to capture the mouse, dragging looks around and clicking uses whatever
 * is under the cursor.
 *
 * The numbers match the lab's walker in `start-scene.ts`; keep the two in
 * step if either changes.
 */

export const EYE_HEIGHT_METRES = 1.8034;
export const WALK_METRES_PER_SECOND = 2;
export const RUN_METRES_PER_SECOND = 4.2;
export const LOOK_RADIANS_PER_PIXEL = 0.0022;
export const PITCH_LIMIT = 1.45;
export const WALKER_RADIUS_METRES = 0.25;
/** Zoom range: 1 is the normal field of view, 4 is four times closer. */
export const MIN_ZOOM = 0.65;
export const MAX_ZOOM = 4;

/**
 * How much one wheel event zooms. Mice, the Magic Mouse's swipe and the
 * Arc Mouse's touch strip all report scrolling differently: in lines or
 * pixels, in large notches or a smooth stream with momentum. Convert to
 * pixels, cap each event so a hard flick cannot jump to a limit, and zoom
 * exponentially, so the same swipe feels the same at any magnification.
 */
export function wheelZoom(zoom: number, deltaY: number, deltaMode: number) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1);
  const step = Math.max(-200, Math.min(200, pixels));
  return Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, zoom * Math.exp(-step * 0.0015)),
  );
}

const WALK_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);

export interface FirstPersonOptions {
  canvas: HTMLCanvasElement;
  camera: PerspectiveCamera;
  /** Scene units per metre. */
  metre: number;
  /** Height of the floor in scene units. */
  floorY: number;
  start: { x: number; z: number; yaw?: number; pitch?: number };
  /** Solid footprints on the floor plan, in scene units. */
  solids?: () => readonly Footprint[];
  /** Use whatever is at a normalised screen point (centre is 0, 0). */
  use: (x: number, y: number) => void;
  /** Whether something usable is under the crosshair. */
  aimed?: () => boolean;
  reducedMotion?: () => boolean;
  /** Field of view in degrees at zoom 1. */
  fov?: number;
}

export function createFirstPerson(options: FirstPersonOptions) {
  const { canvas, camera, metre, floorY } = options;
  const walker = {
    x: options.start.x,
    z: options.start.z,
    yaw: options.start.yaw ?? 0,
    pitch: options.start.pitch ?? 0,
    crouched: false,
    lowCrouched: false,
    crouch: 0,
    stride: 0,
    eyeOffset: 0,
    zoom: 1,
  };
  const keys = new Set<string>();
  const nudge = { forward: 0, right: 0 };
  let lockRefused = false;

  const crosshair = document.createElement('div');
  crosshair.setAttribute('aria-hidden', 'true');
  crosshair.hidden = true;
  Object.assign(crosshair.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '8px',
    height: '8px',
    margin: '-4px 0 0 -4px',
    border: '2px solid rgba(233, 225, 200, 0.85)',
    borderRadius: '50%',
    pointerEvents: 'none',
  });
  canvas.parentElement?.appendChild(crosshair);

  // The same small walking buttons as the lab, also usable without mouse capture.
  const movement = document.createElement('div');
  movement.setAttribute('role', 'group');
  movement.setAttribute('aria-label', 'Movement');
  Object.assign(movement.style, {
    position: 'absolute',
    left: '12px',
    bottom: '12px',
    display: 'flex',
    gap: '4px',
    padding: '6px',
    background: '#20302bdd',
  });
  for (const [caption, label, forward, right] of [
    ['◀', 'Step left', 0, -1],
    ['▲', 'Step forward', 1, 0],
    ['▼', 'Step back', -1, 0],
    ['▶', 'Step right', 0, 1],
  ] as const) {
    const button = document.createElement('button');
    button.textContent = caption;
    button.setAttribute('aria-label', label);
    Object.assign(button.style, {
      color: '#e8e2cc',
      background: '#34453c',
      border: '1px solid #baac80',
      padding: '8px',
    });
    button.addEventListener('click', () => {
      nudge.forward += forward * 0.45 * metre;
      nudge.right += right * 0.45 * metre;
    });
    movement.append(button);
  }
  canvas.parentElement?.append(movement);

  const locked = () => document.pointerLockElement === canvas;
  const typing = (event: Event) =>
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement;
  const clampPitch = (pitch: number) =>
    Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));

  const keydown = (event: KeyboardEvent) => {
    if (canvas.parentElement?.hidden) return;
    if (typing(event)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (WALK_KEYS.has(event.code)) {
      keys.add(event.code);
      if (event.code.startsWith('Arrow')) event.preventDefault();
    }
    if (event.repeat) return;
    if (event.code === 'KeyC') {
      walker.crouched = walker.lowCrouched || !walker.crouched;
      walker.lowCrouched = false;
    }
    if (event.code === 'KeyV') {
      walker.crouched = true;
      walker.lowCrouched = !walker.lowCrouched;
    }
    if (event.code === 'KeyE') options.use(0, 0);
  };
  const keyup = (event: KeyboardEvent) => keys.delete(event.code);
  const forget = () => keys.clear();
  const look = (event: MouseEvent) => {
    if (!locked()) return;
    // Looking slows as the view zooms in, so small controls stay easy to aim at.
    const rate = LOOK_RADIANS_PER_PIXEL / walker.zoom;
    walker.yaw += event.movementX * rate;
    walker.pitch = clampPitch(walker.pitch - event.movementY * rate);
  };
  const lockChange = () => {
    crosshair.hidden = !locked();
    if (!locked()) keys.clear();
  };
  const refuseLock = () => {
    lockRefused = true;
  };

  // Without a captured mouse, dragging looks and a still click uses.
  let drag: {
    x: number;
    y: number;
    yaw: number;
    pitch: number;
    moved: boolean;
  } | null = null;
  const screenPoint = (event: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    ];
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && !lockRefused) {
      if (event.button !== 0) return;
      if (locked()) options.use(0, 0);
      else void Promise.resolve(canvas.requestPointerLock()).catch(refuseLock);
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    drag = {
      x: event.clientX,
      y: event.clientY,
      yaw: walker.yaw,
      pitch: walker.pitch,
      moved: false,
    };
  };
  const move = (event: PointerEvent) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (!drag.moved) return;
    walker.yaw = drag.yaw - (dx * 0.004) / walker.zoom;
    walker.pitch = clampPitch(drag.pitch + (dy * 0.003) / walker.zoom);
  };
  const up = (event: PointerEvent) => {
    if (!drag) return;
    if (!drag.moved) options.use(...screenPoint(event));
    drag = null;
  };
  // The wheel zooms. Alt+wheel raises and lowers the eye, and a swipe that
  // is clearly sideways steps sideways. A trackpad pinch arrives as
  // Ctrl+wheel, so it zooms too instead of zooming the page.
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
    if (event.altKey) {
      walker.eyeOffset = Math.max(
        -1.1 * metre,
        Math.min(
          0.7 * metre,
          walker.eyeOffset - event.deltaY * scale * 0.004 * metre,
        ),
      );
      return;
    }
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 2) {
      nudge.right += event.deltaX * scale * 0.005 * metre;
      return;
    }
    walker.zoom = wheelZoom(walker.zoom, event.deltaY, event.deltaMode);
  };

  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  window.addEventListener('blur', forget);
  document.addEventListener('mousemove', look);
  document.addEventListener('pointerlockchange', lockChange);
  document.addEventListener('pointerlockerror', refuseLock);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });

  const eyeY = floorY + EYE_HEIGHT_METRES * metre;
  return {
    walker,
    locked,
    /** Stand at (x, z) facing `yaw`, looking `pitch` up, with the eye at `y`. */
    place(x: number, z: number, yaw: number, pitch: number, y = eyeY) {
      walker.x = x;
      walker.z = z;
      walker.yaw = yaw;
      walker.pitch = clampPitch(pitch);
      walker.eyeOffset = y - eyeY;
    },
    /** Walk and look for `delta` seconds, then place the camera. */
    update(delta: number) {
      const held = (...codes: string[]) => codes.some((code) => keys.has(code));
      const ahead =
        (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0);
      const aside =
        (held('KeyD', 'ArrowRight') ? 1 : 0) -
        (held('KeyA', 'ArrowLeft') ? 1 : 0);
      const length = Math.max(1, Math.hypot(ahead, aside));
      const speed =
        (held('ShiftLeft', 'ShiftRight')
          ? RUN_METRES_PER_SECOND
          : WALK_METRES_PER_SECOND) *
        metre *
        (walker.lowCrouched ? 0.3 : walker.crouched ? 0.5 : 1) *
        delta;
      const forward = (ahead / length) * speed + nudge.forward;
      const right = (aside / length) * speed + nudge.right;
      nudge.forward = 0;
      nudge.right = 0;
      const next = slide(
        options.solids?.() ?? [],
        walker.x,
        walker.z,
        Math.sin(walker.yaw) * forward + Math.cos(walker.yaw) * right,
        -Math.cos(walker.yaw) * forward + Math.sin(walker.yaw) * right,
        WALKER_RADIUS_METRES * metre,
      );
      walker.stride += Math.hypot(next.x - walker.x, next.z - walker.z);
      walker.x = next.x;
      walker.z = next.z;
      walker.crouch +=
        ((walker.lowCrouched ? 1.85 : walker.crouched ? 1 : 0) -
          walker.crouch) *
        Math.min(1, delta * 10);
      const bob = options.reducedMotion?.()
        ? 0
        : Math.sin((walker.stride / metre) * Math.PI * 1.6) * 0.02 * metre;
      const y = eyeY + walker.eyeOffset - walker.crouch * 0.65 * metre + bob;
      camera.position.set(walker.x, y, walker.z);
      camera.lookAt(
        walker.x + Math.sin(walker.yaw) * Math.cos(walker.pitch),
        y + Math.sin(walker.pitch),
        walker.z - Math.cos(walker.yaw) * Math.cos(walker.pitch),
      );
      const fov = (options.fov ?? 52) / walker.zoom;
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      if (locked() && options.aimed)
        crosshair.style.borderColor = options.aimed()
          ? '#ffb43a'
          : 'rgba(233, 225, 200, 0.85)';
    },
    dispose() {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', forget);
      document.removeEventListener('mousemove', look);
      document.removeEventListener('pointerlockchange', lockChange);
      document.removeEventListener('pointerlockerror', refuseLock);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      if (locked()) document.exitPointerLock();
      crosshair.remove();
      movement.remove();
    },
  };
}
