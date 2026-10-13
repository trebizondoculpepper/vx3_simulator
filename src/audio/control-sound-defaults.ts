import type { ControlSound } from './rig-sounds';
import type { RecordedCue } from './recorded-effects';

/** Shared by the lab and development control test; fixtures may override it. */
const recordings: Partial<Record<ControlSound, RecordedCue>> = {
  button: 'button',
  key: 'button',
  toggle: 'toggle-up',
  rocker: 'rocker',
  slide: 'toggle-up',
  'key-switch': 'toggle-up',
  selector: 'selector',
  knob: 'knob',
  isolator: 'breaker-on',
  locked: 'toggle-up',
};
export function defaultControlRecording(kind: ControlSound) {
  return recordings[kind];
}
