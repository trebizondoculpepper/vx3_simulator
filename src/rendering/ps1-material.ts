import { MeshBasicMaterial, MeshStandardMaterial, Vector2 } from 'three';
import type { MeshStandardMaterialParameters } from 'three';

// Quantize projected coordinates, preserving clip-space depth and the original w.
// Shared uniforms let resizing and reduced motion update every scene material.
export const ps1Uniforms = {
  resolution: { value: new Vector2(640, 480) },
  snapPixels: { value: 1.0 },
  snapStrength: { value: 0.35 },
  /** How much of the lab's own lighting is on, from 0 (dark) to 1. */
  roomLight: { value: 1.0 },
};

/**
 * A PS1-styled material. Lit materials respond to the scene's lights. Unlit
 * ones are printed surfaces (labels, posters, dials) that dim with the
 * room's lighting, unless `glow` marks them as giving off their own light:
 * screens, nixie tubes, illuminated signs and the like.
 */
export function createPs1Material(
  options: MeshStandardMaterialParameters,
  unlit = false,
  glow = false,
) {
  const material = unlit
    ? new MeshBasicMaterial(options)
    : new MeshStandardMaterial({
        ...options,
        flatShading: true,
        roughness: 1,
      });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ps1Resolution = ps1Uniforms.resolution;
    shader.uniforms.ps1SnapPixels = ps1Uniforms.snapPixels;
    shader.uniforms.ps1SnapStrength = ps1Uniforms.snapStrength;
    shader.uniforms.ps1RoomLight = ps1Uniforms.roomLight;
    shader.uniforms.ps1Dims = { value: unlit && !glow ? 1 : 0 };
    shader.vertexShader = `uniform vec2 ps1Resolution;
      uniform float ps1SnapPixels;
      uniform float ps1SnapStrength;
      ${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      if (ps1SnapPixels > 0.0 && gl_Position.w > 0.0) {
        vec2 screen = (gl_Position.xy / gl_Position.w * 0.5 + 0.5) * ps1Resolution;
        vec2 snapped = floor(screen / ps1SnapPixels + 0.5) * ps1SnapPixels;
        screen = mix(screen, snapped, ps1SnapStrength);
        gl_Position.xy = (screen / ps1Resolution * 2.0 - 1.0) * gl_Position.w;
      }`,
    );
    // A restrained 2x2 ordered pattern, quantized in display colour space.
    shader.fragmentShader = `uniform float ps1RoomLight;
      uniform float ps1Dims;
      ${shader.fragmentShader}`.replace(
      '#include <dithering_fragment>',
      `gl_FragColor.rgb *= mix(1.0, ps1RoomLight, ps1Dims);
      float px = mod(floor(gl_FragCoord.x), 2.0);
      float py = mod(floor(gl_FragCoord.y), 2.0);
      float threshold = (px == 0.0 ? (py == 0.0 ? 0.0 : 3.0) : (py == 0.0 ? 2.0 : 1.0));
      gl_FragColor.rgb = floor(clamp(gl_FragColor.rgb, 0.0, 1.0) * 31.0 + (threshold + 0.5) / 4.0) / 31.0;`,
    );
  };
  material.customProgramCacheKey = () => 'ps1-snap-dither-v3';
  return material;
}
