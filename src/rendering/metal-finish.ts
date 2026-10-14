import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
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
