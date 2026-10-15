import {
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import type {
  MeshStandardMaterialParameters,
  MeshBasicMaterialParameters,
  Object3D,
} from 'three';
import { realistic } from './render-style';
import type { RoomLamp } from './room-lighting';

// Quantize projected coordinates, preserving clip-space depth and the original w.
// Shared uniforms let resizing and reduced motion update every scene material.
export const ps1Uniforms = {
  resolution: { value: new Vector2(640, 480) },
  snapPixels: { value: 1.0 },
  // The realistic render style draws vertices where they are.
  snapStrength: { value: realistic ? 0 : 0.35 },
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
  /**
   * The universe's π. Every round thing is built with it: each vertex is
   * set round its object's axis at an angle scaled by π / Math.PI, so with
   * a wrong π a ring will not close, or wraps over itself. Each material
   * scales it through `userData.ps1Pi` (0 holds it true) and names its
   * round axis, in its own space, in `userData.ps1PiAxis`.
   */
  pi: { value: Math.PI },
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
  // An unlit material takes no light, so it has no roughness or metalness.
  const basic: MeshBasicMaterialParameters = { ...options };
  delete (basic as MeshStandardMaterialParameters).roughness;
  delete (basic as MeshStandardMaterialParameters).metalness;
  const material = unlit
    ? new MeshBasicMaterial(basic)
    : new MeshStandardMaterial({
        ...options,
        // Realistic: smooth, with a sheen; metal polished. PS1: flat, matt.
        flatShading: !realistic,
        roughness: realistic
          ? (options.roughness ?? ((options.metalness ?? 0) > 0 ? 0.32 : 0.62))
          : 1,
      });
  // Printed and glowing surfaces keep their own colours exactly.
  if (realistic && unlit) material.toneMapped = false;
  // This material's share of lost precision and of the warp: 0 keeps it
  // whole and straight.
  material.userData.ps1Precision = { value: 1 };
  material.userData.ps1Warp = { value: 1 };
  material.userData.ps1Pi = { value: 1 };
  material.userData.ps1PiAxis = { value: new Vector3(0, 1, 0) };
  material.userData.ps1Glow = glow;
  material.onBeforeCompile = function (this: typeof material, shader) {
    shader.uniforms.ps1Resolution = ps1Uniforms.resolution;
    shader.uniforms.ps1SnapPixels = ps1Uniforms.snapPixels;
    shader.uniforms.ps1SnapStrength = ps1Uniforms.snapStrength;
    const room = this.userData.ps1Room as typeof ps1Uniforms.roomLight;
    shader.uniforms.ps1RoomLight = room ?? ps1Uniforms.roomLight;
    shader.uniforms.ps1Dims = {
      value: !this.userData.ps1Glow && (room || unlit) ? 1 : 0,
    };
    shader.uniforms.ps1Channels = ps1Uniforms.channels;
    shader.uniforms.ps1Warp = ps1Uniforms.warp;
    shader.uniforms.ps1WarpTwist = ps1Uniforms.warpTwist;
    shader.uniforms.ps1WarpSwell = ps1Uniforms.warpSwell;
    shader.uniforms.ps1WarpField = ps1Uniforms.warpField;
    shader.uniforms.ps1Precision = ps1Uniforms.precision;
    shader.uniforms.ps1PrecisionScale = this.userData.ps1Precision as {
      value: number;
    };
    shader.uniforms.ps1WarpScale = this.userData.ps1Warp as {
      value: number;
    };
    shader.uniforms.ps1Pi = ps1Uniforms.pi;
    shader.uniforms.ps1PiScale = this.userData.ps1Pi as { value: number };
    shader.uniforms.ps1PiAxis = this.userData.ps1PiAxis as {
      value: Vector3;
    };
    shader.uniforms.ps1LinearTarget = ps1Uniforms.linearTarget;
    shader.uniforms.ps1Dither = { value: realistic ? 0 : 1 };
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
      uniform float ps1Pi;
      uniform float ps1PiScale;
      uniform vec3 ps1PiAxis;
      ${shader.vertexShader}`
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      // A wrong π: angles round the object's axis are measured with it.
      float ps1Bend = mix(1.0, ps1Pi / 3.14159265, ps1PiScale);
      if (abs(ps1Bend - 1.0) > 1e-6) {
        vec3 ps1Axis = normalize(ps1PiAxis);
        vec3 ps1Across = normalize(cross(ps1Axis, abs(ps1Axis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 ps1Up = cross(ps1Axis, ps1Across);
        float ps1Along = dot(transformed, ps1Axis);
        vec2 ps1Plane = vec2(dot(transformed, ps1Across), dot(transformed, ps1Up));
        float ps1Around = atan(ps1Plane.y, ps1Plane.x) * ps1Bend;
        ps1Plane = vec2(cos(ps1Around), sin(ps1Around)) * length(ps1Plane);
        transformed = ps1Axis * ps1Along + ps1Across * ps1Plane.x + ps1Up * ps1Plane.y;
      }`,
      )
      .replace(
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
      uniform float ps1Dither;
      ${shader.fragmentShader}`.replace(
      '#include <dithering_fragment>',
      `gl_FragColor.rgb *= mix(1.0, ps1RoomLight, ps1Dims);
      gl_FragColor.rgb *= ps1Channels;
      if (ps1Dither > 0.5) {
        float px = mod(floor(gl_FragCoord.x), 2.0);
        float py = mod(floor(gl_FragCoord.y), 2.0);
        float threshold = (px == 0.0 ? (py == 0.0 ? 0.0 : 3.0) : (py == 0.0 ? 2.0 : 1.0));
        vec3 shown = clamp(gl_FragColor.rgb, 0.0, 1.0);
        if (ps1LinearTarget > 0.5) shown = pow(shown, vec3(1.0 / 2.2));
        shown = floor(shown * 31.0 + (threshold + 0.5) / 4.0) / 31.0;
        if (ps1LinearTarget > 0.5) shown = pow(shown, vec3(2.2));
        gl_FragColor.rgb = shown;
      }`,
    );
    if (this.userData.ps1LocalRoom && this instanceof MeshStandardMaterial) {
      const lamp = this.userData.ps1RoomLamp as RoomLamp | undefined;
      let lampLight = '';
      if (lamp) {
        shader.uniforms.ps1LampPosition = lamp.position;
        shader.uniforms.ps1LampColor = lamp.color;
        shader.uniforms.ps1LampRange = lamp.range;
        shader.uniforms.ps1LampStrength = lamp.strength;
        // Dim the switched fill before adding this independently powered lamp.
        // The final room multiplier must not extinguish either it or emission.
        shader.uniforms.ps1Dims.value = 0;
        shader.fragmentShader = `uniform vec3 ps1LampPosition;
          uniform vec3 ps1LampColor;
          uniform float ps1LampRange;
          uniform float ps1LampStrength;
          ${shader.fragmentShader}`;
        lampLight = `vec3 ps1ToLamp = (viewMatrix * vec4(ps1LampPosition, 1.0)).xyz + vViewPosition;
          float ps1LampDistance = length(ps1ToLamp);
          float ps1LampFalloff = pow(max(0.0, 1.0 - ps1LampDistance / ps1LampRange), 2.0);
          float ps1LampFace = 0.12 + 0.88 * max(0.0, dot(normal, ps1ToLamp / max(ps1LampDistance, 0.001)));
          vec3 ps1LampLight = diffuseColor.rgb * ps1LampColor * ps1LampStrength * ps1LampFalloff * ps1LampFace;`;
      }
      const fill = realistic
        ? 'reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular'
        : 'diffuseColor.rgb * (0.72 + 0.28 * max(0.0, dot(normal, normalize(vec3(0.4, 0.8, 0.5)))))';
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        // Only the room's own declared lamp can illuminate these surfaces;
        // a lamp across the masonry never enters this calculation.
        lamp
          ? `${lampLight}\nvec3 outgoingLight = (${fill}) * ps1RoomLight + totalEmissiveRadiance + ps1LampLight;`
          : `vec3 outgoingLight = ${fill} + totalEmissiveRadiance;`,
      );
    }
  };
  material.customProgramCacheKey = function (this: typeof material) {
    return `${this.userData.ps1LocalRoom ? `ps1-local-room-v2-${this.userData.ps1RoomLamp ? 'lamp' : 'fill'}` : 'ps1-snap-dither-v7'}-${realistic ? 'realistic' : 'ps1'}`;
  };
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
  /**
   * Dim the lit surfaces too. Lights in three.js reach every object the
   * camera sees, so a room lit separately would otherwise borrow the next
   * room's light; this keeps the whole room as dark as its own switch.
   */
  lit = false,
) {
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!(object instanceof Mesh) || outside(object)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials)
        if (
          (material instanceof MeshBasicMaterial && material.map) ||
          (lit && material instanceof MeshStandardMaterial)
        )
          material.userData.ps1Room = room;
    });
  }
}
