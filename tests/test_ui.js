// Run: node tests/test_ui.js   (readbackFor, validFreq, parseCallsign, page script syntax)
const fs = require("fs"), path = require("path"), vm = require("vm");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"),"utf8");
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
new vm.Script(js); // page script must parse
const grab = name => { const i = js.indexOf("function "+name+"("); let d=0, j=js.indexOf("{", i);
  for(let k=j;;k++){ if(js[k]=="{")d++; if(js[k]=="}"&&--d==0) return js.slice(i,k+1); } };
const vf = js.match(/const validFreq = [^\n]+/)[0];
const shortCS = () => "Cirrus Three Alpha Zulu";
eval(js.match(/const PHON = [^\n]+/)[0].replace("const ","var ")); eval(js.match(/const NUM = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const ci = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const TWY = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const idSay = [^\n]+/)[0].replace("const ","var "));
eval(grab("readbackParts"));
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
eval(grab("ownComms"));
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
var LIVE = false;
eval(js.match(/const sayChar = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const tailBody = [^\n]+/)[0].replace("const ","var "));
var fullCS = () => "Cirrus One Two Three Alpha Zulu";   // shortCS is stubbed near the top of this file
eval(js.match(/const rwySay = r => \{[\s\S]*?\n\};/)[0].replace("const ","var "));
eval(js.match(/const towered = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const DEPARTS = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const asCtaf = [\s\S]*?\};\n/)[0].replace("const ","var "));
for (const n of ["flowFor","PATTERNS","bigField","siNoTower"]) eval(js.match(new RegExp(`const ${n} = [^\\n]+`))[0].replace("const ","var "));
eval(js.match(/const OPP = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const looksLikeIdent = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const wxPhrase = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const isBack = [^\n]+/)[0].replace("const ","var ")); eval(grab("legs")); eval(grab("retarget")); eval(js.match(/const appName = [^\n]+/)[0].replace("const ","var ")); eval(grab("ffOut")); eval(grab("ffIn")); eval(grab("ffCancel")); eval(grab("build")); eval(grab("buildLeg")); eval(grab("customToAp"));
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

