import type { Move } from './scenarios';
import type { World, WorldEvent } from './world';

/**
 * Plays a scenario's steps on a running world, one control at a time, so
 * a watcher sees each happen: a pause between controls, and its waits
 * (the purge, the heaters warming) shown faster than life, in two to six
 * real seconds each. The caller ticks the world as usual; `advance` adds
 * the extra time a fast-forwarded wait needs, and returns what that time
 * did, so its events can be heard and logged like any others.
 */
/** A worked control as the operator would name it, with what it now reads. */
function describe(world: World, move: Move) {
  const control = world.controls.find((c) => c.id === move.id);
  if (!control) return move.id;
  // A control worked from two places is named at the first.
  const where = control.where.split(';')[0];
  if (control.kind === 'knob')
    return `${where} to ${Number(((move.setting ?? 0) * 10).toFixed(1))}`;
  if (control.kind === 'switch')
    return `${where} ${world.read<boolean>(move.id) ? 'on' : 'off'}`;
  if (where.endsWith('handwheel')) return `${where} turned`;
  if (where.endsWith('handle')) return `${where} thrown`;
  return `${where} pressed`;
}

export function createAutoStart(
  steps: readonly Move[],
  { pause = 2.5, firstPause = 0.8 } = {},
) {
  let index = 0;
  let waitLeft = 0;
  let rate = 1;
  let rest = firstPause;
  let done = false;
  return {
    get done() {
      return done;
    },
    /**
     * Advance by `delta` real seconds. Returns the events of any extra
     * world time, and a line for the log when a control is worked.
     */
    advance(
      world: World,
      delta: number,
      random: () => number = Math.random,
    ): { events: WorldEvent[]; line: string | null } {
      const events: WorldEvent[] = [];
      if (done) return { events, line: null };
      if (waitLeft > 0) {
        // The caller ticks `delta`; add the rest of this frame's share.
        const share = Math.min(waitLeft, rate * delta);
        waitLeft -= share;
        let extra = Math.max(0, share - delta);
        while (extra > 1e-6) {
          const dt = Math.min(0.1, extra);
          extra -= dt;
          events.push(...world.tick(dt, random));
        }
        if (waitLeft <= 1e-6) rest = 1.8;
        return { events, line: null };
      }
      rest -= delta;
      if (rest > 0) return { events, line: null };
      const move = steps[index++];
      if (!move) {
        done = true;
        return { events, line: 'Automatic cold start complete.' };
      }
      if (move.id === 'wait') {
        waitLeft = move.setting ?? 0;
        const shown = Math.max(2, Math.min(6, waitLeft / 10));
        rate = waitLeft / shown;
        return { events, line: `Automatic start: wait ${waitLeft} s.` };
      }
      world.work(move.id, move.setting);
      rest = pause;
      return { events, line: `Automatic start: ${describe(world, move)}.` };
    },
  };
}

export type AutoStart = ReturnType<typeof createAutoStart>;
