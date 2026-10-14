import { createCanvasTexture } from './screens';

/** Painted steel, rubbed brass and wired glass, at the door's own scale. */
export function createLabDoorTexture(
  kind: 'enamel' | 'brass' | 'glass',
  seed: number,
) {
  const { context: c, texture } = createCanvasTexture(256, 512);
  let state = seed;
  const random = () =>
    (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
  c.fillStyle =
    kind === 'brass' ? '#ac8848' : kind === 'glass' ? '#304c47' : '#52665e';
  c.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 11000; i++) {
    c.fillStyle =
      random() < 0.5 ? 'rgba(255,255,230,.055)' : 'rgba(12,23,18,.07)';
    c.fillRect(random() * 256, random() * 512, kind === 'brass' ? 20 : 2, 1);
  }
  if (kind === 'glass') {
    c.strokeStyle = '#96a49a';
    c.lineWidth = 0.7;
    for (let x = -512; x < 768; x += 25) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 512, 512);
      c.stroke();
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x - 512, 512);
      c.stroke();
    }
    const reflection = c.createLinearGradient(0, 0, 256, 150);
    reflection.addColorStop(0, 'rgba(180,209,191,.02)');
    reflection.addColorStop(0.45, 'rgba(180,209,191,.22)');
    reflection.addColorStop(0.52, 'rgba(180,209,191,.03)');
    c.fillStyle = reflection;
    c.fillRect(0, 0, 256, 512);
  } else {
    const wear = c.createRadialGradient(125, 300, 12, 125, 300, 170);
    wear.addColorStop(
      0,
      kind === 'brass' ? 'rgba(250,222,147,.38)' : 'rgba(21,31,24,.18)',
    );
    wear.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = wear;
    c.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 65; i++) {
      const x =
        random() < 0.7
          ? random() < 0.5
            ? random() * 12
            : 244 + random() * 12
          : random() * 256;
      c.strokeStyle =
        kind === 'brass' ? 'rgba(56,42,19,.22)' : 'rgba(193,189,161,.35)';
      c.beginPath();
      const y = random() * 512;
      c.moveTo(x, y);
      c.lineTo(x + random() * 5, y + 2 + random() * 18);
      c.stroke();
    }
    if (kind === 'brass') {
      c.fillStyle = '#493c25';
      c.font = 'bold 21px sans-serif';
      c.textAlign = 'center';
      c.fillText('DRÜCKEN', 128, 90, 212);
    }
  }
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Local apparatus hazards, printed as enamel notices rather than glowing UI. */
export function createLabDoorWarning(kind: 'voltage' | 'field') {
  const { context: c, texture } = createCanvasTexture(512, 320);
  c.fillStyle = '#dedbc7';
  c.fillRect(0, 0, 512, 320);
  c.strokeStyle = '#242822';
  c.lineWidth = 7;
  c.strokeRect(5, 5, 502, 310);
  c.fillStyle = '#e3b92d';
  c.fillRect(10, 10, 492, 172);
  c.fillStyle = '#171d19';
  c.beginPath();
  c.moveTo(256, 27);
  c.lineTo(180, 157);
  c.lineTo(332, 157);
  c.closePath();
  c.fill();
  c.fillStyle = '#e3b92d';
  c.beginPath();
  c.moveTo(256, 43);
  c.lineTo(195, 148);
  c.lineTo(317, 148);
  c.closePath();
  c.fill();
  c.fillStyle = '#171d19';
  if (kind === 'voltage') {
    c.beginPath();
    c.moveTo(265, 62);
    c.lineTo(234, 105);
    c.lineTo(254, 104);
    c.lineTo(244, 135);
    c.lineTo(279, 91);
    c.lineTo(259, 92);
    c.closePath();
    c.fill();
  } else {
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(236, 85);
    c.lineTo(236, 111);
    c.arc(256, 111, 20, Math.PI, 0, true);
    c.lineTo(276, 85);
    c.stroke();
    c.fillRect(229, 77, 14, 9);
    c.fillRect(269, 77, 14, 9);
  }
  c.textAlign = 'center';
  c.font = 'bold 31px sans-serif';
  c.fillText(
    kind === 'voltage' ? 'HOCHSPANNUNG' : 'STARKES MAGNETFELD',
    256,
    226,
    470,
  );
  c.font = 'bold 19px sans-serif';
  c.fillText('ZUTRITT NUR FÜR', 256, 269);
  c.fillText('BEFUGTES PERSONAL', 256, 294);
  texture.needsUpdate = true;
  return texture;
}
