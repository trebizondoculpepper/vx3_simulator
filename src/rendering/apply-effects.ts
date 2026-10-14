import { Mesh } from 'three';
import type { Material, Object3D } from 'three';
import { ps1Uniforms } from './ps1-material';
import type { effectFrame } from '../game/effect-settings';

/** The effects' values at one moment (see `effectFrame`). */
export type EffectFrame = ReturnType<typeof effectFrame>;

/**
 * Put an effect frame on the shaders every material shares: the colour
 * phaser, the warp and where it is centred, lost precision and π.
 * `metre` is scene units per metre, since the settings are in metres.
 */
export function applyEffectFrame(
  frame: EffectFrame,
  metre: number,
  seconds: number,
) {
  ps1Uniforms.time.value = seconds;
  ps1Uniforms.channels.value.set(...frame.channels);
  ps1Uniforms.warp.value = frame.warp;
  ps1Uniforms.warpTwist.value.set(...frame.twist);
  ps1Uniforms.warpSwell.value.set(...frame.swell);
  const [cx, cz, reach] = frame.field;
  ps1Uniforms.warpField.value.set(cx * metre, 0, cz * metre, reach * metre);
  const [grid, tremble, flicker] = frame.precision;
  ps1Uniforms.precision.value.set(grid * metre, tremble, flicker);
  ps1Uniforms.pi.value = frame.pi;
}

/** A frame with nothing moving, for players who ask for reduced motion. */
export function stillFrame(frame: EffectFrame): EffectFrame {
  return {
    ...frame,
    channels: [1, 1, 1],
    warp: 0,
    divergence: {
      ...frame.divergence,
      horizontalPx: 0,
      verticalPx: 0,
      parallax: 0,
    },
    precision: [0, 0, 0],
  };
}

/** Put the shaders back as they are with no effects. */
export function clearEffects() {
  ps1Uniforms.channels.value.set(1, 1, 1);
  ps1Uniforms.warp.value = 0;
  ps1Uniforms.warpField.value.set(0, 0, 0, 0);
  ps1Uniforms.precision.value.set(0, 0, 0);
  ps1Uniforms.pi.value = Math.PI;
}

/**
 * Keep everything under `root` whole whatever the effects do: a tool that
 * has to stay readable and workable with space falling apart round it.
 */
export function exemptFromEffects(
  root: Object3D,
  effects = ['ps1Precision', 'ps1Warp', 'ps1Pi'],
) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const item of [object.material].flat() as Material[])
      for (const effect of effects) {
        const share = item.userData[effect] as { value: number } | undefined;
        if (share) share.value = 0;
      }
  });
}
