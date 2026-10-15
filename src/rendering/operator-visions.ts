import { Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three';
import type { PerspectiveCamera, Texture, WebGLRenderer } from 'three';
import { createGhosting, defaultGhostingSettings } from '../game/ghosting';
import {
  createHallucinations,
  defaultHallucinationSettings,
} from '../game/hallucination';
import { createPatterns, defaultPatternSettings } from '../game/patterns';
import type { doseEffects } from '../game/exhaust';
import { createApparitionImage } from './apparition-image';
import { createGhostOverlay } from './ghost-overlay';
import { createPatternOverlay } from './pattern-overlay';

export type VisionLevels = ReturnType<typeof doseEffects>;

/**
 * What the column's exhaust makes an operator see (src/game/exhaust.ts),
 * drawn in the game: the dev4 effects, turned up by the dose rather than
 * by a console. Ghosting leaves echoes of still moments; apparitions wait
 * at the edge of sight; geometric patterns are worked into the room.
 *
 * `render` draws a frame in the order that keeps them apart: the room,
 * the patterns worked into it, the apparitions over it, the ghosts over
 * all. Ghosting's snapshot is taken before the patterns go in, so an echo
 * never carries them; on the frame a snapshot is due with patterns
 * showing, the room is drawn twice.
 */
export function createOperatorVisions(
  renderer: WebGLRenderer,
  { metre, floorY }: { metre: number; floorY: number },
) {
  const ghosting = createGhosting({
    ...defaultGhostingSettings(),
    blur: 0.03,
    drift: 0.03,
  });
  const echoes = createGhostOverlay(renderer);
  const hallucinations = createHallucinations({
    ...defaultHallucinationSettings(),
    perMinute: 0,
  });
  const patterns = createPatterns({
    ...defaultPatternSettings(),
    speed: 0.25,
    flow: 0.2,
  });
  const patternOverlay = createPatternOverlay(renderer, patterns);
  // The apparitions stand in a scene of their own, drawn over the room
  // after the patterns are worked in, so the patterns never touch them.
  const visions = new Scene();
  const image: Texture = createApparitionImage();
  const geometry = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const shown = new Map<number, Mesh<PlaneGeometry, MeshBasicMaterial>>();
  const apparitionHeight = hallucinations.settings.size;

  const placeApparitions = (yaw: number) => {
    const alive = new Set<number>();
    const source = image.image as { width: number; height: number };
    const aspect = source.width / source.height;
    for (const apparition of hallucinations.apparitions) {
      alive.add(apparition.id);
      let mesh = shown.get(apparition.id);
      if (!mesh) {
        mesh = new Mesh(
          geometry,
          new MeshBasicMaterial({
            map: image,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        mesh.name = `Apparition ${apparition.id}`;
        shown.set(apparition.id, mesh);
        visions.add(mesh);
      }
      const height = apparitionHeight * metre;
      mesh.scale.set(height * aspect, height, 1);
      mesh.position.set(apparition.x * metre, floorY, apparition.z * metre);
      // Square to the camera: its face turned back along the line of sight.
      mesh.rotation.y = -yaw;
      mesh.material.opacity = Math.max(0, apparition.opacity);
    }
    for (const [id, mesh] of shown)
      if (!alive.has(id)) {
        visions.remove(mesh);
        mesh.material.dispose();
        shown.delete(id);
      }
  };

  let take: number | null = null;
  return {
    ghosting,
    hallucinations,
    patterns,
    /**
     * Advance `seconds` with the camera where it is and the dose's
     * `levels`. `fits` says where, in metres, a figure could stand.
     */
    update(
      seconds: number,
      camera: PerspectiveCamera,
      levels: VisionLevels,
      fits: (x: number, z: number) => boolean,
    ) {
      ghosting.settings.strength = 0.6 * levels.ghosting;
      hallucinations.settings.perMinute = 8 * levels.apparitions;
      patterns.settings.strength = 0.6 * levels.patterns;
      patterns.settings.cover = 0.15 + 0.3 * levels.patterns;
      patterns.step(seconds);
      const e = camera.matrixWorld.elements;
      // The camera looks down its -z axis.
      const fx = -e[8];
      const fy = -e[9];
      const fz = -e[10];
      const yaw = Math.atan2(fx, -fz);
      const pitch = Math.asin(Math.max(-1, Math.min(1, fy)));
      const x = e[12] / metre;
      const z = e[14] / metre;
      take = ghosting.step(seconds, { x, z, yaw, pitch }).take;
      if (levels.apparitions > 0 || hallucinations.apparitions.length)
        hallucinations.step(
          seconds,
          {
            x,
            z,
            yaw,
            halfWidth: Math.atan(
              Math.tan(((camera.fov / 2) * Math.PI) / 180) * camera.aspect,
            ),
          },
          Math.random,
          fits,
        );
      placeApparitions(yaw);
    },
    /** Draw the frame: `drawRoom` draws the room as it would be drawn. */
    render(drawRoom: () => void, camera: PerspectiveCamera) {
      const drawVisions = () => {
        if (!shown.size) return;
        const autoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(visions, camera);
        renderer.autoClear = autoClear;
      };
      if (take !== null) {
        drawRoom();
        drawVisions();
        echoes.take(take);
      }
      if (take === null || patterns.showing) {
        drawRoom();
        patternOverlay.draw();
        drawVisions();
      }
      echoes.draw(ghosting.ghosts);
      echoes.keep(ghosting.inUse());
    },
    /** Let everything go at once: echoes, figures and patterns. */
    clear() {
      ghosting.clear();
      hallucinations.clear();
      placeApparitions(0);
    },
    dispose() {
      echoes.dispose();
      patternOverlay.dispose();
      for (const mesh of shown.values()) mesh.material.dispose();
      geometry.dispose();
      image.dispose();
    },
  };
}
