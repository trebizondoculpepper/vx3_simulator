/** Keep the notebook immediate, but let the printer respond after 1–2 seconds. */
export function createDelayedPrinter(
  print: (line: string) => void,
  random: () => number = Math.random,
) {
  let clock = 0;
  const pending: { line: string; due: number }[] = [];
  return {
    queue(line: string) {
      const due = clock + 1 + Math.max(0, Math.min(1, random()));
      pending.push({ line, due: Math.max(due, pending.at(-1)?.due ?? 0) });
    },
    step(seconds: number) {
      clock += Math.max(0, seconds);
      while (pending.length && pending[0].due <= clock)
        print(pending.shift()!.line);
    },
  };
}
