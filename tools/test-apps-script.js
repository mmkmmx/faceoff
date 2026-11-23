// Runs apps-script/Code.gs against a fake in-memory sheet. No Google account needed.
// Usage: node tools/test-apps-script.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8");
const ACTS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "activities-2027.json"), "utf8")).activities;

function makeSheet(maxCols) {
  const cells = {}; // "r,c" -> {v, f}
  let maxColumns = maxCols;
  const lastRow = () => Math.max(0, ...Object.keys(cells).filter(k => cells[k].v !== "" || cells[k].f).map(k => +k.split(",")[0]));
  const range = (r, c, nr = 1, nc = 1) => {
    if (c + nc - 1 > maxColumns) throw new Error(`range past column ${maxColumns}`);
    const cell = (i, j) => (cells[`${r + i},${c + j}`] ||= { v: "", f: "" });
    const api = {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cell(i, j).v)),
      getValue: () => cell(0, 0).v,
      setValue: v => { cell(0, 0).v = v; cell(0, 0).f = ""; return api; },
      setValues: vs => { vs.forEach((row, i) => row.forEach((v, j) => { cell(i, j).v = v; cell(i, j).f = ""; })); return api; },
      setFormula: f => { cell(0, 0).f = f; return api; },
      setFormulas: fs => { fs.forEach((row, i) => row.forEach((f, j) => { cell(i, j).f = f; })); return api; },
      setNumberFormat: () => api,
      setFontWeight: () => api,
      setFontSize: () => api,
      setWrap: () => api,
      setBackground: () => api,
      clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { cell(i, j).v = ""; cell(i, j).f = ""; } return api; },
    };
    return api;
  };
  return {
    cells,
    clear: () => { for (const k in cells) delete cells[k]; },
    getLastRow: lastRow,
    getMaxColumns: () => maxColumns,
    insertColumnsAfter: (_, n) => { maxColumns += n; },
    getRange: range,
  };
}

