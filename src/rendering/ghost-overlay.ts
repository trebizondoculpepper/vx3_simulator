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
import type { Ghost } from '../game/ghosting';

/**
 * Draws perceptual ghosting's echoes (src/game/ghosting.ts) over the view.
 *
 * `take` copies the frame just drawn into a texture, a snapshot; `draw`
 * lays the showing ghosts over the screen, oldest first, each fixed to the
 * screen where it was taken, swelling from the middle as it ages.
 *
 * The copied pixels are already as the screen shows them, so the ghosts
 * are drawn by a plain shader that passes them through unchanged: a
 * standard material would encode their colour a second time.
 */
export function createGhostOverlay(renderer: WebGLRenderer) {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);
  const snapshots = new Map<number, FramebufferTexture>();
  const quads: Mesh<PlaneGeometry, ShaderMaterial>[] = [];
  const size = new Vector2();
  const quad = () => {
    const material = new ShaderMaterial({
      uniforms: {
        map: { value: null },
        opacity: { value: 0 },
        scale: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
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
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    quads.push(mesh);
    return mesh;
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
      let used = 0;
      for (const ghost of ghosts) {
        const texture = snapshots.get(ghost.snapshot);
        if (!texture || ghost.opacity <= 0) continue;
        const mesh = quads[used] ?? quad();
        mesh.visible = true;
        mesh.renderOrder = used;
        mesh.material.uniforms.map.value = texture;
        mesh.material.uniforms.opacity.value = ghost.opacity;
        mesh.material.uniforms.scale.value = ghost.scale;
        used += 1;
      }
      for (let i = used; i < quads.length; i++) quads[i].visible = false;
      if (!used) return;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, camera);
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
      for (const mesh of quads) mesh.material.dispose();
      geometry.dispose();
    },
  };
}
