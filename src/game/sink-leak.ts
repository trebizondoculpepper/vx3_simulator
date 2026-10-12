/** A leaky hot-tap washer that reseats after a complete on/off cycle. */
export function createSinkLeak() {
  let running = false;
  let leaking = true;
  let wait = 10;
  let fall = -1;
  return {
    get running() {
      return running;
    },
    get leaking() {
      return leaking;
    },
    toggle() {
      running = !running;
      if (!running) leaking = false;
      fall = -1;
      return running;
    },
    step(delta: number) {
      if (running || !leaking) return { drop: null, impact: false };
      if (fall < 0) {
        wait -= delta;
        if (wait > 0) return { drop: null, impact: false };
        fall = -wait;
      } else fall += delta;
      if (fall >= 0.35) {
        fall = -1;
        wait = 10;
        return { drop: null, impact: true };
      }
      return { drop: fall / 0.35, impact: false };
    },
  };
}
