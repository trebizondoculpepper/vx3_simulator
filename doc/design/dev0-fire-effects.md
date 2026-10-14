# Dev0 fire effects

The developer room uses the realistic renderer at native canvas resolution. Its old PS1 resolution toggle is retired. The laboratory scene remains separate.

A candidate for visible flames is [@wolffo/three-fire](https://github.com/typeWolffo/THREE.Fire), an MIT licensed TypeScript effect with a vanilla Three.js `FireMesh`. It ray marches a textured volume, so it should give a better close view than a flat flame card. The author documents a default of 20 ray marching iterations and 3 noise octaves, with 10–15 iterations and 2 octaves as a cheaper setting. We should try one small flame at a cabinet vent, with a warm local light and existing smoke, and measure frame time in dev0 before adding the dependency. No flame package or asset has been added yet.

The failure sequence now builds dense sparks and arcs as overheating approaches ignition. Fire remains terminal. Eight seconds after ignition, the world enters `extinguished`: the supplies drop, burning stops, the visible gauges return to zero, and the smoke clears. Soot remains on the front panels until the world is replaced.
