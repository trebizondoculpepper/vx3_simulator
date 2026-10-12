/**
 * Every object fitted to a machine is either an input or an indicator.
 *
 * - An **input** is set by a human operator and sets the machine's state:
 *   switches, knobs, buttons, levers, valves.
 * - An **indicator** is driven by the machine's state and is never touched
 *   directly: lamps, needles, counters, screens, glowing valves, anything
 *   that moves or lights because the machine is running.
 *
 * The designation is stored on the scene object itself (`userData`), so it
 * travels with the mesh. Room fixtures that are not part of any machine
 * (doors, the light switch, drawers, tools, taps) are marked as fixtures.
 */

export type PartRole = 'input' | 'indicator';

export interface MachinePart {
  /** The machine the part is fitted to, e.g. "VX3 rack · SUPPLY-B". */
  machine: string;
  /** What the part is called on that machine, e.g. "HT switch". */
  name: string;
  role: PartRole;
}

interface Tagged {
  userData: Record<string, unknown>;
}

export function designate(object: Tagged, part: MachinePart) {
  object.userData.machinePart = part;
}

export function designationOf(object: Tagged): MachinePart | undefined {
  return object.userData.machinePart as MachinePart | undefined;
}

/** Mark something clickable that belongs to the room, not to a machine. */
export function markFixture(object: Tagged, name: string) {
  object.userData.fixture = name;
}

export function fixtureOf(object: Tagged): string | undefined {
  return object.userData.fixture as string | undefined;
}

export interface AuditedObject extends Tagged {
  /** Whether the operator can click or use it. */
  clickable: boolean;
}

/**
 * Problems with how parts are designated; an empty list means every
 * clickable thing is an input or a room fixture, every input can be used,
 * and no indicator can be.
 */
export function auditParts(objects: Iterable<AuditedObject>): string[] {
  const problems: string[] = [];
  for (const object of objects) {
    const part = designationOf(object);
    const label = part
      ? `${part.machine}: ${part.name}`
      : (fixtureOf(object) ?? 'unnamed object');
    if (part?.role === 'indicator' && object.clickable)
      problems.push(`${label} is an indicator but can be operated`);
    if (part?.role === 'input' && !object.clickable)
      problems.push(`${label} is an input but cannot be operated`);
    if (!part && !fixtureOf(object) && object.clickable)
      problems.push(`${label} can be operated but is not designated`);
  }
  return problems;
}

/** Count the designated parts on each machine, by role. */
export function partInventory(objects: Iterable<Tagged>) {
  const machines = new Map<string, Record<PartRole, string[]>>();
  for (const object of objects) {
    const part = designationOf(object);
    if (!part) continue;
    const entry = machines.get(part.machine) ?? { input: [], indicator: [] };
    if (!entry[part.role].includes(part.name)) entry[part.role].push(part.name);
    machines.set(part.machine, entry);
  }
  return machines;
}
