import { batch, computed, signal } from '@preact/signals-core';

/**
 * A directed graph of cached functions, built on signals
 * (`@preact/signals-core`). Every vertex is a value with an id:
 *
 * - an **input** is set by an operator (a switch, a knob, a valve);
 * - a **fixed** value is a model parameter that no control in the lab
 *   sets, so it keeps its factory value;
 * - a **state** is integrated over time by a process (a temperature, a
 *   pressure, a speed), or set by an action;
 * - a **derived** value is a function of other vertices, recomputed only
 *   when one of them has changed, and passing a change on only when its
 *   own result differs (early cutoff);
 * - an **output** is a derived value that something in the room shows (a
 *   lamp, a needle, a readout): the graph's sinks.
 *
 * Two kinds of edge are not values. A **process** advances states each
 * tick from what it reads; an **action** is a momentary operator control
 * (a push button, a handle that springs back) that writes states.
 *
 * Every edge is declared, not discovered, so the whole graph can be
 * inspected: `analyse` finds vertices that nothing can reach or that reach
 * nothing, and `mermaid` draws it.
 */

export type NodeKind = 'input' | 'fixed' | 'state' | 'derived' | 'output';

export interface Node<T> {
  readonly id: string;
  /** The current value; read inside a derived function, it is tracked. */
  readonly value: T;
  /** The current value, untracked. */
  peek(): T;
}

export interface Writable<T> extends Node<T> {
  set(value: T): void;
}

export interface NodeInfo {
  id: string;
  kind: NodeKind;
  /** For inputs, the control that sets it; for outputs, what shows it. */
  where?: string;
  note?: string;
}

export interface VertexOptions {
  where?: string;
  note?: string;
  /**
   * When to treat a recomputed result as unchanged, for results that are
   * not plain values (arrays, objects). Plain values compare with `===`.
   */
  equals?: (a: never, b: never) => boolean;
}

/** A momentary control or a process: what it reads and what it writes. */
export interface EdgeInfo {
  id: string;
  kind: 'action' | 'process';
  reads: string[];
  writes: string[];
  where?: string;
  /**
   * A process that changes its states without any input changing, from
   * randomness or from the passing of time alone.
   */
  spontaneous?: boolean;
}

type Values<D extends readonly Node<unknown>[]> = {
  [K in keyof D]: D[K] extends Node<infer V> ? V : never;
};

export interface Analysis {
  /**
   * Inputs and actions that change no state: they may light a lamp that
   * shows their own position, but the machine does not notice them.
   */
  deadControls: string[];
  /** Inputs and actions from which no output can be reached at all. */
  unseenControls: string[];
  /** Fixed parameters: model values that no control in the lab sets. */
  fixedParameters: string[];
  /** Fixed parameters that nothing reads at all. */
  unusedParameters: string[];
  /** Outputs that no input, action or spontaneous process can change. */
  constantOutputs: string[];
  /** States and derived values that reach no output: invisible. */
  invisible: string[];
  /** States that nothing writes: they can never change. */
  unwrittenStates: string[];
}

