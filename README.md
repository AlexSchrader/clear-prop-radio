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

## Next for Claude Code
- Port the live panel into the Clear Prop iOS app. The bridge stays on the PC, and the app polls `/api/state` on the LAN.
- Auto-advance the script step from `L:SIAI_FLIGHT_PHASE` and the clearance flags.
