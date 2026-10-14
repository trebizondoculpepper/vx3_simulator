# Sound audit — 13 October 2026

The new ferrocore column had the largest gaps: its model-driven audio existed in the developer room, but the laboratory only played generic control clicks and the older drive's sounds. The lab now connects the same column voice and mechanics to the shared audio context, master volume and room/spatial mix.

| Event or state | Previous coverage | Result |
| --- | --- | --- |
| Column head raising/lowering | Mechanical sound only in dev | Hydraulic pump/whine follows actual head motion in the lab. |
| Head reaches its stop | Silent in lab | One end-stop thud when motion finishes. |
| Clamp opens/closes | Generic button click | Mechanical clamp snap on an actual model change. |
| Sealed chamber purges | Generic purge button sound | Continuous hiss follows outlet state and chamber pressure. |
| Core warms, activates and spins | Dedicated voice only in dev | Temperature-dependent FM voice, spin sweep/ticks and full-power pulse in the lab. |
| Core burnout / flux-inductance failure | Dedicated effects only in dev | Distinct burnout or collapsing voice on each new failure; no replay when audio first unlocks. |
| Recirculator runs/stops | Switch click only | Quiet fan/pump tone and filtered airflow follow working state. |
| Lab/plant door and cage swing | Switch-like relay/selector sounds | Edited recordings of metal-door hinges. |
| Printer starts a line | Repeated synthetic bursts | Five quiet real dot-matrix excerpts, shuffled without immediate repeats; one cue per printed line. |
| Cassette Play / Stop / Fast Forward | Keys and reels only | The four generated tracks play, pause and advance audibly at 5× speed / quarter gain. |

The printer accepts model-changing operator actions only. Room fittings, refused controls, end stops and automatic status reports do not feed the printer, and idle paper no longer advances. Its recordings remain inaudible outside the lab. Water drips remain silent following the owner's earlier request to quiet the lab.

New recorded sources are Priwo's real 1980s Star LC-10 printer and Joseph Sardin's metal-door recording. Source URLs, author links, stated licences and edit details are in [CREDITS.md](../../CREDITS.md); the [asset record](../../src/audio/assets/README.md) gives exact excerpt offsets and encoding. No stock recording is passed off as the fictional ferrocore: its voice remains an original patch driven by its model.

The development CONTROL TEST board and lab use the same default recordings: key-style push-button press, crisp switch click and deeper rocker click. The inspection link `?room=dev2&view=controls` faces the test board, which now stands in dev2; enable its Sound button before working the controls. Freely licensed sources are recorded in CREDITS.md; commercial alternatives researched were Sonner Sound Buttons and Switches, Pro Sound Effects Buttons & Switches and Arch Post Audio Switches & Buttons.
