import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture } from 'three';
import { createRoomTextures, textureBytes } from './room-textures';

const textured = (texture: Texture) =>
  new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ map: texture }));
const texture = (size = 64) => {
  const t = new Texture({ width: size, height: size } as never);
  return Object.assign(t, { dispose: vi.fn() });
};

describe('room textures', () => {
  const lab = new Group();
  const museum = new Group();
  const labOnly = texture();
  const museumOnly = texture();
  const both = texture();
  lab.add(textured(labOnly), textured(both));
  museum.add(textured(museumOnly), textured(both));
  const rooms = createRoomTextures(
    { lab: [lab], museum: [museum] },
    { grace: 4 },
  );

  it('frees a room’s textures only after it has been out of sight a while', () => {
    rooms.update({ lab: true, museum: false }, 0);
    rooms.update({ lab: true, museum: false }, 3);
    expect(museumOnly.dispose).not.toHaveBeenCalled();
    rooms.update({ lab: true, museum: false }, 4.5);
    expect(museumOnly.dispose).toHaveBeenCalledTimes(1);
    // Freed once, not every frame.
    rooms.update({ lab: true, museum: false }, 5);
    expect(museumOnly.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps a texture that a room in sight still uses', () => {
    expect(both.dispose).not.toHaveBeenCalled();
    expect(labOnly.dispose).not.toHaveBeenCalled();
  });

  it('counts a freed texture back in when its room is seen again', () => {
    expect(rooms.report().resident).toBe(
      rooms.report().total - textureBytes(museumOnly),
    );
    rooms.update({ lab: false, museum: true }, 6);
    expect(rooms.report().resident).toBe(rooms.report().total);
    rooms.update({ lab: false, museum: true }, 11);
    expect(labOnly.dispose).toHaveBeenCalledTimes(1);
    expect(both.dispose).not.toHaveBeenCalled();
  });
});
