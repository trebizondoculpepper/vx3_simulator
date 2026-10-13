# Redline and fire mission: implementation analysis

The [mission brief](../resume/2026-10-13_redline-and-fire-mission.md) supplies the intended player experience and the owner's six decisions. This document records the implementation contract and the first playable pass. Its pure state rules are tested; visual, audio and full-playthrough tuning remain.

## Current slice: redline to smoke

| Channel | Instrument limit | Device that heats | Existing route above limit |
| --- | ---: | --- | --- |
| Spindle | 85% | Encabulator drive | SPEED near full with governor limiting lifted or set high |
| H-B field | 85% | Coil pair | FIELD and EXCITE near full after spindle starts |
| Supply load | 6.5 kW on an 8 kW scale | Betaform amplifier | Full spindle and field, auxiliary stages and high amplifier gain |

`src/game/redlines.ts` owns these numbers. The main rack, east board and wall load meter draw their red sectors from them, while `src/game/overheat.ts` uses the same limits. The nominal supply-load formula can exceed 6.5 kW with existing controls, so this redline is reachable without a new power model. Heater, stability and the xenon gauges no longer receive decorative red sectors.

Heat is a 0–1 stored value for each of the three devices. Above its redline it rises by 0.012 plus 0.035 times the normalised overrun per second; below it falls by 0.025 per second. Visible smoke starts at heat 0.35 and strengthens toward heat 1. Machine smoke contributes to a separate laboratory smoke level that vents at 3% of its current level per second. The ashtray uses the same visual emitter but is explicitly absent from the room-smoke model. The first transition into smoke writes one operator-log entry per device. This is intentionally a first-stage thermal model; it does not yet trigger an alarm, water or ruin.

## Timing and reachability audit

The present heat and ventilation equations are sufficient to smoke, but the fire timing has a narrow interaction with the proposed water failure. With one channel held at its maximum, heat reaches 0.35 after about 7.4 seconds, a proposed ignition level of 0.90 after about 19.1 seconds, room smoke reaches a proposed detector level of 0.25 after about 37.7 seconds, and a 20-second sustained exposure alarms at about 57.7 seconds. If sprinklers start three seconds later, live-water failure follows at about 65.7 seconds. A fire ignited at 19.1 seconds reaches its 45-second limit at about 64.1 seconds, so the fire route is just reachable first. These are numerical integrations of the current model at 0.01-second steps, not yet an in-game playthrough; acceleration, instability trips and frame ordering may shift them.

At a spindle reading of 0.86, ignition takes about 62.8 seconds and the alarm about 92.7 seconds. Water failure then wins unless the operator opens the mains. Thus the fire route is only credible for a severe overrun, whereas lesser overruns chiefly lead to alarm and water. If ignition is forbidden until after the alarm, an energized fire can never last 45 seconds because live sprinkler water ruins the lab after five seconds. The fire timer must be allowed to start before the detector responds. The brief's phrase about catching fire “after the alarm” needs to be treated as dramatic sequence, not a model guard. The fire visual and log should appear at actual ignition.

The detector must watch laboratory smoke only. The corridor detector and the ashtray are scenic for this mission. A single fully smoking device tends toward room smoke 0.5, so a 0.25 detector threshold is reachable. Once the source has stopped, room smoke decays with an approximate 23-second half-life; reset must wait for measured smoke to fall below the same threshold. The actual threshold and ignition level are proposed tuning values requiring a browser playthrough.

## Proposed state contract

Keep one pure incident state separate from `RigState`: detector exposure, alarm latch, sprinkler delay, water active, water-on-live duration, per-device ignition/burning state, total burn duration, puddle wetness, ruined flag, ruin cause and elapsed time since ruin. Advance it once per frame *after* `stepRig`, `stepSafetyTelltales` and `stepOverheat`, using the final mains state and room smoke for that frame. Clamp negative delta to zero, and either substep long frames or consume boundary crossings so a tab resume cannot skip the three-second sprinkler delay or five-second grace period. Emit one-time transition events for logging and sound; renderers read state without deciding rules.

