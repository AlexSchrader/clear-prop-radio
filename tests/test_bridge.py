"""Run: python tests/test_bridge.py  (mock SayIntentions; checks /api/pause, /api/tune, /api/mentor)"""
import json, sys, threading, time, urllib.request, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import os
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bridge
calls = []
class Mock(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = dict(urllib.parse.parse_qsl(u.query))
        if u.path == "/flightJSON":
            body = {"flight_details": {"api_key": "SECRETKEY", "callsign": "N123AZ", "current_airport": "KTTA",
                    "current_flight": {"flight_id": 777, "flight_origin": "KTTA"}}}
        else:
            calls.append((u.path.rsplit("/",1)[-1], q))
            body = {"comm_history": []} if "getComms" in u.path else {"status": "OK"}
        d = json.dumps(body).encode(); self.send_response(200); self.end_headers(); self.wfile.write(d)
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), Mock); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
bridge.FLIGHT_URL = f"http://127.0.0.1:{port}/flightJSON"; bridge.SAPI = f"http://127.0.0.1:{port}/sapi/"
app = ThreadingHTTPServer(("127.0.0.1", 0), bridge.Handler); ap = app.server_address[1]
threading.Thread(target=app.serve_forever, daemon=True).start()
def post(path, body):
    r = urllib.request.Request(f"http://127.0.0.1:{ap}{path}", data=json.dumps(body).encode(), method="POST")
    return json.loads(urllib.request.urlopen(r).read())
def get(path): return json.loads(urllib.request.urlopen(f"http://127.0.0.1:{ap}{path}").read())
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m)
ok("error" in post("/api/pause", {"value": 1}), "pause before flight.json -> error")
threading.Thread(target=bridge.poll, daemon=True).start(); time.sleep(1.5)
st = get("/api/state")
ok("SECRETKEY" not in json.dumps(st), "api_key never in /api/state")
ok(post("/api/pause", {"value": 1}) == {"status": "OK"} and calls[-1] == ("setPause", {"api_key":"SECRETKEY","value":"1"}), "pause -> setPause value=1 with server key")
ok(get("/api/state")["paused"] is True, "state.paused tracks")
post("/api/pause", {"value": 0}); ok(calls[-1][1]["value"] == "0", "resume -> value=0")
r = post("/api/tune", {"freq": "121.9", "com": 1, "mode": "standby"})
ok(calls[-1] == ("setFreq", {"api_key":"SECRETKEY","freq":"121.900","com":"1","mode":"standby"}), "tune -> setFreq standby")
post("/api/tune", {"freq": "121.9"}); ok(calls[-1][1]["mode"] == "standby", "tune defaults to standby")
n = len(calls)
for f in ["117.95", "137.0", "abc", None, "108.4"]: ok("error" in post("/api/tune", {"freq": f}) , f"tune rejects {f}")
ok(len(calls) == n, "rejected freqs never reach SAPI")
ok("error" not in post("/api/tune", {"freq": "136.975"}) and "error" not in post("/api/tune", {"freq": "118.0"}), "edges 118.0 / 136.975 accepted")
r = post("/api/mentor", {"id": "c1", "message": "Read back: Squawk 4521, Cirrus Three Alpha Zulu."})
ok(r.get("used") == 1 and calls[-1][0] == "sayAs" and calls[-1][1]["channel"] == "INTERCOM1_IN" and calls[-1][1]["rephrase"] == "0", "mentor -> sayAs INTERCOM1_IN rephrase=0")
n = len(calls); r = post("/api/mentor", {"id": "c1", "message": "x"}); ok(r.get("skipped") == "duplicate" and len(calls) == n, "duplicate comm id skipped")
post("/api/mentor", {"id": "long", "message": "A" * 400}); ok(len(calls[-1][1]["message"]) == 255, "message capped at 255")
for i in range(28): post("/api/mentor", {"id": f"x{i}", "message": "hi"})
ok(get("/api/state")["mentor"] == {"used": 30, "cap": 30}, "state shows 30/30")
n = len(calls); r = post("/api/mentor", {"id": "over", "message": "hi"}); ok("error" in r and len(calls) == n, "31st blocked, no SAPI call")
ok("error" in post("/api/mentor", {"id": "e", "message": ""}), "empty message -> error")
