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
import {
  PATTERN_MODES,
  PATTERN_STYLES,
  patternMode,
  patternStyle,
} from '../game/patterns';
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
      style: { value: 1 },
      cover: { value: 0.5 },
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

      uniform int style;
      uniform float cover;

      const float TAU = 6.2831853;
      const float PI = 3.14159265;

      vec3 palette(float t) {
        return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67)));
      }

      mat2 turn(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Where this pixel is: the screen's height runs from -1 to 1.
      vec2 screen() {
        return (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0) * 2.0;
      }

      // The kaleidoscope: the angle folded into mirrored segments, the
      // whole slowly turning.
      vec2 mirrored(vec2 p) {
        float segment = TAU / max(1.0, floor(folds + 0.5));
        float a = mod(atan(p.y, p.x) + evolved * 0.25, segment);
        a = abs(a - segment * 0.5);
        return vec2(cos(a), sin(a)) * length(p);
      }

      // LINES: bright outlines of a lattice folded into itself, in
      // log-polar co-ordinates, so its cells keep their shape as they
      // shrink and flowing means falling inwards for ever.
      vec3 lines() {
        vec2 p = screen();
        float r = length(p);
        vec2 m = mirrored(p);
        float depth = log(max(r, 1e-4));
        vec2 z = vec2(depth + flowed, atan(m.y, m.x)) * scale;
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
          float glow = exp(-edge * 40.0) + 0.7 * exp(-ring * 55.0);
          light += glow * palette(k * 0.21 + evolved * 0.15 - depth * 0.35);
        }
        // Too fine to see in the very middle: let it go to nothing there.
        return clamp(light, 0.0, 1.0) * smoothstep(0.04, 0.35, r);
      }

      // The tilings. Each finds the tile this pixel is in and returns its
      // name (a number from 0 to 1) and how far the pixel is inside it;
      // a negative distance is no tile at all.

      // STARS: eight-pointed stars, each a square and a diamond laid
      // together, an octagon at its heart, the crosses between them cut
      // where the squares meet. The stars breathe, each in its own time.
      vec2 stars() {
        vec2 p = turn(evolved * 0.1) * mirrored(screen()) * scale;
        vec2 cell = floor(p);
        vec2 f = fract(p) - 0.5;
        float r = 0.36 + 0.07 * sin(evolved * 1.1 + hash(cell) * TAU);
        float square = max(abs(f.x), abs(f.y));
        float diamond = (abs(f.x) + abs(f.y)) * 0.7071;
        float star = min(square, diamond);
        float heart = max(square, diamond);
        float inner = r * 0.62;
        if (heart < inner) return vec2(hash(cell + 0.31), inner - heart);
        if (star < r)
          return vec2(hash(cell + 0.57), min(r - star, heart - inner));
        return vec2(hash(cell + 0.83), min(star - r, 0.5 - square));
      }

      // HYPERBOLIC: the Poincaré disc tiled by regular FOLDS-gons, three,
      // four or five to a corner, shrinking without end towards the rim.
      // A point is folded back into the middle polygon, reflection by
      // reflection; the folds it took name its tile. The disc turns and
      // swims through itself, so tiles stream in from the rim and back.
      vec2 hyperbolic() {
        float p = clamp(floor(folds + 0.5), 3.0, 12.0);
        float q = p == 3.0 ? 7.0 : (p == 4.0 ? 5.0 : 4.0);
        float a = PI / p;
        float b = PI / q;
        // The middle polygon's sides are circles square to the rim; the
        // nearest is t from the centre.
        float t = tanh(0.5 * acosh(cos(b) / sin(a)));
        float rho = (1.0 - t * t) / (2.0 * t);
        vec2 c = vec2((1.0 + t * t) / (2.0 * t), 0.0);
        vec2 z = screen() * 0.32 * scale;
        if (dot(z, z) >= 1.0) return vec2(0.0, -1.0);
        z = turn(evolved * 0.2) * z;
        // A Möbius move, (z - w) / (1 - conj(w) z), that keeps the disc.
        vec2 w = 0.45 * vec2(sin(flowed * 0.7), sin(flowed * 0.43));
        vec2 top = z - w;
        vec2 under = vec2(1.0 - (w.x * z.x + w.y * z.y),
                          -(w.x * z.y - w.y * z.x));
        z = vec2(top.x * under.x + top.y * under.y,
                 top.y * under.x - top.x * under.y) / dot(under, under);
        float name = 0.0;
        for (int i = 0; i < 60; i++) {
          float r = length(z);
          float angle = atan(z.y, z.x) + a;
          float sector = floor(angle / (2.0 * a));
          angle = abs(angle - sector * 2.0 * a - a);
          z = r * vec2(cos(angle), sin(angle));
          vec2 d = z - c;
          float dd = dot(d, d);
          if (dd >= rho * rho) break;
          z = c + d * (rho * rho / dd);
          name = fract(name * 3.7 + sector * 0.618 + 0.13);
        }
        return vec2(name, (length(z - c) - rho) * 4.0);
      }

      // QUASI: five sets of parallel lines, de Bruijn's pentagrid, cut the
      // plane into tiles of a few shapes that never repeat; which strips a
      // point lies in names its tile. The grids drift, so the tiling
      // rearranges itself as it flows.
      vec2 quasi() {
        vec2 p = turn(evolved * 0.08) * screen() * scale * 1.3;
        float edge = 1.0;
        float sum = 0.0;
        float name = 0.0;
        for (int j = 0; j < 5; j++) {
          float k = float(j);
          vec2 e = vec2(cos(k * TAU / 5.0), sin(k * TAU / 5.0));
          float s = dot(p, e) + 0.2 + 0.3 * sin(flowed * 0.5 + k * 1.3);
          float strip = floor(s);
          sum += strip;
          name = fract(name * 1.7 + strip * 0.137 + k * 0.071);
          edge = min(edge, min(fract(s), 1.0 - fract(s)));
        }
        // The strips' sum, modulo five, sorts the tiles into families.
        return vec2(fract(mod(sum, 5.0) * 0.2 + name * 0.15), edge);
      }

      // CELLS: a tiling of living cells, each grown round a point that
      // wanders; however they move, they fit.
      vec2 cells() {
        vec2 p = mirrored(screen()) * scale;
        vec2 g = floor(p);
        vec2 f = fract(p);
        float near = 9.0;
        float next = 9.0;
        vec2 owner = vec2(0.0);
        for (int y = -1; y <= 1; y++)
          for (int x = -1; x <= 1; x++) {
            vec2 o = vec2(float(x), float(y));
            vec2 h = vec2(hash(g + o), hash(g + o + 17.0));
            vec2 d = o + 0.5 + 0.38 * sin(evolved * 1.3 + TAU * h) - f;
            float dd = length(d);
            if (dd < near) {
              next = near;
              near = dd;
              owner = g + o;
            } else if (dd < next) next = dd;
          }
        return vec2(hash(owner + 0.5), 0.5 * (next - near));
      }

      // TUNNEL: the log-polar lattice of LINES, its squares cut into
      // triangles and filled, falling into the middle of the view.
      vec2 tunnel() {
        vec2 p = screen();
        float r = length(p);
        vec2 m = mirrored(p);
        vec2 z = vec2(log(max(r, 1e-4)) + flowed, atan(m.y, m.x)) * scale;
        vec2 cell = floor(z);
        vec2 f = fract(z);
        float upper = step(f.x, f.y);
        float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
        edge = min(edge, abs(f.x - f.y) * 0.7071);
        if (r < 0.05) return vec2(0.0, -1.0);
        return vec2(hash(cell + upper * 0.5), edge);
      }

      // The pattern's light at this point of the screen, 0 to 1 a channel.
      vec3 pattern() {
        if (style == 0) return lines();
        vec2 tile = style == 1 ? stars()
          : style == 2 ? hyperbolic()
          : style == 3 ? quasi()
          : style == 4 ? cells()
          : tunnel();
        if (tile.y < 0.0) return vec3(0.0);
        // The grout: a fine dark line between tiles, smoothed over a pixel.
        float soft = fwidth(tile.y) * 1.5 + 1e-4;
        float grout = smoothstep(0.025, 0.025 + soft, tile.y);
        // Waves pass through the tiling, each tile lit in its turn, for
        // COVER of the time; the others leave the picture alone.
        float wave = 0.5 + 0.5 * sin(evolved * 2.1 + tile.x * TAU * 3.0);
        float lit = smoothstep(1.0 - cover - 0.08, 1.0 - cover + 0.08, wave);
        vec3 colour = palette(tile.x * 0.8 + evolved * 0.12);
        // Flat, saturated colour: pull it away from grey.
        colour = clamp((colour - 0.5) * 1.6 + 0.5, 0.0, 1.0);
        return colour * lit * grout;
      }

      void main() {
        vec3 base = texture2D(frame, vUv).rgb;
        // Worked into the picture, not laid over it: the pattern is as
        // bright as what is under it, so a dark room stays dark and the
        // room always shows through.
        float luma = dot(base, vec3(0.299, 0.587, 0.114));
        vec3 light = pattern() * (0.15 + 0.85 * sqrt(luma));
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
      u.style.value = PATTERN_STYLES.indexOf(patternStyle(s));
      u.cover.value = s.cover;
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
