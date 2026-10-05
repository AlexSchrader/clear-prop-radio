"""Clear Prop Radio - Live bridge.

Run this on the PC that runs SayIntentions.AI:
    python bridge.py
Then open the printed address on your phone (same Wi-Fi).

Reads (all documented by SayIntentions):
  - flight.json      http://localhost:63287/flightJSON   (callsign, airport, runway, clearances, api_key)
  - getCommsHistory  https://apipri.sayintentions.ai/sapi/getCommsHistory
  - getWX            https://apipri.sayintentions.ai/sapi/getWX?with_comms=1   (ATIS, active runway, frequencies)
Optional AI coaching: set ANTHROPIC_API_KEY before running.
Standard library only - no pip install needed.
"""
import json, os, socket, threading, time, urllib.parse, urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

PORT = 8765
FLIGHT_URL = "http://localhost:63287/flightJSON"
SAPI = "https://apipri.sayintentions.ai/sapi/"
APP = Path(__file__).with_name("index.html")
AI_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL = os.getenv("COACH_MODEL", "claude-haiku-4-5-20251001")

state = {"ok": False, "error": "Starting...", "flight": {}, "comms": [], "wx": {}, "updated": 0}
lock = threading.Lock()
coach_cache = {}


def get_json(url, timeout=6):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8") or "{}")


def sapi(endpoint, **params):
    return get_json(SAPI + endpoint + "?" + urllib.parse.urlencode(params))


def poll():
    wx_at, wx_icao = 0, ""
    while True:
        try:
            raw = get_json(FLIGHT_URL, timeout=3)
            fd = raw.get("flight_details") or {}
            if not fd:
                with lock:
                    state.update(ok=False, error="SayIntentions is running but no flight is active yet.")
                time.sleep(3); continue
            key = fd.get("api_key", "")
            cf = fd.get("current_flight") or {}
            flight = {k: fd.get(k) for k in ("callsign", "callsign_icao", "current_airport", "runway",
                                             "pattern_direction", "cleared_for_takeoff", "cleared_for_landing",
                                             "distance_to_runway")}
            flight.update(origin=cf.get("flight_origin"), destination=cf.get("flight_destination"),
                          dep_runway=cf.get("flight_plan_departing_runway"),
                          arr_runway=cf.get("flight_plan_arriving_runway"))
            comms = []
            try:
                comms = (sapi("getCommsHistory", api_key=key).get("comm_history") or [])[-30:]
            except Exception as e:
                print("[comms]", e)
            icao = flight.get("current_airport") or flight.get("origin") or ""
            wx = state.get("wx", {})
            if icao and (icao != wx_icao or time.time() - wx_at > 120):
                try:
                    wx = sapi("getWX", api_key=key, icao=icao, with_comms=1); wx_at, wx_icao = time.time(), icao
                except Exception as e:
                    print("[wx]", e)
            with lock:
                state.update(ok=True, error="", flight=flight, comms=comms, wx=wx, updated=time.time())
        except Exception as e:
            with lock:
                state.update(ok=False, error="Can't reach SayIntentions on this PC. Is the SayIntentions app open?")
            print("[flight.json]", e)
        time.sleep(4)


def coach(payload):
    """Optional: ask Claude to explain an ATC call and give the readback."""
    if not AI_KEY:
        return {"error": "no_ai"}
    ck = payload.get("id")
    if ck in coach_cache:
        return coach_cache[ck]
    system = ("You are a patient CFI coaching a beginner student pilot live in a flight sim, using real FAA phraseology. "
              "Reply with ONLY JSON: {\"meaning\": plain English max 18 words, \"readback\": exact words to say back "
              "(empty if none needed), \"tip\": one short teaching point max 16 words}. Readbacks include runways, "
              "altitudes, headings, squawks, frequencies, hold shorts, and end with the abbreviated callsign.")
    body = json.dumps({"model": AI_MODEL, "max_tokens": 300, "system": system,
                       "messages": [{"role": "user", "content": json.dumps(payload)}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
        "x-api-key": AI_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
        text = text.replace("```json", "").replace("```", "").strip()
        out = json.loads(text)
        coach_cache[ck] = out
        return out
    except Exception as e:
        return {"error": str(e)}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            return self._send(200, APP.read_bytes(), "text/html; charset=utf-8")
        if self.path.startswith("/api/state"):
            with lock:
                return self._send(200, {**state, "ai": bool(AI_KEY)})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path.startswith("/api/coach"):
            n = int(self.headers.get("Content-Length", 0))
            return self._send(200, coach(json.loads(self.rfile.read(n) or b"{}")))
        self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80)); return s.getsockname()[0]
    except Exception:
        return "localhost"
    finally:
        s.close()


if __name__ == "__main__":
    threading.Thread(target=poll, daemon=True).start()
    print("\n  Clear Prop Radio - Live")
    print(f"  On your phone (same Wi-Fi), open:  http://{lan_ip()}:{PORT}")
    print(f"  AI coaching: {'ON' if AI_KEY else 'off (set ANTHROPIC_API_KEY to enable)'}\n")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
