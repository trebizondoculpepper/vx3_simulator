import { createCanvasTexture } from './screens';

/** A hand-drawn, low-resolution wall map for the laboratory pin board. */
export function createWorldMapTexture() {
  const { context, texture } = createCanvasTexture(256, 128);
  context.fillStyle = '#b7c1a9';
  context.fillRect(0, 0, 256, 128);
  context.strokeStyle = '#91a69b';
  context.lineWidth = 1;
  for (let x = 16; x < 256; x += 32) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, 128);
    context.stroke();
  }
  for (let y = 16; y < 128; y += 24) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(256, y + 0.5);
    context.stroke();
  }
  const land = (points: [number, number][]) => {
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fillStyle = '#d9cfaa';
    context.fill();
    context.strokeStyle = '#647963';
    context.lineWidth = 2;
    context.stroke();
  };
  land([
    [9, 28],
    [29, 17],
    [52, 19],
    [66, 27],
    [63, 37],
    [53, 42],
    [50, 53],
    [42, 58],
    [38, 50],
    [29, 47],
    [23, 38],
    [15, 42],
  ]);
  land([
    [50, 57],
    [67, 60],
    [75, 75],
    [69, 91],
    [61, 111],
    [55, 103],
    [53, 89],
    [45, 75],
  ]);
  land([
    [105, 29],
    [122, 25],
    [134, 31],
    [143, 42],
    [134, 51],
    [116, 49],
    [108, 40],
  ]);
  land([
    [118, 52],
    [139, 49],
    [150, 60],
    [146, 78],
    [136, 96],
    [123, 95],
    [114, 76],
  ]);
  land([
    [137, 28],
    [155, 18],
    [187, 20],
    [212, 27],
    [234, 34],
    [226, 48],
    [208, 52],
    [194, 64],
    [174, 58],
    [166, 47],
    [151, 50],
    [139, 41],
  ]);
  land([
    [198, 83],
    [218, 79],
    [229, 87],
    [224, 100],
    [209, 103],
    [195, 94],
  ]);
  land([
    [72, 12],
    [83, 10],
    [81, 19],
    [75, 22],
  ]);
  land([
    [243, 53],
    [249, 56],
    [248, 64],
    [244, 64],
  ]);
  context.strokeStyle = '#706d58';
  context.strokeRect(2.5, 2.5, 251, 123);
  texture.needsUpdate = true;
  return texture;
}
