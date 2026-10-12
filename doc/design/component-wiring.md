# Component wiring, looks and sounds

A design pass over every device in `doc/lore/component-catalogue.json`: what each one takes in, what it puts out, what it looks like while it works and what it sounds like. The aim is a machine that is confusing, interlinked and perplexing: nothing is adjusted in isolation, instruments disturb what they read, and fixing one reading quietly ruins another a few panels away.

Every link listed here is in the catalogue. The ones marked *[added]* came from this design pass and were wired in on 2026-10-12 with modest starting weights (mostly ±0.08 to ±0.3), ready for tuning by playtesting; `src/game/rig-model.test.ts` checks that every device is tied to at least two others in each direction and that a fully switched-on rig settles instead of running away. "Raises" and "lowers" give the sign of the weight.

## How the machine hangs together

Before this pass the catalogue was mostly a funnel. Most devices feed the main bus controller, which took 15 inputs but drove only the chirality indicator. 10 devices drove nothing at all and 6 took no input from any other device; the geotransversion unit was connected to nothing. The largest feedback loop spanned 12 devices.

With the added links there are 155 device-to-device links instead of 78. Every device takes at least 2 inputs and drives at least 2 other devices, and all 43 devices sit in one large feedback tangle, so almost any change eventually comes back to where it started. The design rules behind the new links:

- **Instruments are not innocent.** The Fromitz probe, hyperfine detector, milliblatz meter and control panel display each disturb something: a reading changes a reading somewhere else, and the hyperfine detector's loudspeaker excites the resonance coil.
- **The bus answers back.** Main bus load sags the ballast variac and degrades the varistance-isolator; strain charges the delta hypersistor and shakes the rack; instability leaks onto the Helmholtz-Blatz coil supply.
- **Heat, cold and water travel.** The infrafractor housing warms the amplifier, oven, governor oil, damping lattice and antiacclimator. The condensate trap's drips wet the floor, which grounds the operator better.
- **Agreement across the rack.** `match` and `difference` links tie controls on distant panels together: the patch bay oscillator against the phase cell, the tau connector against the resonance coil, the antiacclimator's season against the geotransversion hemisphere, and the Encabulator's direction against the field's handedness.
- **Short loops for drama, long loops for confusion.** Some loops close within two devices (oblidisk and double-helix transistor; relief valve and Baltovsky chamber); others run through six or seven panels, so the cause of a drift is never the panel you are looking at.

Room-scale effects (lights dimming, the wall clock, the kWh meter, the Time Dilation crystal and the teleprinter) are mentioned in the looks and sounds where they fit, but they are outside the component model.

## Ferrocore

`ferrocore` · Neumann Dynamik Typ FK-6 Ferrocore Carrier · Field

**Panel controls:** CORE, SEAT DEPTH, O/C, WARM RAMP, EJECT, θ TRIM.

**Inputs from other devices:**

- Encabulator drive raises rotational speed.
- Oblidisk COUPLING control raises rotational speed.
- Tertiary ballast variac voltage raises rotational speed.
- Centrifugal governor flyweights limiting lowers rotational speed.
- Baltovsky chamber pressure lowers rotational speed.
- Ferrocore warming oven temperature must pass a threshold before rotational speed can move.
- Theta-constant instability rises as Ferrocore WARM RAMP control and Ferrocore warming oven temperature disagree.
- Nanocore Bose-Einstein radiator cooling capacity lowers depletion.

**Outputs to other devices:**

- Ferrocore depletion raises Baltovsky chamber glow.
- Holtzmann-constant resonance coil resonance rises when Holtzmann-constant resonance coil TUNE control agrees with Ferrocore rotational speed.
- Ferrocore interplanar capacitivity raises Hyperflux inductor flux.
- Ferrocore theta-constant instability raises Main bus controller field instability.
- Ferrocore rotational speed raises Main bus controller load.
- Ferrocore rotational speed raises Oblidisk platter speed.
- Ferrocore interplanar capacitivity must pass a threshold before Sizing relay engaged can move.

**Look:** Cream enamel 3U carrier. Six numbered brass sockets sit behind a hinged smoked-perspex door; each seated core is a dull grey ferrite cylinder with a red tamper band. A finned heat sink fills the right-hand end. The core behind the smoked door glows dull orange from the oven-warmed base upwards as it spins; at high wear its red tamper band darkens and the varistor edge-meter starts to hunt. Overclock makes the whole carrier visibly shiver, and the magic-eye closes to a slit when θ wanders.

**Sound:** A fine high whine that rises with rpm, like a dentist's drill heard through a wall, with a dry grit rasp mixed in as wear climbs. Cavitation adds irregular ticks, like gravel in a tumble dryer.

## Baltovsky chamber

`baltovsky-chamber` · Gorskiy БК-3 Baltovsky Chamber · Containment

**Panel controls:** DISSIPATION, PURGE, LAMP TEST, INTERLOCK, RANGE.

**Inputs from other devices:**

- Ferrocore depletion raises chamber glow.
- Hyperflux inductor flux raises chamber glow.
- Meta-stable flux plasma inducer density raises chamber pressure.
- Vacuum tube relief valve venting lowers chamber pressure.
- Fromitz probe INSERT control raises chamber glow (the inserted probe tip catches the light) *[added]*.

**Outputs to other devices:**

- Baltovsky chamber pressure lowers Bell-jar shroud vacuum.
- Baltovsky chamber pressure lowers Ferrocore rotational speed.
- Baltovsky chamber glow raises Hyperfine detector count rate.
- Baltovsky chamber pressure raises Main bus controller field instability.
- Baltovsky chamber pressure raises Vacuum tube relief valve venting.
- Baltovsky chamber pressure raises Condensate trap coil flow (chamber exhaust feeds the trap) *[added]*.

**Look:** Heavy olive-drab 4U chassis with Cyrillic stencilling and two big T-handles. An armoured-glass porthole shows the chamber, which glows faintly yellow and brighter when a core is failing. The porthole is the rig's mood ring: faint straw yellow at idle, buttery when the core works hard, and a hard sodium yellow that lights up the floor when a core is failing. Pressure makes the T-handles creep and the chart pen jitter.

**Sound:** A low, slow whoomph like a gas boiler lighting, repeating with pressure. Purge is a long rubber-lipped hiss, and high glow brings a thin singing tone that seems to come from the glass.

## Main bus controller

`main-bus-controller` · Volt Xoccula MBC-300 Main Bus Controller · Regulation

**Panel controls:** LOAD SHED, MODE, BUS RESET, MUTE, PRIORITY.

**Inputs from other devices:**

- Helmholtz-Blatz coil field raises delta.
- Holtzmann-constant resonance coil resonance raises delta.
- Hyperorbital Bohr/Schreiffer phase cell coherence raises delta.
- Sizing relay engaged raises delta.
- Improvised master control register word raises delta.
- Double-helix transistor helical gain raises delta.
- Field instability rises as Helmholtz-Blatz coil trim setting and Hyperflux inductor flux disagree.
- Baltovsky chamber pressure raises field instability.
- Micro-weave tachyon suppressor noise raises field instability.
- Cradling node cradle sway raises field instability.
- Ferrocore theta-constant instability raises field instability.
- Passive damping lattice damping lowers field instability.
- Antiacclimator antiacclimation bias lowers field instability.
- Helmholtz-Blatz coil field raises bus load.
- Ferrocore rotational speed raises bus load.
- 7-stage betaform amplifier gain raises bus load.
- Meta-stable flux plasma inducer density raises bus load.
- Geotransversion unit geotransversal alignment raises delta (an aligned rig scores better) *[added]*.
- Bell-jar shroud vacuum lowers field instability (a sealed jar steadies the coils) *[added]*.
- Delta hypersistor BLEED control lowers accumulated strain (bleeding the hypersistor relieves strain) *[added]*.

