# Clear Prop Radio

A radio-call trainer for student pilots flying MSFS with SayIntentions.AI. It shows each call to make, what ATC
will say back, and the exact readback.

## Files
- `index.html`: the entire app in one self-contained file. It holds the airport DB of every US airport (OurAirports),
  the script builder, and the Live panel. No build step and no external JS.
- `airports-world.json`: every non-US medium and large airport (4,363 rows, ~330 KB, ~100 KB gzipped). Loaded
  **lazily** by `loadWorld()` only when a search finds no US match, so the US app stays fast. Same row format as the
  embedded DB, with the ISO country code where US rows have the state.
- `sw.js`: service worker. Cache-first for `airports-world.json`, network-first for the page. Registered only over
  https (GitHub Pages). **Bump `CACHE` in sw.js whenever airports-world.json is rebuilt.**
- `tools/build_airports.py`: rebuilds the data from OurAirports (stdlib only, caches CSVs in `tools/.cache`).
  `python tools/build_airports.py` writes airports-world.json; add `--update-index` to also rewrite the embedded
  `const DB` in index.html. It reproduces the embedded rows 1:1 on identity and names; the only drift is cosmetic.
- `bridge.py`: a local HTTP server on the sim PC, port 8765, using the Python **standard library only**. It polls
  SayIntentions and serves `index.html`, `airports-world.json`, and `sw.js` to the phone on the LAN.
- `tests/`: `node tests/test_ui.js` and `python tests/test_bridge.py`. Run both after any change.

## Two modes (keep both working)
- **Offline**: GitHub Pages at https://alexschrader.github.io/clear-prop-radio/. Here `location.protocol` is `https:`,
  so `LIVE` is false. Nothing live renders: no Live panel, no Mentor toggle, no tappable frequencies.
- **Live**: the page is served by `bridge.py` over `http:`, so `LIVE` is true. It polls `/api/state` every 3 s.

## Airport data layering (apGet)
`rowToAp(row)` builds the base object from the embedded DB (`BY`) or the lazily loaded world map (`BYW`). If the ident
is in neither, `liveAirports[id]` holds an object built purely from SayIntentions by `buildLiveAirport()`. Then
`applyLive(base, {freqs, rwy}, userOverride)` layers, lowest to highest:
**built-in data < SayIntentions live data (`liveFreq`, `liveRwy`) < the user's fixes from the Airports tab (`over`)**.
Every airport object carries `source` ("db" | "world" | "si") and `region` ("US" | "ICAO"). Non-US airports show
the phraseology banner (`ICAO_BANNER`) on the card and above the script; scripts are still US/FAA phrasing.

## Flight plan: one leg or two (build / legs / buildLeg)
`legs(flight)` returns one leg (the original behaviour) or two when a destination `flight.to` is set on a departure
flow (`tdep`/`udep`): leg 0 departs `flight.ap`, then an "En route" step, then leg 1 arrives at `flight.to` as `tarr`
or `uarr` depending on `towered(to)`. The inbound direction is `OPP[dir]` (fly out north, arrive from the south), so
no coordinates are needed. Each step carries `ap` (ident, shown on the LCD) and `leg`; `flight.atis` is an array
indexed by leg, and the ATIS select edits the current step's leg. "Pattern laps" and arrival flows ignore To.
Setup fields: `toAp` (destination object), `t-rwy`, `t-pat`; `toManual` is true once the pilot picked or cleared To by
hand, after which SayIntentions' flight plan no longer overrides it.

## Airports in no list (offline "auto fill")
A search that matches nothing offers "Add XXXX as a new airport" (`looksLikeIdent`, 3-4 alphanumerics). That writes
`custom[XXXX] = {full}` to localStorage `cpr:custom`; `customToAp()` builds a blank airport object (`source:"custom"`),
and everything else (name, frequencies, runways, parking) comes from the Airports tab via `over[id]`, which now has a
`runways` array too. For a custom airport the Airports tab's reset button becomes "Remove this airport".

