/** Endless paper, with a bounded window of ink and reusable paper geometry. */
export function createPrinterLog(columns = 48, capacity = 96) {
  const rows: string[] = [];
  const pending: Array<{ remaining: number; started: boolean }> = [];
  let linesStarted = 0;
  let phase = 0;
  const append = (message: string) => {
    for (const paragraph of message.split('\n')) {
      let line = paragraph.trim();
      do {
        let end = Math.min(columns, line.length);
        if (line.length > columns) {
          const space = line.lastIndexOf(' ', columns);
          if (space > columns / 2) end = space;
        }
        const row = line.slice(0, end);
        rows.push(row);
        pending.push({ remaining: row.length + 1, started: false });
        line = line.slice(end).trimStart();
      } while (line.length);
    }
    rows.splice(0, Math.max(0, rows.length - capacity));
    pending.splice(0, Math.max(0, pending.length - capacity));
  };
  return {
    append,
    get rows(): readonly string[] {
      return rows;
    },
    get printing() {
      return pending.length > 0;
    },
    get linesStarted() {
      return linesStarted;
    },
    get phase() {
      return phase;
    },
    step(delta: number) {
      const seconds = Math.max(0, delta);
      const busy = pending.length > 0;
      linesStarted = 0;
      let budget = seconds * 65;
      while (pending.length && budget > 0) {
        const line = pending[0];
        if (!line.started) {
          line.started = true;
          linesStarted++;
        }
        const used = Math.min(budget, line.remaining);
        budget -= used;
        line.remaining -= used;
        if (line.remaining === 0) pending.shift();
      }
      phase = (phase + seconds * (busy ? 0.25 : 0)) % 1;
      return busy;
    },
  };
}
