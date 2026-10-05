# Clear Prop Radio

A radio-call trainer for student pilots flying MSFS with SayIntentions.AI. It shows each call to make, what ATC
will say back, and the exact readback.

## Files
- `index.html`: the entire app in one self-contained file. It holds the airport DB of every US airport (OurAirports),
  the script builder, and the Live panel. No build step and no external JS.
- `bridge.py`: a local HTTP server on the sim PC, port 8765, using the Python **standard library only**. It polls
  SayIntentions and serves `index.html` to the phone on the LAN.
- `tests/`: `node tests/test_ui.js` and `python tests/test_bridge.py`. Run both after any change.

## Two modes (keep both working)
- **Offline**: GitHub Pages at https://alexschrader.github.io/clear-prop-radio/. Here `location.protocol` is `https:`,
  so `LIVE` is false. Nothing live renders: no Live panel, no Mentor toggle, no tappable frequencies.
- **Live**: the page is served by `bridge.py` over `http:`, so `LIVE` is true. It polls `/api/state` every 3 s.

## Hard rules
- `bridge.py` stays stdlib-only, and `index.html` stays a single self-contained file.
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

### flight.json quirks (seen live)
- `callsign` and `callsign_icao` arrive in spoken form, e.g. `Skyhawk-One-Two-Three-Alpha-Zulu`. `parseCallsign()` in
  index.html turns that into `{type:"Skyhawk", tail:"N123AZ"}`. Never copy the raw string into `me.tail`.
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

## Backlog
- Port the Live panel into the Clear Prop iOS app. The bridge stays on the PC, and the app polls `/api/state` on
  the LAN.
- Auto-advance the script step from `L:SIAI_FLIGHT_PHASE` and the clearance flags.
- Show the pause state from SayIntentions itself. Today the bridge only knows what it set, so a pause started in the
  sim isn't reflected.
