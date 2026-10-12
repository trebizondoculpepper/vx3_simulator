import {
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { MeshStandardMaterialParameters } from 'three';

// Quantize projected coordinates, preserving clip-space depth and the original w.
// Shared uniforms let resizing and reduced motion update every scene material.
export const ps1Uniforms = {
  resolution: { value: new Vector2(640, 480) },
  snapPixels: { value: 1.0 },
  snapStrength: { value: 0.35 },
  /** How much of the lab's own lighting is on, from 0 (dark) to 1. */
  roomLight: { value: 1.0 },
  /** Red, green and blue multipliers; they breathe near running ferrocores. */
  channels: { value: new Vector3(1, 1, 1) },
  /** How far space is bent near running ferrocores, 0 (flat) to 1. */
  warp: { value: 0 },
  /** Seconds, for anything that moves with time. */
  time: { value: 0 },
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
    shader.uniforms.ps1Channels = ps1Uniforms.channels;
    shader.uniforms.ps1Warp = ps1Uniforms.warp;
    shader.uniforms.ps1Time = ps1Uniforms.time;
    shader.vertexShader = `uniform vec2 ps1Resolution;
      uniform float ps1SnapPixels;
      uniform float ps1SnapStrength;
      uniform float ps1Warp;
      uniform float ps1Time;
      ${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      // Non-Euclidean space: everything turns about the line of sight by an
      // amount that depends on its distance, so straight edges bow, and
      // distances swell and shrink as the room breathes.
      if (ps1Warp > 0.0) {
        vec4 bent = mvPosition;
        float r = length(bent.xyz);
        float twist = ps1Warp * 0.2 * sin(r * 0.33 - ps1Time * 0.6);
        float c = cos(twist);
        float s = sin(twist);
        bent.xy = mat2(c, s, -s, c) * bent.xy;
        bent.xyz *= 1.0 + ps1Warp * 0.07 * sin(r * 0.21 + ps1Time * 0.4);
        gl_Position = projectionMatrix * bent;
      }
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
      uniform vec3 ps1Channels;
      ${shader.fragmentShader}`.replace(
      '#include <dithering_fragment>',
      `gl_FragColor.rgb *= mix(1.0, ps1RoomLight, ps1Dims);
      gl_FragColor.rgb *= ps1Channels;
      float px = mod(floor(gl_FragCoord.x), 2.0);
      float py = mod(floor(gl_FragCoord.y), 2.0);
      float threshold = (px == 0.0 ? (py == 0.0 ? 0.0 : 3.0) : (py == 0.0 ? 2.0 : 1.0));
      gl_FragColor.rgb = floor(clamp(gl_FragColor.rgb, 0.0, 1.0) * 31.0 + (threshold + 0.5) / 4.0) / 31.0;`,
    );
  };
  material.customProgramCacheKey = () => 'ps1-snap-dither-v4';
  return material;
}
