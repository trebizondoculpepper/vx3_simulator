/**
 * The interconnected model behind the rack. Every component declares state
 * variables (such as `ferrocore.rpm`) and the influences on them: controls
 * on its own and other panels, and variables of other components, each
 * pushing up or down. The model is data, in doc/lore/component-catalogue.json;
 * this module runs it.
 *
 * All values are normalised to 0..1; `scale` and `unit` convert for display.
 */

import catalogueData from '../../doc/lore/component-catalogue.json';
import { momentaryKinds } from './panel-grid';
import type { PanelSpec } from './panel-grid';

export type Influence =
  | { kind: 'linear'; source: string; weight: number }
  /** weight × |a − b|: grows as two settings drift apart. */
  | { kind: 'difference'; a: string; b: string; weight: number }
  /** weight × (1 − |a − b|): peaks when two settings agree. */
  | { kind: 'match'; a: string; b: string; weight: number };

/** The variable is held at zero unless the source passes the threshold. */
export interface Gate {
  source: string;
  threshold: number;
  invert?: boolean;
}

export interface VariableSpec {
  id: string;
  label: string;
  unit: string;
  scale: number;
  /** `lag` eases toward its target; `integrate` accumulates it over time. */
  mode: 'lag' | 'integrate';
  base: number;
  /** Seconds: the lag time constant, or the time to integrate from 0 to 1. */
  lag: number;
  noise?: number;
  max?: number;
  influences: Influence[];
  gates?: Gate[];
}

export interface ComponentSpec {
  id: string;
  name: string;
  manufacturer: {
    name: string;
    origin: string;
    model: string;
    pairing: string;
  };
  visual_description: string;
  panel: PanelSpec;
  model: { variables: VariableSpec[]; topology?: 'network' | 'supply-chain' };
}

export const componentCatalogue =
  catalogueData as unknown as readonly ComponentSpec[];

interface CompiledVariable {
  key: string;
  spec: VariableSpec;
  influences: Influence[];
  gates: Gate[];
}

/**
 * Build a running model for the components actually present in a rack.
 * Influences from absent components are dropped, and gates on absent
 * components stay open, so any random selection of parts still runs.
 */
export function createRigModel(components: readonly ComponentSpec[]) {
  const values = new Map<string, number>();
  const inputKeys = new Set<string>();
  const momentary = new Set<string>();
  const variables: CompiledVariable[] = [];

  for (const component of components)
    for (const control of component.panel.controls) {
      const key = `${component.id}.${control.id}`;
      values.set(key, 0);
      inputKeys.add(key);
      if (momentaryKinds.has(control.kind)) momentary.add(key);
    }
  for (const component of components)
    for (const spec of component.model.variables)
      values.set(`${component.id}.${spec.id}`, 0);

  const present = (influence: Influence) =>
    influence.kind === 'linear'
      ? values.has(influence.source)
      : values.has(influence.a) && values.has(influence.b);
  for (const component of components)
    for (const spec of component.model.variables)
      variables.push({
        key: `${component.id}.${spec.id}`,
        spec,
        influences: spec.influences.filter(present),
        gates: (spec.gates ?? []).filter((gate) => values.has(gate.source)),
      });

  const read = (key: string) => values.get(key) ?? 0;
  const contribution = (influence: Influence) => {
    if (influence.kind === 'linear')
      return influence.weight * read(influence.source);
    const gap = Math.abs(read(influence.a) - read(influence.b));
    return influence.weight * (influence.kind === 'match' ? 1 - gap : gap);
  };
  const open = (gate: Gate) => {
    const above = read(gate.source) >= gate.threshold;
    return gate.invert ? !above : above;
  };

  return {
    /** Current normalised value of a control or variable (0 if absent). */
    get: read,
    has: (key: string) => values.has(key),
    /** Set a control, clamped to 0..1. Unknown controls are ignored. */
    setControl(key: string, value: number) {
      if (inputKeys.has(key)) values.set(key, Math.max(0, Math.min(1, value)));
    },
    /**
     * Advance every variable by `delta` seconds. Targets are computed from
     * the previous step's values, so evaluation order never matters.
     */
    step(delta: number, random: () => number = Math.random) {
      const next = variables.map(({ spec, influences, gates }) => {
        let target = spec.base;
        for (const influence of influences) target += contribution(influence);
        if (spec.noise) target += (random() - 0.5) * 2 * spec.noise;
        if (!gates.every(open)) target = 0;
        return target;
      });
      variables.forEach(({ key, spec }, i) => {
        const max = spec.max ?? 1;
        const value = read(key);
        const updated =
          spec.mode === 'integrate'
            ? value + (Math.max(-1, Math.min(1, next[i])) * delta) / spec.lag
            : value +
              (Math.max(0, Math.min(max, next[i])) - value) *
                (1 - Math.exp(-delta / spec.lag));
        values.set(key, Math.max(0, Math.min(max, updated)));
      });
      // Push buttons and plungers spring back after one step.
      for (const key of momentary) values.set(key, 0);
    },
    /** Display value of a variable in its own units. */
    display(key: string) {
      const [componentId, variableId] = key.split('.');
      const spec = components
        .find((component) => component.id === componentId)
        ?.model.variables.find((variable) => variable.id === variableId);
      return spec ? read(key) * spec.scale : read(key);
    },
  };
}

export type RigModel = ReturnType<typeof createRigModel>;
