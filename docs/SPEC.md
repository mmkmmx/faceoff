# Spec: YM 2027 Pair Rank Survey

## Respondent flow (public page, no login)

1. **Intro.** Explains the survey. About seven minutes.
2. **About you.** First name, last name (both required), role chips: Deacon, Teacher, Priest, Leader.
3. **Pair Rank.** 100 pairs, one at a time: "Which would you rather do?" Two large tap targets (stacked on phones, side by side on desktop, arrow keys on desktop). Buttons: Back, Skip this pair, and from pair 30 on, Finish now. Progress bar and "Pair n of 100".
4. **Done.** After the last pair (or "Finish now") the answers are sent right away. The page then shows the respondent's own top ten (no group results) and asks whether someone else on the device needs to take the survey; "Start a new survey" goes straight to the name screen. If sending fails, a "Try again" screen keeps the answers on the device.

The comment screen was removed on 2026-11-23. The page sends `comment: ""`; the column stays in the sheet.

## Pair generation

- Pool: all 325 unordered pairs of the 26 activities, shuffled.
- Each step takes the unused pair whose two activities have appeared the fewest times so far (ties broken by the shuffle). Keep selection order, do not reshuffle afterwards.
- Randomize which side each activity appears on.
- Never repeat a matchup in either order. Verified: 2,000 surveys, 150,000 pairs, 0 duplicates.

## Scoring

- Per activity: win rate = wins / appearances, over a person's votes or a group's pooled votes.
- Skipped pairs count for nothing.
- Per person: top five and bottom five by win rate (ties broken by more appearances, then name).
- Accuracy notes from simulation (26 activities, simulated boys):
  - One boy, 100 pairs: ranking correlation about 0.79, true top five found about 64% of the time. Treat a single boy's list as "likes and dislikes", not an exact order.
  - Group of 10: ranking correlation about 0.95, top five found about 85%.
  - With 8-12 people per group, rank differences in the middle of the list are noise.

## Data saved per respondent

- `first`, `last`, `role` (Deacon | Teacher | Priest | Leader), `comment`
- `votes`: list of `[a, b, winner]` where `a`, `b`, `winner` are indexes into `data/activities-2027.json` (order matters, keep it stable)
- `complete`: true when submitted, false for an autosaved partial
- `at`: timestamp

## Sheet layout, tab `2027 Survey Results` (one row per person)

Changed 2026-11-23: the 100 per-pair columns were dropped. The Apps Script computes the win rates and writes plain numbers (no formulas). It also rewrites the header row if it does not match.

| Columns | Content |
|---|---|
| A | Submitted (date and time) |
| B | Name (first and last) |
| C | Role (exact, so Teachers and Priests can be split) |
| D | Pairs answered (number) |
| E | Comment |
| F to AE | Win rate per activity = wins / appearances for that person, in `activities-2027.json` order. Blank if the activity never came up |
| AF | Status: `Finished` or `Unfinished` |
| AG | Votes: compact raw votes, `winner>loser` pairs separated by commas, using 0-based indexes into `activities-2027.json` (0 = column F). Kept so group results can pool wins and appearances instead of averaging percents |

Group results should pool: sum wins and appearances across people from column AG, then divide. Averaging the F to AE percents gives early finishers (30 pairs, about 2 appearances per activity) the same weight as full surveys.

## Same-name rules (server side, in the Apps Script)

- Match on first plus last name with case and extra spaces ignored.
- If a finished row exists and a new unfinished submission arrives: ignore the new one.
- Otherwise replace the existing row (finished replaces unfinished, newer replaces older of the same status).
- A typo ("Jon" vs "John") makes two rows. The owner merges these by hand.

## Owner-only results (built 2026-11-23: both options, group totals only)

Decision: both, and no per-person view (no names in either).

1. **Sheet tab `2027 Results Summary`.** Written by `rebuildSummary()` in `apps-script/Code.gs`. It runs after every submission (a failure there never blocks saving) and from the sheet menu YM Results > Rebuild summary. Shows people/finished/unfinished/pairs per group, then one row per activity with rank and win rate for Everyone, Deacons, Teachers & Priests, Leaders, and Gap (highest minus lowest of the three role groups, shaded at 30%+). Pooled from column AG. Anyone with access to the YM Sheet can see this tab.
2. **Private Claude dashboard** (owner-only): https://claude.ai/artifact/2Pof1ZJoMgQcEErUunaEBn. It reads columns C to AG of `2027 Survey Results` live through Katie's Google Sheets connector (never column B, the names) and computes the same numbers in the page. Views: summary line, ranked bars per group, Compare table, who has answered.

The old artifact's code (`src/claude-artifact/index.html`: `resultsHtml`, `peopleHtml`, `compareHtml`, `tally`) is kept for reference.

## Public-version architecture

- Static page hosted on GitHub Pages. No framework needed. Mobile first, light and dark themes.
- The page does not read anything from the server. It only submits.
- Submission: `fetch(WEB_APP_URL, {method: "POST", headers: {"Content-Type": "text/plain"}, body: JSON.stringify(payload)})`. text/plain avoids a CORS preflight. Apps Script replies (via its googleusercontent redirect) with `Access-Control-Allow-Origin: *`, so the page reads `{ok, error}` and only shows "Thank you" when `ok` is true. (Changed 2026-11-23: the first version used `no-cors`, could not see rejections, and lost a phone test's answers silently.)
- The page stores one answer per pair index (`answers[i] = winner`), so a pair can never be counted twice. The old list-of-votes version could record a pair twice when Back or Skip was tapped during the 140 ms highlight, and the script then rejected every later save.
- Autosave every 5 pairs and a final submit use the same endpoint. Also keep progress in `localStorage` so a boy can resume on the same device (new, not in the old artifact).
- Apps Script web app: "Execute as: me", "Who has access: Anyone". It validates input, then writes the sheet row (see `apps-script/Code.gs`).

## Privacy and abuse

- The endpoint URL is effectively public. Validate everything server side: role in the allowed list, at most 100 votes, activity indexes in range, winner is one of the pair, no repeated unordered pair, name length at most 30 each, comment at most 500.
- The endpoint never returns sheet data.
- Consider a simple shared code on the page (not secret, only blocks drive-by posts) and a rate limit. Decide with Katie.
- Never commit responses or names to git.
