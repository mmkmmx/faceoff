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
    };
    return api;
  };
  return {
    cells,
    getLastRow: lastRow,
    getMaxColumns: () => maxColumns,
    insertColumnsAfter: (_, n) => { maxColumns += n; },
    getRange: range,
  };
}

function load(sheet) {
  const ctx = {
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { getActive: () => ({ getSheetByName: n => (n === "2027 Survey Results" ? sheet : null) }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

// Header row as in the real tab (A to EA), no Status column yet.
const sheet = makeSheet(131);
const head = ["Submitted", "Name", "Role", "Pairs answered", "Comment", ...ACTS, ...Array.from({ length: 100 }, (_, i) => `Pair ${i + 1}`)];
sheet.getRange(1, 1, 1, head.length).setValues([head]);
const gs = load(sheet);
const post = p => gs.doPost({ postData: { contents: JSON.stringify(p) } });

let fails = 0;
const check = (label, cond) => { console.log((cond ? "ok   " : "FAIL ") + label); if (!cond) fails++; };
const row = r => ({ name: sheet.cells[`${r},2`]?.v, role: sheet.cells[`${r},3`]?.v, status: sheet.cells[`${r},132`]?.v, pairs: sheet.getRange(r, 32, 1, 100).getValues()[0].filter(Boolean).length });

// Vote lists
const pairsN = n => { const out = []; for (let i = 0; i < 26 && out.length < n; i++) for (let j = i + 1; j < 26 && out.length < n; j++) out.push([i, j, i]); return out; };
const base = { first: "Sam", last: "Smith", role: "Deacon", comment: "", votes: pairsN(10), complete: false };

check("activity list in Code.gs matches data/activities-2027.json", JSON.stringify(vm.runInContext("ACTIVITIES", gs)) === JSON.stringify(ACTS));

let r = post(base);
check("first unfinished post accepted", r.ok && r.row === 2);
check("Status header added in EB", sheet.cells["1,132"].v === "Status");
check("row 2 is Unfinished with 10 pairs", row(2).status === "Unfinished" && row(2).pairs === 10);
check("pair text is winner first", sheet.cells["2,32"].v === `${ACTS[0]} > ${ACTS[1]}`);
check("win-rate formula present", /COUNTIF\(\$AF2:\$EA2,F\$1&" >\*"\)/.test(sheet.cells["2,6"].f));
check("pairs-answered formula", sheet.cells["2,4"].f === "=COUNTA(AF2:EA2)");

r = post({ ...base, first: "  sam ", last: "SMITH", votes: pairsN(40) });
check("same name (case/space) replaces unfinished row", r.row === 2 && row(2).pairs === 40 && sheet.getLastRow() === 2);

r = post({ ...base, votes: pairsN(100), complete: true, comment: "=HYPERLINK(\"x\")" });
check("finished replaces unfinished", r.row === 2 && row(2).status === "Finished" && row(2).pairs === 100);
check("comment starting with = is escaped", sheet.cells["2,5"].v.startsWith("'="));

r = post({ ...base, votes: pairsN(5), complete: false });
check("unfinished does not replace finished", r.kept && row(2).pairs === 100 && row(2).status === "Finished");

r = post({ ...base, votes: pairsN(30), complete: true });
check("newer finished replaces finished, old pair cells cleared", row(2).pairs === 30);

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
//, sheet.getLastRow() === 3);

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