| Input or condition | Transition | Visible and audible result |
| --- | --- | --- |
| Laboratory smoke at or above 0.25 continuously for 20 seconds | Alarm latches; sprinkler countdown starts | Detector LEDs and lab/corridor beacons light, bell starts, east board fault window latches |
| Lab call point pressed | Same alarm transition immediately, even without smoke or rig power | Call-point click and the same alarm presentation |
| Alarm age reaches 3 seconds | Water starts | Existing lab heads spray; hiss, modest puddles and intermittent light flicker begin |
| Device heat reaches 0.90 while energized | That device ignites and burn time starts | Device-local flame/smoke and a single ignition log entry |
| Fire burns for 45 seconds | Ruin by fire | Terminal presentation, final report and control lock |
| Water runs with mains closed for 5 seconds | Ruin by electrical short | Wiring discharge, terminal presentation and control lock |
| Mains open before either limit | Heat cools and live-water timer resets | Operator can wait for smoke to clear, then use corridor reset |
| Corridor reset with smoke below 0.25 and no active fire | Alarm and water clear; detector exposure and sprinkler timer reset | Bell/beacons stop, heads close, puddles dry over about two minutes |
| Corridor reset while smoke is high or fire is active | No state change | Local refusal cue and explanatory log line |

Recommended fire semantics: ignition is one transition per device; while powered, a burning device keeps burning even under water. Once isolated from mains, it extinguishes as its heat cools below 0.90; if the sprinkler is already running it can extinguish immediately. Count cumulative *active burning time during this incident* toward the owner's 45 seconds, and clear that count only on a successful corridor reset. This makes the phrase “45 seconds in total” literal and stops repeated near misses from resetting the danger. Record a deterministic precedence if both ruin limits cross on the same step: electrical short wins if water has been live for five seconds, otherwise fire. A new run begins only through the later UI RESET; neither the rack RESET nor corridor panel can clear a ruined lab.

The alarm is latched until corridor reset, even if smoke later clears. The existing east-board fault window should use its current acknowledge sequence for its own incident state; fire-panel reset is a distinct action. A manual call point during a cold start still starts water after three seconds but cannot cause electrical failure without live mains. Pressing it on a live rig gives roughly eight seconds total to open the mains. The plant-room and corridor lights do not share the lab's power state; the beacon needs its own emergency supply so it remains visible after ruin.

## Integration seams

- `src/scene/ceiling-services.ts` already creates detector LEDs and sprinkler heads but only exposes `update(seconds)`; it needs a lab-only state API for alarm LEDs and head positions/flow. Keep the corridor's decorative service run from becoming a second water source unless explicitly designed.
- `src/rendering/start-scene.ts` owns the frame order, log/teleprinter bridge, input registrations and existing rack RESET. It should own a single `canOperate` guard or shared action gate so every rack, east-board, plant and room control respects ruin, while camera/door movement and the later UI reset still work. Scene callbacks currently mutate several subsystems directly, so guarding only `stepRig` would be insufficient.
- `src/audio/sound-engine.ts` has apparatus and room-aware sound sources but no alarm, sprinkler or fire channel. Add sustained, spatially located signals with explicit start/stop or state-driven gain, and use `src/game/sound-rooms.ts` for propagation through doors. Prevent repeated one-shot alarms each frame.
- `src/scene/lab-room.ts` must expose a forced-dark state independent of its wall switch; after ruin, the switch cannot relight the room. Rack lamps need the same terminal override. The teleprinter's last report must enter its print queue once, before general control lock, then remain visible.
- Place the call point and fire reset as physical, German-labelled scene controls in the lab and corridor respectively. Register their designations in `src/game/machine-parts.ts`, add inspection views, and update `doc/design/control-graph.md` with the causal route and the distinct reset actions.

