// Run: node tests/test_ui.js   (readbackFor, validFreq, parseCallsign, page script syntax)
const fs = require("fs"), path = require("path"), vm = require("vm");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"),"utf8");
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
new vm.Script(js); // page script must parse
const grab = name => { const i = js.indexOf("function "+name+"("); let d=0, j=js.indexOf("{", i);
  for(let k=j;;k++){ if(js[k]=="{")d++; if(js[k]=="}"&&--d==0) return js.slice(i,k+1); } };
const vf = js.match(/const validFreq = [^\n]+/)[0];
const shortCS = () => "Cirrus Three Alpha Zulu";
eval(grab("readbackFor")); eval(vf.replace("const ","var "));
let fails = 0; const eq = (a,b,m)=>{ const p = a===b; if(!p) fails++; console.log((p?"PASS ":"FAIL ")+m+(p?"":`\n   got: ${a}\n  want: ${b}`)); };
const C = ", Cirrus Three Alpha Zulu.";
eq(readbackFor("Cleared out of the Class C to the north, maintain at or below 2,500, departure 125.3, squawk 4521."),
   "Cleared out of the Class C, at or below 2,500, departure 125.3, squawk 4521"+C, "clearance");
eq(readbackFor("Runway 5R, taxi via F, E, A, hold short runway 5R."), "Runway 5R, taxi via F, E, A, hold short runway 5R"+C, "taxi + hold short");
eq(readbackFor("Runway 5R, wind 050 at 10, cleared for takeoff."), "Cleared for takeoff runway 5R"+C, "takeoff");
eq(readbackFor("Runway 23, cleared to land."), "Cleared to land runway 23"+C, "landing");
eq(readbackFor("Radar service terminated, squawk VFR, frequency change approved."), "Squawk VFR"+C, "radar terminated");
eq(readbackFor("Turn left heading 270, climb and maintain 4,500."), "Heading 270, climb and maintain 4,500"+C, "heading + climb");
eq(readbackFor("Radar contact."), "", "radar contact -> nothing");
eq(readbackFor("Traffic 2 o'clock, 3 miles, a Cessna."), "", "traffic advisory -> nothing");
eq(readbackFor("Contact tower 118.3."), "Tower 118.3"+C, "freq change");
for (const [f,w] of [["121.9",true],["118.0",true],["136.975",true],["117.95",false],["137",false],["108.4",false],["abc",false],["",false]])
  eq(validFreq(f), w, `validFreq(${JSON.stringify(f)})`);
eval(js.match(/const PHON = [^\n]+/)[0].replace("const ","var ")); eval(js.match(/const NUM = [^\n]+/)[0].replace("const ","var "));
var $ = () => ({options:["Cirrus","Diamond","Cessna","Skyhawk","Piper"].map(value=>({value}))});
eval(grab("parseCallsign"));
const pc = x => JSON.stringify(parseCallsign(x));
eq(pc("Skyhawk-One-Two-Three-Alpha-Zulu"), '{"tail":"N123AZ","type":"Skyhawk"}', "spoken SI callsign");
eq(pc("Cirrus November Four Five Six Kilo"), '{"tail":"N456K","type":"Cirrus"}', "with November");
eq(pc("Bonanza-Niner-Eight-Two"), '{"tail":"N982","type":""}', "unknown type keeps user's");
eq(pc("N123AZ"), '{"tail":"N123AZ","type":""}', "plain N-number");
eq(pc("123AZ"), '{"tail":"N123AZ","type":""}', "no N prefix");
eq(pc("American 123"), "null", "airline callsign ignored");
eq(pc(""), "null", "empty");

// ---- worldwide / live airport tests ----
var BY = new Map([["KRDU",1],["KTTA",1],["7A4",1]]);                    // stand-in for the embedded DB
eval(js.match(/const regionFromIdent = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const normRwy = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const COMM_TYPES = [\s\S]*?\};\n/)[0].replace("const ","var "));
eval(js.match(/const COMM_FALLBACK = [^\n]+/)[0].replace("const ","var "));
var KNOWN = {};
// direct eval at top level so the declarations land in this scope
eval(grab("spoken"));
eval(grab("rowToAp"));
eval(grab("applyLive"));
eval(grab("searchRows"));
eval(grab("mapComms"));
eval(grab("commsName"));
eval(grab("siRunways"));
eval(grab("buildLiveAirport"));

// (a) live airport not in DB: what SayIntentions reported at LEAP, verbatim
const wxLEAP = {airports:[{airport:"LEAP", active_runways_departing:"17", active_runways_arriving:"17", preferred_runway_ga_departing:"17", atis:""}],
  comms:[{freq:"122.4", type:"RDO", callsign:"AMPURIABRAVA", airport:"LEAP"}, {freq:"121.9", type:"GND", callsign:"RALEIGH", airport:"KRDU"}]};
