/**
 * YM 2027 Pair Rank: survey intake.
 *
 * UNTESTED DRAFT. Paste into the YM spreadsheet (Extensions > Apps Script),
 * try it on a copy of the sheet first, then deploy as a web app:
 *   Execute as: Me.  Who has access: Anyone.
 *
 * The page POSTs JSON (sent as text/plain to avoid a CORS preflight):
 *   { first, last, role, comment, complete, votes: [[a, b, winner], ...] }
 * a, b and winner are indexes into ACTIVITIES.
 *
 * One row per person on the tab TAB. The script never returns sheet data.
 */

const TAB = '2027 Survey Results';
const ROLES = ['Deacon', 'Teacher', 'Priest', 'Leader'];
const MAX_PAIRS = 100;
const ACTIVITIES = [
  '3D Printing', 'Auto Maintenance / Repair', 'Bug Hunting', 'Camping / Survival',
  'Construction / Home Repairs', 'Cooking', 'Entrepreneurship / Business', 'Fencing',
  'First Aid', 'Fishing', 'Game Design', 'Geocaching', 'Hiking', 'Mountain Biking',
  'Movie Making', 'Paintball', 'Personal Finance', 'Photography', 'Pinewood Derby',
  'Rock Climbing', 'Shooting', 'Skiing / Sledding', 'Sports / Fitness',
  'Swimming / Water Polo', 'Welding', 'Wood Working'
];

// Column numbers (1-based). Must match the header row of the tab.
const COL_SUBMITTED = 1;   // A
const COL_NAME = 2;        // B
const COL_ROLE = 3;        // C
const COL_PAIRS = 4;       // D  formula
const COL_COMMENT = 5;     // E
const COL_FIRST_ACT = 6;   // F  first of 26 win-rate formula columns (F to AE)
const COL_FIRST_PAIR = 32; // AF first of 100 pair columns (AF to EA)
const COL_STATUS = 132;    // EB

function doGet() {
  return json_({ ok: true, service: 'ym-pair-rank' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let p;
    try {
      p = JSON.parse(e.postData.contents);
    } catch (err) {
      return json_({ ok: false, error: 'bad json' });
    }
    const problem = validate_(p);
    if (problem) return json_({ ok: false, error: problem });

    const sheet = SpreadsheetApp.getActive().getSheetByName(TAB);
    if (!sheet) return json_({ ok: false, error: 'missing tab' });
    ensureHeader_(sheet);

    const fullName = (p.first.trim() + ' ' + p.last.trim()).replace(/\s+/g, ' ');
    const key = nameKey_(fullName);
    const complete = p.complete === true;

    // Find an existing row for this person.
    const lastRow = Math.max(sheet.getLastRow(), 1);
    let row = -1;
    let existingStatus = '';
    if (lastRow > 1) {
      const names = sheet.getRange(2, COL_NAME, lastRow - 1, 1).getValues();
      const statuses = sheet.getRange(2, COL_STATUS, lastRow - 1, 1).getValues();
      for (let i = 0; i < names.length; i++) {
        if (nameKey_(names[i][0]) === key) {
          row = i + 2;
          existingStatus = String(statuses[i][0]);
        }
      }
    }

    // An unfinished submission never replaces a finished one.
    if (row > 0 && existingStatus === 'Finished' && !complete) {
      return json_({ ok: true, kept: 'finished survey already saved' });
    }
    if (row < 0) row = lastRow + 1;

    const pairCells = new Array(MAX_PAIRS).fill('');
    p.votes.forEach(function (v, i) {
      const winner = v[2];
      const loser = winner === v[0] ? v[1] : v[0];
      pairCells[i] = ACTIVITIES[winner] + ' > ' + ACTIVITIES[loser];
    });

    // Write raw values first, then formulas.
    sheet.getRange(row, COL_SUBMITTED).setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange(row, COL_NAME).setValue(cleanText_(fullName, 60));
    sheet.getRange(row, COL_ROLE).setValue(p.role);
    sheet.getRange(row, COL_COMMENT).setValue(cleanText_(p.comment || '', 500));
    sheet.getRange(row, COL_FIRST_PAIR, 1, MAX_PAIRS).setNumberFormat('@').setValues([pairCells]);
    sheet.getRange(row, COL_STATUS).setValue(complete ? 'Finished' : 'Unfinished');

    const pairsRange = '$' + colLetter_(COL_FIRST_PAIR) + row + ':$' +
      colLetter_(COL_FIRST_PAIR + MAX_PAIRS - 1) + row;
    sheet.getRange(row, COL_PAIRS).setFormula('=COUNTA(' + pairsRange.replace(/\$/g, '') + ')');

    const formulas = [];
    for (let i = 0; i < ACTIVITIES.length; i++) {
      const head = colLetter_(COL_FIRST_ACT + i) + '$1';
      const wins = 'COUNTIF(' + pairsRange + ',' + head + '&" >*")';
      const losses = 'COUNTIF(' + pairsRange + ',"*> "&' + head + ')';
      formulas.push('=IFERROR(' + wins + '/(' + wins + '+' + losses + '),"")');
    }
    sheet.getRange(row, COL_FIRST_ACT, 1, ACTIVITIES.length).setFormulas([formulas]);
    sheet.getRange(row, COL_FIRST_ACT, 1, ACTIVITIES.length).setNumberFormat('0%');

    return json_({ ok: true, row: row, status: complete ? 'Finished' : 'Unfinished' });
  } finally {
    lock.releaseLock();
  }
}

function validate_(p) {
  if (!p || typeof p !== 'object') return 'no data';
  if (typeof p.first !== 'string' || typeof p.last !== 'string') return 'name required';
  if (!p.first.trim() || !p.last.trim()) return 'name required';
  if (p.first.length > 30 || p.last.length > 30) return 'name too long';
  if (ROLES.indexOf(p.role) < 0) return 'bad role';
  if (p.comment !== undefined && typeof p.comment !== 'string') return 'bad comment';
  if (!Array.isArray(p.votes) || p.votes.length > MAX_PAIRS) return 'bad votes';
  const seen = {};
  for (let i = 0; i < p.votes.length; i++) {
    const v = p.votes[i];
    if (!Array.isArray(v) || v.length !== 3) return 'bad vote';
    for (let j = 0; j < 3; j++) {
      if (!Number.isInteger(v[j]) || v[j] < 0 || v[j] >= ACTIVITIES.length) return 'bad vote';
    }
    if (v[0] === v[1]) return 'bad pair';
    if (v[2] !== v[0] && v[2] !== v[1]) return 'bad winner';
    const k = Math.min(v[0], v[1]) + '-' + Math.max(v[0], v[1]);
    if (seen[k]) return 'repeated pair';
    seen[k] = true;
  }
  return '';
}

function ensureHeader_(sheet) {
  // Add the column first: reading past the last column throws in Sheets.
  if (sheet.getMaxColumns() < COL_STATUS) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), COL_STATUS - sheet.getMaxColumns());
  }
  if (sheet.getRange(1, COL_STATUS).getValue() !== 'Status') {
    sheet.getRange(1, COL_STATUS).setValue('Status').setFontWeight('bold');
  }
}

function nameKey_(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Remove characters that make Sheets treat text as a formula.
function cleanText_(s, max) {
  let t = String(s).slice(0, max);
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}

function colLetter_(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
