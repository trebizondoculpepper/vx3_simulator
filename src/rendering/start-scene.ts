import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Material } from 'three';
import { createPs1Material, ps1Uniforms } from './ps1-material';
import { createLabelTexture } from '../scene/screens';

/**
 * Placeholder scene: an empty 19-inch cabinet with a single maker plate,
 * proving the PS1 renderer and build pipeline. The rack itself is still to
 * be built; see doc/resume/ for the design brief.
 */
export function startScene(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  const scene = new Scene();
  scene.background = new Color('#16130f');
  scene.add(new AmbientLight('#ffe8c8', 0.6));
  const lamp = new DirectionalLight('#ffd9a0', 1.5);
  lamp.position.set(-2, 4, 6);
  scene.add(lamp);

  const materials: Material[] = [];
  const box = (w: number, h: number, d: number, color: string) => {
    const material = createPs1Material({ color });
    materials.push(material);
    return new Mesh(new BoxGeometry(w, h, d), material);
  };

  // Cabinet: two posts and a back wall. 1U = 0.25 units.
  const back = box(5, 10, 0.1, '#0b0a08');
  back.position.z = -0.6;
  const leftPost = box(0.12, 10, 0.4, '#2e2b26');
  leftPost.position.x = -2.3;
  const rightPost = leftPost.clone();
  rightPost.position.x = 2.3;
  const plate = box(4.6, 0.25, 0.08, '#b08a3e');
  plate.position.y = 1;
  scene.add(back, leftPost, rightPost, plate);

  const label = createLabelTexture('VX3 · FULL SPEC · SERIAL 0417', {
    ink: '#2a2210',
    plate: '#b08a3e',
  });
  const labelMaterial = createPs1Material({ map: label.texture }, true);
  materials.push(labelMaterial);
  const labelMesh = new Mesh(
    new PlaneGeometry(label.width / 100, label.height / 100),
    labelMaterial,
  );
  labelMesh.position.set(0, 1, 0.05);
  scene.add(labelMesh);

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    // Keep the scene within a 640 × 480 pixel budget; CSS enlarges it without smoothing.
    const scale = Math.min(640 / width, 480 / height, 1);
    const renderWidth = Math.max(1, Math.round(width * scale));
    const renderHeight = Math.max(1, Math.round(height * scale));
    renderer.setSize(renderWidth, renderHeight, false);
    ps1Uniforms.resolution.value.set(renderWidth, renderHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  renderer.setAnimationLoop((time) => {
    const sway = reducedMotion.matches ? 0 : Math.sin(time / 4000) * 0.4;
    camera.position.set(sway, 1, 6);
    camera.lookAt(0, 1, 0);
    ps1Uniforms.snapPixels.value = reducedMotion.matches ? 0 : 1;
    renderer.render(scene, camera);
  });

  return () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const material of materials) material.dispose();
    label.texture.dispose();
    renderer.dispose();
  };
}
