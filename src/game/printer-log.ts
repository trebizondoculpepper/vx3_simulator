/** Endless paper, with a bounded window of ink and reusable paper geometry. */
export function createPrinterLog(columns = 48, capacity = 96) {
  const rows: string[] = [];
  let remaining = 0;
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
        remaining += row.length + 1;
        line = line.slice(end).trimStart();
      } while (line.length);
    }
    rows.splice(0, Math.max(0, rows.length - capacity));
  };
  return {
    append,
    get rows(): readonly string[] {
      return rows;
    },
    get printing() {
      return remaining > 0;
    },
    get phase() {
      return phase;
    },
    step(delta: number) {
      const seconds = Math.max(0, delta);
      const busy = remaining > 0;
      remaining = Math.max(0, remaining - seconds * 65);
      phase = (phase + seconds * (busy ? 0.25 : 0.018)) % 1;
      return busy;
    },
  };
}
