import { createCanvasTexture } from './screens';

interface BrandStyle {
  primary: string;
  secondary: string;
  mark: 'bolt' | 'rings' | 'links' | 'sun' | 'gear' | 'arrow';
}

const brands: Record<string, BrandStyle> = {
  'VOLT XOCCULA': { primary: '#efab50', secondary: '#73c6bd', mark: 'bolt' },
  'NEUMANN DYNAMIK': {
    primary: '#e9cd71',
    secondary: '#76a5a0',
    mark: 'rings',
  },
  SYNCLEX: { primary: '#c48aaf', secondary: '#79c5cf', mark: 'links' },
  'WONSHOU LABS': { primary: '#dc745c', secondary: '#e5be72', mark: 'sun' },
  'BONK INDUSTRIES': {
    primary: '#e5b85d',
    secondary: '#e78454',
    mark: 'gear',
  },
  GORSKIY: { primary: '#d66957', secondary: '#80a7b6', mark: 'arrow' },
};

/** Painted manufacturer livery under the actual panel hardware. */
export function createPanelLivery(
  maker: string,
  finish: string,
  units: number,
) {
  const width = 512;
  const height = units * 48;
  const { context, texture } = createCanvasTexture(width, height);
  const brand = brands[maker] ?? brands['VOLT XOCCULA'];
  context.fillStyle =
    brand.mark === 'rings'
      ? '#bfb49a'
      : brand.mark === 'arrow'
        ? '#3e5144'
        : finish;
  context.fillRect(0, 0, width, height);
  if (brand.mark === 'bolt') {
    // Volt Xoccula: the one full rainbow sweep.
    const rainbow = ['#d35050', '#e6844e', '#e5c455', '#75b6a0', '#5a94af'];
    context.lineWidth = 11;
    for (const [index, colour] of rainbow.entries()) {
      context.strokeStyle = colour;
      context.beginPath();
      context.moveTo(-25, height * 0.67 + index * 11);
      context.bezierCurveTo(
        width * 0.38,
        height * 0.78 + index * 7,
        width * 0.54,
        height * 0.19 + index * 8,
        width + 30,
        height * 0.27 + index * 11,
      );
      context.stroke();
    }
  } else if (brand.mark === 'rings') {
    // Neumann: cream enamel, measured linework and a restrained blue band.
    context.strokeStyle = '#567980';
    context.lineWidth = 5;
    context.strokeRect(31, 48, width - 62, height - 84);
    context.fillStyle = '#d2c29a';
    context.fillRect(35, height * 0.55, width - 70, 18);
  } else if (brand.mark === 'links') {
    // Synclex: modular blocks in unapologetic cyan and magenta.
    context.fillStyle = '#bd65a2';
    context.fillRect(0, height * 0.43, width * 0.48, 31);
    context.fillStyle = '#48abbc';
    context.fillRect(width * 0.48, height * 0.34, width * 0.52, 43);
    context.fillStyle = '#d2a0c1';
    context.fillRect(width * 0.31, height * 0.76, width * 0.69, 16);
  } else if (brand.mark === 'sun') {
    // Wonshou: vermilion and gold radiating from the rectifier badge.
    context.fillStyle = '#b44f3c';
    context.fillRect(0, height * 0.54, width, 32);
    context.fillStyle = '#d9ac5d';
    context.fillRect(0, height * 0.54 + 32, width, 13);
    for (let x = 120; x < width; x += 85) {
      context.fillStyle = '#cb7650';
      context.fillRect(x, 35, 18, height * 0.4);
    }
  } else if (brand.mark === 'gear') {
    // Bonk: industrial yellow and orange safety chevrons.
    context.fillStyle = '#df9a47';
    context.fillRect(0, height * 0.53, width, 44);
    context.strokeStyle = '#333831';
    context.lineWidth = 13;
    for (let x = -50; x < width + 50; x += 43) {
      context.beginPath();
      context.moveTo(x, height * 0.53 + 44);
      context.lineTo(x + 43, height * 0.53);
      context.stroke();
    }
  } else {
    // Gorskiy: brush-painted olive and sand camouflage, with a red index stripe.
    for (let x = -25; x < width; x += 118) {
      context.fillStyle = '#777c58';
      context.beginPath();
      context.moveTo(x, 38);
      context.lineTo(x + 76, 43);
      context.lineTo(x + 36, height - 23);
      context.lineTo(x - 25, height - 42);
      context.fill();
      context.fillStyle = '#a19370';
      context.fillRect(x + 49, height * 0.55, 43, 21);
    }
    context.fillStyle = '#b94e42';
    context.fillRect(0, height - 39, width, 9);
  }

  // The enamel header and lower calibration line are common to the range.
  context.fillStyle = '#1b2627';
  context.fillRect(0, 0, width, 31);
  context.fillStyle = brand.primary;
  context.fillRect(0, 0, width, 5);
  context.fillRect(16, height - 13, width - 32, 3);
  context.fillStyle = brand.secondary;
  context.fillRect(16, height - 10, width * 0.4, 2);
  context.fillRect(14, 40, 5, height - 66);
  context.fillRect(width - 19, 40, 5, height - 66);

  // Large, faded stencil work is intentionally interrupted by switches and meters.
  context.globalAlpha = brand.mark === 'rings' ? 0.25 : 0.12;
  context.strokeStyle = brand.secondary;
  context.lineWidth = 2;
  for (let x = 72; x < width - 45; x += 54) {
    context.beginPath();
    context.moveTo(x, 40);
    context.lineTo(x - 52, height - 27);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.save();
  context.translate(60, height * 0.52);
  drawBrandMark(context, brand, finish);
  context.restore();

  context.globalAlpha = 0.8;
  context.fillStyle = brand.primary;
  context.font = '900 21px "Arial Rounded MT Bold", "Arial Black", sans-serif';
  context.textAlign = 'right';
  context.fillText(maker.split(' ')[0], width - 37, height - 34);
  context.globalAlpha = 1;
  texture.needsUpdate = true;
  return texture;
}

/** Each maker gets a coloured identity strip over a common cream apparatus plate. */
export function createPanelHeader(maker: string, title: string) {
  const width = 512;
  const height = 38;
  const { context, texture } = createCanvasTexture(width, height);
  const brand = brands[maker] ?? brands['VOLT XOCCULA'];
  context.fillStyle = brand.mark === 'arrow' ? '#d1c6a1' : '#e5d7aa';
  context.fillRect(0, 0, width, height);
  context.fillStyle = brand.mark === 'rings' ? '#d2c29a' : brand.primary;
  context.fillRect(0, 0, 173, height);
  context.fillStyle = brand.secondary;
  context.fillRect(173, 0, 7, height);
  context.fillStyle = '#202826';
  context.textBaseline = 'middle';
  context.font = '900 22px "Arial Rounded MT Bold", "Arial Black", sans-serif';
  context.textAlign = 'center';
  context.fillText(maker, 86, height / 2 + 1, 162);
  context.textAlign = 'left';
  context.font = '900 18px "Arial Rounded MT Bold", "Arial Black", sans-serif';
  context.fillText(title, 193, height / 2 + 1, 307);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The maker's mark, about 64 px across, centred on the current origin:
 * Volt Xoccula's bolt, Neumann's rings, Synclex's links, Wonshou's sun,
 * Bonk's gear and Gorskiy's arrow.
 */
function drawBrandMark(
  context: CanvasRenderingContext2D,
  brand: BrandStyle,
  finish: string,
) {
  const radius = 29;
  context.strokeStyle = brand.primary;
  context.fillStyle = brand.primary;
  context.lineWidth = 8;
  if (brand.mark === 'bolt') {
    context.beginPath();
    context.moveTo(4, -radius);
    context.lineTo(-14, 1);
    context.lineTo(0, 1);
    context.lineTo(-6, radius);
    context.lineTo(20, -8);
    context.lineTo(4, -8);
    context.closePath();
    context.fill();
  } else if (brand.mark === 'rings') {
    for (const r of [12, 23, 32]) {
      context.beginPath();
      context.arc(0, 0, r, -Math.PI * 0.8, Math.PI * 0.65);
      context.stroke();
    }
  } else if (brand.mark === 'links') {
    context.beginPath();
    context.ellipse(-10, 0, 20, 13, -0.5, 0, Math.PI * 2);
    context.ellipse(12, 0, 20, 13, -0.5, 0, Math.PI * 2);
    context.stroke();
  } else if (brand.mark === 'sun') {
    context.beginPath();
    context.arc(0, -5, 18, 0, Math.PI * 2);
    context.fill();
    for (const y of [17, 26, 35]) context.fillRect(-31, y, 62, 4);
  } else if (brand.mark === 'gear') {
    for (let i = 0; i < 8; i++) {
      context.save();
      context.rotate((i * Math.PI) / 4);
      context.fillRect(-5, -34, 10, 17);
      context.restore();
    }
    context.beginPath();
    context.arc(0, 0, 20, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = finish;
    context.beginPath();
    context.arc(0, 0, 8, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(-30, 18);
    context.lineTo(8, -27);
    context.lineTo(30, -27);
    context.lineTo(-7, 18);
    context.closePath();
    context.fill();
    context.fillStyle = brand.secondary;
    context.fillRect(-30, 25, 60, 6);
  }
}

/** Size of a module's face and where its parts sit, in scene units. */
export interface BrandingLayout {
  /** The painted face, centred on the panel. */
  face: { width: number; height: number };
  /** The nameplate, centred at (x, y) on the face. */
  title: { x: number; y: number; width: number; height: number };
  /** Half the usable width either side of centre, inside the rack ears. */
  halfWidth: number;
}

/**
 * Everything a maker painted on one rack module, as a single decal for the
 * branding layer: the livery, the nameplate with maker and title, a round
 * maker badge with its mark left of the nameplate, and a small plate naming
 * the maker's home town to the right of it.
 */
export function createModuleBranding(
  maker: string,
  title: string,
  finish: string,
  units: number,
  origin: string | undefined,
  layout: BrandingLayout,
) {
  const { face, title: plate, halfWidth } = layout;
  const width = 1024;
  const height = Math.round((width * face.height) / face.width);
  const { context, texture } = createCanvasTexture(width, height);
  const toX = (x: number) => ((x + face.width / 2) / face.width) * width;
  const toY = (y: number) => ((face.height / 2 - y) / face.height) * height;
  const brand = brands[maker] ?? brands['VOLT XOCCULA'];

  const livery = createPanelLivery(maker, finish, units);
  context.drawImage(livery.image as CanvasImageSource, 0, 0, width, height);
  livery.dispose();

  const left = toX(plate.x - plate.width / 2);
  const right = toX(plate.x + plate.width / 2);
  const top = toY(plate.y + plate.height / 2);
  const tall = toY(plate.y - plate.height / 2) - top;
  const header = createPanelHeader(maker, title);
  context.drawImage(
    header.image as CanvasImageSource,
    left,
    top,
    right - left,
    tall,
  );
  header.dispose();

  // The maker's badge: an enamel roundel carrying its mark.
  const middle = top + tall / 2;
  const badgeX = (toX(-halfWidth) + left) / 2;
  const radius = Math.min(tall * 0.62, (left - toX(-halfWidth)) * 0.42);
  context.fillStyle = '#1b2627';
  context.beginPath();
  context.arc(badgeX, middle, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = brand.primary;
  context.lineWidth = Math.max(2, radius * 0.12);
  context.stroke();
  context.save();
  context.translate(badgeX, middle);
  context.scale(radius / 46, radius / 46);
  drawBrandMark(context, brand, '#1b2627');
  context.restore();

  // Where it was made, on a small plate to the right of the nameplate.
  if (origin) {
    const plateLeft = right + (toX(halfWidth) - right) * 0.1;
    const plateWidth = (toX(halfWidth) - right) * 0.8;
    const plateHeight = tall * 0.62;
    context.fillStyle = '#1b2627';
    context.fillRect(
      plateLeft,
      middle - plateHeight / 2,
      plateWidth,
      plateHeight,
    );
    context.fillStyle = brand.secondary;
    context.fillRect(plateLeft, middle + plateHeight / 2 - 3, plateWidth, 3);
    context.fillStyle = '#e5d7aa';
    context.font = `700 ${Math.round(plateHeight * 0.5)}px "Arial Narrow", "Arial", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(
      origin.toUpperCase(),
      plateLeft + plateWidth / 2,
      middle,
      plateWidth * 0.9,
    );
  }
  texture.needsUpdate = true;
  return texture;
}