**Outputs to other devices:**

- Main bus controller field instability raises Chirality indicator ambient chirality.
- Main bus controller load lowers Tertiary ballast variac voltage (supply sag under load) *[added]*.
- Main bus controller delta raises Control panel display brightness (the status page lights up) *[added]*.
- Main bus controller accumulated strain raises Cradling node cradle sway (the whole rack shakes) *[added]*.
- Main bus controller accumulated strain raises Delta hypersistor charge (strain is banked in the hypersistor) *[added]*.
- Main bus controller field instability lowers Helmholtz-Blatz coil field (bus noise on the coil supply) *[added]*.
- Main bus controller load raises Plynost Modulation Rectifier output ripple (more load, more ripple) *[added]*.
- Main bus controller load lowers Varistance-isolator isolation (isolation breaks down under load) *[added]*.
- Main bus controller delta raises Improvised master control register word (the register records Delta) *[added]*.

**Look:** Volt Xoccula grey-and-amber 3U controller. A row of amber annunciator tiles runs across the top beside a big black load meter, and a screw-terminal strip shows through a slot in the faceplate. Amber tiles light in an order that only partly makes sense. The load needle swings with everything in the rack, and strain shows as a slow amber crawl across the tiles from left to right before the CRASH flag drops.

**Sound:** A 50 Hz transformer hum whose harmonics thicken with load. Strain adds a buzzing relay chatter; at crash it makes one loud clunk, then the hum sags a semitone before it recovers. The "acoustic radiation" failure mode is a faint high whistle that follows instability.

## Isolated-frame flux emitter

`isolated-frame-flux-emitter` · Synclex IFE-2 Isolated-Frame Emitter · Field

**Panel controls:** APERTURE, ARM, EMIT, FOCUS, FRAME.

**Inputs from other devices:**

- Helmholtz-Blatz coil field raises emitter output.
- Ion insulation plate shielding lowers emitter output.
- Plynost Modulation Rectifier output ripple lowers emitter output (deplanarisation) *[added]*.
- Hyperorbital Bohr/Schreiffer phase cell coherence raises emitter output (phase-locked emission) *[added]*.

**Outputs to other devices:**

- Isolated-frame flux emitter output raises Ion insulation plate leakage.
- Isolated-frame flux emitter output raises Meta-stable flux plasma inducer density.
- Isolated-frame flux emitter output raises Hyperflux inductor flux (emitted flux is collected) *[added]*.

**Look:** Pale lilac 2U drawer floating on ceramic stand-offs. A louvred emitter aperture sits behind a wire guard, with a sliding brass shutter. The brass shutter slides with the aperture slider. Behind the wire guard the louvres glow a faint lilac that pulses with output, and the whole drawer bobs very slightly on its ceramic stand-offs.

**Sound:** A soft breathy whoosh through the louvres, pitched by focus, with a clean sine on top when output is high. Arming it gives a sharp ceramic tink.

## 7-stage betaform amplifier

`betaform-amplifier` · Volt Xoccula BF-7 Seven-Stage Betaform · Signal

**Panel controls:** STAGES, DRIVE, STBY, POL, BIAS.

**Inputs from other devices:**

- Tertiary ballast variac voltage must pass a threshold before amplifier gain can move.
- Infrafractor housing temperature lowers amplifier gain (heat soak drifts the valves) *[added]*.
- Plynost Modulation Rectifier output ripple lowers amplifier gain (hum on the HT) *[added]*.
- Heterodyne patch bay beat frequency raises amplifier gain (patched into the amplifier input) *[added]*.

**Outputs to other devices:**

- 7-stage betaform amplifier gain raises Infrafractor housing temperature.
- 7-stage betaform amplifier gain raises Main bus controller load.
- 7-stage betaform amplifier gain raises Micro-weave tachyon suppressor noise.
- 7-stage betaform amplifier gain raises Milliblatz meter reading (pickup on the meter leads) *[added]*.

**Look:** Seven valves stand proud of a perforated cage on top of a dark-grey 3U chassis, each stage with its own tiny neon. A heavy output transformer sits at one end. Seven valve heaters glow one by one as the stage selector advances, each with its own neon. Clipping flashes the neons in a ripple, and the transformer end shimmers with heat haze.

**Sound:** Valve-warming tick-tick-tick on switch-on, then a warm hiss whose brightness follows gain. Clipping adds crunchy distortion to every other sound in the rack.

## Varistance-isolator

`varistance-isolator` · Wonshou Labs VI-150 Varistance-Isolator · Power

**Panel controls:** MAINS, ISOLATION, EARTH, PHASE, TEST.

**Inputs from other devices:**

- Electron pump flow lowers isolation.
- Main bus controller load lowers isolation (isolation breaks down under load) *[added]*.
- Grounded Faraday suit operator grounding raises isolation (a grounded operator completes the earth) *[added]*.
- Ion insulation plate leakage lowers isolation (leakage to earth) *[added]*.

**Outputs to other devices:**

- Varistance-isolator MAINS control must pass a threshold before Tertiary ballast variac voltage can move.
- Varistance-isolator isolation lowers Plynost Modulation Rectifier output ripple.

**Look:** Brick-red 2U with a huge Bakelite mains lever. A mica window shows the varistor stack, which glows a faint orange when loaded. The varistor stack behind the mica window warms from black to faint orange with load. When isolation drops it flickers, and the LIVE lamp breathes.

**Sound:** The Bakelite lever closes with a heavy clack and a fizz. After that comes a quiet ceramic sizzle that grows as isolation falls, with a crack, like a log on a fire, at each flare.

## Nanocore Bose-Einstein radiator

`nanocore-bose-einstein-radiator` · Synclex BE-9 Nanocore Radiator · Cooling

**Panel controls:** COOLANT, FAN, BLEED, MODE.

**Inputs from other devices:**

- Condensate trap coil flow raises cooling capacity.
- Ferrocore warming oven temperature lowers cooling capacity (the radiator is fighting the oven) *[added]*.
- Electron pump flow raises cooling capacity (it circulates the coolant too) *[added]*.

**Outputs to other devices:**

- Nanocore Bose-Einstein radiator cooling capacity lowers Ferrocore depletion.
- Nanocore Bose-Einstein radiator cooling capacity raises Hydromagnetic tau-induction connector coupling.
- Nanocore Bose-Einstein radiator cooling capacity lowers Infrafractor housing temperature.
- Nanocore Bose-Einstein radiator cooling capacity raises Condensate trap coil frost (shared refrigerant) *[added]*.

**Look:** Finned silver 3U heat exchanger with frost creeping along the fins. A round sight-glass shows pale blue condensate swirling when the coolant runs. Frost advances and retreats along the fins with cooling. In the sight-glass, the condensate swirls faster with flow and goes still and glassy when the radiator is starved.

**Sound:** A fan whose pitch follows the fan switch, and a refrigerant gurgle in the pipes. Frost cracking makes small tinkling pings.

## Fromitz probe

`fromitz-probe` · Bonk Industries Model 41 Fromitz Probe · Measurement

**Panel controls:** INSERT, RANGE, ZERO, HOLD.

**Inputs from other devices:**

- Meta-stable flux plasma inducer density raises fromitz reading.
- Ion insulation plate leakage raises fromitz reading.
- Grounded Faraday suit operator grounding lowers fromitz reading (an ungrounded operator holding the probe reads high) *[added]*.

**Outputs to other devices:**

- Fromitz probe INSERT control raises Baltovsky chamber glow (the inserted probe tip catches the light) *[added]*.
- Fromitz probe reading lowers Ion insulation plate shielding (probe current bleeds the plates) *[added]*.

**Look:** Chunky orange 2U case with the probe on a coiled cable clipped to the front. A big pointer meter has a mirrored scale for reading without parallax. The coiled cable stretches as the probe goes in. The mirrored-scale needle wobbles at the slightest leakage, and the chart pen writes in nervous little bursts.

