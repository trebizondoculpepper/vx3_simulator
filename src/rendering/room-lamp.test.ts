import { BoxGeometry, Color, Mesh, ShaderLib, Vector3 } from 'three';
import type { WebGLRenderer } from 'three';
import { expect, it } from 'vitest';
import { createPs1Material } from './ps1-material';
import { createRoomLighting } from './room-lighting';

it('adds the rectifier light after the switched fill and confines it to the plant room', () => {
  const registry = createRoomLighting();
  const lamp = {
    position: { value: new Vector3(1, 2, 3) },
    color: { value: new Color('#83dfff') },
    range: { value: 6 },
    strength: { value: 5 },
  };
  const plant = registry.defineRoom('plant', { value: 0.03 }, lamp);
  const lab = registry.defineRoom('lab', { value: 1 });
  const material = createPs1Material({ color: '#ffffff' });
  const plantMesh = new Mesh(new BoxGeometry(), material);
  const labMesh = new Mesh(new BoxGeometry(), material);
  registry.registerMesh(plant, plantMesh);
  registry.registerMesh(lab, labMesh);
  const compile = (mesh: typeof plantMesh) => {
    const shader = {
      ...ShaderLib.standard,
      uniforms: {} as Record<string, { value: unknown }>,
    };
    mesh.material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      {} as WebGLRenderer,
    );
    return shader;
  };
  const plantShader = compile(plantMesh);
  expect(plantShader.uniforms.ps1Dims.value).toBe(0);
  expect(plantShader.uniforms.ps1LampStrength).toBe(lamp.strength);
  expect(plantShader.fragmentShader).toContain(
    '* ps1RoomLight + totalEmissiveRadiance + ps1LampLight',
  );
  lamp.strength.value = 0;
  expect(plantShader.uniforms.ps1LampStrength.value).toBe(0);
  const labShader = compile(labMesh);
  expect(labShader.uniforms.ps1LampStrength).toBeUndefined();
  expect(labShader.fragmentShader).not.toContain('ps1LampLight');
  registry.dispose();
});
