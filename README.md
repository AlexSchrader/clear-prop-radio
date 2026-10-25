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

## Easier reads (Me tab)
- **Numbers as words**: "121.9" shows as "one two one point niner", "2,500" as "two thousand five hundred", taxiways
  as "Foxtrot, Echo, Alpha". What ATC says stays in digits, because that's what you hear.
- **Chunked readbacks**: one line per item (runway, taxiways, hold short, callsign) instead of one long sentence.
- **Cockpit text**: bigger, higher-contrast text with the notes folded away. Tap "Aa" during a flight to toggle it.

## Any kind of airport, any kind of flight
- **Same three choices everywhere**: Pattern laps, Depart, Arrive. The script adapts to the field: CTAF self-announce
  calls at a no-tower field; Ground and Tower at a small towered (Class D) field; Clearance, Ground, Tower and
  Departure at a busy (Class B/C) one. A line under the buttons says what radio work to expect.
- **Pattern work at a towered field**: closed traffic, "cleared touch and go", one downwind call per lap.
- **Tower closed** (night or a part-time tower): tick it and the field is flown as CTAF on the tower frequency. In
  live mode the app ticks it for you when SayIntentions runs the field without a tower.
- **Busy airport** checkbox: the app guesses Class B/C vs D from the frequencies; override it if it's wrong.
- **No destination needed**: leave "Landing at" empty, or tap **Coming back here** for a local flight. In the air,
  the flight screen asks "Where will you land?": back to where you started, somewhere else (search any airport), or
  not sure yet. Changing it on the way in is a diversion: the script jumps to the new airport's arrival.
- **Flight following** (on Depart): ask Approach, handoffs, and being handed to your destination (or cancelling it).

## Learn it, not just read it
- **🔊 Read it to me**: the phone reads your call, ATC's line, or the readback out loud, at your speed (Me tab).
  Uses the phone's own voice, so it's free.
- **Practice mode** (flight screen): make each call out loud (or type it). The phone plays ATC's answer, you read
  it back, and both are graded like a real flight. "Hide my lines" blurs the script so you work from memory.
  Works offline, no sim needed.
- **Say again? Unable?**: a card with the exact words for the moments students freeze: say again, unable, wilco vs
  roger, traffic calls, stand by, corrections, progressive taxi, unsure of position, lost comms with the light-gun
  signals, and mayday. Worded for whoever you're talking to right now.
- **Trends** (Debrief tab): what you keep missing across your flights and practice days ("Hold short: missed 3 of
  3 times"), each with a tip and the ladder rung that drills it.

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

## Debrief: how you actually sounded
Live mode grades every transmission you make. Right after a call, the Live panel shows what a controller listens for
and what you missed ("Your readback: 83%. Missing: Hold short"). The **Debrief** tab shows the whole flight: each
call, what ATC had said, your words, a checklist, and a score, plus the top three things to work on. It understands
spoken numbers ("runway five right", "one two one point niner", "two thousand five hundred") so you're graded on
content, not spelling. The last five debriefs are kept on the phone for review without the sim.

## Weather, letters, and taxi routes
- The app only asks for an ATIS letter where the field has ATIS. AWOS fields get "with the weather"; fields with
  neither (many small towered airports outside the US) skip the phrase, and live mode shows SayIntentions' wind,
  altimeter and QNH at the top instead.
- Taxi routes come from what ATC actually says. In live mode the Live panel turns the clearance into a readback list
  ("Runway 11, taxi via Alpha, Bravo, hold short runway 11…"). The taxiways in the practice script are only an example.
- If SayIntentions couldn't hear you (push-to-talk released too early, no microphone audio), the Live panel says so.
  Until SI hears you, ATC says nothing, and there's nothing to read back.

## Live features
These only show up on the phone page served by `bridge.py`. The GitHub Pages copy is the offline trainer.
- **Pause / Resume**: a big button in the Live panel pauses the sim through SayIntentions.
- **Tap-to-tune**: tap any frequency, either the big LCD number or the airport card list. It goes into **COM1
  standby**, and you press swap yourself.
- **Auto** (flight bar, on by default): the script follows the real conversation. A taxi clearance jumps to the taxi
  step, your readback moves you on, a CTAF call moves to the next leg. It only moves forward, at most three steps.
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
