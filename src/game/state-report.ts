import { annunciators } from './control-board';
import type { World } from './world/world';

/**
 * The game's state as a Markdown document, for debugging: what the lab is
 * doing, every alarm window, every control's setting, every value in the
 * model grouped by system, and the operator's log and the teletype's
 * printout. Downloaded from the lab's Save State button.
 */
export interface StateReportExtras {
  /** When the report was made. */
  time: Date;
  /** The operator's log, newest first, as the logbook shows it. */
  log: readonly string[];
  /** What the teletype has printed, oldest first. */
  printed: readonly string[];
  /** The room's own state: lights, the player's position, and so on. */
  room: Record<string, unknown>;
}

/** A value as one table cell. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number')
    return Number.isInteger(value) ? String(value) : String(+value.toFixed(4));
  if (typeof value === 'string' || typeof value === 'boolean')
    return String(value);
  return `\`${JSON.stringify(value, (_, v: unknown) =>
    typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v,
  )}\``;
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

const table = (head: string[], rows: string[][]) =>
  [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');

/** Reads a vertex, or nothing for those that are not values (buttons). */
const tryRead = (world: World, id: string): unknown => {
  try {
    return world.read(id);
  } catch {
    return undefined;
  }
};

export function stateReport(world: World, extras: StateReportExtras): string {
  const read = (id: string) => tryRead(world, id);
  const yes = (id: string) => (read(id) ? 'yes' : 'no');
  const phases = (read('board.alarms') as string[] | undefined) ?? [];
  const lit = annunciators
    .map((a) => ({ label: a.label, active: read(`alarm.${a.label}`) }))
    .filter((a) => a.active)
    .map((a) => a.label);

  const parts: string[] = [];
  parts.push('# VX3 state report');
  parts.push(`Saved ${extras.time.toISOString()}.`);

  parts.push('## Summary');
  parts.push(
    [
      `- Fully operational: ${yes('plant.fullyOperational')}`,
      `- Plant supply (HAUPTSCHALTER and rectifier): ${yes('plant.powered')}`,
      `- Column supply running: ${yes('column.running')}`,
      `- Drive breaker closed: ${yes('drive.mains')}; atmosphere permit: ${yes('drive.permit')}`,
      `- Vessel: ${formatValue(read('vessel.stage'))}, sealed ${yes('vessel.sealed')}, purged ${yes('vessel.purged')}, ${formatValue(read('vessel.pressure'))} bar`,
      `- Core: ${formatValue(Math.round(Number(read('vessel.temperature') ?? 0)))} K, failure ${formatValue(read('vessel.failure'))}`,
      `- Fire: ${formatValue(read('fire.phase'))}, alarm ${yes('fire.alarm')}, ruined ${formatValue(read('fire.ruined'))}`,
      `- Alarm windows lit: ${lit.length ? lit.join(', ') : 'none'}`,
    ].join('\n'),
  );

  parts.push('## Alarm windows');
  parts.push(
    table(
      ['#', 'Window', 'Condition', 'Phase'],
      annunciators.map((a, i) => [
        String(i + 1),
        a.label,
        read(`alarm.${a.label}`) ? 'active' : '—',
        phases[i] ?? '—',
      ]),
    ),
  );

  parts.push('## Controls');
  parts.push(
    table(
      ['Where', 'Id', 'Kind', 'Setting'],
      world.controls.map((c) => [
        c.where,
        `\`${c.id}\``,
        c.kind,
        c.kind === 'button' ? '—' : formatValue(read(c.id)),
      ]),
    ),
  );

  parts.push('## Model');
  parts.push(
    'Every value in the world model (`src/game/world/world.ts`), by system.',
  );
  const groups = new Map<string, string[][]>();
  for (const info of world.graph.vertices()) {
    const value = read(info.id);
    if (value === undefined) continue;
    const system = info.id.split('.')[0];
    const rows = groups.get(system) ?? [];
    rows.push([
      `\`${info.id}\``,
      info.kind,
      formatValue(value),
      info.where ?? info.note ?? '',
    ]);
    groups.set(system, rows);
  }
  for (const [system, rows] of groups) {
    parts.push(`### ${system}`);
    parts.push(table(['Id', 'Kind', 'Value', 'Where / note'], rows));
  }

  parts.push('## Room');
  parts.push(
    table(
      ['What', 'State'],
      Object.entries(extras.room).map(([what, value]) => [
        what,
        formatValue(value),
      ]),
    ),
  );

  parts.push("## Operator's log");
  parts.push(
    extras.log.length
      ? 'Newest first.\n\n' +
          extras.log.map((line) => `- ${line.replace(/\n/g, ' ')}`).join('\n')
      : 'Empty.',
  );

  parts.push('## Teletype');
  parts.push(
    extras.printed.length
      ? '```\n' + extras.printed.join('\n') + '\n```'
      : 'Nothing printed.',
  );

  return parts.join('\n\n') + '\n';
}

/** A file name for a report made at `time`: vx3-state-20261015-0123.md. */
export function stateReportName(time: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `vx3-state-${time.getFullYear()}${pad(time.getMonth() + 1)}${pad(time.getDate())}-${pad(time.getHours())}${pad(time.getMinutes())}.md`;
}
