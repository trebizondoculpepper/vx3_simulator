import { ACTIVATION, FULL_POWER } from './column-prep';
export type CoreProjection =
  'basis' | 'cube' | 'polyhedron' | 'irregular' | 'tesseract' | 'fault';
/** The CRT shows increasing dimensional complexity as the live core heats. */
export function coreProjection(
  temperature: number,
  failed = false,
): CoreProjection {
  if (failed) return 'fault';
  if (temperature < ACTIVATION) return 'basis';
  if (temperature < 2000) return 'cube';
  if (temperature < FULL_POWER) return 'polyhedron';
  if (temperature < 3700) return 'irregular';
  return 'tesseract';
}