**Sound:** A Geiger-like ratchet click whose rate follows the reading, softer than the hyperfine detector. Inserting the probe makes a squeaky metal-on-rubber scrape.

## Hyperfine detector

`hyperfine-detector` · Neumann Dynamik HD-22 Hyperfine Detector · Measurement

**Panel controls:** GATE s, THRESHOLD, COUNT, RESET, AUDIO.

**Inputs from other devices:**

- Baltovsky chamber glow raises hyperfine count rate.
- Ion insulation plate leakage raises hyperfine count rate.
- Chirality indicator ambient chirality raises hyperfine count rate.
- Control panel display brightness raises hyperfine count rate (false counts from the EHT) *[added]*.
- Heterodyne patch bay beat frequency raises hyperfine count rate (audio-frequency pickup) *[added]*.
- Micro-weave tachyon suppressor noise raises hyperfine count rate (tachyons count as events) *[added]*.

**Outputs to other devices:**

- Hyperfine detector AUDIO control raises Holtzmann-constant resonance coil resonance (its loudspeaker clicks excite the open coil) *[added]*.
- Hyperfine detector count rate raises Improvised master control register word (the register latches the counts) *[added]*.

**Look:** Cream-and-grey 2U with a domed detector window and a little loudspeaker grille. Five Nixie tubes count events above a slim rate meter. The nixies count up in bursts. The domed window flashes on each event, and the spectrum scope shows a grass of spikes that clusters when counts come from the CRT or the patch bay rather than the chamber.

**Sound:** When AUDIO is on, every event is a crisp click from the little grille. Those clicks really do reach the resonance coil, so leaving the speaker on is a mistake operators learn slowly.

## Antiacclimator

`antiacclimator` · Gorskiy АА-1 Antiacclimator · Regulation

**Panel controls:** BIAS, ON, RATE, SEASON.

**Inputs from other devices:**

- Infrafractor housing temperature raises antiacclimation bias (it fights the room warming up) *[added]*.
- Geotransversion unit geotransversal alignment raises antiacclimation bias (acclimatisation is local) *[added]*.
- Antiacclimation bias rises as Antiacclimator SEASON control and Geotransversion unit N/S control disagree (winter in the north is summer in the south) *[added]*.

**Outputs to other devices:**

- Antiacclimator antiacclimation bias lowers Chirality indicator ambient chirality.
- Antiacclimator antiacclimation bias lowers Main bus controller field instability.

**Look:** Slim grey 1U strip with colour-coded binding posts at one end and a seasonal thumbwheel. Its front is covered in hand-scratched calibration marks. A slim strip whose drift meter moves slowly and reluctantly. The days counter turns over at midnight in game time, and the SATURATED flag drops when the bias hits a stop.

**Sound:** Almost silent. A faint ticking clockwork escapement that slows in summer settings and speeds up in winter ones.

## Ion insulation plate

`ion-insulation-plate` · Neumann Dynamik IP-3 Ion Insulation Stack · Containment

**Panel controls:** CHARGE, POLARITY, DISCHARGE, PLATE.

**Inputs from other devices:**

- Isolated-frame flux emitter output raises ion leakage.
- Plynost Modulation Rectifier output ripple raises ion leakage.
- Grounded Faraday suit operator grounding lowers ion leakage.
- Delta hypersistor charge raises ion leakage (stored charge creeps across the plates) *[added]*.
- Fromitz probe reading lowers ion shielding (probe current bleeds the plates) *[added]*.

**Outputs to other devices:**

- Ion insulation plate leakage raises Fromitz probe reading.
- Ion insulation plate leakage raises Hyperfine detector count rate.
- Ion insulation plate shielding lowers Isolated-frame flux emitter output.
- Ion insulation plate leakage lowers Grounded Faraday suit operator grounding (leakage finds the operator) *[added]*.
- Ion insulation plate leakage lowers Varistance-isolator isolation (leakage to earth) *[added]*.

**Look:** Three iridescent plates stand on edge behind a slotted grille in a cream 2U panel. A discharge button sits under a hinged red cover. The three iridescent plates shift colour with charge, like oil on water. Leakage makes a thin blue corona crawl along their edges, and the magic-eye flickers in step.

**Sound:** A barely audible high fizz that sharpens with leakage. DISCHARGE makes a satisfying snap under the red cover, followed by a smell the log will mention.

## Encabulator

`encabulator` · Bonk Industries Model 77 Encabulator Drive · Rotation

**Panel controls:** DRIVE, BOOST, BRAKE, GEAR, FWD/REV.

**Inputs from other devices:**

