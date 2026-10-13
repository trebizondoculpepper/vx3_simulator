/** Print only operator transactions that actually change the machine model. */
export function createMachineActionLog(
  snapshot: () => string,
  print: (line: string) => void,
  fallback: (label: string) => void,
) {
  let lines: string[] | null = null;
  return {
    record(line: string) {
      lines?.push(line);
    },
    run(label: string, action: () => void) {
      // Nested actions belong to the same operator transaction.
      if (lines) {
        action();
        return;
      }
      const before = snapshot();
      lines = [];
      try {
        action();
      } finally {
        try {
          if (before !== snapshot()) {
            if (!lines.length) fallback(label);
            for (const line of lines) print(line);
          }
        } finally {
          lines = null;
        }
      }
    },
  };
}
