import { effect } from '@preact/signals-core';
import type { Object3D } from 'three';
import type { PartEvent, PartListener } from '../game/world/components';

/** A component as far as its sounds go. */
export interface SoundingPart {
  onEvent(listener: PartListener): unknown;
  held: { readonly value: string | null };
  dispose(): void;
}

export type TransitionListener = (
  event: PartEvent,
  sound: string | null | undefined,
  part: string,
  from: Object3D,
) => void;

export type HeldListener = (sound: string | null, from: Object3D) => void;

/**
 * Collects the sounds of a panel's components for the room to play: their
 * transition sounds, and the state sounds they hold. Each component is
 * registered with its view, so the room knows where the sound comes from,
 * and the kind of part, so the room can choose its usual sound when the
 * component names none.
 */
export function createPartSoundHub() {
  const transitions = new Set<TransitionListener>();
  const holding = new Set<HeldListener>();
  const holders: [SoundingPart['held'], Object3D][] = [];
  const disposers: (() => void)[] = [];
  return {
    /**
     * Register a component and its view. The view's own sound tag is
     * removed: the component makes the sound now. `also` hears each
     * transition first, for the view to show it (a cap dipping, say).
     */
    add(
      component: SoundingPart,
      view: Object3D,
      part: string,
      also?: (event: PartEvent) => void,
    ) {
      delete view.userData.sound;
      // Still say what kind of part it is, for logs and tooltips.
      view.userData.partKind = part;
      component.onEvent((event, sound) => {
        also?.(event);
        for (const listener of transitions) listener(event, sound, part, view);
      });
      holders.push([component.held, view]);
      const stop = effect(() => {
        const sound = component.held.value;
        for (const listener of holding) listener(sound, view);
      });
      disposers.push(() => {
        stop();
        component.dispose();
      });
    },
    /** Hear every transition sound: what happened, the part's own sound for it (if any), the kind of part, and where. */
    onSound(listener: TransitionListener) {
      transitions.add(listener);
      return () => transitions.delete(listener);
    },
    /** Hear every state sound: each part's now, and again when it changes. */
    onHeld(listener: HeldListener) {
      for (const [held, view] of holders) listener(held.value, view);
      holding.add(listener);
      return () => holding.delete(listener);
    },
    dispose() {
      for (const done of disposers) done();
      transitions.clear();
      holding.clear();
    },
  };
}

export type PartSoundHub = ReturnType<typeof createPartSoundHub>;
