# Audio asset record

All authors, original source URLs and licences are recorded centrally in [CREDITS.md](../../../CREDITS.md).

`bbc-model-b-boot.wav` is the source interval 00:03–00:05, mono 22,050 Hz PCM WAV with a 5 ms fade in and 15 ms fade out. It plays once on computer reset, replaces prior boot playback, follows volume/mute and originates at the bench computer.

`cassette-play.mp3`, `cassette-stop.mp3` and `cassette-fast-forward.mp3` are short mono, trimmed and level-adjusted mechanical-key excerpts. The last uses a rewind key as a mechanically similar Fast Forward key press. These key effects are separate from cassette music playback.

`printer-line-1.wav` through `printer-line-5.wav` are distinct 0.70-second excerpts beginning at 0.15, 4.05, 7.10, 11.10 and 16.10 seconds in the credited Star LC-10 recording. Delivery format is mono 22,050 Hz, 16-bit PCM WAV. Each uses a 120 Hz high-pass, 8 kHz low-pass, 8 ms fade in, 15 ms fade out and a matched peak of 0.55. The playback gain is 0.035 before spatial and master-volume attenuation. Shuffled sets use every variant and avoid adjacent repeats; the cue fires at a printed line's start rather than repeatedly every frame. Printing and paper feed stop while idle.

`door-open.wav` is 00:00.05–00:01.15 and `door-close.wav` is 00:30.00–00:30.85 of the credited metal-door recording. Both are mono 22,050 Hz, 16-bit PCM WAV, high-passed at 90 Hz, peak-matched to 0.55, with 8 ms fade in and 20 ms fade out. Door playback gain is 0.03 before the master volume, reduced from 0.2 following the owner's loudness feedback. They are hinge textures, not separate original recordings of the game's doors.

`button-press.wav` is mono 22,050 Hz PCM16, 0.14 seconds, taken from 0.055 seconds into the existing cassette-play excerpt. An 80 Hz high-pass, 4,500 Hz low-pass and 5/10 ms fades isolate the mechanical press; playback gain is 0.07 before spatial/master attenuation. Attribution is in [CREDITS.md](../../../CREDITS.md).

`switch-click.wav` and `rocker-click.wav` are mono 22,050 Hz PCM16 excerpts of the credited StevenBrown rocker recording, 0.15 and 0.20 seconds respectively. All three control recordings are peak-normalised to 0.55. Defaults use gain 0.07 for buttons/switches and 0.08 for rockers, before spatial/master attenuation. Shared control-type defaults apply in both the lab and the development control test.

Rotary detents share the crisp switch recording at gain 0.025; selectors use gain 0.06. Isolators/breakers share the deeper rocker recording at gain 0.12. The defaults are centralised in `control-sound-defaults.ts`; individual mechanical effects such as a valve handwheel, clamp or ram stop retain their own sound definitions.

`key-thock.wav` is the second press/release pair from the MattRuthSound mechanical-keyboard recording, filtered and played at 88% source speed during editing, about 0.25 seconds long. Peak 0.55; keycap playback gain 0.09. Source and licence are in CREDITS.md.

`bakelite-heavy-switch.wav` is a 0.42-second excerpt beginning at 1.70 seconds in the owner-supplied Stanwood Studios video. `fluorescent-ballast-start.wav` is a 1.38-second excerpt beginning at 2.17 seconds. Both are mono 22,050 Hz PCM16 WAV with short fades; the startup is raised 18 dB because it is quiet in the source. Their recording credit and source status are in CREDITS.md.

`fluorescent-room-tone.wav` is an original four-second mono 22,050 Hz PCM16 loop rendered by `scripts/synthesize-fluorescent.py`. Analysis of the source video from 3.8 to 7.0 seconds found dominant 120, 240 and 360 Hz components and a smaller 258 Hz tone. The synthesized loop layers those tones with a faint 60 Hz fundamental and quiet shaped noise, and is heard only when the listener's room lights are on. No ambience from the video is sampled into this file.

## German fire PA

`fire-evacuate-de.mp3` (about 10.3 s) and `fire-cancelled-de.mp3` (about 5.8 s) are pre-rendered neural speech, not browser speech synthesis. Both are mono, 44.1 kHz, 128 kb/s MP3. Render again with `uv run scripts/render-fire-announcements.py` (requires FFmpeg); the script pins edge-tts 7.3.1, `de-DE-KatjaNeural`, −8% rate and the exact German text. Generation requires the online voice service; game playback uses only the bundled recordings. Credits are in `CREDITS.md`.

Evacuation: “Achtung. Es wurde ein Brand festgestellt. Bitte verlassen Sie das Gebäude. Dies ist keine Übung.” Cancellation: “Der Brand wurde überprüft. Der Alarm ist aufgehoben.” The evacuation repeats with a 20-second quiet gap after each spoken message; successful cancellation interrupts it and plays the all-clear once after two seconds. A refused panel reset does not announce cancellation. The tonal alarm is ducked during speech, and the master mute/volume controls apply. Reset Simulation stops pending and playing announcements silently.

The PA version uses a 350–3400 Hz band, a +4 dB presence peak at 1.6 kHz, 3:1 compression and tanh soft clipping, followed by faint 45/95/160 ms reflections before final loudness normalisation. It plays from the small corridor speaker above the cable trays, with distance, stereo direction and extra closed-door filtering. Closed doors pass 35% of the PA level before distance attenuation; open doors restore the direct level. The siren is a separate red sounder inside the lab.

Fire timing is siren at alarm onset, sprinklers after 3 seconds, and first evacuation speech after 6 seconds. The red sounder-beacon above the lab door flashes twice per second while the alarm is active (steady with reduced motion). Sprinkler discharge permanently extinguishes the cigarette for the current run.