## Hard rules
- `bridge.py` stays stdlib-only, and `index.html` stays a single self-contained file. The only files it loads are
  `airports-world.json` (lazily) and `sw.js`, and it must work without either (file:// shows "couldn't load").
- The SayIntentions `api_key` comes only from flight.json on the bridge (`session["api_key"]`). It is never accepted
  from the client and never included in `/api/state`. `tests/test_bridge.py` checks this.
- Bridge errors return `{"error": "..."}`, and the UI shows them in a toast.
- Voice generation (`sayAs`) costs SayIntentions money, and they ask for "a few dozen per flight". Keep the cap.

## Bridge endpoints
| Method | Path | Body | Calls |
|---|---|---|---|
| GET | `/` | | serves `index.html` |
| GET | `/api/state` | | returns `{ok, error, flight, comms, wx, paused, mentor:{used,cap}, ai}` |
| POST | `/api/coach` | `{id, atc_said, ...}` | Anthropic Messages API, only when `ANTHROPIC_API_KEY` is set |
| POST | `/api/pause` | `{"value": 1\|0}` | `sapi/setPause?value=` and returns SAPI's JSON; the bridge tracks `paused` |
| POST | `/api/tune` | `{"freq":"121.9","com":1,"mode":"standby"}` | `sapi/setFreq`. Mode defaults to **standby** so the pilot keeps the swap habit. Rejects anything outside 118.000-136.975 |
| POST | `/api/mentor` | `{"message":"...","id":"<comm id>"}` | `sapi/sayAs?channel=INTERCOM1_IN&rephrase=0`. Message capped at 255 chars, max 30 per `flight_id`, duplicate comm ids skipped |

SayIntentions sources: `http://localhost:63287/flightJSON`, then SAPI `getCommsHistory`, `getWX?with_comms=1`,
`setPause`, `setFreq`, and `sayAs`. Docs: https://p2.sayintentions.ai/p2/docs/
The bridge calls `getWX` with `icao=<current>,<destination>` (comma list) so the destination's ATIS, frequencies and
arriving runway come down in the same call; `renderLive` updates `liveFreq`/`liveRwy`/`liveAirports` for both and,
unless `toManual`, auto-fills To from `flight.destination`, switching the flow chip to a departure the first time.
`siRunways(wxa, f, "arr")` picks `preferred_runway_ga_arriving` and never includes `f.runway` (that's the origin's).

### getWX quirks (seen live, 2026-10-05)
- There is **no `active_runway` and no airport name**. Runways come as `active_runways_departing` /
  `active_runways_arriving` (strings like `"17"` or `"5L,5R,14"`, no leading zeros) plus `preferred_runway_ga_departing`
  / `_arriving`. `siRunways()` normalizes to two digits and prefers the GA runway. `getAirport` returned `{}`.
- Comms `type` values are short: `ATIS AWOS CTAF CLR GND TWR APP DEP RDR RDO`. `mapComms()` maps the primaries and
  uses AWOS→atis, RDO/INFO/AFIS→ctaf, RDR→app only as fallbacks. (Before this, `CLR` was missed entirely.)
- Comms `callsign` is the spoken station name (`"RALEIGH"`, `"AMPURIABRAVA"`) or null. `commsName()` uses it as the
  airport name for SI-only airports.

### Weather type and the ATIS letter (seen live at NTTB, 2026-10-07)
Every airport object has `wx`: `"atis"` (A freq, or SI's getWX `atis` text non-empty), `"awos"` (W freq / AWOS comm),
or `"none"`. Only `"atis"` has an information letter. `wxPhrase(ap, letter)` gives "with information X" / "with the
weather" / "" and `buildLeg` uses it on every first-contact call; the weather step and the ATIS select adapt
(`No ATIS letter at NTTB`). The Live panel shows `wxLine()` from getWX (wind, altimeter, QNH from the METAR).
**Never ask for a letter where `wx !== "atis"`.** NTTB (Bora Bora) has a tower and no ATIS at all.

### Neighbouring stations in getWX comms (seen live at NTTB)
SI lists nearby fields under the same `airport`: at NTTB it returned Raiatea TWR 118.5, Maupiti/Huahine AFIS and Tahiti
Control alongside Bora Bora TWR 118.9. `ownComms()`/`mapComms(list, icao, name)` put entries whose callsign shares a
word with the known airport name first, and take fallbacks (AFIS→ctaf) only from own stations; CTR→app is allowed.
So live mode **must know the name**: `renderLive` calls `loadWorld()` for any live ident not in the US DB. Without a
name the first entry still wins (known limitation, tested).

### Taxi clearances (readbackFor)
Taxiway lists are matched case-sensitively (`TWY`: a letter + optional digits, or a phonetic word) so "hold short" and
"cross" are never swallowed; keywords use `ci()`. Handled shapes: "runway X, taxi via …", "taxi to runway X via …",
"runway X via …", "taxi via … to runway X", "taxi to the ramp via …", "hold short of taxiway C", "cross runway 9",
"line up and wait". The live panel parses `incoming_message_english || incoming_message` (SI may speak the local
language). SI's `taxi_path` is lat/lon waypoints for its own ribbon, not taxiway names.

### flight.json quirks (seen live)
- `current_airport` can be a station word: SI reports **"CTAF"** once you're airborne and not talking to a field.
  `liveIcao(f)` ignores anything in `NOT_AIRPORTS` or not 3-4 alphanumerics and falls back to the destination when
  `overall_intention` is arrival, else the origin. The bridge passes `overall_intention`, `on_ground`, `altitude`,
  `aircraft_icao`.
- When SI couldn't hear the pilot it writes notices into the *outgoing* slot ("Mic key held for only 0.1 seconds",
  "No audio captured"). `renderLive` shows those as a mic warning instead of treating them as the pilot's words.
- `callsign` and `callsign_icao` arrive in spoken form, e.g. `Skyhawk-One-Two-Three-Alpha-Zulu`. `parseCallsign()` in
  index.html turns that into `{type:"Skyhawk", tail:"N123AZ"}`. Never copy the raw string into `me.tail`. `siSeedMe()` applies it **once per distinct
  callsign** (remembered in localStorage `cpr:siCallsign`); after that the pilot's choice in the Me tab wins. Before
  this, picking "Cirrus" snapped back to "Skyhawk" on the next poll.
- `flight_id` is at the top level of `flight_details`, not under `current_flight`.
- `current_airport`, `runway`, and the `current_flight` origin and destination can be null or empty before a flight
  plan is filed.

## Live features (done)
- **Pause button**: a large toggle in the Live panel that calls `/api/pause`.
- **Tap-to-tune**: the LCD frequency and the airport card frequencies are tappable in live mode. Tapping one checks
  it is 118.000-136.975, calls `/api/tune` (COM1, standby), and shows the toast "121.9 in COM1 standby, press swap".
- **Mentor mode**: a toggle in the Me tab, off by default, stored in localStorage as `cpr:mentor`. When a new ATC
  call has a non-empty readback, it sends "Read back: <readback>" to `/api/mentor`. The Live panel shows
  "Mentor: n/30 used". Any call already present when the page loads is never spoken.
- `readbackFor()` altitude fix: "at or below 2,500," no longer produces a double comma.
- **Any airport MSFS loads** (done 2026-10-05): live fallback builds the airport from SayIntentions when the ident
  isn't in the DB (badge "from SayIntentions"); SI's runway and frequencies override DB values and the active runway
  is added to the dropdown marked "active now"; the setup card re-picks when SI's runway or frequencies change (not
  once a script has started). Worldwide offline search via `airports-world.json`. Non-US phraseology banner.

