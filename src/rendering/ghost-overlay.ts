import {
  FramebufferTexture,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type { Texture, WebGLRenderer } from 'three';
import type { Ghost } from '../game/ghosting';

/** Taps either side of the centre in each blur pass. */
const TAPS = 8;

const passVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

/**
 * Draws perceptual ghosting's echoes (src/game/ghosting.ts) over the view.
 *
 * `take` copies the frame just drawn into a texture, a snapshot; `draw`
 * lays the showing ghosts over the screen, oldest first, each fixed to the
 * screen where it was taken, swelling from the middle and blurring as it
 * ages. A blurred ghost is first spread by a Gaussian, across then down,
 * into a half-size target (a blur has no fine detail to lose), and that is
 * what is laid over the screen.
 *
 * The copied pixels are already as the screen shows them, so the ghosts
 * are drawn by plain shaders that pass them through unchanged: a standard
 * material would encode their colour a second time.
 */
export function createGhostOverlay(renderer: WebGLRenderer) {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);
  const snapshots = new Map<number, FramebufferTexture>();
  const size = new Vector2();

  // One pass of a separable Gaussian, along `step` (a texel offset); the
  // taps reach three spreads either side.
  const blurMaterial = new ShaderMaterial({
    uniforms: {
      map: { value: null },
      step: { value: new Vector2() },
    },
    vertexShader: passVertex,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec2 step;
      varying vec2 vUv;
      void main() {
        vec3 sum = texture2D(map, vUv).rgb;
        float total = 1.0;
        for (int i = 1; i <= ${TAPS}; i++) {
          float x = float(i) * 3.0 / float(${TAPS});
          float w = exp(-0.5 * x * x);
          sum += w * (texture2D(map, vUv + step * float(i)).rgb +
                      texture2D(map, vUv - step * float(i)).rgb);
          total += 2.0 * w;
        }
        gl_FragColor = vec4(sum / total, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const blurScene = new Scene();
  const blurQuad = new Mesh(geometry, blurMaterial);
  blurQuad.frustumCulled = false;
  blurScene.add(blurQuad);
  const target = () =>
    new WebGLRenderTarget(1, 1, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
    });
  const across = target();
  const down = target();

  const layMaterial = new ShaderMaterial({
    uniforms: {
      map: { value: null },
      opacity: { value: 0 },
      scale: { value: 1 },
    },
    vertexShader: passVertex,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float opacity;
      uniform float scale;
      varying vec2 vUv;
      void main() {
        // Swell from the middle: sample nearer the centre as it grows.
        vec2 uv = (vUv - 0.5) / scale + 0.5;
        gl_FragColor = vec4(texture2D(map, uv).rgb, opacity);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const layScene = new Scene();
  const layQuad = new Mesh(geometry, layMaterial);
  layQuad.frustumCulled = false;
  layScene.add(layQuad);

  /** Spread `source` by `spread` pixels of the screen; returns the result. */
  const blurred = (source: Texture, spread: number): Texture => {
    const w = Math.max(1, Math.round(size.x / 2));
    const h = Math.max(1, Math.round(size.y / 2));
    if (across.width !== w || across.height !== h) {
      across.setSize(w, h);
      down.setSize(w, h);
    }
    // The spread in half-size texels, shared out across the taps.
    const reach = spread / 2 / (TAPS / 3);
    blurMaterial.uniforms.map.value = source;
    blurMaterial.uniforms.step.value.set(reach / w, 0);
    renderer.setRenderTarget(across);
    renderer.render(blurScene, camera);
    blurMaterial.uniforms.map.value = across.texture;
    blurMaterial.uniforms.step.value.set(0, reach / h);
    renderer.setRenderTarget(down);
    renderer.render(blurScene, camera);
    return down.texture;
  };

  return {
    /** Copy the frame just drawn, as snapshot `id`. */
    take(id: number) {
      renderer.getDrawingBufferSize(size);
      const texture = new FramebufferTexture(size.x, size.y);
      renderer.copyFramebufferToTexture(texture);
      snapshots.get(id)?.dispose();
      snapshots.set(id, texture);
    },
    /** Lay the ghosts over what has been drawn. */
    draw(ghosts: readonly Ghost[]) {
      const showing = ghosts.filter(
        (ghost) => ghost.opacity > 0 && snapshots.has(ghost.snapshot),
      );
      if (!showing.length) return;
      renderer.getDrawingBufferSize(size);
      const screen = renderer.getRenderTarget();
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      for (const ghost of showing) {
        let map: Texture = snapshots.get(ghost.snapshot)!;
        // Under half a pixel of spread is not worth a pass.
        const spread = ghost.blur * size.y;
        if (spread > 0.5) {
          renderer.autoClear = true;
          map = blurred(map, spread);
          renderer.autoClear = false;
          renderer.setRenderTarget(screen);
        }
        layMaterial.uniforms.map.value = map;
        layMaterial.uniforms.opacity.value = ghost.opacity;
        layMaterial.uniforms.scale.value = ghost.scale;
        renderer.render(layScene, camera);
      }
      renderer.autoClear = autoClear;
    },
    /** Let go of every snapshot no longer needed. */
    keep(ids: Set<number>) {
      for (const [id, texture] of snapshots)
        if (!ids.has(id)) {
          texture.dispose();
          snapshots.delete(id);
        }
    },
    dispose() {
      for (const texture of snapshots.values()) texture.dispose();
      snapshots.clear();
      across.dispose();
      down.dispose();
      blurMaterial.dispose();
      layMaterial.dispose();
      geometry.dispose();
    },
  };
}