// ---- every airport type: same three choices, script adapts to the tower ----
const khky = rowToAp(["KHKY","Hickory Regional Airport","Hickory","NC","A118.825|G121.85|T120.1|P124.65","06 24"], "db");  // Class D: tower + ground, no clearance
const ktwo = rowToAp(["KTWO","Tower Only Field","Somewhere","NC","W119.025|T118.5","09 27"], "db");                       // tower, no ground, AWOS
eq(["pattern","dep","arr"].map(k=>flowFor(k, khky)).join(" "), "tpat tdep tarr", "flows: towered field");
eq(["pattern","dep","arr"].map(k=>flowFor(k, ktta)).join(" "), "pattern udep uarr", "flows: no tower");
const base = {rwy:"24", dir:"north", pat:"left", alt:"3,500", dest:"", to:null, atis:["Delta",""], last:false};
steps = build({...base, ap:khky, flow:"tdep"});
eq(steps.some(x=>x.t==="Ask to leave"), false, "class D depart: no clearance delivery call");
eq(steps.find(x=>x.t==="Taxi").say.includes("ready to taxi, VFR departure to the north"), true, "class D depart: ground hears where you're going");
eq(steps.find(x=>x.t==="Taxi").f, "121.85", "class D depart: taxi on ground");
eq(steps.some(x=>x.st==="Departure"), false, "class D depart: no departure controller");
eq(steps[steps.length-1].say.includes("request frequency change") && steps[steps.length-1].f==="120.1", true, "class D depart: ends asking tower for the frequency change");
eq(steps[steps.length-1].do.includes("124.65"), true, "class D depart: flight following hint names approach");
steps = build({...base, ap:ktwo, flow:"tdep"});
eq(steps.find(x=>x.t==="Taxi").f+"/"+steps.find(x=>x.t==="Taxi").st, "118.5/Tower", "tower-only: taxi call goes to tower");
eq(steps.find(x=>x.t==="Taxi").say.includes("with the weather"), true, "tower-only: AWOS field says 'with the weather'");
steps = build({...base, ap:khky, flow:"tarr", dir:"south"});
eq(steps.some(x=>x.t==="Call Approach"), false, "class D arrive: no approach call");
const ct = steps.find(x=>x.t==="Call Tower");
eq(ct && ct.say.includes("student pilot, 10 miles south") && ct.say.includes("with information Delta"), true, "class D arrive: first call to tower has position, student, ATIS");
eq(steps[steps.length-1].f, "121.85", "class D arrive: taxi in on ground");
steps = build({...base, ap:ktwo, flow:"tarr"});
eq(steps[steps.length-1].f+"/"+steps[steps.length-1].st, "118.5/Tower", "tower-only arrive: taxi in with tower");
// busy-airport guess from real rows, and the pilot's override
eq(bigField(rowToAp(["KHKY","Hickory","Hickory","NC","W118.325|D121.7|C128.15|G121.7|T128.15","06 24"],"db")), false, "busy guess: clearance = ground freq -> Class D");
eq(bigField(rowToAp(["KVNY","Van Nuys","Van Nuys","CA","P120.4|A118.45|D126.6|C119.3|G121.7|T119.3|U122.95","16R 34L"],"db")), false, "busy guess: part-time tower CTAF -> Class D");
eq(bigField(krdu2) && bigField(rowToAp(["KCLT","Charlotte","Charlotte","NC","P120.05|A121.15|D127.15|G121.8|T118.1|U122.95","18C"],"db")), true, "busy guess: KRDU, KCLT are busy");
eq(build({...base, ap:{...khky, big:true}, flow:"tdep"}).some(x=>x.t==="Ask to leave"), true, "busy override: pilot can turn clearance calls on");
eq(build({...base, ap:{...krdu2, big:false}, flow:"tdep"}).some(x=>x.t==="Ask to leave"), false, "busy override: and off");
// towered pattern
steps = build({...base, ap:khky, flow:"tpat"});
eq(steps.find(x=>x.t==="Taxi").say.endsWith("closed traffic."), true, "tower pattern: ask for closed traffic");
eq(steps.find(x=>x.t==="Ready at the runway").atc.says, "Runway 24, make left closed traffic, cleared for takeoff.", "tower pattern: takeoff example");
eq(steps.findIndex(x=>x.lap) >= 0 && steps.find(x=>x.lap).t, "Downwind", "tower pattern: each lap starts at downwind");
eq(steps.find(x=>x.lap).say.endsWith("touch and go."), true, "tower pattern: touch and go until the last lap");
eq(steps[steps.length-1].t, "Climb out", "tower pattern: lap ends with climb out");
steps = build({...base, ap:khky, flow:"tpat", last:true});
eq(steps.find(x=>x.lap).atc.says, "Runway 24, cleared to land.", "tower pattern last lap: cleared to land");
eq(steps[steps.length-1].t, "After landing", "tower pattern last lap: taxi back");
eq(build({...base, ap:ktta, flow:"pattern"}).find(x=>x.lap).t, "Crosswind", "CTAF pattern: lap starts at crosswind");
// tower closed: fly it as CTAF on the tower frequency
const closed = asCtaf(khky);
eq(towered(closed) + "/" + closed.ctaf + "/" + flowFor("pattern", closed), "false/120.1/pattern", "tower closed: CTAF on tower frequency");
steps = build({...base, ap:closed, flow:"pattern"});
eq(steps.find(x=>x.t==="Takeoff").f + "|" + steps.find(x=>x.t==="Takeoff").say.startsWith(khky.name+" traffic"), "120.1|true", "tower closed: self-announce on 120.1");
// destination with a closed tower gets the CTAF arrival
eq(legs({...base, ap:ktta, flow:"udep", to:asCtaf(khky)})[1].flow, "uarr", "tower closed at destination: CTAF arrival");
eq(build({...base, ap:ktta, flow:"udep", to:ktwo}).find(x=>x.t.startsWith("En route")).st, "AWOS", "en route: AWOS destination labelled AWOS");
// no destination, or back to where you started, or decided in the air
const loc = {...base, ap:khky, flow:"tdep", rwy:"24", dir:"west", to:khky, toRwy:"24", toPat:"left", atis:["Delta","Echo"]};
const LL = legs(loc);
eq(LL.length+"/"+LL[1].dir+"/"+LL[0].dest, "2/west/", "back here: two legs, inbound from where you went, no destination name");
steps = build(loc);
eq(steps.some(x=>x.t==="Out flying") && !steps.some(x=>x.t.startsWith("En route")), true, "back here: 'Out flying' instead of en route");
eq(steps.find(x=>x.t==="Call Tower").say.includes("10 miles west") && steps.find(x=>x.t==="Call Tower").say.includes("information Echo"), true, "back here: tower call from the west with the new ATIS letter");
eq(build({...base, ap:krdu2, flow:"tdep", dir:"east"}).find(x=>x.t==="Ask to leave").say.includes("VFR departure to the east, requesting"), true, "no destination: clearance asks for a VFR departure, no [destination]");
eq(build({...loc, ap:krdu2, to:krdu2, dir:"east"}).find(x=>x.t==="Ask to leave").say.includes("VFR departure to the east, returning here"), true, "back here: clearance says returning");
// choosing in the air
let fl = {...base, ap:ktta, flow:"udep", rwy:"03", to:null, atis:["",""]};
let at = build(fl).length-1;                                        // last departure step, no plan yet
at = retarget(fl, ktta, at);
eq(fl.to.id+"/"+fl.toRwy+"/"+build(fl)[at].leg, "KTTA/03/0", "in the air: 'back here' keeps your place and the runway you left on");
eq(build(fl)[at+1].t, "Out flying", "in the air: next step is out flying");
at = build(fl).findIndex(x=>x.t==="Entering downwind");          // on the way in, change your mind
at = retarget(fl, khky, at);
eq(build(fl)[at].t+"/"+fl.to.id, "En route to "+khky.name+"/KHKY", "diversion: jumps to en route for the new airport");
eq(build(fl).filter(x=>x.leg===1).some(x=>x.t==="Call Tower"), true, "diversion: arrival rebuilt for a towered field");
// SayIntentions running a towered field without a tower
eq(siNoTower({ctaf:"128.15", wx:"awos"}, khky), true, "SI no tower: CTAF and no TWR at a towered field");
eq(siNoTower({ctaf:"128.15", twr:"128.15"}, khky), false, "SI no tower: tower listed -> open");
eq(siNoTower({wx:"none"}, khky), false, "SI no tower: no comms at all -> don't guess");
eq(siNoTower({ctaf:"123.075"}, ktta), false, "SI no tower: untowered field is already CTAF");
var liveFreq = {KHKY:{ctaf:"122.8"}};
eq(asCtaf(khky).ctaf, "122.8", "tower closed: SayIntentions' own CTAF beats the tower frequency");
liveFreq = {KHKY:{ctaf:"122.8", twr:"128.15"}};
eq(asCtaf(khky).ctaf, "120.1", "tower closed by hand while SI still has a tower: tower frequency");
liveFreq = {};
// flight following
steps = build({...base, ap:ktta, flow:"udep", dir:"north", ff:true, to:khky, toRwy:"24", atis:["","Delta"]});
let T = steps.map(x=>x.t);
eq(T.indexOf("Ask for flight following") > T.indexOf("Leaving the area") && T.indexOf("Your request") === T.indexOf("Ask for flight following")+1, true, "FF: asked after leaving the CTAF area");
eq(steps.find(x=>x.t==="Ask for flight following").f, "125.3", "FF: on the origin's approach frequency");
eq(steps.find(x=>x.t==="Your request").say.includes("request flight following to "+khky.name), true, "FF: request names the destination");
eq(T.indexOf("Leaving flight following") === T.indexOf("Call Tower")-1, true, "FF: handed to tower at a Class D destination");
eq(steps.find(x=>x.t==="Leaving flight following").atc.says.endsWith("Tower 120.1."), true, "FF: told to contact the tower frequency");
eq(steps.filter(x=>x.leg===1).every(x=>x.ap==="KHKY") && steps.filter(x=>x.leg===0).every(x=>x.ap==="KTTA"), true, "FF: steps tagged with the right leg");
steps = build({...base, ap:khky, flow:"tdep", ff:true, to:ktta, toRwy:"03"});
eq(steps.find(x=>x.t==="Leaving flight following").atc.rb.startsWith("Squawk VFR"), true, "FF: CTAF destination gets radar service terminated");
steps = build({...base, ap:krdu2, flow:"tdep", ff:true, to:null});
T = steps.map(x=>x.t);
eq(steps.find(x=>x.t==="Ask to leave").say.includes("with flight following"), true, "FF: Class C clearance asks for it");
eq(T.includes("Leaving their airspace") || T.includes("Ask for flight following"), false, "FF: Class C departure keeps you (no radar terminated, no separate ask)");
eq(T[T.length-1], "Ending flight following", "FF: no destination ends by cancelling");
steps = build({...base, ap:ktta, flow:"udep", ff:true, to:krdu2, toRwy:"05L"});
eq(steps.some(x=>x.t==="Checking in with Approach") && !steps.some(x=>x.t==="Call Approach"), true, "FF: Class C destination: check in with approach instead of a cold call");
eq(build({...base, ap:ktta, flow:"pattern", ff:true}).some(x=>/flight following/i.test(x.t)), false, "FF: ignored for pattern laps");
// help card
eval(grab("helpLines"));
const hT = helpLines("Tower", "Hickory", "Cirrus Three Alpha Zulu", "Cirrus One Two Three Alpha Zulu");
eq(hT[0].say, "Hickory Tower, Cirrus Three Alpha Zulu, say again.", "help: say again addressed to the current station");
eq(hT.some(x=>x.say.includes("unable, request")), true, "help: unable");
eq(hT.find(x=>x.when.startsWith("An emergency")).say.startsWith("Mayday, mayday, mayday, Hickory Tower, Cirrus One"), true, "help: mayday to the station, full callsign");
eq(helpLines("Ground", "Hickory", "C3AZ", "C123AZ").some(x=>x.say.includes("progressive taxi")), true, "help: progressive taxi on ground");
const hC = helpLines("CTAF", "Hickory", "C3AZ", "C123AZ");
eq(hC.some(x=>/say again/.test(x.say)), false, "help: no 'say again' on CTAF (nobody answers)");
eq(hC.find(x=>x.when.startsWith("An emergency")).say.startsWith("Mayday, mayday, mayday, C123AZ"), true, "help: CTAF mayday has no station name");
// pattern readbacks
eq(readbackFor("Runway 24, make left closed traffic, cleared for takeoff."), "Left closed traffic, cleared for takeoff runway 24"+C, "readback: closed traffic takeoff");
eq(readbackFor("Runway 24, cleared touch and go."), "Cleared touch and go runway 24"+C, "readback: touch and go");
eq(readbackFor("Cleared for the option, runway 6."), "Cleared for the option runway 6"+C, "readback: option");
eq(readbackFor("Enter left downwind runway 24, report midfield."), "Left downwind runway 24, report midfield"+C, "readback: pattern entry + report");

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

