import {
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import type { MeshStandardMaterialParameters, Object3D } from 'three';

// Quantize projected coordinates, preserving clip-space depth and the original w.
// Shared uniforms let resizing and reduced motion update every scene material.
export const ps1Uniforms = {
  resolution: { value: new Vector2(640, 480) },
  snapPixels: { value: 1.0 },
  snapStrength: { value: 0.35 },
  /** How much of the lab's own lighting is on, from 0 (dark) to 1. */
  roomLight: { value: 1.0 },
  /** The same for the plant room, which has its own switch. */
  plantLight: { value: 1.0 },
  /** Red, green and blue multipliers; they breathe near running ferrocores. */
  channels: { value: new Vector3(1, 1, 1) },
  /** How far space is bent near running ferrocores, 0 (flat) to 1. */
  warp: { value: 0 },
  /**
   * The warp's shape: the twist about the line of sight (angle, radians;
   * spatial frequency, per scene unit; speed, radians per second) and the
   * swell of distances (fraction; spatial frequency; speed).
   */
  warpTwist: { value: new Vector3(0.2, 0.33, 0.6) },
  warpSwell: { value: new Vector3(0.07, 0.21, 0.4) },
  /**
   * Where the warp is centred, in world units, and how far it reaches: at
   * that radius it has fallen to a third. A radius of 0 bends all of space
   * alike, as the lab does today.
   */
  warpField: { value: new Vector4(0, 0, 0, 0) },
  /**
   * Lost numerical precision: world positions snap to a grid this many
   * world units across (0 is off), then tremble by this fraction of a cell,
   * re-rolled this many times a second. Each material can scale the grid
   * through its own `userData.ps1Precision`, so some things hold together
   * while others disintegrate.
   */
  precision: { value: new Vector3(0, 0, 0) },
  /**
   * 1 while the scene is drawn into a render target for a later pass. Such
   * targets hold linear colour, so the dither quantises in an approximate
   * display encoding instead, and the picture looks the same.
   */
  linearTarget: { value: 0 },
  /** Seconds, for anything that moves with time. */
  time: { value: 0 },
};

/**
 * A PS1-styled material. Lit materials respond to the scene's lights. Unlit
 * ones are printed surfaces (labels, posters, dials) that dim with the
 * room's lighting, unless `glow` marks them as giving off their own light:
 * screens, nixie tubes, illuminated signs and the like.
 */
export function createPs1Material(
  options: MeshStandardMaterialParameters,
  unlit = false,
  glow = false,
) {
  const material = unlit
    ? new MeshBasicMaterial(options)
    : new MeshStandardMaterial({
        ...options,
        flatShading: true,
        roughness: 1,
      });
  // This material's share of lost precision and of the warp: 0 keeps it
  // whole and straight.
  material.userData.ps1Precision = { value: 1 };
  material.userData.ps1Warp = { value: 1 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ps1Resolution = ps1Uniforms.resolution;
    shader.uniforms.ps1SnapPixels = ps1Uniforms.snapPixels;
    shader.uniforms.ps1SnapStrength = ps1Uniforms.snapStrength;
    const room = material.userData.ps1Room as typeof ps1Uniforms.roomLight;
    shader.uniforms.ps1RoomLight = room ?? ps1Uniforms.roomLight;
    shader.uniforms.ps1Dims = { value: room || (unlit && !glow) ? 1 : 0 };
    shader.uniforms.ps1Channels = ps1Uniforms.channels;
    shader.uniforms.ps1Warp = ps1Uniforms.warp;
    shader.uniforms.ps1WarpTwist = ps1Uniforms.warpTwist;
    shader.uniforms.ps1WarpSwell = ps1Uniforms.warpSwell;
    shader.uniforms.ps1WarpField = ps1Uniforms.warpField;
    shader.uniforms.ps1Precision = ps1Uniforms.precision;
    shader.uniforms.ps1PrecisionScale = material.userData.ps1Precision as {
      value: number;
    };
    shader.uniforms.ps1WarpScale = material.userData.ps1Warp as {
      value: number;
    };
    shader.uniforms.ps1LinearTarget = ps1Uniforms.linearTarget;
    shader.uniforms.ps1Time = ps1Uniforms.time;
    shader.vertexShader = `uniform vec2 ps1Resolution;
      uniform float ps1SnapPixels;
      uniform float ps1SnapStrength;
      uniform float ps1Warp;
      uniform vec3 ps1WarpTwist;
      uniform vec3 ps1WarpSwell;
      uniform vec4 ps1WarpField;
      uniform vec3 ps1Precision;
      uniform float ps1PrecisionScale;
      uniform float ps1WarpScale;
      uniform float ps1Time;
      ${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      float ps1Grid = ps1Precision.x * ps1PrecisionScale;
      if (ps1Warp * ps1WarpScale > 0.0 || ps1Grid > 0.0) {
        vec4 world = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          world = batchingMatrix * world;
        #endif
        #ifdef USE_INSTANCING
          world = instanceMatrix * world;
        #endif
        world = modelMatrix * world;
        // Lost precision: the universe keeps positions to a coarse grid,
        // and the rounding error trembles.
        if (ps1Grid > 0.0) {
          vec3 cell = floor(world.xyz / ps1Grid + 0.5) * ps1Grid;
          float roll = floor(ps1Time * ps1Precision.z);
          vec3 noise = fract(sin(vec3(
            dot(cell, vec3(12.9898, 78.233, 37.719)) + roll,
            dot(cell, vec3(39.346, 11.135, 83.155)) + roll,
            dot(cell, vec3(73.156, 52.235, 9.151)) + roll)) * 43758.5453);
          world.xyz = cell + (noise - 0.5) * ps1Grid * ps1Precision.y;
        }
        vec4 bent = viewMatrix * world;
        // Non-Euclidean space: everything turns about the line of sight by
        // an amount that depends on its distance, so straight edges bow,
        // and distances swell and shrink as the room breathes. Centred on
        // a point, the bending fades with distance from it.
        float strength = ps1Warp * ps1WarpScale;
        if (ps1WarpField.w > 0.0) {
          float d = distance(world.xyz, ps1WarpField.xyz) / ps1WarpField.w;
          strength *= exp(-d * d);
        }
        if (strength > 0.0) {
          float r = length(bent.xyz);
          float twist = strength * ps1WarpTwist.x * sin(r * ps1WarpTwist.y - ps1Time * ps1WarpTwist.z);
          float c = cos(twist);
          float s = sin(twist);
          bent.xy = mat2(c, s, -s, c) * bent.xy;
          bent.xyz *= 1.0 + strength * ps1WarpSwell.x * sin(r * ps1WarpSwell.y + ps1Time * ps1WarpSwell.z);
        }
        gl_Position = projectionMatrix * bent;
      }
      if (ps1SnapPixels > 0.0 && gl_Position.w > 0.0) {
        vec2 screen = (gl_Position.xy / gl_Position.w * 0.5 + 0.5) * ps1Resolution;
        vec2 snapped = floor(screen / ps1SnapPixels + 0.5) * ps1SnapPixels;
        screen = mix(screen, snapped, ps1SnapStrength);
        gl_Position.xy = (screen / ps1Resolution * 2.0 - 1.0) * gl_Position.w;
      }`,
    );
    // A restrained 2x2 ordered pattern, quantized in display colour space.
    shader.fragmentShader = `uniform float ps1RoomLight;
      uniform float ps1Dims;
      uniform vec3 ps1Channels;
      uniform float ps1LinearTarget;
      ${shader.fragmentShader}`.replace(
      '#include <dithering_fragment>',
      `gl_FragColor.rgb *= mix(1.0, ps1RoomLight, ps1Dims);
      gl_FragColor.rgb *= ps1Channels;
      float px = mod(floor(gl_FragCoord.x), 2.0);
      float py = mod(floor(gl_FragCoord.y), 2.0);
      float threshold = (px == 0.0 ? (py == 0.0 ? 0.0 : 3.0) : (py == 0.0 ? 2.0 : 1.0));
      vec3 shown = clamp(gl_FragColor.rgb, 0.0, 1.0);
      if (ps1LinearTarget > 0.5) shown = pow(shown, vec3(1.0 / 2.2));
      shown = floor(shown * 31.0 + (threshold + 0.5) / 4.0) / 31.0;
      if (ps1LinearTarget > 0.5) shown = pow(shown, vec3(2.2));
      gl_FragColor.rgb = shown;`,
    );
  };
  material.customProgramCacheKey = () => 'ps1-snap-dither-v6';
  return material;
}

/**
 * Make every printed surface under `roots` (an unlit material with a
 * texture: signs, labels, dial faces) dim with `room` instead of the lab,
 * skipping meshes `outside` says belong to another space. Plain-coloured
 * glows such as lamps and arcs keep their own light. Call before the first
 * render, since the choice is made when the shader compiles.
 */
export function dimPrintedWith(
  roots: Object3D[],
  room: typeof ps1Uniforms.roomLight,
  outside: (mesh: Mesh) => boolean = () => false,
) {
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!(object instanceof Mesh) || outside(object)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials)
        if (material instanceof MeshBasicMaterial && material.map)
          material.userData.ps1Room = room;
    });
  }
}
