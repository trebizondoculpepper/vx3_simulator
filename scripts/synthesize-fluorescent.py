"""Re-create the steady tail of the cited fluorescent-ballast recording.

The source tail (3.8–7.0 s) has narrow peaks at 120, 240 and 360 Hz,
with a smaller 258 Hz ballast tone over low broadband room noise.
This renders a quiet, four-second seamless loop using only the stdlib.
"""

from array import array
from math import pi, sin
from pathlib import Path
from random import Random
import wave


RATE = 22050
SECONDS = 4
COUNT = RATE * SECONDS
FADE = int(0.18 * RATE)
DESTINATION = Path(__file__).resolve().parents[1] / "src/audio/assets/fluorescent-room-tone.wav"


def main() -> None:
    random = Random(1977)
    noise = [random.uniform(-1, 1) for _ in range(COUNT)]
    # Join the noise at the loop boundary; the tones already fit exactly.
    for index in range(FADE):
        share = index / FADE
        noise[COUNT - FADE + index] = (
            noise[COUNT - FADE + index] * (1 - share) + noise[index] * share
        )
    smooth = 0.0
    samples = array("h")
    for index, raw in enumerate(noise):
        smooth += 0.08 * (raw - smooth)
        t = index / RATE
        value = (
            0.016 * sin(2 * pi * 60 * t)
            + 0.035 * sin(2 * pi * 120 * t)
            + 0.061 * sin(2 * pi * 240 * t)
            + 0.030 * sin(2 * pi * 360 * t)
            + 0.019 * sin(2 * pi * 258 * t)
            + 0.012 * smooth
            + 0.003 * raw
        )
        samples.append(round(max(-1.0, min(1.0, value)) * 32767))
    with wave.open(str(DESTINATION), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(samples.tobytes())


if __name__ == "__main__":
    main()
