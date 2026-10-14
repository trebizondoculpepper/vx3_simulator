# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts==7.3.1"]
# ///
"""Re-render the German PA assets: uv run scripts/render-fire-announcements.py."""
import asyncio
from pathlib import Path
import subprocess
import tempfile

import edge_tts

LINES = {
    "fire-evacuate-de": "Achtung. Es wurde ein Brand festgestellt. Bitte verlassen Sie das Gebäude. Dies ist keine Übung.",
    "fire-cancelled-de": "Der Brand wurde überprüft. Der Alarm ist aufgehoben.",
}
ASSETS = Path(__file__).resolve().parents[1] / "src/audio/assets"


async def main():
    with tempfile.TemporaryDirectory(prefix="vx3-pa-") as temporary:
        for name, text in LINES.items():
            raw = Path(temporary) / f"{name}.mp3"
            await edge_tts.Communicate(text, "de-DE-KatjaNeural", rate="-8%").save(str(raw))
            subprocess.run([
                "ffmpeg", "-y", "-i", str(raw), "-af",
                "highpass=f=350,lowpass=f=3400,equalizer=f=1600:t=q:w=1:g=4,acompressor=threshold=0.09:ratio=3:attack=5:release=80:makeup=2,asoftclip=type=tanh:threshold=0.75:output=0.9,aecho=0.8:0.9:45|95|160:0.2|0.11|0.06,loudnorm=I=-19:TP=-3:LRA=7,afade=t=in:d=0.02",
                "-ac", "1", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k",
                str(ASSETS / f"{name}.mp3"),
            ], check=True)


if __name__ == "__main__":
    asyncio.run(main())