// ---- SI callsign seeds Me only once per distinct callsign ----
var store = {get:(k,d)=>d, set:()=>{}};
var lastSiCS = "";
eval(grab("siSeedMe"));
me = {tail:"N123AZ", type:"Cirrus", student:true};
eq(siSeedMe("Skyhawk-One-Two-Three-Alpha-Zulu"), true, "seed: first SI callsign applies");
eq(me.type, "Skyhawk", "seed: type from SI");
me.type = "Cirrus";                                   // the pilot picks Cirrus in the Me tab
eq(siSeedMe("Skyhawk-One-Two-Three-Alpha-Zulu"), false, "seed: same SI callsign on the next poll does nothing");
eq(me.type, "Cirrus", "seed: pilot's Cirrus is kept (was reverting to Skyhawk)");
eq(siSeedMe("Cirrus-Four-Five-Six-Kilo"), true, "seed: a new SI callsign applies again");
eq(me.tail, "N456K", "seed: new tail from SI");
eq(siSeedMe(""), false, "seed: empty callsign ignored");

// ---- taxi phrasings, weather type, neighbour stations ----
eval(grab("readbackFor")); eval(grab("ownComms")); eval(grab("mapComms")); eval(grab("commsName")); eval(grab("wxLine"));
const CS = ", Cirrus Three Alpha Zulu.";
eq(readbackFor("Cirrus 3AZ, taxi to runway 5R via Alpha, Bravo, hold short of runway 5R."), "Runway 5R, taxi via Alpha, Bravo, hold short runway 5R"+CS, "taxi: 'taxi to runway X via ...'");
eq(readbackFor("Cirrus 3AZ, taxi to runway 23 via Alpha, Charlie."), "Runway 23, taxi via Alpha, Charlie"+CS, "taxi: no hold short");
eq(readbackFor("Cirrus 3AZ, runway 23 via Alpha, Charlie, hold short of runway 14."), "Runway 23, taxi via Alpha, Charlie, hold short runway 14"+CS, "taxi: 'runway X via ...' without the word taxi");
eq(readbackFor("Cirrus 3AZ, taxi via Bravo to runway 17, cross runway 9."), "Runway 17, taxi via Bravo, cross runway 9"+CS, "taxi: 'via ... to runway' plus cross");
eq(readbackFor("Cirrus 3AZ, taxi to the ramp via Alpha, Foxtrot."), "The ramp via Alpha, Foxtrot"+CS, "taxi: to the ramp");
eq(readbackFor("Cirrus 3AZ, continue taxiing, hold short of taxiway Charlie."), "Hold short taxiway Charlie"+CS, "taxi: hold short of a taxiway");
eq(readbackFor("Cirrus 3AZ, taxi to runway 03, no taxiway assigned."), "Runway 03"+CS, "taxi: runway only");
eq(readbackFor("Cirrus 3AZ, taxi to runway 11 via A1, B and C."), "Runway 11, taxi via A1, B, C"+CS, "taxi: 'A1, B and C'");
eq(readbackFor("Cirrus 3AZ, runway 5R, line up and wait."), "Runway 5R, line up and wait"+CS, "luaw: runway first");
eq(readbackFor("Cirrus 3AZ, line up and wait runway 5R."), "Runway 5R, line up and wait"+CS, "luaw: runway after");
eq(readbackFor("Cirrus 3AZ, runway 5R, taxi via F, E, A, hold short runway 5R."), "Runway 5R, taxi via F, E, A, hold short runway 5R"+CS, "taxi: original phrasing still works");
eq(wxPhrase({wx:"atis"}, "Bravo"), "with information Bravo", "wx: ATIS with letter");
eq(wxPhrase({wx:"atis"}, ""), "with information [letter]", "wx: ATIS, letter not yet known");
eq(wxPhrase({wx:"awos"}, ""), "with the weather", "wx: AWOS has no letter");
eq(wxPhrase({wx:"none"}, ""), "", "wx: nothing to say where there's no broadcast");
eq(rowToAp(["X","Y","","","T118.9","11 29"],"world").wx, "none", "wx: row with tower but no ATIS/AWOS -> none");
eq(rowToAp(["X","Y","","","A123.8|T118.9",""],"db").wx, "atis", "wx: row with ATIS");
eq(rowToAp(["X","Y","","","W120.6|U123",""],"db").wx, "awos", "wx: row with AWOS");
// the real NTTB comms list from SI: neighbours included
const nttb = [{type:"CTR",freq:"134.7",callsign:"TAHITI CONTROL",airport:"NTTB"},{type:"AFIS",freq:"118.3",callsign:"MAUPITI",airport:"NTTB"},
  {type:"AFIS",freq:"119.3",callsign:"HUAHINE",airport:"NTTB"},{type:"TWR",freq:"118.5",callsign:"RAIATEA",airport:"NTTB"},{type:"TWR",freq:"118.9",callsign:"BORA BORA",airport:"NTTB"}];
