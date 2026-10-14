import {
  DepthTexture,
  NearestFilter,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderTarget,
} from 'three';
import type { Camera, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ps1Uniforms } from './ps1-material';

/**
 * Chromatic divergence: red, green and blue stop agreeing about where
 * things are. The scene is drawn once into a target with its depth, then
 * each channel is read back from its own place. Green stays true; red and
 * blue are pushed apart, in opposite directions:
 *
 * - sideways and up and down, each swinging to and fro at its own rate;
 * - by sideways parallax, so near things split further than far ones, as
 *   if each channel's eye stood a little to one side.
 */
export interface DivergenceFrame {
  /** The sideways split at full swing, pixels of the PS1 picture. */
  horizontalPx: number;
  /** The up-and-down split at full swing, pixels. */
  verticalPx: number;
  /** How often the sideways swing repeats, Hz; 0 holds it at full split. */
  horizontalHz: number;
  /** How often the up-and-down swing repeats, Hz. */
  verticalHz: number;
  /** Parallax, in pixels at one metre; it falls off with distance. */
  parallax: number;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D colour;
  uniform sampler2D depth;
  uniform vec2 resolution;
  uniform vec2 clip;
  uniform float metre;
  uniform float time;
  uniform vec4 split;
  uniform float parallax;
  varying vec2 vUv;

  float distanceAt(vec2 uv) {
    float z = texture2D(depth, uv).x * 2.0 - 1.0;
    return 2.0 * clip.x * clip.y / (clip.y + clip.x - z * (clip.y - clip.x));
  }

  // split: sideways and up-and-down pixels, then their rates in Hz.
  vec2 place(float side, float nearness) {
    vec2 swing = cos(time * split.zw * 6.2831853);
    vec2 pixels = side * (split.xy * swing + vec2(parallax * nearness, 0.0));
    return vUv + pixels / resolution;
  }

  void main() {
    float nearness = min(4.0, metre / max(distanceAt(vUv), 0.001));
    float r = texture2D(colour, place(1.0, nearness)).r;
    vec4 g = texture2D(colour, vUv);
    float b = texture2D(colour, place(-1.0, nearness)).b;
    // Tone mapped and encoded as any frame drawn straight to the screen is.
    gl_FragColor = vec4(r, g.g, b, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createChromaticDivergence(
  renderer: WebGLRenderer,
  worldUnitsPerMetre: number,
) {
  const target = new WebGLRenderTarget(1, 1, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthTexture: new DepthTexture(1, 1),
  });
  const material = new ShaderMaterial({
    uniforms: {
      colour: { value: target.texture },
      depth: { value: target.depthTexture },
      resolution: { value: new Vector2(1, 1) },
      clip: { value: new Vector2(0.1, 100) },
      metre: { value: worldUnitsPerMetre },
      time: { value: 0 },
      split: { value: new Vector4() },
      parallax: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(material);
  const size = new Vector2();

  return {
    /** Whether these settings disagree at all; if not, render as usual. */
    active(frame: DivergenceFrame) {
      return (
        frame.horizontalPx !== 0 ||
        frame.verticalPx !== 0 ||
        frame.parallax !== 0
      );
    },
    /** Draw the scene through the divergence, to the screen. */
    render(
      scene: Scene,
      camera: Camera,
      frame: DivergenceFrame,
      seconds: number,
    ) {
      renderer.getDrawingBufferSize(size);
      if (target.width !== size.x || target.height !== size.y)
        target.setSize(size.x, size.y);
      const u = material.uniforms;
      u.resolution.value.copy(size);
      const lens = camera as PerspectiveCamera;
      u.clip.value.set(lens.near, lens.far);
      u.time.value = seconds;
      u.split.value.set(
        frame.horizontalPx,
        frame.verticalPx,
        frame.horizontalHz,
        frame.verticalHz,
      );
      u.parallax.value = frame.parallax;
      ps1Uniforms.linearTarget.value = 1;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      ps1Uniforms.linearTarget.value = 0;
      quad.render(renderer);
    },
    dispose() {
      target.depthTexture?.dispose();
      target.dispose();
      material.dispose();
      quad.dispose();
    },
  };
}
