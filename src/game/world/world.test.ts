import { describe, expect, it } from 'vitest';
import { CRITICAL_KELVIN, createWorld } from './world';
import type { World, WorldEvent } from './world';
import { warningConditions } from '../control-board';
import { createRackControls } from '../rack-controls';
import { createColumnPrep } from '../column-prep';
import type { RigState } from '../rig';

/** No drift: the field's ideal trim point stays put. */
const still = () => 0.5;

/** The nearest detent of the drive's twenty-step dials. */
const detent = (value: number) => Math.round(value * 20) / 20;

interface Operator {
  /** Keep TRIMM on the nearest detent to SOLL, as an attentive operator does. */
  tracksTrim?: boolean;
}

function run(
  world: World,
  seconds: number,
  { tracksTrim = false }: Operator = {},
) {
  const events: WorldEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += 0.1) {
    if (tracksTrim) {
      const want = detent(world.read<number>('drive.idealTrim'));
      if (world.read('drive.trim') !== want) world.work('drive.trim', want);
    }
    events.push(...world.tick(0.1, still));
  }
  return events;
}

function runUntil(
  world: World,
  done: () => boolean,
  limit: number,
  operator: Operator = {},
) {
  const events: WorldEvent[] = [];
  let waited = 0;
  while (!done()) {
    if (waited >= limit) throw new Error(`not reached within ${limit} s`);
    events.push(...run(world, 0.1, operator));
    waited += 0.1;
  }
  return { events, waited };
}

const kinds = (events: WorldEvent[]) =>
  events.map((e) =>
    typeof e.event === 'string'
      ? `${e.source}:${e.event}`
      : e.event.kind === 'catastrophe'
        ? `${e.source}:catastrophe:${e.event.cause}`
        : `${e.source}:${e.event.kind}`,
  );

const lit = (world: World) =>
  world.graph
    .vertices()
    .filter((v) => v.id.startsWith('board.window.') && world.read(v.id))
    .map((v) => v.id.slice('board.window.'.length));

/** Switch the plant and the column on, seal, purge and charge the vessel. */
export function prepareVessel(world = createWorld()) {
  for (const id of [
    'plant.master',
    'column.isolator',
    'column.netz',
    'column.rocker',
  ])
    world.work(id);
  world.work('column.SENKEN');
  run(world, 6.5);
  world.work('column.SPANNEN');
  world.work('column.XE EIN');
  world.work('column.outlet');
  runUntil(world, () => world.read<number>('vessel.oxygen') < 0.1, 120);
  world.work('column.outlet');
  runUntil(world, () => world.read<number>('vessel.xenon') >= 1.2, 60);
  world.work('xenon.regulator', 0.5);
  world.work('recirculator.switch');
  run(world, 5);
  return world;
}

/** Close NETZ, let the heaters warm, then bring the drive up to `level`. */
export function lightFerrocore(
  world: World,
  level: number,
  operator: Operator,
) {
  world.work('board.NETZ');
  run(world, 7, operator);
  world.work('drive.spindle', level);
  world.work('drive.field', level);
  return run(world, 30, operator);
}

