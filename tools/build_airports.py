"""Build the airport data for Clear Prop Radio from OurAirports (public domain).

    python tools/build_airports.py                # writes airports-world.json next to index.html
    python tools/build_airports.py --update-index # also rewrites the embedded `const DB = [...]` in index.html
    python tools/build_airports.py --us-out us.json  # write the US rows to a file (for diffing)

Downloads airports.csv, airport-frequencies.csv and runways.csv into a cache dir (OURAIRPORTS_CACHE or
tools/.cache). Standard library only.

Row format, both files:  [ident, name, municipality, region, "A118.1|T120.5", "01 19 09 27"]
  - US rows (embedded in index.html): region is the state code, e.g. "NC". Every US small/medium/large airport.
  - World rows (airports-world.json): region is the ISO country code, e.g. "GB". Every non-US medium/large airport.
Frequency letters: A ATIS, W AWOS/ASOS, C CTAF, U UNICOM, D clearance, G ground, T tower, P approach, E departure.
"""
import argparse, csv, io, json, os, re, sys, urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://davidmegginson.github.io/ourairports-data/"
CACHE = Path(os.getenv("OURAIRPORTS_CACHE") or ROOT / "tools" / ".cache")
TYPES = {"small_airport", "medium_airport", "large_airport"}
FREQ_LETTER = {"ATIS": "A", "AWOS": "W", "ASOS": "W", "CTAF": "C", "UNIC": "U", "UNICOM": "U", "CLD": "D", "CLNC": "D",
               "GND": "G", "TWR": "T", "APP": "P", "DEP": "E", "A/D": "P"}
ORDER = "PAWDCGTUE"   # same letter order as the embedded US rows
RWY_ID = re.compile(r"^\d{1,2}[LRCWH]?$")   # numbered runways only, no "E"/"W"/"N" grass idents


def fetch(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / name
    if not p.exists():
        print(f"  downloading {name}...", file=sys.stderr)
        with urllib.request.urlopen(BASE + name, timeout=120) as r:
            p.write_bytes(r.read())
    return csv.DictReader(io.StringIO(p.read_text(encoding="utf-8")))


def fmt_freq(mhz):
    try:
        f = float(mhz)
    except ValueError:
        return ""
    if not 108 <= f <= 137:
        return ""
    s = f"{f:.3f}".rstrip("0").rstrip(".")
    return s


def build():
    freqs = defaultdict(dict)        # ident -> {letter: freq}
    for r in fetch("airport-frequencies.csv"):
        letters = FREQ_LETTER.get(r["type"].strip().upper())
        f = fmt_freq(r["frequency_mhz"])
        if not letters or not f:
            continue
        for L in letters:
            freqs[r["airport_ident"]].setdefault(L, f)
    runways = defaultdict(list)
    for r in fetch("runways.csv"):
        if r["closed"] == "1":
            continue
        ends = [x.strip().upper() for x in (r["le_ident"], r["he_ident"]) if RWY_ID.match(x.strip())]
        pair = " ".join(ends)
        if pair and pair not in runways[r["airport_ident"]]:
            runways[r["airport_ident"]].append(pair)
    us, world = [], []
    for a in fetch("airports.csv"):
        if a["type"] not in TYPES:
            continue
        ident, country = a["ident"], a["iso_country"]
        if country != "US" and a["type"] == "small_airport":
            continue
        fq = "|".join(L + freqs[ident][L] for L in ORDER if L in freqs[ident])
        region = a["iso_region"].split("-", 1)[-1] if country == "US" else country
        row = [ident, a["name"], a["municipality"], region, fq, " ".join(runways[ident])]
        (us if country == "US" else world).append(row)
    us.sort(key=lambda r: r[0]); world.sort(key=lambda r: r[0])
    return us, world


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--update-index", action="store_true", help="rewrite const DB in index.html with the US rows")
    ap.add_argument("--us-out", help="write US rows to this JSON file")
    ap.add_argument("--world-out", default=str(ROOT / "airports-world.json"))
    args = ap.parse_args()
    us, world = build()
    dump = lambda rows: json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    Path(args.world_out).write_text(dump(world), encoding="utf-8", newline="\n")
    print(f"world: {len(world)} airports, {os.path.getsize(args.world_out)/1024:.0f} KB -> {args.world_out}")
    if args.us_out:
        Path(args.us_out).write_text(dump(us), encoding="utf-8", newline="\n")
        print(f"us: {len(us)} airports -> {args.us_out}")
    if args.update_index:
        p = ROOT / "index.html"
        s = p.read_text(encoding="utf-8")
        new, n = re.subn(r"const DB = \[\[.*?\]\];", lambda m: "const DB = " + dump(us) + ";", s, count=1, flags=re.S)
        if n != 1:
            sys.exit("could not find `const DB = [...]` in index.html")
        p.write_text(new, encoding="utf-8", newline="\n")
        print(f"index.html: embedded {len(us)} US airports")


if __name__ == "__main__":
    main()