let mm = mapComms(nttb, "NTTB", "Bora Bora Airport");
eq(mm.twr, "118.9", "neighbours: Bora Bora tower beats Raiatea tower when the name is known");
eq(mm.app, "134.7", "neighbours: Tahiti Control becomes approach/departure fallback");
eq(mm.wx, "none", "neighbours: no ATIS at NTTB -> none");
eq(mapComms(nttb, "NTTB").twr, "118.5", "neighbours: without a name the first tower wins (known limitation)");
eq(commsName(nttb, "NTTB"), "Raiatea", "neighbours: commsName prefers tower/ground callsigns over centre");
eq(mapComms([{type:"ATIS",freq:"123.8",airport:"K1"},{type:"TWR",freq:"119.3",airport:"K1"}], "K1").wx, "atis", "wx: ATIS comm -> atis");
eq(wxLine({wind_direction:150, wind_speed:17, wind_gusting:30, altimeter:"29.91", metar:"NTTB 071600Z AUTO 15017KT 9999 Q1013"}), "wind 150 at 17 gusting 30, altimeter 29.91 (QNH 1013)", "wxLine: full");
eq(wxLine({wind_direction:0, wind_speed:0, altimeter:"30.01", metar:"KRDU 00000KT A3001"}), "wind calm, altimeter 30.01", "wxLine: calm, no QNH");
eq(wxLine({}), "", "wxLine: nothing");

