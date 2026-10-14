import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from 'three';
import type { MeshStandardMaterial, Texture } from 'three';
import { realistic } from './render-style';

/**
 * Metal finishes for the realistic render style, drawn procedurally so the
 * game ships no image files for them.
 *
 * Brushed aluminium: fine streaks running one way, each a little lighter or
 * darker than its neighbours, with longer scratches here and there. The
 * streaks run along a texture's u, which goes round a cylinder, so a
 * turned and brushed vessel is streaked round its circumference. The same
 * pattern drives the colour and the roughness, so the highlight breaks up
 * along the grain as it does on real brushed metal.
 *
 * Worn paint: rough, matt enamel on sheet steel that has seen decades of
 * use, mottled and grimier towards the bottom, with scratches and chips
 * through to bare steel and shallow dents that catch the light.
 */

/** A small seeded generator, so the grain is the same on every visit. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZE = 512;

/** The grain, as brightness from 0 to 1 per pixel, seamless along u. */
function brushedGrain(seed: number) {
  const random = seeded(seed);
  const value = new Float32Array(SIZE * SIZE);
  // Each row has its own shade: the fine streaks.
  for (let y = 0; y < SIZE; y++) {
    const row = 0.5 + (random() - 0.5) * 0.5;
    for (let x = 0; x < SIZE; x++)
      value[y * SIZE + x] = row + (random() - 0.5) * 0.08;
  }
  // Longer scratches, lighter or darker, wrapping round the seam.
  for (let k = 0; k < 900; k++) {
    const y = Math.floor(random() * SIZE);
    const start = Math.floor(random() * SIZE);
    const length = 40 + Math.floor(random() * 300);
    const shade = (random() - 0.5) * 0.35;
    for (let i = 0; i < length; i++) {
      const fade = Math.sin((i / length) * Math.PI);
      value[y * SIZE + ((start + i) % SIZE)] += shade * fade;
    }
  }
  return value;
}

function grainTexture(
  grain: Float32Array,
  shade: (v: number) => number,
  colour: boolean,
) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(SIZE, SIZE);
  for (let i = 0; i < grain.length; i++) {
    const v = Math.round(Math.max(0, Math.min(1, shade(grain[i]))) * 255);
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  if (colour) texture.colorSpace = SRGBColorSpace;
  return texture;
}

let brushed: { map: Texture; roughnessMap: Texture } | null = null;

/** The shared brushed-aluminium textures, made once. */
function brushedTextures() {
  if (!brushed) {
    const grain = brushedGrain(7);
    brushed = {
      // A gentle variation in brightness: aluminium is mostly the same grey.
      map: grainTexture(grain, (v) => 0.82 + v * 0.18, true),
      // Rougher across the streaks' dark lines, smoother along the bright.
      roughnessMap: grainTexture(grain, (v) => 0.55 + (0.5 - v) * 0.6, false),
    };
  }
  return brushed;
}

/**
 * Give a material a brushed aluminium finish, in the realistic style only.
 * `repeat` sets how many times the grain goes round and up a part.
 */
export function brushedAluminium(
  material: MeshStandardMaterial,
  {
    colour = '#c9ccce',
    roughness = 0.5,
    repeat = [1, 1] as [number, number],
  } = {},
) {
  if (!realistic) return material;
  const { map, roughnessMap } = brushedTextures();
  const own = (texture: Texture) => {
    const copy = texture.clone();
    copy.repeat.set(...repeat);
    copy.needsUpdate = true;
    return copy;
  };
  material.color.set(colour);
  // Mostly metal, with a little diffuse so the room's lamps still show on
  // it; and reflecting its surroundings brightly, as polished metal does.
  material.metalness = 0.9;
  material.roughness = roughness;
  material.envMapIntensity = 2.6;
  material.map = repeat[0] === 1 && repeat[1] === 1 ? map : own(map);
  material.roughnessMap =
    repeat[0] === 1 && repeat[1] === 1 ? roughnessMap : own(roughnessMap);
  material.needsUpdate = true;
  return material;
}

// ---- Worn paint --------------------------------------------------------------

