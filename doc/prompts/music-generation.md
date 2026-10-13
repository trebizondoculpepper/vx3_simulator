# Prompt: background music for VX3 Simulator

Paste the brief below into the session that will generate the music. It is self-contained.

---

## Your task

Generate one cassette containing four original instrumental background-music tracks for VX3 Simulator, a browser game whose repository is `/Users/sal/PycharmProjects/vx3_simulator`. Produce actual playable audio files using your available music-generation tools. If audio generation is unavailable, explain that limitation rather than creating silent placeholders or claiming files were generated.

The game takes place in a small East German physics laboratory: heavy 1950s construction, equipment installed in the 1970s, upgraded in the 1980s and abandoned in the 1990s. Its machinery is absurdly advanced but treated with practical, deadpan seriousness. Music will come from a tape player on the workbench and nearby speakers. It should make a long session of exploring and operating the equipment pleasant, with a little unease beneath the warmth. This is one cassette with multiple tracks, not a collection of tapes to swap.

The owner's reference is [Kontakt — 1970s Berlin School Retro / Analog Dreams, by Kosmische Wellen](https://music.youtube.com/watch?v=igFxyLua6kg&list=PLa34565YJPM9goOeItxS5TRGKL3u2Z1Uf). Use the broad Berlin School electronic-music direction as inspiration for original compositions. Do not sample that recording or reproduce its melodies.

## Musical direction

Use warm analogue synths, restrained step sequencing, slow filter movement, organ-like chords and occasional Mellotron-like textures. Keep the arrangement sparse, the bass restrained and the dynamics gentle. Leave room for switches, printer chatter, water drips and machinery warnings. No vocals, spoken words, big drum kits, dramatic drops, victory fanfares or horror stings. Deliver a clean recording: cassette hiss, wow/flutter, room acoustics and speaker filtering can be added by the game later.

Each track should last three to four minutes and form a seamless repeating loop, with subtle variation throughout. Make the final musical phrase return naturally to the opening harmony, rhythm and texture. Avoid leading silence, an introductory build-up, a long fade-out or an obvious ending. Keep all four tracks at comparable perceived loudness: aim for about −20 LUFS integrated and a true peak at or below −3 dBTP. Measure and report the actual values.

## One cassette: four tracks

| File stem         | Title        | Composition prompt                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-nachtschicht` | Nachtschicht | A solitary night shift in a shuttered physics laboratory. Around 60 BPM. A soft eight-step bass sequence beneath warm organ-like chords, with occasional distant Mellotron-style flute tones. Gentle minor-key ambiguity, patient repetition and tiny changes in filter cutoff. Thoughtful, slightly uncanny and comfortable enough to hear for half an hour. Avoid a prominent lead melody. |
| `02-aufheizen`    | Aufheizen    | Old electronics slowly coming to life. Around 68 BPM. Two understated analogue arpeggios, one low and round, one higher and glassy, weave across sustained chords. Sparse soft metallic accents. Brighter harmonics suggest growing warmth while volume and density remain steady. Calm curiosity and careful optimism, with a handmade early-electronic-music character.                    |
| `03-ferrokerne`   | Ferrokerne   | A machine has found its rhythm. Around 78 BPM. Interlocking twelve-step sequences, rounded synth bass, a soft phased string pad and faint electric-piano notes. Slowly opening filters and gentle counterpoint create a quiet sense of progress. Satisfying and hypnotic, with ample breathing room. Keep the groove light.                                                                  |
| `04-zeitfenster`  | Zeitfenster  | Familiar music becomes subtly strange. A slow pulse around 56 BPM with almost free-time upper layers. Long analogue chords, drifting bell-like notes and two sequences that slip out of phase, then realign at the loop boundary. Slight detuning and unresolved harmony suggest altered time. Beautiful, restrained and disquieting, without harsh glitches or abrupt volume changes.       |

These are four tracks on one cassette, in the order above. Treat them as a coherent album with a shared palette and comparable loudness. Each track must remain suitable during routine operation and exploration.

## Required file formats and locations

Save the **game-ready files as MP3, stereo, 44,100 Hz, constant 192 kbit/s**, at these exact repository-relative paths:

- `public/music/01-nachtschicht.mp3`
- `public/music/02-aufheizen.mp3`
- `public/music/03-ferrokerne.mp3`
- `public/music/04-zeitfenster.mp3`

The absolute output directory is `/Users/sal/PycharmProjects/vx3_simulator/public/music/`. Create it if necessary. Vite serves these files at `/music/01-nachtschicht.mp3` and the equivalent URLs for the other tracks. MP3 is the required browser delivery format; see [MDN's audio codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs).

Also retain uncompressed **WAV masters, stereo, 48,000 Hz, 24-bit PCM**, using the same file stems in `/tmp/vx3-bgm-masters/`, for example `/tmp/vx3-bgm-masters/01-nachtschicht.wav`. This is a temporary working directory outside the repository; report its location so the owner can archive the masters. Keep large masters out of `public/` and git. Resampling or increasing bit depth does not improve a generator's source quality; record the original source format honestly.

FFmpeg is installed, including `libmp3lame`. Example delivery encoding, after arranging, looping and levelling the master:

```sh
mkdir -p public/music /tmp/vx3-bgm-masters
ffmpeg -i /tmp/vx3-bgm-masters/01-nachtschicht.wav -vn -ar 44100 -ac 2 -c:a libmp3lame -b:a 192k public/music/01-nachtschicht.mp3
```

## Loop metadata and provenance

Write `public/music/manifest.json` with `schemaVersion: 1`, `title: "Nachtschicht — Laborkassette"` and a `tracks` array in cassette playback order. Each entry must contain `id` (the file stem), `title`, `url` (the `/music/...mp3` URL), `durationSeconds`, `bpm`, `loopStartSeconds`, `loopEndSeconds`, `integratedLufs` and `truePeakDbtp`. Use measured values from the finished audio; do not copy invented numbers into the manifest. If a track is unmetered, use `null` for `bpm`.

Determine loop points from the **decoded MP3**, accounting for encoder padding. Loop offsets are seconds within the decoded audio buffer, as documented for [Web Audio loopStart](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loopStart). Require `0 <= loopStartSeconds < loopEndSeconds <= durationSeconds` and a loop span between 180 and 240 seconds. Listen to at least three repetitions of each encoded loop, including the join: there must be no click, silence, cut-off reverb or sudden change of level, harmony or rhythm. Adjust and re-encode until the join works.

Write `public/music/README.md` listing the tracks, their intended moods, generation tool/model and version if available, generation date, original source format, prompts used, edits made, usage terms provided by the generation service and any required attribution. Record the reference as inspiration, not as an audio source. Include measured loudness, peaks and the loop verification result.

## Completion checks

Verify the four MP3 files with `ffprobe`: stereo, 44,100 Hz, 192 kbit/s, nonempty playable audio and the expected duration. Check browser decoding and listen to the repeated loops. Ensure the manifest filenames and URLs match the actual files. Report any verification you could not perform rather than claiming it passed.

Deliver the audio files and their metadata. In your completion report, list the actual output paths, formats, durations and loop points, plus the master directory and any remaining limitations.