// ---- current_airport placeholders from SI ----
eval(js.match(/const NOT_AIRPORTS = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const validIdent = [^\n]+/)[0].replace("const ","var "));
eval(grab("liveIcao"));
eq(liveIcao({current_airport:"CTAF", origin:"NTTB", destination:"", overall_intention:"departure"}), "NTTB", "icao: 'CTAF' placeholder -> origin while departing");
eq(liveIcao({current_airport:"CTAF", origin:"NTTB", destination:"NTAA", overall_intention:"arrival"}), "NTAA", "icao: placeholder -> destination when arriving");
eq(liveIcao({current_airport:"NTTB", origin:"KTTA"}), "NTTB", "icao: real current airport wins");
eq(liveIcao({current_airport:null, origin:"", destination:""}), "", "icao: nothing known");
eq(validIdent("7a4"), "7A4", "icao: FAA LID upper-cased");
eq(validIdent("UNICOM"), "", "icao: UNICOM is not an airport");

mm = mapComms(nttb, "NTTB", "Bora Bora Airport");
eq(mm.ctaf, undefined, "neighbours: Maupiti's AFIS is NOT taken as Bora Bora's CTAF once the name is known");
eq(mapComms(nttb, "NTTB").ctaf, "118.3", "neighbours: without a name the fallback is still taken (limitation)");