describe('the lab as a graph', () => {
  it('goes through the cold start to full operation, within the redlines', () => {
    const world = createWorld();
    expect(lit(world)).toEqual([]);
    run(world, 1);
    // HAUPTSCHALTER is open: the board says so.
    expect(lit(world)).toContain('NETZ AUS');

    // Nothing on the column moves without its supply.
    expect(world.work('column.SENKEN')).toBe(false);
    prepareVessel(world);
    expect(world.read('vessel.sealed')).toBe(true);
    expect(world.read('vessel.purged')).toBe(true);
    expect(world.read('drive.permit')).toBe(true);
    world.work('board.QUITT');
    run(world, 1);
    expect(lit(world)).toEqual([]);

    const lighting = lightFerrocore(world, 0.8, { tracksTrim: true });
    expect(kinds(lighting)).toContain('rig:field-locked');
    expect(kinds(lighting)).toContain('vessel:full-power');
    expect(kinds(lighting)).toContain('plant:fully-operational');
    expect(world.read('plant.fullyOperational')).toBe(true);
    expect(world.read('board.crt')).toBe('tesseract');

    // It stays there, with no alarm, for ten minutes.
    const later = run(world, 600, { tracksTrim: true });
    expect(kinds(later).filter((k) => k !== 'rig:field-locked')).toEqual([]);
    expect(world.read('plant.fullyOperational')).toBe(true);
    expect(lit(world)).toEqual([]);
  });

  it('overheats past the redlines, then catches fire, which is terminal', () => {
    const world = prepareVessel();
    world.work('board.NETZ');
    run(world, 8, { tracksTrim: true });
    world.work('drive.spindle', 1);
    world.work('drive.field', 1);
    run(world, 12, { tracksTrim: true });
    // Overheating: past the redlines and smoking, not yet burning.
    expect(world.read('alarm.SPINDEL ROT')).toBe(true);
    expect(world.read('fire.ruined')).toBeNull();
    const { events } = runUntil(
      world,
      () => world.read('fire.ruined') !== null,
      120,
      { tracksTrim: true },
    );
    // Fire: the breaker drops, the alarm sounds, and it is ruined at once.
    expect(kinds(events)).toEqual(
      expect.arrayContaining([
        'fire:fire',
        'fire:alarm',
        'fire:water',
        'fire:ruined-fire',
      ]),
    );
    expect(world.read('fire.ruined')).toBe('fire');
    expect(world.read('drive.mains')).toBe(false);
    expect(world.work('board.NETZ')).toBe(false);
    const aftermath = run(world, 8.1);
    expect(world.read('fire.phase')).toBe('extinguished');
    expect(world.read('plant.powered')).toBe(false);
    expect(lit(world)).toEqual([]);
    expect(world.read('board.needle.spindle')).toBe(0);
    expect(world.read('board.grid.spindle')).toBe(0);
    expect(world.read('column.KAMMERDRUCK')).toBe(0);
    expect(
      world.read<{
        burning: Record<string, boolean>;
      }>('fire').burning,
    ).toEqual({ spindle: false, field: false, load: false });
    expect(kinds(aftermath)).toContain('fire:extinguished');
    expect(kinds(run(world, 2))).not.toContain('fire:extinguished');
  });

  it('keeps the fire alarm sounding until the fire panel resets it', () => {
    const world = prepareVessel();
    world.work('board.NETZ');
    run(world, 8, { tracksTrim: true });
    world.work('drive.spindle', 1);
    world.work('drive.field', 1);
    runUntil(world, () => world.read('fire.ruined') !== null, 120, {
      tracksTrim: true,
    });
    // Burned out and left alone, the alarm keeps sounding.
    run(world, 8.1);
    expect(world.read('fire.phase')).toBe('extinguished');
    run(world, 300);
    expect(world.read('fire.alarm')).toBe(true);
    expect(world.read<{ water: boolean }>('fire').water).toBe(true);
    // Reset silences it; the lab stays ruined.
    expect(world.work('fire.RÜCKSTELLEN')).toBe(true);
    expect(world.read('fire.alarm')).toBe(false);
    expect(world.read<{ water: boolean }>('fire').water).toBe(false);
    expect(world.read('fire.ruined')).toBe('fire');
    expect(world.work('board.NETZ')).toBe(false);
  });

  it('drives the core towards critical as it overheats, and fires there', () => {
    const world = prepareVessel();
    world.work('board.NETZ');
    run(world, 8, { tracksTrim: true });
    world.work('drive.spindle', 1);
    world.work('drive.field', 1);
    let peak = 0;
    runUntil(
      world,
      () => {
        peak = Math.max(peak, world.read<number>('vessel.temperature'));
        return world.read('fire.ruined') !== null;
      },
      120,
      { tracksTrim: true },
    );
    // Past full power's 4,000 K, up to critical, and then fire.
    expect(peak).toBeGreaterThan(4500);
    expect(peak).toBeGreaterThanOrEqual(CRITICAL_KELVIN - 50);
    expect(world.read('fire.ruined')).toBe('fire');
  });

  it('recovers from overheating if the dials come down in time', () => {
    const world = prepareVessel();
    world.work('board.NETZ');
    run(world, 8, { tracksTrim: true });
    world.work('drive.spindle', 1);
    world.work('drive.field', 1);
    run(world, 12, { tracksTrim: true });
    world.work('drive.spindle', 0.8);
    world.work('drive.field', 0.8);
    run(world, 120, { tracksTrim: true });
    expect(world.read('fire.ruined')).toBeNull();
    expect(world.read('plant.fullyOperational')).toBe(true);
  });

  it('agrees with the board model’s own alarm conditions all the way', () => {
    const world = createWorld();
    const compare = () => {
      const prep = {
        ...createColumnPrep(),
        lift: world.read<number>('vessel.lift'),
        clamped: world.read<boolean>('vessel.clamped'),
        air: world.read<number>('vessel.air'),
        xenon: world.read<number>('vessel.xenon'),
        supply: world.read<number>('vessel.supply'),
        temperature: world.read<number>('vessel.temperature'),
        failure: world.read<null>('vessel.failure'),
      };
      const rig = {
        controls: world.read('drive.controls'),
        heater: world.read('rig.heater'),
        spindle: world.read('rig.spindle'),
        field: world.read('rig.field'),
        instability: world.read('rig.instability'),
        strain: world.read('rig.strain'),
      } as RigState;
      const expected = warningConditions({
        rig,
        controls: createRackControls(),
        telltales: {
          powerKw: world.read<number>('telltales.powerKw'),
        } as never,
        xenonFlowSlpm: world.read('line.flowSlpm'),
        plantPowered: world.read('plant.powered'),
        recirculatorWorking: world.read('recirculator.working'),
        gen2: { prep },
        permit: world.read('drive.permit'),
        smoking: world.read<number>('room.smokeLevel') > 0.05,
        burning: world.read('fire.alarm'),
      });
      expect(world.conditions.map((c) => c.value)).toEqual(expected);
    };
    const step = (seconds: number) => {
      for (let t = 0; t < seconds; t += 0.5) {
        world.tick(0.5, still);
        compare();
      }
    };
    step(2);
    prepareVessel(world);
    step(2);
    world.work('board.NETZ');
    world.work('drive.spindle', 1);
    world.work('drive.field', 1);
    step(120);
  });

  it('puts a snapshot back exactly', () => {
    const world = prepareVessel();
    const saved = world.snapshot();
    const before = world.read<number>('vessel.xenon');
    world.work('column.outlet');
    run(world, 20);
    expect(world.read<number>('vessel.xenon')).toBeLessThan(before);
    world.restore(saved);
    expect(world.read<number>('vessel.xenon')).toBe(before);
    expect(world.snapshot()).toEqual(saved);
  });
});

describe('the lamp test', () => {
  it('flashes every alarm window together for ten seconds, then stops', () => {
    const world = createWorld();
    // Clear the plant-supply alarm, so only the test lights the windows.
    world.work('plant.master');
    world.tick(0.1, () => 0.5);
    world.work('board.QUITT');
    world.tick(0.1, () => 0.5);
    world.work('board.L-TEST');
    const windows = () =>
      world.conditions.map((c) =>
        world.read<boolean>(`board.window.${c.id.slice('alarm.'.length)}`),
      );
    const seen = new Set<string>();
    for (let t = 0; t < 9.8; t += 0.1) {
      world.tick(0.1, () => 0.5);
      const lit = windows();
      // All together: every window on, or every window off.
      expect(new Set(lit).size).toBe(1);
      seen.add(String(lit[0]));
    }
    expect(seen).toEqual(new Set(['true', 'false']));
    for (let t = 0; t < 0.5; t += 0.1) world.tick(0.1, () => 0.5);
    expect(world.read('board.testing')).toBe(false);
    expect(windows().some(Boolean)).toBe(false);
  });
});