/** Smooth noise from a coarse grid of random values. */
function valueNoise(random: () => number, cells: number) {
  const grid = Array.from({ length: (cells + 1) * (cells + 1) }, () =>
    random(),
  );
  const at = (i: number, j: number) => grid[j * (cells + 1) + i];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    const x = Math.min(cells - 1e-6, Math.max(0, u * cells));
    const y = Math.min(cells - 1e-6, Math.max(0, v * cells));
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = smooth(x - i);
    const fy = smooth(y - j);
    const top = at(i, j) * (1 - fx) + at(i + 1, j) * fx;
    const bottom = at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

interface Wear {
  width: number;
  height: number;
  /** Shading of the paint, about 1; above 1 where it is rubbed thin. */
  shade: Float32Array;
  /** 1 where the paint is gone and bare steel shows. */
  bare: Float32Array;
  /** Height of the surface: dents and scratches are below 0. */
  relief: Float32Array;
}

/** Pixels across a face's texture; its height follows the face's shape. */
const WEAR_WIDTH = 384;

/**
 * One face's wear. Cabinets wear where they are handled and knocked: at
 * their exposed edges, and most at their corners. So the scratches, the
 * rubbed paint and the chips all gather within a few percent of the face's
 * edges, the scratches are small, and the open face has only a few stray
 * marks and the odd shallow dent. `aspect` is the face's height over its
 * width, so the wear sits on its real edges and is not stretched.
 */
function wear(seed: number, aspect: number): Wear {
  const random = seeded(seed);
  const width = WEAR_WIDTH;
  const height = Math.max(64, Math.round(WEAR_WIDTH * aspect));
  const n = width * height;
  const shade = new Float32Array(n);
  const bare = new Float32Array(n);
  const relief = new Float32Array(n);
  const blotches = valueNoise(random, 5);
  const fine = valueNoise(random, 40);
  const rub = valueNoise(random, 24);
  /** Pixels to the nearest edge. */
  const edgeDistance = (x: number, y: number) =>
    Math.min(x, width - 1 - x, y, height - 1 - y);
  /** Within a few percent of an edge, more at the corners. */
  const band = width * 0.05;
  const nearEdge = (x: number, y: number) => {
    const across = Math.min(x, width - 1 - x);
    const up = Math.min(y, height - 1 - y);
    return Math.exp(-across / band) + Math.exp(-up / band) * 0.8;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      const i = y * width + x;
      // Even fading in blotches and a fine orange-peel texture.
      let s = 0.92 + (blotches(u, v) - 0.5) * 0.12 + (fine(u, v) - 0.5) * 0.04;
      // Paint rubbed thin along the edges, unevenly.
      const worn = nearEdge(x, y) * rub(u, v);
      s += Math.max(0, worn - 0.35) * 0.35;
      shade[i] = s;
      // Rubbed through to the steel right at the edge, here and there.
      if (edgeDistance(x, y) < 3 && worn > 0.55) bare[i] = 1;
    }
  const at = (x: number, y: number) => {
    const cx = Math.round(x);
    const cy = Math.round(y);
    return cx < 0 || cy < 0 || cx >= width || cy >= height
      ? -1
      : cy * width + cx;
  };
  /** A place for wear: near the edges, mostly; anywhere, rarely. */
  const place = (stray: number) => {
    for (;;) {
      const x = random() * width;
      const y = random() * height;
      if (random() < stray || random() < Math.min(1, nearEdge(x, y)))
        return [x, y];
    }
  };
  // Small scratches: a few millimetres to a centimetre or two.
  const scratches = Math.round((width * height) / 1400);
  for (let k = 0; k < scratches; k++) {
    let [x, y] = place(0.04);
    const length = 3 + random() ** 2 * 18;
    let angle = random() * Math.PI * 2;
    const deep = random() < 0.4;
    for (let i = 0; i < length; i++) {
      angle += (random() - 0.5) * 0.15;
      x += Math.cos(angle);
      y += Math.sin(angle);
      const p = at(x, y);
      if (p < 0) break;
      relief[p] -= deep ? 0.3 : 0.12;
      if (deep) bare[p] = 1;
      else shade[p] += 0.06;
    }
  }
  // Chips at the corners and along the edges.
  const chips = Math.round((width + height) / 60);
  for (let k = 0; k < chips; k++) {
    const [cx, cy] = place(0);
    const r = 1 + random() * 3.5;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (Math.hypot(dx, dy) < r * (0.6 + random() * 0.5)) {
          const p = at(cx + dx, cy + dy);
          if (p < 0) continue;
          bare[p] = 1;
          relief[p] -= 0.15;
        }
  }
  // A few shallow dents, anywhere.
  const dents = 2 + Math.round(aspect * 2);
  for (let k = 0; k < dents; k++) {
    const cx = random() * width;
    const cy = random() * height;
    const r = 8 + random() * 22;
    const depth = 0.3 + random() * 0.4;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy) / r;
        const p = at(cx + dx, cy + dy);
        if (d < 1 && p >= 0) relief[p] -= depth * (1 - d * d) ** 2;
      }
  }
  return { width, height, shade, bare, relief };
}

