# Nachtschicht — Laborkassette

One cassette of four original instrumental game tracks. This is a fresh optimistic retro-futurist edition, generated after the owner rejected earlier attempts. The latest brief asks for melodic futuristic music about the benefits of technology: clean energy, connection, helpful automation and scientific discovery. Major-key lead-synth hooks, warm keyboard harmonies, rounded bass and bright electronic answering melodies are the shared palette, recalling a 1970s imagined future. The original filenames and cassette manifest title are retained for integration compatibility; track display titles reflect the new concepts. The audio is AI-generated; the musical fit still needs human audition.

## Files and measured loop metadata

Game files are stereo MP3, 44,100 Hz, constant 192 kbit/s. Uncompressed loop masters are stereo 48,000 Hz, 24-bit PCM at `/tmp/vx3-bgm-masters/`, outside this repository. Archive those temporary masters before cleaning `/tmp`. Original generator outputs were stereo 48,000 Hz, 16-bit PCM; increasing delivery bit depth does not add source quality.

| File | Intended mood | Decoded duration (s) | Loop start–end (s) | Loop span (s) | Estimated BPM | LUFS-I | dBTP |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| [01-nachtschicht.mp3](01-nachtschicht.mp3) | Clean energy and a brighter morning | 196.661066 | 0.250000–196.411066 | 196.161066 | 78.303 | -20.24 | -5.42 |
| [02-aufheizen.mp3](02-aufheizen.mp3) | Technology connecting people | 184.774308 | 0.250000–184.524308 | 184.274308 | 83.354 | -20.25 | -6.13 |
| [03-ferrokerne.mp3](03-ferrokerne.mp3) | Helpful machines freeing people’s time | 198.148594 | 0.250000–197.898594 | 197.648594 | 92.285 | -20.25 | -4.58 |
| [04-zeitfenster.mp3](04-zeitfenster.mp3) | Science opening welcoming new horizons | 201.121383 | 0.250000–200.871383 | 200.621383 | 71.777 | -20.26 | -7.18 |

Use the `tracks` array in `manifest.json` as cassette playback order. Loop offsets are measured within decoded MP3 audio, not the padded MP3 container duration. Each encoded file includes 0.25 seconds of wraparound audio before and after the intended loop, supplying codec history across the join. These guards contain music, not silence. Start playback at `loopStartSeconds`; set `AudioBufferSourceNode.loop = true`, `loopStart` and `loopEnd` from the manifest. Playing the entire MP3 repeatedly in a basic file player will also repeat the guards. See [MDN loopStart](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loopStart) and [audio codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs).

BPM values are measured onset/beat estimates from the generated audio, using median beat spacing with a consistency check. They are not copied from the generation requests. `null` means a reliable pulse estimate could not be obtained. The requested pulse and measurement diagnostics are retained in `verification.json`.

## Generation and provenance

Generated locally on 2026-10-12 with ACE-Step 1.5.0, DiT `acestep-v15-turbo`, native MLX backend, installed repository revision `26409c1`. The local API used the cached `acestep-5Hz-lm-1.7B` at startup, with LM thinking/caption rewriting disabled. Every job was text-to-music, batch size one, `[Instrumental]` lyrics, with no source audio or reference-audio conditioning. The server was stopped after each generation batch. No hosted music service was used.