const tabs = {};
function load(sheet) {
  tabs["2027 Survey Results"] = sheet;
  const ctx = {
    console,
    Utilities: { formatDate: () => "2026-11-23 12:00" },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { getActive: () => ({
      getSheetByName: n => tabs[n] || null,
      insertSheet: n => (tabs[n] = makeSheet(26)),
      getSpreadsheetTimeZone: () => "America/Denver",
    }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

// Old header row as in the real tab today (A to EA, Pair 1 to Pair 100). The script must replace it.
const sheet = makeSheet(131);
const head = ["Submitted", "Name", "Role", "Pairs answered", "Comment", ...ACTS, ...Array.from({ length: 100 }, (_, i) => `Pair ${i + 1}`)];
sheet.getRange(1, 1, 1, head.length).setValues([head]);
const gs = load(sheet);
const post = p => gs.doPost({ postData: { contents: JSON.stringify(p) } });

let fails = 0;
const check = (label, cond) => { console.log((cond ? "ok   " : "FAIL ") + label); if (!cond) fails++; };
const row = r => ({ name: sheet.cells[`${r},2`]?.v, role: sheet.cells[`${r},3`]?.v, pairs: sheet.cells[`${r},4`]?.v, status: sheet.cells[`${r},32`]?.v, votes: sheet.cells[`${r},33`]?.v,
  rate: i => sheet.cells[`${r},${6 + i}`]?.v });

// Vote lists
const pairsN = n => { const out = []; for (let i = 0; i < 26 && out.length < n; i++) for (let j = i + 1; j < 26 && out.length < n; j++) out.push([i, j, i]); return out; };
const base = { first: "Sam", last: "Smith", role: "Deacon", comment: "", votes: pairsN(10), complete: false };

check("activity list in Code.gs matches data/activities-2027.json", JSON.stringify(vm.runInContext("ACTIVITIES", gs)) === JSON.stringify(ACTS));

let r = post(base);
check("first unfinished post accepted", r.ok && r.row === 2);
check("header rewritten: Status in AF, Votes in AG", sheet.cells["1,32"].v === "Status" && sheet.cells["1,33"].v.startsWith("Votes"));
check("old Pair headers cleared", sheet.getRange(1, 34, 1, 98).getValues()[0].every(v => v === ""));
check("activity headers F to AE unchanged", sheet.getRange(1, 6, 1, 26).getValues()[0].join("|") === ACTS.join("|"));
check("row 2 is Unfinished with 10 pairs", row(2).status === "Unfinished" && row(2).pairs === 10);
check("raw votes winner first", row(2).votes.startsWith("0>1,0>2,"));
check("win rate is a number: activity 0 won all 10", row(2).rate(0) === 1);
check("win rate 0 for an activity that only lost", row(2).rate(1) === 0);
check("win rate blank for an activity never shown", row(2).rate(25) === "");
check("no formulas written", Object.values(sheet.cells).every(c => !c.f));

r = post({ ...base, first: "  sam ", last: "SMITH", votes: pairsN(40) });
check("same name (case/space) replaces unfinished row", r.row === 2 && row(2).pairs === 40 && sheet.getLastRow() === 2);

r = post({ ...base, votes: pairsN(100), complete: true, comment: "=HYPERLINK(\"x\")" });
check("finished replaces unfinished", r.row === 2 && row(2).status === "Finished" && row(2).pairs === 100);
check("comment starting with = is escaped", sheet.cells["2,5"].v.startsWith("'="));

r = post({ ...base, votes: pairsN(5), complete: false });
check("unfinished does not replace finished", r.kept && row(2).pairs === 100 && row(2).status === "Finished");

r = post({ ...base, votes: pairsN(30), complete: true });
check("newer finished replaces finished", row(2).pairs === 30 && row(2).votes.split(",").length === 30);
r = post({ ...base, votes: [[3, 4, 4], [3, 5, 3]], complete: true });
check("rates recomputed, old ones cleared", row(2).rate(3) === 0.5 && row(2).rate(0) === "");

r = post({ ...base, last: "Jones" });
check("same first name, different last name gets new row", r.row === 3 && row(3).name === "Sam Jones");

// Validation
const bad = [
  ["bad role", { ...base, role: "Parent" }],
  ["missing last name", { ...base, last: " " }],
  ["name too long", { ...base, first: "x".repeat(31) }],
  ["too many votes", { ...base, votes: [...pairsN(100), [0, 25, 0]] }],
  ["index out of range", { ...base, votes: [[0, 26, 0]] }],
  ["winner not in pair", { ...base, votes: [[0, 1, 2]] }],
  ["repeated pair reversed", { ...base, votes: [[0, 1, 0], [1, 0, 1]] }],
  
  ["non-integer index", { ...base, votes: [["0", 1, 1]] }],
];
bad.forEach(([label, p]) => { const res = post(p); check(`rejects ${label}`, res.ok === false); });
check("bad json rejected", gs.doPost({ postData: { contents: "{oops" } }).ok === false);
check("missing body rejected", gs.doPost({}).ok === false);
r = post({ ...base, first: "Long", comment: "x".repeat(600) });
check("long comment cut to 500", sheet.cells[`${r.row},5`].v.length === 500);
check("no extra rows from rejected posts", sheet.getLastRow() === 4);

// Summary tab: pooled group totals, no names.
const sum = tabs["2027 Results Summary"];
check("summary tab created by a post", !!sum);
// Rows now: Sam Smith (Deacon, finished: 4>3, 3>5), Sam Jones (Deacon, unfinished, 10 pairs), Long (Deacon, unfinished, 10 pairs)
post({ first: "Tia", last: "Teach", role: "Teacher", comment: "", votes: [[0, 1, 1], [1, 2, 1]], complete: true });
post({ first: "Lee", last: "Lead", role: "Leader", comment: "", votes: [[0, 1, 0]], complete: true });
const s = gs.rebuildSummary();
const g = Object.fromEntries(s.map(x => [x.name, x]));
check("group people counts", g.Everyone.people === 5 && g.Deacons.people === 3 && g["Teachers & Priests"].people === 1 && g.Leaders.people === 1);
check("finished counts", g.Everyone.finished === 3 && g.Deacons.finished === 1);
check("pooled, not averaged: Everyone activity 0 = 21 wins / 22 shown", g.Everyone.wins[0] === 21 && g.Everyone.seen[0] === 22);
check("Teachers & Priests: activity 1 won 2 of 2", g["Teachers & Priests"].rate[1] === 1 && g["Teachers & Priests"].rank[1] === 1);
check("never-shown activity has no rate or rank", g.Leaders.rate[5] === null && g.Leaders.rank[5] === null);
check("ties share a rank (T&P: activities 0 and 2 both 0 of 1)", g["Teachers & Priests"].rank[0] === 2 && g["Teachers & Priests"].rank[2] === 2);
const sumText = Object.values(sum.cells).map(c => String(c.v)).join("|");
check("summary tab contains no names", !/Sam|Smith|Jones|Tia|Lee|Long/.test(sumText));
const hdrRow = Object.keys(sum.cells).find(k => sum.cells[k].v === "Activity").split(",")[0];
check("compare table sorted by Everyone rank (first row rank 1)", sum.cells[`${+hdrRow + 1},2`].v === 1);
const gapCol = 2 + 4 * 2;
check("gap = max - min across the three groups", (() => {
  const r = Object.keys(sum.cells).find(k => sum.cells[k].v === ACTS[1] && +k.split(",")[0] > +hdrRow).split(",")[0];
  // activity 1: Deacons 0 wins/ some shows -> 0, T&P 1, Leaders 0 -> gap 1
  return sum.cells[`${r},${gapCol}`].v === 1;
})());
const before = Object.keys(sum.cells).length;
gs.rebuildSummary();
check("rebuild replaces, does not append", Object.keys(sum.cells).length === before);
// A summary failure must not break intake.
const saved = tabs["2027 Results Summary"]; tabs["2027 Results Summary"] = { clear() { throw new Error("boom"); } };
r = post({ first: "Err", last: "Test", role: "Priest", comment: "", votes: [[0, 1, 0]], complete: true });
check("intake still saves if summary fails", r.ok === true);
tabs["2027 Results Summary"] = saved;
//, sheet.getLastRow() === 3);

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