- Tertiary ballast variac voltage must pass a threshold before encabulator drive can move.
- Encabulator drive falls as Encabulator FWD/REV control and Chirality indicator ambient chirality disagree (the drum resists turning against the field's handedness) *[added]*.

**Outputs to other devices:**

- Encabulator drive raises Ferrocore rotational speed.
- Encabulator drive raises Cradling node cradle sway (vibration) *[added]*.
- Encabulator drive raises Electron pump flow (common belt drive) *[added]*.
- Encabulator drive raises Heterodyne patch bay beat frequency (motor whine in the mix) *[added]*.

**Look:** Bonk's 4U drive: a polished aluminium drum turns behind a window above a heavy cast base plate. A hand brake lever and a guarded boost switch sit alongside, and the paint is worn through where hands rest. The aluminium drum turns behind its window with a visible seam that shows speed and direction. Slip shows as the drum stuttering against the indicator, and the brake lever trembles while braking.

**Sound:** A heavy gear-train grind, pitched by drive and gear, with a rotation thump once per revolution (already in the game). Turning it against the field's handedness adds a groaning, laboured note.

## Delta hypersistor

`delta-hypersistor` · Volt Xoccula DH-4 Delta Hypersistor · Containment

**Panel controls:** BLEED, DUMP, LIMIT, ARM.

**Inputs from other devices:**

- Helmholtz-Blatz coil field raises hypersistor charge.
- Main bus controller accumulated strain raises hypersistor charge (strain is banked in the hypersistor) *[added]*.

**Outputs to other devices:**

- Delta hypersistor BLEED control lowers Tertiary ballast variac voltage (and sags the supply while it does) *[added]*.
- Delta hypersistor charge raises Chirality indicator ambient chirality (stored charge has a handedness) *[added]*.
- Delta hypersistor charge lowers Grounded Faraday suit operator grounding (static on the suit lead) *[added]*.
- Delta hypersistor charge raises Ion insulation plate leakage (stored charge creeps across the plates) *[added]*.
- Delta hypersistor BLEED control lowers Main bus controller accumulated strain (bleeding the hypersistor relieves strain) *[added]*.

**Look:** Grey 2U with a fat ceramic-cased hypersistor mounted on the face under a wire cage, stencilled with lightning bolts. A key-switch arms the dump circuit. The ceramic hypersistor glows from within as charge banks, white at the core. Under the cage the lightning-bolt stencils seem to glow too, and the charge bargraph fills like a thermometer.

**Sound:** A rising whine as it charges, like a camera flash capacitor, which never quite tops out. DUMP is a big flat bang and a sizzle, with the whole rack's hum dipping for a second.

## Oblidisk

`oblidisk` · Synclex OD-12 Oblidisk · Rotation

**Panel controls:** COUPLING, CLUTCH, OBLIQUITY, STROBE.

**Inputs from other devices:**

- Ferrocore rotational speed raises platter speed.
- Passive damping lattice damping lowers platter speed.
- Double-helix transistor helical gain raises platter speed (it magnifies the oblidisk, as the label says) *[added]*.

**Outputs to other devices:**

- Oblidisk platter speed raises Cradling node cradle sway.
- Oblidisk platter speed raises Double-helix transistor helical gain.
- Oblidisk COUPLING control raises Ferrocore rotational speed.
- Oblidisk platter speed raises Phase spindle speed.

**Look:** A smoked-glass platter turns on top of a lilac 3U case like a turntable, lit from beneath in violet. Its obliquity is set by a big vernier dial. The smoked platter turns, lit violet from beneath. Its tilt changes with obliquity, and with the strobe on, a printed pattern appears to stand still, drift or run backwards depending on rpm.

**Sound:** A turntable-motor purr with a wow-and-flutter wobble that deepens with obliquity. The clutch engages with a soft felt thunk.

## Double-helix transistor

`double-helix-transistor` · Volt Xoccula DHT-2N Double-Helix Transistor · Signal

**Panel controls:** BIAS, TWIST, ON.

**Inputs from other devices:**

- Oblidisk platter speed raises helical gain.
- Plynost Modulation Rectifier output ripple raises helical gain (it rectifies the ripple and runs away) *[added]*.

**Outputs to other devices:**

- Double-helix transistor helical gain raises Main bus controller delta.
- Double-helix transistor helical gain raises Micro-weave tachyon suppressor noise.
- Double-helix transistor helical gain raises Oblidisk platter speed (it magnifies the oblidisk, as the label says) *[added]*.

**Look:** Black 1U strip with a large metal-can transistor on a finned heat sink, its leads visibly twisted. It is labelled 'magnify your oblidisk' in Dymo tape. The twisted leads glow faintly warm with gain. The magic-eye closes in a spiral, and the HOT flag drops when the plynost ripple runs it away.

**Sound:** A tiny high-frequency squeal, almost inaudible, that becomes obvious only when it rises towards runaway.

## Vacuum tube relief valve

`vacuum-tube-relief-valve` · Gorskiy КП-7 Relief Valve · Regulation

**Panel controls:** VENT, AUTO, POP TEST, SET kPa.

**Inputs from other devices:**

- Baltovsky chamber pressure raises relief venting.
- Lingden Smith negative pressure chamber pressure raises relief venting (shared vent manifold) *[added]*.

**Outputs to other devices:**

- Vacuum tube relief valve venting lowers Baltovsky chamber pressure.
- Vacuum tube relief valve venting lowers Bell-jar shroud vacuum (venting lets air into the jar line) *[added]*.
- Vacuum tube relief valve venting raises Condensate trap coil flow (vented gas condenses in the trap) *[added]*.

**Look:** A brass relief valve pokes through a battleship-grey 2U panel, with a red-painted handwheel. A paper inspection tag hangs from it on wire, and the serial is stamped beneath. The handwheel turns, the paper tag flutters when venting, and a plume of white vapour puffs from the brass seat when it lifts.

**Sound:** A pressure-cooker hiss when venting, with a sharp chirp as the valve pops and a dull metal clank when it reseats. Sticking is a hesitant hiss-hiss-hiss.

## Sizing relay

`sizing-relay` · Wonshou Labs SR-5 Sizing Relay · Regulation

**Panel controls:** SIZE, LATCH, RESET.

**Inputs from other devices:**

- Ferrocore interplanar capacitivity must pass a threshold before relay engaged can move.
- Improvised master control register word raises relay engaged (the register can pull the relay in) *[added]*.

**Outputs to other devices:**

- Sizing relay engaged raises Main bus controller delta.
- Sizing relay engaged lowers Tertiary ballast variac voltage (the relay drops a tap) *[added]*.

**Look:** Open-frame relay behind a clear acrylic cover on a red 1U strip, its silver contacts visibly clacking. A five-position size switch has a chicken-head pointer. Silver contacts visibly clack behind the acrylic. Chatter is a blur of sparks, and the dekatron counts operations with an orange dot running round its ring.

**Sound:** A hard relay clack on each change, and machine-gun chatter when engaged is marginal. Each clack also makes the ballast variac hum dip slightly.

## Cradling node

`cradling-node` · Neumann Dynamik CN-1 Cradling Node · Containment

**Panel controls:** CLAMP, LEVEL, LOCK.

**Inputs from other devices:**

- Phase spindle speed raises cradle sway.
- Oblidisk platter speed raises cradle sway.
- Main bus controller accumulated strain raises cradle sway (the whole rack shakes) *[added]*.
- Encabulator drive raises cradle sway (vibration) *[added]*.
- Passive damping lattice damping lowers cradle sway (what the lattice is for) *[added]*.

**Outputs to other devices:**

- Cradling node cradle sway raises Main bus controller field instability.
- Cradling node cradle sway lowers Hyperorbital Bohr/Schreiffer phase cell coherence (the orbital model wobbles off phase) *[added]*.
- Cradling node cradle sway raises Milliblatz meter reading (the needle jiggles) *[added]*.
- Cradling node cradle sway lowers Passive damping lattice damping (sway slackens the lattice) *[added]*.

**Look:** Two padded saddle clamps hold a short glass tube across the front of a cream 2U panel. A spirit-level bubble in a round window shows whether the cradle is true. The glass tube rocks in its saddles, and the spirit-level bubble drifts off centre with sway, back to centre when locked.

**Sound:** A soft creak of padded leather and a faint clink of glass against the clamps, timed to the sway.

## Geotransversion unit

`geotransversion-unit` · Trager-Feinstein Laboratory GTU Mk III Geotransversion Unit · Ancillary

**Panel controls:** AZIMUTH, DECLINATION, N/S, FIX, LAT, LONG.

**Inputs from other devices:**

- Milliblatz meter reading lowers geotransversal alignment (the meter's big magnet deflects the compass) *[added]*.
- Helmholtz-Blatz coil field lowers geotransversal alignment (the field drags the compass) *[added]*.
- Chirality indicator ambient chirality lowers geotransversal alignment (handedness confuses the hemisphere switch) *[added]*.

**Outputs to other devices:**

- Geotransversion unit geotransversal alignment raises Antiacclimator antiacclimation bias (acclimatisation is local) *[added]*.
- Antiacclimator antiacclimation bias rises as Antiacclimator SEASON control and Geotransversion unit N/S control disagree (winter in the north is summer in the south) *[added]*.
- Geotransversion unit geotransversal alignment raises Main bus controller delta (an aligned rig scores better) *[added]*.

**Look:** Black crackle-finish 3U with a brass-bezelled compass rose behind glass and a geared azimuth handwheel. A small clip holds a folded Ordnance-style map. The brass compass rose swings to point somewhere that is not north. The alignment needle settles when the azimuth handwheel and coordinates agree, and the chart recorder draws long, slow contours.

**Sound:** The geared handwheel ratchets. When it is aligned, a faint pure tone sounds, like a finger on a wineglass, and it detunes as the field drags the compass.

## Improvised master control register

`vx3-master-control-register` · Ottman Ottman-1200 Control Register · Signal

**Panel controls:** WORD HI, WORD LO, LOAD, RUN/HALT, STEP, EXAM, PANEL, ADDR.

**Inputs from other devices:**

- Hyperfine detector count rate raises control word (the register latches the counts) *[added]*.
- Main bus controller delta raises control word (the register records Delta) *[added]*.

**Outputs to other devices:**

- Improvised master control register word raises Main bus controller delta.
- Improvised master control register word raises Heterodyne patch bay beat frequency (data clocking into the patch bay) *[added]*.
- Improvised master control register word raises Sizing relay engaged (the register can pull the relay in) *[added]*.

**Look:** A later add-on: a beige 3U box with chunky paddle switches like a minicomputer front panel, red lamps and a Nixie data display. It is obviously newer than everything around it. Red lamps show the current word in binary, the nixie data display updates as counts arrive, and the RUNNING lamp flickers with bus activity. It looks too modern for the rack.

**Sound:** Paddle switches make clean plastic clicks. When running, there is a quiet modem-like chirping whose pattern follows the word.

## Hyperflux inductor

`hyperflux-inductor` · Neumann Dynamik HFI-40 Hyperflux Inductor · Field

**Panel controls:** FLUX GAIN, TAP, SHUNT, POL.

**Inputs from other devices:**

- Ferrocore interplanar capacitivity raises hyperflux.
- Holtzmann-constant resonance coil resonance raises hyperflux.
- Isolated-frame flux emitter output raises hyperflux (emitted flux is collected) *[added]*.

**Outputs to other devices:**

- Hyperflux inductor flux raises Baltovsky chamber glow.
- Hyperflux inductor flux raises Helmholtz-Blatz coil field.
- Main bus controller field instability rises as Helmholtz-Blatz coil trim setting and Hyperflux inductor flux disagree.

**Look:** Neumann Dynamik's 4U inductor: a big green-enamelled coil shows through a mesh window, with a polished copper bus bar bolted across the front. It is quietly the most expensive thing in the rack. The green-enamelled coil darkens with heat and the copper bus bar takes on temper colours at high flux. The mesh window shows faint shimmering heat haze.

**Sound:** A deep, steady 100 Hz magnetostrictive drone that you feel more than hear, and the most expensive-sounding thing in the rack. Saturation adds a growl.

## Plynost Modulation Rectifier

`plynost-modulation-rectifier` · Wonshou Labs PMR-3 Plynost Modulation Rectifier · Power

**Panel controls:** SMOOTHING, MOD, RECTIFY, FUSE TEST, RESET.

**Inputs from other devices:**

- Tertiary ballast variac voltage raises output ripple.
- Varistance-isolator isolation lowers output ripple.
- Main bus controller load raises output ripple (more load, more ripple) *[added]*.

**Outputs to other devices:**

- Plynost Modulation Rectifier output ripple raises Ion insulation plate leakage.
- Plynost Modulation Rectifier output ripple lowers 7-stage betaform amplifier gain (hum on the HT) *[added]*.
- Plynost Modulation Rectifier output ripple lowers Control panel display brightness (hum bars roll up the screen) *[added]*.
- Plynost Modulation Rectifier output ripple raises Double-helix transistor helical gain (it rectifies the ripple and runs away) *[added]*.
- Plynost Modulation Rectifier output ripple lowers Isolated-frame flux emitter output (deplanarisation) *[added]*.

**Look:** Wonshou's signature red 3U with a stack of black finned rectifier plates on the face and a big RECTIFY lever. An oscilloscope shows the output waveform. The finned rectifier plates pick up a faint blue glow between them. On the scope, a sawtooth becomes smooth DC as smoothing rises, with hum bars that roll in step with the control panel display.

**Sound:** A raspy 100 Hz buzz whose roughness is the ripple. You can hear the smoothing crank take the edge off it, and the RECTIFY lever lands with a thick clunk.

## Micro-weave tachyon suppressor

`micro-weave-tachyon-suppressor` · Synclex TS-8 Micro-Weave Suppressor · Regulation

**Panel controls:** WEAVE, DENSITY, MESH, DEGAUSS.

**Inputs from other devices:**

- Double-helix transistor helical gain raises tachyon noise.
- 7-stage betaform amplifier gain raises tachyon noise.
- Control panel display brightness raises tachyon noise (CRT flyback sprays the mesh) *[added]*.

**Outputs to other devices:**

- Micro-weave tachyon suppressor noise raises Main bus controller field instability.
- Micro-weave tachyon suppressor noise raises Hyperfine detector count rate (tachyons count as events) *[added]*.
- Micro-weave tachyon suppressor noise raises Lingden Smith negative pressure chamber pressure (suspected microteleportation interference) *[added]*.

**Look:** Lilac 2U with a domed fine-mesh filter can on the front, a sliding weave adjuster and a degauss button. The mesh shimmers slightly when looked at sideways. The fine mesh dome shimmers with moiré as you look at it sideways, more strongly with noise. DEGAUSS makes it wobble like a jelly.

**Sound:** A faint, high, glittering shimmer of noise, like a long cymbal tail that never ends. DEGAUSS is a descending boing-hum.

## Infrafractor housing

`infrafractor-housing` · Gorskiy ИФ-2 Infrafractor Housing · Containment

**Panel controls:** HATCH, VENT, HEATER, SCRAM.

**Inputs from other devices:**

- Meta-stable flux plasma inducer density raises housing temperature.
- 7-stage betaform amplifier gain raises housing temperature.
- Nanocore Bose-Einstein radiator cooling capacity lowers housing temperature.

**Outputs to other devices:**

- Infrafractor housing temperature raises Antiacclimator antiacclimation bias (it fights the room warming up) *[added]*.
- Infrafractor housing temperature lowers 7-stage betaform amplifier gain (heat soak drifts the valves) *[added]*.
- Infrafractor housing temperature lowers Condensate trap coil frost (melts the frost) *[added]*.
- Infrafractor housing temperature raises Ferrocore warming oven temperature (the oven overshoots in a warm rack) *[added]*.
- Infrafractor housing temperature lowers Centrifugal governor flyweights limiting (the oil thins) *[added]*.
- Infrafractor housing temperature lowers Passive damping lattice damping (thermal expansion slackens the wires) *[added]*.

**Look:** Heavy cast-iron 3U housing with a bolted inspection hatch and a small red window that glows when hot. A Cyrillic warning plate is riveted beside a red SCRAM mushroom. The small red window glows from dull cherry to orange with temperature, and heat haze rises from the cast iron. The SCRAM mushroom is lit from behind.

**Sound:** Slow metallic ticking as the cast iron expands, plus a low furnace roar at high temperature. SCRAM is a deep klaxon honk.

## Lingden Smith negative pressure chamber

`lingden-smith-negative-pressure-chamber` · Neumann Dynamik LS-6 Negative Pressure Chamber · Containment

**Panel controls:** EVACUATE, VALVE, BACKFILL, RANGE.

**Inputs from other devices:**

- Electron pump flow raises negative pressure.
- Bell-jar shroud vacuum lowers negative pressure (they share a vacuum manifold) *[added]*.
- Micro-weave tachyon suppressor noise raises negative pressure (suspected microteleportation interference) *[added]*.

**Outputs to other devices:**

- Lingden Smith negative pressure chamber pressure lowers Meta-stable flux plasma inducer density.
- Lingden Smith negative pressure chamber pressure raises Vacuum tube relief valve venting (shared vent manifold) *[added]*.

**Look:** Cream 3U with a thick round desiccator-style glass dome set into the face, a crank-driven evacuation pump and a row of vacuum gauges. The glass dome mists inwards as it evacuates. The ion-gauge magic-eye flickers, and when tachyon noise runs high a small pale flash sometimes appears inside the dome.

**Sound:** The evacuation crank makes a laboured piston huff. Backfill is a long inrushing sigh, and at deep vacuum the dome gives a faint ringing tick.

## Passive damping lattice

`passive-damping-lattice` · Volt Xoccula PDL-2 Damping Lattice · Regulation

**Panel controls:** TENSION, LOCK, TAP TEST.

**Inputs from other devices:**

- Infrafractor housing temperature lowers lattice damping (thermal expansion slackens the wires) *[added]*.
- Cradling node cradle sway lowers lattice damping (sway slackens the lattice) *[added]*.
- Holtzmann-constant resonance coil resonance lowers lattice damping (the lattice rings in sympathy) *[added]*.

**Outputs to other devices:**

- Passive damping lattice damping lowers Main bus controller field instability.
- Passive damping lattice damping lowers Oblidisk platter speed.
- Passive damping lattice damping lowers Cradling node cradle sway (what the lattice is for) *[added]*.

**Look:** A brass lattice of taut wires is stretched across the front of a grey 2U panel like a tiny harp. A tension vernier tightens it, and it rings when tapped. The brass wires visibly vibrate, blurring when they ring and sharpening when damping is high. Tension changes their spacing very slightly.

**Sound:** TAP plays a harp-like chord whose pitch follows tension. It also rings by itself in sympathy with the resonance coil, which is eerie in a quiet room.

## Hyperorbital Bohr/Schreiffer phase cell

`bohr-schreiffer-phase-cell` · Synclex BSC-4 Hyperorbital Phase Cell · Field

**Panel controls:** PHASE, ORBIT, CELL, QUENCH.

**Inputs from other devices:**

- Phase coherence rises when Hyperorbital Bohr/Schreiffer phase cell PHASE control agrees with Phase spindle speed.
- Phase coherence rises when Heterodyne patch bay LOCAL OSC control agrees with Hyperorbital Bohr/Schreiffer phase cell PHASE control (the cell locks only when the oscillator agrees with it) *[added]*.
- Cradling node cradle sway lowers phase coherence (the orbital model wobbles off phase) *[added]*.

**Outputs to other devices:**

- Hyperorbital Bohr/Schreiffer phase cell coherence raises Chirality indicator ambient chirality.
- Hyperorbital Bohr/Schreiffer phase cell coherence raises Main bus controller delta.
- Hyperorbital Bohr/Schreiffer phase cell coherence raises Isolated-frame flux emitter output (phase-locked emission) *[added]*.

**Look:** A windowed cell with metal-framed viewports, set in a lilac 3U panel. Inside, a little orbital model glows, and an X-Y scope traces the phase as a Lissajous figure. The little orbital model inside glows and spins. The X-Y scope draws a Lissajous figure that settles into a stable loop only when the patch bay oscillator agrees with phase-set.

**Sound:** A faint, pure tone whose interval with the phase spindle's pitch is the phase error. In lock it becomes a fifth; out of lock it beats sourly.

## Electron pump

`electron-pump` · Bonk Industries Model 9 Electron Pump · Power

**Panel controls:** STROKE, PRIME, VALVE, GOV.

**Inputs from other devices:**

- Tertiary ballast variac voltage must pass a threshold before electron flow can move.
- Hydromagnetic tau-induction connector coupling raises electron flow (it shares the pump's fluid loop) *[added]*.
- Encabulator drive raises electron flow (common belt drive) *[added]*.

**Outputs to other devices:**

- Electron pump flow raises Lingden Smith negative pressure chamber pressure.
- Electron pump flow lowers Varistance-isolator isolation.
- Electron pump flow raises Hydromagnetic tau-induction connector coupling (and the pump drives that loop) *[added]*.
- Electron pump flow raises Nanocore Bose-Einstein radiator cooling capacity (it circulates the coolant too) *[added]*.

**Look:** A chrome piston pump with a visible flywheel spins behind a window in an orange 3U panel. There is a crank handle on the front for when the motor sulks. The chrome piston pumps and the flywheel spins behind the window. A faint blue patina creeps over the chrome as hours accumulate.

**Sound:** A chuff-chuff piston rhythm, with a squeaking crank when it is hand-turned, and a gurgling knock when it cavitates.

## Hydromagnetic tau-induction connector

`hydromagnetic-tau-induction-connector` · Wonshou Labs TC-12 Tau-Induction Connector · Signal

**Panel controls:** ENGAGE, TAU, COOL, FLUSH.

**Inputs from other devices:**

- Nanocore Bose-Einstein radiator cooling capacity raises tau coupling.
- Electron pump flow raises tau coupling (and the pump drives that loop) *[added]*.
- Tau coupling rises when Hydromagnetic tau-induction connector TAU control agrees with Holtzmann-constant resonance coil TUNE control (couples best when tuned to the resonance coil) *[added]*.

**Outputs to other devices:**

- Hydromagnetic tau-induction connector coupling raises Electron pump flow (it shares the pump's fluid loop) *[added]*.
- Hydromagnetic tau-induction connector coupling raises Helmholtz-Blatz coil field (tau coupling feeds the coil pair) *[added]*.

**Look:** A big multi-pin connector with red and blue cables mates into the face of a red 2U panel behind a locking lever. A small flow-glass shows dark fluid circulating. The red and blue cables twitch when the lever engages. Dark fluid circulates faster in the flow-glass with coupling, and the tau nixie climbs.

**Sound:** A heavy latching clunk and a hydraulic gurgle. When the connector is tuned to the resonance coil it adds a gentle sub-bass throb.

## Holtzmann-constant resonance coil

`holtzmann-resonance-coil` · Volt Xoccula HRC-1 Holtzmann Resonance Coil · Field

**Panel controls:** TUNE, HIGH Q, BAND, RING, DAMP.

**Inputs from other devices:**

- Holtzmann resonance rises when Holtzmann-constant resonance coil TUNE control agrees with Ferrocore rotational speed.
- Hyperfine detector AUDIO control raises holtzmann resonance (its loudspeaker clicks excite the open coil) *[added]*.

**Outputs to other devices:**

- Holtzmann-constant resonance coil resonance raises Hyperflux inductor flux.
- Holtzmann-constant resonance coil resonance raises Main bus controller delta.
- Hydromagnetic tau-induction connector coupling rises when Hydromagnetic tau-induction connector TAU control agrees with Holtzmann-constant resonance coil TUNE control (couples best when tuned to the resonance coil) *[added]*.
- Holtzmann-constant resonance coil resonance lowers Passive damping lattice damping (the lattice rings in sympathy) *[added]*.

**Look:** A tall, open-wound copper coil stands in a cut-out of the grey 3U panel, with a magic-eye tuning indicator. The fine tuning vernier is worn shiny. The open copper winding glows faintly at the turns when it rings, and the magic-eye snaps shut at peak. The scope shows a decaying ring after RING is pressed.

**Sound:** A clear ringing note, like a tuning fork, at the tuned frequency, plus sympathetic rings when the hyperfine speaker clicks or the lattice is tapped.

## Meta-stable flux plasma inducer

`meta-stable-flux-plasma-inducer` · Gorskiy ПИ-4 Plasma Inducer · Field

**Panel controls:** STRIKE, BIAS, CONTAIN, SUSTAIN, MODE.

**Inputs from other devices:**

- Isolated-frame flux emitter output raises plasma density.
- Lingden Smith negative pressure chamber pressure lowers plasma density.

**Outputs to other devices:**

- Meta-stable flux plasma inducer density raises Baltovsky chamber pressure.
- Meta-stable flux plasma inducer density raises Fromitz probe reading.
- Meta-stable flux plasma inducer density raises Infrafractor housing temperature.
- Meta-stable flux plasma inducer density raises Main bus controller load.

**Look:** A bulbous glass plasma globe crackles with violet filaments inside a steel cage on the face of an olive 4U chassis. Heavy Soviet toggles sit beside a mode selector that goes up to META. Violet filaments crawl inside the globe and reach for whatever is nearest. In META mode they briefly freeze still, which is unsettling.

**Sound:** A crackling plasma-ball fizz with sharp spitting arcs on strike. In META mode the fizz suddenly goes silent, which is worse.

## Control panel display

`control-panel-display` · Volt Xoccula CPD-5 Status Display · Measurement

**Panel controls:** INTENSITY, PAGE, HOLD, DEGAUSS.

**Inputs from other devices:**

- Tertiary ballast variac voltage must pass a threshold before display brightness can move.
- Heterodyne patch bay beat frequency lowers display brightness (beat flicker on the CRT) *[added]*.
- Main bus controller delta raises display brightness (the status page lights up) *[added]*.
- Plynost Modulation Rectifier output ripple lowers display brightness (hum bars roll up the screen) *[added]*.

**Outputs to other devices:**

- Control panel display brightness raises Hyperfine detector count rate (false counts from the EHT) *[added]*.
- Control panel display brightness raises Micro-weave tachyon suppressor noise (CRT flyback sprays the mesh) *[added]*.

**Look:** A green-phosphor CRT under a black hood in a grey 2U panel shows a status page in chunky vector characters. The bezel is fingerprinted where people point at it. Green vector characters show status, with rolling hum bars from the rectifier and flicker from the heterodyne beat. Brightness blooms the characters as Delta rises.

**Sound:** A 15 kHz CRT whine that some players will hear and some won't. DEGAUSS makes the classic bwoing.

## Grounded Faraday suit

`faraday-suit` · Bonk Industries Model 3 Suit Interlock · Ancillary

**Panel controls:** CLIP, TEST, INTERLOCK.

**Inputs from other devices:**

- Delta hypersistor charge lowers operator grounding (static on the suit lead) *[added]*.
- Ion insulation plate leakage lowers operator grounding (leakage finds the operator) *[added]*.
- Condensate trap coil flow raises operator grounding (a wet floor grounds the operator better) *[added]*.

**Outputs to other devices:**

- Grounded Faraday suit operator grounding lowers Ion insulation plate leakage.
- Grounded Faraday suit operator grounding lowers Fromitz probe reading (an ungrounded operator holding the probe reads high) *[added]*.
- Grounded Faraday suit operator grounding raises Varistance-isolator isolation (a grounded operator completes the earth) *[added]*.

**Look:** A 1U interlock strip with a crocodile-clip grounding lead coiled on a hook. The suit itself hangs on the wall nearby, and a NO SUIT tile glows red until the operator clips on. The suit on the wall hook sways gently whenever static builds. The NO SUIT tile glows red until the croc clip is on, and the static VU flickers when the hypersistor is charged.

**Sound:** A crocodile clip snaps on metal. Static gives small, irregular crackles, like a nylon jumper coming off.

## Helmholtz-Blatz coil

`helmholtz-blatz-coil` · Volt Xoccula HB-2 Helmholtz-Blatz Coil Pair · Field

**Panel controls:** FIELD, BLATZ TRIM, ENERGISE, POL, FINE, FLIP, COILS.

**Inputs from other devices:**

- Hyperflux inductor flux raises helmholtz-blatz field.
- Phase spindle speed must pass a threshold before helmholtz-blatz field can move.
- Milliblatz meter reading lowers helmholtz-blatz field (meter loading: reading the field takes a little of it) *[added]*.
- Hydromagnetic tau-induction connector coupling raises helmholtz-blatz field (tau coupling feeds the coil pair) *[added]*.
- Main bus controller field instability lowers helmholtz-blatz field (bus noise on the coil supply) *[added]*.

**Outputs to other devices:**

- Helmholtz-Blatz coil field raises Delta hypersistor charge.
- Helmholtz-Blatz coil field raises Isolated-frame flux emitter output.
- Helmholtz-Blatz coil field raises Main bus controller delta.
- Main bus controller field instability rises as Helmholtz-Blatz coil trim setting and Hyperflux inductor flux disagree.
- Helmholtz-Blatz coil field raises Main bus controller load.
- Helmholtz-Blatz coil field raises Milliblatz meter reading.
- Helmholtz-Blatz coil field lowers Geotransversion unit geotransversal alignment (the field drags the compass) *[added]*.

**Look:** Volt Xoccula's flagship 4U: two copper air-core coils face each other through a big window, and the field between them is visible as a faint blue shimmer. Two large verniers set FIELD and BLATZ TRIM. The blue shimmer between the coils thickens with field, wanders sideways as trim drifts and turns briefly mirror-image when the field inverts.

**Sound:** A deep, breathing drone with a slow beat whose rate is the trim error, already the backbone of the game's audio. Inversion is a short, sickening pitch slide down and back.

## Phase spindle

`phase-spindle` · Bonk Industries Model 12 Phase Spindle · Rotation

**Panel controls:** RATIO, SPIN, JOG, STROBE.

**Inputs from other devices:**

- Oblidisk platter speed raises spindle speed.
- Centrifugal governor flyweights limiting lowers spindle speed.
- Heterodyne patch bay beat frequency raises spindle speed (the beat is patched back into the spindle motor) *[added]*.

**Outputs to other devices:**

- Hyperorbital Bohr/Schreiffer phase cell coherence rises when Hyperorbital Bohr/Schreiffer phase cell PHASE control agrees with Phase spindle speed.
- Phase spindle speed raises Cradling node cradle sway.
- Phase spindle speed raises Centrifugal governor flyweights limiting.
- Phase spindle speed must pass a threshold before Helmholtz-Blatz coil field can move.
- Heterodyne patch bay beat frequency rises as Phase spindle speed and Heterodyne patch bay LOCAL OSC control disagree.

**Look:** A brass shaft turns in pillow-block bearings behind a window, with a black-and-white stripe for the strobe. A belt runs from a small motor at one side, and a hand-painted sign reads KEEP TIES CLEAR. The brass shaft spins, and the black-and-white strobe stripe appears to freeze, creep or reverse depending on speed. The belt sways when the governor hunts.

**Sound:** Bearing whine that rises with rpm. Phase slip makes a rhythmic chuff, and the belt slaps when it hunts.

## Ferrocore warming oven

`ferrocore-warming-oven` · Neumann Dynamik WO-1 Ferrocore Warming Oven · Heater

**Panel controls:** OVEN, DOOR, THERMOSTAT, TIMER.

**Inputs from other devices:**

- Tertiary ballast variac voltage raises oven temperature.
- Infrafractor housing temperature raises oven temperature (the oven overshoots in a warm rack) *[added]*.

**Outputs to other devices:**

- Ferrocore warming oven temperature must pass a threshold before Ferrocore rotational speed can move.
- Ferrocore theta-constant instability rises as Ferrocore WARM RAMP control and Ferrocore warming oven temperature disagree.
- Ferrocore warming oven temperature lowers Tertiary ballast variac voltage (the element draws current) *[added]*.
- Ferrocore warming oven temperature lowers Nanocore Bose-Einstein radiator cooling capacity (the radiator is fighting the oven) *[added]*.

**Look:** A cream 2U drawer oven with a small glass door, an orange element glow inside and a bimetal thermostat dial. It smells faintly of hot dust. The orange element glows through the little glass door and the thermostat dial ticks round. The window steams faintly when the rack runs hot.

**Sound:** A soft electric-oven tick and the hum of the element. The thermostat click sounds like a kitchen timer.

## Milliblatz meter

`milliblatz-meter` · Trager-Feinstein Laboratory Type 1100 Milliblatz Meter · Measurement

**Panel controls:** RANGE, ZERO, DAMP, PEAK HOLD.

**Inputs from other devices:**

- Helmholtz-Blatz coil field raises milliblatz reading.
- 7-stage betaform amplifier gain raises milliblatz reading (pickup on the meter leads) *[added]*.
- Cradling node cradle sway raises milliblatz reading (the needle jiggles) *[added]*.

**Outputs to other devices:**

- Milliblatz meter reading lowers Geotransversion unit geotransversal alignment (the meter's big magnet deflects the compass) *[added]*.
- Milliblatz meter reading lowers Helmholtz-Blatz coil field (meter loading: reading the field takes a little of it) *[added]*.

**Look:** A large Bakelite-cased panel meter with a mirrored scale in a black 2U panel. A calibration certificate is taped to the side, signed and dated 1974. The big needle swings over the mirrored scale, jiggling with rack sway and with amplifier pickup. Peak-hold leaves a red drag pointer behind.

**Sound:** The needle makes a faint mechanical click when it hits the stops.

## Tertiary ballast variac

`ballast-variac` · Gorskiy ЛАТР-9 Ballast Variac · Power

**Panel controls:** TAP V, FINE, CUT-OUT, FAN, RESET.

**Inputs from other devices:**

- Varistance-isolator MAINS control must pass a threshold before ballast voltage can move.
- Delta hypersistor BLEED control lowers ballast voltage (and sags the supply while it does) *[added]*.
- Main bus controller load lowers ballast voltage (supply sag under load) *[added]*.
- Sizing relay engaged lowers ballast voltage (the relay drops a tap) *[added]*.
- Ferrocore warming oven temperature lowers ballast voltage (the element draws current) *[added]*.

**Outputs to other devices:**

- Tertiary ballast variac voltage must pass a threshold before 7-stage betaform amplifier gain can move.
- Tertiary ballast variac voltage must pass a threshold before Control panel display brightness can move.
- Tertiary ballast variac voltage must pass a threshold before Electron pump flow can move.
- Tertiary ballast variac voltage must pass a threshold before Encabulator drive can move.
- Tertiary ballast variac voltage raises Ferrocore warming oven temperature.
- Tertiary ballast variac voltage raises Ferrocore rotational speed.
- Tertiary ballast variac voltage raises Plynost Modulation Rectifier output ripple.

**Look:** A huge round variac with a hand-wheel through the face of a battleship-grey 3U panel and a Bakelite tap selector. The tap positions are labelled in volts in two different hands. The huge hand-wheel turns and the brush is visible on the winding. Brush arcing shows as blue sparks, and the room lights dim slightly with load.

**Sound:** A deep, growling hum whose pitch drops as load rises. Arcing adds a sizzling crackle.

## Centrifugal governor flyweights

`governor-flyweights` · Bonk Industries Model 5 Flyball Governor · Regulation

**Panel controls:** SETPOINT, LOCKOUT, OIL.

**Inputs from other devices:**

- Phase spindle speed raises governor limiting.
- Infrafractor housing temperature lowers governor limiting (the oil thins) *[added]*.

**Outputs to other devices:**

- Centrifugal governor flyweights limiting lowers Ferrocore rotational speed.
- Centrifugal governor flyweights limiting lowers Phase spindle speed.

**Look:** A brass flyball governor from a steam engine spins behind a porthole in an orange 2U panel, the balls lifting as it speeds up. An oil plunger sits beside it. The brass flyballs lift as it speeds up and hunt up and down when the oil is thin. The OILED lamp fades over time.

**Sound:** A whirring tick of brass linkage, and a squeal when it needs oil. Hunting is a pulsing whirr.

## Bell-jar shroud

`bell-jar-shroud` · Volt Xoccula BJ-1 Bell-Jar Shroud · Containment

**Panel controls:** PUMP, VENT, SEAL, LIFT.

**Inputs from other devices:**

- Baltovsky chamber pressure lowers bell-jar vacuum.
- Vacuum tube relief valve venting lowers bell-jar vacuum (venting lets air into the jar line) *[added]*.

**Outputs to other devices:**

- Bell-jar shroud vacuum lowers Lingden Smith negative pressure chamber pressure (they share a vacuum manifold) *[added]*.
- Bell-jar shroud vacuum lowers Main bus controller field instability (a sealed jar steadies the coils) *[added]*.

**Look:** A heavy glass bell jar sits on a ground-steel plate on top of a grey 2U base, with a key-switched lift and a vacuum gauge. Something small and important lives under it. The heavy glass jar sits on its steel plate. Something small and important under it glows in step with the coil pair, and the stress annunciator lights as vacuum rises.

**Sound:** A suction pop when it seals. A deep hollow ring sounds when the jar is stressed, as if a giant finger flicked it.

## Heterodyne patch bay

`heterodyne-patch-bay` · Trager-Feinstein Laboratory Type 600 Heterodyne Patch Bay · Signal

**Panel controls:** LOCAL OSC, MIX, PATCH, MUTE.

**Inputs from other devices:**

- Beat frequency rises as Phase spindle speed and Heterodyne patch bay LOCAL OSC control disagree.
- Improvised master control register word raises beat frequency (data clocking into the patch bay) *[added]*.
- Encabulator drive raises beat frequency (motor whine in the mix) *[added]*.

**Outputs to other devices:**

- Heterodyne patch bay beat frequency raises 7-stage betaform amplifier gain (patched into the amplifier input) *[added]*.
- Hyperorbital Bohr/Schreiffer phase cell coherence rises when Heterodyne patch bay LOCAL OSC control agrees with Hyperorbital Bohr/Schreiffer phase cell PHASE control (the cell locks only when the oscillator agrees with it) *[added]*.
- Heterodyne patch bay beat frequency lowers Control panel display brightness (beat flicker on the CRT) *[added]*.
- Heterodyne patch bay beat frequency raises Hyperfine detector count rate (audio-frequency pickup) *[added]*.
- Heterodyne patch bay beat frequency raises Phase spindle speed (the beat is patched back into the spindle motor) *[added]*.

**Look:** A black 2U telephone-exchange style patch panel with cloth-covered cords hanging in loops. A local-oscillator vernier and a small scope show the beat between the spindle and the oscillator. Cloth cords hang in loops. The beat scope shows a slow envelope that flattens to a line at zero-beat, and the patch DIP switches change which cords appear to be carrying signal.

**Sound:** The audible beat itself, a wobbling whistle like a shortwave radio being tuned, which slows as it nears zero-beat.

## Condensate trap coil

`condensate-trap-coil` · Synclex CT-3 Condensate Trap · Cooling

**Panel controls:** CHILL, DEFROST, DRAIN.

**Inputs from other devices:**

- Baltovsky chamber pressure raises condensate flow (chamber exhaust feeds the trap) *[added]*.
- Vacuum tube relief valve venting raises condensate flow (vented gas condenses in the trap) *[added]*.
- Infrafractor housing temperature lowers coil frost (melts the frost) *[added]*.
- Nanocore Bose-Einstein radiator cooling capacity raises coil frost (shared refrigerant) *[added]*.

**Outputs to other devices:**

- Condensate trap coil flow raises Nanocore Bose-Einstein radiator cooling capacity.
- Condensate trap coil flow raises Grounded Faraday suit operator grounding (a wet floor grounds the operator better) *[added]*.

**Look:** A 1U strip with a sight window onto a copper refrigeration coil furred with frost. A drain button drips into a tin tray on the floor below. The copper coil furs with frost, and drips fall from the drain into the tin tray, counted by the dekatron. The tray slowly fills over a long session.

**Sound:** Drip, drip, drip into a tin tray, at a rate that follows flow, plus faint crackling of frost.

## Chirality indicator

`chirality-indicator` · Trager-Feinstein Laboratory Type 7 Chirality Indicator · Measurement

**Panel controls:** SENSE, TEST.

**Inputs from other devices:**

- Hyperorbital Bohr/Schreiffer phase cell coherence raises ambient chirality.
- Antiacclimator antiacclimation bias lowers ambient chirality.
- Main bus controller field instability raises ambient chirality.
- Delta hypersistor charge raises ambient chirality (stored charge has a handedness) *[added]*.

**Outputs to other devices:**

- Chirality indicator ambient chirality raises Hyperfine detector count rate.
- Encabulator drive falls as Encabulator FWD/REV control and Chirality indicator ambient chirality disagree (the drum resists turning against the field's handedness) *[added]*.
- Chirality indicator ambient chirality lowers Geotransversion unit geotransversal alignment (handedness confuses the hemisphere switch) *[added]*.

**Look:** A glass vial of sugar solution between two polarising filters, lit from behind, set into a black 1U strip. LEFT and RIGHT lamps flank a centre-zero meter. The backlit sugar solution changes tint as it rotates the polarised light: amber for left, blue for right. The LEFT and RIGHT lamps flicker when it is near zero.

**Sound:** A tiny two-tone chime when handedness flips, ascending for right and descending for left.
