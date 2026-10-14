"""Download German safety signage from Wikimedia Commons with licence metadata."""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

OUT = Path(sys.argv[1])
UA = {"User-Agent": "vx3-simulator-research/1.0 (salimfadhley@gmail.com)"}
API = "https://commons.wikimedia.org/w/api.php"

def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:
            print("  retry", e, file=sys.stderr); time.sleep(5 * (i + 1))
    raise RuntimeError(url)

def api(**p):
    p.update(format="json")
    time.sleep(1)
    return json.loads(get(API + "?" + urllib.parse.urlencode(p)))

def find(prefix):
    """First File: title starting with prefix (case-sensitive), preferring .svg."""
    r = api(action="query", list="allpages", apnamespace=6, apprefix=prefix, aplimit=20)
    titles = [p["title"] for p in r["query"]["allpages"]]
    titles.sort(key=lambda t: (not t.endswith(".svg"), len(t)))
    return titles[0] if titles else None

ISO = {
 "E001": "emergency-exit-left", "E002": "emergency-exit-right", "E003": "first-aid", "E004": "emergency-telephone",
 "E007": "assembly-point", "E009": "doctor", "E010": "defibrillator", "E011": "eyewash", "E012": "safety-shower", "E013": "stretcher",
 "F001": "fire-extinguisher", "F002": "fire-hose", "F005": "fire-alarm-call-point", "F006": "fire-emergency-telephone",
 "W001": "general-warning", "W002": "explosive", "W003": "radioactive", "W004": "laser", "W005": "non-ionising-radiation",
 "W006": "magnetic-field", "W009": "biohazard", "W010": "low-temperature", "W011": "slippery-floor", "W012": "electricity",
 "W016": "toxic", "W017": "hot-surface", "W021": "flammable", "W023": "corrosive", "W026": "battery-charging", "W028": "oxidising",
 "W029": "gas-cylinders", "W041": "asphyxiating-atmosphere",
 "M001": "general-mandatory", "M002": "read-instructions", "M003": "ear-protection", "M004": "eye-protection", "M008": "safety-footwear",
 "M009": "gloves", "M010": "protective-clothing", "M013": "face-shield", "M016": "mask", "M021": "disconnect-before-maintenance",
 "P001": "general-prohibition", "P002": "no-smoking", "P003": "no-open-flame", "P004": "no-thoroughfare", "P007": "no-pacemakers",
 "P008": "no-metal-articles", "P010": "do-not-touch", "P011": "no-water-extinguishing", "P013": "no-mobile-phones",
 "P014": "no-metal-implants", "P022": "no-eating-drinking",
}
GHS = {f"GHS-pictogram-{n}.svg": n for n in ["explos", "flamme", "rondflam", "bottle", "acid", "skull", "exclam", "silhouette", "pollu"]}

PICKS = {  # folder: [exact Commons titles]
 "gdr-tgl-30817": [],  # filled from category
 "posters": [
  "File:Brandklassen.jpg", "File:Flucht- und Rettungsplan DIN ISO 23601 Muster.png",
  "File:Muster Flucht- und Rettungsplan nach DIN ISO 23601.png", "File:Muster eines Flucht- und Rettungsplans.PNG",
  "File:Brandschutzordnung - 01.jpg", "File:Brandschutzordnung - 02.jpg", "File:Brandschutzordnung (Dez 25).jpg",
  "File:Fluchtwegzeichen.svg", "File:DDR Exit Sign.png", "File:DDR Fire Safety - Fire Extinguisher.svg",
  "File:Handmelder Hausalarm.png", "File:Handmelder CO2 Stop.png", "File:Handmelder Türentriegelung.png",
  "File:FW077 Gashaupthahn.png", "File:Schild BMZ.png", "File:Zeichen 358 - Erste Hilfe, StVO 1970.svg",
 ],
 "photos": [
  "File:Flucht-und Rettungsplan MHM DD.jpg", "File:Feuermelder, Defibrillator und Fluchtplan im Brauhaus Distelhausen.jpg",
  "File:Hausalarm blau Druckknopfmelder 2019-11-27.jpg", "File:Schild Feuerlöscher 01 (Dez 25).jpg",
  "File:Schild Hochspannung Lebensgefahr.jpg", "File:Hochspannung, Vorsicht Lebensgefahr, Warnschild.jpg",
  "File:Achtung Blitzspannung Schild.jpg", "File:Augendusche DSCF3127.jpg", "File:Emergency Shower and Eye Wash Station.jpg",
"File:Fluchtwegzeichen.JPG", "File:Beleuchteter Hinweis auf Fluchtweg.JPG",
  "File:Notausgang - 01.jpg", "File:Goerlitz Landskronbrauerei DRK Schild.jpg",
  "File:DDR, Ringkolonnaden Marzahn, südlicher Teil, kurz vor Abriss, DSC01395, Kaufhausbereich, Innen, Pförtnerkabine, Gebäudeplan - Fluchtplan 1.Geschoss.jpg",
 ],
}

def slug(s):
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue").replace("ß", "ss")
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()[:90]

def plain(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()

rows = []
def fetch(title, folder, name):
    r = api(action="query", titles=title, prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth=1600)
    page = next(iter(r["query"]["pages"].values()))
    if "imageinfo" not in page:
        print("MISSING", title); return
    ii = page["imageinfo"][0]; md = ii["extmetadata"]
    ext = Path(urllib.parse.urlparse(ii["url"]).path).suffix.lower()
    d = OUT / folder; d.mkdir(parents=True, exist_ok=True)
    (d / f"{name}{ext}").write_bytes(get(ii["url"]))
    if ext == ".svg" or ii.get("width", 0) > 2400:
        (d / f"{name}.png").write_bytes(get(ii["thumburl"]))
    lic = md.get("LicenseShortName", {}).get("value", "?")
    rows.append((folder, name + ext, title, plain(md.get("Artist", {}).get("value"))[:80], lic, ii["descriptionurl"]))
    print("ok", folder, name, lic)

for code, name in ISO.items():
    t = find(f"ISO 7010 {code}")
    if t: fetch(t, "iso-7010", f"{code}-{name}")
    else: print("NOT FOUND", code)
for t, n in GHS.items():
    fetch("File:" + t, "ghs", f"ghs-{n}")
cat = api(action="query", list="categorymembers", cmtitle="Category:TGL 30817 1986 Safety Signs", cmlimit=200, cmtype="file")
for m in cat["query"]["categorymembers"]:
    t = m["title"]
    if t.endswith(".svg"):
        fetch(t, "gdr-tgl-30817", slug(t[5:-4]))
for folder, titles in PICKS.items():
    for t in titles:
        fetch(t, folder, slug(Path(t[5:]).stem))
(OUT / "sources.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
