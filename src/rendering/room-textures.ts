import { Mesh, Texture } from 'three';
import type { Material, Object3D } from 'three';

/**
 * Keeps only the textures of rooms that can be seen on the GPU.
 *
 * Every room's textures are made when the scene is built, and three.js
 * uploads a texture the first time it is drawn and keeps it until it is
 * disposed. A room that is out of sight still holds all of its textures
 * in video memory, though nothing of it is drawn.
 *
 * This records which textures each room's meshes use. When every room
 * using a texture has been out of sight for `grace` seconds, the texture
 * is disposed: three.js frees its GPU copy but keeps the texture and its
 * image, and uploads it again, unchanged, the next time it is drawn. The
 * grace period stops a door swinging to and fro from churning uploads.
 * Textures used by nothing in a room (the sky, the environment, the
 * interface) are left alone, as are render targets, which hold drawn
 * frames rather than images.
 */
export function createRoomTextures<Room extends string>(
  rooms: Record<Room, readonly Object3D[]>,
  { grace = 4 } = {},
) {
  /** Each texture, and the rooms whose meshes use it. */
  const users = new Map<Texture, Set<Room>>();
  for (const [room, roots] of Object.entries(rooms) as [
    Room,
    readonly Object3D[],
  ][])
    for (const root of roots)
      for (const texture of texturesUnder(root)) {
        const set = users.get(texture) ?? new Set<Room>();
        set.add(room);
        users.set(texture, set);
      }
  /** When each room was last in sight, on the caller's clock (seconds). */
  const seen = new Map<Room, number>();
  let clock = 0;
  const unloaded = new Set<Texture>();
  return {
    /**
     * After the frame's visibility is decided, with the time in seconds
     * (real time, not game time): free the textures nobody has seen for
     * the grace period.
     */
    update(shown: Record<Room, boolean>, seconds: number) {
      clock = seconds;
      for (const room of Object.keys(rooms) as Room[])
        if (shown[room] || !seen.has(room)) seen.set(room, seconds);
      for (const [texture, rooms] of users) {
        const away = [...rooms].every(
          (room) => clock - seen.get(room)! >= grace,
        );
        if (away && !unloaded.has(texture)) {
          texture.dispose();
          unloaded.add(texture);
        } else if (!away) unloaded.delete(texture);
      }
    },
    /** Every texture a room uses, for development checks. */
    textures: () => [...users.keys()],
    /** What each room holds, and what is on the GPU now, in bytes. */
    report() {
      const byRoom = {} as Record<Room, number>;
      let resident = 0;
      let total = 0;
      for (const [texture, rooms] of users) {
        const bytes = textureBytes(texture);
        total += bytes;
        if (!unloaded.has(texture)) resident += bytes;
        for (const room of rooms) byRoom[room] = (byRoom[room] ?? 0) + bytes;
      }
      const largest = [...users.keys()]
        .sort((a, b) => textureBytes(b) - textureBytes(a))
        .slice(0, 25)
        .map((texture) => {
          const image = texture.image as { width: number; height: number };
          return `${(textureBytes(texture) / 1048576).toFixed(1)} MB ${image.width}x${image.height} ${[...users.get(texture)!].join('+')} ${owners.get(texture)}`;
        });
      return {
        largest,
        byRoom,
        total,
        resident,
        textures: users.size,
        hidden: Object.fromEntries(
          [...seen].map(([room, at]) => [room, clock - at]),
        ),
      };
    },
  };
}

/** The first mesh found using each texture, named by it and its parents. */
const owners = new WeakMap<Texture, string>();
const ownerName = (object: Object3D | null) => {
  const names: string[] = [];
  for (let o = object; o && names.length < 3; o = o.parent)
    if (o.name) names.push(o.name);
  return names.join(' < ') || '(unnamed)';
};

/** Every texture the meshes under `root` use, in any slot or uniform. */
export function texturesUnder(root: Object3D): Set<Texture> {
  const found = new Set<Texture>();
  const take = (value: unknown) => {
    if (
      value instanceof Texture &&
      !(value as Texture & { isRenderTargetTexture?: boolean })
        .isRenderTargetTexture
    ) {
      found.add(value);
      if (!owners.has(value)) owners.set(value, ownerName(owner));
    }
  };
  let owner: Object3D | null = null;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    owner = object;
    for (const material of [object.material].flat() as Material[]) {
      for (const value of Object.values(material)) take(value);
      const uniforms = (
        material as Material & { uniforms?: Record<string, { value: unknown }> }
      ).uniforms;
      if (uniforms)
        for (const { value } of Object.values(uniforms)) take(value);
    }
  });
  return found;
}

/** A texture's size on the GPU: four bytes a texel, a third more for mips. */
export function textureBytes(texture: Texture): number {
  const image = texture.image as { width?: number; height?: number } | null;
  if (!image?.width || !image.height) return 0;
  const base = image.width * image.height * 4;
  return texture.generateMipmaps ? Math.round((base * 4) / 3) : base;
}
