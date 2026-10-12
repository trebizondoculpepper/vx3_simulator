/** A stick's deflection: x right, y down, each within the unit circle. */
export interface StickVector {
  x: number;
  y: number;
}

/** Below this deflection a stick reads as centred, so a resting thumb does nothing. */
const DEAD_ZONE = 0.12;

/**
 * Map a touch offset from a stick's centre to a deflection: clamped to the
 * rim, with a dead zone in the middle rescaled so the response still starts
 * from zero just outside it.
 */
export function stickVector(dx: number, dy: number, radius: number) {
  const distance = Math.hypot(dx, dy);
  if (!distance || radius <= 0) return { x: 0, y: 0 };
  const reach = Math.min(1, distance / radius);
  if (reach < DEAD_ZONE) return { x: 0, y: 0 };
  const scaled = (reach - DEAD_ZONE) / (1 - DEAD_ZONE);
  return { x: (dx / distance) * scaled, y: (dy / distance) * scaled };
}

/**
 * Twin on-screen thumbsticks for touch screens: the left one walks, the
 * right one looks. Each captures its own finger, so the other hand stays
 * free to tap the apparatus anywhere else on the screen. The sticks are
 * shown only while the overlay's input mode is touch; CSS decides that.
 */
export function createTouchSticks(container: HTMLElement) {
  const root = document.createElement('div');
  root.className = 'touch-sticks';
  root.setAttribute('aria-hidden', 'true');
  container.append(root);

  const make = (side: 'move' | 'look') => {
    const base = document.createElement('div');
    base.className = `touch-stick touch-stick-${side}`;
    const knob = document.createElement('div');
    knob.className = 'touch-stick-knob';
    base.append(knob);
    root.append(base);
    const vector: StickVector = { x: 0, y: 0 };
    let finger: number | null = null;
    const follow = (event: PointerEvent) => {
      const rect = base.getBoundingClientRect();
      const radius = rect.width / 2;
      const dx = event.clientX - (rect.left + radius);
      const dy = event.clientY - (rect.top + radius);
      const next = stickVector(dx, dy, radius);
      vector.x = next.x;
      vector.y = next.y;
      const reach = Math.min(1, Math.hypot(dx, dy) / radius) || 0;
      const angle = Math.atan2(dy, dx);
      knob.style.transform = `translate(${Math.cos(angle) * reach * radius * 0.6}px, ${Math.sin(angle) * reach * radius * 0.6}px)`;
    };
    const release = (event: PointerEvent) => {
      if (event.pointerId !== finger) return;
      finger = null;
      vector.x = 0;
      vector.y = 0;
      knob.style.transform = '';
      base.classList.remove('is-held');
    };
    base.addEventListener('pointerdown', (event) => {
      if (finger !== null) return;
      event.preventDefault();
      finger = event.pointerId;
      base.setPointerCapture(event.pointerId);
      base.classList.add('is-held');
      follow(event);
    });
    base.addEventListener('pointermove', (event) => {
      if (event.pointerId === finger) follow(event);
    });
    base.addEventListener('pointerup', release);
    base.addEventListener('pointercancel', release);
    base.addEventListener('lostpointercapture', release);
    return vector;
  };

  const move = make('move');
  const look = make('look');
  return {
    /** Left stick: up walks forward, sideways strafes. */
    move,
    /** Right stick: turns the head. */
    look,
    /** Let go of both sticks, for when the view changes under the player. */
    reset() {
      move.x = move.y = look.x = look.y = 0;
      for (const knob of root.querySelectorAll<HTMLElement>(
        '.touch-stick-knob',
      ))
        knob.style.transform = '';
    },
    dispose() {
      root.remove();
    },
  };
}
