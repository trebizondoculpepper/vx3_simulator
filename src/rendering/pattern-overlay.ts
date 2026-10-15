import {
  FramebufferTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
} from 'three';
import type { WebGLRenderer } from 'three';
import { PATTERN_MODES, patternMode } from '../game/patterns';
import type { Patterns } from '../game/patterns';

/**
 * Works the geometric hallucinations (src/game/patterns.ts) into the frame
 * just drawn.
 *
 * The frame is copied to a texture, and a pass over the whole screen draws
 * it back with the pattern worked in. The pattern is a lattice folded into
 * itself several times, turning and breathing as it evolves, laid out in
 * log-polar co-ordinates (so its cells keep their shape as they shrink
 * towards the middle, and flowing means falling inwards for ever) and
 * mirrored into the kaleidoscope's segments.
 *
 * XOR takes the pattern's light lines on black, so where the pattern is
 * dark the picture is left alone; AND and BURN take its complement, light
 * where the pattern is quiet, so those blends leave the picture alone
 * there too. The bytes are as the screen shows them, so the blends act on
 * them directly, as src/game/patterns.ts's blendChannel does.
 */
export function createPatternOverlay(
  renderer: WebGLRenderer,
  patterns: Patterns,
) {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);
  const size = new Vector2();
  let frame = new FramebufferTexture(1, 1);
  const material = new ShaderMaterial({
    uniforms: {
      frame: { value: frame },
      resolution: { value: new Vector2(1, 1) },
      strength: { value: 0 },
      mode: { value: 0 },
      folds: { value: 8 },
      scale: { value: 3 },
      evolved: { value: 0 },
      flowed: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D frame;
      uniform vec2 resolution;
      uniform float strength;
      uniform int mode;
      uniform float folds;
      uniform float scale;
      uniform float evolved;
      uniform float flowed;
      varying vec2 vUv;

      const float TAU = 6.2831853;

      vec3 palette(float t) {
        return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67)));
      }

      mat2 turn(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      // The pattern's light at this point of the screen, 0 to 1 a channel.
      vec3 pattern() {
        vec2 p = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0) * 2.0;
        float r = length(p);
        // The kaleidoscope: the angle folded into mirrored segments,
        // the whole slowly turning.
        float segment = TAU / max(1.0, floor(folds + 0.5));
        float a = mod(atan(p.y, p.x) + evolved * 0.25, segment);
        a = abs(a - segment * 0.5);
        // Log-polar: cells keep their shape as they shrink inwards, and
        // flowing carries them in towards the middle.
        float depth = log(max(r, 1e-4));
        vec2 z = vec2(depth + flowed, a) * scale;
        vec3 light = vec3(0.0);
        for (int i = 0; i < 5; i++) {
          float k = float(i);
          // Fold into a cell, turn and breathe: each fold nests a
          // smaller copy of the lattice in the last.
          z = abs(fract(z) - 0.5);
          z = turn(0.7 + k * 0.9 + sin(evolved * 0.8 + k) * 0.6) * z;
          z *= 1.35 + 0.25 * sin(evolved * 1.3 + k * 1.7);
          float edge = min(abs(z.x), abs(z.y));
          float ring = abs(length(z) - 0.32 - 0.08 * sin(evolved + k));
          float lines = exp(-edge * 40.0) + 0.7 * exp(-ring * 55.0);
          light += lines * palette(k * 0.21 + evolved * 0.15 - depth * 0.35);
        }
        // Too fine to see in the very middle: let it go to nothing there.
        return clamp(light, 0.0, 1.0) * smoothstep(0.04, 0.35, r);
      }

      void main() {
        vec3 base = texture2D(frame, vUv).rgb;
        vec3 light = pattern();
        vec3 worked;
        if (mode == 0) {
          uvec3 b = uvec3(base * 255.0 + 0.5);
          uvec3 o = uvec3(light * 255.0 + 0.5);
          worked = vec3(b ^ o) / 255.0;
        } else if (mode == 1) {
          uvec3 b = uvec3(base * 255.0 + 0.5);
          uvec3 o = uvec3((1.0 - light) * 255.0 + 0.5);
          worked = vec3(b & o) / 255.0;
        } else {
          vec3 o = 1.0 - light;
          worked = max(vec3(0.0), 1.0 - (1.0 - base) / max(o, vec3(1e-3)));
        }
        gl_FragColor = vec4(mix(base, worked, strength), 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new Scene();
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  scene.add(quad);
  return {
    /** Work the pattern into what has been drawn, if it is showing. */
    draw() {
      if (!patterns.showing) return;
      renderer.getDrawingBufferSize(size);
      if (frame.image.width !== size.x || frame.image.height !== size.y) {
        frame.dispose();
        frame = new FramebufferTexture(size.x, size.y);
        material.uniforms.frame.value = frame;
      }
      renderer.copyFramebufferToTexture(frame);
      const s = patterns.settings;
      const u = material.uniforms;
      u.resolution.value.copy(size);
      u.strength.value = Math.min(1, s.strength);
      u.mode.value = PATTERN_MODES.indexOf(patternMode(s));
      u.folds.value = s.folds;
      u.scale.value = s.scale;
      u.evolved.value = patterns.evolved;
      u.flowed.value = patterns.flowed;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
    },
    dispose() {
      frame.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}
