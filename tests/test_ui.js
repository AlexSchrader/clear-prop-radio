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

// ---- flight plan (two legs), destination runway, custom airports ----
var me = {tail:"N123AZ", type:"Cirrus", student:true};
eval(js.match(/const sayChar = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const tailBody = [^\n]+/)[0].replace("const ","var "));
var fullCS = () => "Cirrus One Two Three Alpha Zulu";   // shortCS is stubbed near the top of this file
eval(js.match(/const rwySay = r => \{[\s\S]*?\n\};/)[0].replace("const ","var "));
eval(js.match(/const towered = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const DEPARTS = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const OPP = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const looksLikeIdent = [^\n]+/)[0].replace("const ","var "));
eval(grab("legs")); eval(grab("build")); eval(grab("buildLeg")); eval(grab("customToAp"));
const ktta = rowToAp(["KTTA","Raleigh Executive Jetport","Sanford","NC","P125.3|W120.625|D135.075|U123.075","03 21"], "db");
const krdu2 = rowToAp(["KRDU","Raleigh-Durham International Airport","Raleigh/Durham","NC","P124.8|A123.8|D120.1|G121.7|T119.3|U122.95","05L 23R 05R 23L 14 32"], "db");
// one leg, as before
let steps = build({ap:ktta, flow:"udep", rwy:"03", dir:"north", pat:"left", alt:"3,500", dest:"", to:null, atis:["",""], last:false});
eq(legs({ap:ktta, flow:"udep", to:null}).length, 1, "trip: no To -> one leg");
eq(steps.every(x=>x.ap==="KTTA" && x.leg===0), true, "trip: single-leg steps tagged with origin");
// two legs: untowered KTTA -> towered KRDU
const f2 = {ap:ktta, flow:"udep", rwy:"03", dir:"north", pat:"left", alt:"3,500", dest:"", to:krdu2, toRwy:"05L", toPat:"right", atis:["Bravo","Charlie"], last:false};
const L = legs(f2);
eq(L.length, 2, "trip: To on a departure flow -> two legs");
eq(L[1].flow, "tarr", "trip: towered destination gets the tower arrival");
eq(L[1].dir, "south", "trip: inbound from the opposite direction of the outbound");
eq(L[1].rwy+"/"+L[1].pat, "05L/right", "trip: destination runway and pattern");
steps = build(f2);
const i = steps.findIndex(x=>x.t.startsWith("En route"));
eq(i > 0 && steps.slice(0,i).every(x=>x.leg===0 && x.ap==="KTTA"), true, "trip: departure steps first, tagged leg 0");
eq(steps.slice(i).every(x=>x.leg===1 && x.ap==="KRDU"), true, "trip: en-route and arrival steps tagged leg 1 / KRDU");
eq(steps[i].f, "123.8", "trip: en-route step tunes the destination ATIS");
eq(steps[i].do.includes("Expect runway five left"), true, "trip: en-route step says the expected runway (US style, no leading zero)");
const appr = steps.find(x=>x.t==="Call Approach");
eq(appr.f, "124.8", "trip: approach call on KRDU approach frequency");
eq(appr.say.includes("miles south"), true, "trip: arrival direction is south");
eq(appr.say.includes("with information Charlie"), true, "trip: second ATIS letter used on leg 2");
eq(steps.find(x=>x.t==="Landing").atc.rb, "Cleared to land runway five left, Cirrus Three Alpha Zulu.", "trip: landing readback at destination");
// pattern laps ignore To
eq(legs({ap:ktta, flow:"pattern", to:krdu2}).length, 1, "trip: pattern laps ignore To");
// towered origin uses destination name in the clearance request
const f3 = {ap:krdu2, flow:"tdep", rwy:"05L", dir:"south", pat:"left", alt:"3,500", to:ktta, toRwy:"21", toPat:"left", atis:["Alpha",""], last:false};
steps = build(f3);
eq(steps.find(x=>x.t==="Ask to leave").say.includes("VFR to Raleigh Exec"), true, "trip: clearance names the destination");
eq(steps[steps.length-1].t, "Clear of the runway", "trip: untowered destination ends with clear-of-runway call");
eq(steps.find(x=>x.t==="Inbound, about 10 miles out").say.includes("10 miles north"), true, "trip: inbound to KTTA from the north");
// destination runway from SI arriving fields
const arr = siRunways({active_runways_departing:"5L,5R,14", active_runways_arriving:"23L,23R", preferred_runway_ga_arriving:"23R", preferred_runway_ga_departing:"14"}, {}, "arr");
eq(arr.active, "23R", "dest runway: GA arriving runway preferred");
eq(arr.list[0], "23L", "dest runway: arriving runways listed first");
eq(siRunways({}, {arr_runway:"32"}, "arr").active, "32", "dest runway: falls back to flight plan arriving runway");
eq(siRunways({active_runways_arriving:"23L"}, {runway:"03", dep_runway:"03", arr_runway:""}, "arr").list.includes("03"), false, "dest runway: the origin's runway never leaks into the destination list");
// custom airport
var custom = {};
const c = customToAp("LEAP", {full:"Empuriabrava"});
eq(c.source+"/"+c.region+"/"+c.name, "custom/ICAO/Empuriabrava", "custom: source, region, spoken name");
eq(customToAp("XYZ1", {}).name, "XYZ1", "custom: no name -> ident");
eq(applyLive(c, null, {ctaf:"122.4", runways:["17","35"]}).runways.join(" "), "17 35", "custom: user runways apply");
eq(looksLikeIdent("leap"), true, "custom: 'leap' offered as new airport");
eq(looksLikeIdent("heathrow"), false, "custom: a word is not an ident");

