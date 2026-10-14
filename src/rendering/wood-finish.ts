import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';

/**
 * An old laboratory workbench top, in place since the 1970s: oiled
 * hardwood darkened by decades of polish, its grain running along the
 * bench, rubbed lighter and smoother along the front edge where hands and
 * elbows rest, grimy along the wall, and marked all over by use: cup and
 * bottle rings, chemical and oil stains with dark rims, scorches from
 * soldering irons, ink and solder spots, scratches and gouges.
 *
 * One texture covers the whole top, `length` by `depth` metres, so
 * nothing repeats. u runs along the bench, v out from the wall (0) to the
 * front edge (1). Drawn procedurally and seeded, so it is the same bench
 * every visit.
 */
export function createAgedBenchTop({
  length = 5,
  depth = 0.75,
  seed = 7,
} = {}) {
  const pxPerMetre = 360;
  const w = Math.round(length * pxPerMetre);
  const h = Math.round(depth * pxPerMetre);
  let a = seed * 7919 + 13;
  const random = () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
  const canvas = (fill: (c: CanvasRenderingContext2D) => void) => {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    fill(el.getContext('2d')!);
    return el;
  };
  /** Where things are: x along the bench, y out from the wall, px. */
  const spots = (count: number, frontBias = 0) =>
    Array.from({ length: count }, () => ({
      x: random() * w,
      y: h * Math.min(0.97, Math.max(0.05, random() ** (1 - frontBias))),
    }));

  // ---- Colour ----------------------------------------------------------------
  const colour = canvas((c) => {
    // Old oiled oak, darkened by polish.
    c.fillStyle = '#4a2f19';
    c.fillRect(0, 0, w, h);
    // Grain: long streaks along the bench, lighter and darker, wavering.
    for (let k = 0; k < 900; k++) {
      const y0 = random() * h;
      const dark = random() < 0.6;
      c.strokeStyle = dark
        ? `rgba(40, 24, 12, ${0.08 + random() * 0.18})`
        : `rgba(150, 105, 60, ${0.05 + random() * 0.1})`;
      c.lineWidth = 0.6 + random() * 2.2;
      c.beginPath();
      const x0 = random() * w;
      const span = 200 + random() * 900;
      let y = y0;
      c.moveTo(x0, y);
      for (let x = x0; x < x0 + span; x += 24) {
        y += (random() - 0.5) * 1.6 + Math.sin(x * 0.004 + y0) * 0.6;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    // Boards: faint joints along the bench.
    c.strokeStyle = 'rgba(25, 14, 6, 0.55)';
    c.lineWidth = 1.5;
    for (const share of [0.33, 0.66]) {
      c.beginPath();
      c.moveTo(0, h * share);
      c.lineTo(w, h * share + (random() - 0.5) * 3);
      c.stroke();
    }
    // A mottled patina of old polish.
    for (let k = 0; k < 160; k++) {
      const x = random() * w;
      const y = random() * h;
      const r = 20 + random() * 90;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const dark = random() < 0.8;
      g.addColorStop(
        0,
        dark ? 'rgba(28, 16, 7, 0.18)' : 'rgba(110, 74, 40, 0.07)',
      );
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Grime along the wall; the front edge rubbed lighter by hands.
    const wall = c.createLinearGradient(0, 0, 0, h);
    wall.addColorStop(0, 'rgba(20, 14, 8, 0.45)');
    wall.addColorStop(0.18, 'rgba(20, 14, 8, 0)');
    wall.addColorStop(0.8, 'rgba(160, 120, 75, 0)');
    wall.addColorStop(1, 'rgba(160, 120, 75, 0.22)');
    c.fillStyle = wall;
    c.fillRect(0, 0, w, h);
    // Cup and bottle rings.
    for (const { x, y } of spots(55, 0.4)) {
      const r = 10 + random() * 22;
      c.strokeStyle = `rgba(35, 20, 10, ${0.25 + random() * 0.35})`;
      c.lineWidth = 1.5 + random() * 2.5;
      c.beginPath();
      // Often only part of a ring, where the cup was dragged or wiped.
      const start = random() * Math.PI * 2;
      c.arc(x, y, r, start, start + Math.PI * (1.2 + random() * 0.8));
      c.stroke();
    }
    // Chemical and oil stains: blotches with darker rims.
    for (const { x, y } of spots(45, 0.3)) {
      const r = 8 + random() * 45;
      const tint =
        random() < 0.3
          ? '38, 30, 24'
          : random() < 0.5
            ? '28, 26, 18'
            : '45, 25, 10';
      const g = c.createRadialGradient(x, y, r * 0.3, x, y, r);
      g.addColorStop(0, `rgba(${tint}, ${0.18 + random() * 0.2})`);
      g.addColorStop(0.85, `rgba(${tint}, ${0.35 + random() * 0.25})`);
      g.addColorStop(1, `rgba(${tint}, 0)`);
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(
        x,
        y,
        r,
        r * (0.6 + random() * 0.4),
        random() * Math.PI,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    // Scorches from soldering irons, laid down hot.
    for (const { x, y } of spots(14, 0.5)) {
      const len = 14 + random() * 30;
      const angle = random() * Math.PI;
      const g = c.createRadialGradient(x, y, 0, x, y, len);
      g.addColorStop(0, 'rgba(8, 5, 3, 0.85)');
      g.addColorStop(0.5, 'rgba(25, 14, 6, 0.5)');
      g.addColorStop(1, 'rgba(25, 14, 6, 0)');
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      c.scale(1, 0.35);
      c.translate(-x, -y);
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, len, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    // Ink and solder spots.
    for (const { x, y } of spots(140, 0.5)) {
      const solder = random() < 0.35;
      c.fillStyle = solder
        ? 'rgba(170, 170, 160, 0.7)'
        : `rgba(20, 22, 45, ${0.35 + random() * 0.4})`;
      c.beginPath();
      c.arc(x, y, 0.8 + random() * 2.2, 0, Math.PI * 2);
      c.fill();
    }
    // Scratches and gouges, mostly near the front where work was done.
    for (const { x, y } of spots(260, 0.6)) {
      const len = 6 + random() * 60;
      const angle = (random() - 0.5) * 1.2 + (random() < 0.3 ? Math.PI / 2 : 0);
      c.strokeStyle =
        random() < 0.6
          ? `rgba(150, 110, 70, ${0.2 + random() * 0.3})`
          : `rgba(20, 12, 6, ${0.25 + random() * 0.3})`;
      c.lineWidth = 0.5 + random() * 1.4;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      c.stroke();
    }
  });

  // ---- Roughness: polished smooth, worn and stained rough --------------------
  const roughness = canvas((c) => {
    c.fillStyle = 'rgb(150, 150, 150)';
    c.fillRect(0, 0, w, h);
    // Polish: smooth patches, smoothest along the front where it is rubbed.
    for (let k = 0; k < 120; k++) {
      const x = random() * w;
      const y = random() * h;
      const r = 30 + random() * 120;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(95, 95, 95, 0.45)');
      g.addColorStop(1, 'rgba(95, 95, 95, 0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const front = c.createLinearGradient(0, 0, 0, h);
    front.addColorStop(0, 'rgba(200, 200, 200, 0.5)');
    front.addColorStop(0.2, 'rgba(200, 200, 200, 0)');
    front.addColorStop(0.85, 'rgba(50, 50, 50, 0)');
    front.addColorStop(1, 'rgba(50, 50, 50, 0.6)');
    c.fillStyle = front;
    c.fillRect(0, 0, w, h);
    // Stains and scorches dull the finish.
    for (let k = 0; k < 70; k++) {
      const x = random() * w;
      const y = random() * h;
      const r = 10 + random() * 40;
      c.fillStyle = 'rgba(210, 210, 210, 0.35)';
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });

  const texture = (source: HTMLCanvasElement, isColour: boolean): Texture => {
    const t = new CanvasTexture(source);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.anisotropy = 8;
    if (isColour) t.colorSpace = SRGBColorSpace;
    return t;
  };
  return {
    map: texture(colour, true),
    roughnessMap: texture(roughness, false),
  };
}
