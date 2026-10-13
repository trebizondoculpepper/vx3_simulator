type State = Record<string, unknown>;

function changes(
  before: State,
  after: State,
  prefix = '',
): [string, unknown][] {
  return Object.entries(after).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value))
      return changes((before[key] as State) ?? {}, value as State, path);
    return before[key] === value ? [] : [[path, value] as [string, unknown]];
  });
}

/** Describe the resulting input state rather than merely saying it was operated. */
export function describeMachineChange(
  label: string,
  before: string,
  after: string,
) {
  const changed = changes(
    JSON.parse(before) as State,
    JSON.parse(after) as State,
  );
  const power = changed.find(([key]) => key.startsWith('powerSelections.'));
  if (power) {
    const name = {
      isolator: 'Supply isolator',
      mains: 'NETZ switch',
      cabinet: 'Cabinet power switch',
    }[power[0].split('.')[1]];
    return `${name} switched ${power[1] ? 'on' : 'off'}.`;
  }
  const detail = changed
    .filter(([key]) => key !== 'columnPower')
    .map(([key, value]) => {
      const name = key.split('.').at(-1)!;
      if (name === 'clamped') return `clamp ${value ? 'closed' : 'opened'}`;
      if (name === 'inletOpen' || name === 'outletOpen')
        return `${name === 'inletOpen' ? 'inlet' : 'outlet'} ${value ? 'opened' : 'closed'}`;
      if (name === 'liftTarget')
        return `head set to ${value ? 'raised' : 'lowered'}`;
      const readable = name.replace(/([A-Z])/g, ' $1').toLowerCase();
      if (typeof value === 'boolean')
        return `${readable} switched ${value ? 'on' : 'off'}`;
      if (typeof value === 'number')
        return `${readable} set to ${Number(value.toFixed(3))}`;
      return `${readable} changed to ${String(value)}`;
    });
  return `${label} — ${detail.join('; ')}.`;
}