const leap = buildLiveAirport("LEAP", {runway:"17", callsign:"Skyhawk-One-Two-Three-Alpha-Zulu"}, wxLEAP);
eq(leap.id, "LEAP", "(a) live airport id");
eq(leap.name, "Ampuriabrava", "(a) name from SI comms callsign");
eq(leap.ctaf, "122.4", "(a) RDO frequency becomes CTAF");
eq(leap.twr, "", "(a) KRDU comms not mixed in");
eq(JSON.stringify(leap.runways), '["17"]', "(a) runway from SI");
eq(leap.activeRwy, "17", "(a) active runway");
eq(leap.source, "si", "(a) marked from SayIntentions");
eq(leap.region, "ICAO", "(a) LEAP is outside the US");
eq(buildLiveAirport("KXYZ", {}, {}).name, "KXYZ", "(a) no comms -> ident as name");
eq(buildLiveAirport("KXYZ", {}, {}).region, "US", "(a) K-ident is US");
eq(regionFromIdent("PHNL"), "US", "(a) Hawaii is US");
eq(regionFromIdent("7A4"), "US", "(a) FAA LID in DB is US");

// (b) SI runway and frequencies override DB; user override wins over both
const krdu = rowToAp(["KRDU","Raleigh-Durham International Airport","Raleigh/Durham","NC","P124.8|A123.8|D120.1|G121.7|T119.3|U122.95","05L 23R 05R 23L 14 32"], "db");
eq(krdu.region, "US", "(b) DB row is US");
const si = siRunways({active_runways_departing:"5L,5R,14", active_runways_arriving:"5L,5R,14", preferred_runway_ga_departing:"14"}, {});
eq(si.active, "14", "(b) GA-preferred runway is active");
eq(JSON.stringify(si.list), '["05L","05R","14"]', "(b) SI runways normalized to 2 digits");
eq(siRunways({}, {runway:"17"}).active, "17", "(b) falls back to flight.runway");
const wxRDU = mapComms([{type:"APP",freq:"124.95",airport:"KRDU"},{type:"CLR",freq:"120.1",airport:"KRDU"},{type:"GND",freq:"121.9",airport:"KRDU"},
  {type:"RDR",freq:"130.175",airport:"KRDU"},{type:"TWR",freq:"127.45",airport:"KRDU"},{type:"ATIS",freq:"123.800",airport:"KRDU"}], "KRDU");
eq(wxRDU.clr, "120.1", "(b) CLR type mapped (was CLEARANCE only)");
eq(wxRDU.gnd, "121.9", "(b) SI ground");
eq(wxRDU.app, "124.95", "(b) APP wins over RDR");
eq(wxRDU.atis, "123.8", "(b) trailing zeros trimmed");
eq(wxRDU.dep, "124.95", "(b) departure falls back to approach");
let merged = applyLive(krdu, {freqs:wxRDU, rwy:si}, {});
eq(merged.twr, "127.45", "(b) SI tower overrides DB tower 119.3");
eq(merged.gnd, "121.9", "(b) SI ground overrides DB 121.7");
eq(merged.activeRwy, "14", "(b) active runway from SI");
eq(merged.runways[0], "05L", "(b) SI runways listed first");
eq(merged.runways.includes("32"), true, "(b) DB-only runway kept");
eq(merged.runways.length, 6, "(b) no duplicate runways");
merged = applyLive(krdu, {freqs:wxRDU, rwy:si}, {twr:"118.0"});
eq(merged.twr, "118.0", "(b) user override beats SI");
eq(applyLive(krdu, {freqs:{twr:"127.45"}, rwy:{active:"5L", list:["5L"]}}, {}).activeRwy, "05L", "(b) active runway normalized");
merged = applyLive(krdu, null, null);
eq(merged.twr, "119.3", "(b) no live data -> DB values");

// (c) worldwide search finds EGLL and RJTT
const world = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "airports-world.json"), "utf8"));
eq(world.length > 4000, true, "(c) world file has thousands of airports");
eq(world.some(r=>r[3]==="US"), false, "(c) no US rows in world file (they're embedded)");
eq(searchRows(world, "EGLL")[0][0], "EGLL", "(c) EGLL by ident");
eq(searchRows(world, "RJTT")[0][0], "RJTT", "(c) RJTT by ident");
eq(searchRows(world, "heathrow")[0][0], "EGLL", "(c) Heathrow by name");
eq(searchRows(world, "haneda")[0][0], "RJTT", "(c) Haneda by name");
eq(searchRows(world, "LEAP").length, 0, "(c) LEAP is a non-US small_airport, so it is NOT in the file: live fallback covers it");
const egll = rowToAp(searchRows(world, "EGLL")[0], "world");
eq(egll.region, "ICAO", "(c) world rows are ICAO region");
eq(egll.twr, "118.5", "(c) EGLL tower from OurAirports");
eq(egll.runways.includes("09L"), true, "(c) EGLL runways");
process.exit(fails?1:0);
