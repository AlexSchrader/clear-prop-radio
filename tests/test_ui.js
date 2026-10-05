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
process.exit(fails?1:0);
