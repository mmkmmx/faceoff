# Spec: YM 2027 Pair Rank Survey

## Respondent flow (public page, no login)

1. **Intro.** Explains the survey. About seven minutes.
2. **About you.** First name, last name (both required), role chips: Deacon, Teacher, Priest, Leader.
3. **Pair Rank.** 100 pairs, one at a time: "Which would you rather do?" Two large tap targets (stacked on phones, side by side on desktop, arrow keys on desktop). Buttons: Back, Skip this pair, and from pair 30 on, Finish now. Progress bar and "Pair n of 100".
4. **Anything we missed?** Optional comment, up to 500 characters.
5. **Done.** Thank-you plus the respondent's own top three. No group results.

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

| Columns | Content |
|---|---|
| A | Submitted (date and time) |
| B | Name (first and last) |
| C | Role (exact, so Teachers and Priests can be split) |
| D | Pairs answered (formula: count of non-empty pair cells) |
| E | Comment |
| F to AE | Win rate per activity, in the order of the header row (formulas over the pair cells) |
| AF to EA | Pair 1 to Pair 100, raw result text like `Hiking > Fishing` (winner first) |
| EB | Status: `Finished` or `Unfinished` (to be added, not in the sheet yet) |

Win-rate formula for activity header in `F$1`, row 2:
`=IFERROR(COUNTIF($AF2:$EA2,F$1&" >*")/(COUNTIF($AF2:$EA2,F$1&" >*")+COUNTIF($AF2:$EA2,"*> "&F$1)),"")`

Raw results stay as text so the win rates are formulas a reader can trace.

## Same-name rules (server side, in the Apps Script)

- Match on first plus last name with case and extra spaces ignored.
- If a finished row exists and a new unfinished submission arrives: ignore the new one.
- Otherwise replace the existing row (finished replaces unfinished, newer replaces older of the same status).
- A typo ("Jon" vs "John") makes two rows. The owner merges these by hand.

## Owner-only results (not yet built for the public version)

The old artifact had these views, all computed from the pooled votes:

- Results with four filters: Everyone, Deacons, Teachers & Priests, Leaders. Ranked bars with win rate, wins/appearances, participant count (and how many are unfinished), suggestions, Copy as CSV.
- By boy: per person top five and bottom five, role, pairs answered, an "Unfinished" badge, comment.
- Compare: one row per activity, columns Everyone / Deacons / Teachers & Priests / Leaders showing rank and win rate (orange shading by win rate), plus Gap (highest minus lowest group win rate, orange at 30 or more), sortable by any column.

The code for all three is in `src/claude-artifact/index.html` (`resultsHtml`, `peopleHtml`, `compareHtml`, `tally`, `dedupe`).

A public page cannot show these safely. Options for the public version, to decide in Claude Code:

1. Sheet only: add pivot-style formulas on a second tab (per-group win rates and rank). Simplest, no extra hosting.
2. A separate private dashboard (a local HTML file or a Claude artifact using the owner's Google Sheets connector) that reads the sheet.
3. Both. Recommended starting point: option 1, then add 2 if Katie wants the Compare table.

## Public-version architecture

- Static page hosted on GitHub Pages. No framework needed. Mobile first, light and dark themes.
- The page does not read anything from the server. It only submits.
- Submission: `fetch(WEB_APP_URL, {method: "POST", mode: "no-cors", headers: {"Content-Type": "text/plain"}, body: JSON.stringify(payload)})`. Apps Script web apps do not send CORS headers, so the response cannot be read. Treat a resolved fetch as "sent".
- Autosave every 5 pairs and a final submit use the same endpoint. Also keep progress in `localStorage` so a boy can resume on the same device (new, not in the old artifact).
- Apps Script web app: "Execute as: me", "Who has access: Anyone". It validates input, then writes the sheet row (see `apps-script/Code.gs`).

## Privacy and abuse

- The endpoint URL is effectively public. Validate everything server side: role in the allowed list, at most 100 votes, activity indexes in range, winner is one of the pair, no repeated unordered pair, name length at most 30 each, comment at most 500.
- The endpoint never returns sheet data.
- Consider a simple shared code on the page (not secret, only blocks drive-by posts) and a rate limit. Decide with Katie.
- Never commit responses or names to git.