## Easier reads (Me tab, localStorage `cpr:reads`, defaults words:on chunks:on big:off)
- **Numbers as words**: `sayNums()` rewrites what the *pilot* says (call lines, readbacks, live readbacks) into spoken
  form: runways via `rwySay`, frequencies "one two one point niner", altitudes via `altWords` (2,500 → "two thousand
  five hundred", 10,000 → "one zero thousand"), squawk/heading digit by digit, "N miles", taxiway lists after
  "via"/"at" → phonetic, "Class C" → "Class Charlie". It is **never** applied to `atc.says` (that's what you hear) or
  to the Mentor `sayAs` message (SI's TTS handles digits; 255-char cap).
- **Chunked readbacks**: `chunks()` splits a readback on commas but keeps "F, E, A" taxiway lists together; `rbHTML()`
  renders 3+ items as `<ol class="rb-list">` with the callsign last (`li.cs`), otherwise a quoted sentence.
- **Cockpit text**: `reads.big` sets `data-big` on `<html>`; CSS bumps sizes/contrast, hides h1/sub/coach tip, and
  `renderStep` folds the "what to do" note into `<details>`. Toggle in Me tab or the "Aa" button in the flight bar.
Tests in tests/test_ui.js cover sayNums (13 cases incl. "the 45" left alone), chunks, and rbHTML escaping.

## readbackFor() test cases (in tests/test_ui.js)
| ATC says | Readback (callsign = Cirrus Three Alpha Zulu) |
|---|---|
| Cleared out of the Class C to the north, maintain at or below 2,500, departure 125.3, squawk 4521. | Cleared out of the Class C, at or below 2,500, departure 125.3, squawk 4521, … |
| Runway 5R, taxi via F, E, A, hold short runway 5R. | Runway 5R, taxi via F, E, A, hold short runway 5R, … |
| Runway 5R, wind 050 at 10, cleared for takeoff. | Cleared for takeoff runway 5R, … |
| Runway 23, cleared to land. | Cleared to land runway 23, … |
| Radar service terminated, squawk VFR, frequency change approved. | Squawk VFR, … |
| Turn left heading 270, climb and maintain 4,500. | Heading 270, climb and maintain 4,500, … |
| Contact tower 118.3. | Tower 118.3, … |
| Radar contact. / Traffic 2 o'clock, 3 miles, a Cessna. | (empty: nothing to read back) |

## Other test cases (tests/test_ui.js)
- Flight plan: no To → one leg; KTTA(udep)→KRDU gives departure steps (leg 0), an en-route step tuning KRDU ATIS, then
  the tower arrival (leg 1) from the south on 05L with the second ATIS letter; KRDU(tdep)→KTTA names "Raleigh Exec" in
  the clearance request and ends with the CTAF clear-of-runway call; pattern laps ignore To.
- Destination runway: `siRunways(..., "arr")` prefers the GA arriving runway, lists arriving runways first, falls back to
  the flight-plan arriving runway, and never includes the origin's `f.runway`.
- Custom airports: `customToAp`, user runways via `applyLive`, `looksLikeIdent("leap")` true / `("heathrow")` false.
- Bridge: `getWX` is requested as `icao=KTTA,KRDU` when the flight plan has a destination.
- (a) live airport not in DB: `buildLiveAirport("LEAP", ...)` from the real LEAP getWX payload → name "Ampuriabrava",
  CTAF 122.4 (from type RDO), runway 17, source "si", region "ICAO".
- (b) SI runway/frequencies override DB (KRDU tower 119.3 → 127.45), user override beats SI, runways merged and
  normalized ("5L" → "05L"), `CLR` mapped, `APP` beats `RDR`.
- (c) worldwide search: EGLL and RJTT by ident and by name ("heathrow", "haneda"); LEAP is *absent* (non-US small_airport), which is what the live fallback is for; no US rows.

## Backlog
- "Read it to me": phone text-to-speech of the call at a slow pace (offered, not chosen yet).
- ICAO phraseology variants of the scripts ("line up and wait", QNH/hPa, "taxi to holding point", conditional
  clearances). Today non-US airports only get the banner.
- Single-airport *arrival* flows (`tarr`/`uarr` chosen on the From airport) still use the departing-runway logic for
  "active now"; only the To leg uses `siRunways(..., "arr")`.
- Service-worker cache versioning is manual (bump `CACHE` in sw.js); automate it from the build tool.
- Port the Live panel into the Clear Prop iOS app. The bridge stays on the PC, and the app polls `/api/state` on
  the LAN.
- Auto-advance the script step from `L:SIAI_FLIGHT_PHASE` and the clearance flags.
- Show the pause state from SayIntentions itself. Today the bridge only knows what it set, so a pause started in the
  sim isn't reflected.
