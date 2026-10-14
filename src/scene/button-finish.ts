/** Fine injection-moulded plastic grain, edge wear, and a shallow pressed rim. */
export function drawButtonFinish(
  c: CanvasRenderingContext2D,
  width: number,
  height: number,
  base: string,
  seed: number,
) {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  c.fillStyle = base;
  c.fillRect(0, 0, width, height);
  for (let i = 0; i < width * height * 0.32; i++) {
    const x = random() * width;
    const y = random() * height;
    c.fillStyle =
      random() < 0.5 ? 'rgba(255,255,255,.075)' : 'rgba(32,29,26,.065)';
    c.fillRect(x, y, 0.7 + random() * 1.2, 0.7 + random() * 1.2);
  }
  const edge = Math.max(2, Math.round(Math.min(width, height) * 0.075));
  c.fillStyle = 'rgba(255,255,255,.16)';
  c.fillRect(edge, edge, width - edge * 2, 1);
  c.fillRect(edge, edge, 1, height - edge * 2);
  c.fillStyle = 'rgba(15,18,17,.18)';
  c.fillRect(edge, height - edge - 1, width - edge * 2, 1);
  c.fillRect(width - edge - 1, edge, 1, height - edge * 2);
  for (let i = 0; i < 3; i++) {
    const x = edge + random() * (width - edge * 2);
    const y = edge + random() * (height - edge * 2);
    c.strokeStyle = 'rgba(255,255,255,.08)';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + random() * 6, y + random() * 2);
    c.stroke();
  }
}
