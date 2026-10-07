# Clear Prop Radio - Live

Your phone shows what ATC just said and **exactly what to read back**, pulled live from SayIntentions.

## One-time setup (Windows PC that runs the sim)
1. Install Python from python.org. During install, tick **"Add python.exe to PATH"**.
2. Put `bridge.py` and `index.html` in the same folder, e.g. `C:\ClearProp`.

## Every flight
1. Open SayIntentions and start your flight in MSFS.
2. In that folder, click the address bar, type `cmd`, and press Enter. Then run:
   ```
   python bridge.py
   ```
3. It prints an address like `http://192.168.1.23:8765`. Open that on your phone (same Wi-Fi).
4. If Windows Firewall pops up, allow **Private networks**.

## Fly a whole trip
Pick **From**, choose Depart, then pick **To**. The script runs the departure, an en-route step that tunes the
destination's weather, then the arrival there (tower or CTAF, picked automatically), with the radio display switching
to the destination's frequencies and its own ATIS letter. In live mode the destination comes straight from your
SayIntentions flight plan, with its active arriving runway preselected.

## Any airport, anywhere
- **Every US airport** is built in. Search by code, name, or city.
- **Worldwide**: if nothing in the US matches, the app fetches a worldwide list of medium and large airports
  (about 330 KB, once) and searches that. EGLL, RJTT, LFPG all work. On GitHub Pages it's cached for offline use.
- **Live mode works at any field MSFS loads**, even ones in no list. The airport card is then built from
  SayIntentions' own data (name, frequencies, active runway) and marked "from SayIntentions".
- In live mode, SayIntentions' active runway and frequencies always win over the built-in data, and your own fixes
  from the Airports tab win over both.
- If a search finds nothing at all, you can **add the airport yourself** with one tap, then fill in its frequencies,
  runways and spoken name on the Airports tab. The app remembers it.
- Outside the US you'll see a banner: phraseology differs (e.g. "line up and wait", QNH in hPa). The scripts still
  use US/FAA phrasing for now.

To rebuild the data from OurAirports: `python tools/build_airports.py` (add `--update-index` to refresh the US list
embedded in index.html).

## Live features
These only show up on the phone page served by `bridge.py`. The GitHub Pages copy is the offline trainer.
- **Pause / Resume**: a big button in the Live panel pauses the sim through SayIntentions.
- **Tap-to-tune**: tap any frequency, either the big LCD number or the airport card list. It goes into **COM1
  standby**, and you press swap yourself.
- **Mentor mode** (Me tab, off by default): after each ATC call, your co-pilot says the readback over the intercom
  so you can repeat it. It runs up to 30 times per flight, and the Live panel shows "Mentor: 12/30 used".

## Optional: AI coach
This adds "what it means" plus a teaching tip to each ATC call.
```
set ANTHROPIC_API_KEY=sk-ant-...
python bridge.py
```

## What it uses
All of these are documented by SayIntentions (p2.sayintentions.ai/p2/docs):
- `http://localhost:63287/flightJSON`: callsign, airport, runway, clearances, API key
- SAPI `getCommsHistory`: every ATC and pilot transmission
- SAPI `getWX?with_comms=1`: ATIS, active runway, and SayIntentions' own frequencies
- SAPI `setPause`, `setFreq`, and `sayAs` (channel `INTERCOM1_IN`): Pause, Tap-to-tune, and Mentor

## Tests
```
node tests/test_ui.js
python tests/test_bridge.py
```
See CLAUDE.md for the endpoints and the backlog.
