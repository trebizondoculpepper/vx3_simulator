import { describe, expect, it } from 'vitest';
import { createWorld } from './world';
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

  it('runs full spindle and field past their redlines, into smoke and fire', () => {
    const world = prepareVessel();
    lightFerrocore(world, 1, { tracksTrim: true });
    // The condition, not the window: an unacknowledged window flashes.
    expect(world.read('alarm.SPINDEL ROT')).toBe(true);
    const { events } = runUntil(
      world,
      () => world.read('fire.alarm') === true,
      300,
      {
        tracksTrim: true,
      },
    );
    expect(kinds(events)).toContain('fire:alarm');
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