// ---- easier reads: numbers as words, chunked readbacks ----
var reads = {words:true, chunks:true, big:false};
eval(js.match(/const spellDigits = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const phonetic = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const esc = [^\n]+/)[0].replace("const ","var "));
eval(grab("altWords")); eval(grab("sayNums")); eval(grab("chunks")); eval(grab("rbHTML"));
eq(sayNums("departure 125.3, squawk 4521"), "departure one two five point three, squawk four five two one", "words: frequency and squawk");
eq(sayNums("at or below 2,500"), "at or below two thousand five hundred", "words: altitude with comma");
eq(sayNums("climb and maintain 3500"), "climb and maintain three thousand five hundred", "words: altitude without comma");
eq(sayNums("maintain 10,000"), "maintain one zero thousand", "words: ten thousand FAA style");
eq(sayNums("requesting 3,000"), "requesting three thousand", "words: round thousand");
eq(sayNums("Runway 5R, taxi via F, E, A, hold short runway 5R"), "runway five right, taxi via Foxtrot, Echo, Alpha, hold short runway five right", "words: runways and taxiways");
eq(sayNums("Ramp via A, F"), "Ramp via Alpha, Foxtrot", "words: via list");
eq(sayNums("heading 270"), "heading two seven zero", "words: heading");
eq(sayNums("10 miles south, inbound"), "one zero miles south, inbound", "words: miles");
eq(sayNums("Cleared out of the Class C"), "Cleared out of the Class Charlie", "words: Class Charlie");
eq(sayNums("will enter the 45 for left downwind"), "will enter the 45 for left downwind", "words: the 45 entry is left alone");
eq(sayNums("Cirrus Three Alpha Zulu"), "Cirrus Three Alpha Zulu", "words: callsign untouched");
eq(sayNums("tower 118.3"), "tower one one eight point three", "words: 118.3");
reads.words = false; eq(sayNums("departure 125.3"), "departure 125.3", "words: off leaves digits"); reads.words = true;
eq(JSON.stringify(chunks("Runway 5R, taxi via F, E, A, hold short runway 5R, Cirrus Three Alpha Zulu.")),
   '["Runway 5R","taxi via F, E, A","hold short runway 5R","Cirrus Three Alpha Zulu"]', "chunks: taxiways stay together, period dropped");
eq(chunks("Squawk VFR, Cirrus Three Alpha Zulu.").length, 2, "chunks: short readback");
const html1 = rbHTML("Runway 5R, taxi via F, E, A, hold short runway 5R, Cirrus Three Alpha Zulu.");
eq(html1.startsWith("<ol class=\"rb-list\">") && (html1.match(/<li/g)||[]).length === 4 && html1.includes('<li class="cs">Cirrus'), true, "rbHTML: list of 4 with callsign last");
eq(html1.includes("taxi via Foxtrot, Echo, Alpha") && html1.includes("<li>Runway five right</li>"), true, "rbHTML: items are worded, first one capitalized");
eq(rbHTML("Squawk VFR, Cirrus Three Alpha Zulu."), '"Squawk VFR, Cirrus Three Alpha Zulu."', "rbHTML: under 3 items stays a sentence");
reads.chunks = false; eq(rbHTML("Runway 5R, taxi via F, E, A, hold short runway 5R, Cirrus Three Alpha Zulu.").startsWith('"Runway five right, taxi via Foxtrot'), true, "rbHTML: chunks off -> one worded, capitalized sentence"); reads.chunks = true;
eq(rbHTML('<b>x</b>, y, z'), '<ol class="rb-list"><li>&lt;b&gt;x&lt;/b&gt;</li><li>y</li><li class="cs">z</li></ol>', "rbHTML: escapes HTML");
process.exit(fails?1:0);
