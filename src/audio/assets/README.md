# Audio asset record

All authors, original source URLs and licences are recorded centrally in [CREDITS.md](../../../CREDITS.md).

`bbc-model-b-boot.wav` is the source interval 00:03–00:05, mono 22,050 Hz PCM WAV with a 5 ms fade in and 15 ms fade out. It plays once on computer reset, replaces prior boot playback, follows volume/mute and originates at the bench computer.

`cassette-play.mp3`, `cassette-stop.mp3` and `cassette-fast-forward.mp3` are short mono, trimmed and level-adjusted mechanical-key excerpts. The last uses a rewind key as a mechanically similar Fast Forward key press. These key effects are separate from cassette music playback.

`printer-line-1.wav` through `printer-line-5.wav` are distinct 0.70-second excerpts beginning at 0.15, 4.05, 7.10, 11.10 and 16.10 seconds in the credited Star LC-10 recording. Delivery format is mono 22,050 Hz, 16-bit PCM WAV. Each uses a 120 Hz high-pass, 8 kHz low-pass, 8 ms fade in, 15 ms fade out and a matched peak of 0.55. The playback gain is 0.035 before spatial and master-volume attenuation. Shuffled sets use every variant and avoid adjacent repeats; the cue fires at a printed line's start rather than repeatedly every frame. Printing and paper feed stop while idle.

`door-open.wav` is 00:00.05–00:01.15 and `door-close.wav` is 00:30.00–00:30.85 of the credited metal-door recording. Both are mono 22,050 Hz, 16-bit PCM WAV, high-passed at 90 Hz, peak-matched to 0.55, with 8 ms fade in and 20 ms fade out. Door playback gain is 0.03 before the master volume, reduced from 0.2 following the owner's loudness feedback. They are hinge textures, not separate original recordings of the game's doors.

`button-press.wav` is mono 22,050 Hz PCM16, 0.14 seconds, taken from 0.055 seconds into the existing cassette-play excerpt. An 80 Hz high-pass, 4,500 Hz low-pass and 5/10 ms fades isolate the mechanical press; playback gain is 0.07 before spatial/master attenuation. Attribution is in [CREDITS.md](../../../CREDITS.md).

`switch-click.wav` and `rocker-click.wav` are mono 22,050 Hz PCM16 excerpts of the credited StevenBrown rocker recording, 0.15 and 0.20 seconds respectively. All three control recordings are peak-normalised to 0.55. Defaults use gain 0.07 for buttons/switches and 0.08 for rockers, before spatial/master attenuation. Shared control-type defaults apply in both the lab and the development control test.

Rotary detents share the crisp switch recording at gain 0.025; selectors use gain 0.06. Isolators/breakers share the deeper rocker recording at gain 0.12. The defaults are centralised in `control-sound-defaults.ts`; individual mechanical effects such as a valve handwheel, clamp or ram stop retain their own sound definitions.
