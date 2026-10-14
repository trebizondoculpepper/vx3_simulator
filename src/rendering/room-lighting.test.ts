import { BoxGeometry, Mesh, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { createPs1Material } from './ps1-material';
import { createRoomLighting } from './room-lighting';

describe('room lighting declarations', () => {
  it('reports unowned and multiply owned meshes', () => {
    const scene = new Scene();
    const material = createPs1Material({ color: '#ffffff' });
    const a = new Mesh(new BoxGeometry(), material);
    const b = new Mesh(new BoxGeometry(), material);
    const c = new Mesh(new BoxGeometry(), material);
    scene.add(a, b, c);
    const registry = createRoomLighting();
    const lab = registry.defineRoom('lab', { value: 0.3 });
    const corridor = registry.defineRoom('corridor', { value: 1 });
    registry.registerMesh(lab, a);
    registry.registerMesh(corridor, b);
    registry.registerMesh(corridor, a);
    const report = registry.audit(scene);
    expect(report.unowned).toEqual([c]);
    expect(report.multiplyOwned).toEqual([a]);
    expect(a.material).not.toBe(b.material);
    expect(a.material.userData.ps1Room).toBe(lab.level);
    expect(b.material.userData.ps1Room).toBe(corridor.level);
    registry.dispose();
  });
});