export function createGraph() {
  const infos = new Map<string, NodeInfo>();
  /** Edges between values, from each vertex to those computed from it. */
  const edges = new Map<string, Set<string>>();
  const controls: EdgeInfo[] = [];
  const processes: (EdgeInfo & {
    step: (dt: number, random: () => number) => void;
  })[] = [];
  const writable = new Map<string, Writable<unknown>>();
  const nodes = new Map<string, Node<unknown>>();
  const recomputes = new Map<string, number>();

  const register = (info: NodeInfo) => {
    if (infos.has(info.id)) throw new Error(`Duplicate vertex ${info.id}.`);
    infos.set(info.id, info);
    edges.set(info.id, new Set());
  };
  const link = (from: string, to: string) => {
    if (!infos.has(from)) throw new Error(`${to} reads unknown ${from}.`);
    edges.get(from)!.add(to);
  };

  const value = <T>(
    kind: 'input' | 'fixed' | 'state',
    id: string,
    initial: T,
    options: VertexOptions = {},
  ): Writable<T> => {
    register({ id, kind, where: options.where, note: options.note });
    const cell = signal(initial);
    const equals = options.equals as ((a: T, b: T) => boolean) | undefined;
    const node: Writable<T> = {
      id,
      get value() {
        return cell.value;
      },
      peek: () => cell.peek(),
      set(next: T) {
        if (kind === 'fixed') throw new Error(`${id} is fixed.`);
        if (equals && equals(cell.peek(), next)) return;
        cell.value = next;
      },
    };
    writable.set(id, node as Writable<unknown>);
    nodes.set(id, node as Node<unknown>);
    return node;
  };

  const derived = <T, const D extends readonly Node<unknown>[]>(
    kind: 'derived' | 'output',
    id: string,
    deps: D,
    fn: (...values: Values<D>) => T,
    options: VertexOptions = {},
  ): Node<T> => {
    register({ id, kind, where: options.where, note: options.note });
    for (const dep of deps) link(dep.id, id);
    recomputes.set(id, 0);
    const equals = options.equals as ((a: T, b: T) => boolean) | undefined;
    let previous: T;
    let has = false;
    const cell = computed(() => {
      const values = deps.map((dep) => dep.value) as Values<D>;
      recomputes.set(id, recomputes.get(id)! + 1);
      const next = fn(...values);
      // Hand back the previous result when it is equal, so that `computed`
      // sees no change and nothing downstream recomputes.
      if (has && equals && equals(previous, next)) return previous;
      previous = next;
      has = true;
      return next;
    });
    const node: Node<T> = {
      id,
      get value() {
        return cell.value;
      },
      peek: () => cell.peek(),
    };
    nodes.set(id, node as Node<unknown>);
    return node;
  };

  /** Everything reachable from `start` along value edges and processes. */
  const downstream = (start: Iterable<string>) => {
    const seen = new Set<string>();
    const queue = [...start];
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const next of edges.get(id) ?? []) queue.push(next);
    }
    return seen;
  };
  /** Everything from which `targets` can be reached. */
  const upstream = (targets: Iterable<string>) => {
    const reverse = new Map<string, string[]>();
    for (const [from, tos] of edges)
      for (const to of tos) reverse.set(to, [...(reverse.get(to) ?? []), from]);
    const seen = new Set<string>();
    const queue = [...targets];
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const next of reverse.get(id) ?? []) queue.push(next);
    }
    return seen;
  };
  const ofKind = (...kinds: NodeKind[]) =>
    [...infos.values()].filter((i) => kinds.includes(i.kind)).map((i) => i.id);

  return {
    /** An operator control's setting. */
    input: <T>(id: string, initial: T, options?: VertexOptions) =>
      value('input', id, initial, options),
    /** A model parameter that no control sets. */
    fixed: <T>(id: string, initial: T, options?: VertexOptions) =>
      value('fixed', id, initial, options),
    /** A value advanced by a process or set by an action. */
    state: <T>(id: string, initial: T, options?: VertexOptions) =>
      value('state', id, initial, options),
    derive: <T, const D extends readonly Node<unknown>[]>(
      id: string,
      deps: D,
      fn: (...values: Values<D>) => T,
      options?: VertexOptions,
    ) => derived('derived', id, deps, fn, options),
    output: <T, const D extends readonly Node<unknown>[]>(
      id: string,
      deps: D,
      fn: (...values: Values<D>) => T,
      options?: VertexOptions,
    ) => derived('output', id, deps, fn, options),

    /**
     * A momentary control. Its writes happen in one batch, so derived
     * values settle once, after it has finished.
     */
    action<A extends unknown[], R>(
      id: string,
      reads: readonly Node<unknown>[],
      writes: readonly Writable<unknown>[],
      run: (...args: A) => R,
      where?: string,
    ) {
      const info: EdgeInfo = {
        id,
        kind: 'action',
        reads: reads.map((n) => n.id),
        writes: writes.map((n) => n.id),
        where,
      };
      register({ id, kind: 'input', where });
      for (const w of writes) link(id, w.id);
      controls.push(info);
      return (...args: A) => batch(() => run(...args));
    },

    /**
     * A process run once per tick, in the order processes are declared.
     * It reads values (untracked: use `peek`) and writes states.
     */
    process(
      id: string,
      reads: readonly Node<unknown>[],
      writes: readonly Writable<unknown>[],
      step: (dt: number, random: () => number) => void,
      options: { spontaneous?: boolean } = {},
    ) {
      for (const r of reads)
        for (const w of writes) {
          if (!infos.has(r.id)) throw new Error(`${id} reads unknown ${r.id}.`);
          link(r.id, w.id);
        }
      processes.push({
        id,
        kind: 'process',
        reads: reads.map((n) => n.id),
        writes: writes.map((n) => n.id),
        spontaneous: options.spontaneous,
        step,
      });
    },

    /** Advance every process by `dt` seconds. */
    tick(dt: number, random: () => number = Math.random) {
      for (const p of processes) batch(() => p.step(dt, random));
    },

    get: (id: string) => nodes.get(id),
    info: (id: string) => infos.get(id),
    vertices: () => [...infos.values()],
    actions: () => [...controls],
    processes: (): EdgeInfo[] =>
      processes.map(({ id, kind, reads, writes, spontaneous }) => ({
        id,
        kind,
        reads,
        writes,
        spontaneous,
      })),
    /** How often each derived value and output has been recomputed. */
    recomputes: () => new Map(recomputes),
    resetRecomputes() {
      for (const id of recomputes.keys()) recomputes.set(id, 0);
    },

    /** Every input and state, to put back later with `restore`. */
    snapshot(): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [id, node] of writable)
        if (infos.get(id)!.kind !== 'fixed') out[id] = node.peek();
      return structuredClone(out);
    },
    restore(snapshot: Record<string, unknown>) {
      const copy = structuredClone(snapshot);
      batch(() => {
        for (const [id, value] of Object.entries(copy))
          writable.get(id)?.set(value);
      });
    },

    /** Which vertices are cut off from the controls or from the room. */
    analyse(): Analysis {
      const outputs = ofKind('output');
      const seesOutput = upstream(outputs);
      const sources = [
        ...ofKind('input'),
        ...processes.filter((p) => p.spontaneous).flatMap((p) => p.writes),
      ];
      const reached = downstream(sources);
      const written = new Set([
        ...processes.flatMap((p) => p.writes),
        ...controls.flatMap((c) => c.writes),
      ]);
      const states = new Set(ofKind('state'));
      const changesState = (id: string) =>
        [...downstream([id])].some((d) => d !== id && states.has(d));
      return {
        deadControls: ofKind('input').filter((id) => !changesState(id)),
        unseenControls: ofKind('input').filter((id) => !seesOutput.has(id)),
        fixedParameters: ofKind('fixed'),
        unusedParameters: ofKind('fixed').filter(
          (id) => edges.get(id)!.size === 0,
        ),
        constantOutputs: outputs.filter((id) => !reached.has(id)),
        invisible: ofKind('state', 'derived').filter(
          (id) => !seesOutput.has(id),
        ),
        unwrittenStates: ofKind('state').filter((id) => !written.has(id)),
      };
    },

    /** The graph as a Mermaid flowchart, left to right. */
    mermaid() {
      const name = (id: string) => id.replace(/[^A-Za-z0-9]/g, '_');
      const shape: Record<NodeKind, [string, string]> = {
        input: ['[', ']'],
        fixed: ['[/', '/]'],
        state: ['((', '))'],
        derived: ['(', ')'],
        output: ['[[', ']]'],
      };
      const lines = ['flowchart LR'];
      for (const info of infos.values()) {
        const [open, close] = shape[info.kind];
        lines.push(
          `${name(info.id)}${open}"${info.id}"${close}:::${info.kind}`,
        );
      }
      for (const [from, tos] of edges)
        for (const to of tos) lines.push(`${name(from)} --> ${name(to)}`);
      lines.push(
        'classDef input fill:#f2c26b,stroke:#1d2622',
        'classDef fixed fill:#e0e0e0,stroke:#1d2622',
        'classDef state fill:#cfe5d2,stroke:#1d2622',
        'classDef derived fill:#ffffff,stroke:#1d2622',
        'classDef output fill:#cddbe8,stroke:#1d2622',
      );
      return lines.join('\n');
    },
  };
}

export type Graph = ReturnType<typeof createGraph>;