## Next implementation stages

1. **Detector and alarm state.** Give the pure state model an exposure timer that advances only while room smoke exceeds a chosen detector threshold. Twenty seconds of sustained exposure is the brief's working value. Define what happens when smoke briefly drops below threshold and how a manual call point bypasses detection. Expose explicit events for alarm onset and clearing so log, bell, beacon and teleprinter cannot disagree.
2. **Sprinkler state and recovery.** Start a short fixed delay after alarm onset, then mark wet heads and water active. A corridor reset must reject while room smoke is still above threshold; when accepted it silences the alarm and stops water. Puddles should decay after flow stops. The existing ceiling services provide head locations, but no water or detector-state API yet.
3. **Fire and terminal failure.** Define a separate fire threshold above smoke onset and accumulate 45 seconds of actual burning, not elapsed time since alarm. Independently, accumulate five seconds while sprinklers run and mains remain closed. Opening the mains before either timer completes must preserve recovery. After ruin, centralise input blocking and the on-screen reset so no old switch callback can change the dead rig.
4. **Presentation and audio.** Add a reusable fire plume, detector lamps, red beacons, sprinkler particles, modest puddle decals, wiring discharge, spatial bell/water/crackle and a final teleprinter report. Then test the two loss routes and the recoverable route in the browser.

## Risks and constraints

`stepRig` can trip the mains from instability before an overheated device reaches fire. The full model needs a controlled playthrough that demonstrates at least one reachable sustained-fire route and the manual-call-point short-circuit route. The load limit belongs to the wall supply meter, but the smoking device is the betaform amplifier; the fiction should explain that it is the vulnerable stage on an overloaded supply. The laboratory's newly separate light switch starts off, so fire indicators must remain legible in darkness and the ruined state must force the room lamps off without preventing the beacon from showing. The phase-chamber mission also wants a reset path; its future state should share one reset contract rather than adding a competing button.

## Verification for this slice

Pure tests cover limit positions, supply-load reachability, faster heating with more overrun, cooling, one-time smoke onset and ventilation. The complete redline mission still requires tests for exposure timing, alarm/sprinkler/reset sequencing, fire duration, water-on-live duration and post-ruin input blocking.

## Acceptance scenarios for the remaining mission

1. With a cold rig, press the lab call point. The alarm starts at once, sprinklers start three seconds later, and no ruin occurs while mains stay open. Once smoke is low, corridor reset stops bell and water; puddles then shrink away.
2. With mains closed, press the call point. At three seconds water starts; opening mains before five further seconds avoids ruin. Leaving mains closed causes one electrical-short ruin event, visible wiring discharge and one final printer report.
3. Hold a stable spindle or field above redline. The corresponding device smokes and ignites, the detector alarms only after 20 seconds above threshold, and 45 seconds of cumulative active burning causes fire ruin if it beats the electrical route. This needs a deterministic rig setup and a real browser playthrough because `stepRig` may trip mains first.
4. Momentarily dip room smoke below detector threshold before 20 seconds; exposure restarts. After alarm latches, smoke clearing alone does not silence it. Corridor reset refuses while smoke is high or fire remains active.
5. After either ruin cause, camera movement and doors remain usable, machine and fire-panel controls do nothing, lights stay off except the beacon, and the UI RESET appears after about 20 seconds. UI RESET restores rig, incident state, smoke, wetness, lights' initial off state and audio to a cold run without duplicating input handlers.

The first alarm, sprinkler and ruin implementation now follows this state contract, with pure tests for both terminal routes and the recoverable water route. It is not fully validated until the ignition/water race and terminal reset have been exercised in the running scene. The 0.25 detector level, 0.90 ignition heat and three-second sprinkler delay are tuning defaults; the owner's 20-second exposure, 45-second fire and five-second live-water grace remain fixed.
