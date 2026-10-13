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
 * blue are pushed apart three ways:
 *
 * - radially, as if each wavelength saw through a different lens;
 * - by a fixed shift whose direction slowly turns, out of step per channel;
 * - by parallax, so near things split further than far ones, as if each
 *   channel's eye stood a little to one side.
 */
export interface DivergenceFrame {
  /** Radial disagreement: the fraction red and blue are scaled from centre. */
  radial: number;
  /** A shift, in pixels of the PS1 picture. */
  shift: number;
  /** Parallax, in pixels at one metre; it falls off with distance. */
  parallax: number;
  /** How fast the shift's direction turns, revolutions per second. */
  wobbleHz: number;
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
  varying vec2 vUv;

  float distanceAt(vec2 uv) {
    float z = texture2D(depth, uv).x * 2.0 - 1.0;
    return 2.0 * clip.x * clip.y / (clip.y + clip.x - z * (clip.y - clip.x));
  }

  vec2 place(float side, float phase, float nearness) {
    float turn = time * split.w * 6.2831853 + phase;
    vec2 direction = vec2(cos(turn), sin(turn));
    vec2 pixels = direction * side * (split.y + split.z * nearness);
    return 0.5 + (vUv - 0.5) * (1.0 + side * split.x) + pixels / resolution;
  }

  void main() {
    float nearness = min(4.0, metre / max(distanceAt(vUv), 0.001));
    float r = texture2D(colour, place(1.0, 0.0, nearness)).r;
    vec4 g = texture2D(colour, vUv);
    float b = texture2D(colour, place(-1.0, 2.1, nearness)).b;
    gl_FragColor = linearToOutputTexel(vec4(r, g.g, b, 1.0));
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
      return frame.radial !== 0 || frame.shift !== 0 || frame.parallax !== 0;
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
        frame.radial,
        frame.shift,
        frame.parallax,
        frame.wobbleHz,
      );
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