function texture(
  w: number,
  h: number,
  draw: (data: Uint8ClampedArray, i: number) => void,
  colour: boolean,
) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    draw(image.data, i);
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const made = new CanvasTexture(canvas);
  made.anisotropy = 8;
  if (colour) made.colorSpace = SRGBColorSpace;
  return made;
}

const BARE_STEEL = new Color('#a9adae');
const wears = new Map<number, Wear>();
const wornSets = new Map<
  string,
  {
    map: Texture;
    roughnessMap: Texture;
    metalnessMap: Texture;
    normalMap: Texture;
  }
>();

/** The worn textures for a paint colour and face shape, made once each. */
function wornTextures(colour: string, aspect: number) {
  const key = `${colour}/${aspect}`;
  let set = wornSets.get(key);
  if (set) return set;
  let faceWear = wears.get(aspect);
  if (!faceWear) {
    faceWear = wear(11, aspect);
    wears.set(aspect, faceWear);
  }
  const { width, height, shade, bare, relief } = faceWear;
  const paint = new Color(colour);
  const mixed = new Color();
  // Textures hold display colour; mix in linear and convert, as three does.
  const put = (data: Uint8ClampedArray, i: number, linear: Color) => {
    const c = linear.convertLinearToSRGB();
    data[i * 4] = Math.round(Math.max(0, Math.min(1, c.r)) * 255);
    data[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, c.g)) * 255);
    data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, c.b)) * 255);
  };
  const grey = (data: Uint8ClampedArray, i: number, value: number) => {
    const g = Math.round(Math.max(0, Math.min(1, value)) * 255);
    data[i * 4] = g;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = g;
  };
  const r = (x: number, y: number) =>
    relief[
      Math.max(0, Math.min(height - 1, y)) * width +
        Math.max(0, Math.min(width - 1, x))
    ];
  set = {
    map: texture(
      width,
      height,
      (data, i) => {
        mixed.copy(paint).multiplyScalar(shade[i]);
        if (bare[i]) mixed.copy(BARE_STEEL);
        put(data, i, mixed);
      },
      true,
    ),
    // Matt paint, a little smoother where rubbed; bare steel smoother still.
    roughnessMap: texture(
      width,
      height,
      (data, i) =>
        grey(data, i, bare[i] ? 0.45 : 0.88 - Math.max(0, shade[i] - 0.95)),
      false,
    ),
    metalnessMap: texture(
      width,
      height,
      // Bare steel partly metallic: dull, scuffed steel shows its own grey
      // rather than only mirroring a dark room.
      (data, i) => grey(data, i, bare[i] ? 0.55 : 0),
      false,
    ),
    // Slopes of the relief, as a tangent-space normal map.
    normalMap: texture(
      width,
      height,
      (data, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        const strength = 3;
        const nx = -(r(x + 1, y) - r(x - 1, y)) * strength;
        // The canvas's rows run down, the texture's v up.
        const ny = (r(x, y + 1) - r(x, y - 1)) * strength;
        const length = Math.hypot(nx, ny, 1);
        data[i * 4] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
        data[i * 4 + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
        data[i * 4 + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      },
      false,
    ),
  };
  wornSets.set(key, set);
  return set;
}

/**
 * Give a material a worn, matt paint finish in `colour`, in the realistic
 * style only: rough enamel, rubbed thin and chipped to bare steel at its
 * edges and corners, with small scratches there and a few shallow dents.
 * `aspect` is the height over the width of the faces it is for (a tall
 * cabinet side is about 2.5), so the wear sits on their edges unstretched.
 */
export function wornPaint(
  material: MeshStandardMaterial,
  colour: string,
  { aspect = 1 } = {},
) {
  if (!realistic) return material;
  const set = wornTextures(colour, Math.round(aspect * 4) / 4);
  // The colour is in the map; the material only scales it.
  material.color.set('#ffffff');
  material.map = set.map;
  material.roughness = 1;
  material.roughnessMap = set.roughnessMap;
  material.metalness = 1;
  material.metalnessMap = set.metalnessMap;
  material.normalMap = set.normalMap;
  material.normalScale.set(1, 1);
  material.needsUpdate = true;
  return material;
}