Earlier stylistic references supplied by the owner included Kontakt / Berlin School and: [Tron Scherzo](https://music.youtube.com/watch?v=3cU0f8qCrZo) and [Theme from Tron](https://music.youtube.com/watch?v=CmIu8LT4tjE), credited in their YouTube metadata to Wendy Carlos and the London Philharmonic Orchestra. The final brief supersedes the darker/sparser and orchestral attempts with explicitly optimistic major-key synth music. The references were used only to identify broad period instrumental direction; no recording was downloaded, sampled, fed to the generator or used as a melody guide. Carlos’s own [TRON notes](https://www.wendycarlos.com/%2Btron.html) describe the orchestral/electronic context. All prompts request original themes rather than reproducing those compositions.

The installed checkpoint bundle’s model card declares MIT, and the [ACE-Step software license](https://github.com/ace-step/ACE-Step-1.5/blob/main/LICENSE) is MIT. The software license requires its copyright/license notice when distributing the software or substantial portions of it; this asset folder does not contain the generator. No separate generated-audio license grant or mandatory audio-credit clause was found in the installed documentation. This README provides AI-generation disclosure; the software/model license is not a verification of output originality or a separate license determination for generated music.

## Exact generation prompts

### Morgenstrom

Seed `4101`; requested duration `230` seconds; BPM condition `76`; key condition `C major`.

Original optimistic melodic retro-futuristic synth instrumental, a 1970s vision of technology making life better. A catchy, singable lead-synth tune is the focus from the opening bar. Warm major-key harmonies, graceful eight-bar melodic phrases, rounded analogue bass, bright electronic counter-melodies and gently shimmering pads. Vintage Moog and ARP-style colors with gentle portamento and clear early-electronic timbres. Friendly, hopeful, tuneful space-age music, steady moderate dynamics and a clean recording. Instrumental only, restrained electronic rhythm, a consistent groove, returning melodic themes and natural harmonic resolution suited to a continuous loop. Clean energy giving everyone a brighter morning. A joyful rising lead-synth melody returns as a memorable hook, answered by sparkling high notes over warm major chords. A round, gently pulsing bass line and soft electric-piano harmonies suggest sunlight, reliable power and a comfortable future. Confident optimism and an unmistakable tune, without a dramatic build or big drum kit.

### Fernverbindung

Seed `4102`; requested duration `230` seconds; BPM condition `84`; key condition `G major`.

Original optimistic melodic retro-futuristic synth instrumental, a 1970s vision of technology making life better. A catchy, singable lead-synth tune is the focus from the opening bar. Warm major-key harmonies, graceful eight-bar melodic phrases, rounded analogue bass, bright electronic counter-melodies and gently shimmering pads. Vintage Moog and ARP-style colors with gentle portamento and clear early-electronic timbres. Friendly, hopeful, tuneful space-age music, steady moderate dynamics and a clean recording. Instrumental only, restrained electronic rhythm, a consistent groove, returning melodic themes and natural harmonic resolution suited to a continuous loop. Technology connecting people across distance. Two warm electronic melodies call and answer, then join in a happy, memorable eight-bar theme. Bouncy analogue bass, clear bell-like synth accents and luminous major-seventh chords. Friendly conversation, shared knowledge and delight in discovery. Light, melodic and futuristic in a 1970s way, smooth constant energy and modest percussion.

### Leichte Arbeit

Seed `4103`; requested duration `230` seconds; BPM condition `92`; key condition `D major`.

Original optimistic melodic retro-futuristic synth instrumental, a 1970s vision of technology making life better. A catchy, singable lead-synth tune is the focus from the opening bar. Warm major-key harmonies, graceful eight-bar melodic phrases, rounded analogue bass, bright electronic counter-melodies and gently shimmering pads. Vintage Moog and ARP-style colors with gentle portamento and clear early-electronic timbres. Friendly, hopeful, tuneful space-age music, steady moderate dynamics and a clean recording. Instrumental only, restrained electronic rhythm, a consistent groove, returning melodic themes and natural harmonic resolution suited to a continuous loop. Helpful machines giving people more time to enjoy life. A playful staccato synth hook and a flowing legato answer form a catchy major-key melody. Precise little electronic rhythms, rounded bass and upbeat keyboard chords sound like friendly mechanisms working together. Cheerful ease, inventiveness and human warmth, tuneful retro-futurism with a light groove and no heavy drums.

### Offener Horizont

Seed `4104`; requested duration `230` seconds; BPM condition `72`; key condition `F major`.

Original optimistic melodic retro-futuristic synth instrumental, a 1970s vision of technology making life better. A catchy, singable lead-synth tune is the focus from the opening bar. Warm major-key harmonies, graceful eight-bar melodic phrases, rounded analogue bass, bright electronic counter-melodies and gently shimmering pads. Vintage Moog and ARP-style colors with gentle portamento and clear early-electronic timbres. Friendly, hopeful, tuneful space-age music, steady moderate dynamics and a clean recording. Instrumental only, restrained electronic rhythm, a consistent groove, returning melodic themes and natural harmonic resolution suited to a continuous loop. Science opening new horizons and making tomorrow welcoming. A beautiful, uplifting lead-synth theme rises and gently resolves over bright changing major harmonies. A soft answering melody, shimmering electronic strings and flowing arpeggios add a sense of exploration and possibility. Hopeful, melodic and spacious, with a clear recurring tune and a gentle steady pulse.

## Edits and verification

The generated opening and ending were cut away. Loops were arranged to complete four-bar groups where a steady pulse was detected, with an equal-power four-bar tail-to-head crossfade. DC offsets were removed. Static gain aimed at −20 LUFS while reserving at least −4 dBTP before MP3 encoding. No cassette hiss, wow/flutter, speaker coloration, final fade, or leading silence was added. MP3 loudness/true peaks were measured after encoding with FFmpeg loudnorm analysis.

FFprobe confirmed every delivery file is nonempty MP3, stereo, 44,100 Hz, 192,000 bit/s, and every master is stereo 48,000 Hz PCM 24-bit. Decoded duration/sample counts and loop bounds were checked. All loop spans are between 180 and 240 seconds. Chrome 155 decoded all four MP3s in Web Audio at both 44,100 and 48,000 Hz, matching the measured decoded durations. At each rate, an OfflineAudioContext rendered three complete repetitions per track and checked the joins for nonzero audio and finite signal. Boundary steps were also compared with ordinary sample-to-sample changes. Full numerical evidence is in `verification.json`.

**Human listening verification is outstanding.** No claim is made that three repetitions were audibly monitored or that harmony, phrasing, reverb tails, timbre and aesthetic suitability passed human review. Automated continuity and browser decoding do not replace that listening check. Review three repetitions using the manifest loop points before treating these assets as approved.