// ---- debrief: canon, checks, grading ----
me = {tail:"N123AZ", type:"Skyhawk", student:true};
eval(js.match(/const tailBody = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const NUMWORD = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const SI_NOTICE = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const ATC_STATION = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const wordRe = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const tailRe = [^\n]+/)[0].replace("const ","var "));
eval(js.match(/const typeWords = [^\n]+/)[0].replace("const ","var "));
eval(grab("secondsBetween")); eval(grab("canon")); eval(grab("checksFor")); eval(grab("callsignCheck")); eval(grab("gradeReadback")); eval(grab("gradeCall")); eval(grab("gradeFlight"));
eq(canon("Runway five right, taxi via Alpha, Bravo, hold short runway five right"), "runway 05r taxi via a b hold short runway 05r", "canon: spoken runway/taxiways");
eq(canon("departure one two five point three, squawk four five two one"), "departure 125.3 squawk 4521", "canon: frequency and squawk");
eq(canon("climb and maintain two thousand five hundred"), "climb and maintain 2500", "canon: thousands and hundreds");
eq(canon("maintain one zero thousand"), "maintain 10000", "canon: one zero thousand");
eq(canon("Skyhawk One Two Three Alpha Zulu"), "skyhawk 123 a z", "canon: callsign");
eq(canon("Runway 5R, taxi via A, B"), "runway 05r taxi via a b", "canon: digits form matches spoken form");
eq(canon("heading two seven zero"), "heading 270", "canon: heading");
eq(JSON.stringify(readbackParts("Radar contact.")), "[]", "parts: nothing to read back");
eq(JSON.stringify(readbackParts("Skyhawk 3AZ, runway 11, taxi via Alpha, hold short of runway 11.")), '["Runway 11, taxi via Alpha","hold short runway 11"]', "parts: taxi");
const atcTaxi = "Skyhawk 3AZ, runway 11, taxi via Alpha, Bravo, hold short of runway 11.";
let g = gradeReadback(atcTaxi, "Runway one one, taxi via Alpha, Bravo, hold short runway one one, Skyhawk three alpha zulu");
eq(g.score, 1, "readback: perfect taxi readback scores 100%");
eq(g.items.map(i=>i.label).join("|"), "Runway 11|Taxiway Alpha|Taxiway Bravo|Hold short|Callsign", "readback: items listed");
g = gradeReadback(atcTaxi, "Runway one one via alpha bravo, Skyhawk three alpha zulu");
eq(g.items.find(i=>i.label==="Hold short").ok, false, "readback: missing hold short caught");
eq(g.items.find(i=>i.label==="Taxiway Bravo").ok, true, "readback: taxiways without commas still found");
g = gradeReadback(atcTaxi, "Runway 11, taxi via Alpha, Bravo, hold short runway 11.");
eq(g.items.find(i=>i.label==="Callsign").ok, false, "readback: missing callsign caught");
g = gradeReadback("Skyhawk 3AZ, cleared out of the Class C to the north, maintain at or below 2,500, departure 125.3, squawk 4521.",
  "At or below two thousand five hundred, departure one two five point three, squawk four five two one, Skyhawk three alpha zulu");
