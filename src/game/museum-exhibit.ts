import { applyRack, createRackControls } from './rack-controls';
import type { ToggleId } from './rack-controls';
import { createRig, stepRig } from './rig';

export const MUSEUM_START_SECONDS = 30;
export const MUSEUM_RUN_SECONDS = 60;
export const MUSEUM_STOP_SECONDS = 8;
export type MuseumPhase = 'inactive' | 'starting' | 'running' | 'stopping';

/** An independent demonstration rig. Its field generators are physically absent. */
export function createMuseumExhibitModel() {
  const rig = createRig();
  const settings = createRackControls();
  // These are the curator's initial positions; the sequencer never moves inputs.
  settings.mains = true;
  settings.knobs.spindle = 1;
  let phase: MuseumPhase = 'inactive';
  let elapsed = 0;
  const sync = () => {
    applyRack(settings, rig.controls);
    const envelope =
      phase === 'starting'
        ? Math.min(1, elapsed / MUSEUM_START_SECONDS)
        : phase === 'running'
          ? 1
          : 0;
    rig.controls.mains = settings.mains && envelope > 0;
    rig.controls.spindle *= envelope;
    rig.controls.field = 0;
    rig.field = 0;
    rig.strain = 0;
    rig.strainFrom.field = rig.strainFrom.hazard = 0;
  };
  return {
    rig,
    settings,
    get phase() {
      return phase;
    },
    get remaining() {
      return phase === 'running'
        ? Math.max(0, MUSEUM_RUN_SECONDS - elapsed)
        : 0;
    },
    start() {
      if (phase !== 'inactive') return false;
      phase = 'starting';
      elapsed = 0;
      sync();
      return true;
    },
    sync,
    toggle(id: ToggleId) {
      settings.toggles[id] = !settings.toggles[id];
      sync();
    },
    mains() {
      settings.mains = !settings.mains;
      sync();
    },
    stop() {
      if (phase === 'inactive' || phase === 'stopping') return;
      phase = 'stopping';
      elapsed = 0;
      sync();
    },
    tick(delta: number) {
      // Substeps also make large test ticks obey each sequence boundary.
      let left = Math.max(0, delta);
      while (left > 1e-8) {
        const dt = Math.min(left, 0.05);
        elapsed += dt;
        if (phase === 'starting' && elapsed >= MUSEUM_START_SECONDS - 1e-8) {
          phase = 'running';
          elapsed = 0;
        } else if (
          phase === 'running' &&
          elapsed >= MUSEUM_RUN_SECONDS - 1e-8
        ) {
          phase = 'stopping';
          elapsed = 0;
        } else if (
          phase === 'stopping' &&
          elapsed >= MUSEUM_STOP_SECONDS - 1e-8
        ) {
          phase = 'inactive';
          elapsed = 0;
        }
        sync();
        stepRig(rig, dt, () => 0.5);
        left -= dt;
      }
    },
  };
}
