import { BoxGeometry, Group, Mesh, PlaneGeometry } from 'three';
import type { Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture } from './screens';

type Sheet = 'start' | 'xenon' | 'shutdown' | 'resonance';

const W = 768;
const H = 960;

function drawSheet(kind: Sheet) {
  const { context: c, texture } = createCanvasTexture(W, H);
  const emergency = kind === 'shutdown';
  const paper = emergency
    ? '#ede5cf'
    : kind === 'resonance'
      ? '#e7d9b7'
      : '#143c55';
  const ink = emergency
    ? '#31332d'
    : kind === 'resonance'
      ? '#453b30'
      : '#d8e9dd';
  const accent = emergency
    ? '#a43729'
    : kind === 'resonance'
      ? '#a75330'
      : '#79c8d1';
  c.fillStyle = paper;
  c.fillRect(0, 0, W, H);
  c.strokeStyle = ink;
  c.lineWidth = 3;
  c.strokeRect(22, 22, W - 44, H - 44);
  c.lineWidth = 1;
  c.strokeRect(32, 32, W - 64, H - 64);
  if (!emergency && kind !== 'resonance') {
    c.strokeStyle = '#28516a';
    for (let x = 48; x < W; x += 48) {
      c.beginPath();
      c.moveTo(x, 48);
      c.lineTo(x, H - 48);
      c.stroke();
    }
    for (let y = 48; y < H; y += 48) {
      c.beginPath();
      c.moveTo(48, y);
      c.lineTo(W - 48, y);
      c.stroke();
    }
  }
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    colour = ink,
    width = 3,
  ) => {
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };
  const text = (
    value: string,
    x: number,
    y: number,
    size = 29,
    colour = ink,
    align: CanvasTextAlign = 'left',
  ) => {
    c.fillStyle = colour;
    c.font = `bold ${size}px monospace`;
    c.textAlign = align;
    c.fillText(value, x, y);
  };
  const box = (x: number, y: number, w: number, h: number, colour = ink) => {
    c.strokeStyle = colour;
    c.lineWidth = 3;
    c.strokeRect(x, y, w, h);
  };
  const arrow = (x: number, y1: number, y2: number) => {
    line(x, y1, x, y2, accent, 5);
    line(x - 10, y2 - 12, x, y2, accent, 5);
    line(x + 10, y2 - 12, x, y2, accent, 5);
  };
  const titles: Record<Sheet, [string, string, string]> = {
    start: ['VX3 / KALTSTART', 'BETRIEBSABLAUF  01', 'TAFEL A-17'],
    xenon: ['XENONVERSORGUNG', 'GASKREIS TECHNIKRAUM  02', 'TAFEL X-04'],
    shutdown: ['NOTABSCHALTUNG', 'ANLAGE TRENNEN  03', 'TAFEL E-09'],
    resonance: ['QUANTENRESONANZ', 'ESKALATIONSABLAUF  04', 'TAFEL Q-12'],
  };
  const [title, subtitle, plate] = titles[kind];
  text('HELMHOLTZ-BAU  /  VX-LABOR', 56, 83, 24);
  line(56, 100, W - 56, 100, accent, 5);
  text(title, 56, 154, 42, accent);
  text(subtitle, 56, 193, 25);
  line(56, 212, W - 56, 212);

  if (kind === 'start') {
    const stages = [
      ['01', 'XENONKÄFIG ÖFFNEN', 'Flaschenbank prüfen'],
      ['02', 'DURCHFLUSS EINSTELLEN', 'Reglerdruck ablesen'],
      ['03', 'MIN. 2 SLPM PRÜFEN', 'Schwebekörper stabil'],
      ['04', 'HAUPTSCHALTER EIN', 'Feldanzeigen prüfen'],
      ['05', 'PHASENSPINDEL ANFAHREN', 'Resonanzkurve beobachten'],
    ];
    stages.forEach(([n, head, note], i) => {
      const y = 248 + i * 120;
      box(62, y, 644, 88);
      c.fillStyle = accent;
      c.fillRect(62, y, 84, 88);
      text(n, 104, y + 57, 43, paper, 'center');
      text(head, 168, y + 37, 31);
      text(note, 168, y + 70, 22);
      if (i < stages.length - 1) arrow(384, y + 88, y + 118);
    });
    text('BEI INSTABILER ANZEIGE ANHALTEN', 384, 899, 24, accent, 'center');
  } else if (kind === 'xenon') {
    text('DREI XENONFLASCHEN', 384, 266, 31, ink, 'center');
    for (let i = 0; i < 3; i++) {
      const x = 160 + i * 176;
      box(x, 332, 70, 235);
      c.beginPath();
      c.arc(x + 35, 332, 35, Math.PI, 0);
      c.stroke();
      line(x + 35, 304, x + 35, 284, accent, 5);
      text(`Xe-${i + 1}`, x + 35, 610, 24, ink, 'center');
      line(x + 35, 285, x + 35, 310, accent, 5);
      line(x + 35, 284, 598, 284, accent, 5);
    }
    line(598, 284, 598, 665, accent, 5);
    box(515, 664, 166, 79, accent);
    text('DRUCKREGLER', 598, 713, 21, ink, 'center');
    line(515, 703, 380, 703, accent, 5);
    c.strokeStyle = ink;
    c.lineWidth = 4;
    c.beginPath();
    c.arc(329, 703, 48, 0, Math.PI * 2);
    c.stroke();
    text('FLUSS', 329, 712, 23, ink, 'center');
    line(281, 703, 103, 703, accent, 5);
    arrow(103, 710, 800);
    text('ZUM VX3-VERTEILER', 105, 841, 30);
    text('VOR EINSCHALTEN: MIN. 2 SLPM', 384, 898, 24, accent, 'center');
  } else if (kind === 'shutdown') {
    c.fillStyle = accent;
    c.fillRect(62, 249, 644, 104);
    text('PHASENSPINDEL STOPPEN', 384, 315, 36, '#f3e8d6', 'center');
    const stages = [
      ['01', 'FELD / BLATZ AUF NULL'],
      ['02', 'HAUPTSCHALTER AUS'],
      ['03', 'XENONVENTIL SCHLIESSEN'],
      ['04', 'RESTGLÜHEN MELDEN'],
    ];
    stages.forEach(([n, label], i) => {
      const y = 389 + i * 111;
      box(62, y, 644, 82, i < 2 ? accent : ink);
      text(n, 95, y + 54, 34, accent);
      text(label, 152, y + 52, 29);
    });
    text('KEIN NEUSTART OHNE FREIGABE', 384, 894, 27, accent, 'center');
  } else {
    text('KURVE / FELDREAKTION', 384, 262, 28, ink, 'center');
    box(62, 282, 644, 229);
    for (let i = 1; i < 5; i++)
      line(62, 282 + i * 46, 706, 282 + i * 46, '#b7a785', 1);
    for (let i = 1; i < 8; i++)
      line(62 + i * 80, 282, 62 + i * 80, 511, '#b7a785', 1);
    c.strokeStyle = accent;
    c.lineWidth = 8;
    c.beginPath();
    for (let x = 67; x <= 701; x += 9) {
      const t = (x - 67) / 634;
      const y = 402 - Math.sin(t * 49) * (14 + t * t * 88);
      if (x === 67) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    line(472, 290, 472, 502, accent, 4);
    text('GRENZE', 480, 315, 22, accent);
    const stages = [
      'HOLTZMANN-SPULE DÄMPFEN',
      'SPINDELDREHZAHL SENKEN',
      'KAMMERMONITOR BEOBACHTEN',
      'BEI WEITEREM ANSTIEG: NETZ AUS',
    ];
    stages.forEach((stage, i) => {
      const y = 557 + i * 70;
      box(62, y, 644, 54, i === 3 ? accent : ink);
      text(`${i + 1}. ${stage}`, 79, y + 38, 26, i === 3 ? accent : ink);
    });
    text('FREIGABE VOR NEUSTART NÖTIG', 384, 896, 24, accent, 'center');
  }
  line(56, 923, W - 56, 923);
  text('SEKTION PHYSIK   /   INTERN', 56, 946, 19);
  text(plate, 710, 946, 19, ink, 'right');
  texture.needsUpdate = true;
  return texture;
}