eq(g.score, 1, "readback: clearance with spoken numbers scores 100%");
g = gradeReadback("Skyhawk 3AZ, runway 11, cleared for takeoff.", "Cleared for takeoff runway one one, Cirrus three alpha zulu");
eq(g.items.some(i=>/Said "cirrus"/.test(i.label) && !i.ok), true, "readback: wrong aircraft type flagged");
eq(g.items.find(i=>i.label==="Cleared for takeoff").ok, true, "readback: takeoff clearance echoed");
g = gradeReadback("Skyhawk 3AZ, enter right downwind runway 24, report midfield.", "Right downwind runway two four, report midfield, Skyhawk three alpha zulu");
eq(g.items.every(i=>i.ok), true, "grade: pattern entry read back");
g = gradeReadback("Skyhawk 3AZ, enter right downwind runway 24, report midfield.", "Downwind two four, Skyhawk three alpha zulu");
eq(g.items.filter(i=>!i.ok).map(i=>i.label).join("|"), "Right downwind|Report midfield", "grade: missing side and report flagged");
g = gradeReadback("Skyhawk 3AZ, runway 24, cleared touch and go.", "Cleared touch and go two four, Skyhawk three alpha zulu");
eq(g.items.every(i=>i.ok), true, "grade: touch and go");
g = gradeReadback("Skyhawk 3AZ, radar service terminated, squawk VFR, frequency change approved.", "Squawk VFR, Skyhawk three alpha zulu");
eq(g.score, 1, "readback: squawk VFR");
// pilot-initiated calls
g = gradeCall("Bora Bora Tower, Skyhawk one two three alpha zulu, student pilot, at the ramp, ready to taxi, VFR to Raiatea", {station:"Bora Bora Tower", firstContact:true, wx:"none"});
eq(g.score, 1, "call: complete first contact at a field with no ATIS");
eq(g.items.some(i=>/ATIS/.test(i.label)), false, "call: no ATIS item where there is no ATIS");
g = gradeCall("Tower, Skyhawk three alpha zulu, ready to taxi", {station:"Raleigh Tower", firstContact:true, wx:"atis"});
eq(g.items.find(i=>i.label.startsWith("Full callsign")).ok, false, "call: short callsign on first contact flagged");
eq(g.items.find(i=>i.label==="Gave the ATIS letter").ok, false, "call: missing ATIS letter flagged");
eq(g.items.find(i=>i.label==='Said "student pilot"').ok, false, "call: missing student pilot flagged");
g = gradeCall("Raleigh Tower, Skyhawk three alpha zulu, five miles south, inbound full stop", {station:"Raleigh Tower", firstContact:false, wx:"atis"});
eq(g.score, 1, "call: later contact may use the short callsign, no ATIS/student needed");
// a whole flight
const conv = [
  {id:1, stamp_zulu:"10:00:01", station_name:"Ramp", outgoing_message:"Mic key held for only 0.1 seconds. Hold PTT down while you speak."},
  {id:2, stamp_zulu:"10:01:00", station_name:"Bora Bora Tower", outgoing_message:"Bora Bora Tower, Skyhawk one two three alpha zulu, student pilot, at the ramp, ready to taxi",
     incoming_message:"Skyhawk 3AZ, Bora Bora Tower, runway 11, taxi via Alpha, hold short of runway 11."},
  {id:3, stamp_zulu:"10:01:30", station_name:"Bora Bora Tower", outgoing_message:"Runway one one via alpha, Skyhawk three alpha zulu"},
  {id:4, stamp_zulu:"10:05:00", station_name:"Bora Bora Tower", outgoing_message:"Bora Bora Tower, Skyhawk three alpha zulu, holding short runway one one, ready for departure",
     incoming_message:"Skyhawk 3AZ, runway 11, wind 150 at 17, cleared for takeoff."},
  {id:5, stamp_zulu:"10:05:20", station_name:"Bora Bora Tower", outgoing_message:"Cleared for takeoff runway one one, Skyhawk three alpha zulu"},
  {id:6, stamp_zulu:"10:06:00", station_name:"Mentor", outgoing_message:"Read back: cleared for takeoff runway one one"}];