/** Four pinned operating diagrams on the south wall opposite the lab door. */
export function createCorridorBlueprints(options: {
  doorX: number;
  southZ: number;
  floorY: number;
  worldUnitsPerMetre: number;
}) {
  const { doorX, southZ, floorY, worldUnitsPerMetre: m } = options;
  const group = new Group();
  group.name = 'CorridorBlueprints';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const kinds: Sheet[] = ['start', 'xenon', 'shutdown', 'resonance'];
  // The first frame gave way to the museum entrance.
  for (let i = 1; i < kinds.length; i++) {
    const x = doorX + (i - 1.5) * 1.65 * m;
    const y = floorY + 1.64 * m;
    const frame = new Mesh(
      new BoxGeometry(1.49 * m, 1.84 * m, 0.045 * m),
      createPs1Material({ color: '#282f2c' }),
    );
    materials.push(frame.material);
    frame.position.set(x, y, southZ - 0.05 * m);
    group.add(frame);
    const backing = new Mesh(
      new BoxGeometry(1.43 * m, 1.78 * m, 0.008 * m),
      createPs1Material({ color: '#9a937b' }),
    );
    materials.push(backing.material);
    backing.position.set(x, y, southZ - 0.078 * m);
    group.add(backing);
    const texture = drawSheet(kinds[i]);
    textures.push(texture);
    const face = new Mesh(
      new PlaneGeometry(1.36 * m, 1.7 * m),
      createPs1Material({ map: texture }, true, true),
    );
    materials.push(face.material);
    face.rotation.y = Math.PI;
    face.position.set(x, y, southZ - 0.087 * m);
    group.add(face);
    for (const dx of [-0.64 * m, 0.64 * m]) {
      const pin = new Mesh(
        new BoxGeometry(0.03 * m, 0.03 * m, 0.008 * m),
        createPs1Material({ color: '#b6a477', metalness: 0.4 }),
      );
      materials.push(pin.material);
      pin.position.set(x + dx, y + 0.81 * m, southZ - 0.094 * m);
      group.add(pin);
    }
  }
  return {
    group,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