const d = gradeFlight(conv, {wx:"none"});
eq(d.notices, 1, "flight: SI notice counted, not graded");
eq(d.calls.length, 4, "flight: four pilot calls graded (mentor ignored)");
eq(d.calls.map(x=>x.kind).join(","), "call,readback,call,readback", "flight: calls vs readbacks detected");
eq(d.calls[1].items.find(i=>i.label==="Hold short").ok, false, "flight: the missed hold short shows up");
eq(d.calls[0].items.find(i=>i.label.startsWith("Full callsign")).ok, true, "flight: first contact had the full callsign");
eq(d.calls[3].score, 1, "flight: clean takeoff readback");
eq(d.misses[0][0], "Hold short", "flight: top miss is hold short");
eq(d.avg > 0.8 && d.avg < 1, true, "flight: average between 80% and 100%");

eq(secondsBetween("10:01:00","10:01:30"), 30, "time: gap in seconds");
eq(secondsBetween("23:59:50","00:00:10"), 20, "time: midnight wrap");
eq(secondsBetween("", "10:00:00"), null, "time: unknown stamp -> null");
eq(gradeFlight([{id:1, station_name:"Tower", incoming_message:"Skyhawk 3AZ, runway 11, taxi via Alpha, hold short of runway 11."},
                {id:2, station_name:"Tower", outgoing_message:"Runway one one via alpha, hold short one one, Skyhawk three alpha zulu"}], {}).calls[0].kind, "readback", "flight: no timestamps still detects a readback");
// ---- auto-advance follows the real conversation ----
eval(grab("atcKind")); eval(grab("autoStep"));
eq(["Skyhawk 3AZ, runway two four, taxi via alpha, hold short runway two four.", "Runway 24, make left closed traffic, cleared for takeoff.", "Squawk four five two one, maintain VFR.",
    "Contact Hickory Tower one two zero point one.", "Radar service terminated, squawk VFR, frequency change approved.", "Traffic 2 o'clock, 3 miles."].map(atcKind).join(" "),
   "taxi takeoff squawk contact term ", "auto: ATC call kinds (spoken numbers too)");
function run(steps, evs){ let i=0, pending=null; const seen=[]; for(const ev of evs){ const r = autoStep(steps, i, pending, ev); i=r.i; pending=r.pending; seen.push(steps[i].t); } return seen; }
const P = t=>({kind:"pilot", text:t}), A = t=>({kind:"atc", text:t});
steps = build({...base, ap:khky, flow:"tdep"});
eq(run(steps, [P("Hickory Ground, Skyhawk one two three alpha zulu, at the FBO, ready to taxi"), A("Skyhawk 3AZ, runway 24, taxi via alpha, hold short runway 24."), P("Runway 24 via alpha, hold short 24, Skyhawk 3AZ"),
               P("Hickory Tower, Skyhawk 123AZ, holding short runway 24, ready for departure"), A("Skyhawk 3AZ, runway 24, cleared for takeoff."), P("Cleared for takeoff 24, Skyhawk 3AZ"),
               A("Skyhawk 3AZ, frequency change approved.")]).join(" > "),
   "Taxi > Taxi > Ready at the runway > Ready at the runway > Ready at the runway > Leaving their airspace > Leaving their airspace", "auto: class D departure follows the conversation");
steps = build({...base, ap:ktta, flow:"pattern"});
eq(run(steps, [P("Raleigh Exec traffic, Skyhawk 123AZ, taxiing to runway 3"), P("Raleigh Exec traffic, Skyhawk 3AZ, departing runway 3, remaining in the pattern")]).join(" > "),
   "Run-up > Crosswind", "auto: CTAF calls move on as soon as you make them");
eq(run(steps, [P("uh, one moment"), A("Traffic 2 o'clock, 3 miles.")]).join(" > "), "Get the weather (AWOS) > Get the weather (AWOS)", "auto: chatter and traffic calls don't move the script");
steps = build({...base, ap:khky, flow:"tarr"});
eq(run(build({...base, ap:ktta, flow:"udep", to:khky}), [A("Runway 24, cleared to land.")])[0], "Get the weather (AWOS)", "auto: never jumps more than 3 steps ahead");
eq(canon("Hold short runway two four."), "hold short runway 24", "canon: a full stop after a number word");
eq(run(steps, [P("Hickory Tower, Skyhawk 123AZ, 10 miles south, inbound with Delta"), {kind:"atc", k:"land"}]).join(" > "), "Call Tower > Landing", "auto: SI's cleared-for-landing flag counts as the clearance");
process.exit(fails?1:0);
